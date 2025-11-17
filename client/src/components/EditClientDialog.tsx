import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  partId: string;
  quantity: number;
  part?: Part;
}

interface Equipment {
  id: string;
  name: string;
  type: string;
  serialNumber?: string | null;
  location?: string | null;
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
}

interface EditClientDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (clientId: string) => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const getPartDisplayName = (part: Part): string => {
  if (part.type === 'filter') {
    return `${part.filterType || 'Filter'} ${part.size || ''}`.trim();
  } else if (part.type === 'belt') {
    return `Belt ${part.beltType || ''} ${part.size || ''}`.trim();
  } else {
    return part.name || part.description || 'Other Part';
  }
};

export default function EditClientDialog({ client, open, onOpenChange, onSaved }: EditClientDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("info");
  
  const [formData, setFormData] = useState({
    companyName: client.companyName,
    location: client.location || "",
    address: client.address || "",
    city: client.city || "",
    province: client.province || "",
    postalCode: client.postalCode || "",
    contactName: client.contactName || "",
    email: client.email || "",
    phone: client.phone || "",
    roofLadderCode: client.roofLadderCode || "",
    notes: client.notes || "",
    selectedMonths: client.selectedMonths,
    inactive: client.inactive,
  });

  const [partRows, setPartRows] = useState<{ partId: string; quantity: number; type: string; id?: string }[]>([]);
  const [equipmentRows, setEquipmentRows] = useState<{ name: string; type: string; serialNumber: string; location: string; id?: string }[]>([]);
  const [activePartsType, setActivePartsType] = useState<string>("filter");
  const [openPartRowIndex, setOpenPartRowIndex] = useState<number | null>(null);

  const { data: availableParts = [] } = useQuery<Part[]>({
    queryKey: ['/api/parts'],
  });

  const { data: clientParts = [] } = useQuery<ClientPart[]>({
    queryKey: ['/api/clients', client.id, 'parts'],
    enabled: open,
  });

  const { data: clientEquipment = [] } = useQuery<Equipment[]>({
    queryKey: ['/api/clients', client.id, 'equipment'],
    enabled: open,
  });

  const partsByType = useMemo(() => {
    return {
      filter: availableParts.filter((p: Part) => p.type === 'filter'),
      belt: availableParts.filter((p: Part) => p.type === 'belt'),
      other: availableParts.filter((p: Part) => p.type === 'other'),
    };
  }, [availableParts]);

  useEffect(() => {
    if (open && clientParts) {
      setPartRows(clientParts.map(cp => {
        const part = availableParts.find(p => p.id === cp.partId);
        return {
          id: cp.id,
          partId: cp.partId,
          quantity: cp.quantity,
          type: part?.type || 'other'
        };
      }));
    }
  }, [open, clientParts, availableParts]);

  useEffect(() => {
    if (open && clientEquipment) {
      setEquipmentRows(clientEquipment.map(eq => ({
        id: eq.id,
        name: eq.name,
        type: eq.type,
        serialNumber: eq.serialNumber || "",
        location: eq.location || ""
      })));
    }
  }, [open, clientEquipment]);

  useEffect(() => {
    if (open) {
      setFormData({
        companyName: client.companyName,
        location: client.location || "",
        address: client.address || "",
        city: client.city || "",
        province: client.province || "",
        postalCode: client.postalCode || "",
        contactName: client.contactName || "",
        email: client.email || "",
        phone: client.phone || "",
        roofLadderCode: client.roofLadderCode || "",
        notes: client.notes || "",
        selectedMonths: client.selectedMonths,
        inactive: client.inactive,
      });
      setActiveTab("info");
    }
  }, [open, client]);

  const toggleMonth = (month: number) => {
    if (formData.selectedMonths.includes(month)) {
      setFormData({
        ...formData,
        selectedMonths: formData.selectedMonths.filter(m => m !== month)
      });
    } else {
      setFormData({
        ...formData,
        selectedMonths: [...formData.selectedMonths, month].sort((a, b) => a - b)
      });
    }
  };

  const handleAddPart = () => {
    setPartRows([...partRows, { partId: '', quantity: 1, type: activePartsType }]);
  };

  const handleUpdatePart = (index: number, field: 'partId' | 'quantity', value: string | number) => {
    const updatedRows = [...partRows];
    const row = updatedRows[index];
    
    if (field === 'partId') {
      const selectedPart = availableParts.find((p: Part) => p.id === value);
      if (selectedPart) {
        updatedRows[index] = { 
          ...row, 
          partId: value as string,
          type: selectedPart.type
        };
      }
    } else {
      updatedRows[index] = { 
        ...row, 
        quantity: value as number
      };
    }
    
    setPartRows(updatedRows);
  };

  const handleDeletePart = (index: number) => {
    const updatedRows = [...partRows];
    updatedRows.splice(index, 1);
    setPartRows(updatedRows);
  };

  const handleAddEquipment = () => {
    setEquipmentRows([...equipmentRows, { name: '', type: '', serialNumber: '', location: '' }]);
  };

  const handleUpdateEquipment = (index: number, field: keyof typeof equipmentRows[0], value: string) => {
    const updatedRows = [...equipmentRows];
    updatedRows[index] = { ...updatedRows[index], [field]: value };
    setEquipmentRows(updatedRows);
  };

  const handleDeleteEquipment = (index: number) => {
    const updatedRows = [...equipmentRows];
    updatedRows.splice(index, 1);
    setEquipmentRows(updatedRows);
  };

  const updateClientMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest('PUT', `/api/clients/${client.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', client.id] });
    }
  });

  const updatePartsMutation = useMutation({
    mutationFn: async (parts: typeof partRows) => {
      return await apiRequest('PUT', `/api/clients/${client.id}/parts`, { parts });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', client.id, 'parts'] });
    }
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async (equipment: typeof equipmentRows) => {
      return await apiRequest('PUT', `/api/clients/${client.id}/equipment`, { equipment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', client.id, 'equipment'] });
    }
  });

  const handleSave = async () => {
    if (!formData.inactive && formData.selectedMonths.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select at least one maintenance month or mark as inactive."
      });
      return;
    }

    try {
      await updateClientMutation.mutateAsync(formData);
      
      const validParts = partRows.filter(row => row.partId && row.quantity > 0);
      await updatePartsMutation.mutateAsync(validParts);
      
      const validEquipment = equipmentRows.filter(row => row.name && row.type);
      await updateEquipmentMutation.mutateAsync(validEquipment);

      toast({
        title: "Success",
        description: "Client updated successfully"
      });

      onSaved(client.id);
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update client. Please try again."
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-edit-client">
        <DialogHeader>
          <DialogTitle>Edit Client - {client.companyName}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info" data-testid="tab-info">Client Info</TabsTrigger>
            <TabsTrigger value="parts" data-testid="tab-parts">Parts</TabsTrigger>
            <TabsTrigger value="equipment" data-testid="tab-equipment">Equipment</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 pb-4">
            <TabsContent value="info" className="space-y-4 mt-0 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    data-testid="input-company-name"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Company Name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    data-testid="input-location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Location"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Contact Details</Label>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="contactName" className="text-xs">Contact Name</Label>
                    <Input
                      id="contactName"
                      data-testid="input-contact-name"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      placeholder="Contact Name"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs">Phone</Label>
                    <Input
                      id="phone"
                      data-testid="input-phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Phone"
                      maxLength={14}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs">Email</Label>
                    <Input
                      id="email"
                      data-testid="input-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="roofLadderCode" className="text-xs">Roof/Ladder Code</Label>
                    <Input
                      id="roofLadderCode"
                      data-testid="input-roof-ladder-code"
                      value={formData.roofLadderCode}
                      onChange={(e) => setFormData({ ...formData, roofLadderCode: e.target.value })}
                      placeholder="Roof/Ladder Code"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-xs">Notes</Label>
                    <Input
                      id="notes"
                      data-testid="input-notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notes"
                    />
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="inactive"
                        checked={formData.inactive}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, inactive: checked as boolean })
                        }
                        data-testid="checkbox-inactive"
                      />
                      <Label htmlFor="inactive" className="cursor-pointer text-xs">
                        Mark as Inactive (On-Call/As-Needed Only)
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Inactive clients won't appear in scheduled maintenance reports.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Address</Label>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="address" className="text-xs">Street Address</Label>
                    <Input
                      id="address"
                      data-testid="input-address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Street Address"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-xs">City</Label>
                    <Input
                      id="city"
                      data-testid="input-city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="province" className="text-xs">Province/State</Label>
                    <Input
                      id="province"
                      data-testid="input-province"
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      placeholder="Province"
                      maxLength={2}
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="postalCode" className="text-xs">Postal/Code</Label>
                    <Input
                      id="postalCode"
                      data-testid="input-postal-code"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="Code"
                      maxLength={10}
                    />
                  </div>

                  {!formData.inactive && (
                    <div className="space-y-2 pt-2">
                      <Label className="text-sm font-semibold">
                        Maintenance Months <span className="text-destructive">*</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {MONTHS.map((month, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Checkbox
                              id={`month-${index}`}
                              checked={formData.selectedMonths.includes(index)}
                              onCheckedChange={() => toggleMonth(index)}
                              data-testid={`checkbox-month-${index}`}
                            />
                            <Label htmlFor={`month-${index}`} className="cursor-pointer text-xs">
                              {month}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="parts" className="space-y-4 mt-0 pb-4">
              <Tabs value={activePartsType} onValueChange={setActivePartsType} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="filter" data-testid="tab-filter">Filters</TabsTrigger>
                  <TabsTrigger value="belt" data-testid="tab-belt">Belts</TabsTrigger>
                  <TabsTrigger value="other" data-testid="tab-other">Other</TabsTrigger>
                </TabsList>
                
                {(['filter', 'belt', 'other'] as const).map((type) => (
                  <TabsContent key={type} value={type} className="space-y-2">
                    {partRows.filter(row => row.type === type).map((row, globalIndex) => {
                      const actualIndex = partRows.indexOf(row);
                      const selectedPart = availableParts.find(p => p.id === row.partId);
                      
                      return (
                        <div key={actualIndex} className="flex gap-2 items-center" data-testid={`row-part-${actualIndex}`}>
                          <Popover 
                            open={openPartRowIndex === actualIndex} 
                            onOpenChange={(open) => setOpenPartRowIndex(open ? actualIndex : null)}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "flex-1 justify-between",
                                  !row.partId && "text-muted-foreground"
                                )}
                                data-testid={`button-select-part-${actualIndex}`}
                              >
                                {selectedPart ? getPartDisplayName(selectedPart) : "Select part"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                              <Command>
                                <CommandInput placeholder="Search parts..." />
                                <CommandList>
                                  <CommandEmpty>No parts found.</CommandEmpty>
                                  <CommandGroup>
                                    <ScrollArea className="h-72">
                                      {partsByType[type].map((part: Part) => {
                                        const displayName = getPartDisplayName(part);
                                        return (
                                          <CommandItem
                                            key={part.id}
                                            value={displayName}
                                            keywords={[
                                              part.type,
                                              part.filterType || '',
                                              part.beltType || '',
                                              part.size || '',
                                              part.name || '',
                                              displayName
                                            ]}
                                            onSelect={() => {
                                              handleUpdatePart(actualIndex, 'partId', part.id);
                                              setOpenPartRowIndex(null);
                                            }}
                                            data-testid={`option-part-${part.id}`}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                row.partId === part.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {displayName}
                                          </CommandItem>
                                        );
                                      })}
                                    </ScrollArea>
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          
                          <Input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => handleUpdatePart(actualIndex, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-20"
                            data-testid={`input-quantity-${actualIndex}`}
                          />
                          
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePart(actualIndex)}
                            data-testid={`button-delete-part-${actualIndex}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddPart}
                      className="w-full"
                      data-testid={`button-add-${type}`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add {type === 'filter' ? 'Filter' : type === 'belt' ? 'Belt' : 'Other Part'}
                    </Button>
                  </TabsContent>
                ))}
              </Tabs>
            </TabsContent>

            <TabsContent value="equipment" className="space-y-4 mt-0 pb-4">
              {equipmentRows.map((row, index) => (
                <div key={index} className="grid grid-cols-4 gap-2 items-end" data-testid={`row-equipment-${index}`}>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Equipment Name</Label>
                    <Input
                      value={row.name}
                      onChange={(e) => handleUpdateEquipment(index, 'name', e.target.value)}
                      placeholder="Name"
                      data-testid={`input-equipment-name-${index}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Input
                      value={row.type}
                      onChange={(e) => handleUpdateEquipment(index, 'type', e.target.value)}
                      placeholder="Type"
                      data-testid={`input-equipment-type-${index}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Serial Number</Label>
                    <Input
                      value={row.serialNumber}
                      onChange={(e) => handleUpdateEquipment(index, 'serialNumber', e.target.value)}
                      placeholder="Serial"
                      data-testid={`input-equipment-serial-${index}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Location</Label>
                    <div className="flex gap-2">
                      <Input
                        value={row.location}
                        onChange={(e) => handleUpdateEquipment(index, 'location', e.target.value)}
                        placeholder="Location"
                        data-testid={`input-equipment-location-${index}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteEquipment(index)}
                        data-testid={`button-delete-equipment-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddEquipment}
                className="w-full"
                data-testid="button-add-equipment"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Equipment
              </Button>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel"
            disabled={updateClientMutation.isPending || updatePartsMutation.isPending || updateEquipmentMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            data-testid="button-save"
            disabled={updateClientMutation.isPending || updatePartsMutation.isPending || updateEquipmentMutation.isPending}
          >
            {updateClientMutation.isPending || updatePartsMutation.isPending || updateEquipmentMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
