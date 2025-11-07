import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  name: string;
  type: string;
  size: string;
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

export default function AddClientDialog({ open, onClose, onSubmit, editData }: AddClientDialogProps) {
  const [formData, setFormData] = useState({
    companyName: "",
    location: "",
    selectedMonths: [] as number[],
  });

  const [clientParts, setClientParts] = useState<ClientPart[]>([]);
  const [showAddPart, setShowAddPart] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string>("");
  const [partQuantity, setPartQuantity] = useState<number>(1);
  const addPartFormRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const { data: availableParts = [] } = useQuery<Array<{ id: string; name: string; type: string; size: string }>>({
    queryKey: ["/api/parts"],
  });

  useEffect(() => {
    const loadClientParts = async () => {
      if (editData) {
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
              name: cp.part.name,
              type: cp.part.type,
              size: cp.part.size,
              quantity: cp.quantity,
            })));
          }
        } catch (error) {
          console.error('Failed to load client parts', error);
        }
        initializedRef.current = true;
      } else if (!initializedRef.current) {
        setFormData({
          companyName: "",
          location: "",
          selectedMonths: [],
        });
        setClientParts([]);
        initializedRef.current = true;
      }
    };

    if (open) {
      loadClientParts();
    } else {
      initializedRef.current = false;
    }
  }, [editData, open]);

  useEffect(() => {
    if (showAddPart && addPartFormRef.current) {
      const scrollTimer = requestAnimationFrame(() => {
        addPartFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      return () => cancelAnimationFrame(scrollTimer);
    }
  }, [showAddPart]);

  const toggleMonth = (monthIndex: number) => {
    setFormData(prev => ({
      ...prev,
      selectedMonths: prev.selectedMonths.includes(monthIndex)
        ? prev.selectedMonths.filter(m => m !== monthIndex)
        : [...prev.selectedMonths, monthIndex].sort((a, b) => a - b)
    }));
  };

  const handleAddPart = () => {
    if (!selectedPartId || partQuantity < 1) {
      return;
    }

    const selectedPart = availableParts.find(p => p.id === selectedPartId);
    if (!selectedPart) return;

    setClientParts(prev => [...prev, {
      partId: selectedPart.id,
      name: selectedPart.name,
      type: selectedPart.type,
      size: selectedPart.size,
      quantity: partQuantity,
    }]);
    
    setSelectedPartId("");
    setPartQuantity(1);
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
                  <div ref={addPartFormRef} className="border rounded-md p-3 space-y-3">
                    {availableParts.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">No parts in inventory yet.</p>
                        <p className="text-xs text-muted-foreground mt-1">Go to Parts Management to add parts first.</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="select-part">Select Part from Inventory</Label>
                          <Select
                            value={selectedPartId}
                            onValueChange={setSelectedPartId}
                          >
                            <SelectTrigger id="select-part" data-testid="select-part">
                              <SelectValue placeholder="Choose a part..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableParts.map((part) => (
                                <SelectItem key={part.id} value={part.id}>
                                  {part.name} - {part.type} ({part.size})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="part-quantity">Quantity</Label>
                          <Input
                            id="part-quantity"
                            type="number"
                            min="1"
                            data-testid="input-part-quantity"
                            value={partQuantity}
                            onChange={(e) => setPartQuantity(parseInt(e.target.value) || 1)}
                          />
                        </div>
                      </>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddPart(false);
                          setSelectedPartId("");
                          setPartQuantity(1);
                        }}
                        data-testid="button-cancel-part"
                      >
                        Cancel
                      </Button>
                      {availableParts.length > 0 && (
                        <div className="flex flex-col items-end">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAddPart}
                            data-testid="button-save-part"
                            disabled={!selectedPartId}
                          >
                            Add Part
                          </Button>
                          {!selectedPartId && (
                            <p className="text-xs text-muted-foreground mt-1">Select a part first</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {clientParts.length > 0 && (
                  <div className="space-y-2">
                    {clientParts.map((part, index) => (
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
                            <p className="text-sm font-medium truncate">{part.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {part.type} • {part.size}
                            </p>
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
                    ))}
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
