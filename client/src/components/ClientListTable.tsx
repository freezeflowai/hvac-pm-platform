import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Pencil, Trash2, Wrench, Download, Package, Upload, Info } from "lucide-react";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { format, parse } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  createdAt?: string;
}

interface ClientListTableProps {
  clients: Client[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onRefresh?: () => void;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function ClientListTable({ clients, onEdit, onDelete, onRefresh }: ClientListTableProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest('POST', '/api/clients/bulk-delete', { ids });
      return res.json();
    },
    onSuccess: (data) => {
      const { deletedCount, notFoundCount, deletedIds } = data;
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      deletedIds.forEach((id: string) => {
        queryClient.invalidateQueries({ queryKey: ['/api/clients', id] });
        queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'parts'] });
        queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'equipment'] });
      });
      
      if (deletedCount > 0) {
        toast({
          title: "Clients deleted",
          description: `Successfully deleted ${deletedCount} client${deletedCount > 1 ? 's' : ''}. All associated parts, equipment, and maintenance records have been removed.`,
        });
      }
      
      if (notFoundCount > 0) {
        toast({
          title: "Warning",
          description: `${notFoundCount} client${notFoundCount > 1 ? 's were' : ' was'} not found`,
          variant: "destructive",
        });
      }
      
      setSelectedIds(new Set());
      setBulkDeleteDialogOpen(false);
      if (onRefresh) onRefresh();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete clients",
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredClients.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDeleteClick = () => {
    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

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

  const handlePartsClick = (clientId: string) => {
    setLocation(`/clients/${clientId}/parts`);
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
      
      csvRows.push('Row Type,Company Name,Location,Address,City,Province/State,Postal Code,Contact Name,Email,Phone,Roof/Ladder Code,Notes,Status,Maintenance Months,Part Name,Part Quantity,Equipment Name,Model Number,Serial Number');
      
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
        
        if (parts.length === 0 && equipment.length === 0) {
          csvRows.push(`MAIN,${companyName},${location},${address},${city},${province},${postalCode},${contactName},${email},${phone},${roofLadderCode},${notes},${status},${maintenanceMonths},,,,,`);
        } else {
          const maxRows = Math.max(parts.length, equipment.length);
          for (let i = 0; i < maxRows; i++) {
            const part = parts[i];
            const equip = equipment[i];
            
            const rowType = i === 0 ? 'MAIN' : 'ADDITIONAL';
            const partName = part ? `"${getPartDisplayName(part.part).replace(/"/g, '""')}"` : '';
            const partQty = part ? part.quantity : '';
            const equipName = equip ? `"${equip.name.replace(/"/g, '""')}"` : '';
            const modelNum = equip?.modelNumber ? `"${equip.modelNumber.replace(/"/g, '""')}"` : '';
            const serialNum = equip?.serialNumber ? `"${equip.serialNumber.replace(/"/g, '""')}"` : '';
            
            csvRows.push(`${rowType},${companyName},${location},${address},${city},${province},${postalCode},${contactName},${email},${phone},${roofLadderCode},${notes},${status},${maintenanceMonths},${partName},${partQty},${equipName},${modelNum},${serialNum}`);
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

  const handleImportClick = () => {
    setImportDialogOpen(true);
  };

  const handleProceedWithImport = () => {
    setImportDialogOpen(false);
    fileInputRef.current?.click();
  };

  const parseMonthsFromString = (monthsStr: string): number[] => {
    if (!monthsStr) return [];
    const monthNames = monthsStr.split(',').map(m => m.trim());
    return monthNames.map(name => MONTH_NAMES.indexOf(name)).filter(idx => idx !== -1);
  };

  const calculateNextDue = (selectedMonths: number[]): string => {
    if (selectedMonths.length === 0) {
      return format(new Date(), 'yyyy-MM-dd');
    }

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Sort months to find the next one
    const sortedMonths = [...selectedMonths].sort((a, b) => a - b);
    
    // Find the next month that's >= current month
    let nextMonth = sortedMonths.find(m => m >= currentMonth);
    let year = currentYear;
    
    // If no month found in current year, take the first month of next year
    if (nextMonth === undefined) {
      nextMonth = sortedMonths[0];
      year = currentYear + 1;
    }
    
    // Set to 15th of the month
    const nextDueDate = new Date(year, nextMonth, 15);
    
    // If the date is today or in the past, find the next occurrence
    if (nextDueDate <= today) {
      const nextMonthIndex = sortedMonths.indexOf(nextMonth) + 1;
      if (nextMonthIndex < sortedMonths.length) {
        nextMonth = sortedMonths[nextMonthIndex];
      } else {
        nextMonth = sortedMonths[0];
        year = year + 1;
      }
      nextDueDate.setFullYear(year);
      nextDueDate.setMonth(nextMonth);
    }
    
    return format(nextDueDate, 'yyyy-MM-dd');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      
      if (lines.length < 2) {
        toast({
          title: "Import failed",
          description: "CSV file is empty or has no data rows",
          variant: "destructive",
        });
        return;
      }

      // Skip header row
      const dataLines = lines.slice(1);
      const clientsToImport: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        // Parse CSV properly handling quoted fields
        const fields: string[] = [];
        let currentField = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            if (inQuotes && line[j + 1] === '"') {
              currentField += '"';
              j++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            fields.push(currentField);
            currentField = '';
          } else {
            currentField += char;
          }
        }
        fields.push(currentField);

        // Expected format: Company Name, Location, Address, City, Province/State, Postal, Contact, Email, Phone, Roof/Ladder, Notes
        const [companyName, location, address, city, provinceState, postalCode, contactName, email, phone, roofLadderCode, notes] = fields;

        if (!companyName || !companyName.trim()) {
          errors.push(`Row ${i + 2}: Company name is required`);
          continue;
        }

        // Default to empty month selection and inactive status for new imports
        // Users can set these later via the UI
        const selectedMonths: number[] = [];
        const nextDue = format(new Date(), 'yyyy-MM-dd');

        clientsToImport.push({
          companyName: companyName.trim(),
          location: location?.trim() || null,
          address: address?.trim() || null,
          city: city?.trim() || null,
          province: provinceState?.trim() || null,
          postalCode: postalCode?.trim() || null,
          contactName: contactName?.trim() || null,
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          roofLadderCode: roofLadderCode?.trim() || null,
          notes: notes?.trim() || null,
          inactive: true,
          selectedMonths,
          nextDue,
        });
      }

      if (errors.length > 0 && clientsToImport.length === 0) {
        toast({
          title: "Import failed",
          description: `No valid clients found. Errors: ${errors.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      // Send to backend
      const res = await apiRequest('POST', '/api/clients/import', { clients: clientsToImport });
      const result = await res.json();

      let description = `Successfully imported ${result.imported} of ${result.total} clients`;
      if (errors.length > 0) {
        description += `. ${errors.length} rows had validation errors`;
      }
      if (result.errors && result.errors.length > 0) {
        description += `. ${result.errors.length} clients failed to save`;
      }

      toast({
        title: result.imported > 0 ? "Import completed" : "Import failed",
        description,
        variant: result.imported > 0 ? "default" : "destructive",
      });

      // Refresh client list
      if (result.imported > 0 && onRefresh) {
        onRefresh();
      } else if (result.imported > 0) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: "Failed to import clients. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
              data-testid="input-import-csv-file"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportClick}
              disabled={isImporting}
              data-testid="button-import-csv"
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {isImporting ? "Importing..." : "Import CSV"}
            </Button>
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
        {selectedIds.size > 0 && (
          <div className="mb-4 p-3 bg-muted rounded-md flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedIds.size} client{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDeleteClick}
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-bulk-delete-clients"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        )}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="w-12 py-3 px-4">
                  <Checkbox
                    checked={filteredClients.length > 0 && selectedIds.size === filteredClients.length}
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all-clients"
                  />
                </th>
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
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(client.id)}
                      onCheckedChange={(checked) => handleSelectOne(client.id, checked as boolean)}
                      data-testid={`checkbox-select-client-${client.id}`}
                    />
                  </td>
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
                        onClick={() => handlePartsClick(client.id)}
                        data-testid={`button-manage-parts-${client.id}`}
                        title="Manage Parts"
                      >
                        <Package className="h-3 w-3" />
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
                        onClick={() => handlePartsClick(client.id)}
                        data-testid={`button-manage-parts-${client.id}`}
                        title="Manage Parts"
                      >
                        <Package className="h-3 w-3" />
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

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-bulk-delete-clients">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Clients</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} client{selectedIds.size > 1 ? 's' : ''}? 
              This will remove all their maintenance records, equipment, and parts assignments. 
              This action cannot be undone.
              {selectedIds.size <= 5 && (
                <div className="mt-2">
                  <p className="font-medium">Clients to be deleted:</p>
                  <ul className="list-disc list-inside mt-1">
                    {Array.from(selectedIds).map(id => {
                      const client = clients.find(c => c.id === id);
                      return client ? <li key={id}>{client.companyName}</li> : null;
                    })}
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete" disabled={bulkDeleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDeleteConfirm}
              data-testid="button-confirm-bulk-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedIds.size} Client${selectedIds.size > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-import-format">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              CSV Import Format
            </DialogTitle>
            <DialogDescription>
              For accurate import, your CSV file should follow this structure
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md">
              <p className="text-sm font-medium mb-2">Required Format:</p>
              <code className="text-xs block bg-background p-3 rounded border overflow-x-auto whitespace-pre">
{`Company Name,Location,Address,City,Province/State,Postal,Contact,Email,Phone,Roof/Ladder,Notes`}
              </code>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Field Descriptions:</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li><strong>Company Name</strong> (required) - Client company name</li>
                <li><strong>Location</strong> (optional) - Location or branch name</li>
                <li><strong>Address</strong> (optional) - Street address</li>
                <li><strong>City</strong> (optional) - City name</li>
                <li><strong>Province/State</strong> (optional) - Province or state</li>
                <li><strong>Postal</strong> (optional) - Postal or ZIP code</li>
                <li><strong>Contact</strong> (optional) - Contact person name</li>
                <li><strong>Email</strong> (optional) - Contact email</li>
                <li><strong>Phone</strong> (optional) - Contact phone number</li>
                <li><strong>Roof/Ladder</strong> (optional) - Roof/ladder access code</li>
                <li><strong>Notes</strong> (optional) - Additional notes</li>
              </ul>
            </div>

            <div className="bg-muted p-4 rounded-md">
              <p className="text-sm font-medium mb-2">Example:</p>
              <code className="text-xs block bg-background p-3 rounded border overflow-x-auto whitespace-pre">
{`Company Name,Location,Address,City,Province/State,Postal,Contact,Email,Phone,Roof/Ladder,Notes
"ABC Corp",Downtown,"123 Main St",Toronto,ON,M5V 3A8,"John Doe",john@abc.com,416-555-0100,A-12,"VIP client"
"XYZ Ltd",,,Montreal,QC,H3B 4W8,,,,B-5,`}
              </code>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 rounded-md">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <strong>Note:</strong> Only Company Name is mandatory. All other fields are optional. 
                After import, you can edit clients to set maintenance schedules and add parts/equipment.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button
              onClick={handleProceedWithImport}
              data-testid="button-proceed-import"
            >
              <Upload className="h-4 w-4 mr-2" />
              Select CSV File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
