import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import type { JobTemplate, Part } from "@shared/schema";

interface JobTemplateModalProps {
  open: boolean;
  onClose: () => void;
  template: JobTemplate | null;
}

interface LineItemDraft {
  id: string;
  productId: string;
  descriptionOverride: string;
  quantity: string;
  unitPriceOverride: string;
}

const JOB_TYPE_OPTIONS = [
  { value: "", label: "None" },
  { value: "service_call", label: "Service Call" },
  { value: "pm", label: "PM" },
  { value: "install", label: "Install" },
  { value: "repair", label: "Repair" },
  { value: "inspection", label: "Inspection" },
];

export function JobTemplateModal({ open, onClose, template }: JobTemplateModalProps) {
  const { toast } = useToast();
  const isEditing = !!template;

  const [name, setName] = useState("");
  const [jobType, setJobType] = useState("");
  const [description, setDescription] = useState("");
  const [isDefaultForJobType, setIsDefaultForJobType] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: catalogData } = useQuery<{ items: Part[] }>({
    queryKey: ["/api/parts", { limit: 1000 }],
    queryFn: async () => {
      const res = await fetch("/api/parts?limit=1000", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return res.json();
    },
    enabled: open,
  });
  const catalogParts = catalogData?.items?.filter((p) => p.isActive !== false) || [];

  const { data: templateDetails, isLoading: isLoadingDetails } = useQuery<
    JobTemplate & { lines: any[] }
  >({
    queryKey: ["/api/job-templates", template?.id],
    queryFn: async () => {
      const res = await fetch(`/api/job-templates/${template!.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch template details");
      return res.json();
    },
    enabled: open && !!template?.id,
  });

  useEffect(() => {
    if (open) {
      if (template && templateDetails) {
        setName(templateDetails.name);
        setJobType(templateDetails.jobType || "");
        setDescription(templateDetails.description || "");
        setIsDefaultForJobType(templateDetails.isDefaultForJobType);
        setIsActive(templateDetails.isActive);
        setLineItems(
          (templateDetails.lines || []).map((line: any, index: number) => ({
            id: line.id || `line_${index}`,
            productId: line.productId || "",
            descriptionOverride: line.descriptionOverride || "",
            quantity: String(line.quantity || "1"),
            unitPriceOverride: line.unitPriceOverride || "",
          }))
        );
      } else if (!template) {
        setName("");
        setJobType("");
        setDescription("");
        setIsDefaultForJobType(false);
        setIsActive(true);
        setLineItems([]);
      }
    }
  }, [open, template, templateDetails]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = isEditing
        ? `/api/job-templates/${template!.id}`
        : "/api/job-templates";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-templates"] });
      toast({
        title: isEditing ? "Template updated" : "Template created",
        description: isEditing
          ? "Your changes have been saved."
          : "The new template is ready to use.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddLineItem = () => {
    const newId = `new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setLineItems((prev) => [
      ...prev,
      {
        id: newId,
        productId: "",
        descriptionOverride: "",
        quantity: "1",
        unitPriceOverride: "",
      },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleLineItemChange = (
    id: string,
    field: keyof LineItemDraft,
    value: string
  ) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleProductSelect = (itemId: string, productId: string) => {
    const product = catalogParts.find((p) => p.id === productId);
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productId,
              unitPriceOverride: item.unitPriceOverride || "",
            }
          : item
      )
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Validation error", description: "Name is required.", variant: "destructive" });
      return;
    }

    const validLineItems = lineItems.filter((li) => li.productId);
    if (validLineItems.length === 0) {
      toast({
        title: "Validation error",
        description: "At least one line item with a selected product is required.",
        variant: "destructive",
      });
      return;
    }

    for (const li of validLineItems) {
      const qty = parseFloat(li.quantity);
      if (isNaN(qty) || qty <= 0) {
        toast({
          title: "Validation error",
          description: "Quantity must be greater than 0 for all line items.",
          variant: "destructive",
        });
        return;
      }
    }

    const payload = {
      name: name.trim(),
      jobType: jobType || null,
      description: description.trim() || null,
      isDefaultForJobType: jobType ? isDefaultForJobType : false,
      isActive,
      lines: validLineItems.map((li, index) => ({
        productId: li.productId,
        descriptionOverride: li.descriptionOverride.trim() || null,
        quantity: li.quantity,
        unitPriceOverride: li.unitPriceOverride.trim() || null,
        sortOrder: index,
      })),
    };

    saveMutation.mutate(payload);
  };

  const getProductPrice = (productId: string): string => {
    const product = catalogParts.find((p) => p.id === productId);
    return product?.unitPrice || "0";
  };

  const getProductName = (productId: string): string => {
    const product = catalogParts.find((p) => p.id === productId);
    return product?.name || product?.description || "";
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-modal-title">
            {isEditing ? "Edit Job Template" : "New Job Template"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the template details and line items."
              : "Create a reusable template with predefined line items."}
          </DialogDescription>
        </DialogHeader>

        {isEditing && isLoadingDetails ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Template Details</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Standard Service Call"
                    data-testid="input-template-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobType">Job Type</Label>
                  <Select value={jobType} onValueChange={setJobType}>
                    <SelectTrigger data-testid="select-job-type">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value || "none"}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  data-testid="input-template-description"
                />
              </div>

              <div className="flex items-center gap-6">
                {jobType && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={isDefaultForJobType}
                      onCheckedChange={(checked) =>
                        setIsDefaultForJobType(checked === true)
                      }
                      data-testid="checkbox-is-default"
                    />
                    Use as default template for this job type
                  </label>
                )}

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={isActive}
                    onCheckedChange={(checked) => setIsActive(checked === true)}
                    data-testid="checkbox-is-active"
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Line Items</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddLineItem}
                  data-testid="button-add-line-item"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Line Item
                </Button>
              </div>

              {lineItems.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border border-dashed rounded-md">
                  <p className="text-sm">No line items yet.</p>
                  <p className="text-xs">Add products or services to include in this template.</p>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Product / Service</TableHead>
                        <TableHead>Description Override</TableHead>
                        <TableHead className="w-24">Qty</TableHead>
                        <TableHead className="w-32">Unit Price</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => {
                        const defaultPrice = item.productId
                          ? getProductPrice(item.productId)
                          : "";
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.productId}
                                onValueChange={(val) =>
                                  handleProductSelect(item.id, val)
                                }
                              >
                                <SelectTrigger
                                  className="w-full"
                                  data-testid={`select-product-${index}`}
                                >
                                  <SelectValue placeholder="Select product..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {catalogParts.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name || p.description}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.descriptionOverride}
                                onChange={(e) =>
                                  handleLineItemChange(
                                    item.id,
                                    "descriptionOverride",
                                    e.target.value
                                  )
                                }
                                placeholder="Optional override..."
                                className="text-sm"
                                data-testid={`input-description-${index}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleLineItemChange(
                                    item.id,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                                className="text-sm"
                                data-testid={`input-quantity-${index}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPriceOverride}
                                  onChange={(e) =>
                                    handleLineItemChange(
                                      item.id,
                                      "unitPriceOverride",
                                      e.target.value
                                    )
                                  }
                                  placeholder={defaultPrice ? `$${defaultPrice}` : ""}
                                  className="text-sm"
                                  data-testid={`input-price-${index}`}
                                />
                                {item.productId && !item.unitPriceOverride && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Default: ${defaultPrice}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveLineItem(item.id)}
                                data-testid={`button-remove-${index}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save"
          >
            {saveMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            )}
            {isEditing ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
