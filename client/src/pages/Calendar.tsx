import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, DragOverlay, closestCenter, DragEndEvent, DragStartEvent, useDroppable, pointerWithin, CollisionDetection } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect } from "react";
import NewAddClientDialog from "@/components/NewAddClientDialog";
import ClientReportDialog from "@/components/ClientReportDialog";
import { RouteOptimizationDialog } from "@/components/RouteOptimizationDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Mail, ChevronsRight, ChevronsLeft, Route } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

function UnscheduledPanel({ clients, onClientClick, isMinimized, onToggleMinimize }: { 
  clients: any[]; 
  onClientClick?: (clientId: string) => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: 'unscheduled-panel' });

  if (isMinimized) {
    return (
      <div className="fixed right-0 top-0 h-screen flex items-center z-50">
        <Card className="h-full w-12 shadow-lg rounded-l-xl rounded-r-none flex flex-col items-center justify-center border-r-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMinimize}
            className="mb-4"
            data-testid="button-expand-unscheduled"
          >
            <ChevronsLeft className="h-5 w-5" />
          </Button>
          <div className="writing-mode-vertical text-sm font-semibold text-muted-foreground whitespace-nowrap" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            Unscheduled ({clients.length})
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Card className="h-full shadow-md rounded-xl flex flex-col overflow-hidden">
        <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between space-y-0 flex-shrink-0">
          <CardTitle className="text-sm font-semibold">Unscheduled ({clients.length})</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMinimize}
            className="h-7 w-7"
            data-testid="button-minimize-unscheduled"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-4 pt-2">
          <div 
            ref={setNodeRef}
            className="space-y-2 h-full overflow-y-auto pr-2"
            style={{ scrollbarWidth: 'thin' }}
            data-testid="unscheduled-panel"
          >
            {clients.map((client: any) => (
              <DraggableClient
                key={client.id}
                id={client.id}
                client={client}
                onClick={() => onClientClick?.(client.id)}
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

  const [clickStartPos, setClickStartPos] = useState<{ x: number; y: number } | null>(null);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    setClickStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger onClick if the mouse didn't move significantly (not a drag)
    if (onClick && clickStartPos) {
      const deltaX = Math.abs(e.clientX - clickStartPos.x);
      const deltaY = Math.abs(e.clientY - clickStartPos.y);
      
      // If movement is less than 5 pixels, consider it a click
      if (deltaX < 5 && deltaY < 5) {
        onClick();
      }
    }
    setClickStartPos(null);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`text-xs px-1.5 py-1 rounded hover:shadow-md transition-all relative cursor-grab active:cursor-grabbing select-none ${getBackgroundColor()}`}
      data-testid={inCalendar ? `assigned-client-${id}` : `unscheduled-client-${client.id}`}
    >
      <div className={`font-semibold leading-tight ${isCompleted ? 'line-through opacity-60' : ''}`}>{client.companyName}</div>
      {client.location && (
        <div className={`text-muted-foreground text-[10px] leading-tight ${isCompleted ? 'line-through opacity-60' : ''}`}>{client.location}</div>
      )}
    </div>
  );
}

function DayPartsCell({ assignments, clients, dayName, date, showOnlyOutstanding }: { assignments: any[]; clients: any[]; dayName: string; date: Date; showOnlyOutstanding: boolean }) {
  const { toast } = useToast();
  
  // Filter assignments based on mode
  const relevantAssignments = showOnlyOutstanding 
    ? assignments.filter((a: any) => !a.completed)
    : assignments;
  
  const clientIds = relevantAssignments.map((a: any) => a.clientId);
  
  const { data: bulkParts = {} } = useQuery<Record<string, any[]>>({
    queryKey: ['/api/client-parts/bulk'],
    staleTime: 60 * 1000,
  });

  const allParts = clientIds.flatMap((clientId: string) => bulkParts[clientId] || []);

  // Aggregate parts by type
  const partCounts: Record<string, number> = allParts.reduce((acc: Record<string, number>, clientPart: any) => {
    const part = clientPart.part;
    if (!part) return acc;
    
    let key: string;
    if (part.type === 'filter') {
      key = `${part.filterType || 'Filter'} ${part.size || ''}`.trim();
    } else if (part.type === 'belt') {
      key = `Belt ${part.beltType || ''} ${part.size || ''}`.trim();
    } else {
      return acc; // Skip non-filter/belt parts
    }
    
    acc[key] = (acc[key] || 0) + clientPart.quantity;
    return acc;
  }, {});

  const sortedParts = Object.entries(partCounts).sort(([a], [b]) => a.localeCompare(b));

  const handleEmailParts = () => {
    if (sortedParts.length === 0) {
      toast({
        title: "No parts",
        description: "There are no parts scheduled for this day.",
        variant: "destructive",
      });
      return;
    }

    const partsList = sortedParts.map(([partName, quantity]) => `${partName} ×${quantity}`).join('\n');
    const reportType = showOnlyOutstanding ? 'Outstanding Parts' : 'All Parts';
    const subject = `${reportType} for ${dayName} ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const body = `Required Parts${showOnlyOutstanding ? ' (Outstanding Only)' : ''}:\n\n${partsList}`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="px-1.5 py-1 border bg-card">
      {sortedParts.length > 0 ? (
        <>
          <div className="space-y-0 mb-1">
            {sortedParts.map(([partName, quantity]) => (
              <div key={partName} className="flex items-center justify-between gap-0.5 text-[10px] leading-tight py-0.5">
                <span className="flex-1 truncate" title={partName}>{partName}</span>
                <span className="font-semibold text-primary shrink-0 text-[11px]">×{quantity}</span>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleEmailParts}
            className="h-5 px-1.5 text-[10px] w-full"
            data-testid={`button-email-${dayName.toLowerCase()}`}
          >
            <Mail className="h-2.5 w-2.5 mr-0.5" />
            Email
          </Button>
        </>
      ) : (
        <div className="text-[10px] text-muted-foreground text-center py-2">
          No parts
        </div>
      )}
    </div>
  );
}

function DroppableDay({ day, year, month, assignments, clients, onRemove, onClientClick, onClearDay, showParts = false }: { 
  day: number; 
  year: number; 
  month: number; 
  assignments: any[]; 
  clients: any[];
  onRemove: (assignmentId: string) => void;
  onClientClick: (client: any, assignment: any) => void;
  onClearDay: (day: number, dayAssignments: any[]) => void;
  showParts?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` });
  
  // Check if day is overdue
  const today = new Date();
  const dayDate = new Date(year, month - 1, day);
  const isOverdue = dayDate < today;

  return (
    <div
      ref={setNodeRef}
      className={`min-h-24 px-1 py-2 border transition-all flex flex-col ${
        isOver 
          ? 'bg-primary/10 border-primary border-2 ring-2 ring-primary/30 shadow-md' 
          : 'bg-background'
      }`}
      data-testid={`calendar-day-${day}`}
    >
      <div className="text-sm text-muted-foreground mb-1 px-0.5">{day}</div>
      <div className="space-y-1 flex-1">
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
      {assignments.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onClearDay(day, assignments);
          }}
          className="mt-1 h-6 text-xs w-full"
          data-testid={`button-clear-day-${day}`}
        >
          Clear Day
        </Button>
      )}
    </div>
  );
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"monthly" | "weekly">("weekly");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [reportDialogClientId, setReportDialogClientId] = useState<string | null>(null);
  const [isUnscheduledMinimized, setIsUnscheduledMinimized] = useState(false);
  const [showOnlyOutstanding, setShowOnlyOutstanding] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [routeOptimizationOpen, setRouteOptimizationOpen] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data, isLoading: isLoadingCalendar } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled", year, month] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled", year, month] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled", year, month] });
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
    mutationFn: async (assignmentsToDelete: any[]) => {
      // Delete all assignments for this month
      const deletePromises = assignmentsToDelete.map((assignment: any) => 
        apiRequest("DELETE", `/api/calendar/assign/${assignment.id}`)
      );
      return Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", year, month] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled", year, month] });
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

  const clearDay = useMutation({
    mutationFn: async ({ day, dayAssignments }: { day: number; dayAssignments: any[] }) => {
      // Delete all assignments for this specific day
      const deletePromises = dayAssignments.map((assignment: any) => 
        apiRequest("DELETE", `/api/calendar/assign/${assignment.id}`)
      );
      return Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", year, month] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled", year, month] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Day cleared",
        description: "All clients for this day have been unscheduled",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear day",
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

  const handleClearDay = (day: number, dayAssignments: any[]) => {
    clearDay.mutate({ day, dayAssignments });
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
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled", year, month] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/recently-completed"] });
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

  const { data: allClients = [], isLoading: isLoadingClients } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const { data: unscheduledClients = [], isLoading: isLoadingUnscheduled } = useQuery<any[]>({
    queryKey: ["/api/calendar/unscheduled", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/calendar/unscheduled?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch unscheduled clients");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Listen for sidebar events
  useEffect(() => {
    const handleAddClient = () => setAddClientDialogOpen(true);
    const handleOpenClient = (e: Event) => {
      const customEvent = e as CustomEvent;
      setReportDialogClientId(customEvent.detail.clientId);
    };

    window.addEventListener('openAddClientDialog', handleAddClient);
    window.addEventListener('openClientDialog', handleOpenClient);

    return () => {
      window.removeEventListener('openAddClientDialog', handleAddClient);
      window.removeEventListener('openClientDialog', handleOpenClient);
    };
  }, []);

  const { assignments = [], clients = [] } = data || {};

  // Custom collision detection that only checks drop zones (days), not individual items
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // Filter to only check day drop zones and the unscheduled panel
    const dropZoneContainers = args.droppableContainers.filter(
      (container) => {
        const id = container.id as string;
        return id.startsWith('day-') || id === 'unscheduled-panel';
      }
    );

    // Use pointer-first approach for precision
    const pointerCollisions = pointerWithin({
      ...args,
      droppableContainers: dropZoneContainers,
    });
    
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    // Fallback to closestCenter
    return closestCenter({
      ...args,
      droppableContainers: dropZoneContainers,
    });
  }, []);

  if (isLoadingCalendar || isLoadingClients || isLoadingUnscheduled) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center py-8">Loading calendar...</div>
        </main>
      </div>
    );
  }

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
            onClearDay={handleClearDay}
            showParts={false}
          />
        ) : (
          <div key={i} className="min-h-24 p-2 border bg-muted/10" />
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
    const weekDaysData = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      
      const dayNumber = date.getDate();
      const isCurrentMonth = date.getMonth() === month - 1 && date.getFullYear() === year;
      const dayAssignments = isCurrentMonth ? (assignmentsByDay[dayNumber] || []) : [];

      weekDaysData.push({
        date,
        dayNumber,
        isCurrentMonth,
        dayAssignments,
        dayName: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]
      });

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
            onClearDay={handleClearDay}
            showParts={false}
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
          {weekDaysData.map((dayData, i) => (
            <div key={dayData.dayName} className="text-center p-2 border bg-muted/5">
              <div className="font-medium text-sm">{dayData.dayName}</div>
              <div className="text-xs text-muted-foreground">
                {dayData.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weekDays}
        </div>
        
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Parts Order</h3>
            <Button
              variant={showOnlyOutstanding ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyOutstanding(!showOnlyOutstanding)}
              className="h-7 px-2 text-xs"
              data-testid="button-toggle-outstanding"
            >
              {showOnlyOutstanding ? "Outstanding Only" : "All Parts"}
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDaysData.map((dayData) => (
              <DayPartsCell
                key={dayData.dayName}
                assignments={dayData.isCurrentMonth ? dayData.dayAssignments : []}
                clients={clients}
                dayName={dayData.dayName}
                date={dayData.date}
                showOnlyOutstanding={showOnlyOutstanding}
              />
            ))}
          </div>
        </div>
      </>
    );
  };

  return (
    <DndContext
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-background">
        <main className={`mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4 transition-all ${isUnscheduledMinimized ? 'pr-16' : ''}`}>
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
                onClick={() => setRouteOptimizationOpen(true)}
                disabled={assignments.length === 0}
                data-testid="button-optimize-route"
              >
                <Route className="h-4 w-4 mr-2" />
                Optimize Route
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
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

          <div className={`grid gap-4 ${isUnscheduledMinimized ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-4'}`} style={{ height: 'calc(100vh - 12rem)' }}>
            <div className={`${isUnscheduledMinimized ? 'col-span-1' : 'lg:col-span-3'} flex flex-col h-full`}>
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
                      <div className="grid grid-cols-7 auto-rows-[minmax(6rem,max-content)] content-start">
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

            {!isUnscheduledMinimized && (
              <div className="h-full overflow-hidden">
                <UnscheduledPanel 
                  clients={unscheduledClients} 
                  onClientClick={setReportDialogClientId}
                  isMinimized={isUnscheduledMinimized}
                  onToggleMinimize={() => setIsUnscheduledMinimized(!isUnscheduledMinimized)}
                />
              </div>
            )}
          </div>

          {isUnscheduledMinimized && (
            <UnscheduledPanel 
              clients={unscheduledClients} 
              onClientClick={setReportDialogClientId}
              isMinimized={isUnscheduledMinimized}
              onToggleMinimize={() => setIsUnscheduledMinimized(!isUnscheduledMinimized)}
            />
          )}
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

      <NewAddClientDialog 
        open={addClientDialogOpen}
        onOpenChange={setAddClientDialogOpen}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
          queryClient.invalidateQueries({ queryKey: ['/api/calendar'] });
          queryClient.invalidateQueries({ queryKey: ['/api/calendar/unscheduled'] });
        }}
      />

      <ClientReportDialog 
        clientId={reportDialogClientId}
        open={!!reportDialogClientId}
        onOpenChange={(open) => !open && setReportDialogClientId(null)}
      />

      <RouteOptimizationDialog
        open={routeOptimizationOpen}
        onOpenChange={setRouteOptimizationOpen}
        clients={assignments.map((a: any) => clients.find((c: any) => c.id === a.clientId)).filter((c: any): c is NonNullable<typeof c> => c !== null)}
        onApplyRoute={(optimizedClients) => {
          // Get all current assignments sorted by day
          const sortedAssignments = [...assignments].sort((a: any, b: any) => a.day - b.day);
          
          // Verify counts match
          if (optimizedClients.length !== sortedAssignments.length) {
            toast({
              title: "Route optimization error",
              description: `Client count mismatch: ${optimizedClients.length} optimized vs ${sortedAssignments.length} scheduled`,
              variant: "destructive"
            });
            return;
          }
          
          // Create a mapping of clientId to original assignment for quick lookup
          // Note: The backend prevents duplicate client assignments per month,
          // so this Map is safe (each clientId appears exactly once)
          const assignmentByClient = new Map(
            sortedAssignments.map((a: any) => [a.clientId, a])
          );
          
          // Verify no duplicate clients (defensive check)
          if (assignmentByClient.size !== sortedAssignments.length) {
            toast({
              title: "Route optimization error",
              description: "Found duplicate client assignments. Please contact support.",
              variant: "destructive"
            });
            return;
          }
          
          // Build update mutations: for each position in sorted order,
          // swap the assignment at that position to point to the optimized client
          const updatePromises = sortedAssignments.map((originalAssignment: any, index) => {
            const optimizedClient = optimizedClients[index];
            const assignmentForOptimizedClient = assignmentByClient.get(optimizedClient.id);
            
            if (!assignmentForOptimizedClient) {
              console.error(`No assignment found for optimized client ${optimizedClient.id}`);
              return Promise.resolve();
            }
            
            // If this assignment is already in the correct position, skip
            if (assignmentForOptimizedClient.day === originalAssignment.day) {
              return Promise.resolve();
            }
            
            // Update the assignment to the target day/date
            const newDay = originalAssignment.day;
            const newScheduledDate = new Date(year, month - 1, newDay).toISOString().split('T')[0];
            
            return apiRequest(`/api/calendar/assign/${assignmentForOptimizedClient.id}`, {
              method: "PATCH",
              body: JSON.stringify({ 
                day: newDay,
                scheduledDate: newScheduledDate
              })
            });
          });

          Promise.all(updatePromises)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ["/api/calendar", year, month] });
              toast({
                title: "Route optimized",
                description: "Calendar has been reordered to follow the optimal route"
              });
            })
            .catch((error) => {
              toast({
                title: "Failed to apply route",
                description: error.message || "Could not update calendar assignments",
                variant: "destructive"
              });
            });
        }}
      />

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Schedule for {monthNames[month - 1]} {year}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all scheduled assignments for {monthNames[month - 1]} and move them back to unscheduled. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-clear">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                clearSchedule.mutate(assignments);
                setShowClearConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-clear"
            >
              Clear Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}
