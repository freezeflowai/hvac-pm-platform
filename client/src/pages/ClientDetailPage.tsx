import { useState, useEffect } from "react";
import { useParams, useLocation, useSearch, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Building2, MapPin, Package, StickyNote, Phone, Mail, MapPinned, FileText, Plus, Briefcase, Star, Pencil, Trash2, CheckCircle, Clock, AlertCircle, Calendar, DollarSign, Settings, Wrench } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ClientLocationsTab from "@/components/ClientLocationsTab";
import ClientJobsTab from "@/components/ClientJobsTab";
import LocationFormModal from "@/components/LocationFormModal";
import { QuickAddJobDialog } from "@/components/QuickAddJobDialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Client, CustomerCompany, ClientNote, Job } from "@shared/schema";

type TabValue = "overview" | "jobs" | "locations" | "parts";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  
  const getInitialState = () => {
    const params = new URLSearchParams(searchString);
    const tab = params.get("tab") as TabValue | null;
    const locationId = params.get("locationId");
    return {
      tab: (tab && ["overview", "jobs", "locations", "parts"].includes(tab)) ? tab as TabValue : "overview",
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
  const [editLocationModalOpen, setEditLocationModalOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

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

  // Determine which location is focused (selectedLocationId from Jobs tab filter, or current client)
  const focusedLocationId = selectedLocationId || id;
  const focusedLocation = locations.find(loc => loc.id === focusedLocationId) || client;

  // Fetch notes for the focused location
  const { data: notes = [] } = useQuery<ClientNote[]>({
    queryKey: ["/api/client-notes", focusedLocationId],
    enabled: Boolean(focusedLocationId),
  });

  // Note mutations
  const createNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const res = await apiRequest("POST", `/api/client-notes`, { 
        clientId: focusedLocationId, 
        noteText 
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-notes", focusedLocationId] });
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
      const res = await apiRequest("PATCH", `/api/client-notes/${noteId}`, { noteText });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-notes", focusedLocationId] });
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
      await apiRequest("DELETE", `/api/client-notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-notes", focusedLocationId] });
      setDeleteNoteId(null);
      toast({ title: "Note deleted", description: "The note has been deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete note.", variant: "destructive" });
    },
  });

  // Fetch location-specific parts and equipment when on Jobs tab with a selected location filter (not the primary client)
  const { data: locationParts = [] } = useQuery<any[]>({
    queryKey: ["/api/locations", selectedLocationId, "pm-parts"],
    enabled: Boolean(selectedLocationId) && activeTab === "jobs",
  });

  const { data: locationEquipment = [] } = useQuery<any[]>({
    queryKey: ["/api/locations", selectedLocationId, "equipment"],
    enabled: Boolean(selectedLocationId) && activeTab === "jobs",
  });

  // Get the selected location (only when an actual location is selected, not fallback to primary client)
  const selectedLocation = selectedLocationId ? locations.find(loc => loc.id === selectedLocationId) : undefined;

  // Toggle location active status - only for selected locations, not the primary client
  const toggleActiveMutation = useMutation({
    mutationFn: async (inactive: boolean) => {
      if (!selectedLocationId) throw new Error("No location selected");
      const res = await apiRequest("PATCH", `/api/clients/${selectedLocationId}`, { inactive });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer-companies", client?.parentCompanyId, "locations"] });
      setDeactivateDialogOpen(false);
      toast({ title: "Status updated", description: `Location ${selectedLocation?.inactive ? "activated" : "deactivated"} successfully.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    },
  });

  // Toggle bill with parent - only for selected locations, not the primary client
  const toggleBillWithParentMutation = useMutation({
    mutationFn: async (billWithParent: boolean) => {
      if (!selectedLocationId) throw new Error("No location selected");
      const res = await apiRequest("PATCH", `/api/clients/${selectedLocationId}`, { billWithParent });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer-companies", client?.parentCompanyId, "locations"] });
      toast({ title: "Billing updated", description: "Billing preference updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update billing.", variant: "destructive" });
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 
            className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors" 
            onClick={() => setLocation("/?tab=clients")}
            data-testid="text-client-name"
          >
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
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="flex gap-6">
        {/* Left Column - 70% */}
        <div className="flex-1 min-w-0" style={{ flexBasis: '70%' }}>
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
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Properties Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle>Properties</CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleTabChange("locations")} data-testid="button-manage-property">
                <MapPin className="h-4 w-4 mr-2" />
                Manage Property
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

      </Tabs>

      <QuickAddJobDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        preselectedLocationId={preselectedLocationId}
      />
        </div>

        {/* Right Column - 30% */}
        <aside className="w-[30%] min-w-[280px] space-y-4 flex-shrink-0">
          {/* Dynamic content based on tab - show location panel only when a location is selected */}
          {activeTab === "jobs" && selectedLocationId && selectedLocation ? (
            <>
              {/* Location Header with Status */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{selectedLocation.location || selectedLocation.companyName || "Location"}</CardTitle>
                    <Badge variant={selectedLocation.inactive ? "secondary" : "default"}>
                      {selectedLocation.inactive ? "Inactive" : "Active"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Address */}
                  {selectedLocation.address && (
                    <div className="text-sm text-muted-foreground">
                      <p>{selectedLocation.address}</p>
                      <p>{selectedLocation.city}, {selectedLocation.province} {selectedLocation.postalCode}</p>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="space-y-2">
                    {selectedLocation.contactName && (
                      <p className="text-sm font-medium">{selectedLocation.contactName}</p>
                    )}
                    {selectedLocation.email && (
                      <a href={`mailto:${selectedLocation.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <Mail className="h-4 w-4" />
                        {selectedLocation.email}
                      </a>
                    )}
                    {selectedLocation.phone && (
                      <a href={`tel:${selectedLocation.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <Phone className="h-4 w-4" />
                        {selectedLocation.phone}
                      </a>
                    )}
                  </div>

                  {/* Bill with Parent Toggle */}
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Bill with Parent</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedLocation.billWithParent ? "Billed to parent company" : "Billed directly"}
                      </p>
                    </div>
                    <Switch
                      checked={selectedLocation.billWithParent ?? true}
                      onCheckedChange={(checked) => toggleBillWithParentMutation.mutate(checked)}
                      disabled={toggleBillWithParentMutation.isPending}
                      data-testid="switch-bill-with-parent"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => setEditLocationModalOpen(true)}
                      data-testid="button-edit-location"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      variant={selectedLocation.inactive ? "default" : "outline"}
                      size="sm" 
                      className="flex-1"
                      onClick={() => selectedLocation.inactive ? toggleActiveMutation.mutate(false) : setDeactivateDialogOpen(true)}
                      disabled={toggleActiveMutation.isPending}
                      data-testid="button-toggle-active"
                    >
                      {selectedLocation.inactive ? "Activate" : "Deactivate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Parts */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Parts ({locationParts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {locationParts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No parts assigned</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {locationParts.slice(0, 5).map((part: any, idx: number) => (
                        <div key={idx} className="text-sm flex justify-between">
                          <span>{part.partName || part.name || "Part"}</span>
                          <span className="text-muted-foreground">x{part.quantity || 1}</span>
                        </div>
                      ))}
                      {locationParts.length > 5 && (
                        <p className="text-xs text-muted-foreground">+{locationParts.length - 5} more</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Equipment */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Equipment ({locationEquipment.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {locationEquipment.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No equipment registered</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {locationEquipment.slice(0, 5).map((eq: any) => (
                        <div key={eq.id} className="text-sm">
                          <p className="font-medium">{eq.name}</p>
                          <p className="text-xs text-muted-foreground">{eq.equipmentType}</p>
                        </div>
                      ))}
                      {locationEquipment.length > 5 && (
                        <p className="text-xs text-muted-foreground">+{locationEquipment.length - 5} more</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {/* Contact Information - for overview and other tabs */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {client.contactName && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {client.contactName.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="font-medium" data-testid="text-contact-name">{client.contactName}</span>
                    </div>
                  )}
                  {client.email && (
                    <a 
                      href={`mailto:${client.email}`} 
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="link-contact-email"
                    >
                      <Mail className="h-4 w-4" />
                      {client.email}
                    </a>
                  )}
                  {client.phone && (
                    <a 
                      href={`tel:${client.phone}`} 
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="link-contact-phone"
                    >
                      <Phone className="h-4 w-4" />
                      {client.phone}
                    </a>
                  )}
                  {!client.contactName && !client.email && !client.phone && (
                    <p className="text-sm text-muted-foreground">No contact information</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Notes - always visible */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isAddingNote ? (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Note details"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="textarea-new-note"
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => createNoteMutation.mutate(newNoteContent.trim())}
                      disabled={!newNoteContent.trim() || createNoteMutation.isPending}
                      data-testid="button-save-note"
                    >
                      Save
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
                  size="sm"
                  className="w-full"
                  onClick={() => setIsAddingNote(true)}
                  data-testid="button-add-note"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              )}

              {notes.length > 0 && (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div 
                      key={note.id}
                      className="p-3 border rounded-lg cursor-pointer hover-elevate text-sm"
                      onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.noteText); }}
                      data-testid={`card-note-${note.id}`}
                    >
                      {editingNoteId === note.id ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <Textarea
                            value={editNoteContent}
                            onChange={(e) => setEditNoteContent(e.target.value)}
                            className="min-h-[60px]"
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
                              size="icon"
                              className="text-destructive ml-auto"
                              onClick={() => setDeleteNoteId(note.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground mb-1">
                            {format(new Date(note.createdAt), "MM/dd/yyyy")}
                          </p>
                          <p className="whitespace-pre-wrap line-clamp-3">{note.noteText}</p>
                        </>
                      )}
                    </div>
                  ))}
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

          {/* Deactivate Location Confirmation */}
          <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deactivate Location</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to deactivate this location? It will be hidden from schedules and reports.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => toggleActiveMutation.mutate(true)}
                >
                  Deactivate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </aside>
      </div>

      {/* Edit Location Modal - only shown when a location is selected */}
      {selectedLocation && (
        <LocationFormModal
          open={editLocationModalOpen}
          onOpenChange={setEditLocationModalOpen}
          location={selectedLocation}
          companyId={client.companyId}
          parentCompanyId={client.parentCompanyId || undefined}
          onSuccess={() => {
            setEditLocationModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
            queryClient.invalidateQueries({ queryKey: ["/api/customer-companies", client.parentCompanyId, "locations"] });
          }}
        />
      )}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}
