import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

type JobStatus = "all" | "late" | "upcoming" | "completed" | "unscheduled";
type SortField = "client" | "jobNumber" | "schedule" | "status";
type SortDirection = "asc" | "desc";

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

function formatJobNumber(id: string): string {
  const shortId = id.slice(-6).toUpperCase();
  return `#${shortId}`;
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

export default function Jobs() {
  const [statusFilter, setStatusFilter] = useState<JobStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("schedule");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: calendarData, isLoading: isCalendarLoading } = useQuery<{ assignments: CalendarAssignment[]; clients: Client[] }>({
    queryKey: ["/api/calendar/all"],
    queryFn: async () => {
      const res = await fetch('/api/calendar/all', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
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

    if (statusFilter !== "all") {
      jobs = jobs.filter(job => {
        const status = job.statusInfo.label.toLowerCase();
        switch (statusFilter) {
          case "late":
            return status === "late";
          case "upcoming":
            return status === "upcoming";
          case "completed":
            return status === "completed";
          case "unscheduled":
            return status === "unscheduled";
          default:
            return true;
        }
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      jobs = jobs.filter(job => {
        const clientName = job.client?.companyName?.toLowerCase() || "";
        const address = formatAddress(job.client).toLowerCase();
        const jobNumber = formatJobNumber(job.id).toLowerCase();
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
          comparison = a.id.localeCompare(b.id);
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
  }, [calendarData?.assignments, clientMap, statusFilter, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
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

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "late", label: "Late" },
    { value: "upcoming", label: "Upcoming" },
    { value: "completed", label: "Completed" },
    { value: "unscheduled", label: "Unscheduled" },
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-filter-status">
                Status | {statusOptions.find(o => o.value === statusFilter)?.label}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {statusOptions.map(option => (
                <DropdownMenuItem 
                  key={option.value}
                  onClick={() => setStatusFilter(option.value as JobStatus)}
                  data-testid={`button-filter-status-${option.value}`}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
            {filteredAndSortedJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground" data-testid="text-no-jobs">
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedJobs.map((job) => (
                <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                  <TableCell className="font-medium" data-testid={`text-client-${job.id}`}>
                    {job.client?.companyName || "Unknown Client"}
                  </TableCell>
                  <TableCell data-testid={`text-jobnumber-${job.id}`}>
                    <div className="font-mono text-sm">{formatJobNumber(job.id)}</div>
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

      <div className="text-sm text-muted-foreground" data-testid="text-job-count">
        Showing {filteredAndSortedJobs.length} job{filteredAndSortedJobs.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
