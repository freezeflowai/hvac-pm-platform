import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export interface ClientFormData {
  companyName: string;
  location: string;
  selectedMonths: number[];
  parts: Array<{ partId: string; quantity: number }>;
}

export interface ClientPart {
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
  const [newPart, setNewPart] = useState<ClientPart>({
    name: "",
    type: "filter",
    size: "",
    quantity: 1,
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
              name: cp.part.name,
              type: cp.part.type,
              size: cp.part.size,
              quantity: cp.quantity,
            })));
          }
        } catch (error) {
          console.error('Failed to load client parts', error);
        }
      } else {
        setFormData({
          companyName: "",
          location: "",
          selectedMonths: [],
        });
        setClientParts([]);
      }
    };

    if (open) {
      loadClientParts();
    }
  }, [editData, open]);

  const toggleMonth = (monthIndex: number) => {
    setFormData(prev => ({
      ...prev,
      selectedMonths: prev.selectedMonths.includes(monthIndex)
        ? prev.selectedMonths.filter(m => m !== monthIndex)
        : [...prev.selectedMonths, monthIndex].sort((a, b) => a - b)
    }));
  };

  const handleAddPart = () => {
    if (!newPart.name || !newPart.size || newPart.quantity < 1) {
      return;
    }

    setClientParts(prev => [...prev, { ...newPart }]);
    setNewPart({ name: "", type: "filter", size: "", quantity: 1 });
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
      // Fetch all parts once for efficiency
      const searchRes = await fetch(`/api/parts`);
      if (!searchRes.ok) {
        throw new Error('Failed to fetch parts');
      }
      const allParts = await searchRes.json();

      // For each part, find or create it in the global inventory
      const partsWithIds = [];
      
      for (const part of clientParts) {
        const existingPart = allParts.find(
          (p: any) => p.name === part.name && p.type === part.type && p.size === part.size
        );

        if (existingPart) {
          partsWithIds.push({ partId: existingPart.id, quantity: part.quantity });
          continue;
        }

        // Create new part
        const createRes = await fetch(`/api/parts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: part.name,
            type: part.type,
            size: part.size,
          }),
        });

        if (!createRes.ok) {
          throw new Error(`Failed to create part: ${part.name}`);
        }

        const newPartData = await createRes.json();
        // Add newly created part to allParts so subsequent iterations can find it
        allParts.push(newPartData);
        partsWithIds.push({ partId: newPartData.id, quantity: part.quantity });
      }

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
                  <div className="border rounded-md p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="part-name">Part Name</Label>
                        <Input
                          id="part-name"
                          data-testid="input-part-name"
                          value={newPart.name}
                          onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                          placeholder="e.g., MERV 11 Filter"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="part-type">Type</Label>
                        <Select
                          value={newPart.type}
                          onValueChange={(value) => setNewPart({ ...newPart, type: value })}
                        >
                          <SelectTrigger id="part-type" data-testid="select-part-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="filter">Filter</SelectItem>
                            <SelectItem value="belt">Belt</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="part-size">Size</Label>
                        <Input
                          id="part-size"
                          data-testid="input-part-size"
                          value={newPart.size}
                          onChange={(e) => setNewPart({ ...newPart, size: e.target.value })}
                          placeholder="e.g., 16x25x4"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="part-quantity">Quantity</Label>
                        <Input
                          id="part-quantity"
                          type="number"
                          min="1"
                          data-testid="input-part-quantity"
                          value={newPart.quantity}
                          onChange={(e) => setNewPart({ ...newPart, quantity: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddPart(false)}
                        data-testid="button-cancel-part"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddPart}
                        data-testid="button-save-part"
                      >
                        Add Part
                      </Button>
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
