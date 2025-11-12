import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface ClientFormData {
  companyName: string;
  location: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  roofLadderCode?: string;
  notes?: string;
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
    address: "",
    city: "",
    province: "",
    postalCode: "",
    contactName: "",
    email: "",
    phone: "",
    roofLadderCode: "",
    notes: "",
    selectedMonths: [] as number[],
    inactive: false,
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
    const loadClientData = async () => {
      if (editData) {
        setFormData({
          companyName: editData.companyName,
          location: editData.location,
          address: editData.address || "",
          city: editData.city || "",
          province: editData.province || "",
          postalCode: editData.postalCode || "",
          contactName: editData.contactName || "",
          email: editData.email || "",
          phone: editData.phone || "",
          roofLadderCode: editData.roofLadderCode || "",
          notes: editData.notes || "",
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
      } else {
        setFormData({
          companyName: "",
          location: "",
          address: "",
          city: "",
          province: "",
          postalCode: "",
          contactName: "",
          email: "",
          phone: "",
          roofLadderCode: "",
          notes: "",
          selectedMonths: [],
          inactive: false,
        });
        setClientParts([]);
        setPendingParts([]);
      }
    };

    if (open) {
      loadClientData();
    } else {
      setPendingParts([]);
      setShowAddPart(false);
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

      setFormData({ 
        companyName: "", 
        location: "", 
        address: "",
        city: "",
        province: "",
        postalCode: "",
        contactName: "",
        email: "",
        phone: "",
        roofLadderCode: "",
        notes: "",
        selectedMonths: [], 
        inactive: false 
      });
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
                <Label htmlFor="location">Location Name (Optional)</Label>
                <Input
                  id="location"
                  data-testid="input-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter location name"
                />
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <Label className="text-base font-semibold">Contact Information</Label>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      data-testid="input-address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Street address"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      data-testid="input-city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="province">Province/State</Label>
                    <Input
                      id="province"
                      data-testid="input-province"
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      placeholder="Province or State"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal/Zip Code</Label>
                    <Input
                      id="postalCode"
                      data-testid="input-postal-code"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="Postal or Zip Code"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    data-testid="input-contact-name"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Primary contact person"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      data-testid="input-email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contact@example.com"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      data-testid="input-phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="roofLadderCode">Roof/Ladder Code</Label>
                  <Input
                    id="roofLadderCode"
                    data-testid="input-roof-ladder-code"
                    value={formData.roofLadderCode}
                    onChange={(e) => setFormData({ ...formData, roofLadderCode: e.target.value })}
                    placeholder="Access code or instructions"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    data-testid="input-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes or instructions"
                  />
                </div>
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
