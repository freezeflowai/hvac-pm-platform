import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Pencil, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
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
  location: string;
  selectedMonths: number[];
  inactive: boolean;
  portalEnabled: boolean;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        client.location.toLowerCase().includes(searchTerm.toLowerCase())
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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>All Clients</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              data-testid="input-search-clients"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
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
                    {client.location}
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
                      <div className="text-sm text-muted-foreground">{client.location}</div>
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
