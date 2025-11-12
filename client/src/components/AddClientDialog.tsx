import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Check, ChevronsUpDown, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";

export interface ClientFormData {
  companyName: string;
  location: string;
  selectedMonths: number[];
  inactive: boolean;
  parts: Array<{ partId: string; quantity: number }>;
}

export interface ClientPart {
  partId: string;
  type: string;
  filterType?: string | null;
  beltType?: string | null;
  size?: string | null;
  name?: string | null;
  description?: string | null;
  quantity: number;
}

export interface ClientEquipment {
  id?: string;
  name: string;
  modelNumber?: string;
  serialNumber?: string;
  notes?: string;
}

interface AddClientDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ClientFormData) => void;
  editData?: ClientFormData & { id: string };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getPartDisplay(part: Omit<ClientPart, 'quantity' | 'partId'>) {
  if (part.type === "filter") {
    return {
      primary: `${part.filterType} Filter`,
      secondary: part.size || ""
    };
  } else if (part.type === "belt") {
    return {
      primary: `${part.beltType} Belt`,
      secondary: part.size || ""
    };
  } else {
    return {
      primary: part.name || "",
      secondary: part.description || ""
    };
  }
}

interface PendingPart {
  partId: string;
  quantity: number;
  category: 'filter' | 'belt' | 'other';
}

interface EquipmentFormProps {
  equipment: ClientEquipment | null;
  onSave: (equipment: ClientEquipment) => void;
  onCancel: () => void;
}

function EquipmentForm({ equipment, onSave, onCancel }: EquipmentFormProps) {
  const [formData, setFormData] = useState<ClientEquipment>({
    id: equipment?.id,
    name: equipment?.name || '',
    modelNumber: equipment?.modelNumber || '',
    serialNumber: equipment?.serialNumber || '',
    notes: equipment?.notes || '',
  });

  // Sync form data when equipment prop changes
  useEffect(() => {
    setFormData({
      id: equipment?.id,
      name: equipment?.name || '',
      modelNumber: equipment?.modelNumber || '',
      serialNumber: equipment?.serialNumber || '',
      notes: equipment?.notes || '',
    });
  }, [equipment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-md p-3 space-y-3" data-testid="form-equipment">
      <div className="space-y-2">
        <Label htmlFor="equipment-name">Equipment Name *</Label>
        <Input
          id="equipment-name"
          data-testid="input-equipment-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
            value={formData.modelNumber || ''}
            onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
            placeholder="Model number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="equipment-serial">Serial #</Label>
          <Input
            id="equipment-serial"
            data-testid="input-equipment-serial"
            value={formData.serialNumber || ''}
            onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
            placeholder="Serial number"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="equipment-notes">Notes</Label>
        <Textarea
          id="equipment-notes"
          data-testid="input-equipment-notes"
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes or details..."
          rows={2}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          data-testid="button-cancel-equipment"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          data-testid="button-save-equipment"
          disabled={!formData.name.trim()}
        >
          Save Equipment
        </Button>
      </div>
    </form>
  );
}

interface PartCommandPickerProps {
  category: 'filter' | 'belt' | 'other';
  parts: Array<{ 
    id: string; 
    type: string; 
    filterType?: string | null;
    beltType?: string | null;
    size?: string | null;
    name?: string | null;
    description?: string | null;
  }>;
  value: string;
  onValueChange: (value: string) => void;
  testId?: string;
}

function PartCommandPicker({ category, parts, value, onValueChange, testId }: PartCommandPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedPart = parts.find(p => p.id === value);
  
  const selectedDisplay = selectedPart ? getPartDisplay(selectedPart) : null;

  const groupedParts = parts.reduce((acc, part) => {
    let groupKey = '';
    
    if (category === 'filter') {
      groupKey = part.filterType || 'Other';
    } else if (category === 'belt') {
      groupKey = part.beltType ? `${part.beltType} Belts` : 'Other';
    } else {
      groupKey = 'Parts';
    }
    
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(part);
    return acc;
  }, {} as Record<string, typeof parts>);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid={testId}
        >
          {selectedDisplay ? (
            <span className="truncate">
              {selectedDisplay.primary} - {selectedDisplay.secondary}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Search {category === 'filter' ? 'filters' : category === 'belt' ? 'belts' : 'parts'}...
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder={`Search ${category}...`} />
          <CommandList>
            <CommandEmpty>No {category} found.</CommandEmpty>
            {Object.entries(groupedParts).map(([groupName, groupParts]) => (
              <CommandGroup key={groupName} heading={groupName}>
                {groupParts.map((part) => {
                  const display = getPartDisplay(part);
                  return (
                    <CommandItem
                      key={part.id}
                      value={`${display.primary} ${display.secondary}`}
                      onSelect={() => {
                        onValueChange(part.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === part.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{display.primary}</div>
                        <div className="text-sm text-muted-foreground">{display.secondary}</div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function AddClientDialog({ open, onClose, onSubmit, editData }: AddClientDialogProps) {
  const [formData, setFormData] = useState({
    companyName: "",
    location: "",
    selectedMonths: [] as number[],
    inactive: false,
  });

  const [clientParts, setClientParts] = useState<ClientPart[]>([]);
  const [showAddPart, setShowAddPart] = useState(false);
  const [pendingParts, setPendingParts] = useState<PendingPart[]>([]);
  const addPartFormRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [equipment, setEquipment] = useState<ClientEquipment[]>([]);
  const [editingEquipment, setEditingEquipment] = useState<ClientEquipment | null>(null);
  const [showAddEquipment, setShowAddEquipment] = useState(false);

  const { data: availableParts = [] } = useQuery<Array<{ 
    id: string; 
    type: string; 
    filterType?: string | null;
    beltType?: string | null;
    size?: string | null;
    name?: string | null;
    description?: string | null;
  }>>({
    queryKey: ["/api/parts"],
  });

  // Group and sort parts by category
  const filterParts = availableParts
    .filter(p => p.type === 'filter')
    .sort((a, b) => {
      const typeCompare = (a.filterType || '').localeCompare(b.filterType || '');
      if (typeCompare !== 0) return typeCompare;
      return (a.size || '').localeCompare(b.size || '');
    });
  
  const beltParts = availableParts
    .filter(p => p.type === 'belt')
    .sort((a, b) => {
      const typeCompare = (a.beltType || '').localeCompare(b.beltType || '');
      if (typeCompare !== 0) return typeCompare;
      return (a.size || '').localeCompare(b.size || '');
    });
  
  const otherParts = availableParts
    .filter(p => p.type === 'other')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  useEffect(() => {
    const loadClientData = async () => {
      if (editData) {
        setFormData({
          companyName: editData.companyName,
          location: editData.location,
          selectedMonths: editData.selectedMonths,
          inactive: editData.inactive,
        });

        // Always fetch fresh parts data for this client from API
        try {
          const res = await fetch(`/api/clients/${editData.id}/parts`);
          if (res.ok) {
            const parts = await res.json();
            setClientParts(parts.map((cp: any) => ({
              partId: cp.part.id,
              type: cp.part.type,
              filterType: cp.part.filterType,
              beltType: cp.part.beltType,
              size: cp.part.size,
              name: cp.part.name,
              description: cp.part.description,
              quantity: cp.quantity,
            })));
          } else {
            setClientParts([]);
          }
        } catch (error) {
          console.error('Failed to load client parts', error);
          setClientParts([]);
        }

        // Load equipment data
        try {
          const res = await fetch(`/api/clients/${editData.id}/equipment`);
          if (res.ok) {
            const equipmentData = await res.json();
            setEquipment(equipmentData);
          } else {
            setEquipment([]);
          }
        } catch (error) {
          console.error('Failed to load client equipment', error);
          setEquipment([]);
        }
      } else {
        setFormData({
          companyName: "",
          location: "",
          selectedMonths: [],
          inactive: false,
        });
        setClientParts([]);
        setPendingParts([]);
        setEquipment([]);
      }
    };

    if (open) {
      loadClientData();
    } else {
      setPendingParts([]);
      setShowAddPart(false);
      setShowAddEquipment(false);
      setEditingEquipment(null);
    }
  }, [editData?.id, open]);

  useEffect(() => {
    if (showAddPart && addPartFormRef.current) {
      const scrollTimer = requestAnimationFrame(() => {
        addPartFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
      return () => cancelAnimationFrame(scrollTimer);
    }
  }, [showAddPart, pendingParts.length]);

  const toggleMonth = (monthIndex: number) => {
    setFormData(prev => ({
      ...prev,
      selectedMonths: prev.selectedMonths.includes(monthIndex)
        ? prev.selectedMonths.filter(m => m !== monthIndex)
        : [...prev.selectedMonths, monthIndex].sort((a, b) => a - b)
    }));
  };

  const handleAddRow = (category: 'filter' | 'belt' | 'other') => {
    setPendingParts(prev => [...prev, { partId: "", quantity: 1, category }]);
  };

  const handleRemovePendingPart = (index: number) => {
    setPendingParts(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePendingPart = (index: number, field: 'partId' | 'quantity', value: string | number) => {
    setPendingParts(prev => prev.map((part, i) => 
      i === index ? { ...part, [field]: value } : part
    ));
  };

  const handleAddAllParts = () => {
    const validParts = pendingParts.filter(p => p.partId && p.quantity > 0);
    
    if (validParts.length === 0) {
      return;
    }

    const newClientParts: ClientPart[] = [];
    
    for (const pending of validParts) {
      const selectedPart = availableParts.find(p => p.id === pending.partId);
      if (!selectedPart) continue;
      
      newClientParts.push({
        partId: selectedPart.id,
        type: selectedPart.type,
        filterType: selectedPart.filterType,
        beltType: selectedPart.beltType,
        size: selectedPart.size,
        name: selectedPart.name,
        description: selectedPart.description,
        quantity: pending.quantity,
      });
    }

    setClientParts(prev => [...prev, ...newClientParts]);
    setPendingParts([]);
    setShowAddPart(false);
  };

  const handleRemovePart = (index: number) => {
    setClientParts(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePartQuantity = (index: number, value: string) => {
    const quantity = Math.max(1, parseInt(value) || 1);
    setClientParts(prev => prev.map((part, i) => 
      i === index ? { ...part, quantity } : part
    ));
  };

  // Equipment handlers
  const handleSaveEquipment = async (equipmentData: ClientEquipment) => {
    if (!editData) {
      // For new clients, just add to local state
      if (editingEquipment && editingEquipment.id) {
        setEquipment(prev => prev.map(e => e.id === editingEquipment.id ? { ...equipmentData, id: editingEquipment.id } : e));
      } else {
        setEquipment(prev => [...prev, { ...equipmentData, id: `temp-${Date.now()}` }]);
      }
      setEditingEquipment(null);
      setShowAddEquipment(false);
      return;
    }

    // For existing clients, save to API
    try {
      if (editingEquipment && editingEquipment.id && !editingEquipment.id.startsWith('temp-')) {
        const res = await apiRequest('PUT', `/api/equipment/${editingEquipment.id}`, equipmentData);
        const updated = await res.json() as ClientEquipment;
        setEquipment(prev => prev.map(e => e.id === editingEquipment.id ? updated : e));
      } else {
        const res = await apiRequest('POST', `/api/clients/${editData.id}/equipment`, equipmentData);
        const created = await res.json() as ClientEquipment;
        setEquipment(prev => [...prev.filter(e => e.id !== editingEquipment?.id), created]);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/clients', editData.id, 'equipment'] });
      setEditingEquipment(null);
      setShowAddEquipment(false);
    } catch (error) {
      console.error('Failed to save equipment', error);
    }
  };

  const handleEditEquipment = (eq: ClientEquipment) => {
    setEditingEquipment(eq);
    setShowAddEquipment(true);
  };

  const handleDeleteEquipment = async (equipmentId: string) => {
    if (!editData || equipmentId.startsWith('temp-')) {
      setEquipment(prev => prev.filter(e => e.id !== equipmentId));
      return;
    }

    try {
      await apiRequest('DELETE', `/api/equipment/${equipmentId}`);
      setEquipment(prev => prev.filter(e => e.id !== equipmentId));
      queryClient.invalidateQueries({ queryKey: ['/api/clients', editData.id, 'equipment'] });
    } catch (error) {
      console.error('Failed to delete equipment', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.inactive && formData.selectedMonths.length === 0) {
      return;
    }

    try {
      const partsWithIds = clientParts.map(part => ({
        partId: part.partId,
        quantity: part.quantity,
      }));

      onSubmit({
        ...formData,
        parts: partsWithIds,
      });

      setFormData({ companyName: "", location: "", selectedMonths: [], inactive: false });
      setClientParts([]);
      onClose();
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Failed to save client. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" data-testid="dialog-add-client">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          <DialogDescription>
            {editData ? 'Update client information and required parts.' : 'Add a new client with their maintenance schedule and required parts.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  data-testid="input-company-name"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Enter company name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  data-testid="input-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter location or address"
                  required
                />
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Maintenance Months</Label>
                <p className="text-sm text-muted-foreground">Select which months require maintenance</p>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {MONTHS.map((month, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Checkbox
                        id={`month-${index}`}
                        data-testid={`checkbox-month-${index}`}
                        checked={formData.selectedMonths.includes(index)}
                        onCheckedChange={() => toggleMonth(index)}
                      />
                      <label
                        htmlFor={`month-${index}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {month}
                      </label>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center space-x-2 pt-3">
                  <Checkbox
                    id="inactive"
                    data-testid="checkbox-inactive"
                    checked={formData.inactive}
                    onCheckedChange={(checked) => setFormData({ ...formData, inactive: checked === true })}
                  />
                  <label
                    htmlFor="inactive"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Inactive (on-call/as-needed basis)
                  </label>
                </div>

                {!formData.inactive && formData.selectedMonths.length === 0 && (
                  <p className="text-sm text-destructive">Please select at least one month or mark as Inactive</p>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Required Parts</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddPart(true)}
                    data-testid="button-add-part"
                    className="gap-2"
                  >
                    <Plus className="h-3 w-3" />
                    Add Part
                  </Button>
                </div>

                {showAddPart && (
                  <div ref={addPartFormRef} className="border rounded-md p-3 space-y-4">
                    {availableParts.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">No parts in inventory yet.</p>
                        <p className="text-xs text-muted-foreground mt-1">Go to Parts Management to add parts first.</p>
                      </div>
                    ) : (
                      <>
                        {filterParts.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-base font-semibold">Filters</Label>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddRow('filter')}
                                data-testid="button-add-row-filter"
                                className="gap-2"
                              >
                                <Plus className="h-3 w-3" />
                                Add Row
                              </Button>
                            </div>
                            {pendingParts.filter(p => p.category === 'filter').map((pending, categoryIndex) => {
                              const globalIndex = pendingParts.findIndex(p => p === pending);
                              return (
                                <div key={globalIndex} className="flex items-center gap-2" data-testid={`pending-part-row-${globalIndex}`}>
                                  <div className="flex-1">
                                    <PartCommandPicker
                                      category="filter"
                                      parts={filterParts}
                                      value={pending.partId}
                                      onValueChange={(value) => handleUpdatePendingPart(globalIndex, 'partId', value)}
                                      testId={`select-pending-part-${globalIndex}`}
                                    />
                                  </div>
                                  <div className="w-24">
                                    <Input
                                      type="number"
                                      min="1"
                                      placeholder="Qty"
                                      data-testid={`input-pending-quantity-${globalIndex}`}
                                      value={pending.quantity}
                                      onChange={(e) => handleUpdatePendingPart(globalIndex, 'quantity', parseInt(e.target.value) || 1)}
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemovePendingPart(globalIndex)}
                                    data-testid={`button-remove-pending-${globalIndex}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {beltParts.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-base font-semibold">Belts</Label>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddRow('belt')}
                                data-testid="button-add-row-belt"
                                className="gap-2"
                              >
                                <Plus className="h-3 w-3" />
                                Add Row
                              </Button>
                            </div>
                            {pendingParts.filter(p => p.category === 'belt').map((pending, categoryIndex) => {
                              const globalIndex = pendingParts.findIndex(p => p === pending);
                              return (
                                <div key={globalIndex} className="flex items-center gap-2" data-testid={`pending-part-row-${globalIndex}`}>
                                  <div className="flex-1">
                                    <PartCommandPicker
                                      category="belt"
                                      parts={beltParts}
                                      value={pending.partId}
                                      onValueChange={(value) => handleUpdatePendingPart(globalIndex, 'partId', value)}
                                      testId={`select-pending-part-${globalIndex}`}
                                    />
                                  </div>
                                  <div className="w-24">
                                    <Input
                                      type="number"
                                      min="1"
                                      placeholder="Qty"
                                      data-testid={`input-pending-quantity-${globalIndex}`}
                                      value={pending.quantity}
                                      onChange={(e) => handleUpdatePendingPart(globalIndex, 'quantity', parseInt(e.target.value) || 1)}
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemovePendingPart(globalIndex)}
                                    data-testid={`button-remove-pending-${globalIndex}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {otherParts.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-base font-semibold">Other Parts</Label>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddRow('other')}
                                data-testid="button-add-row-other"
                                className="gap-2"
                              >
                                <Plus className="h-3 w-3" />
                                Add Row
                              </Button>
                            </div>
                            {pendingParts.filter(p => p.category === 'other').map((pending, categoryIndex) => {
                              const globalIndex = pendingParts.findIndex(p => p === pending);
                              return (
                                <div key={globalIndex} className="flex items-center gap-2" data-testid={`pending-part-row-${globalIndex}`}>
                                  <div className="flex-1">
                                    <PartCommandPicker
                                      category="other"
                                      parts={otherParts}
                                      value={pending.partId}
                                      onValueChange={(value) => handleUpdatePendingPart(globalIndex, 'partId', value)}
                                      testId={`select-pending-part-${globalIndex}`}
                                    />
                                  </div>
                                  <div className="w-24">
                                    <Input
                                      type="number"
                                      min="1"
                                      placeholder="Qty"
                                      data-testid={`input-pending-quantity-${globalIndex}`}
                                      value={pending.quantity}
                                      onChange={(e) => handleUpdatePendingPart(globalIndex, 'quantity', parseInt(e.target.value) || 1)}
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemovePendingPart(globalIndex)}
                                    data-testid={`button-remove-pending-${globalIndex}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddPart(false);
                          setPendingParts([]);
                        }}
                        data-testid="button-cancel-part"
                      >
                        Cancel
                      </Button>
                      {availableParts.length > 0 && pendingParts.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddAllParts}
                          data-testid="button-save-parts"
                          disabled={!pendingParts.some(p => p.partId && p.quantity > 0)}
                        >
                          Add Parts
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {clientParts.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Current Parts</Label>
                    {clientParts.map((part, index) => {
                      const display = getPartDisplay(part);
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 border rounded-md"
                          data-testid={`part-item-${index}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{display.primary}</p>
                            {display.secondary && (
                              <p className="text-xs text-muted-foreground">
                                {display.secondary}
                              </p>
                            )}
                          </div>
                          <Input
                            type="number"
                            min="1"
                            value={part.quantity}
                            onChange={(e) => handleUpdatePartQuantity(index, e.target.value)}
                            className="w-20"
                            data-testid={`input-quantity-${index}`}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemovePart(index)}
                            data-testid={`button-remove-part-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {clientParts.length === 0 && !showAddPart && (
                  <p className="text-sm text-muted-foreground">No parts added yet. Click "Add Part" to add required parts.</p>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Equipment
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingEquipment({ name: '', modelNumber: '', serialNumber: '', notes: '' });
                      setShowAddEquipment(true);
                    }}
                    data-testid="button-add-equipment"
                    className="gap-2"
                  >
                    <Plus className="h-3 w-3" />
                    Add Equipment
                  </Button>
                </div>

                {showAddEquipment && (
                  <EquipmentForm
                    equipment={editingEquipment}
                    onSave={handleSaveEquipment}
                    onCancel={() => {
                      setShowAddEquipment(false);
                      setEditingEquipment(null);
                    }}
                  />
                )}

                {equipment.length > 0 && (
                  <div className="space-y-2">
                    {equipment.map((eq, index) => (
                      <div
                        key={eq.id || index}
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
                            onClick={() => handleEditEquipment(eq)}
                            data-testid={`button-edit-equipment-${index}`}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteEquipment(eq.id!)}
                            data-testid={`button-delete-equipment-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {equipment.length === 0 && !showAddEquipment && (
                  <p className="text-sm text-muted-foreground">No equipment added yet. Click "Add Equipment" to track client equipment.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              data-testid="button-save-client"
              disabled={!formData.inactive && formData.selectedMonths.length === 0}
            >
              {editData ? 'Update Client' : 'Save Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
