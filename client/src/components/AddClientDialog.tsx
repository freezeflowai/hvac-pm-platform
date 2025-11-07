import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

export interface ClientFormData {
  companyName: string;
  location: string;
  selectedMonths: number[];
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
      primary: `Type ${part.beltType} Belt`,
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

export default function AddClientDialog({ open, onClose, onSubmit, editData }: AddClientDialogProps) {
  const [formData, setFormData] = useState({
    companyName: "",
    location: "",
    selectedMonths: [] as number[],
  });

  const [clientParts, setClientParts] = useState<ClientPart[]>([]);
  const [showAddPart, setShowAddPart] = useState(false);
  const [pendingParts, setPendingParts] = useState<PendingPart[]>([]);
  const addPartFormRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

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
    const loadClientParts = async () => {
      if (editData && !initializedRef.current) {
        setFormData({
          companyName: editData.companyName,
          location: editData.location,
          selectedMonths: editData.selectedMonths,
        });

        // Fetch the actual parts data for this client
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
          }
        } catch (error) {
          console.error('Failed to load client parts', error);
        }
        initializedRef.current = true;
      } else if (!editData && !initializedRef.current) {
        setFormData({
          companyName: "",
          location: "",
          selectedMonths: [],
        });
        setClientParts([]);
        setPendingParts([]);
        initializedRef.current = true;
      }
    };

    if (open) {
      loadClientParts();
    } else {
      initializedRef.current = false;
      setPendingParts([]);
      setShowAddPart(false);
    }
  }, [editData, open]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.selectedMonths.length === 0) {
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

      setFormData({ companyName: "", location: "", selectedMonths: [] });
      setClientParts([]);
      onClose();
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Failed to save client. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-add-client">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          <DialogDescription>
            {editData ? 'Update client information and required parts.' : 'Add a new client with their maintenance schedule and required parts.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[60vh] pr-4">
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
                {formData.selectedMonths.length === 0 && (
                  <p className="text-sm text-destructive pt-2">Please select at least one month</p>
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
                                    <Select
                                      value={pending.partId}
                                      onValueChange={(value) => handleUpdatePendingPart(globalIndex, 'partId', value)}
                                    >
                                      <SelectTrigger data-testid={`select-pending-part-${globalIndex}`}>
                                        <SelectValue placeholder="Choose a filter..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {filterParts.map((part) => {
                                          const display = getPartDisplay(part);
                                          return (
                                            <SelectItem key={part.id} value={part.id}>
                                              {display.primary} - {display.secondary}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
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
                                    <Select
                                      value={pending.partId}
                                      onValueChange={(value) => handleUpdatePendingPart(globalIndex, 'partId', value)}
                                    >
                                      <SelectTrigger data-testid={`select-pending-part-${globalIndex}`}>
                                        <SelectValue placeholder="Choose a belt..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {beltParts.map((part) => {
                                          const display = getPartDisplay(part);
                                          return (
                                            <SelectItem key={part.id} value={part.id}>
                                              {display.primary} - {display.secondary}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
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
                                    <Select
                                      value={pending.partId}
                                      onValueChange={(value) => handleUpdatePendingPart(globalIndex, 'partId', value)}
                                    >
                                      <SelectTrigger data-testid={`select-pending-part-${globalIndex}`}>
                                        <SelectValue placeholder="Choose a part..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {otherParts.map((part) => {
                                          const display = getPartDisplay(part);
                                          return (
                                            <SelectItem key={part.id} value={part.id}>
                                              {display.primary} - {display.secondary}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
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
                    {clientParts.map((part, index) => {
                      const display = getPartDisplay(part);
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 border rounded-md"
                          data-testid={`part-item-${index}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Badge variant="outline" className="shrink-0">
                              {part.quantity}x
                            </Badge>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{display.primary}</p>
                              {display.secondary && (
                                <p className="text-xs text-muted-foreground">
                                  {display.secondary}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemovePart(index)}
                            data-testid={`button-remove-part-${index}`}
                          >
                            <X className="h-3 w-3" />
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
            </div>
          </ScrollArea>
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
              disabled={formData.selectedMonths.length === 0}
            >
              {editData ? 'Update Client' : 'Save Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
