import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Briefcase, FileText, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { QuickAddJobDialog } from "@/components/QuickAddJobDialog";
import LocationFormModal from "@/components/LocationFormModal";
import { PartsSelectorModal } from "@/components/PartsSelectorModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Client, CustomerCompany, ClientNote, Job, LocationPMPartTemplate } from "@shared/schema";

export default function LocationDetailPage() {
  const { id, locationId } = useParams<{ id: string; locationId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [partsModalOpen, setPartsModalOpen] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  const { data: location, isLoading: locationLoading, error: locationError } = useQuery<Client>({
    queryKey: ["/api/clients", locationId],
    enabled: Boolean(locationId),
  });

  const { data: parentClient } = useQuery<Client>({
    queryKey: ["/api/clients", id],
    enabled: Boolean(id),
  });

  const { data: parentCompany } = useQuery<CustomerCompany>({
    queryKey: [`/api/customer-companies/${location?.parentCompanyId}`],
    enabled: Boolean(location?.parentCompanyId),
  });

  const { data: notes = [] } = useQuery<ClientNote[]>({
    queryKey: ["/api/client-notes", locationId],
    enabled: Boolean(locationId),
  });

  const { data: equipment = [] } = useQuery<any[]>({
    queryKey: ["/api/locations", locationId, "equipment"],
    enabled: Boolean(locationId),
  });

  const { data: pmParts = [] } = useQuery<LocationPMPartTemplate[]>({
    queryKey: ["/api/locations", locationId, "pm-parts"],
    enabled: Boolean(locationId),
  });

  const { data: partsData } = useQuery<{ items: { id: string; name: string | null; sku: string | null }[] }>({
    queryKey: ["/api/parts"],
    enabled: Boolean(locationId) && pmParts.length > 0,
  });
  const allParts = partsData?.items || [];

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    enabled: Boolean(locationId),
  });

  const locationJobs = jobs.filter(j => j.locationId === locationId);
  const overdueJobs = locationJobs.filter(j => {
    if (!j.scheduledStart) return false;
    return new Date(j.scheduledStart) < new Date() && j.status !== "completed" && j.status !== "cancelled";
  });

  const toggleBillWithParentMutation = useMutation({
    mutationFn: async (billWithParent: boolean) => {
      const res = await apiRequest("PATCH", `/api/clients/${locationId}`, { billWithParent });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", locationId] });
      toast({ title: "Billing updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update billing.", variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const res = await apiRequest("POST", `/api/client-notes`, { clientId: locationId, noteText });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-notes", locationId] });
      setNewNoteContent("");
      setIsAddingNote(false);
      toast({ title: "Note added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, noteText }: { noteId: string; noteText: string }) => {
      const res = await apiRequest("PATCH", `/api/client-notes/${noteId}`, { noteText });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-notes", locationId] });
      setEditingNoteId(null);
      setEditNoteContent("");
      toast({ title: "Note updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update note.", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/client-notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-notes", locationId] });
      setDeleteNoteId(null);
      toast({ title: "Note deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete note.", variant: "destructive" });
    },
  });

  if (locationLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (locationError || !location) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold text-destructive">Location not found</h2>
          <p className="text-muted-foreground mt-2">The location you're looking for doesn't exist.</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation(`/clients/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Client
          </Button>
        </div>
      </div>
    );
  }

  const companyName = parentCompany?.name || parentClient?.companyName || "Client";
  const locationName = location.location || location.companyName || "Location";
  const isActive = !location.inactive;
  const billParent = location.billWithParent ?? true;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-50 text-green-700 hover:bg-green-50">Completed</Badge>;
      case "in_progress": return <Badge variant="default">In Progress</Badge>;
      case "scheduled": return <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">Scheduled</Badge>;
      case "overdue": return <Badge variant="destructive">Overdue</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm" data-testid="breadcrumb">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <button
              type="button"
              className="font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
              onClick={() => setLocation(`/clients/${id}`)}
              data-testid="breadcrumb-client"
            >
              {companyName}
            </button>
          </li>
          <li className="flex items-center">
            <span className="mx-1 text-muted-foreground">/</span>
            <span className="font-medium text-foreground">{locationName}</span>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-location-name">{locationName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {location.address}, {location.city} {location.province} {location.postalCode}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-blue-50 text-blue-700 hover:bg-blue-50" : ""}>
              {isActive ? "Active" : "Inactive"}
            </Badge>
            <span className="text-muted-foreground">
              Bill Parent: <span className="font-medium">{billParent ? "Yes" : "No"}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditModalOpen(true)} data-testid="button-edit-location">
            Edit Location
          </Button>
          <Button onClick={() => setJobDialogOpen(true)} data-testid="button-create-job">
            <Briefcase className="h-4 w-4 mr-2" />
            Create Job
          </Button>
          <Button variant="outline" data-testid="button-create-invoice">
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </header>

      {/* Main 2-Column Layout: Job History (3fr) | Settings (2fr) */}
      <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        {/* LEFT: Job History */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Job History</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto space-y-2">
              {locationJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No jobs yet for this location.</p>
              ) : (
                locationJobs.map((job) => {
                  const isOverdue = job.scheduledStart && 
                    new Date(job.scheduledStart) < new Date() && 
                    job.status !== "completed" && 
                    job.status !== "cancelled";
                  return (
                    <div 
                      key={job.id} 
                      className="flex items-center justify-between rounded-lg border p-3 text-sm hover-elevate cursor-pointer"
                      onClick={() => setLocation(`/jobs/${job.id}`)}
                      data-testid={`row-job-${job.id}`}
                    >
                      <div>
                        <div className="font-medium text-primary hover:underline">
                          #{job.jobNumber} • {job.summary}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {job.scheduledStart ? format(new Date(job.scheduledStart), "MMM dd, yyyy") : "Not scheduled"}
                        </div>
                      </div>
                      {isOverdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : (
                        getStatusBadge(job.status)
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: PM, Equipment, Parts, Notes, Billing */}
        <div className="space-y-4">
          {/* PM Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Preventive Maintenance Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">PM Type</div>
                <Select defaultValue="quarterly">
                  <SelectTrigger>
                    <SelectValue placeholder="Select PM type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarterly">Quarterly PM</SelectItem>
                    <SelectItem value="biannual">Bi-Annual PM</SelectItem>
                    <SelectItem value="annual">Annual PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Scheduled Months</div>
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">Not configured</span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <div>
                  Last PM: <span className="font-medium text-foreground">—</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Next PM: <span className="font-medium text-foreground">—</span></span>
                  {overdueJobs.length > 0 && (
                    <Badge variant="destructive" className="text-xs">Overdue</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Equipment */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">Equipment</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-auto p-0 text-primary" 
                onClick={() => toast({ title: "Coming soon", description: "Equipment management will be available soon." })}
                data-testid="button-add-equipment"
              >
                + Add Equipment
              </Button>
            </CardHeader>
            <CardContent className="max-h-48 overflow-y-auto space-y-2">
              {equipment.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No equipment added yet for this location.
                </p>
              ) : (
                equipment.map((eq: any) => (
                  <div key={eq.id} className="rounded-lg border p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{eq.name}</div>
                        <div className="text-xs text-muted-foreground">{eq.equipmentType}</div>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {eq.manufacturer} {eq.modelNumber} • S/N: {eq.serialNumber || "—"}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* PM Parts */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">PM Parts / Filters / Belts</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-auto p-0 text-primary" 
                onClick={() => setPartsModalOpen(true)}
                data-testid="button-add-parts"
              >
                + Add Parts
              </Button>
            </CardHeader>
            <CardContent className="max-h-48 overflow-y-auto">
              {pmParts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No PM parts configured. Add filters, belts, and other recurring parts.
                </p>
              ) : (
                <div className="space-y-2">
                  {pmParts.map((pmPart) => {
                    const part = allParts.find(p => p.id === pmPart.productId);
                    return (
                      <div key={pmPart.id} className="flex items-center justify-between text-sm rounded-lg border p-2">
                        <div>
                          <div className="font-medium">{part?.name || "Unknown Part"}</div>
                          <div className="text-xs text-muted-foreground">{part?.sku || ""}</div>
                        </div>
                        <span className="text-xs text-muted-foreground">x{pmPart.quantityPerVisit}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">Notes</CardTitle>
              {!isAddingNote && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-auto p-0 text-primary"
                  onClick={() => setIsAddingNote(true)}
                  data-testid="button-add-note"
                >
                  + Add Note
                </Button>
              )}
            </CardHeader>
            <CardContent className="max-h-48 overflow-y-auto space-y-2">
              {isAddingNote && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Enter note..."
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="min-h-[60px]"
                    data-testid="textarea-new-note"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => createNoteMutation.mutate(newNoteContent.trim())}
                      disabled={!newNoteContent.trim() || createNoteMutation.isPending}
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setIsAddingNote(false); setNewNoteContent(""); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {notes.length === 0 && !isAddingNote && (
                <p className="text-xs text-muted-foreground">
                  No notes yet. Use notes to record access info, landlord details, etc.
                </p>
              )}

              {notes.map((note) => (
                <div key={note.id} className="p-2 border rounded-lg text-sm" data-testid={`card-note-${note.id}`}>
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editNoteContent}
                        onChange={(e) => setEditNoteContent(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateNoteMutation.mutate({ noteId: note.id, noteText: editNoteContent.trim() })}
                          disabled={!editNoteContent.trim() || updateNoteMutation.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setEditingNoteId(null); setEditNoteContent(""); }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive ml-auto"
                          onClick={() => setDeleteNoteId(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer"
                      onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.noteText); }}
                    >
                      <p className="text-xs text-muted-foreground mb-1">
                        {format(new Date(note.createdAt), "MMM dd, yyyy")}
                      </p>
                      <p className="whitespace-pre-wrap text-xs">{note.noteText}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Billing Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Billing Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Bill with Parent</p>
                  <p className="text-xs text-muted-foreground">
                    {billParent ? "Invoices go to parent company" : "Invoices go directly to this location"}
                  </p>
                </div>
                <Switch
                  checked={billParent}
                  onCheckedChange={(checked) => toggleBillWithParentMutation.mutate(checked)}
                  disabled={toggleBillWithParentMutation.isPending}
                  data-testid="switch-bill-with-parent"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <QuickAddJobDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        preselectedLocationId={locationId}
      />

      <PartsSelectorModal
        open={partsModalOpen}
        onOpenChange={setPartsModalOpen}
        locationId={locationId!}
        existingParts={pmParts}
      />

      <LocationFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        location={location}
        companyId={location.companyId}
        parentCompanyId={location.parentCompanyId || undefined}
        onSuccess={() => {
          setEditModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/clients", locationId] });
        }}
      />

      <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteNoteId && deleteNoteMutation.mutate(deleteNoteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
