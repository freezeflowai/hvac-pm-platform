import { useState, useEffect } from "react";
import { useParams, useLocation, useSearch, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building2, MapPin, Package, StickyNote, Phone, Mail, MapPinned, FileText } from "lucide-react";
import ClientLocationsTab from "@/components/ClientLocationsTab";
import ClientNotesTab from "@/components/ClientNotesTab";
import type { Client, CustomerCompany } from "@shared/schema";

// Client Detail Page with Tabs
// - Company = QBO Customer (parent)
// - Location = QBO Sub-Customer (child)
// - billWithParent controls invoice routing in QuickBooks

type TabValue = "overview" | "locations" | "parts" | "notes";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  
  // Parse tab from URL query params
  const getTabFromSearch = (): TabValue => {
    const params = new URLSearchParams(searchString);
    const tab = params.get("tab");
    if (tab === "locations" || tab === "parts" || tab === "notes") {
      return tab;
    }
    return "overview";
  };

  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromSearch());

  // Sync tab state with URL
  useEffect(() => {
    setActiveTab(getTabFromSearch());
  }, [searchString]);

  const handleTabChange = (value: string) => {
    const tab = value as TabValue;
    setActiveTab(tab);
    // Update URL with tab query param
    if (tab === "overview") {
      setLocation(`/clients/${id}`);
    } else {
      setLocation(`/clients/${id}?tab=${tab}`);
    }
  };

  // Fetch client (location) data
  const { data: client, isLoading: clientLoading, error: clientError } = useQuery<Client>({
    queryKey: ["/api/clients", id],
    enabled: Boolean(id),
  });

  // Fetch parent company if client has one
  const { data: parentCompany, isLoading: companyLoading } = useQuery<CustomerCompany>({
    queryKey: [`/api/customer-companies/${client?.parentCompanyId}`],
    enabled: Boolean(client?.parentCompanyId),
  });

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
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/reports")}>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/reports")} data-testid="button-back-to-clients">
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
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Building2 className="h-4 w-4 mr-2" />
            Overview
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

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Company Info Card */}
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

            {/* Primary Location Card */}
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

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={() => handleTabChange("locations")}>
                <MapPin className="h-4 w-4 mr-2" />
                Manage Locations
              </Button>
              <Button variant="outline" onClick={() => handleTabChange("parts")}>
                <Package className="h-4 w-4 mr-2" />
                View Parts
              </Button>
              <Link href={`/invoices/new?clientId=${id}`}>
                <Button>
                  <FileText className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations">
          <ClientLocationsTab 
            clientId={id!} 
            companyId={client.companyId}
            parentCompanyId={client.parentCompanyId || undefined}
          />
        </TabsContent>

        {/* Parts Tab (stub) */}
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

        {/* Notes Tab */}
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
