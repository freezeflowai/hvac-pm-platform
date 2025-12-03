import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Plus, Pencil, Search, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Part {
  id: string;
  type: string;
  filterType?: string | null;
  beltType?: string | null;
  size?: string | null;
  name?: string | null;
  description?: string | null;
  cost?: string | null;
  unitPrice?: string | null;
  taxExempt?: boolean | null;
}

interface ProductFormData {
  type: "service" | "product";
  name: string;
  description: string;
  cost: string;
  unitPrice: string;
  taxExempt: boolean;
}

const defaultFormData: ProductFormData = {
  type: "service",
  name: "",
  description: "",
  cost: "0.00",
  unitPrice: "0.00",
  taxExempt: false,
};

interface PartsResponse {
  items: Part[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

const ITEMS_PER_PAGE = 50;

export default function ProductsServicesManager() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Part | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(defaultFormData);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Part | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const loaderRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery<PartsResponse>({
    queryKey: ["/api/parts", debouncedSearch],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String(pageParam),
        search: debouncedSearch,
      });
      const res = await fetch(`/api/parts?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch parts");
      return res.json();
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage.offset + lastPage.limit;
      }
      return undefined;
    },
    initialPageParam: 0,
  });

  // Flatten pages into single array
  const parts = data?.pages.flatMap(page => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Part>) => {
      const res = await apiRequest("POST", "/api/parts", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      toast({
        title: "Success",
        description: editingProduct ? "Product/Service updated successfully." : "Product/Service created successfully.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save product/service.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Part> }) => {
      const res = await apiRequest("PUT", `/api/parts/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      toast({
        title: "Success",
        description: "Product/Service updated successfully.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update product/service.",
        variant: "destructive",
      });
    },
  });

  const deletePartMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/parts/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      toast({
        title: "Deleted",
        description: "Item deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete item.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/parts/bulk-delete", { ids });
      return res.json();
    },
    onSuccess: (data) => {
      const { deletedCount } = data;
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      if (deletedCount > 0) {
        toast({
          title: "Items deleted",
          description: `Successfully deleted ${deletedCount} item${deletedCount > 1 ? "s" : ""}.`,
        });
      }
      
      setSelectedIds(new Set());
      setBulkDeleteDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete items",
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = (partsToSelect: Part[]) => {
    setSelectedIds(new Set(partsToSelect.map(p => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDeleteClick = () => {
    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  const handleOpenAddDialog = () => {
    setEditingProduct(null);
    setFormData(defaultFormData);
    setProductDialogOpen(true);
  };

  const handleOpenEditDialog = (product: Part) => {
    setEditingProduct(product);
    setFormData({
      type: (product.type as "service" | "product") || "service",
      name: product.name || "",
      description: product.description || "",
      cost: product.cost || "0.00",
      unitPrice: product.unitPrice || "0.00",
      taxExempt: product.taxExempt || false,
    });
    setProductDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setProductDialogOpen(false);
    setEditingProduct(null);
    setFormData(defaultFormData);
  };

  const handleSaveProduct = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      type: formData.type,
      name: formData.name,
      description: formData.description || null,
      cost: formData.cost || null,
      unitPrice: formData.unitPrice || null,
      taxExempt: formData.taxExempt,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteClick = (product: Part) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (productToDelete) {
      deletePartMutation.mutate(productToDelete.id);
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
    }
  };

  // Intersection observer for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: "100px",
      threshold: 0.1,
    };
    const observer = new IntersectionObserver(handleObserver, option);
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  const getPartDisplay = (part: Part) => {
    return {
      primary: part.name || "",
      secondary: part.description || "",
    };
  };

  const SelectionControls = ({ items, label }: { items: Part[]; label: string }) => (
    <>
      {items.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSelectAll(items)}
            data-testid={`button-select-all-${label}`}
          >
            Select All
          </Button>
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeselectAll}
              data-testid="button-deselect-all"
            >
              Deselect All
            </Button>
          )}
        </div>
      )}
    </>
  );

  const BulkDeleteBar = () => (
    <>
      {selectedIds.size > 0 && (
        <div className="p-3 bg-muted rounded-md flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDeleteClick}
            disabled={bulkDeleteMutation.isPending}
            data-testid="button-bulk-delete"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}
    </>
  );

  const ItemGrid = ({ items }: { items: Part[] }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((part) => {
        const display = getPartDisplay(part);
        const isProductOrService = part.type === "service" || part.type === "product";
        return (
          <Card key={part.id} data-testid={`card-item-${part.id}`}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <Checkbox
                checked={selectedIds.has(part.id)}
                onCheckedChange={(checked) => handleSelectOne(part.id, checked as boolean)}
                data-testid={`checkbox-select-${part.id}`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{display.primary}</p>
                <p className="text-xs text-muted-foreground truncate">{display.secondary}</p>
                {isProductOrService && part.unitPrice && (
                  <p className="text-xs text-muted-foreground">${part.unitPrice}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isProductOrService && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleOpenEditDialog(part)}
                    data-testid={`button-edit-${part.id}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteClick(part)}
                  data-testid={`button-delete-${part.id}`}
                  disabled={deletePartMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="products-services-manager">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-semibold">Products & Services</h3>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products, services, filters, belts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-products"
              />
            </div>
            <Button
              size="sm"
              onClick={handleOpenAddDialog}
              data-testid="button-add-product"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add New
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <SelectionControls items={parts} label="products" />
          {debouncedSearch && (
            <span className="text-sm text-muted-foreground">
              {total} result{total !== 1 ? 's' : ''} found
            </span>
          )}
        </div>
        
        <BulkDeleteBar />
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : parts.length > 0 ? (
          <>
            <ItemGrid items={parts} />
            <div ref={loaderRef} className="flex justify-center py-4">
              {isFetchingNextPage && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
              {!hasNextPage && parts.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  Showing all {total} items
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {debouncedSearch ? (
              <p>No results found for "{debouncedSearch}"</p>
            ) : (
              <>
                <p>No products or services added yet</p>
                <p className="text-sm mt-1">Click "Add New" to create your first product or service</p>
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-product">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product/Service" : "Add New Product/Service"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "Update the details below." : "Fill in the details to create a new product or service."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-type">Item type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "service" | "product") => 
                  setFormData(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger id="item-type" data-testid="select-item-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter name"
                data-testid="input-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description"
                rows={3}
                data-testid="input-description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Cost ($)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                  placeholder="0.00"
                  data-testid="input-cost"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="unit-price">Unit Price ($)</Label>
                <Input
                  id="unit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, unitPrice: e.target.value }))}
                  placeholder="0.00"
                  data-testid="input-unit-price"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tax-exempt"
                checked={formData.taxExempt}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, taxExempt: checked as boolean }))
                }
                data-testid="checkbox-tax-exempt"
              />
              <Label htmlFor="tax-exempt" className="text-sm font-normal cursor-pointer">
                Exempt from Tax
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveProduct} 
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-create"
            >
              {editingProduct ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Items</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} selected item{selectedIds.size > 1 ? "s" : ""}? 
              This action cannot be undone and will also remove these items from any client associations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name || getPartDisplay(productToDelete || {} as Part).primary}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
