import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Pencil, Package, Wrench } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import EditClientDialog from "./EditClientDialog";

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

interface ClientReportDialogProps {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export default function ClientReportDialog({ clientId, open, onOpenChange }: ClientReportDialogProps) {
  const [, setLocation] = useLocation();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: reportData, isLoading } = useQuery<ClientReportData>({
    queryKey: ['/api/clients', clientId, 'report'],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/report`, {
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch client report: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!clientId && open,
    retry: false,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleEdit = () => {
    if (reportData?.client) {
      setEditDialogOpen(true);
    }
  };

  const handleEditSaved = (clientId: string) => {
    setEditDialogOpen(false);
    onOpenChange(false);
  };

  const handleManageParts = () => {
    if (clientId) {
      onOpenChange(false);
      setLocation(`/clients/${clientId}/parts`);
    }
  };

  const handleManageEquipment = () => {
    if (clientId) {
      onOpenChange(false);
      setLocation(`/clients/${clientId}/equipment`);
    }
  };

  if (!clientId) return null;

  const { client, parts = [], equipment = [] } = reportData || {};
  const pmMonths = client?.selectedMonths.map(m => MONTH_NAMES[m]).join(", ") || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">Client Report</DialogTitle>
            <div className="flex gap-1">
              <Button onClick={handleEdit} size="sm" variant="outline" data-testid="button-edit" className="gap-1 h-7 text-xs">
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              <Button onClick={handleManageParts} size="sm" variant="outline" data-testid="button-manage-parts" className="gap-1 h-7 text-xs">
                <Package className="h-3 w-3" />
                Parts
              </Button>
              <Button onClick={handleManageEquipment} size="sm" variant="outline" data-testid="button-manage-equipment" className="gap-1 h-7 text-xs">
                <Wrench className="h-3 w-3" />
                Equipment
              </Button>
              <Button onClick={handlePrint} data-testid="button-print" size="sm" className="gap-1 h-7 text-xs">
                <Printer className="h-3 w-3" />
                Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-4">
            <p className="text-center text-muted-foreground text-sm">Loading report...</p>
          </div>
        ) : client ? (
          <div className="space-y-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1.5">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Company Name</p>
                    <p className="text-xs font-semibold" data-testid="text-company-name">{client.companyName}</p>
                  </div>
                  {client.location && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Location Name</p>
                      <p className="text-xs" data-testid="text-location">{client.location}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Status</p>
                    <p className="text-xs" data-testid="text-status">
                      {client.inactive ? "Inactive (On-Call)" : "Active"}
                    </p>
                  </div>
                  {!client.inactive && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Next Maintenance Due</p>
                      <p className="text-xs" data-testid="text-next-due">
                        {format(new Date(client.nextDue), "MMMM d, yyyy")}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="pt-1.5 border-t">
                  <p className="text-xs font-semibold mb-1.5">Contact Information</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1.5">
                    {client.address && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Address</p>
                        <p className="text-xs" data-testid="text-address">{client.address}</p>
                      </div>
                    )}
                    {client.city && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">City</p>
                        <p className="text-xs" data-testid="text-city">{client.city}</p>
                      </div>
                    )}
                    {client.province && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Province/State</p>
                        <p className="text-xs" data-testid="text-province">{client.province}</p>
                      </div>
                    )}
                    {client.postalCode && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Postal/Zip Code</p>
                        <p className="text-xs" data-testid="text-postal-code">{client.postalCode}</p>
                      </div>
                    )}
                    {client.contactName && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Contact Name</p>
                        <p className="text-xs" data-testid="text-contact-name">{client.contactName}</p>
                      </div>
                    )}
                    {client.email && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Email</p>
                        <p className="text-xs" data-testid="text-email">{client.email}</p>
                      </div>
                    )}
                    {client.phone && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Phone</p>
                        <p className="text-xs" data-testid="text-phone">{client.phone}</p>
                      </div>
                    )}
                    {client.roofLadderCode && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Roof/Ladder Code</p>
                        <p className="text-xs" data-testid="text-roof-ladder-code">{client.roofLadderCode}</p>
                      </div>
                    )}
                    {client.notes && (
                      <div className="md:col-span-4">
                        <p className="text-xs font-medium text-muted-foreground">Notes</p>
                        <p className="text-xs" data-testid="text-notes">{client.notes}</p>
                      </div>
                    )}
                    {!client.address && !client.city && !client.province && !client.postalCode && 
                     !client.contactName && !client.email && !client.phone && !client.roofLadderCode && !client.notes && (
                      <p className="text-xs text-muted-foreground md:col-span-4">No contact information available</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Card>
                <CardHeader className="pb-1.5">
                  <CardTitle className="text-sm font-semibold">PM Schedule</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Scheduled Months</p>
                  <p className="text-xs" data-testid="text-pm-months">
                    {client.inactive ? "On-Call / As-Needed" : pmMonths}
                  </p>
                </CardContent>
              </Card>

              {parts.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-sm font-semibold">Parts Inventory</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1 px-2 text-xs font-medium text-muted-foreground">Part Name</th>
                            <th className="text-left py-1 px-2 text-xs font-medium text-muted-foreground">Type</th>
                            <th className="text-right py-1 px-2 text-xs font-medium text-muted-foreground">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parts.map((clientPart, index) => (
                            <tr key={clientPart.id} className="border-b" data-testid={`row-part-${index}`}>
                              <td className="py-1 px-2 text-xs">{getPartDisplayName(clientPart.part)}</td>
                              <td className="py-1 px-2 text-xs capitalize">{clientPart.part.type}</td>
                              <td className="py-1 px-2 text-xs text-right">{clientPart.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {equipment.length > 0 && (
              <Card>
                <CardHeader className="pb-1.5">
                  <CardTitle className="text-sm font-semibold">Equipment</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 px-2 text-xs font-medium text-muted-foreground">Equipment Name</th>
                          <th className="text-left py-1 px-2 text-xs font-medium text-muted-foreground">Model Number</th>
                          <th className="text-left py-1 px-2 text-xs font-medium text-muted-foreground">Serial Number</th>
                          <th className="text-left py-1 px-2 text-xs font-medium text-muted-foreground">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equipment.map((eq, index) => (
                          <tr key={eq.id} className="border-b" data-testid={`row-equipment-${index}`}>
                            <td className="py-1 px-2 text-xs font-medium">{eq.name}</td>
                            <td className="py-1 px-2 text-xs">{eq.modelNumber || '—'}</td>
                            <td className="py-1 px-2 text-xs">{eq.serialNumber || '—'}</td>
                            <td className="py-1 px-2 text-xs">{eq.notes || '—'}</td>
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
                <CardContent className="p-3 text-center text-xs text-muted-foreground">
                  No parts or equipment assigned to this client yet.
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="p-4">
            <p className="text-center text-muted-foreground text-sm">Client not found</p>
          </div>
        )}
      </DialogContent>

      {reportData?.client && (
        <EditClientDialog
          client={reportData.client}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSaved={handleEditSaved}
        />
      )}
    </Dialog>
  );
}
