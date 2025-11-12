import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
}

interface EquipmentRow {
  id?: string;
  name: string;
  modelNumber: string;
  serialNumber: string;
  notes: string;
  isNew?: boolean;
  isModified?: boolean;
}

export default function EquipmentPage() {
  const [, params] = useRoute("/equipment/:clientId");
  const [, setLocation] = useLocation();
  const clientId = params?.clientId || "";
  const { toast } = useToast();
  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: client } = useQuery<Client>({
    queryKey: ['/api/clients', clientId],
    enabled: !!clientId,
  });

  const { data: equipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ['/api/clients', clientId, 'equipment'],
    enabled: !!clientId,
  });

  useEffect(() => {
    if (equipment.length > 0 && rows.length === 0) {
      setRows(equipment.map((eq: Equipment) => ({
        id: eq.id,
        name: eq.name,
        modelNumber: eq.modelNumber || '',
        serialNumber: eq.serialNumber || '',
        notes: eq.notes || '',
      })));
    }
  }, [equipment, rows.length]);

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
    updatedRows[index] = { 
      ...updatedRows[index], 
      [field]: value,
      isModified: !updatedRows[index].isNew 
    };
    setRows(updatedRows);
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

  const handleSaveAll = async () => {
    const newRows = rows.filter(r => r.isNew && r.name.trim());
    const modifiedRows = rows.filter(r => r.isModified && r.id && r.name.trim());

    if (newRows.length === 0 && modifiedRows.length === 0) {
      toast({ title: "No changes", description: "No changes to save" });
      return;
    }

    setIsSaving(true);

    try {
      for (const row of newRows) {
        await createMutation.mutateAsync(row);
      }

      for (const row of modifiedRows) {
        if (row.id) {
          await updateMutation.mutateAsync({ id: row.id, data: row });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'equipment'] });
      toast({ title: "Success", description: "All changes saved successfully" });
      
      const savedRows = rows.filter(r => r.name.trim()).map(r => ({
        ...r,
        isNew: false,
        isModified: false
      }));
      setRows(savedRows);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    setLocation("/");
  };

  const hasChanges = rows.some(r => r.isNew || r.isModified);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Equipment - {client?.companyName}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Equipment List</CardTitle>
            <div className="flex gap-2">
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
              {hasChanges && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveAll}
                  data-testid="button-save-all"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save All Changes'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Equipment Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Model Number</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Serial Number</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Notes</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr 
                        key={row.id || `new-${index}`} 
                        className="border-b hover-elevate"
                        data-testid={`row-equipment-${index}`}
                      >
                        <td className="py-3 px-4">
                          <Input
                            data-testid={`input-equipment-name-${index}`}
                            value={row.name}
                            onChange={(e) => handleUpdateRow(index, 'name', e.target.value)}
                            placeholder="Equipment name"
                            className="text-sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            data-testid={`input-equipment-model-${index}`}
                            value={row.modelNumber}
                            onChange={(e) => handleUpdateRow(index, 'modelNumber', e.target.value)}
                            placeholder="Model #"
                            className="text-sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            data-testid={`input-equipment-serial-${index}`}
                            value={row.serialNumber}
                            onChange={(e) => handleUpdateRow(index, 'serialNumber', e.target.value)}
                            placeholder="Serial #"
                            className="text-sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            data-testid={`input-equipment-notes-${index}`}
                            value={row.notes}
                            onChange={(e) => handleUpdateRow(index, 'notes', e.target.value)}
                            placeholder="Notes"
                            className="text-sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteRow(index)}
                            data-testid={`button-delete-equipment-${index}`}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-4">
                {rows.map((row, index) => (
                  <Card key={row.id || `new-${index}`} data-testid={`card-equipment-${index}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <Input
                          data-testid={`input-equipment-name-${index}`}
                          value={row.name}
                          onChange={(e) => handleUpdateRow(index, 'name', e.target.value)}
                          placeholder="Equipment name"
                          className="text-sm font-medium"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRow(index)}
                          data-testid={`button-delete-equipment-${index}`}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        data-testid={`input-equipment-model-${index}`}
                        value={row.modelNumber}
                        onChange={(e) => handleUpdateRow(index, 'modelNumber', e.target.value)}
                        placeholder="Model #"
                        className="text-sm"
                      />
                      <Input
                        data-testid={`input-equipment-serial-${index}`}
                        value={row.serialNumber}
                        onChange={(e) => handleUpdateRow(index, 'serialNumber', e.target.value)}
                        placeholder="Serial #"
                        className="text-sm"
                      />
                      <Input
                        data-testid={`input-equipment-notes-${index}`}
                        value={row.notes}
                        onChange={(e) => handleUpdateRow(index, 'notes', e.target.value)}
                        placeholder="Notes"
                        className="text-sm"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>

              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No equipment added yet. Click "Add Equipment" to start tracking equipment.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
