import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Briefcase, Calendar, MapPin, User, CheckCircle, Clock, AlertCircle } from "lucide-react";
import type { Client, CalendarAssignment } from "@shared/schema";

interface JobWithLocation extends CalendarAssignment {
  locationName?: string;
  locationCity?: string;
}

interface ClientJobsTabProps {
  clientId: string;
  companyId: string;
  parentCompanyId?: string;
  initialLocationId?: string;
  onCreateJob?: (locationId?: string) => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getStatusBadge(job: CalendarAssignment) {
  if (job.completed) {
    return (
      <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
        <CheckCircle className="h-3 w-3 mr-1" />
        Completed
      </Badge>
    );
  }
  
  const now = new Date();
  const jobDate = new Date(job.year, job.month - 1, job.day || 15);
  
  if (jobDate < now) {
    return (
      <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" />
        Overdue
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary">
      <Clock className="h-3 w-3 mr-1" />
      Scheduled
    </Badge>
  );
}

export default function ClientJobsTab({ 
  clientId, 
  companyId, 
  parentCompanyId, 
  initialLocationId,
  onCreateJob 
}: ClientJobsTabProps) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(initialLocationId || "all");

  useEffect(() => {
    if (initialLocationId) {
      setSelectedLocationId(initialLocationId);
    }
  }, [initialLocationId]);

  const { data: locations = [], isLoading: locationsLoading } = useQuery<Client[]>({
    queryKey: ["/api/customer-companies", parentCompanyId, "locations"],
    enabled: Boolean(parentCompanyId),
  });

  const locationParam = selectedLocationId !== "all" ? selectedLocationId : undefined;
  
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<JobWithLocation[]>({
    queryKey: ["/api/customer-companies", parentCompanyId, "jobs", { locationId: locationParam }],
    queryFn: async () => {
      const baseUrl = `/api/customer-companies/${parentCompanyId}/jobs`;
      const url = locationParam ? `${baseUrl}?locationId=${encodeURIComponent(locationParam)}` : baseUrl;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.statusText}`);
      return res.json();
    },
    enabled: Boolean(parentCompanyId),
  });

  const getLocationName = (locationClientId: string) => {
    const location = locations.find(l => l.id === locationClientId);
    return location?.location || location?.companyName || "Unknown Location";
  };

  const handleCreateJob = () => {
    if (onCreateJob) {
      onCreateJob(selectedLocationId !== "all" ? selectedLocationId : undefined);
    }
  };

  if (!parentCompanyId) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>This client is not linked to a parent company.</p>
            <p className="text-sm mt-2">Jobs are organized under parent companies.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (locationsLoading || jobsLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <Skeleton className="h-9 w-28" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Jobs
          </CardTitle>
          <CardDescription>
            Maintenance jobs and scheduled work for this client
          </CardDescription>
        </div>
        <Button onClick={handleCreateJob} data-testid="button-create-job">
          <Plus className="h-4 w-4 mr-2" />
          Create Job
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Location:</span>
          <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
            <SelectTrigger className="w-[200px]" data-testid="select-location-filter">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.location || location.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No jobs found{selectedLocationId !== "all" ? " for this location" : ""}.</p>
            <p className="text-sm mt-2">Create a job to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                  <TableCell className="font-medium">
                    #{job.jobNumber}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {job.day ? `${MONTH_NAMES[job.month - 1]} ${job.day}, ${job.year}` : `${MONTH_NAMES[job.month - 1]} ${job.year}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      <MapPin className="h-3 w-3 mr-1" />
                      {job.locationName || getLocationName(job.clientId)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {job.assignedTechnicianIds && job.assignedTechnicianIds.length > 0 ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="text-sm">{job.assignedTechnicianIds.length} assigned</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(job)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
