import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Edit } from "lucide-react";
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

interface EquipmentFormData {
  id?: string;
  name: string;
  modelNumber: string;
  serialNumber: string;
  notes: string;
}

export default function EquipmentDialog({ open, onClose, clientId, clientName }: EquipmentDialogProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentFormData | null>(null);

  const { data: equipment = [], refetch } = useQuery<Equipment[]>({
    queryKey: ['/api/clients', clientId, 'equipment'],
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (data: EquipmentFormData) => {
      const res = await apiRequest('POST', `/api/clients/${clientId}/equipment`, {
        name: data.name,
        modelNumber: data.modelNumber || null,
        serialNumber: data.serialNumber || null,
        notes: data.notes || null,
      });
      return await res.json();
    },
    onSuccess: () => {
      refetch();
      setShowForm(false);
      setEditingEquipment(null);
      toast({ title: "Success", description: "Equipment added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add equipment", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EquipmentFormData }) => {
      const res = await apiRequest('PUT', `/api/equipment/${id}`, {
        name: data.name,
        modelNumber: data.modelNumber || null,
        serialNumber: data.serialNumber || null,
        notes: data.notes || null,
      });
      return await res.json();
    },
    onSuccess: () => {
      refetch();
      setShowForm(false);
      setEditingEquipment(null);
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
      refetch();
      toast({ title: "Success", description: "Equipment deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete equipment", variant: "destructive" });
    },
  });

  const handleAdd = () => {
    setEditingEquipment({ name: '', modelNumber: '', serialNumber: '', notes: '' });
    setShowForm(true);
  };

  const handleEdit = (eq: Equipment) => {
    setEditingEquipment({
      id: eq.id,
      name: eq.name,
      modelNumber: eq.modelNumber || '',
      serialNumber: eq.serialNumber || '',
      notes: eq.notes || '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEquipment || !editingEquipment.name.trim()) return;

    if (editingEquipment.id) {
      updateMutation.mutate({ id: editingEquipment.id, data: editingEquipment });
    } else {
      createMutation.mutate(editingEquipment);
    }
  };

  const handleDelete = (equipmentId: string) => {
    if (confirm('Are you sure you want to delete this equipment?')) {
      deleteMutation.mutate(equipmentId);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingEquipment(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" data-testid="dialog-equipment">
        <DialogHeader>
          <DialogTitle>Equipment - {clientName}</DialogTitle>
          <DialogDescription>
            Manage equipment for this client
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-4 py-4">
            {!showForm && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAdd}
                  data-testid="button-add-equipment"
                  className="gap-2"
                >
                  <Plus className="h-3 w-3" />
                  Add Equipment
                </Button>
              </div>
            )}

            {showForm && editingEquipment && (
              <form onSubmit={handleSubmit} className="border rounded-md p-3 space-y-3" data-testid="form-equipment">
                <div className="space-y-2">
                  <Label htmlFor="equipment-name">Equipment Name *</Label>
                  <Input
                    id="equipment-name"
                    data-testid="input-equipment-name"
                    value={editingEquipment.name}
                    onChange={(e) => setEditingEquipment({ ...editingEquipment, name: e.target.value })}
                    placeholder="e.g., Rooftop Unit #1"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="equipment-model">Model #</Label>
                    <Input
                      id="equipment-model"
                      data-testid="input-equipment-model"
                      value={editingEquipment.modelNumber}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, modelNumber: e.target.value })}
                      placeholder="Model number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="equipment-serial">Serial #</Label>
                    <Input
                      id="equipment-serial"
                      data-testid="input-equipment-serial"
                      value={editingEquipment.serialNumber}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, serialNumber: e.target.value })}
                      placeholder="Serial number"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="equipment-notes">Notes</Label>
                  <Textarea
                    id="equipment-notes"
                    data-testid="input-equipment-notes"
                    value={editingEquipment.notes}
                    onChange={(e) => setEditingEquipment({ ...editingEquipment, notes: e.target.value })}
                    placeholder="Additional notes or details..."
                    rows={2}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingEquipment(null);
                    }}
                    data-testid="button-cancel-equipment"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    data-testid="button-save-equipment"
                    disabled={!editingEquipment.name.trim() || createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Equipment'}
                  </Button>
                </div>
              </form>
            )}

            {equipment.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Equipment List</Label>
                {equipment.map((eq, index) => (
                  <div
                    key={eq.id}
                    className="flex items-start gap-2 p-3 border rounded-md"
                    data-testid={`equipment-item-${index}`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium">{eq.name}</p>
                      {(eq.modelNumber || eq.serialNumber) && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {eq.modelNumber && <p>Model: {eq.modelNumber}</p>}
                          {eq.serialNumber && <p>Serial: {eq.serialNumber}</p>}
                        </div>
                      )}
                      {eq.notes && (
                        <p className="text-xs text-muted-foreground italic">{eq.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(eq)}
                        data-testid={`button-edit-equipment-${index}`}
                        disabled={showForm}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(eq.id)}
                        data-testid={`button-delete-equipment-${index}`}
                        disabled={showForm || deleteMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {equipment.length === 0 && !showForm && (
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
