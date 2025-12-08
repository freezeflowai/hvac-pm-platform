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
  const priorityInfo = getPriorityDisplay(job.priority);

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

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast({ title: "Coming Soon", description: "Edit functionality coming soon." })}
              data-testid="button-edit"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteJobMutation.isPending}
              className="text-destructive hover:text-destructive"
              data-testid="button-delete"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <StatusProgressBar
          currentStatus={job.status}
          onStatusChange={handleStatusChange}
          isUpdating={updateStatusMutation.isPending}
        />
      </div>

      {/* Two-column layout: Left = Job work, Right = Supporting context */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT COLUMN: Primary job information and billing */}
        <div className="lg:col-span-3 space-y-4">
          {/* Job Details Card */}
          <Card data-testid="card-job-details">
            <CardHeader className="pb-3">
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Job Type</p>
                  <p className="font-medium capitalize" data-testid="text-job-type-value">{job.jobType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Priority</p>
                  <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-1">Summary</p>
                <p className="font-medium" data-testid="text-summary">{job.summary}</p>
              </div>
              
              {job.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="whitespace-pre-wrap" data-testid="text-description">
                    {job.description}
                  </p>
                </div>
              )}

              {job.accessInstructions && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Access Instructions</p>
                  <p className="whitespace-pre-wrap" data-testid="text-access">
                    {job.accessInstructions}
                  </p>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Scheduled Start
                  </p>
                  <p data-testid="text-scheduled-start">
                    {job.scheduledStart 
                      ? format(new Date(job.scheduledStart), "PPP p")
                      : "Not scheduled"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Scheduled End
                  </p>
                  <p data-testid="text-scheduled-end">
                    {job.scheduledEnd 
                      ? format(new Date(job.scheduledEnd), "PPP p")
                      : "Not set"}
                  </p>
                </div>
              </div>

              {(job.actualStart || job.actualEnd) && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Actual Start</p>
                    <p data-testid="text-actual-start">
                      {job.actualStart 
                        ? format(new Date(job.actualStart), "PPP p")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Actual End</p>
                    <p data-testid="text-actual-end">
                      {job.actualEnd 
                        ? format(new Date(job.actualEnd), "PPP p")
                        : "-"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parts & Billing Card */}
          <Card data-testid="card-parts-billing">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Parts & Billing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Parts Added</p>
                  <p className="text-xl font-semibold">0</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Invoice Status</p>
                  <p className="font-medium">
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

              {job.billingNotes && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Billing Notes</p>
                  <p className="whitespace-pre-wrap text-sm" data-testid="text-billing-notes">
                    {job.billingNotes}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => toast({ title: "Coming Soon", description: "Parts management coming soon." })}
                  data-testid="button-add-parts"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Add Parts
                </Button>
                {job.status === "completed" ? (
                  <Button 
                    size="sm"
                    onClick={() => {
                      if (!job.locationId) {
                        toast({ 
                          title: "Cannot Create Invoice", 
                          description: "This job is not linked to a location.", 
                          variant: "destructive" 
                        });
                        return;
                      }
                      setLocation(`/invoices/new?jobId=${job.id}&locationId=${job.locationId}`);
                    }}
                    data-testid="button-create-invoice"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                ) : job.status === "invoiced" ? (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => toast({ title: "Coming Soon", description: "Invoice viewing will be available soon." })}
                    data-testid="button-view-invoice"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    View Invoice
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {job.recurringSeries && (
            <Card data-testid="card-recurring">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Repeat className="h-5 w-5" />
                  Recurring Series
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p data-testid="text-series-summary">{job.recurringSeries.baseSummary}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: Supporting context */}
        <div className="lg:col-span-2 space-y-4">
          {/* Location Card */}
          <Card data-testid="card-location">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {job.location ? (
                <>
                  <div>
                    <p className="font-medium" data-testid="text-location-name">
                      {job.location.companyName}
                    </p>
                    {job.parentCompany && (
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {job.parentCompany.name}
                      </p>
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

                  <div className="flex flex-wrap gap-2 pt-2">
                    {job.location.phone && (
                      <Button variant="outline" size="sm" asChild data-testid="button-call">
                        <a href={`tel:${job.location.phone}`}>
                          <Phone className="h-3 w-3 mr-1" />
                          Call
                        </a>
                      </Button>
                    )}
                    {job.location.email && (
                      <Button variant="outline" size="sm" asChild data-testid="button-email">
                        <a href={`mailto:${job.location.email}`}>
                          <Mail className="h-3 w-3 mr-1" />
                          Email
                        </a>
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setLocation(`/clients/${job.locationId}`)}
                    data-testid="button-view-location"
                  >
                    View Location Details
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Location not found</p>
              )}
            </CardContent>
          </Card>

          {/* Assigned Technicians Card */}
          <Card data-testid="card-technicians">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Assigned Technicians
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAssignTech(true)}
                data-testid="button-assign-technician"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                {job.technicians && job.technicians.length > 0 ? "Manage" : "Assign"}
              </Button>
            </CardHeader>
            <CardContent>
              {job.technicians && job.technicians.length > 0 ? (
                <div className="space-y-2">
                  {job.technicians.map(tech => (
                    <div 
                      key={tech.id} 
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                      data-testid={`text-technician-${tech.id}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {tech.firstName && tech.lastName 
                            ? `${tech.firstName} ${tech.lastName}`
                            : tech.email}
                        </p>
                      </div>
                      {tech.id === job.primaryTechnicianId && (
                        <Badge variant="secondary" className="shrink-0">Primary</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <User className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No technicians assigned yet.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Equipment Card */}
          <JobEquipmentSection jobId={job.id} locationId={job.locationId} />

          {/* Activity Card */}
          <Card data-testid="card-activity">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p>Job created</p>
                    <p className="text-muted-foreground text-xs">
                      {format(new Date(job.createdAt), "PPP")}
                    </p>
                  </div>
                </div>
                {job.scheduledStart && (
                  <div className="flex gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div>
                      <p>Scheduled</p>
                      <p className="text-muted-foreground text-xs">
                        {format(new Date(job.scheduledStart), "PPP")}
                      </p>
                    </div>
                  </div>
                )}
                {job.actualStart && (
                  <div className="flex gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <div>
                      <p>Work started</p>
                      <p className="text-muted-foreground text-xs">
                        {format(new Date(job.actualStart), "PPP")}
                      </p>
                    </div>
                  </div>
                )}
                {job.actualEnd && (
                  <div className="flex gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-600 mt-1.5 shrink-0" />
                    <div>
                      <p>Work completed</p>
                      <p className="text-muted-foreground text-xs">
                        {format(new Date(job.actualEnd), "PPP")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Metadata Card */}
          <Card data-testid="card-metadata">
            <CardHeader className="pb-3">
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span data-testid="text-created-at">
                  {format(new Date(job.createdAt), "PP")}
                </span>
              </div>
              {job.updatedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span data-testid="text-updated-at">
                    {format(new Date(job.updatedAt), "PP")}
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
