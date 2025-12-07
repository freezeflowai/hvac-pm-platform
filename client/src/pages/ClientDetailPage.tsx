import { useState, useEffect } from "react";
import { useParams, useLocation, useSearch, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building2, MapPin, Package, StickyNote, Phone, Mail, MapPinned, FileText, Plus, Briefcase, Activity } from "lucide-react";
import ClientLocationsTab from "@/components/ClientLocationsTab";
import ClientNotesTab from "@/components/ClientNotesTab";
import ClientJobsTab from "@/components/ClientJobsTab";
import type { Client, CustomerCompany } from "@shared/schema";

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

  const [activeTab, setActiveTab] = useState<TabValue>(getInitialState().tab);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(getInitialState().locationId);

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

  const handleCreateJob = (locationId?: string) => {
    if (locationId) {
      setLocation(`/calendar?action=createJob&locationId=${locationId}`);
    } else {
      setLocation(`/calendar?action=createJob&parentCompanyId=${client?.parentCompanyId}`);
    }
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
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
                <CardDescription>
                  Parent company details (maps to QuickBooks Customer)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Company Name</Label>
                  <p className="font-medium">{companyName}</p>
                </div>
                {parentCompany?.legalName && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Legal Name</Label>
                    <p>{parentCompany.legalName}</p>
                  </div>
                )}
                {(parentCompany?.phone || client.phone) && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{parentCompany?.phone || client.phone}</span>
                  </div>
                )}
                {(parentCompany?.email || client.email) && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{parentCompany?.email || client.email}</span>
                  </div>
                )}
                {parentCompany?.billingStreet && (
                  <div className="flex items-start gap-2">
                    <MapPinned className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p>{parentCompany.billingStreet}</p>
                      <p>{parentCompany.billingCity}, {parentCompany.billingProvince} {parentCompany.billingPostalCode}</p>
                    </div>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleTabChange("locations")}
                  data-testid="button-view-locations"
                >
                  View All Locations
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Primary Location
                </CardTitle>
                <CardDescription>
                  Service location details (maps to QuickBooks Sub-Customer)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Location Name</Label>
                  <p className="font-medium">{locationName}</p>
                </div>
                {client.address && (
                  <div className="flex items-start gap-2">
                    <MapPinned className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p>{client.address}</p>
                      <p>{client.city}, {client.province} {client.postalCode}</p>
                    </div>
                  </div>
                )}
                {client.contactName && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Contact</Label>
                    <p>{client.contactName}</p>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{client.email}</span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Billing</Label>
                    <Badge variant={client.billWithParent ? "default" : "secondary"}>
                      {client.billWithParent ? "Bills to Parent" : "Bills Directly"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {client.billWithParent 
                      ? "Invoices will be billed to the parent company."
                      : "Invoices will be billed directly to this location."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Summary
              </CardTitle>
              <CardDescription>
                Overview of recent activity and metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center py-4 border rounded-lg">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Jobs</p>
                  <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
                </div>
                <div className="text-center py-4 border rounded-lg">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Unpaid Invoices</p>
                  <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
                </div>
                <div className="text-center py-4 border rounded-lg">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Locations</p>
                  <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
                </div>
              </div>
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

        <TabsContent value="notes">
          <ClientNotesTab clientId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}
