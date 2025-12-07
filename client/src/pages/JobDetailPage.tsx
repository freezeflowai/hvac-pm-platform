import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Pencil, 
  Trash2, 
  Loader2, 
  MapPin, 
  User, 
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  FileText,
  Building2,
  Phone,
  Mail,
  DollarSign,
  Repeat
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Job, Client, CustomerCompany, User as UserType, RecurringJobSeries } from "@shared/schema";

interface JobDetailResponse extends Job {
  location?: Client;
  parentCompany?: CustomerCompany;
  technicians?: UserType[];
  recurringSeries?: RecurringJobSeries;
}

function getJobStatusDisplay(status: string, scheduledStart: Date | null): { 
  label: string; 
  variant: "default" | "destructive" | "secondary" | "outline"; 
  icon: any;
  isOverdue?: boolean;
} {
  const now = new Date();
  
  if (status === "completed") {
    return { label: "Completed", variant: "secondary", icon: CheckCircle };
  }
  if (status === "cancelled") {
    return { label: "Cancelled", variant: "outline", icon: XCircle };
  }
  if (status === "on_hold") {
    return { label: "On Hold", variant: "outline", icon: Pause };
  }
  if (status === "in_progress") {
    return { label: "In Progress", variant: "default", icon: Play };
  }
  if (status === "draft") {
    return { label: "Draft", variant: "outline", icon: FileText };
  }
  
  if (status === "scheduled" && scheduledStart) {
    const scheduled = new Date(scheduledStart);
    if (scheduled < now) {
      return { label: "Overdue", variant: "destructive", icon: AlertTriangle, isOverdue: true };
    }
    return { label: "Scheduled", variant: "default", icon: Calendar };
  }
  
  return { label: status, variant: "outline", icon: FileText };
}

function getPriorityDisplay(priority: string): { label: string; variant: "default" | "destructive" | "secondary" | "outline" } {
  switch (priority) {
    case "urgent":
      return { label: "Urgent", variant: "destructive" };
    case "high":
      return { label: "High", variant: "default" };
    case "medium":
      return { label: "Medium", variant: "secondary" };
    case "low":
      return { label: "Low", variant: "outline" };
    default:
      return { label: priority, variant: "outline" };
  }
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["completed", "on_hold", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function JobDetailPage() {
  const [, params] = useRoute("/jobs/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const jobId = params?.id;

  const { data: job, isLoading, error } = useQuery<JobDetailResponse>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PATCH", `/api/jobs/${jobId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Status Updated",
        description: "Job status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/jobs/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Job Deleted",
        description: "Job has been deleted.",
      });
      setLocation("/jobs");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete job",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (newStatus: string) => {
    updateStatusMutation.mutate(newStatus);
  };

  const handleDelete = () => {
    deleteJobMutation.mutate();
    setShowDeleteConfirm(false);
  };

  if (isLoading) {
    return (
      <div className="p-6" data-testid="job-detail-loading">
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          Loading job details...
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-6" data-testid="job-detail-error">
        <div className="text-center py-8">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-destructive">Job not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setLocation("/jobs")}
            data-testid="button-back-to-jobs"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = getJobStatusDisplay(job.status, job.scheduledStart);
  const StatusIcon = statusInfo.icon;
  const priorityInfo = getPriorityDisplay(job.priority);
  const availableTransitions = STATUS_TRANSITIONS[job.status] || [];

  return (
    <div className="p-6 space-y-6" data-testid="job-detail-page">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation("/jobs")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" data-testid="text-job-number">
                Job #{job.jobNumber}
              </h1>
              <Badge variant={statusInfo.variant} className="gap-1" data-testid="badge-status">
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </Badge>
              <Badge variant={priorityInfo.variant} data-testid="badge-priority">
                {priorityInfo.label}
              </Badge>
            </div>
            <p className="text-muted-foreground capitalize" data-testid="text-job-type">
              {job.jobType} job
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {availableTransitions.length > 0 && (
            <Select
              value={job.status}
              onValueChange={handleStatusChange}
              disabled={updateStatusMutation.isPending}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-status">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={job.status} disabled>
                  {STATUS_OPTIONS.find(s => s.value === job.status)?.label}
                </SelectItem>
                {availableTransitions.map(status => (
                  <SelectItem key={status} value={status} data-testid={`option-status-${status}`}>
                    {STATUS_OPTIONS.find(s => s.value === status)?.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="destructive"
            size="icon"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteJobMutation.isPending}
            data-testid="button-delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card data-testid="card-job-details">
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">Summary</h3>
                <p data-testid="text-summary">{job.summary}</p>
              </div>
              
              {job.description && (
                <div>
                  <h3 className="font-medium mb-1">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-description">
                    {job.description}
                  </p>
                </div>
              )}

              {job.accessInstructions && (
                <div>
                  <h3 className="font-medium mb-1">Access Instructions</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-access">
                    {job.accessInstructions}
                  </p>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Scheduled Start
                  </h3>
                  <p className="text-muted-foreground" data-testid="text-scheduled-start">
                    {job.scheduledStart 
                      ? format(new Date(job.scheduledStart), "PPP p")
                      : "Not scheduled"}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium mb-1 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Scheduled End
                  </h3>
                  <p className="text-muted-foreground" data-testid="text-scheduled-end">
                    {job.scheduledEnd 
                      ? format(new Date(job.scheduledEnd), "PPP p")
                      : "Not set"}
                  </p>
                </div>
              </div>

              {(job.actualStart || job.actualEnd) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-1">Actual Start</h3>
                    <p className="text-muted-foreground" data-testid="text-actual-start">
                      {job.actualStart 
                        ? format(new Date(job.actualStart), "PPP p")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Actual End</h3>
                    <p className="text-muted-foreground" data-testid="text-actual-end">
                      {job.actualEnd 
                        ? format(new Date(job.actualEnd), "PPP p")
                        : "-"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {job.billingNotes && (
            <Card data-testid="card-billing">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Billing Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap" data-testid="text-billing-notes">
                  {job.billingNotes}
                </p>
              </CardContent>
            </Card>
          )}

          {job.recurringSeries && (
            <Card data-testid="card-recurring">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Repeat className="h-5 w-5" />
                  Recurring Series
                </CardTitle>
                <CardDescription>
                  This job is part of a recurring maintenance series
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p data-testid="text-series-summary">{job.recurringSeries.baseSummary}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card data-testid="card-location">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {job.location ? (
                <>
                  <div>
                    <h3 className="font-medium" data-testid="text-location-name">
                      {job.location.companyName}
                    </h3>
                    {job.parentCompany && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {job.parentCompany.name}
                      </div>
                    )}
                  </div>

                  {job.location.address && (
                    <div className="text-sm text-muted-foreground" data-testid="text-location-address">
                      <p>{job.location.address}</p>
                      <p>
                        {[job.location.city, job.location.province, job.location.postalCode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  )}

                  {job.location.contactName && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-contact-name">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {job.location.contactName}
                    </div>
                  )}

                  {job.location.phone && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-contact-phone">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`tel:${job.location.phone}`}
                        className="text-primary hover:underline"
                      >
                        {job.location.phone}
                      </a>
                    </div>
                  )}

                  {job.location.email && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-contact-email">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`mailto:${job.location.email}`}
                        className="text-primary hover:underline"
                      >
                        {job.location.email}
                      </a>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setLocation(`/clients/${job.locationId}`)}
                    data-testid="button-view-location"
                  >
                    View Location Details
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">Location not found</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-technicians">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Assigned Technicians
              </CardTitle>
            </CardHeader>
            <CardContent>
              {job.technicians && job.technicians.length > 0 ? (
                <div className="space-y-2">
                  {job.technicians.map(tech => (
                    <div 
                      key={tech.id} 
                      className="flex items-center gap-2"
                      data-testid={`text-technician-${tech.id}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {tech.firstName && tech.lastName 
                            ? `${tech.firstName} ${tech.lastName}`
                            : tech.email}
                        </p>
                        {tech.id === job.primaryTechnicianId && (
                          <Badge variant="secondary" className="text-xs">Primary</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No technicians assigned</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-metadata">
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span data-testid="text-created-at">
                  {format(new Date(job.createdAt), "PPP")}
                </span>
              </div>
              {job.updatedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span data-testid="text-updated-at">
                    {format(new Date(job.updatedAt), "PPP")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Job #{job.jobNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
