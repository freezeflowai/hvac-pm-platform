import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, ChevronDown, ChevronUp, ArrowUpDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JobDetailDialog } from "@/components/JobDetailDialog";

interface CalendarAssignment {
  id: string;
  clientId: string;
  year: number;
  month: number;
  day: number | null;
  scheduledDate: string;
  scheduledHour: number | null;
  completed: boolean;
  completionNotes: string | null;
  assignedTechnicianIds: string[] | null;
  jobNumber: number;
}

interface Client {
  id: string;
  companyName: string;
  location: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}

type JobStatusFilter = "late" | "upcoming" | "completed" | "unscheduled";
type SortField = "client" | "jobNumber" | "schedule" | "status";
type SortDirection = "asc" | "desc";

const ALL_STATUSES: JobStatusFilter[] = ["late", "upcoming", "completed", "unscheduled"];

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getJobStatus(assignment: CalendarAssignment): { label: string; variant: "default" | "destructive" | "secondary" | "outline"; priority: number } {
  if (assignment.completed) {
    return { label: "COMPLETED", variant: "secondary", priority: 3 };
  }
  
  if (assignment.day === null) {
    return { label: "Unscheduled", variant: "outline", priority: 2 };
  }
  
  const scheduledDate = parseLocalDate(assignment.scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (scheduledDate < today) {
    return { label: "Late", variant: "destructive", priority: 0 };
  }
  
  return { label: "Upcoming", variant: "default", priority: 1 };
}

function formatJobNumber(jobNumber: number): string {
  return `#${jobNumber}`;
}

function formatAddress(client: Client | undefined): string {
  if (!client) return "No address";
  const parts = [
    client.address,
    client.city,
    client.province,
    client.postalCode
  ].filter(Boolean);
  return parts.join(", ") || "No address";
}

interface ClientPart {
  id: string;
  partId: string;
  quantity: number;
  part?: {
    id: string;
    type: string;
    filterType?: string | null;
    beltType?: string | null;
    size?: string | null;
    name?: string | null;
  };
}

const ITEMS_PER_PAGE = 50;

export default function Jobs() {
  const { toast } = useToast();
  const [activeFilters, setActiveFilters] = useState<Set<JobStatusFilter>>(new Set(ALL_STATUSES));
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("schedule");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedJob, setSelectedJob] = useState<{ assignment: CalendarAssignment; client: Client | undefined } | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const loaderRef = useRef<HTMLDivElement>(null);

  const { data: calendarData, isLoading: isCalendarLoading } = useQuery<{ assignments: CalendarAssignment[]; clients: Client[]; total?: number }>({
    queryKey: ["/api/calendar/all"],
    queryFn: async () => {
      const res = await fetch('/api/calendar/all', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
  });

  const { data: bulkParts = {} } = useQuery<Record<string, ClientPart[]>>({
    queryKey: ["/api/client-parts/bulk"],
    staleTime: 60 * 1000,
  });

  const assignTechniciansMutation = useMutation({
    mutationFn: async ({ assignmentId, technicianIds }: { assignmentId: string; technicianIds: string[] }) => {
      return apiRequest("PATCH", `/api/calendar/assign/${assignmentId}`, {
        assignedTechnicianIds: technicianIds
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/all"] });
      toast({ title: "Updated", description: "Technicians assigned successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assign technicians", variant: "destructive" });
    },
  });

  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    if (calendarData?.clients) {
      calendarData.clients.forEach(client => map.set(client.id, client));
    }
    return map;
  }, [calendarData?.clients]);

  const filteredAndSortedJobs = useMemo(() => {
    if (!calendarData?.assignments) return [];

    let jobs = calendarData.assignments.map(assignment => {
      const client = clientMap.get(assignment.clientId);
      const status = getJobStatus(assignment);
      return {
        ...assignment,
        client,
        statusInfo: status,
      };
    });

    // Filter by active status filters
    if (activeFilters.size < ALL_STATUSES.length) {
      jobs = jobs.filter(job => {
        const status = job.statusInfo.label.toLowerCase() as JobStatusFilter;
        return activeFilters.has(status);
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      jobs = jobs.filter(job => {
        const clientName = job.client?.companyName?.toLowerCase() || "";
        const address = formatAddress(job.client).toLowerCase();
        const jobNumber = formatJobNumber(job.jobNumber).toLowerCase();
        const notes = job.completionNotes?.toLowerCase() || "";
        return clientName.includes(query) || address.includes(query) || jobNumber.includes(query) || notes.includes(query);
      });
    }

    jobs.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "client":
          comparison = (a.client?.companyName || "").localeCompare(b.client?.companyName || "");
          break;
        case "jobNumber":
          comparison = a.jobNumber - b.jobNumber;
          break;
        case "schedule":
          if (a.day === null && b.day === null) {
            comparison = 0;
          } else if (a.day === null) {
            comparison = 1;
          } else if (b.day === null) {
            comparison = -1;
          } else {
            const dateA = parseLocalDate(a.scheduledDate);
            const dateB = parseLocalDate(b.scheduledDate);
            comparison = dateA.getTime() - dateB.getTime();
          }
          break;
        case "status":
          comparison = a.statusInfo.priority - b.statusInfo.priority;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return jobs;
  }, [calendarData?.assignments, clientMap, activeFilters, searchQuery, sortField, sortDirection]);

  // Reset visible count when filters or sort changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [activeFilters, searchQuery, sortField, sortDirection]);

  // Visible jobs (paginated)
  const visibleJobs = useMemo(() => {
    return filteredAndSortedJobs.slice(0, visibleCount);
  }, [filteredAndSortedJobs, visibleCount]);

  const hasMore = visibleCount < filteredAndSortedJobs.length;

  // Intersection observer for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore) {
      setVisibleCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredAndSortedJobs.length));
    }
  }, [hasMore, filteredAndSortedJobs.length]);

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: "100px",
      threshold: 0.1,
    };
    const observer = new IntersectionObserver(handleObserver, option);
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleRowClick = (job: typeof filteredAndSortedJobs[0]) => {
    setSelectedJob({
      assignment: {
        id: job.id,
        clientId: job.clientId,
        year: job.year,
        month: job.month,
        day: job.day,
        scheduledDate: job.scheduledDate,
        scheduledHour: job.scheduledHour,
        completed: job.completed,
        completionNotes: job.completionNotes,
        assignedTechnicianIds: job.assignedTechnicianIds,
        jobNumber: job.jobNumber,
      },
      client: job.client,
    });
  };

  const SortableHeader = ({ field, children, testId }: { field: SortField; children: React.ReactNode; testId: string }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
      data-testid={testId}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  // Calculate status counts
  const statusCounts = useMemo(() => {
    if (!calendarData?.assignments) return { late: 0, upcoming: 0, completed: 0, unscheduled: 0 };
    
    const counts = { late: 0, upcoming: 0, completed: 0, unscheduled: 0 };
    calendarData.assignments.forEach(assignment => {
      const status = getJobStatus(assignment).label.toLowerCase();
      if (status in counts) {
        counts[status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [calendarData?.assignments]);

  const toggleFilter = (status: JobStatusFilter) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(status)) {
        newFilters.delete(status);
      } else {
        newFilters.add(status);
      }
      return newFilters;
    });
  };

  const toggleAll = () => {
    if (activeFilters.size === ALL_STATUSES.length) {
      setActiveFilters(new Set());
    } else {
      setActiveFilters(new Set(ALL_STATUSES));
    }
  };

  const allSelected = activeFilters.size === ALL_STATUSES.length;
  const totalCount = statusCounts.late + statusCounts.upcoming + statusCounts.completed + statusCounts.unscheduled;

  const statusFilterOptions: { value: JobStatusFilter; label: string; variant: "default" | "destructive" | "secondary" | "outline" }[] = [
    { value: "late", label: "Late", variant: "destructive" },
    { value: "upcoming", label: "Upcoming", variant: "default" },
    { value: "unscheduled", label: "Unscheduled", variant: "outline" },
    { value: "completed", label: "Completed", variant: "secondary" },
  ];

  if (isCalendarLoading) {
    return (
      <div className="p-6" data-testid="jobs-loading">
        <div className="text-center py-8">Loading jobs...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="jobs-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={allSelected ? "default" : "ghost"}
            size="sm"
            onClick={toggleAll}
            className={!allSelected ? "opacity-50" : ""}
            data-testid="button-filter-status-all"
          >
            All ({totalCount})
          </Button>
          {statusFilterOptions.map(option => {
            const isActive = activeFilters.has(option.value);
            const count = statusCounts[option.value];
            return (
              <Button
                key={option.value}
                variant={isActive ? option.variant : "ghost"}
                size="sm"
                onClick={() => toggleFilter(option.value)}
                className={!isActive ? "opacity-50" : ""}
                data-testid={`button-filter-status-${option.value}`}
              >
                {option.label} ({count})
              </Button>
            );
          })}
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-jobs"
          />
        </div>
      </div>

      <div className="border rounded-lg" data-testid="table-jobs">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="client" testId="header-client">Client</SortableHeader>
              <SortableHeader field="jobNumber" testId="header-jobnumber">Job number</SortableHeader>
              <TableHead data-testid="header-property">Property</TableHead>
              <SortableHeader field="schedule" testId="header-schedule">Schedule</SortableHeader>
              <SortableHeader field="status" testId="header-status">Status</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground" data-testid="text-no-jobs">
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              visibleJobs.map((job) => (
                <TableRow 
                  key={job.id} 
                  className="cursor-pointer hover-elevate"
                  onClick={() => handleRowClick(job)}
                  data-testid={`row-job-${job.id}`}
                >
                  <TableCell className="font-medium" data-testid={`text-client-${job.id}`}>
                    {job.client?.companyName || "Unknown Client"}
                  </TableCell>
                  <TableCell data-testid={`text-jobnumber-${job.id}`}>
                    <div className="font-mono text-sm">{formatJobNumber(job.jobNumber)}</div>
                    {job.completionNotes && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {job.completionNotes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground" data-testid={`text-property-${job.id}`}>
                    {formatAddress(job.client)}
                  </TableCell>
                  <TableCell data-testid={`text-schedule-${job.id}`}>
                    {job.day !== null ? format(parseLocalDate(job.scheduledDate), "MMMM d, yyyy") : "Not scheduled"}
                  </TableCell>
                  <TableCell data-testid={`badge-status-${job.id}`}>
                    <Badge variant={job.statusInfo.variant}>
                      {job.statusInfo.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div 
          ref={loaderRef} 
          className="flex justify-center py-4"
          data-testid="loader-more-jobs"
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="text-sm text-muted-foreground" data-testid="text-job-count">
        Showing {visibleJobs.length} of {filteredAndSortedJobs.length} job{filteredAndSortedJobs.length !== 1 ? 's' : ''}
      </div>

      <JobDetailDialog
        assignment={selectedJob?.assignment || null}
        client={selectedJob?.client}
        open={!!selectedJob}
        onOpenChange={(open) => {
          if (!open) setSelectedJob(null);
        }}
        bulkParts={bulkParts}
        onAssignTechnicians={(assignmentId: string, technicianIds: string[]) => {
          assignTechniciansMutation.mutate({ assignmentId, technicianIds });
        }}
      />
    </div>
  );
}
