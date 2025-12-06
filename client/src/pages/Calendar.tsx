import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, DragOverlay, closestCenter, DragEndEvent, DragStartEvent, useDroppable, pointerWithin, CollisionDetection, useDraggable, PointerSensor, useSensor, useSensors, rectIntersection } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import NewAddClientDialog from "@/components/NewAddClientDialog";
import ClientReportDialog from "@/components/ClientReportDialog";
import { JobDetailDialog } from "@/components/JobDetailDialog";
import { RouteOptimizationDialog } from "@/components/RouteOptimizationDialog";
import { PartsDialog } from "@/components/PartsDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, ChevronsRight, ChevronsLeft, Route, Users, Info, AlertTriangle, Trash2, Archive } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function UnscheduledPanel({ clients, onClientClick, isMinimized, onToggleMinimize, currentMonth, currentYear }: { 
  clients: any[]; 
  onClientClick?: (clientId: string) => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  currentMonth: number;
  currentYear: number;
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
          <SortableContext items={clients.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
            <div 
              ref={setNodeRef}
              className="space-y-2 h-full overflow-y-auto pr-2"
              style={{ scrollbarWidth: 'thin' }}
              data-testid="unscheduled-panel"
            >
              {clients.map((item: any) => {
                // Show month badge for ALL items with year suffix
                const now = new Date();
                const todayYear = now.getFullYear();
                const monthLabel = `${MONTH_ABBREV[item.month - 1]} '${String(item.year).slice(-2)}`;
                
                // Determine if this is a PAST month (overdue) vs future/current month
                const todayMonth = now.getMonth() + 1;
                const isPastMonth = item.year < todayYear || (item.year === todayYear && item.month < todayMonth);
                
                return (
                  <DraggableClient
                    key={item.id}
                    id={item.id}
                    client={{ companyName: item.companyName, location: item.location, id: item.clientId }}
                    onClick={() => onClientClick?.(item.clientId)}
                    monthLabel={monthLabel}
                    isOffMonth={true}
                    isPastMonth={isPastMonth}
                  />
                );
              })}
              {clients.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  All clients scheduled
                </div>
              )}
            </div>
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  );
}

function DraggableClient({ id, client, inCalendar, onClick, isCompleted, isOverdue, assignment, onAssignTechnician, monthLabel, isOffMonth, isPastMonth }: { id: string; client: any; inCalendar?: boolean; onClick?: () => void; isCompleted?: boolean; isOverdue?: boolean; assignment?: any; onAssignTechnician?: (assignmentId: string, technicianId: string | null) => void; monthLabel?: string | null; isOffMonth?: boolean; isPastMonth?: boolean }) {
  // Calendar items: use ONLY useDraggable for unrestricted movement
  // Unscheduled items: use ONLY useSortable for sorting in panel
  const draggableResult = inCalendar ? useDraggable({ 
    id,
    data: { type: 'assignment', assignmentId: id }
  }) : null;
  
  const sortableResult = !inCalendar ? useSortable({ id }) : null;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = (inCalendar ? draggableResult : sortableResult)!;
  
  // useSortable has transition, useDraggable doesn't
  const transition = sortableResult?.transition;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Color coding: red/orange = past month (overdue), muted = future month, blue = this month (scheduled), primary = completed
  const getBackgroundColor = () => {
    if (!inCalendar) {
      if (isPastMonth) return 'bg-status-overdue/10 border border-status-overdue/30';
      if (isOffMonth) return 'bg-muted/50 border border-muted-foreground/20';
      return 'bg-status-unscheduled/10 border border-status-unscheduled/30';
    }
    if (isCompleted) return 'bg-primary/10 border-primary/30';
    if (isOverdue) return 'bg-status-overdue/10 border-status-overdue/30';
    return 'bg-status-this-month/10 border-status-this-month/30';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`text-xs px-1.5 py-1 rounded hover:shadow-md transition-all relative select-none group ${getBackgroundColor()}`}
      data-testid={inCalendar ? `assigned-client-${id}` : `unscheduled-client-${client.id}`}
    >
      <div 
        {...listeners}
        className={inCalendar ? "cursor-grab active:cursor-grabbing" : ""}
      >
        <div className="flex items-center gap-1">
          <span className={`font-semibold leading-tight ${isCompleted ? 'line-through opacity-60' : ''}`}>{client.companyName}</span>
          {inCalendar && assignment?.jobNumber && (
            <span className="text-[9px] text-muted-foreground font-normal">#{assignment.jobNumber}</span>
          )}
          {!inCalendar && monthLabel && (
            <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${isPastMonth ? 'bg-status-overdue/20 text-status-overdue' : 'bg-muted text-muted-foreground'}`}>{monthLabel}</span>
          )}
        </div>
        {client.location && (
          <div className={`text-muted-foreground text-[10px] leading-tight ${isCompleted ? 'line-through opacity-60' : ''}`}>{client.location}</div>
        )}
      </div>
      {inCalendar && onClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="absolute bottom-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity h-4 w-4 flex items-center justify-center hover:bg-primary/20 rounded"
          data-testid={`button-open-client-${id}`}
        >
          <Info className="h-3 w-3" />
        </button>
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

  return (
    <div className="px-1.5 py-1 border bg-card">
      {sortedParts.length > 0 ? (
        <div className="space-y-0">
          {sortedParts.map(([partName, quantity]) => (
            <div key={partName} className="flex items-center justify-between gap-0.5 text-[10px] leading-tight py-0.5">
              <span className="flex-1 truncate" title={partName}>{partName}</span>
              <span className="font-semibold text-primary shrink-0 text-[11px]">×{quantity}</span>
            </div>
          ))}
        </div>
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
                assignment={assignment}
                onAssignTechnician={(assignmentId: string, technicianId: string | null) => {
                  queryClient.setQueryData(['/api/calendar', year, month], (old: any) => {
                    if (!old) return old;
                    return {
                      ...old,
                      assignments: old.assignments.map((a: any) =>
                        a.id === assignmentId ? { ...a, assignedTechnicianId: technicianId } : a
                      )
                    };
                  });
                  apiRequest('PATCH', `/api/calendar/assign/${assignmentId}`, { assignedTechnicianId: technicianId });
                }}
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
  const [clientDetailOpen, setClientDetailOpen] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const [expandedAllDaySlots, setExpandedAllDaySlots] = useState<Set<string>>(new Set());
  const [partsDialogOpen, setPartsDialogOpen] = useState(false);
  const [partsDialogTitle, setPartsDialogTitle] = useState("");
  const [partsDialogParts, setPartsDialogParts] = useState<Array<{ description: string; quantity: number }>>([]);
  const { toast } = useToast();
  const [location] = useLocation();
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const weeklyScrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollDoneRef = useRef(false);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Helper to get Monday of the week
  const getMondayOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const daysToMonday = day === 0 ? 6 : day - 1; // Sunday = 6 days back, Monday = 0 days back
    d.setDate(d.getDate() - daysToMonday);
    return d;
  };

  // Calculate which months to fetch based on view
  const getMonthsToFetch = () => {
    if (view === "weekly") {
      // Get the week range (Monday to Sunday)
      const weekStart = getMondayOfWeek(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      // Collect unique year-month combinations
      const months = new Set<string>();
      const current = new Date(weekStart);
      while (current <= weekEnd) {
        months.add(`${current.getFullYear()}-${current.getMonth() + 1}`);
        current.setDate(current.getDate() + 1);
      }
      return Array.from(months).map(m => {
        const [y, mo] = m.split('-').map(Number);
        return { year: y, month: mo };
      });
    }
    return [{ year, month }];
  };

  const { data, isLoading: isLoadingCalendar, refetch: refetchCalendar } = useQuery({
    queryKey: ["/api/calendar", view, year, month, currentDate.getTime()],
    queryFn: async () => {
      const monthsToFetch = getMonthsToFetch();
      
      // Fetch all needed months in parallel
      const results = await Promise.all(
        monthsToFetch.map(async ({ year: y, month: m }) => {
          const res = await fetch(`/api/calendar?year=${y}&month=${m}`);
          if (!res.ok) throw new Error("Failed to fetch calendar data");
          return res.json();
        })
      );
      
      // Merge results
      if (results.length === 1) {
        return results[0];
      }
      
      // Combine assignments and clients from all months
      const allAssignments = results.flatMap(r => r.assignments || []);
      const allClients = results.flatMap(r => r.clients || []);
      
      // Deduplicate clients by ID
      const uniqueClients = Array.from(
        new Map(allClients.map(c => [c.id, c])).values()
      );
      
      return {
        assignments: allAssignments,
        clients: uniqueClients
      };
    }
  });

  const { data: bulkParts = {}, isLoading: isLoadingParts } = useQuery<Record<string, any[]>>({
    queryKey: ['/api/client-parts/bulk'],
    staleTime: 60 * 1000,
  });

  // Helper to calculate parts from assignments
  const calculateParts = (assignments: any[]) => {
    const partsList: Array<{ description: string; quantity: number }> = [];
    
    assignments.forEach((assignment: any) => {
      const clientPartsList = bulkParts[assignment.clientId] || [];
      clientPartsList.forEach((cp: any) => {
        const part = cp.part;
        let partLabel = '';
        
        if (part?.type === 'filter') {
          partLabel = `${part.filterType || 'Filter'} ${part.size || ''}`.trim();
        } else if (part?.type === 'belt') {
          partLabel = `Belt ${part.beltType || ''} ${part.size || ''}`.trim();
        } else {
          partLabel = part?.name || 'Other Part';
        }
        
        partsList.push({ 
          description: partLabel,
          quantity: cp.quantity || 1
        });
      });
    });
    
    return partsList;
  };

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ['/api/technicians'],
  });

  const { data: companySettings } = useQuery<any>({
    queryKey: ['/api/company-settings'],
  });

  const updateCompanySettings = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest("POST", "/api/company-settings", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      toast({
        title: "Settings updated",
        description: "Calendar start time has been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const createAssignment = useMutation({
    mutationFn: async ({ clientId, day, scheduledHour }: { clientId: string; day: number; scheduledHour?: number }) => {
      return apiRequest("POST", `/api/calendar/assign`, {
        clientId,
        year,
        month,
        day,
        scheduledDate: new Date(year, month - 1, day).toISOString().split('T')[0],
        scheduledHour: scheduledHour !== undefined ? scheduledHour : undefined,
        autoDueDate: false,
      });
    },
    onSuccess: async () => {
      await refetchCalendar();
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled"] });
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
    mutationFn: async ({ id, day, scheduledHour, targetYear, targetMonth }: { id: string; day: number; scheduledHour?: number | null; targetYear?: number; targetMonth?: number }) => {
      const updateYear = targetYear ?? year;
      const updateMonth = targetMonth ?? month;
      return apiRequest("PATCH", `/api/calendar/assign/${id}`, {
        year: updateYear,
        month: updateMonth,
        day,
        scheduledDate: new Date(updateYear, updateMonth - 1, day).toISOString().split('T')[0],
        scheduledHour: scheduledHour !== undefined ? scheduledHour : undefined,
      });
    },
    onSuccess: async () => {
      await refetchCalendar();
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/overdue"] });
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
    onSuccess: async () => {
      await refetchCalendar();
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled"] });
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

  const assignTechnicians = useMutation({
    mutationFn: async ({ assignmentId, technicianIds }: { assignmentId: string; technicianIds: string[] }) => {
      return apiRequest('PATCH', `/api/calendar/assign/${assignmentId}`, { assignedTechnicianIds: technicianIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar", year, month] });
      toast({
        title: "Updated",
        description: "Technician assignments updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign technicians",
        variant: "destructive",
      });
    },
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const previousMonth = () => {
    if (view === "weekly") {
      // Navigate to previous week
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
      scrollDoneRef.current = false; // Reset scroll to trigger re-scroll to start hour
    } else {
      // Navigate to previous month
      setCurrentDate(new Date(year, month - 2, 1));
    }
  };

  const nextMonth = () => {
    if (view === "weekly") {
      // Navigate to next week
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
      scrollDoneRef.current = false; // Reset scroll to trigger re-scroll to start hour
    } else {
      // Navigate to next month
      setCurrentDate(new Date(year, month, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    scrollDoneRef.current = false; // Reset scroll to trigger re-scroll to start hour
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

    // If dropping on the same container it started in (or no drop zone specified), it's just a click
    if (active.data?.current?.sortable?.index === over?.data?.current?.sortable?.index && !overId.startsWith('day-') && !overId.startsWith('allday-') && !overId.startsWith('weekly-') && overId !== 'unscheduled-panel') {
      return;
    }

    // Check if this is an existing assignment in current month's calendar
    const isExistingCalendarAssignment = assignments.some((a: any) => a.id === activeId);
    
    // Check if this is an unscheduled item from the backlog
    const unscheduledItem = unscheduledClients.find((item: any) => item.id === activeId);
    const hasExistingAssignment = unscheduledItem?.status === 'existing';

    // Check if dropping on a monthly view day
    if (overId.startsWith('day-')) {
      const day = parseInt(overId.replace('day-', ''));
      
      if (isExistingCalendarAssignment) {
        // Only move if the assignment exists and day changed
        const currentAssignment = assignments.find((a: any) => a.id === activeId);
        if (currentAssignment && currentAssignment.day !== day) {
          updateAssignment.mutate({ id: activeId, day });
        }
      } else if (unscheduledItem && hasExistingAssignment) {
        // Update existing unscheduled assignment (may be from different month) to current view's month/day
        updateAssignment.mutate({ id: unscheduledItem.assignmentId, day, targetMonth: month, targetYear: year });
      } else if (unscheduledItem) {
        // Create new assignment from unscheduled client (no existing assignment - "missing" status)
        createAssignment.mutate({ clientId: unscheduledItem.clientId, day });
      }
    } else if (overId.startsWith('allday-')) {
      // Dropped on all-day slot in weekly view (allday-{dayName}-{dayNumber})
      const parts = overId.replace('allday-', '').split('-');
      const targetDay = parseInt(parts[1]);
      
      if (isExistingCalendarAssignment) {
        const currentAssignment = assignments.find((a: any) => a.id === activeId);
        // Update if day changed OR if moving from a time slot to all-day (scheduledHour becomes null)
        if (currentAssignment && (currentAssignment.day !== targetDay || currentAssignment.scheduledHour !== null)) {
          updateAssignment.mutate({ id: activeId, day: targetDay, scheduledHour: null });
        }
      } else if (unscheduledItem && hasExistingAssignment) {
        // Update existing unscheduled assignment to current view's month/day
        updateAssignment.mutate({ id: unscheduledItem.assignmentId, day: targetDay, scheduledHour: null, targetMonth: month, targetYear: year });
      } else if (unscheduledItem) {
        // Create new assignment from unscheduled client
        createAssignment.mutate({ clientId: unscheduledItem.clientId, day: targetDay });
      }
    } else if (overId.startsWith('weekly-')) {
      // Dropped on hourly slot in weekly view (weekly-{dayName}-{hour}-{dayNumber})
      const parts = overId.replace('weekly-', '').split('-');
      const hour = parseInt(parts[1]);
      const targetDay = parseInt(parts[2]);
      
      if (isExistingCalendarAssignment) {
        const currentAssignment = assignments.find((a: any) => a.id === activeId);
        if (currentAssignment && (currentAssignment.day !== targetDay || currentAssignment.scheduledHour !== hour)) {
          updateAssignment.mutate({ id: activeId, day: targetDay, scheduledHour: hour });
        }
      } else if (unscheduledItem && hasExistingAssignment) {
        // Update existing unscheduled assignment to current view's month/day/hour
        updateAssignment.mutate({ id: unscheduledItem.assignmentId, day: targetDay, scheduledHour: hour, targetMonth: month, targetYear: year });
      } else if (unscheduledItem) {
        // Create new assignment from unscheduled client
        createAssignment.mutate({ clientId: unscheduledItem.clientId, day: targetDay, scheduledHour: hour });
      }
    } else if (overId === 'unscheduled-panel') {
      // Dropped on unscheduled panel - remove from calendar
      if (isExistingCalendarAssignment) {
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
    console.log('handleClientClick called with:', { client, assignment });
    setSelectedClient(client);
    setSelectedAssignment(assignment);
    setClientDetailOpen(true);
    console.log('Dialog state set to true');
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
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/overdue"] });
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

  const { data: allClients = [], isLoading: isLoadingClients } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const { data: unscheduledClients = [], isLoading: isLoadingUnscheduled } = useQuery<any[]>({
    queryKey: ["/api/calendar/unscheduled"],
    queryFn: async () => {
      const res = await fetch(`/api/calendar/unscheduled`);
      if (!res.ok) throw new Error("Failed to fetch unscheduled clients");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Query for old unscheduled items that need user action (older than previous month)
  const { data: oldUnscheduledItems = [] } = useQuery<any[]>({
    queryKey: ["/api/calendar/old-unscheduled"],
    queryFn: async () => {
      const res = await fetch(`/api/calendar/old-unscheduled`);
      if (!res.ok) throw new Error("Failed to fetch old unscheduled items");
      return res.json();
    },
  });

  const [showOldItemsDialog, setShowOldItemsDialog] = useState(false);

  // Delete old unscheduled assignment
  const deleteOldAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      return apiRequest("DELETE", `/api/calendar/assign/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/old-unscheduled"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled"] });
      toast({
        title: "Assignment deleted",
        description: "The old assignment has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete assignment",
        variant: "destructive",
      });
    },
  });

  // Mark old assignment as completed (archive it)
  const archiveOldAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      return apiRequest("PATCH", `/api/calendar/assign/${assignmentId}`, {
        completed: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/old-unscheduled"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/unscheduled"] });
      toast({
        title: "Assignment archived",
        description: "The old assignment has been marked as complete",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive assignment",
        variant: "destructive",
      });
    },
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

  // Reset scroll flag when switching away from weekly view
  useEffect(() => {
    if (view !== "weekly") {
      scrollDoneRef.current = false;
    }
  }, [view]);

  // Scroll to start hour when entering weekly view - wait for ALL data to load
  useEffect(() => {
    if (view === "weekly" && 
        weeklyScrollContainerRef.current && 
        companySettings?.calendarStartHour !== undefined && 
        !scrollDoneRef.current &&
        !isLoadingCalendar &&
        !isLoadingUnscheduled) {
      
      const startHour = companySettings.calendarStartHour;
      // Each hourly slot is 64px (min-h-16)
      const slotHeight = 64;
      const scrollPosition = startHour * slotHeight;
      
      // Use setTimeout to ensure DOM is fully rendered after all data loads
      const timeoutId = setTimeout(() => {
        if (weeklyScrollContainerRef.current) {
          weeklyScrollContainerRef.current.scrollTop = scrollPosition;
          scrollDoneRef.current = true;
        }
      }, 150);
      
      return () => clearTimeout(timeoutId);
    }
  }, [view, companySettings?.calendarStartHour, isLoadingCalendar, isLoadingUnscheduled]);

  const { assignments = [], clients = [] } = data || {};

  // Configure sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before activating drag
      },
    })
  );

  // Custom collision detection that only checks drop zones (days, all-day, weekly), not individual items
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // Filter to only check day drop zones, all-day slots, weekly slots, and the unscheduled panel
    const dropZoneContainers = args.droppableContainers.filter(
      (container) => {
        const id = container.id as string;
        return id.startsWith('day-') || id.startsWith('allday-') || id.startsWith('weekly-') || id === 'unscheduled-panel';
      }
    );

    // Use rectIntersection for better grid layout support
    const rectCollisions = rectIntersection({
      ...args,
      droppableContainers: dropZoneContainers,
    });
    
    if (rectCollisions.length > 0) {
      return rectCollisions;
    }

    // Fallback to pointerWithin
    const pointerCollisions = pointerWithin({
      ...args,
      droppableContainers: dropZoneContainers,
    });
    
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    // Final fallback to closestCenter
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

  // Drop zone component for all-day slots in weekly view
  const AllDayDropZone = ({ dayName, dayNumber, children }: { dayName: string; dayNumber: number; children: React.ReactNode }) => {
    const { setNodeRef, isOver } = useDroppable({ id: `allday-${dayName}-${dayNumber}` });
    return (
      <div ref={setNodeRef} className={`p-1 border-r min-h-16 ${isOver ? 'bg-primary/20 border-2 border-primary' : 'bg-background'}`}>
        {children}
      </div>
    );
  };

  // Drop zone component for hourly slots in weekly view
  const HourlyDropZone = ({ dayName, hour, dayNumber, dayAssignments = [] }: { dayName: string; hour: number; dayNumber: number; dayAssignments?: any[] }) => {
    const { setNodeRef, isOver } = useDroppable({ id: `weekly-${dayName}-${hour}-${dayNumber}` });
    
    // Filter assignments for this specific hour (explicitly check for number to handle hour 0)
    const hourlyAssignments = (dayAssignments || []).filter((a: any) => a.scheduledHour !== null && a.scheduledHour !== undefined && a.scheduledHour === hour);
    
    return (
      <div ref={setNodeRef} className={`p-1 border-r min-h-16 ${isOver ? 'bg-primary/20 border-2 border-primary' : 'bg-background'}`}>
        {hourlyAssignments.map((assignment: any) => {
          const client = clients.find((c: any) => c.id === assignment.clientId);
          return client ? (
            <DraggableClient
              key={assignment.id}
              id={assignment.id}
              client={client}
              inCalendar
              onClick={() => handleClientClick(client, assignment)}
              isCompleted={assignment.completed}
              isOverdue={!assignment.completed && new Date(assignment.scheduledDate) < new Date()}
              assignment={assignment}
            />
          ) : null;
        })}
      </div>
    );
  };

  const renderWeeklyView = () => {
    // Get week dates based on currentDate (Monday to Sunday)
    const currentWeekStart = getMondayOfWeek(currentDate);

    const startHour = companySettings?.calendarStartHour || 8;
    const weekDaysData: Array<{date: Date; dayNumber: number; monthNumber: number; yearNumber: number; dayAssignments: any[]; dayName: string}> = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      const dayNumber = date.getDate();
      const monthNumber = date.getMonth() + 1;
      const yearNumber = date.getFullYear();
      
      // Get assignments for this specific day from the fetched data
      let dayAssignments = assignments.filter((a: any) => 
        a.year === yearNumber && 
        a.month === monthNumber && 
        a.day === dayNumber
      );
      
      // Filter by selected technician
      if (selectedTechnicianId === "unassigned") {
        dayAssignments = dayAssignments.filter((a: any) => !a.assignedTechnicianIds || a.assignedTechnicianIds.length === 0);
      } else if (selectedTechnicianId && selectedTechnicianId !== "all") {
        dayAssignments = dayAssignments.filter((a: any) => 
          a.assignedTechnicianIds && a.assignedTechnicianIds.includes(selectedTechnicianId)
        );
      }

      weekDaysData.push({
        date,
        dayNumber,
        monthNumber,
        yearNumber,
        dayAssignments,
        dayName: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]
      });
    }

    const hours = Array.from({ length: 24 }, (_, i) => {
      const h = i;
      const ampm = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
      return { hour: i, display: ampm };
    });

    return (
      <div className="flex flex-col h-full min-h-0 max-h-full">
        <div className="grid grid-cols-8 sticky top-0 bg-background z-10 border-b flex-shrink-0">
          <div className="p-2 text-xs font-semibold border-r">Time</div>
          {weekDaysData.map((d) => {
            // Calculate total parts for this day
            const dayParts = d.dayAssignments.reduce((total: number, assignment: any) => {
              const clientPartsList = bulkParts[assignment.clientId] || [];
              const partCount = clientPartsList.reduce((sum: number, cp: any) => sum + (cp.quantity || 0), 0);
              return total + partCount;
            }, 0);

            return (
              <div key={d.dayName} className="p-2 text-center border-r text-xs font-semibold space-y-1">
                <div>{d.dayName}</div>
                <div className="text-muted-foreground">{d.date.getDate()}</div>
                {dayParts > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] w-full"
                    onClick={() => {
                      if (isLoadingParts) {
                        toast({
                          title: "Loading parts data",
                          description: "Please wait while parts are being loaded",
                        });
                        return;
                      }
                      const parts = calculateParts(d.dayAssignments);
                      setPartsDialogTitle(`Parts for ${d.dayName}, ${d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
                      setPartsDialogParts(parts);
                      setPartsDialogOpen(true);
                    }}
                    data-testid={`button-parts-${d.dayName}`}
                  >
                    {dayParts} parts
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* All Day Slot - Pinned outside scrollable area */}
        <div className="grid grid-cols-8 border-b bg-primary/5 flex-shrink-0">
          <div className="p-2 text-xs font-semibold border-r sticky left-0 z-20 bg-primary/10">
            All Day
          </div>
          {weekDaysData.map((dayData) => {
            // Only show assignments without a scheduled hour (all-day events)
            const allDayAssignments = dayData.dayAssignments.filter((a: any) => a.scheduledHour === null || a.scheduledHour === undefined);
            const slotKey = `${dayData.dayName}-${dayData.dayNumber}`;
            const isExpanded = expandedAllDaySlots.has(slotKey);
            const visibleAssignments = isExpanded ? allDayAssignments : allDayAssignments.slice(0, 3);
            const hiddenCount = Math.max(0, allDayAssignments.length - 3);
            
            return (
              <AllDayDropZone key={`${dayData.dayName}-allday`} dayName={dayData.dayName} dayNumber={dayData.dayNumber}>
                <div className="p-1">
                  {visibleAssignments.map((assignment: any) => {
                    const client = clients.find((c: any) => c.id === assignment.clientId);
                    const isCompleted = assignment.completed;
                    return client ? (
                      <DraggableClient
                        key={assignment.id}
                        id={assignment.id}
                        client={client}
                        inCalendar
                        onClick={() => handleClientClick(client, assignment)}
                        isCompleted={isCompleted}
                        isOverdue={!isCompleted && new Date(assignment.scheduledDate) < new Date()}
                        assignment={assignment}
                      />
                    ) : null;
                  })}
                  {hiddenCount > 0 && !isExpanded && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1 text-[10px] w-full"
                      onClick={() => {
                        setExpandedAllDaySlots(prev => new Set(prev).add(slotKey));
                      }}
                      data-testid={`button-view-all-${dayData.dayName}`}
                    >
                      +{hiddenCount} more
                    </Button>
                  )}
                  {isExpanded && allDayAssignments.length > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1 text-[10px] w-full"
                      onClick={() => {
                        setExpandedAllDaySlots(prev => {
                          const next = new Set(prev);
                          next.delete(slotKey);
                          return next;
                        });
                      }}
                      data-testid={`button-collapse-${dayData.dayName}`}
                    >
                      Show less
                    </Button>
                  )}
                </div>
              </AllDayDropZone>
            );
          })}
        </div>

        {/* Scrollable Hourly Slots */}
        <div ref={weeklyScrollContainerRef} className="overflow-y-scroll flex-1 min-h-0 max-h-full" style={{ scrollbarWidth: 'auto', overflowX: 'hidden' }}>
          {hours.map((h) => (
            <div key={h.hour} className="grid grid-cols-8 border-b">
              <div className={`p-2 text-xs font-medium border-r sticky left-0 z-20 ${h.hour === startHour ? 'bg-primary/30 font-bold' : 'bg-muted/20'}`}>
                {h.display}
              </div>
              {weekDaysData.map((dayData) => (
                <HourlyDropZone key={`${dayData.dayName}-${h.hour}`} dayName={dayData.dayName} hour={h.hour} dayNumber={dayData.dayNumber} dayAssignments={dayData.dayAssignments} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      autoScroll={{ threshold: { x: 0.2, y: 0.2 } }}
    >
      <div className="h-screen bg-background flex flex-col">
        {/* Alert banner for old unscheduled items */}
        {oldUnscheduledItems.length > 0 && (
          <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {oldUnscheduledItems.length} old unscheduled job{oldUnscheduledItems.length !== 1 ? 's' : ''} need{oldUnscheduledItems.length === 1 ? 's' : ''} attention
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-white dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/70"
              onClick={() => setShowOldItemsDialog(true)}
              data-testid="button-view-old-items"
            >
              Review
            </Button>
            <button
              className="ml-2 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
              onClick={() => setShowOldItemsDialog(true)}
              data-testid="button-dismiss-old-items-banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Dialog for managing old unscheduled items */}
        <Dialog open={showOldItemsDialog} onOpenChange={setShowOldItemsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Old Unscheduled Jobs
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              These jobs are from months older than last month and need your attention. You can either archive them (mark as complete) or delete them.
            </p>
            <div className="overflow-y-auto flex-1 space-y-2">
              {oldUnscheduledItems.map((item: any) => (
                <div key={item.assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{item.client?.companyName || 'Unknown Client'}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.client?.location && <span>{item.client.location} • </span>}
                      {MONTH_ABBREV[item.assignment.month - 1]} '{String(item.assignment.year).slice(-2)}
                      {item.assignment.jobNumber && <span> • Job #{item.assignment.jobNumber}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => archiveOldAssignment.mutate(item.assignment.id)}
                      disabled={archiveOldAssignment.isPending || deleteOldAssignment.isPending}
                      data-testid={`button-archive-${item.assignment.id}`}
                    >
                      <Archive className="h-4 w-4 mr-1" />
                      Archive
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteOldAssignment.mutate(item.assignment.id)}
                      disabled={archiveOldAssignment.isPending || deleteOldAssignment.isPending}
                      data-testid={`button-delete-${item.assignment.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {oldUnscheduledItems.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  All old items have been handled
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <main className={`flex flex-col flex-1 min-h-0 mx-auto px-4 sm:px-6 lg:px-8 py-4 transition-all ${isUnscheduledMinimized ? 'pr-16' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={previousMonth}
                data-testid={view === "weekly" ? "button-previous-week" : "button-previous-month"}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-2xl font-bold">
                {view === "weekly" ? (
                  (() => {
                    const weekStart = getMondayOfWeek(currentDate);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    
                    const startMonth = monthNames[weekStart.getMonth()];
                    const endMonth = monthNames[weekEnd.getMonth()];
                    const startDay = weekStart.getDate();
                    const endDay = weekEnd.getDate();
                    const startYear = weekStart.getFullYear();
                    const endYear = weekEnd.getFullYear();
                    
                    if (startYear !== endYear) {
                      return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
                    } else if (startMonth !== endMonth) {
                      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${endYear}`;
                    } else {
                      return `${startMonth} ${startDay}-${endDay}, ${endYear}`;
                    }
                  })()
                ) : (
                  `${monthNames[month - 1]} ${year}`
                )}
              </h2>
              <Button
                variant="outline"
                size="icon"
                onClick={nextMonth}
                data-testid={view === "weekly" ? "button-next-week" : "button-next-month"}
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
              {view === "weekly" && (
                <>
                  <Select value={selectedTechnicianId || "all"} onValueChange={setSelectedTechnicianId}>
                    <SelectTrigger className="w-40 text-xs" data-testid="select-technician-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Technicians</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {technicians.map((tech: any) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.firstName} {tech.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Start:</span>
                    <Select 
                      value={String(companySettings?.calendarStartHour || 8)} 
                      onValueChange={(value) => {
                        const newStartHour = parseInt(value, 10);
                        updateCompanySettings.mutate({ calendarStartHour: newStartHour });
                        scrollDoneRef.current = false; // Reset scroll flag to trigger re-scroll
                      }}
                    >
                      <SelectTrigger className="w-20 text-xs h-8" data-testid="select-start-hour">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                          <SelectItem key={hour} value={String(hour)}>
                            {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isLoadingParts) {
                        toast({
                          title: "Loading parts data",
                          description: "Please wait while parts are being loaded",
                        });
                        return;
                      }
                      // Calculate all parts for the week
                      const weekStart = getMondayOfWeek(currentDate);
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekEnd.getDate() + 6);
                      
                      const allAssignments = assignments || [];
                      const parts = calculateParts(allAssignments);
                      
                      setPartsDialogTitle(`Parts for Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
                      setPartsDialogParts(parts);
                      setPartsDialogOpen(true);
                    }}
                    data-testid="button-weekly-parts"
                  >
                    Week Parts
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRouteOptimizationOpen(true)}
                disabled={assignments.filter((a: any) => !a.completed).length === 0}
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

          <div className={`grid gap-4 flex-1 min-h-0 overflow-hidden ${isUnscheduledMinimized ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-4'}`}>
            <div className={`${isUnscheduledMinimized ? 'col-span-1' : 'lg:col-span-3'} flex flex-col h-full min-h-0 max-h-full`}>
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
                    <div className="h-full flex flex-col min-h-0 max-h-full">
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
                  currentMonth={month}
                  currentYear={year}
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
              currentMonth={month}
              currentYear={year}
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

        <JobDetailDialog 
          open={clientDetailOpen}
          onOpenChange={(open) => {
            setClientDetailOpen(open);
            if (!open) {
              setSelectedClient(null);
              setSelectedAssignment(null);
            }
          }}
          client={selectedClient}
          assignment={selectedAssignment}
          onAssignTechnicians={(assignmentId: string, technicianIds: string[]) => {
            assignTechnicians.mutate({ assignmentId, technicianIds });
          }}
          bulkParts={bulkParts}
        />
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
        clients={assignments
          .filter((a: any) => !a.completed)
          .map((a: any) => clients.find((c: any) => c.id === a.clientId))
          .filter((c: any): c is NonNullable<typeof c> => c !== null)}
        onApplyRoute={(optimizedClients) => {
          // Get all current assignments sorted by day (only non-completed)
          const sortedAssignments = [...assignments]
            .filter((a: any) => !a.completed)
            .sort((a: any, b: any) => a.day - b.day);
          
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
            
            return apiRequest("PATCH", `/api/calendar/assign/${assignmentForOptimizedClient.id}`, { 
              day: newDay,
              scheduledDate: newScheduledDate
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

      <PartsDialog
        open={partsDialogOpen}
        onOpenChange={setPartsDialogOpen}
        title={partsDialogTitle}
        parts={partsDialogParts}
      />
    </DndContext>
  );
}
