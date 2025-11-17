import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Pencil } from "lucide-react";
import { format } from "date-fns";
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
  type?: string | null;
  location?: string | null;
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

  if (!clientId) return null;

  const { client, parts = [], equipment = [] } = reportData || {};
  const pmMonths = client?.selectedMonths.map(m => MONTH_NAMES[m]).join(", ") || "";

  const hasContactInfo = client && (client.contactName || client.email || client.phone || client.address || client.city || client.province || client.postalCode || client.roofLadderCode || client.notes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Client Report</DialogTitle>
            <div className="flex gap-2">
              <Button onClick={handleEdit} size="default" variant="outline" data-testid="button-edit" className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button onClick={handlePrint} data-testid="button-print" size="default" variant="outline" className="gap-2 no-print">
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8">
            <p className="text-center text-muted-foreground">Loading report...</p>
          </div>
        ) : client ? (
          <div className="space-y-6 pt-2">
            {/* Client Information Section */}
            <div className="space-y-3">
              <h2 className="text-xl font-bold">Client Information</h2>
              <div className="grid grid-cols-3 gap-8">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Company Name</p>
                  <p className="text-base font-medium" data-testid="text-company-name">
                    {client.companyName}
                    {client.location && ` - ${client.location}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <p className="text-base font-medium" data-testid="text-status">
                    {client.inactive ? "Inactive (On-Call)" : "Active"}
                  </p>
                </div>
                {!client.inactive && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Next Maintenance Due</p>
                    <p className="text-base font-medium" data-testid="text-next-due">
                      {format(new Date(client.nextDue), "MMMM d, yyyy")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-3 border-t pt-6">
              <h2 className="text-xl font-bold">Contact Information</h2>
              {hasContactInfo ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {client.contactName && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Contact Name</p>
                      <p className="text-base" data-testid="text-contact-name">{client.contactName}</p>
                    </div>
                  )}
                  {client.email && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Email</p>
                      <p className="text-base" data-testid="text-email">{client.email}</p>
                    </div>
                  )}
                  {client.phone && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Phone</p>
                      <p className="text-base" data-testid="text-phone">{client.phone}</p>
                    </div>
                  )}
                  {client.address && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Address</p>
                      <p className="text-base" data-testid="text-address">{client.address}</p>
                    </div>
                  )}
                  {client.city && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">City</p>
                      <p className="text-base" data-testid="text-city">{client.city}</p>
                    </div>
                  )}
                  {client.province && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Province/State</p>
                      <p className="text-base" data-testid="text-province">{client.province}</p>
                    </div>
                  )}
                  {client.postalCode && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Postal/Zip Code</p>
                      <p className="text-base" data-testid="text-postal-code">{client.postalCode}</p>
                    </div>
                  )}
                  {client.roofLadderCode && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Roof/Ladder Code</p>
                      <p className="text-base" data-testid="text-roof-ladder-code">{client.roofLadderCode}</p>
                    </div>
                  )}
                  {client.notes && (
                    <div className="md:col-span-4">
                      <p className="text-sm text-muted-foreground mb-1">Notes</p>
                      <p className="text-base" data-testid="text-notes">{client.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-base text-muted-foreground">No contact information available</p>
              )}
            </div>

            {/* PM Schedule and Parts Inventory Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-6">
              <div className="space-y-3">
                <h2 className="text-xl font-bold">PM Schedule</h2>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Scheduled Months</p>
                  <p className="text-base" data-testid="text-pm-months">
                    {client.inactive ? "On-Call / As-Needed" : pmMonths}
                  </p>
                </div>
              </div>

              {parts.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xl font-bold">Parts Inventory</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 text-sm font-medium text-muted-foreground">Part Name</th>
                          <th className="text-left py-2 text-sm font-medium text-muted-foreground">Type</th>
                          <th className="text-right py-2 text-sm font-medium text-muted-foreground">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parts.map((clientPart, index) => (
                          <tr key={clientPart.id} className="border-b" data-testid={`row-part-${index}`}>
                            <td className="py-2 text-base">{getPartDisplayName(clientPart.part)}</td>
                            <td className="py-2 text-base capitalize">{clientPart.part.type}</td>
                            <td className="py-2 text-base text-right">{clientPart.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Equipment Section */}
            <div className="space-y-3 border-t pt-6">
              <h2 className="text-xl font-bold">Equipment</h2>
              {equipment.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-sm font-medium text-muted-foreground">Equipment Name</th>
                        <th className="text-left py-2 text-sm font-medium text-muted-foreground">Type</th>
                        <th className="text-left py-2 text-sm font-medium text-muted-foreground">Location</th>
                        <th className="text-left py-2 text-sm font-medium text-muted-foreground">Model Number</th>
                        <th className="text-left py-2 text-sm font-medium text-muted-foreground">Serial Number</th>
                        <th className="text-left py-2 text-sm font-medium text-muted-foreground">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipment.map((eq, index) => (
                        <tr key={eq.id} className="border-b" data-testid={`row-equipment-${index}`}>
                          <td className="py-2 text-base font-medium">{eq.name}</td>
                          <td className="py-2 text-base">{eq.type || '—'}</td>
                          <td className="py-2 text-base">{eq.location || '—'}</td>
                          <td className="py-2 text-base">{eq.modelNumber || '—'}</td>
                          <td className="py-2 text-base">{eq.serialNumber || '—'}</td>
                          <td className="py-2 text-base">{eq.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No equipment tracked for this client.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8">
            <p className="text-center text-muted-foreground">Client not found</p>
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
