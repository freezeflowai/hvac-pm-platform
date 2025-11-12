import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Pencil, Trash2, Wrench, Download } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
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

export interface Client {
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
  nextDue: Date;
}

interface ClientListTableProps {
  clients: Client[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function ClientListTable({ clients, onEdit, onDelete }: ClientListTableProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleDeleteClick = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (clientToDelete && !isDeleting) {
      setIsDeleting(true);
      try {
        await onDelete(clientToDelete.id);
        setDeleteDialogOpen(false);
        setClientToDelete(null);
      } catch (error) {
        // Error toast is already shown by the mutation, just keep dialog open
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const filteredClients = clients
    .filter(
      (client) =>
        client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.location && client.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.address && client.address.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => a.companyName.localeCompare(b.companyName));

  const getMonthsDisplay = (selectedMonths: number[]) => {
    return selectedMonths.map(m => MONTH_NAMES[m]).join(", ");
  };

  const handleEquipmentClick = (clientId: string) => {
    setLocation(`/equipment/${clientId}`);
  };

  const handleRowClick = (clientId: string) => {
    setLocation(`/client-report/${clientId}`);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const allData = await Promise.all(
        clients.map(async (client) => {
          const [partsRes, equipmentRes] = await Promise.all([
            fetch(`/api/clients/${client.id}/parts`, { credentials: 'include' }),
            fetch(`/api/clients/${client.id}/equipment`, { credentials: 'include' })
          ]);
          
          const parts = partsRes.ok ? await partsRes.json() : [];
          const equipment = equipmentRes.ok ? await equipmentRes.json() : [];
          
          return { client, parts, equipment };
        })
      );

      const csvRows: string[] = [];
      
      csvRows.push('Company Name,Location,Address,City,Province/State,Postal Code,Contact Name,Email,Phone,Roof/Ladder Code,Notes,Status,Maintenance Months,Next Due,Part Name,Part Quantity,Equipment Name,Model Number,Serial Number');
      
      allData.forEach(({ client, parts, equipment }) => {
        const companyName = `"${client.companyName.replace(/"/g, '""')}"`;
        const location = client.location ? `"${client.location.replace(/"/g, '""')}"` : '';
        const address = client.address ? `"${client.address.replace(/"/g, '""')}"` : '';
        const city = client.city ? `"${client.city.replace(/"/g, '""')}"` : '';
        const province = client.province ? `"${client.province.replace(/"/g, '""')}"` : '';
        const postalCode = client.postalCode ? `"${client.postalCode.replace(/"/g, '""')}"` : '';
        const contactName = client.contactName ? `"${client.contactName.replace(/"/g, '""')}"` : '';
        const email = client.email ? `"${client.email.replace(/"/g, '""')}"` : '';
        const phone = client.phone ? `"${client.phone.replace(/"/g, '""')}"` : '';
        const roofLadderCode = client.roofLadderCode ? `"${client.roofLadderCode.replace(/"/g, '""')}"` : '';
        const notes = client.notes ? `"${client.notes.replace(/"/g, '""')}"` : '';
        const status = client.inactive ? 'Inactive' : 'Active';
        const maintenanceMonths = `"${getMonthsDisplay(client.selectedMonths)}"`;
        const nextDue = client.inactive ? 'N/A' : format(new Date(client.nextDue), 'MMM d, yyyy');
        
        if (parts.length === 0 && equipment.length === 0) {
          csvRows.push(`${companyName},${location},${address},${city},${province},${postalCode},${contactName},${email},${phone},${roofLadderCode},${notes},${status},${maintenanceMonths},${nextDue},,,,,`);
        } else {
          const maxRows = Math.max(parts.length, equipment.length);
          for (let i = 0; i < maxRows; i++) {
            const part = parts[i];
            const equip = equipment[i];
            
            const partName = part ? `"${getPartDisplayName(part.part).replace(/"/g, '""')}"` : '';
            const partQty = part ? part.quantity : '';
            const equipName = equip ? `"${equip.name.replace(/"/g, '""')}"` : '';
            const modelNum = equip?.modelNumber ? `"${equip.modelNumber.replace(/"/g, '""')}"` : '';
            const serialNum = equip?.serialNumber ? `"${equip.serialNumber.replace(/"/g, '""')}"` : '';
            
            csvRows.push(`${companyName},${location},${address},${city},${province},${postalCode},${contactName},${email},${phone},${roofLadderCode},${notes},${status},${maintenanceMonths},${nextDue},${partName},${partQty},${equipName},${modelNum},${serialNum}`);
          }
        }
      });
      
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `clients-export-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export successful",
        description: `Exported ${clients.length} clients to CSV`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export client data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getPartDisplayName = (part: any): string => {
    if (part.type === 'filter' && part.filterType && part.size) {
      return `${part.filterType} Filter ${part.size}`;
    } else if (part.type === 'belt' && part.beltType && part.size) {
      return `Belt ${part.beltType}${part.size}`;
    } else if (part.name) {
      return part.name;
    }
    return 'Unknown Part';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>All Clients</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                data-testid="input-search-clients"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={isExporting || clients.length === 0}
              data-testid="button-export-csv"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Company</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Location</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Address</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Maintenance Months</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Next Due</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr 
                  key={client.id} 
                  className="border-b hover-elevate cursor-pointer"
                  data-testid={`row-client-${client.id}`}
                  onClick={() => handleRowClick(client.id)}
                >
                  <td className="py-3 px-4 text-sm font-medium" data-testid={`text-company-${client.id}`}>
                    {client.companyName}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`text-location-${client.id}`}>
                    {client.location || '—'}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`text-address-${client.id}`}>
                    {client.address || '—'}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <span className="text-muted-foreground">{getMonthsDisplay(client.selectedMonths)}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`text-next-due-${client.id}`}>
                    {client.inactive ? (
                      <Badge variant="secondary">Inactive</Badge>
                    ) : (
                      format(client.nextDue, "MMM d, yyyy")
                    )}
                  </td>
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEquipmentClick(client.id)}
                        data-testid={`button-equipment-${client.id}`}
                        title="Manage Equipment"
                      >
                        <Wrench className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(client.id)}
                        data-testid={`button-edit-client-${client.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClick(client)}
                        data-testid={`button-delete-client-${client.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-4">
          {filteredClients.map((client) => (
            <Card key={client.id} data-testid={`card-client-${client.id}`} className="cursor-pointer" onClick={() => handleRowClick(client.id)}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{client.companyName}</div>
                      {client.location && <div className="text-sm text-muted-foreground">{client.location}</div>}
                      {client.address && <div className="text-sm text-muted-foreground">{client.address}</div>}
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEquipmentClick(client.id)}
                        data-testid={`button-equipment-${client.id}`}
                        title="Manage Equipment"
                      >
                        <Wrench className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(client.id)}
                        data-testid={`button-edit-client-${client.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClick(client)}
                        data-testid={`button-delete-client-${client.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">{getMonthsDisplay(client.selectedMonths)}</span>
                    <span className="text-sm text-muted-foreground">
                      {client.inactive ? (
                        <Badge variant="secondary">Inactive</Badge>
                      ) : (
                        format(client.nextDue, "MMM d, yyyy")
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {filteredClients.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No clients found
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-client">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {clientToDelete?.companyName}? This will remove all their maintenance records and parts assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete" disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
