import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { JobPart, Part } from "@shared/schema";

interface PartsBillingCardProps {
  jobId: string;
}

interface LocalLineItem {
  id: string;
  isNew?: boolean;
  productId?: string | null;
  description: string;
  quantity: string;
  unitCost: string;
  unitPrice: string;
  source: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function PartsBillingCard({ jobId }: PartsBillingCardProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<LocalLineItem[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [productModalState, setProductModalState] = useState<{
    open: boolean;
    seedName: string;
    lineItemId: string | null;
  }>({ open: false, seedName: "", lineItemId: null });

  const { data: jobParts = [], isLoading: partsLoading } = useQuery<JobPart[]>({
    queryKey: ["/api/jobs", jobId, "parts"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/parts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch job parts");
      return res.json();
    },
  });

  const { data: catalogData } = useQuery<{ items: Part[] }>({
    queryKey: ["/api/parts"],
  });
  const catalogParts = catalogData?.items || [];

  useEffect(() => {
    if (jobParts && !hasChanges) {
      setItems(
        jobParts.map((jp) => ({
          id: jp.id,
          isNew: false,
          productId: jp.productId,
          description: jp.description,
          quantity: jp.quantity,
          unitCost: catalogParts.find((p) => p.id === jp.productId)?.cost || "0",
          unitPrice: jp.unitPrice || "0",
          source: jp.source,
        }))
      );
    }
  }, [jobParts, catalogParts, hasChanges]);

  const { totalPrice, totalCost, profit, margin } = useMemo(() => {
    const totalPrice = items.reduce(
      (sum, i) => sum + parseFloat(i.unitPrice || "0") * parseFloat(i.quantity || "0"),
      0
    );
    const totalCost = items.reduce(
      (sum, i) => sum + parseFloat(i.unitCost || "0") * parseFloat(i.quantity || "0"),
      0
    );
    const profit = totalPrice - totalCost;
    const margin = totalPrice > 0 ? (profit / totalPrice) * 100 : 0;
    return { totalPrice, totalCost, profit, margin };
  }, [items]);

  const handleAddLineItem = () => {
    const id = `new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newItem: LocalLineItem = {
      id,
      isNew: true,
      description: "",
      quantity: "1",
      unitCost: "0",
      unitPrice: "0",
      source: "manual",
    };
    setItems((prev) => [...prev, newItem]);
    setEditingRowId(id);
    setHasChanges(true);
  };

  const handleRowChange = (id: string, patch: Partial<LocalLineItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
    setHasChanges(true);
  };

  const handleRowDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editingRowId === id) setEditingRowId(null);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      for (const item of items) {
        const qty = String(parseFloat(item.quantity) || 1);
        const price = String(parseFloat(item.unitPrice) || 0);
        
        if (item.isNew) {
          await apiRequest("POST", `/api/jobs/${jobId}/parts`, {
            description: item.description || "Unnamed item",
            quantity: qty,
            unitPrice: price,
            productId: item.productId || null,
            source: item.source || "manual",
          });
        } else {
          await apiRequest("PUT", `/api/jobs/${jobId}/parts/${item.id}`, {
            description: item.description,
            quantity: qty,
            unitPrice: price,
            productId: item.productId || null,
            source: item.source,
          });
        }
      }

      const currentIds = items.filter((i) => !i.isNew).map((i) => i.id);
      const originalIds = jobParts.map((jp) => jp.id);
      const deletedIds = originalIds.filter((id) => !currentIds.includes(id));
      for (const id of deletedIds) {
        await apiRequest("DELETE", `/api/jobs/${jobId}/parts/${id}`);
      }

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/jobs", jobId, "parts"] }),
        queryClient.refetchQueries({ queryKey: ["/api/parts"] }),
      ]);
      setHasChanges(false);
      toast({ title: "Saved", description: "Line items saved successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save line items.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectProduct = (lineId: string, product: Part) => {
    handleRowChange(lineId, {
      productId: product.id,
      description: product.name || product.description || "",
      unitCost: product.cost || "0",
      unitPrice: product.unitPrice || "0",
    });
    setEditingRowId(null);
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; cost: string; unitPrice: string; type: string }) => {
      const res = await apiRequest("POST", "/api/parts", {
        name: data.name,
        description: data.description || null,
        cost: String(parseFloat(data.cost) || 0),
        unitPrice: String(parseFloat(data.unitPrice) || 0),
        type: data.type,
        isTaxable: true,
        isActive: true,
      });
      if (!res.ok) throw new Error("Failed to create product");
      return res.json() as Promise<Part>;
    },
    onSuccess: (newPart: Part) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      if (productModalState.lineItemId) {
        handleRowChange(productModalState.lineItemId, {
          productId: newPart.id,
          description: newPart.name || newPart.description || "",
          unitCost: newPart.cost || "0",
          unitPrice: newPart.unitPrice || "0",
        });
      }
      setProductModalState({ open: false, seedName: "", lineItemId: null });
      toast({ title: "Product created", description: "New product added to catalog." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create product.", variant: "destructive" });
    },
  });

  if (partsLoading) {
    return (
      <Card data-testid="card-parts-billing">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="card-parts-billing">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-semibold">Parts & Billing</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Add parts and services for this job. Changes are saved when you click <span className="font-medium">Save</span>.
              </p>
            </div>
            <div className="flex items-center gap-6 text-xs">
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Price</div>
                <div className="font-semibold">{formatCurrency(totalPrice)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Cost</div>
                <div className="font-semibold">{formatCurrency(totalCost)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Profit Margin</div>
                <div className="font-semibold">
                  {formatCurrency(profit)}{" "}
                  <span className="text-[11px] text-muted-foreground">• {margin.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 text-left font-medium">Product / Service</th>
                  <th className="py-2 px-3 text-right font-medium w-20">Qty</th>
                  <th className="py-2 px-3 text-right font-medium w-28">Cost</th>
                  <th className="py-2 px-3 text-right font-medium w-28">Price</th>
                  <th className="py-2 pl-3 text-right font-medium w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                      No line items yet. Add parts or services to this job.
                    </td>
                  </tr>
                )}
                {items.map((item) => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    catalog={catalogParts.filter((p) => p.isActive !== false)}
                    isEditing={editingRowId === item.id}
                    onEnterEdit={() => setEditingRowId(item.id)}
                    onChange={(patch) => handleRowChange(item.id, patch)}
                    onDelete={() => handleRowDelete(item.id)}
                    onSelectProduct={(product) => handleSelectProduct(item.id, product)}
                    onRequestAddProduct={(name) =>
                      setProductModalState({ open: true, seedName: name, lineItemId: item.id })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddLineItem}
              data-testid="button-add-line-item"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Line Item
            </Button>
            <div className="flex items-center gap-3">
              {hasChanges && <span className="text-[11px] text-muted-foreground">Unsaved changes</span>}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                data-testid="button-save-parts"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddProductModal
        open={productModalState.open}
        initialName={productModalState.seedName}
        onClose={() => setProductModalState({ open: false, seedName: "", lineItemId: null })}
        onSave={(data) => createProductMutation.mutate(data)}
        isSaving={createProductMutation.isPending}
      />
    </>
  );
}

interface LineItemRowProps {
  item: LocalLineItem;
  catalog: Part[];
  isEditing: boolean;
  onEnterEdit: () => void;
  onChange: (patch: Partial<LocalLineItem>) => void;
  onDelete: () => void;
  onSelectProduct: (product: Part) => void;
  onRequestAddProduct: (name: string) => void;
}

function LineItemRow({
  item,
  catalog,
  isEditing,
  onEnterEdit,
  onChange,
  onDelete,
  onSelectProduct,
  onRequestAddProduct,
}: LineItemRowProps) {
  const [query, setQuery] = useState(item.description ?? "");
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setQuery(item.description ?? "");
  }, [item.description]);

  const suggestions = useMemo(() => {
    if (!query.trim()) return catalog.slice(0, 8);
    const lower = query.toLowerCase();
    return catalog
      .filter((c) => (c.name || c.description || "").toLowerCase().includes(lower))
      .slice(0, 8);
  }, [catalog, query]);

  const lineTotal = parseFloat(item.unitPrice || "0") * parseFloat(item.quantity || "0");

  if (!isEditing) {
    return (
      <tr
        className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
        onClick={onEnterEdit}
        data-testid={`row-line-item-${item.id}`}
      >
        <td className="py-3 pr-3 align-top">
          <div className="text-xs font-medium">
            {item.description || <span className="italic text-muted-foreground">No product</span>}
          </div>
        </td>
        <td className="py-3 px-3 text-right align-top text-xs">{item.quantity}</td>
        <td className="py-3 px-3 text-right align-top text-xs">{formatCurrency(parseFloat(item.unitCost || "0"))}</td>
        <td className="py-3 px-3 text-right align-top text-xs">{formatCurrency(parseFloat(item.unitPrice || "0"))}</td>
        <td className="py-3 pl-3 pr-1 text-right align-top text-xs font-semibold">{formatCurrency(lineTotal)}</td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/50 bg-primary/5">
      <td className="py-2.5 pr-3 align-top">
        <div className="relative">
          <Input
            className="text-xs"
            placeholder="Search product / service..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange({ description: e.target.value });
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            data-testid={`input-product-search-${item.id}`}
          />
          {showDropdown && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-lg">
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelectProduct(c);
                    setQuery(c.name || c.description || "");
                    setShowDropdown(false);
                  }}
                  className="flex w-full flex-col items-start px-2.5 py-1.5 text-left hover:bg-muted"
                >
                  <span className="text-xs">{c.name || c.description}</span>
                  {c.sku && <span className="text-[11px] text-muted-foreground">SKU: {c.sku}</span>}
                </button>
              ))}
              <div className="border-t" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRequestAddProduct(query)}
                className="flex w-full items-center px-2.5 py-1.5 text-left text-xs text-primary hover:bg-primary/10"
              >
                + Add "{query || "new item"}" as product
              </button>
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="mt-1.5 h-auto p-0 text-[11px] text-destructive hover:text-destructive"
          data-testid={`button-delete-line-${item.id}`}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Remove line
        </Button>
      </td>
      <td className="py-2.5 px-3 align-top">
        <Input
          type="number"
          min={0}
          className="text-xs text-right w-full"
          value={item.quantity}
          onChange={(e) => onChange({ quantity: e.target.value || "0" })}
          data-testid={`input-qty-${item.id}`}
        />
      </td>
      <td className="py-2.5 px-3 align-top">
        <Input
          type="number"
          min={0}
          step="0.01"
          className="text-xs text-right w-full"
          value={item.unitCost}
          onChange={(e) => onChange({ unitCost: e.target.value || "0" })}
          data-testid={`input-cost-${item.id}`}
        />
      </td>
      <td className="py-2.5 px-3 align-top">
        <Input
          type="number"
          min={0}
          step="0.01"
          className="text-xs text-right w-full"
          value={item.unitPrice}
          onChange={(e) => onChange({ unitPrice: e.target.value || "0" })}
          data-testid={`input-price-${item.id}`}
        />
      </td>
      <td className="py-2.5 pl-3 pr-1 align-top text-right text-xs font-semibold">{formatCurrency(lineTotal)}</td>
    </tr>
  );
}

interface AddProductModalProps {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (data: { name: string; description?: string; cost: string; unitPrice: string; type: string }) => void;
  isSaving: boolean;
}

function AddProductModal({ open, initialName, onClose, onSave, isSaving }: AddProductModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("product");
  const [cost, setCost] = useState("0");
  const [price, setPrice] = useState("0");

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription("");
      setType("product");
      setCost("0");
      setPrice("0");
    }
  }, [open, initialName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      cost,
      unitPrice: price,
      type,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add new product</DialogTitle>
            <DialogDescription>
              This item will be added to your Products & Services and linked to this line item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                data-testid="input-new-product-name"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Description (optional)</label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-new-product-description"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">Type</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger data-testid="select-product-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Unit Cost</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  data-testid="input-new-product-cost"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Unit Price</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  data-testid="input-new-product-price"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-add-product">
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()} data-testid="button-save-product">
              {isSaving ? "Saving..." : "Save product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default PartsBillingCard;
