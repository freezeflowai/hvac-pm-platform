import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, DragOverlay, closestCenter, DragEndEvent, DragStartEvent, useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

function UnscheduledPanel({ clients }: { clients: any[] }) {
  const { setNodeRef } = useDroppable({ id: 'unscheduled-panel' });

  return (
    <div>
      <Card className="h-full shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Unscheduled ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-4rem)]">
          <div 
            ref={setNodeRef}
            className="space-y-2 h-full overflow-y-auto"
            data-testid="unscheduled-panel"
          >
            {clients.map((client: any) => (
              <DraggableClient
                key={client.id}
                id={client.id}
                client={client}
              />
            ))}
            {clients.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                All clients scheduled
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DraggableClient({ id, client, inCalendar, onClick, isCompleted, isOverdue }: { id: string; client: any; inCalendar?: boolean; onClick?: () => void; isCompleted?: boolean; isOverdue?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Color coding: red = overdue, blue = this month (scheduled), primary = completed
  const getBackgroundColor = () => {
    if (!inCalendar) return 'bg-status-unscheduled/10 border border-status-unscheduled/30';
    if (isCompleted) return 'bg-primary/10 border-primary/30';
    if (isOverdue) return 'bg-status-overdue/10 border-status-overdue/30';
    return 'bg-status-this-month/10 border-status-this-month/30';
  };

  const handleClick = (e: React.MouseEvent) => {
    if (onClick && inCalendar && !isDragging) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`text-xs p-2 rounded-lg hover:shadow-md transition-all relative cursor-move select-none ${getBackgroundColor()}`}
      data-testid={inCalendar ? `assigned-client-${id}` : `unscheduled-client-${client.id}`}
    >
      <div className={`font-semibold ${isCompleted ? 'line-through opacity-60' : ''}`}>{client.companyName}</div>
      {client.location && (
        <div className={`text-muted-foreground text-[10px] ${isCompleted ? 'line-through opacity-60' : ''}`}>{client.location}</div>
      )}
    </div>
  );
}

function DroppableDay({ day, year, month, assignments, clients, onRemove, onClientClick }: { 
  day: number; 
  year: number; 
  month: number; 
  assignments: any[]; 
  clients: any[];
  onRemove: (assignmentId: string) => void;
  onClientClick: (client: any, assignment: any) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` });
  
  // Check if day is overdue
  const today = new Date();
  const dayDate = new Date(year, month - 1, day);
  const isOverdue = dayDate < today;

  return (
    <div
      ref={setNodeRef}
      className={`h-full p-2 border transition-all ${
        isOver 
          ? 'bg-primary/10 border-primary border-2 ring-2 ring-primary/30 shadow-md' 
          : 'bg-background'
      }`}
      data-testid={`calendar-day-${day}`}
    >
      <div className="text-sm text-muted-foreground mb-1">{day}</div>
      <div className="space-y-1">
        {assignments.map((assignment: any) => {
          const client = clients.find((c: any) => c.id === assignment.clientId);
          return client ? (
            <div key={assignment.id} className="relative group">
              <DraggableClient 
                id={assignment.id} 
                client={client}
                inCalendar={true}
                onClick={() => onClientClick(client, assignment)}
                isCompleted={assignment.completed}
                isOverdue={!assignment.completed && isOverdue}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(assignment.id);
                }}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                data-testid={`remove-assignment-${assignment.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"monthly" | "weekly">("monthly");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/calendar", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/calendar?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch calendar data");
      return res.json();
    }
  });

  const createAssignment = useMutation({
    mutationFn: async ({ clientId, day }: { clientId: string; day: number }) => {
      return apiRequest("POST", `/api/calendar/assign`, {
        clientId,
        year,
        month,
        day,
        scheduledDate: new Date(year, month - 1, day).toISOString().split('T')[0],
        autoDueDate: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", year, month] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client scheduled",
        description: "The client has been added to the calendar",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule client",
        variant: "destructive",
      });
    },
  });

  const updateAssignment = useMutation({
    mutationFn: async ({ id, day }: { id: string; day: number }) => {
      return apiRequest("PATCH", `/api/calendar/assign/${id}`, {
        day,
        scheduledDate: new Date(year, month - 1, day).toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", year, month] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Updated",
        description: "The assignment has been moved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update assignment",
        variant: "destructive",
      });
    },
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/calendar/assign/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", year, month] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Removed",
        description: "The client has been unscheduled",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove assignment",
        variant: "destructive",
      });
    },
  });

  const clearSchedule = useMutation({
    mutationFn: async () => {
      // Delete all assignments for this month
      const deletePromises = assignments.map((assignment: any) => 
        apiRequest("DELETE", `/api/calendar/assign/${assignment.id}`)
      );
      return Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", year, month] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Schedule cleared",
        description: "All clients have been moved to unscheduled",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear schedule",
        variant: "destructive",
      });
    },
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const overId = over.id as string;
    const activeId = active.id as string;

    // Check if dropping on a day
    if (overId.startsWith('day-')) {
      const day = parseInt(overId.replace('day-', ''));
      
      // Check if the activeId is an assignment ID (exists in assignments) or a client ID (from unscheduled)
      const isExistingAssignment = assignments.some((a: any) => a.id === activeId);
      
      if (isExistingAssignment) {
        // Move existing assignment
        updateAssignment.mutate({ id: activeId, day });
      } else {
        // Create new assignment from unscheduled client
        createAssignment.mutate({ clientId: activeId, day });
      }
    } else if (overId === 'unscheduled-panel') {
      // Dropped on unscheduled panel - remove from calendar
      const isExistingAssignment = assignments.some((a: any) => a.id === activeId);
      if (isExistingAssignment) {
        deleteAssignment.mutate(activeId);
      }
    }
  };

  const handleRemove = (assignmentId: string) => {
    deleteAssignment.mutate(assignmentId);
  };

  const handleClientClick = (client: any, assignment: any) => {
    setSelectedClient(client);
    setSelectedAssignment(assignment);
  };

  const toggleComplete = useMutation({
    mutationFn: async () => {
      if (!selectedAssignment) return;
      return apiRequest("PATCH", `/api/calendar/assign/${selectedAssignment.id}`, {
        completed: !selectedAssignment.completed
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", year, month] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/recently-completed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/statuses"] });
      setSelectedClient(null);
      setSelectedAssignment(null);
      toast({
        title: "Updated",
        description: selectedAssignment?.completed ? "Marked as incomplete" : "Marked as complete",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update completion status",
        variant: "destructive",
      });
    },
  });

  const { data: allClients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header clients={allClients} onAddClient={() => setLocation("/add-client")} />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center py-8">Loading calendar...</div>
        </main>
      </div>
    );
  }

  const { assignments = [], clients = [] } = data || {};
  
  // Get unscheduled clients (active clients with PM this month, not yet scheduled)
  const scheduledClientIds = new Set(assignments.map((a: any) => a.clientId));
  const currentMonthIndex = currentDate.getMonth(); // 0-indexed for selectedMonths
  const unscheduledClients = clients.filter((c: any) => 
    !c.inactive && 
    !scheduledClientIds.has(c.id) &&
    c.selectedMonths?.includes(currentMonthIndex)
  );

  // Create a map of assignments by day
  const assignmentsByDay: Record<number, any[]> = {};
  assignments.forEach((assignment: any) => {
    if (assignment.day) {
      if (!assignmentsByDay[assignment.day]) {
        assignmentsByDay[assignment.day] = [];
      }
      assignmentsByDay[assignment.day].push(assignment);
    }
  });

  // Get active dragging item
  const activeClient = activeId ? 
    (unscheduledClients.find((c: any) => c.id === activeId) || 
     assignments.find((a: any) => a.id === activeId)) : null;

  // Render calendar grid
  const renderMonthlyView = () => {
    const days = [];
    const totalCells = Math.ceil((daysInMonth + firstDayOfMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const dayNumber = i - firstDayOfMonth + 1;
      const isValidDay = dayNumber > 0 && dayNumber <= daysInMonth;
      const dayAssignments = isValidDay ? (assignmentsByDay[dayNumber] || []) : [];

      days.push(
        isValidDay ? (
          <DroppableDay
            key={i}
            day={dayNumber}
            year={year}
            month={month}
            assignments={dayAssignments}
            clients={clients}
            onRemove={handleRemove}
            onClientClick={handleClientClick}
          />
        ) : (
          <div key={i} className="h-full p-2 border bg-muted/10" />
        )
      );
    }

    return days;
  };

  const renderWeeklyView = () => {
    // Get current week dates
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay()); // Start on Sunday

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      
      const dayNumber = date.getDate();
      const isCurrentMonth = date.getMonth() === month - 1 && date.getFullYear() === year;
      const dayAssignments = isCurrentMonth ? (assignmentsByDay[dayNumber] || []) : [];

      weekDays.push(
        isCurrentMonth ? (
          <DroppableDay
            key={i}
            day={dayNumber}
            year={year}
            month={month}
            assignments={dayAssignments}
            clients={clients}
            onRemove={handleRemove}
            onClientClick={handleClientClick}
          />
        ) : (
          <div key={i} className="h-full p-2 border bg-muted/10">
            <div className="text-xs text-muted-foreground">
              {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        )
      );
    }

    return (
      <>
        <div className="grid grid-cols-7">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i);
            return (
              <div key={day} className="text-center p-2 border bg-muted/5">
                <div className="font-medium text-sm">{day}</div>
                <div className="text-xs text-muted-foreground">
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7">
          {weekDays}
        </div>
      </>
    );
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-background">
        <Header clients={allClients} onAddClient={() => setLocation("/add-client")} />
        
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={previousMonth}
                data-testid="button-previous-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-2xl font-bold">
                {monthNames[month - 1]} {year}
              </h2>
              <Button
                variant="outline"
                size="icon"
                onClick={nextMonth}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={goToToday}
                data-testid="button-today"
              >
                Today
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearSchedule.mutate()}
                disabled={clearSchedule.isPending || assignments.length === 0}
                data-testid="button-clear-schedule"
              >
                Clear Schedule
              </Button>
              <div className="flex gap-1 bg-muted/50 p-1 rounded-full">
                <Button
                  variant={view === "monthly" ? "default" : "ghost"}
                  size="sm"
                  className={`rounded-full ${view === "monthly" ? "" : "hover:bg-background/60"}`}
                  onClick={() => setView("monthly")}
                  data-testid="button-monthly-view"
                >
                  Monthly
                </Button>
                <Button
                  variant={view === "weekly" ? "default" : "ghost"}
                  size="sm"
                  className={`rounded-full ${view === "weekly" ? "" : "hover:bg-background/60"}`}
                  onClick={() => setView("weekly")}
                  data-testid="button-weekly-view"
                >
                  Weekly
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: 'calc(100vh - 12rem)' }}>
            <div className="lg:col-span-3 flex flex-col">
              <Card className="h-full flex flex-col">
                <CardContent className="flex-1 overflow-auto p-0">
                  {view === "monthly" && (
                    <div className="h-full flex flex-col">
                      <div className="grid grid-cols-7">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                          <div key={day} className="text-center font-medium text-sm p-2 border bg-muted/5">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 grid-rows-6 flex-1">
                        {renderMonthlyView()}
                      </div>
                    </div>
                  )}
                  {view === "weekly" && (
                    <div className="h-full flex flex-col">
                      {renderWeeklyView()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="h-full">
              <UnscheduledPanel clients={unscheduledClients} />
            </div>
          </div>
        </main>

        <DragOverlay>
          {activeId && activeClient ? (
            <div className="text-xs p-2 border rounded bg-background shadow-lg">
              <div className="font-medium">
                {activeClient.companyName || clients.find((c: any) => c.id === activeClient.clientId)?.companyName}
              </div>
            </div>
          ) : null}
        </DragOverlay>

        <Dialog open={!!selectedClient} onOpenChange={() => {
          setSelectedClient(null);
          setSelectedAssignment(null);
        }}>
          <DialogContent data-testid="client-detail-dialog">
            <DialogHeader>
              <DialogTitle>Client Details</DialogTitle>
            </DialogHeader>
            {selectedClient && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Company Name</div>
                    <div className="text-base font-semibold" data-testid="dialog-company-name">
                      {selectedClient.companyName}
                    </div>
                  </div>
                  {selectedClient.location && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Location</div>
                      <div className="text-base" data-testid="dialog-location">
                        {selectedClient.location}
                      </div>
                    </div>
                  )}
                  {selectedClient.address && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Address</div>
                      <div className="text-base" data-testid="dialog-address">
                        {selectedClient.address}
                      </div>
                    </div>
                  )}
                </div>
                {selectedAssignment && (
                  <Button
                    onClick={() => toggleComplete.mutate()}
                    disabled={toggleComplete.isPending}
                    variant={selectedAssignment.completed ? "outline" : "default"}
                    className="w-full"
                    data-testid="button-toggle-complete"
                  >
                    {selectedAssignment.completed ? "Mark as Incomplete" : "Mark as Complete"}
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  );
}
