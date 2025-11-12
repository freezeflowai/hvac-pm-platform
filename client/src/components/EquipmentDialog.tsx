import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Save } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface Equipment {
  id: string;
  clientId: string;
  name: string;
  modelNumber?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
}

interface EquipmentDialogProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

interface EquipmentRow {
  id?: string;
  name: string;
  modelNumber: string;
  serialNumber: string;
  notes: string;
  isNew?: boolean;
}

export default function EquipmentDialog({ open, onClose, clientId, clientName }: EquipmentDialogProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<EquipmentRow[]>([]);

  const { data: equipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ['/api/clients', clientId, 'equipment'],
    enabled: open,
  });

  useEffect(() => {
    if (equipment.length > 0) {
      setRows(equipment.map((eq: Equipment) => ({
        id: eq.id,
        name: eq.name,
        modelNumber: eq.modelNumber || '',
        serialNumber: eq.serialNumber || '',
        notes: eq.notes || '',
      })));
    }
  }, [equipment]);

  const createMutation = useMutation({
    mutationFn: async (data: EquipmentRow) => {
      const payload = {
        clientId,
        name: data.name,
        modelNumber: data.modelNumber || null,
        serialNumber: data.serialNumber || null,
        notes: data.notes || null,
      };
      const res = await apiRequest('POST', `/api/clients/${clientId}/equipment`, payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'equipment'] });
      toast({ title: "Success", description: "Equipment added successfully" });
    },
    onError: (error: any) => {
      console.error('Failed to add equipment:', error);
      toast({ title: "Error", description: "Failed to add equipment", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EquipmentRow }) => {
      const payload = {
        name: data.name,
        modelNumber: data.modelNumber || null,
        serialNumber: data.serialNumber || null,
        notes: data.notes || null,
      };
      const res = await apiRequest('PUT', `/api/equipment/${id}`, payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'equipment'] });
      toast({ title: "Success", description: "Equipment updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update equipment", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (equipmentId: string) => {
      await apiRequest('DELETE', `/api/equipment/${equipmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'equipment'] });
      toast({ title: "Success", description: "Equipment deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete equipment", variant: "destructive" });
    },
  });

  const handleAddRow = () => {
    setRows([...rows, { name: '', modelNumber: '', serialNumber: '', notes: '', isNew: true }]);
  };

  const handleUpdateRow = (index: number, field: keyof EquipmentRow, value: string) => {
    const updatedRows = [...rows];
    updatedRows[index] = { ...updatedRows[index], [field]: value };
    setRows(updatedRows);
  };

  const handleSaveRow = (index: number) => {
    const row = rows[index];
    if (!row.name.trim()) {
      toast({ title: "Error", description: "Equipment name is required", variant: "destructive" });
      return;
    }

    if (row.isNew) {
      createMutation.mutate(row);
      const updatedRows = [...rows];
      updatedRows.splice(index, 1);
      setRows(updatedRows);
    } else if (row.id) {
      updateMutation.mutate({ id: row.id, data: row });
    }
  };

  const handleDeleteRow = (index: number) => {
    const row = rows[index];
    
    if (row.isNew) {
      const updatedRows = [...rows];
      updatedRows.splice(index, 1);
      setRows(updatedRows);
    } else if (row.id) {
      if (confirm('Are you sure you want to delete this equipment?')) {
        deleteMutation.mutate(row.id);
      }
    }
  };

  const handleClose = () => {
    setRows([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" data-testid="dialog-equipment">
        <DialogHeader>
          <DialogTitle>Equipment - {clientName}</DialogTitle>
          <DialogDescription>
            Add and manage equipment for this client
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 py-4">
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddRow}
                data-testid="button-add-equipment"
                className="gap-2"
              >
                <Plus className="h-3 w-3" />
                Add Equipment
              </Button>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : rows.length > 0 ? (
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div
                    key={row.id || `new-${index}`}
                    className="border rounded-md p-3 space-y-2"
                    data-testid={`equipment-row-${index}`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`equipment-name-${index}`} className="text-xs">
                          Equipment Name *
                        </Label>
                        <Input
                          id={`equipment-name-${index}`}
                          data-testid={`input-equipment-name-${index}`}
                          value={row.name}
                          onChange={(e) => handleUpdateRow(index, 'name', e.target.value)}
                          placeholder="e.g., Rooftop Unit #1"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`equipment-model-${index}`} className="text-xs">
                          Model #
                        </Label>
                        <Input
                          id={`equipment-model-${index}`}
                          data-testid={`input-equipment-model-${index}`}
                          value={row.modelNumber}
                          onChange={(e) => handleUpdateRow(index, 'modelNumber', e.target.value)}
                          placeholder="Model number"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`equipment-serial-${index}`} className="text-xs">
                          Serial #
                        </Label>
                        <Input
                          id={`equipment-serial-${index}`}
                          data-testid={`input-equipment-serial-${index}`}
                          value={row.serialNumber}
                          onChange={(e) => handleUpdateRow(index, 'serialNumber', e.target.value)}
                          placeholder="Serial number"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`equipment-notes-${index}`} className="text-xs">
                          Notes
                        </Label>
                        <Input
                          id={`equipment-notes-${index}`}
                          data-testid={`input-equipment-notes-${index}`}
                          value={row.notes}
                          onChange={(e) => handleUpdateRow(index, 'notes', e.target.value)}
                          placeholder="Additional notes..."
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      {row.isNew || row.id ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveRow(index)}
                            data-testid={`button-save-equipment-${index}`}
                            disabled={!row.name.trim() || createMutation.isPending || updateMutation.isPending}
                            className="gap-2"
                          >
                            <Save className="h-3 w-3" />
                            {row.isNew ? 'Save' : 'Update'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteRow(index)}
                            data-testid={`button-delete-equipment-${index}`}
                            disabled={deleteMutation.isPending}
                            className="gap-2"
                          >
                            <X className="h-3 w-3" />
                            {row.isNew ? 'Cancel' : 'Delete'}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No equipment added yet. Click "Add Equipment" to track client equipment.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            data-testid="button-close"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
