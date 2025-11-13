import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";

export interface ClientFormData {
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

interface AddClientDialogProps {
  onSubmit: (data: ClientFormData) => void;
  onCancel: () => void;
  editData?: ClientFormData & { id: string };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function AddClientDialog({ onSubmit, onCancel, editData }: AddClientDialogProps) {
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

  useEffect(() => {
    if (editData) {
      setFormData({
        companyName: editData.companyName,
        location: editData.location || "",
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
    }
  }, [editData?.id]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.inactive && formData.selectedMonths.length === 0) {
      return;
    }

    try {
      onSubmit(formData);

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
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Failed to save client. Please try again.');
    }
  };

  return (
    <div className="space-y-6" data-testid="form-add-client">
      <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-6">
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="province">Province/State</Label>
                    <Input
                      id="province"
                      data-testid="input-province"
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      placeholder="Province or state"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      data-testid="input-postal-code"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="Postal code"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Contact Name</Label>
                    <Input
                      id="contactName"
                      data-testid="input-contact-name"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      placeholder="Contact person's name"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        data-testid="input-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@example.com"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        data-testid="input-phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Phone number"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="roofLadderCode">Roof/Ladder Code (Optional)</Label>
                <Input
                  id="roofLadderCode"
                  data-testid="input-roof-ladder-code"
                  value={formData.roofLadderCode}
                  onChange={(e) => setFormData({ ...formData, roofLadderCode: e.target.value })}
                  placeholder="Access code for roof or ladder"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  data-testid="input-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes"
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="inactive"
                    checked={formData.inactive}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, inactive: checked as boolean })
                    }
                    data-testid="checkbox-inactive"
                  />
                  <Label htmlFor="inactive" className="cursor-pointer">
                    Mark as Inactive (On-Call/As-Needed Only)
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Inactive clients won't appear in scheduled maintenance reports.
                </p>
              </div>

              {!formData.inactive && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    Maintenance Schedule <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Select the months when maintenance is required (15th of each month)
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {MONTHS.map((month, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Checkbox
                          id={`month-${index}`}
                          checked={formData.selectedMonths.includes(index)}
                          onCheckedChange={() => toggleMonth(index)}
                          data-testid={`checkbox-month-${index}`}
                        />
                        <Label htmlFor={`month-${index}`} className="cursor-pointer">
                          {month}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
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
          </div>
        </form>
    </div>
  );
}
