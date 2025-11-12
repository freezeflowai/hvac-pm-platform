import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
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
  location: string;
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

  const { data: reportData, isLoading } = useQuery<ClientReportData>({
    queryKey: ['/api/clients', clientId, 'report'],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/report`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch client report');
      }
      return res.json();
    },
    enabled: !!clientId,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    setLocation("/?tab=clients");
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-center text-muted-foreground">Loading report...</p>
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
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Client Report</h1>
          </div>
          <Button onClick={handlePrint} data-testid="button-print" className="gap-2">
            <Printer className="h-4 w-4" />
            Print Report
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Company Name</p>
                <p className="text-lg font-semibold" data-testid="text-company-name">{client.companyName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <p className="text-lg" data-testid="text-location">{client.location}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p className="text-lg" data-testid="text-status">
                  {client.inactive ? "Inactive (On-Call)" : "Active"}
                </p>
              </div>
              {!client.inactive && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Next Maintenance Due</p>
                  <p className="text-lg" data-testid="text-next-due">
                    {format(new Date(client.nextDue), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {client.address && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Address</p>
                  <p className="text-base" data-testid="text-address">{client.address}</p>
                </div>
              )}
              {client.city && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">City</p>
                  <p className="text-base" data-testid="text-city">{client.city}</p>
                </div>
              )}
              {client.province && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Province/State</p>
                  <p className="text-base" data-testid="text-province">{client.province}</p>
                </div>
              )}
              {client.postalCode && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Postal/Zip Code</p>
                  <p className="text-base" data-testid="text-postal-code">{client.postalCode}</p>
                </div>
              )}
              {client.contactName && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contact Name</p>
                  <p className="text-base" data-testid="text-contact-name">{client.contactName}</p>
                </div>
              )}
              {client.email && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base" data-testid="text-email">{client.email}</p>
                </div>
              )}
              {client.phone && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="text-base" data-testid="text-phone">{client.phone}</p>
                </div>
              )}
              {client.roofLadderCode && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Roof/Ladder Code</p>
                  <p className="text-base" data-testid="text-roof-ladder-code">{client.roofLadderCode}</p>
                </div>
              )}
              {client.notes && (
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p className="text-base" data-testid="text-notes">{client.notes}</p>
                </div>
              )}
              {!client.address && !client.city && !client.province && !client.postalCode && 
               !client.contactName && !client.email && !client.phone && !client.roofLadderCode && !client.notes && (
                <p className="text-sm text-muted-foreground md:col-span-2">No contact information available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">PM Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-muted-foreground mb-2">Scheduled Maintenance Months</p>
            <p className="text-lg" data-testid="text-pm-months">
              {client.inactive ? "On-Call / As-Needed" : pmMonths}
            </p>
          </CardContent>
        </Card>

        {parts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Parts Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Part Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((clientPart, index) => (
                      <tr key={clientPart.id} className="border-b" data-testid={`row-part-${index}`}>
                        <td className="py-3 px-4 text-sm">{getPartDisplayName(clientPart.part)}</td>
                        <td className="py-3 px-4 text-sm capitalize">{clientPart.part.type}</td>
                        <td className="py-3 px-4 text-sm text-right">{clientPart.quantity}</td>
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
            <CardHeader>
              <CardTitle className="text-xl">Equipment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Equipment Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Model Number</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Serial Number</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((eq, index) => (
                      <tr key={eq.id} className="border-b" data-testid={`row-equipment-${index}`}>
                        <td className="py-3 px-4 text-sm font-medium">{eq.name}</td>
                        <td className="py-3 px-4 text-sm">{eq.modelNumber || '—'}</td>
                        <td className="py-3 px-4 text-sm">{eq.serialNumber || '—'}</td>
                        <td className="py-3 px-4 text-sm">{eq.notes || '—'}</td>
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
            <CardContent className="p-8 text-center text-muted-foreground">
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
