import { useState, useEffect } from "react";
import Header from "@/components/Header";
import StatsCard from "@/components/StatsCard";
import MaintenanceSection from "@/components/MaintenanceSection";
import ClientListTable from "@/components/ClientListTable";
import AddClientDialog, { ClientFormData } from "@/components/AddClientDialog";
import PartsManagementDialog from "@/components/PartsManagementDialog";
import { AlertCircle, Calendar, CheckCircle, Clock, Package } from "lucide-react";
import { MaintenanceItem } from "@/components/MaintenanceCard";
import { Client } from "@/components/ClientListTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Helper function to calculate next due date based on selected months
function calculateNextDueDate(selectedMonths: number[]): Date {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  if (selectedMonths.includes(currentMonth)) {
    return new Date(currentYear, currentMonth, 15);
  }
  
  let nextMonth = selectedMonths.find(m => m > currentMonth);
  
  if (nextMonth === undefined) {
    nextMonth = selectedMonths[0];
    return new Date(currentYear + 1, nextMonth, 15);
  }
  
  return new Date(currentYear, nextMonth, 15);
}

interface DBClient {
  id: string;
  companyName: string;
  location: string;
  selectedMonths: number[];
  nextDue: string;
}

interface ClientPart {
  id: string;
  partId: string;
  quantity: number;
  part: {
    id: string;
    name: string;
    type: string;
    size: string;
  };
}

export default function Dashboard() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPartsDialog, setShowPartsDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<(Client & { parts: Array<{ partId: string; quantity: number }> }) | null>(null);

  const { data: dbClients = [], isLoading } = useQuery<DBClient[]>({
    queryKey: ["/api/clients"],
  });

  const [clientParts, setClientParts] = useState<Record<string, ClientPart[]>>({});

  useEffect(() => {
    const fetchAllClientParts = async () => {
      const partsData: Record<string, ClientPart[]> = {};
      for (const client of dbClients) {
        try {
          const res = await fetch(`/api/clients/${client.id}/parts`);
          if (res.ok) {
            partsData[client.id] = await res.json();
          }
        } catch (error) {
          console.error(`Failed to fetch parts for client ${client.id}`, error);
        }
      }
      setClientParts(partsData);
    };

    if (dbClients.length > 0) {
      fetchAllClientParts();
    }
  }, [dbClients]);

  const createClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const nextDue = calculateNextDueDate(data.selectedMonths);
      const clientData = {
        companyName: data.companyName,
        location: data.location,
        selectedMonths: data.selectedMonths,
        nextDue: nextDue.toISOString(),
      };
      
      const res = await apiRequest("POST", "/api/clients", clientData);
      const newClient = await res.json();
      
      if (data.parts.length > 0) {
        await apiRequest("POST", `/api/clients/${newClient.id}/parts`, { parts: data.parts });
      }
      
      return newClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client added",
        description: "The client has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add client.",
        variant: "destructive",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClientFormData }) => {
      const nextDue = calculateNextDueDate(data.selectedMonths);
      const clientData = {
        companyName: data.companyName,
        location: data.location,
        selectedMonths: data.selectedMonths,
        nextDue: nextDue.toISOString(),
      };
      
      const res = await apiRequest("PUT", `/api/clients/${id}`, clientData);
      const updatedClient = await res.json();
      
      await apiRequest("POST", `/api/clients/${id}/parts`, { parts: data.parts });
      
      return updatedClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client updated",
        description: "The client has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update client.",
        variant: "destructive",
      });
    },
  });

  const clients: Client[] = dbClients.map(c => ({
    id: c.id,
    companyName: c.companyName,
    location: c.location,
    selectedMonths: c.selectedMonths,
    nextDue: new Date(c.nextDue),
  }));

  const maintenanceItems: MaintenanceItem[] = clients.map(c => ({
    id: c.id,
    companyName: c.companyName,
    location: c.location,
    selectedMonths: c.selectedMonths,
    nextDue: c.nextDue,
    status: c.nextDue < new Date() ? "overdue" : "upcoming",
  }));

  const overdueItems = maintenanceItems.filter(item => item.status === "overdue");
  const thisWeekItems = maintenanceItems.filter(item => {
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return item.nextDue <= weekFromNow && item.status !== "overdue";
  });
  const thisMonthItems = maintenanceItems.filter(item => {
    const monthFromNow = new Date();
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);
    return item.nextDue <= monthFromNow && item.status !== "overdue";
  });

  const completedCount = 0;

  const handleAddClient = (data: ClientFormData) => {
    if (editingClient) {
      updateClientMutation.mutate({ id: editingClient.id, data });
      setEditingClient(null);
    } else {
      createClientMutation.mutate(data);
    }
  };

  const handleEditClient = async (id: string) => {
    const client = clients.find(c => c.id === id);
    if (client) {
      const parts = clientParts[id] || [];
      setEditingClient({
        ...client,
        parts: parts.map(cp => ({ partId: cp.partId, quantity: cp.quantity })),
      });
      setShowAddDialog(true);
    }
  };

  const handleMarkComplete = async (id: string) => {
    console.log('Marked complete:', id);
    toast({
      title: "Maintenance completed",
      description: "The maintenance has been marked as complete.",
    });
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingClient(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onAddClient={() => setShowAddDialog(true)} />
      
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => setShowPartsDialog(true)}
            data-testid="button-manage-parts"
            className="gap-2"
          >
            <Package className="h-4 w-4" />
            Manage Parts
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Overdue" value={overdueItems.length} icon={AlertCircle} variant="danger" />
          <StatsCard title="This Week" value={thisWeekItems.length} icon={Clock} variant="warning" />
          <StatsCard title="This Month" value={thisMonthItems.length} icon={Calendar} variant="default" />
          <StatsCard title="Completed" value={completedCount} icon={CheckCircle} variant="default" />
        </div>

        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList data-testid="tabs-main-nav">
            <TabsTrigger value="schedule" data-testid="tab-schedule">
              Schedule
            </TabsTrigger>
            <TabsTrigger value="clients" data-testid="tab-clients">
              All Clients
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-6">
            {overdueItems.length > 0 && (
              <MaintenanceSection
                title="Overdue Maintenance"
                items={overdueItems}
                onMarkComplete={handleMarkComplete}
                onEdit={handleEditClient}
                emptyMessage="No overdue maintenance"
                clientParts={clientParts}
              />
            )}

            <MaintenanceSection
              title="Due This Week"
              items={thisWeekItems}
              onMarkComplete={handleMarkComplete}
              onEdit={handleEditClient}
              emptyMessage="No maintenance due this week"
              clientParts={clientParts}
            />

            <MaintenanceSection
              title="Due This Month"
              items={thisMonthItems}
              onMarkComplete={handleMarkComplete}
              onEdit={handleEditClient}
              emptyMessage="No maintenance due this month"
              clientParts={clientParts}
            />
          </TabsContent>

          <TabsContent value="clients">
            <ClientListTable clients={clients} onEdit={handleEditClient} />
          </TabsContent>
        </Tabs>
      </main>

      <AddClientDialog
        open={showAddDialog}
        onClose={handleCloseDialog}
        onSubmit={handleAddClient}
        editData={editingClient ? {
          id: editingClient.id,
          companyName: editingClient.companyName,
          location: editingClient.location,
          selectedMonths: editingClient.selectedMonths,
          parts: editingClient.parts,
        } : undefined}
      />

      <PartsManagementDialog
        open={showPartsDialog}
        onClose={() => setShowPartsDialog(false)}
      />
    </div>
  );
}
