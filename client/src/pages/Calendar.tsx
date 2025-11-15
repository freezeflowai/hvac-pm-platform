import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, DragOverlay, closestCenter, DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function DraggableClient({ id, client, inCalendar }: { id: string; client: any; inCalendar?: boolean }) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`text-xs p-${inCalendar ? '1' : '2'} ${inCalendar ? 'bg-primary/10' : 'border'} rounded hover-elevate cursor-move`}
      data-testid={inCalendar ? `assigned-client-${id}` : `unscheduled-client-${client.id}`}
    >
      <div className="font-medium">{client.companyName}</div>
      {!inCalendar && client.location && (
        <div className="text-muted-foreground">{client.location}</div>
      )}
    </div>
  );
}

function DroppableDay({ day, year, month, assignments, clients, onRemove }: { 
  day: number; 
  year: number; 
  month: number; 
  assignments: any[]; 
  clients: any[];
  onRemove: (assignmentId: string) => void;
}) {
  const { setNodeRef } = useSortable({ id: `day-${day}` });

  return (
    <Card
      ref={setNodeRef}
      className="min-h-24 hover-elevate"
      data-testid={`calendar-day-${day}`}
    >
      <CardContent className="p-2">
        <div className="font-semibold text-sm mb-1">{day}</div>
        <div className="space-y-1">
          {assignments.map((assignment: any) => {
            const client = clients.find((c: any) => c.id === assignment.clientId);
            return client ? (
              <div key={assignment.id} className="relative group">
                <DraggableClient 
                  id={assignment.id} 
                  client={client}
                  inCalendar={true}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(assignment.id);
                  }}
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  data-testid={`remove-assignment-${assignment.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null;
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"monthly" | "weekly">("monthly");
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();
  
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
      
      // Check if dragging from unscheduled list (client ID format)
      const isFromUnscheduled = activeId.length === 36 && activeId.includes('-'); // UUID format
      
      if (isFromUnscheduled) {
        // Create new assignment
        createAssignment.mutate({ clientId: activeId, day });
      } else {
        // Move existing assignment
        updateAssignment.mutate({ id: activeId, day });
      }
    }
  };

  const handleRemove = (assignmentId: string) => {
    deleteAssignment.mutate(assignmentId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center py-8">Loading calendar...</div>
        </main>
      </div>
    );
  }

  const { assignments = [], clients = [] } = data || {};
  
  // Get unscheduled clients (active clients not in assignments for this month)
  const scheduledClientIds = new Set(assignments.map((a: any) => a.clientId));
  const unscheduledClients = clients.filter((c: any) => !c.inactive && !scheduledClientIds.has(c.id));

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
          />
        ) : (
          <Card key={i} className="min-h-24 bg-muted/20">
            <CardContent className="p-2" />
          </Card>
        )
      );
    }

    return days;
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-background">
        <Header />
        
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

            <div className="flex items-center gap-2">
              <Select value={view} onValueChange={(v) => setView(v as "monthly" | "weekly")}>
                <SelectTrigger className="w-32" data-testid="select-view">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Calendar View</CardTitle>
                </CardHeader>
                <CardContent>
                  {view === "monthly" && (
                    <>
                      <div className="grid grid-cols-7 gap-2 mb-2">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                          <div key={day} className="text-center font-semibold text-sm">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {renderMonthlyView()}
                      </div>
                    </>
                  )}
                  {view === "weekly" && (
                    <div className="text-center py-8 text-muted-foreground">
                      Weekly view coming soon...
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Unscheduled ({unscheduledClients.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {unscheduledClients.map((client: any) => (
                      <DraggableClient
                        key={client.id}
                        id={client.id}
                        client={client}
                      />
                    ))}
                    {unscheduledClients.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        All clients scheduled
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
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
      </div>
    </DndContext>
  );
}
