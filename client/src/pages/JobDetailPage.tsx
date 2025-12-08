import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
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
  Repeat,
  ChevronRight,
  UserPlus,
  Package,
  Receipt,
  History,
  Wrench,
  Send,
  Check
} from "lucide-react";
import JobEquipmentSection from "@/components/JobEquipmentSection";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Job, Client, CustomerCompany, User as UserType, RecurringJobSeries } from "@shared/schema";

interface JobDetailResponse extends Job {
  location?: Client;
  parentCompany?: CustomerCompany;
  technicians?: UserType[];
  recurringSeries?: RecurringJobSeries;
}

const JOB_STATUS_FLOW = [
  { key: "draft", label: "Draft", icon: FileText },
  { key: "scheduled", label: "Scheduled", icon: Calendar },
  { key: "in_progress", label: "In Progress", icon: Play },
  { key: "completed", label: "Completed", icon: CheckCircle },
  { key: "invoiced", label: "Invoiced", icon: Receipt },
];

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["completed", "on_hold", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  completed: ["invoiced"],
  invoiced: [],
  cancelled: [],
};

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
  if (status === "invoiced") {
    return { label: "Invoiced", variant: "default", icon: Receipt };
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

function getNextAction(status: string, hasInvoice: boolean): { label: string; action: string; icon: any } | null {
  switch (status) {
    case "draft":
      return { label: "Schedule Job", action: "schedule", icon: Calendar };
    case "scheduled":
      return { label: "Start Job", action: "start", icon: Play };
    case "in_progress":
      return { label: "Mark Completed", action: "complete", icon: CheckCircle };
    case "completed":
      return hasInvoice 
        ? { label: "View Invoice", action: "view_invoice", icon: Receipt }
        : { label: "Create Invoice", action: "create_invoice", icon: Receipt };
    case "invoiced":
      return { label: "View Invoice", action: "view_invoice", icon: Receipt };
    default:
      return null;
  }
}

function StatusProgressBar({ currentStatus, onStatusChange, isUpdating }: {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  isUpdating: boolean;
}) {
  const currentIndex = JOB_STATUS_FLOW.findIndex(s => s.key === currentStatus);
  const isCancelled = currentStatus === "cancelled";
  const isOnHold = currentStatus === "on_hold";
  const availableTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  const canCancel = availableTransitions.includes("cancelled");
  const canHold = availableTransitions.includes("on_hold");
  const canResume = currentStatus === "on_hold" && availableTransitions.includes("in_progress");
  
  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
        <XCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Job Cancelled</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="status-progress-bar">
      <div className="flex items-center gap-1">
        {JOB_STATUS_FLOW.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.key === currentStatus || (isOnHold && step.key === "in_progress");
          const isCompleted = index < currentIndex && !isOnHold;
          const isClickable = !isUpdating && (
            (index === currentIndex + 1 && STATUS_TRANSITIONS[currentStatus]?.includes(step.key))
          );
          
          return (
            <div key={step.key} className="flex items-center">
              {index > 0 && (
                <div className={cn(
                  "w-6 h-0.5 mx-0.5",
                  isCompleted || isActive ? "bg-primary" : "bg-muted"
                )} />
              )}
              <button
                onClick={() => isClickable && onStatusChange(step.key)}
                disabled={!isClickable || isUpdating}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all",
                  isActive && "bg-primary text-primary-foreground",
                  isCompleted && !isActive && "bg-primary/20 text-primary",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground",
                  isClickable && "hover-elevate cursor-pointer",
                  !isClickable && "cursor-default"
                )}
                data-testid={`status-step-${step.key}`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden md:inline">{step.label}</span>
              </button>
            </div>
          );
        })}
      </div>
      
      {isOnHold && (
        <Badge variant="outline" className="gap-1">
          <Pause className="h-3 w-3" />
          On Hold
        </Badge>
      )}
      
      {(canHold || canCancel || canResume) && (
        <div className="flex items-center gap-1 ml-2 border-l pl-2">
          {canResume && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onStatusChange("in_progress")}
              disabled={isUpdating}
              data-testid="button-resume"
            >
              <Play className="h-3 w-3 mr-1" />
              Resume
            </Button>
          )}
          {canHold && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onStatusChange("on_hold")}
              disabled={isUpdating}
              data-testid="button-hold"
            >
              <Pause className="h-3 w-3 mr-1" />
              Hold
            </Button>
          )}
          {canCancel && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onStatusChange("cancelled")}
              disabled={isUpdating}
              className="text-destructive hover:text-destructive"
              data-testid="button-cancel-job"
            >
              <XCircle className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function AssignTechnicianDialog({ 
  open, 
  onOpenChange, 
  jobId,
  currentTechnicianIds,
  primaryTechnicianId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  currentTechnicianIds: string[];
  primaryTechnicianId: string | null;
}) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>(currentTechnicianIds);
  const [primaryId, setPrimaryId] = useState<string | null>(primaryTechnicianId);

  // Sync local state with props when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedIds(currentTechnicianIds);
      setPrimaryId(primaryTechnicianId);
    }
  }, [open, currentTechnicianIds, primaryTechnicianId]);

  const { data: technicians = [], isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/technicians"],
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/jobs/${jobId}`, {
        assignedTechnicianIds: selectedIds,
        primaryTechnicianId: primaryId || (selectedIds.length > 0 ? selectedIds[0] : null),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Technicians Updated",
        description: "Job technician assignments have been updated.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update technicians",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (techId: string) => {
    setSelectedIds(prev => 
      prev.includes(techId) 
        ? prev.filter(id => id !== techId)
        : [...prev, techId]
    );
    if (primaryId === techId && selectedIds.includes(techId)) {
      setPrimaryId(null);
    }
  };

  const handleSetPrimary = (techId: string) => {
    if (!selectedIds.includes(techId)) {
      setSelectedIds(prev => [...prev, techId]);
    }
    setPrimaryId(techId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-assign-technician">
        <DialogHeader>
          <DialogTitle>Assign Technicians</DialogTitle>
          <DialogDescription>
            Select technicians to assign to this job
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[300px] overflow-y-auto py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : technicians.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No technicians available
            </p>
          ) : (
            technicians.map(tech => (
              <div 
                key={tech.id} 
                className="flex items-center justify-between p-2 rounded-lg hover-elevate"
                data-testid={`technician-option-${tech.id}`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedIds.includes(tech.id)}
                    onCheckedChange={() => handleToggle(tech.id)}
                    data-testid={`checkbox-tech-${tech.id}`}
                  />
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {tech.firstName && tech.lastName 
                        ? `${tech.firstName} ${tech.lastName}`
                        : tech.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{tech.email}</p>
                  </div>
                </div>
                {selectedIds.includes(tech.id) && (
                  <Button
                    variant={primaryId === tech.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSetPrimary(tech.id)}
                    data-testid={`button-primary-${tech.id}`}
                  >
                    {primaryId === tech.id ? "Primary" : "Set Primary"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
            data-testid="button-save-technicians"
          >
            {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function JobDetailPage() {
  const [, params] = useRoute("/jobs/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignTech, setShowAssignTech] = useState(false);
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

  const handleNextAction = () => {
    if (!job) return;
    // TODO: Check if job has an associated invoice for proper hasInvoice logic
    const nextAction = getNextAction(job.status, job.status === "invoiced");
    if (!nextAction) return;

    switch (nextAction.action) {
      case "schedule":
        handleStatusChange("scheduled");
        break;
      case "start":
        handleStatusChange("in_progress");
        break;
      case "complete":
        handleStatusChange("completed");
        break;
      case "create_invoice":
        if (!job.locationId) {
          toast({ 
            title: "Cannot Create Invoice", 
            description: "This job is not linked to a location.", 
            variant: "destructive" 
          });
          return;
        }
        setLocation(`/invoices/new?jobId=${job.id}&locationId=${job.locationId}`);
        break;
      case "view_invoice":
        toast({ title: "Coming Soon", description: "Invoice viewing will be available soon." });
        break;
    }
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
  const nextAction = getNextAction(job.status, false);
  const NextActionIcon = nextAction?.icon;

  return (
    <div className="p-6 space-y-6" data-testid="job-detail-page">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
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
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold" data-testid="text-job-number">
                  Job #{job.jobNumber}
                </h1>
                {statusInfo.isOverdue && (
                  <Badge variant="destructive" className="gap-1" data-testid="badge-overdue">
                    <AlertTriangle className="h-3 w-3" />
                    Overdue
                  </Badge>
                )}
                <Badge variant={priorityInfo.variant} data-testid="badge-priority">
                  {priorityInfo.label}
                </Badge>
              </div>
              <p className="text-muted-foreground capitalize" data-testid="text-job-type">
                {job.jobType} job
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {nextAction && job.status !== "cancelled" && (
              <Button 
                onClick={handleNextAction}
                disabled={updateStatusMutation.isPending}
                data-testid="button-next-action"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : NextActionIcon && (
                  <NextActionIcon className="h-4 w-4 mr-2" />
                )}
                {nextAction.label}
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => toast({ title: "Coming Soon", description: "Edit functionality coming soon." })}
              data-testid="button-edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
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

        <StatusProgressBar
          currentStatus={job.status}
          onStatusChange={handleStatusChange}
          isUpdating={updateStatusMutation.isPending}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card data-testid="card-job-details">
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm text-muted-foreground mb-1">Job Type</h3>
                  <p className="font-medium capitalize" data-testid="text-job-type-value">{job.jobType}</p>
                </div>
                <div>
                  <h3 className="text-sm text-muted-foreground mb-1">Priority</h3>
                  <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>
                </div>
              </div>

              <Separator />

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

          <Card data-testid="card-technicians">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Assigned Technicians
                </CardTitle>
                <CardDescription>
                  {job.technicians && job.technicians.length > 0 
                    ? `${job.technicians.length} technician${job.technicians.length > 1 ? 's' : ''} assigned`
                    : "No technicians assigned yet"}
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAssignTech(true)}
                data-testid="button-assign-technician"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {job.technicians && job.technicians.length > 0 ? "Manage" : "Assign"}
              </Button>
            </CardHeader>
            <CardContent>
              {job.technicians && job.technicians.length > 0 ? (
                <div className="space-y-3">
                  {job.technicians.map(tech => (
                    <div 
                      key={tech.id} 
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                      data-testid={`text-technician-${tech.id}`}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {tech.firstName && tech.lastName 
                            ? `${tech.firstName} ${tech.lastName}`
                            : tech.email}
                        </p>
                        <p className="text-sm text-muted-foreground">{tech.email}</p>
                      </div>
                      {tech.id === job.primaryTechnicianId && (
                        <Badge variant="secondary">Primary</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No technicians assigned to this job yet.</p>
                  <Button 
                    variant="outline" 
                    className="mt-3"
                    onClick={() => setShowAssignTech(true)}
                    data-testid="button-assign-technician-empty"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign Technician
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <JobEquipmentSection jobId={job.id} locationId={job.locationId} />

          <Card data-testid="card-parts-billing">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Parts & Billing
                </CardTitle>
                <CardDescription>
                  Manage parts used and billing for this job
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Parts Added</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Invoice Status</p>
                  <p className="text-lg font-medium">
                    {job.status === "invoiced" ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <Check className="h-4 w-4" />
                        Invoiced
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not Created</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => toast({ title: "Coming Soon", description: "Parts management coming soon." })}
                  data-testid="button-add-parts"
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Add Parts
                </Button>
                {job.status === "completed" && (
                  <Button 
                    size="sm"
                    onClick={() => setLocation(`/invoices/new?jobId=${job.id}&locationId=${job.locationId}`)}
                    data-testid="button-create-invoice"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                )}
              </div>
              {job.billingNotes && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="font-medium mb-1">Billing Notes</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap text-sm" data-testid="text-billing-notes">
                    {job.billingNotes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

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

          <Card data-testid="card-activity">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p>Job created</p>
                    <p className="text-muted-foreground">
                      {format(new Date(job.createdAt), "PPP 'at' p")}
                    </p>
                  </div>
                </div>
                {job.scheduledStart && (
                  <div className="flex gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div>
                      <p>Scheduled for</p>
                      <p className="text-muted-foreground">
                        {format(new Date(job.scheduledStart), "PPP 'at' p")}
                      </p>
                    </div>
                  </div>
                )}
                {job.actualStart && (
                  <div className="flex gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <div>
                      <p>Work started</p>
                      <p className="text-muted-foreground">
                        {format(new Date(job.actualStart), "PPP 'at' p")}
                      </p>
                    </div>
                  </div>
                )}
                {job.actualEnd && (
                  <div className="flex gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-600 mt-1.5 shrink-0" />
                    <div>
                      <p>Work completed</p>
                      <p className="text-muted-foreground">
                        {format(new Date(job.actualEnd), "PPP 'at' p")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Job ID</span>
                <span className="font-mono text-xs" data-testid="text-job-id">
                  {job.id.slice(0, 8)}
                </span>
              </div>
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

      <AssignTechnicianDialog
        open={showAssignTech}
        onOpenChange={setShowAssignTech}
        jobId={job.id}
        currentTechnicianIds={job.assignedTechnicianIds || []}
        primaryTechnicianId={job.primaryTechnicianId}
      />
    </div>
  );
}
