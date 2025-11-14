import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Pencil, Package, Wrench } from "lucide-react";
import { format } from "date-fns";

interface Part {
  id: string;
  type: string;
  filterType?: string | null;
  beltType?: string | null;
  size?: string | null;
  name?: string | null;
  description?: string | null;
}

interface ClientPart {
  id: string;
  clientId: string;
  partId: string;
  quantity: number;
  part: Part;
}

interface Equipment {
  id: string;
  clientId: string;
  name: string;
  modelNumber?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
}

interface Client {
  id: string;
  companyName: string;
  location?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  roofLadderCode?: string | null;
  notes?: string | null;
  selectedMonths: number[];
  inactive: boolean;
  nextDue: string;
}

interface ClientReportData {
  client: Client;
  parts: ClientPart[];
  equipment: Equipment[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const getPartDisplayName = (part: Part): string => {
  if (part.type === 'filter' && part.filterType && part.size) {
    return `${part.filterType} Filter ${part.size}`;
  } else if (part.type === 'belt' && part.beltType && part.size) {
    return `Belt ${part.beltType}${part.size}`;
  } else if (part.name) {
    return part.name;
  }
  return 'Unknown Part';
};

export default function ClientReportPage() {
  const [, params] = useRoute("/client-report/:clientId");
  const [, setLocation] = useLocation();
  const clientId = params?.clientId || "";

  const { data: reportData, isLoading, error } = useQuery<ClientReportData>({
    queryKey: ['/api/clients', clientId, 'report'],
    queryFn: async () => {
      console.log('[ClientReport] Fetching report for clientId:', clientId);
      const res = await fetch(`/api/clients/${clientId}/report`, {
        credentials: 'include',
      });
      console.log('[ClientReport] Response status:', res.status, 'OK:', res.ok);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[ClientReport] Error response:', res.status, errorText);
        
        if (res.status === 401) {
          const err = new Error('Not authenticated');
          (err as any).statusCode = 401;
          throw err;
        }
        if (res.status === 404) {
          const err = new Error('Client not found');
          (err as any).statusCode = 404;
          throw err;
        }
        throw new Error(`Failed to fetch client report: ${res.status}`);
      }
      const data = await res.json();
      console.log('[ClientReport] Successfully loaded report for:', data.client?.companyName);
      return data;
    },
    enabled: !!clientId,
    retry: false,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    setLocation("/?tab=clients");
  };

  const handleEdit = () => {
    setLocation(`/edit-client/${clientId}`);
  };

  const handleManageParts = () => {
    setLocation(`/clients/${clientId}/parts`);
  };

  const handleManageEquipment = () => {
    setLocation(`/clients/${clientId}/equipment`);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-center text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  if (error) {
    const statusCode = (error as any)?.statusCode;
    console.error('[ClientReport] Displaying error:', statusCode, error.message);
    
    if (statusCode === 401) {
      return (
        <div className="p-8 text-center space-y-4">
          <p className="text-muted-foreground">Authentication required</p>
          <Button onClick={() => setLocation("/login")} data-testid="button-login">
            Go to Login
          </Button>
        </div>
      );
    }
    
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">
          {statusCode === 404 ? 'Client not found' : 'Failed to load report'}
        </p>
        <Button onClick={handleBack} variant="outline" data-testid="button-back-error">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="p-8">
        <p className="text-center text-muted-foreground">Client not found</p>
      </div>
    );
  }

  const { client, parts, equipment } = reportData;
  const pmMonths = client.selectedMonths.map(m => MONTH_NAMES[m]).join(", ");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Client Report</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleEdit} size="sm" variant="outline" data-testid="button-edit" className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button onClick={handleManageParts} size="sm" variant="outline" data-testid="button-manage-parts" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Parts
            </Button>
            <Button onClick={handleManageEquipment} size="sm" variant="outline" data-testid="button-manage-equipment" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              Equipment
            </Button>
            <Button onClick={handlePrint} data-testid="button-print" size="sm" className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Company Name</p>
                <p className="text-sm font-semibold" data-testid="text-company-name">{client.companyName}</p>
              </div>
              {client.location && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Location Name</p>
                  <p className="text-sm" data-testid="text-location">{client.location}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                <p className="text-sm" data-testid="text-status">
                  {client.inactive ? "Inactive (On-Call)" : "Active"}
                </p>
              </div>
              {!client.inactive && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Next Maintenance Due</p>
                  <p className="text-sm" data-testid="text-next-due">
                    {format(new Date(client.nextDue), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
            </div>
            
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold mb-2">Contact Information</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                {client.address && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Address</p>
                    <p className="text-sm" data-testid="text-address">{client.address}</p>
                  </div>
                )}
                {client.city && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">City</p>
                    <p className="text-sm" data-testid="text-city">{client.city}</p>
                  </div>
                )}
                {client.province && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Province/State</p>
                    <p className="text-sm" data-testid="text-province">{client.province}</p>
                  </div>
                )}
                {client.postalCode && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Postal/Zip Code</p>
                    <p className="text-sm" data-testid="text-postal-code">{client.postalCode}</p>
                  </div>
                )}
                {client.contactName && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Contact Name</p>
                    <p className="text-sm" data-testid="text-contact-name">{client.contactName}</p>
                  </div>
                )}
                {client.email && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Email</p>
                    <p className="text-sm" data-testid="text-email">{client.email}</p>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Phone</p>
                    <p className="text-sm" data-testid="text-phone">{client.phone}</p>
                  </div>
                )}
                {client.roofLadderCode && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Roof/Ladder Code</p>
                    <p className="text-sm" data-testid="text-roof-ladder-code">{client.roofLadderCode}</p>
                  </div>
                )}
                {client.notes && (
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground">Notes</p>
                    <p className="text-sm" data-testid="text-notes">{client.notes}</p>
                  </div>
                )}
                {!client.address && !client.city && !client.province && !client.postalCode && 
                 !client.contactName && !client.email && !client.phone && !client.roofLadderCode && !client.notes && (
                  <p className="text-xs text-muted-foreground md:col-span-2">No contact information available</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">PM Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground mb-1">Scheduled Maintenance Months</p>
            <p className="text-sm" data-testid="text-pm-months">
              {client.inactive ? "On-Call / As-Needed" : pmMonths}
            </p>
          </CardContent>
        </Card>

        {parts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Parts Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Part Name</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Type</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((clientPart, index) => (
                      <tr key={clientPart.id} className="border-b" data-testid={`row-part-${index}`}>
                        <td className="py-2 px-3 text-sm">{getPartDisplayName(clientPart.part)}</td>
                        <td className="py-2 px-3 text-sm capitalize">{clientPart.part.type}</td>
                        <td className="py-2 px-3 text-sm text-right">{clientPart.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {equipment.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Equipment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Equipment Name</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Model Number</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Serial Number</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((eq, index) => (
                      <tr key={eq.id} className="border-b" data-testid={`row-equipment-${index}`}>
                        <td className="py-2 px-3 text-sm font-medium">{eq.name}</td>
                        <td className="py-2 px-3 text-sm">{eq.modelNumber || '—'}</td>
                        <td className="py-2 px-3 text-sm">{eq.serialNumber || '—'}</td>
                        <td className="py-2 px-3 text-sm">{eq.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {parts.length === 0 && equipment.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No parts or equipment assigned to this client yet.
            </CardContent>
          </Card>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          table {
            page-break-inside: auto;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          thead {
            display: table-header-group;
          }
        }
      `}</style>
    </div>
  );
}
