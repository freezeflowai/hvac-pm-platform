import { useState, useEffect } from "react";
import { useParams, useLocation, useSearch, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Building2, MapPin, Package, StickyNote, Phone, Mail, MapPinned, FileText, Plus, Briefcase, Star, Pencil, Trash2, CheckCircle, Clock, AlertCircle, Calendar, DollarSign } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ClientLocationsTab from "@/components/ClientLocationsTab";
import ClientNotesTab from "@/components/ClientNotesTab";
import ClientJobsTab from "@/components/ClientJobsTab";
import { QuickAddJobDialog } from "@/components/QuickAddJobDialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Client, CustomerCompany, ClientNote, Job } from "@shared/schema";

type TabValue = "overview" | "jobs" | "locations" | "parts" | "notes";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  
  const getInitialState = () => {
    const params = new URLSearchParams(searchString);
    const tab = params.get("tab") as TabValue | null;
    const locationId = params.get("locationId");
    return {
      tab: (tab && ["overview", "jobs", "locations", "parts", "notes"].includes(tab)) ? tab as TabValue : "overview",
      locationId: locationId || undefined
    };
  };

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabValue>(getInitialState().tab);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(getInitialState().locationId);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [preselectedLocationId, setPreselectedLocationId] = useState<string | undefined>();
  const [overviewSubTab, setOverviewSubTab] = useState<"active" | "jobs" | "invoices">("active");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  useEffect(() => {
    const state = getInitialState();
    setActiveTab(state.tab);
    setSelectedLocationId(state.locationId);
  }, [searchString]);

  const handleTabChange = (value: string) => {
    const tab = value as TabValue;
    setActiveTab(tab);
    setSelectedLocationId(undefined);
    if (tab === "overview") {
      setLocation(`/clients/${id}`);
    } else {
      setLocation(`/clients/${id}?tab=${tab}`);
    }
  };

  const handleViewJobsForLocation = (locationId: string) => {
    setActiveTab("jobs");
    setSelectedLocationId(locationId);
    setLocation(`/clients/${id}?tab=jobs&locationId=${locationId}`);
  };

  const { data: client, isLoading: clientLoading, error: clientError } = useQuery<Client>({
    queryKey: ["/api/clients", id],
    enabled: Boolean(id),
  });

  const { data: parentCompany, isLoading: companyLoading } = useQuery<CustomerCompany>({
    queryKey: [`/api/customer-companies/${client?.parentCompanyId}`],
    enabled: Boolean(client?.parentCompanyId),
  });

  // Fetch locations for this parent company
  const { data: locations = [] } = useQuery<Client[]>({
    queryKey: ["/api/customer-companies", client?.parentCompanyId, "locations"],
    enabled: Boolean(client?.parentCompanyId),
  });

  // Fetch jobs for overview - enable when we have a client ID
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    enabled: Boolean(client),
  });

  // Filter jobs to this company's locations
  const companyJobs = jobs.filter(job => {
    if (!locations.length) return job.locationId === id;
    return locations.some(loc => loc.id === job.locationId);
  });

  // Fetch notes for overview
  const { data: notes = [] } = useQuery<ClientNote[]>({
    queryKey: ["/api/clients", id, "notes"],
    enabled: Boolean(id),
  });

  // Note mutations
  const createNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const res = await apiRequest("POST", `/api/clients/${id}/notes`, { noteText });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "notes"] });
      setNewNoteContent("");
      setIsAddingNote(false);
      toast({ title: "Note added", description: "The note has been added successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, noteText }: { noteId: string; noteText: string }) => {
      const res = await apiRequest("PATCH", `/api/clients/${id}/notes/${noteId}`, { noteText });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "notes"] });
      setEditingNoteId(null);
      setEditNoteContent("");
      toast({ title: "Note updated", description: "The note has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update note.", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/clients/${id}/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "notes"] });
      setDeleteNoteId(null);
      toast({ title: "Note deleted", description: "The note has been deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete note.", variant: "destructive" });
    },
  });

  const handleCreateJob = (locationId?: string) => {
    setPreselectedLocationId(locationId || id);
    setJobDialogOpen(true);
  };

  if (clientLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-12 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (clientError || !client) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold text-destructive">Client not found</h2>
          <p className="text-muted-foreground mt-2">The client you're looking for doesn't exist or you don't have access.</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/?tab=clients")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Client List
          </Button>
        </div>
      </div>
    );
  }

  const companyName = parentCompany?.name || client.companyName;
  const locationName = client.location || "Primary Location";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/?tab=clients")} data-testid="button-back-to-clients">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-client-name">
              {companyName}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              {locationName}
              {client.inactive && (
                <Badge variant="secondary" className="ml-2">Inactive</Badge>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => handleCreateJob()} data-testid="button-header-create-job">
            <Briefcase className="h-4 w-4 mr-2" />
            Create Job
          </Button>
          <Link href={`/invoices/new?clientId=${id}`}>
            <Button variant="outline" data-testid="button-header-create-invoice">
              <FileText className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </Link>
          <Button variant="outline" onClick={() => handleTabChange("locations")} data-testid="button-header-add-location">
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Building2 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Briefcase className="h-4 w-4 mr-2" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="locations" data-testid="tab-locations">
            <MapPin className="h-4 w-4 mr-2" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="parts" data-testid="tab-parts">
            <Package className="h-4 w-4 mr-2" />
            Parts
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <StickyNote className="h-4 w-4 mr-2" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Properties Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle>Properties</CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleTabChange("locations")} data-testid="button-new-property">
                <Plus className="h-4 w-4 mr-2" />
                New Property
              </Button>
            </CardHeader>
            <CardContent>
              {locations.length === 0 ? (
                <div 
                  className="flex items-center gap-4 p-3 rounded-lg cursor-pointer hover-elevate"
                  onClick={() => handleViewJobsForLocation(id!)}
                  data-testid={`row-location-${id}`}
                >
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div>
                      <p className="font-medium">{locationName}</p>
                      <p className="text-sm text-muted-foreground">{client.address}</p>
                    </div>
                    <p className="text-muted-foreground">{client.city}</p>
                    <p className="text-muted-foreground">{client.province}</p>
                    <p className="text-muted-foreground">{client.postalCode}</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {locations.map((loc) => (
                    <div 
                      key={loc.id}
                      className="flex items-center gap-4 p-3 cursor-pointer hover-elevate"
                      onClick={() => handleViewJobsForLocation(loc.id)}
                      data-testid={`row-location-${loc.id}`}
                    >
                      {loc.id === id ? (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      ) : (
                        <div className="w-4" />
                      )}
                      <div className="flex-1 grid grid-cols-4 gap-4">
                        <div>
                          <p className="font-medium">{loc.location || loc.companyName}</p>
                          <p className="text-sm text-muted-foreground">{loc.address}</p>
                        </div>
                        <p className="text-muted-foreground">{loc.city}</p>
                        <p className="text-muted-foreground">{loc.province}</p>
                        <p className="text-muted-foreground">{loc.postalCode}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Internal Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5" />
                Internal Notes
              </CardTitle>
              <CardDescription>
                Internal notes will only be seen by your team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAddingNote ? (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Note details"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="min-h-[100px]"
                    data-testid="textarea-new-note"
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => createNoteMutation.mutate(newNoteContent.trim())}
                      disabled={!newNoteContent.trim() || createNoteMutation.isPending}
                      data-testid="button-save-note"
                    >
                      Save Note
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { setIsAddingNote(false); setNewNoteContent(""); }}
                      data-testid="button-cancel-note"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddingNote(true)}
                  data-testid="button-add-note"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              )}

              {notes.length > 0 && (
                <div className="space-y-3 mt-4">
                  {notes.slice(0, 3).map((note) => (
                    <div 
                      key={note.id}
                      className="p-4 border rounded-lg cursor-pointer hover-elevate"
                      onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.noteText); }}
                      data-testid={`card-note-${note.id}`}
                    >
                      {editingNoteId === note.id ? (
                        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                          <Textarea
                            value={editNoteContent}
                            onChange={(e) => setEditNoteContent(e.target.value)}
                            className="min-h-[80px]"
                            data-testid="textarea-edit-note"
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
                              size="sm" 
                              className="text-destructive ml-auto"
                              onClick={() => setDeleteNoteId(note.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                              {note.userId?.slice(0, 1).toUpperCase() || "U"}
                            </div>
                            <div>
                              <p className="text-sm font-medium">Team Member</p>
                              <p className="text-xs text-muted-foreground">
                                Created: {format(new Date(note.createdAt), "MM/dd/yyyy h:mma")}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{note.noteText}</p>
                        </>
                      )}
                    </div>
                  ))}
                  {notes.length > 3 && (
                    <Button variant="ghost" onClick={() => handleTabChange("notes")} className="text-primary hover:underline p-0 h-auto">
                      View all {notes.length} notes
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overview / Active Work Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap pb-2">
              <CardTitle>Overview</CardTitle>
              <Button size="sm" onClick={() => handleCreateJob()} data-testid="button-overview-new">
                New
              </Button>
            </CardHeader>
            <CardContent>
              <div className="border-b mb-4">
                <div className="flex gap-4">
                  <button
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors ${overviewSubTab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setOverviewSubTab("active")}
                    data-testid="tab-active-work"
                  >
                    Active Work
                  </button>
                  <button
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors ${overviewSubTab === "jobs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setOverviewSubTab("jobs")}
                    data-testid="tab-all-jobs"
                  >
                    Jobs
                  </button>
                  <button
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors ${overviewSubTab === "invoices" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setOverviewSubTab("invoices")}
                    data-testid="tab-invoices"
                  >
                    Invoices
                  </button>
                </div>
              </div>

              {overviewSubTab === "active" && (
                <div className="divide-y">
                  {companyJobs
                    .filter(job => ["scheduled", "in_progress", "draft"].includes(job.status))
                    .slice(0, 5)
                    .map((job) => {
                      const loc = locations.find(l => l.id === job.locationId) || client;
                      const isToday = job.scheduledStart && format(new Date(job.scheduledStart), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                      const isOverdue = job.scheduledStart && new Date(job.scheduledStart) < new Date() && job.status !== "completed";
                      
                      return (
                        <div 
                          key={job.id}
                          className="flex items-center gap-4 py-3 cursor-pointer hover-elevate"
                          onClick={() => setLocation(`/jobs/${job.id}`)}
                          data-testid={`row-active-job-${job.id}`}
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              Job #{job.jobNumber} - {job.summary || "Maintenance"}
                            </p>
                            {isToday && (
                              <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20 mt-1">
                                Today
                              </Badge>
                            )}
                            {isOverdue && !isToday && (
                              <Badge variant="destructive" className="mt-1">
                                Action required
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p>SCHEDULED FOR</p>
                            <p className="font-medium text-foreground">
                              {job.scheduledStart ? format(new Date(job.scheduledStart), "MM/dd/yyyy") : "Not scheduled"}
                            </p>
                          </div>
                          <div className="text-sm text-right min-w-[150px]">
                            <p className="font-medium">{loc.location || loc.companyName}</p>
                            <p className="text-muted-foreground">{loc.address}</p>
                            <p className="text-muted-foreground">{loc.city}, {loc.province} {loc.postalCode}</p>
                          </div>
                          <div className="text-right min-w-[80px]">
                            <p className="font-medium">$0.00</p>
                          </div>
                        </div>
                      );
                    })}
                  {companyJobs.filter(job => ["scheduled", "in_progress", "draft"].includes(job.status)).length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                      <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No active work</p>
                    </div>
                  )}
                </div>
              )}

              {overviewSubTab === "jobs" && (
                <div className="divide-y">
                  {companyJobs.slice(0, 10).map((job) => {
                    const loc = locations.find(l => l.id === job.locationId) || client;
                    return (
                      <div 
                        key={job.id}
                        className="flex items-center gap-4 py-3 cursor-pointer hover-elevate"
                        onClick={() => setLocation(`/jobs/${job.id}`)}
                        data-testid={`row-job-${job.id}`}
                      >
                        <div className="flex-1">
                          <p className="font-medium">Job #{job.jobNumber} - {job.summary || "Maintenance"}</p>
                          <Badge variant={job.status === "completed" ? "default" : "secondary"} className="mt-1">
                            {job.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {job.scheduledStart ? format(new Date(job.scheduledStart), "MM/dd/yyyy") : "Not scheduled"}
                        </div>
                        <div className="text-sm text-right">
                          <p>{loc.location || loc.companyName}</p>
                        </div>
                      </div>
                    );
                  })}
                  {companyJobs.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                      <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No jobs found</p>
                    </div>
                  )}
                  {companyJobs.length > 10 && (
                    <div className="pt-4">
                      <Button variant="ghost" onClick={() => handleTabChange("jobs")} className="text-primary hover:underline p-0 h-auto">
                        View all {companyJobs.length} jobs
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {overviewSubTab === "invoices" && (
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No invoices yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delete Note Confirmation */}
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
        </TabsContent>

        <TabsContent value="jobs">
          <ClientJobsTab 
            clientId={id!}
            companyId={client.companyId}
            parentCompanyId={client.parentCompanyId || undefined}
            initialLocationId={selectedLocationId}
            onCreateJob={handleCreateJob}
          />
        </TabsContent>

        <TabsContent value="locations">
          <ClientLocationsTab 
            clientId={id!} 
            companyId={client.companyId}
            parentCompanyId={client.parentCompanyId || undefined}
            onViewJobs={handleViewJobsForLocation}
          />
        </TabsContent>

        <TabsContent value="parts">
          <Card>
            <CardHeader>
              <CardTitle>Parts / Equipment</CardTitle>
              <CardDescription>
                Manage parts and equipment for this client
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Parts/Equipment management coming soon</p>
                <p className="text-sm">This feature is under development.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <ClientNotesTab clientId={id!} />
        </TabsContent>
      </Tabs>

      <QuickAddJobDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        preselectedLocationId={preselectedLocationId}
      />
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}
