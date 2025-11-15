import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import StatsCard from "@/components/StatsCard";
import MaintenanceSection from "@/components/MaintenanceSection";
import ClientListTable from "@/components/ClientListTable";
import { AlertCircle, Calendar, CheckCircle, Clock, Package, Settings, Search, Building2 } from "lucide-react";
import { MaintenanceItem } from "@/components/MaintenanceCard";
import { Client } from "@/components/ClientListTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  location?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  roofLadderCode?: string | null;
  notes?: string | null;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

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
      address: c.address,
      city: c.city,
      province: c.province,
      postalCode: c.postalCode,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone,
      roofLadderCode: c.roofLadderCode,
      notes: c.notes,
      selectedMonths: c.selectedMonths,
      inactive: c.inactive,
      nextDue: new Date(c.nextDue),
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
  
  // Filter clients for autocomplete (only when 3+ characters)
  const searchMatches = searchQuery.trim().length >= 3
    ? clients.filter(client => {
        const query = searchQuery.toLowerCase();
        return (
          (client.companyName || "").toLowerCase().includes(query) ||
          (client.location || "").toLowerCase().includes(query) ||
          (client.contactName || "").toLowerCase().includes(query) ||
          (client.address || "").toLowerCase().includes(query) ||
          (client.city || "").toLowerCase().includes(query) ||
          (client.province || "").toLowerCase().includes(query)
        );
      })
    : [];
  
  const handleSelectClient = (clientId: string) => {
    setSearchQuery("");
    setSearchOpen(false);
    setLocation(`/client-report/${clientId}`);
  };

  // Helper to determine if an item is overdue
  const isOverdue = (nextDue: Date): boolean => {
    const today = new Date();
    
    // Already past due date
    if (nextDue < today) {
      return true;
    }
    
    // Check if due this month and we're within 7 days of month end
    if (nextDue.getMonth() === today.getMonth() && nextDue.getFullYear() === today.getFullYear()) {
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const daysUntilMonthEnd = Math.ceil((lastDayOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilMonthEnd <= 7;
    }
    
    return false;
  };

  const maintenanceItems: MaintenanceItem[] = clients
    .filter(c => !c.inactive)
    .map(c => ({
      id: c.id,
      companyName: c.companyName,
      location: c.location,
      selectedMonths: c.selectedMonths,
      nextDue: c.nextDue,
      status: (isOverdue(c.nextDue) ? "overdue" : "upcoming") as "overdue" | "upcoming",
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));

  const overdueItems = maintenanceItems.filter(item => item.status === "overdue");
  const thisMonthItems = maintenanceItems.filter(item => {
    const monthFromNow = new Date();
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);
    return item.nextDue <= monthFromNow && item.status !== "overdue";
  });

  const completedCount = recentlyCompleted.length;

  const handleEditClient = async (id: string) => {
    // Extract clientId from composite ID if needed (for recently completed items)
    const clientId = id.includes('|') ? id.split('|')[0] : id;
    setLocation(`/edit-client/${clientId}`);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onAddClient={() => setLocation("/add-client")} />
      
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={searchOpen}
                  className="w-full justify-start text-left font-normal pl-10"
                  data-testid="button-search-clients"
                >
                  {searchQuery || "Search clients..."}
                </Button>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput 
                  placeholder="Type at least 3 characters..." 
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  data-testid="input-search-clients"
                />
                <CommandList>
                  {searchQuery.trim().length < 3 ? (
                    <CommandEmpty>Type at least 3 characters to search...</CommandEmpty>
                  ) : searchMatches.length === 0 ? (
                    <CommandEmpty>No clients found.</CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {searchMatches.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.id}
                          onSelect={() => handleSelectClient(client.id)}
                          data-testid={`search-result-${client.id}`}
                        >
                          <Building2 className="mr-2 h-4 w-4" />
                          <div className="flex-1">
                            <div className="font-medium">{client.companyName}</div>
                            {client.location && (
                              <div className="text-xs text-muted-foreground">{client.location}</div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/company-settings")}
              data-testid="button-company-settings"
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Company Settings
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/manage-parts")}
              data-testid="button-manage-parts"
              className="gap-2"
            >
              <Package className="h-4 w-4" />
              Manage Parts
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            <ClientListTable 
              clients={clients} 
              onEdit={handleEditClient} 
              onDelete={handleDeleteClient}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/clients"] })}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
