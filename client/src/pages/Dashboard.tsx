import { useState, useEffect } from "react";
import { useLocation } from "wouter";
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
function calculateNextDueDate(selectedMonths: number[], inactive: boolean): Date | null {
  if (inactive || selectedMonths.length === 0) {
    return null;
  }
  
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
  inactive: boolean;
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
  const [, setLocation] = useLocation();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPartsDialog, setShowPartsDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<(Client & { parts: Array<{ partId: string; quantity: number }> }) | null>(null);

  // Read tab from URL query parameter using window.location.search
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam === 'clients' ? 'clients' : 'schedule');

  // Update activeTab when URL changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    setActiveTab(tab === 'clients' ? 'clients' : 'schedule');
  }, [window.location.search]);

  const handleTabChange = (value: string) => {
    if (value === 'clients') {
      setLocation('/?tab=clients');
      setActiveTab('clients');
    } else {
      setLocation('/');
      setActiveTab('schedule');
    }
  };

  const { data: dbClients = [], isLoading } = useQuery<DBClient[]>({
    queryKey: ["/api/clients"],
  });

  const { data: recentlyCompleted = [] } = useQuery<MaintenanceItem[]>({
    queryKey: ["/api/maintenance/recently-completed"],
  });


  const [clientParts, setClientParts] = useState<Record<string, ClientPart[]>>({});
  const [completionStatuses, setCompletionStatuses] = useState<Record<string, { completed: boolean; completedDueDate?: string }>>({});

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

    const fetchCompletionStatuses = async () => {
      try {
        const res = await fetch(`/api/maintenance/statuses`);
        if (res.ok) {
          const statuses = await res.json();
          setCompletionStatuses(statuses);
        }
      } catch (error) {
        console.error('Failed to fetch completion statuses', error);
      }
    };

    if (dbClients.length > 0) {
      fetchAllClientParts();
      fetchCompletionStatuses();
    }
  }, [dbClients]);

  const createClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const nextDue = calculateNextDueDate(data.selectedMonths, data.inactive);
      const clientData = {
        companyName: data.companyName,
        location: data.location,
        selectedMonths: data.selectedMonths,
        inactive: data.inactive,
        nextDue: nextDue ? nextDue.toISOString() : new Date('9999-12-31').toISOString(),
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
      queryClient.invalidateQueries({ queryKey: ["/api/reports/parts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/schedule"] });
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
      const nextDue = calculateNextDueDate(data.selectedMonths, data.inactive);
      const clientData = {
        companyName: data.companyName,
        location: data.location,
        selectedMonths: data.selectedMonths,
        inactive: data.inactive,
        nextDue: nextDue ? nextDue.toISOString() : new Date('9999-12-31').toISOString(),
      };
      
      const res = await apiRequest("PUT", `/api/clients/${id}`, clientData);
      const updatedClient = await res.json();
      
      await apiRequest("POST", `/api/clients/${id}/parts`, { parts: data.parts });
      
      return updatedClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/parts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/schedule"] });
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

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/clients/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/parts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/schedule"] });
      toast({
        title: "Client deleted",
        description: "The client has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete client.",
        variant: "destructive",
      });
    },
  });

  const clients: Client[] = dbClients
    .map(c => ({
      id: c.id,
      companyName: c.companyName,
      location: c.location,
      selectedMonths: c.selectedMonths,
      inactive: c.inactive,
      nextDue: new Date(c.nextDue),
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));

  const maintenanceItems: MaintenanceItem[] = clients
    .filter(c => !c.inactive)
    .map(c => ({
      id: c.id,
      companyName: c.companyName,
      location: c.location,
      selectedMonths: c.selectedMonths,
      nextDue: c.nextDue,
      status: (c.nextDue < new Date() ? "overdue" : "upcoming") as "overdue" | "upcoming",
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));

  const overdueItems = maintenanceItems.filter(item => item.status === "overdue");
  const thisMonthItems = maintenanceItems.filter(item => {
    const monthFromNow = new Date();
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);
    return item.nextDue <= monthFromNow && item.status !== "overdue";
  });

  const completedCount = recentlyCompleted.length;

  const handleAddClient = (data: ClientFormData) => {
    if (editingClient) {
      updateClientMutation.mutate({ id: editingClient.id, data });
      setEditingClient(null);
    } else {
      createClientMutation.mutate(data);
    }
  };

  const handleEditClient = async (id: string) => {
    // Extract clientId from composite ID if needed (for recently completed items)
    const clientId = id.includes('|') ? id.split('|')[0] : id;
    
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const parts = clientParts[clientId] || [];
      setEditingClient({
        ...client,
        parts: parts.map(cp => ({ partId: cp.partId, quantity: cp.quantity })),
      });
      setShowAddDialog(true);
    }
  };

  const handleDeleteClient = async (id: string) => {
    await deleteClientMutation.mutateAsync(id);
  };

  const handleMarkComplete = async (id: string) => {
    try {
      // Check if this is a recently completed item (composite ID format: clientId|dueDate)
      let clientId: string;
      let dueDateToSend: string;
      
      if (id.includes('|')) {
        // Recently completed item - extract clientId and dueDate
        const [cId, dueDate] = id.split('|');
        clientId = cId;
        dueDateToSend = dueDate;
      } else {
        // Regular item - find the client
        const client = clients.find(c => c.id === id);
        if (!client) {
          toast({
            title: "Error",
            description: "Client not found.",
            variant: "destructive",
          });
          return;
        }
        clientId = id;
        
        // Determine which dueDate to send
        const status = completionStatuses[id];
        dueDateToSend = status?.completed && status.completedDueDate
          ? status.completedDueDate  // Reopening: use the completed dueDate
          : client.nextDue.toISOString();  // Completing: use current nextDue
      }
      
      const res = await apiRequest("POST", `/api/maintenance/${clientId}/toggle`, {
        dueDate: dueDateToSend
      });
      const data = await res.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/recently-completed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/schedule"] });
      
      // Refetch completion statuses
      const statusRes = await fetch(`/api/maintenance/statuses`);
      if (statusRes.ok) {
        const statuses = await statusRes.json();
        setCompletionStatuses(statuses);
      }
      
      if (data.completed) {
        toast({
          title: "Maintenance completed",
          description: "The maintenance has been marked as complete.",
        });
      } else {
        toast({
          title: "Maintenance reopened",
          description: "The maintenance has been marked as uncompleted.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update maintenance status.",
        variant: "destructive",
      });
    }
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard title="Overdue" value={overdueItems.length} icon={AlertCircle} variant="danger" />
          <StatsCard title="This Month" value={thisMonthItems.length} icon={Calendar} variant="default" />
          <StatsCard title="Completed" value={completedCount} icon={CheckCircle} variant="default" />
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
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
                completionStatuses={completionStatuses}
              />
            )}

            <MaintenanceSection
              title="Due This Month"
              items={thisMonthItems}
              onMarkComplete={handleMarkComplete}
              onEdit={handleEditClient}
              emptyMessage="No maintenance due this month"
              clientParts={clientParts}
              completionStatuses={completionStatuses}
            />

            {recentlyCompleted.length > 0 && (
              <MaintenanceSection
                title="Recently Completed (This Month)"
                items={recentlyCompleted}
                onMarkComplete={handleMarkComplete}
                onEdit={handleEditClient}
                emptyMessage="No recently completed maintenance"
                clientParts={clientParts}
                completionStatuses={completionStatuses}
              />
            )}
          </TabsContent>

          <TabsContent value="clients">
            <ClientListTable clients={clients} onEdit={handleEditClient} onDelete={handleDeleteClient} />
          </TabsContent>
        </Tabs>
      </main>

      <AddClientDialog
        key={editingClient ? `edit-${editingClient.id}` : 'new-client'}
        open={showAddDialog}
        onClose={handleCloseDialog}
        onSubmit={handleAddClient}
        editData={editingClient ? {
          id: editingClient.id,
          companyName: editingClient.companyName,
          location: editingClient.location,
          selectedMonths: editingClient.selectedMonths,
          inactive: editingClient.inactive,
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
