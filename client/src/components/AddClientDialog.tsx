import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Check, ChevronsUpDown, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ClientFormData {
  companyName: string;
  location: string;
  selectedMonths: number[];
  inactive: boolean;
  portalEnabled: boolean;
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
    selectedMonths: [] as number[],
    inactive: false,
    portalEnabled: false,
  });

  const [clientParts, setClientParts] = useState<ClientPart[]>([]);
  const [showAddPart, setShowAddPart] = useState(false);
  const [pendingParts, setPendingParts] = useState<PendingPart[]>([]);
  const addPartFormRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  
  // Client users state
  const [clientUsers, setClientUsers] = useState<Array<{ id: string; email: string; createdAt: Date }>>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");

  const { toast } = useToast();

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

  // Fetch client users when editing
  const { data: fetchedClientUsers = [] } = useQuery<Array<{ id: string; email: string; createdAt: string }>>({
    queryKey: ['/api/clients', editData?.id, 'users'],
    enabled: !!editData?.id && open,
  });

  useEffect(() => {
    if (fetchedClientUsers.length > 0) {
      setClientUsers(fetchedClientUsers.map(u => ({ ...u, createdAt: new Date(u.createdAt) })));
    } else {
      setClientUsers([]);
    }
  }, [fetchedClientUsers]);

  // Mutation for creating client user
  const createUserMutation = useMutation({
    mutationFn: async (userData: { email: string; password: string }) => {
      const res = await apiRequest('POST', `/api/clients/${editData!.id}/users`, userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', editData!.id, 'users'] });
      setShowAddUser(false);
      setNewUserEmail("");
      setNewUserPassword("");
      toast({ title: "Portal user created successfully" });
    },
    onError: (error: any) => {
      const message = error.message || "Failed to create portal user";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  // Mutation for deleting client user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest('DELETE', `/api/clients/${editData!.id}/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', editData!.id, 'users'] });
      toast({ title: "Portal user deleted successfully" });
    },
    onError: (error: any) => {
      const message = error.message || "Failed to delete portal user";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const handleCreateUser = () => {
    if (!newUserEmail || !newUserPassword) {
      toast({ title: "Error", description: "Please enter both email and password", variant: "destructive" });
      return;
    }
    if (newUserPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    createUserMutation.mutate({ email: newUserEmail, password: newUserPassword });
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this portal user?")) {
      deleteUserMutation.mutate(userId);
    }
  };

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
          portalEnabled: editData.portalEnabled ?? false,
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
          selectedMonths: [],
          inactive: false,
          portalEnabled: false,
        });
        setClientParts([]);
        setPendingParts([]);
        setClientUsers([]);
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

      setFormData({ companyName: "", location: "", selectedMonths: [], inactive: false, portalEnabled: false });
      setClientParts([]);
      setClientUsers([]);
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
                <Label>Client Portal Access</Label>
                <p className="text-sm text-muted-foreground">
                  Enable portal access to allow this client to view their maintenance records, equipment, and parts online.
                </p>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="portalEnabled"
                    data-testid="checkbox-portal-enabled"
                    checked={formData.portalEnabled}
                    onCheckedChange={(checked) => {
                      if (!checked && clientUsers.length > 0) {
                        if (confirm(`This client has ${clientUsers.length} portal user(s). Disabling portal access will prevent them from logging in. Continue?`)) {
                          setFormData({ ...formData, portalEnabled: false });
                        }
                      } else {
                        setFormData({ ...formData, portalEnabled: checked === true });
                      }
                    }}
                  />
                  <label
                    htmlFor="portalEnabled"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Enable Portal Access
                  </label>
                </div>

                {formData.portalEnabled && editData && (
                  <div className="border rounded-md p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Portal Users</Label>
                      {!showAddUser && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddUser(true)}
                          data-testid="button-add-portal-user"
                          className="gap-2"
                        >
                          <UserPlus className="h-3 w-3" />
                          Add User
                        </Button>
                      )}
                    </div>

                    {clientUsers.length === 0 && !showAddUser && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No portal users yet. Click "Add User" to create one.
                      </p>
                    )}

                    {clientUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 border rounded hover-elevate"
                        data-testid={`portal-user-${user.id}`}
                      >
                        <div>
                          <p className="text-sm font-medium" data-testid={`text-user-email-${user.id}`}>{user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Created {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteUser(user.id)}
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    {showAddUser && (
                      <div className="border rounded-md p-3 space-y-3" data-testid="form-add-portal-user">
                        <Label className="text-sm font-medium">Create Portal User</Label>
                        <div className="space-y-2">
                          <Input
                            type="email"
                            placeholder="Email address"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            data-testid="input-portal-user-email"
                          />
                          <Input
                            type="password"
                            placeholder="Password (min 8 characters)"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            data-testid="input-portal-user-password"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleCreateUser}
                            disabled={createUserMutation.isPending}
                            data-testid="button-create-portal-user"
                          >
                            {createUserMutation.isPending ? "Creating..." : "Create User"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowAddUser(false);
                              setNewUserEmail("");
                              setNewUserPassword("");
                            }}
                            data-testid="button-cancel-add-user"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
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
