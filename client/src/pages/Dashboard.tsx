import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import StatsCard from "@/components/StatsCard";
import MaintenanceSection from "@/components/MaintenanceSection";
import ClientListTable from "@/components/ClientListTable";
import ClientReportDialog from "@/components/ClientReportDialog";
import { AlertCircle, Calendar, CalendarX, CheckCircle, Clock, Package, Settings, Search, Building2, FileText, Download, Users, ChevronDown } from "lucide-react";
import MaintenanceCard, { MaintenanceItem } from "@/components/MaintenanceCard";
import { Client } from "@/components/ClientListTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{
    overdue: boolean;
    upcoming: boolean;
    thisMonth: boolean;
    unscheduled: boolean;
    completed: boolean;
  }>({
    overdue: false,
    upcoming: false,
    thisMonth: false,
    unscheduled: false,
    completed: false,
  });
  
  const [minimizedSections, setMinimizedSections] = useState<{
    scheduled: boolean;
    thisMonthAll: boolean;
    completed: boolean;
  }>({
    scheduled: false,
    thisMonthAll: false,
    completed: false,
  });
  const [reportDialogClientId, setReportDialogClientId] = useState<string | null>(null);
  
  const overdueRef = useRef<HTMLDivElement>(null);
  const thisMonthRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef<HTMLDivElement>(null);

  // Read tab from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam === 'clients' ? 'clients' : 'schedule');

  // Update activeTab when URL changes (location includes both path and search params)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    setActiveTab(tab === 'clients' ? 'clients' : 'schedule');
  }, [location]);

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

  // Fetch current month's calendar assignments to check who's scheduled
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-indexed for API
  
  const { data: calendarData, isLoading: isCalendarLoading } = useQuery<{ assignments: any[]; clients: any[] }>({
    queryKey: ["/api/calendar", currentYear, currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/calendar?year=${currentYear}&month=${currentMonth}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to fetch calendar data");
      return res.json();
    },
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

  // Helper to check if client has PM scheduled for current month
  const hasCurrentMonthPM = (selectedMonths: number[]): boolean => {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    return selectedMonths.includes(currentMonth);
  };

  // Helper to determine if an item is overdue
  const isOverdue = (nextDue: Date, selectedMonths: number[]): boolean => {
    const today = new Date();
    const currentMonth = today.getMonth();
    
    // Only consider overdue if current month is in their scheduled months
    if (!selectedMonths.includes(currentMonth)) {
      return false;
    }
    
    // Already past due date
    if (nextDue < today) {
      return true;
    }
    
    // Check if due this month and we're within 7 days of month end
    if (nextDue.getMonth() === currentMonth && nextDue.getFullYear() === today.getFullYear()) {
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const daysUntilMonthEnd = Math.ceil((lastDayOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilMonthEnd <= 7;
    }
    
    return false;
  };

  // Wait for calendar data to load
  if (isLoading || isCalendarLoading || !calendarData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center py-8">Loading dashboard...</div>
        </main>
      </div>
    );
  }

  // Get scheduled client IDs and their scheduled dates for current month
  const scheduledClientIds = new Set(
    calendarData.assignments.map((a: any) => a.clientId)
  );
  
  // Map of clientId -> scheduledDate from calendar assignments
  const clientScheduledDates = new Map(
    calendarData.assignments.map((a: any) => [a.clientId, new Date(a.scheduledDate)])
  );

  // Clients with PM this month
  const clientsWithCurrentMonthPM = clients.filter(c => !c.inactive && hasCurrentMonthPM(c.selectedMonths));

  // SCHEDULED clients only (for overdue/upcoming calculations)
  // Use calendar scheduled date for overdue determination, not nextDue
  const scheduledMaintenanceItems: MaintenanceItem[] = clientsWithCurrentMonthPM
    .filter(c => scheduledClientIds.has(c.id))
    .map(c => {
      const scheduledDate = clientScheduledDates.get(c.id) || c.nextDue;
      const today = new Date();
      const isOverdueNow = scheduledDate < today;
      
      return {
        id: c.id,
        companyName: c.companyName,
        location: c.location,
        selectedMonths: c.selectedMonths,
        nextDue: scheduledDate, // Use calendar scheduled date instead of client nextDue
        status: (isOverdueNow ? "overdue" : "upcoming") as "overdue" | "upcoming",
      };
    })
    .sort((a, b) => a.companyName.localeCompare(b.companyName));

  // ALL maintenance items for this month (for "Due This Month" count)
  const allMaintenanceItems: MaintenanceItem[] = clientsWithCurrentMonthPM
    .map(c => ({
      id: c.id,
      companyName: c.companyName,
      location: c.location,
      selectedMonths: c.selectedMonths,
      nextDue: c.nextDue,
      status: (isOverdue(c.nextDue, c.selectedMonths) ? "overdue" : "upcoming") as "overdue" | "upcoming",
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));

  // Unscheduled: have PM this month but not on calendar - exclude completed items
  const unscheduledItems: MaintenanceItem[] = clientsWithCurrentMonthPM
    .filter(c => !scheduledClientIds.has(c.id) && !completionStatuses[c.id]?.completed)
    .map(c => ({
      id: c.id,
      companyName: c.companyName,
      location: c.location,
      selectedMonths: c.selectedMonths,
      nextDue: c.nextDue,
      status: (isOverdue(c.nextDue, c.selectedMonths) ? "overdue" : "upcoming") as "overdue" | "upcoming",
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));

  // Overdue/upcoming only from SCHEDULED clients - exclude completed items
  const overdueItems = scheduledMaintenanceItems
    .filter(item => item.status === "overdue" && !completionStatuses[item.id]?.completed);
  
  const thisMonthItems = scheduledMaintenanceItems
    .filter(item => {
      const monthFromNow = new Date();
      monthFromNow.setMonth(monthFromNow.getMonth() + 1);
      return item.nextDue <= monthFromNow && item.status !== "overdue" && !completionStatuses[item.id]?.completed;
    });
  

  const completedCount = recentlyCompleted.length;
  
  const activeClientsCount = clients.filter(c => !c.inactive).length;
  const totalActiveScheduled = allMaintenanceItems.length; // Count ALL with PM this month
  
  const topOverdueClients = overdueItems
    .sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime());
  
  const upcomingNextWeek = scheduledMaintenanceItems
    .filter(item => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      weekFromNow.setHours(23, 59, 59, 999);
      return item.nextDue >= today && item.nextDue <= weekFromNow && item.status !== "overdue" && !completionStatuses[item.id]?.completed;
    })
    .sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime());
  
  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (activeTab !== 'schedule') {
      setActiveTab('schedule');
      setLocation('/');
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      
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
      <Header 
        onAddClient={() => setLocation("/add-client")}
        onDashboardClick={() => {
          setActiveTab('schedule');
          setLocation('/');
        }}
        clients={clients}
      />
      
      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
{activeTab === 'schedule' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <StatsCard 
                title="Overdue" 
                value={overdueItems.length} 
                icon={AlertCircle} 
                variant="danger"
                subtitle="needs attention"
                onClick={() => scrollToSection(overdueRef)}
              />
              <StatsCard 
                title="Upcoming This Week" 
                value={upcomingNextWeek.length} 
                icon={Clock} 
                variant="warning"
                subtitle="next 7 days"
                onClick={() => scrollToSection(thisMonthRef)}
              />
              <StatsCard 
                title="Due This Month" 
                value={totalActiveScheduled} 
                icon={Calendar} 
                variant="default"
                subtitle="total PMs"
                onClick={() => scrollToSection(thisMonthRef)}
              />
              <StatsCard 
                title="Unscheduled" 
                value={unscheduledItems.length} 
                icon={CalendarX} 
                variant="neutral"
                subtitle="not on calendar"
                onClick={() => setLocation('/calendar')}
              />
            </div>

            <div className="space-y-4">
              {/* Scheduled Maintenance */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">Scheduled Maintenance</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      data-testid="button-minimize-scheduled"
                      onClick={() => setMinimizedSections(prev => ({ ...prev, scheduled: !prev.scheduled }))}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${minimizedSections.scheduled ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                {!minimizedSections.scheduled && (
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Overdue */}
                      <div ref={overdueRef}>
                        <div className="flex items-center gap-2 mb-3">
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          <h3 className="text-sm font-medium">Overdue</h3>
                        </div>
                        {overdueItems.length > 0 ? (
                          <>
                            <div className="space-y-2">
                              {(expandedSections.overdue ? overdueItems : overdueItems.slice(0, 3)).map((item) => (
                                <MaintenanceCard
                                  key={item.id}
                                  item={item}
                                  onMarkComplete={handleMarkComplete}
                                  onEdit={handleEditClient}
                                  onViewReport={setReportDialogClientId}
                                  parts={clientParts[item.id] || []}
                                  isCompleted={completionStatuses[item.id]?.completed || false}
                                  isScheduled={true}
                                  isThisMonthPM={true}
                                />
                              ))}
                            </div>
                            {overdueItems.length > 3 && (
                              <Button 
                                variant="ghost" 
                                className="w-full mt-2" 
                                size="sm"
                                data-testid="button-view-all-overdue"
                                onClick={() => setExpandedSections(prev => ({ ...prev, overdue: !prev.overdue }))}
                              >
                                {expandedSections.overdue ? 'Show Less' : `View All (${overdueItems.length})`}
                              </Button>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No overdue maintenance
                          </div>
                        )}
                      </div>

                      {/* Upcoming */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="h-4 w-4 text-status-upcoming" />
                          <h3 className="text-sm font-medium">Upcoming</h3>
                        </div>
                        {upcomingNextWeek.length > 0 ? (
                          <>
                            <div className="space-y-2">
                              {(expandedSections.upcoming ? upcomingNextWeek : upcomingNextWeek.slice(0, 3)).map((item) => (
                                <MaintenanceCard
                                  key={item.id}
                                  item={item}
                                  onMarkComplete={handleMarkComplete}
                                  onEdit={handleEditClient}
                                  onViewReport={setReportDialogClientId}
                                  parts={clientParts[item.id] || []}
                                  isCompleted={completionStatuses[item.id]?.completed || false}
                                  isScheduled={true}
                                  isThisMonthPM={true}
                                />
                              ))}
                            </div>
                            {upcomingNextWeek.length > 3 && (
                              <Button 
                                variant="ghost" 
                                className="w-full mt-2" 
                                size="sm"
                                data-testid="button-view-all-upcoming"
                                onClick={() => setExpandedSections(prev => ({ ...prev, upcoming: !prev.upcoming }))}
                              >
                                {expandedSections.upcoming ? 'Show Less' : `View All (${upcomingNextWeek.length})`}
                              </Button>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No upcoming maintenance
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* This Month's Maintenance */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">This Month's Maintenance</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      data-testid="button-minimize-thismonthall"
                      onClick={() => setMinimizedSections(prev => ({ ...prev, thisMonthAll: !prev.thisMonthAll }))}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${minimizedSections.thisMonthAll ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                {!minimizedSections.thisMonthAll && (
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Due This Month */}
                      <div ref={thisMonthRef}>
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="h-4 w-4 text-status-this-month" />
                          <h3 className="text-sm font-medium">Due This Month (Scheduled)</h3>
                        </div>
                        {thisMonthItems.length > 0 ? (
                          <>
                            <div className="space-y-2">
                              {(expandedSections.thisMonth ? thisMonthItems : thisMonthItems.slice(0, 3)).map((item) => (
                                <MaintenanceCard
                                  key={item.id}
                                  item={item}
                                  onMarkComplete={handleMarkComplete}
                                  onEdit={handleEditClient}
                                  onViewReport={setReportDialogClientId}
                                  parts={clientParts[item.id] || []}
                                  isCompleted={completionStatuses[item.id]?.completed || false}
                                  isScheduled={true}
                                  isThisMonthPM={true}
                                />
                              ))}
                            </div>
                            {thisMonthItems.length > 3 && (
                              <Button 
                                variant="ghost" 
                                className="w-full mt-2" 
                                size="sm"
                                data-testid="button-view-all-thismonth"
                                onClick={() => setExpandedSections(prev => ({ ...prev, thisMonth: !prev.thisMonth }))}
                              >
                                {expandedSections.thisMonth ? 'Show Less' : `View All (${thisMonthItems.length})`}
                              </Button>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No maintenance due this month
                          </div>
                        )}
                      </div>

                      {/* Unscheduled */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <CalendarX className="h-4 w-4 text-status-unscheduled" />
                          <h3 className="text-sm font-medium">This Month (Unscheduled)</h3>
                        </div>
                        {unscheduledItems.length > 0 ? (
                          <>
                            <div className="space-y-2">
                              {(expandedSections.unscheduled ? unscheduledItems : unscheduledItems.slice(0, 3)).map((item) => (
                                <MaintenanceCard
                                  key={item.id}
                                  item={item}
                                  onMarkComplete={handleMarkComplete}
                                  onEdit={handleEditClient}
                                  onViewReport={setReportDialogClientId}
                                  parts={clientParts[item.id] || []}
                                  isCompleted={completionStatuses[item.id]?.completed || false}
                                  isScheduled={false}
                                  isThisMonthPM={true}
                                />
                              ))}
                            </div>
                            {unscheduledItems.length > 3 && (
                              <Button 
                                variant="ghost" 
                                className="w-full mt-2" 
                                size="sm"
                                data-testid="button-view-all-unscheduled"
                                onClick={() => setExpandedSections(prev => ({ ...prev, unscheduled: !prev.unscheduled }))}
                              >
                                {expandedSections.unscheduled ? 'Show Less' : `View All (${unscheduledItems.length})`}
                              </Button>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No unscheduled maintenance
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Completed */}
              {recentlyCompleted.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        Completed
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        data-testid="button-minimize-completed"
                        onClick={() => setMinimizedSections(prev => ({ ...prev, completed: !prev.completed }))}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${minimizedSections.completed ? 'rotate-180' : ''}`} />
                      </Button>
                    </div>
                  </CardHeader>
                  {!minimizedSections.completed && (
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(expandedSections.completed ? recentlyCompleted : recentlyCompleted.slice(0, 6)).map((item) => (
                          <MaintenanceCard
                            key={item.id}
                            item={item}
                            onMarkComplete={handleMarkComplete}
                            onEdit={handleEditClient}
                            onViewReport={setReportDialogClientId}
                            parts={clientParts[item.id] || []}
                            isCompleted={true}
                            isScheduled={true}
                            isThisMonthPM={true}
                          />
                        ))}
                      </div>
                      {recentlyCompleted.length > 6 && (
                        <Button 
                          variant="ghost" 
                          className="w-full mt-2" 
                          size="sm"
                          data-testid="button-view-all-completed"
                          onClick={() => setExpandedSections(prev => ({ ...prev, completed: !prev.completed }))}
                        >
                          {expandedSections.completed ? 'Show Less' : `View All (${recentlyCompleted.length})`}
                        </Button>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          </>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsContent value="schedule" className="space-y-6">
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

      <ClientReportDialog 
        clientId={reportDialogClientId}
        open={!!reportDialogClientId}
        onOpenChange={(open) => !open && setReportDialogClientId(null)}
      />
    </div>
  );
}
