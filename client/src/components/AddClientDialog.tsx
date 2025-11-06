import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ClientFormData {
  companyName: string;
  location: string;
  selectedMonths: number[];
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
  const [formData, setFormData] = useState<ClientFormData>({
    companyName: "",
    location: "",
    selectedMonths: [],
  });

  useEffect(() => {
    if (editData) {
      setFormData({
        companyName: editData.companyName,
        location: editData.location,
        selectedMonths: editData.selectedMonths,
      });
    } else {
      setFormData({
        companyName: "",
        location: "",
        selectedMonths: [],
      });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.selectedMonths.length === 0) {
      return;
    }
    onSubmit(formData);
    setFormData({ companyName: "", location: "", selectedMonths: [] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="dialog-add-client">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 py-4 pr-4">
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
