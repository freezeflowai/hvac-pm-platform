import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Trash2, Plus, Pencil, Search, Loader2, Package, Wrench, Download, Upload, FileText } from "lucide-react";
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
  sku?: string | null;
  description?: string | null;
  cost?: string | null;
  markupPercent?: string | null;
  unitPrice?: string | null;
  isTaxable?: boolean | null;
  taxCode?: string | null;
  category?: string | null;
  isActive?: boolean | null;
  qboItemId?: string | null;
  qboSyncToken?: string | null;
  updatedAt?: string | null;
}

interface ProductFormData {
  type: "service" | "product";
  name: string;
  sku: string;
  description: string;
  cost: string;
  markupPercent: string;
  unitPrice: string;
  isTaxable: boolean;
  taxCode: string;
  category: string;
  isActive: boolean;
}

const defaultFormData: ProductFormData = {
  type: "product",
  name: "",
  sku: "",
  description: "",
  cost: "0.00",
  markupPercent: "",
  unitPrice: "0.00",
  isTaxable: true,
  taxCode: "",
  category: "",
  isActive: true,
};

interface PartsResponse {
  items: Part[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

const ITEMS_PER_PAGE = 50;

type TabCategory = "products" | "services";

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
  const [activeTab, setActiveTab] = useState<TabCategory>("products");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFileContent, setImportFileContent] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importUpdateExisting, setImportUpdateExisting] = useState(false);
  const productsLoaderRef = useRef<HTMLDivElement>(null);
  const servicesLoaderRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Clear selection when tab changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  // Products query
  const productsQuery = useInfiniteQuery<PartsResponse>({
    queryKey: ["/api/parts", "products", debouncedSearch],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String(pageParam),
        search: debouncedSearch,
        category: "products",
      });
      const res = await fetch(`/api/parts?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch products");
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

  // Services query
  const servicesQuery = useInfiniteQuery<PartsResponse>({
    queryKey: ["/api/parts", "services", debouncedSearch],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String(pageParam),
        search: debouncedSearch,
        category: "services",
      });
      const res = await fetch(`/api/parts?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch services");
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

  // Get current tab's data
  const currentQuery = activeTab === "products" ? productsQuery : servicesQuery;
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = currentQuery;

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

  const importMutation = useMutation({
    mutationFn: async ({ csvData, updateExisting }: { csvData: string; updateExisting: boolean }) => {
      const res = await apiRequest("POST", "/api/parts/import", { 
        csvData, 
        skipDuplicates: !updateExisting,
        updateExisting 
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      const { imported, skipped, updated, errors } = data;
      
      let description = `Imported ${imported} item${imported !== 1 ? 's' : ''}.`;
      if (updated > 0) {
        description += ` Updated ${updated} existing.`;
      }
      if (skipped > 0) {
        description += ` Skipped ${skipped} duplicate${skipped !== 1 ? 's' : ''}.`;
      }
      if (errors && errors.length > 0) {
        description += ` ${errors.length} error${errors.length !== 1 ? 's' : ''}.`;
      }
      
      toast({
        title: (imported > 0 || updated > 0) ? "Import Complete" : "Import Finished",
        description,
        variant: (imported > 0 || updated > 0) ? "default" : "destructive",
      });
      
      setImportDialogOpen(false);
      setImportFileContent("");
      setImportFileName("");
      setImportUpdateExisting(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to import products/services.",
        variant: "destructive",
      });
    },
  });

  const handleExport = async () => {
    try {
      const category = activeTab === "products" ? "products" : "services";
      const response = await fetch(`/api/parts/export?category=${category}`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${category}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Complete",
        description: `${activeTab === "products" ? "Products" : "Services"} exported successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data.",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportFileContent(content);
      setImportFileName(file.name);
      setImportDialogOpen(true);
    };
    reader.readAsText(file);
    
    if (event.target) event.target.value = '';
  };

  const handleImport = () => {
    if (!importFileContent) return;
    importMutation.mutate({ csvData: importFileContent, updateExisting: importUpdateExisting });
  };

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
      type: (product.type as "service" | "product") || "product",
      name: product.name || "",
      sku: product.sku || "",
      description: product.description || "",
      cost: product.cost || "0.00",
      markupPercent: product.markupPercent || "",
      unitPrice: product.unitPrice || "0.00",
      isTaxable: product.isTaxable ?? true,
      taxCode: product.taxCode || "",
      category: product.category || "",
      isActive: product.isActive ?? true,
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
      sku: formData.sku || null,
      description: formData.description || null,
      cost: formData.cost || null,
      markupPercent: formData.markupPercent || null,
      unitPrice: formData.unitPrice || null,
      isTaxable: formData.isTaxable,
      taxCode: formData.taxCode || null,
      category: formData.category || null,
      isActive: formData.isActive,
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

  // Intersection observer for infinite scroll - Products tab
  const handleProductsObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && productsQuery.hasNextPage && !productsQuery.isFetchingNextPage) {
      productsQuery.fetchNextPage();
    }
  }, [productsQuery.hasNextPage, productsQuery.isFetchingNextPage, productsQuery.fetchNextPage]);

  useEffect(() => {
    const option = { root: null, rootMargin: "100px", threshold: 0.1 };
    const observer = new IntersectionObserver(handleProductsObserver, option);
    if (productsLoaderRef.current) observer.observe(productsLoaderRef.current);
    return () => observer.disconnect();
  }, [handleProductsObserver]);

  // Intersection observer for infinite scroll - Services tab
  const handleServicesObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && servicesQuery.hasNextPage && !servicesQuery.isFetchingNextPage) {
      servicesQuery.fetchNextPage();
    }
  }, [servicesQuery.hasNextPage, servicesQuery.isFetchingNextPage, servicesQuery.fetchNextPage]);

  useEffect(() => {
    const option = { root: null, rootMargin: "100px", threshold: 0.1 };
    const observer = new IntersectionObserver(handleServicesObserver, option);
    if (servicesLoaderRef.current) observer.observe(servicesLoaderRef.current);
    return () => observer.disconnect();
  }, [handleServicesObserver]);

  const getPartDisplay = (part: Part) => {
    return {
      primary: part.name || "",
      secondary: part.sku || "",
      description: part.description || "",
      category: part.category || "",
    };
  };

  const calculateMargin = (part: Part): string => {
    const cost = parseFloat(part.cost || "0");
    const unitPrice = parseFloat(part.unitPrice || "0");
    if (cost > 0 && unitPrice > 0) {
      const margin = ((unitPrice - cost) / cost) * 100;
      return `${margin.toFixed(0)}%`;
    }
    return "";
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
      {items.map((part) => {
        const display = getPartDisplay(part);
        const margin = calculateMargin(part);
        const partType = part.type === 'filter' ? 'Filter' : part.type === 'belt' ? 'Belt' : part.category || '';
        return (
          <Card key={part.id} data-testid={`card-item-${part.id}`} className={part.isActive === false ? "opacity-50" : ""}>
            <CardContent className="p-2.5 flex items-start justify-between gap-2">
              <Checkbox
                checked={selectedIds.has(part.id)}
                onCheckedChange={(checked) => handleSelectOne(part.id, checked as boolean)}
                className="mt-0.5"
                data-testid={`checkbox-select-${part.id}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-sm truncate" data-testid={`text-name-${part.id}`}>{display.primary}</p>
                  {partType && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground shrink-0" data-testid={`badge-category-${part.id}`}>
                      {partType}
                    </span>
                  )}
                </div>
                {display.secondary && (
                  <p className="text-xs text-muted-foreground truncate" data-testid={`text-sku-${part.id}`}>{display.secondary}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                {part.unitPrice && (
                  <span className="text-sm font-medium" data-testid={`text-price-${part.id}`}>${part.unitPrice}</span>
                )}
                {part.cost && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span data-testid={`text-cost-${part.id}`}>${part.cost}</span>
                    {margin && <span className="text-green-600" data-testid={`text-margin-${part.id}`}>{margin}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleOpenEditDialog(part)}
                  data-testid={`button-edit-${part.id}`}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
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

  const productsTotal = productsQuery.data?.pages[0]?.total ?? 0;
  const servicesTotal = servicesQuery.data?.pages[0]?.total ?? 0;
  const productsParts = productsQuery.data?.pages.flatMap(page => page.items) ?? [];
  const servicesParts = servicesQuery.data?.pages.flatMap(page => page.items) ?? [];

  const TabContent = ({ 
    items, 
    loaderRef, 
    query, 
    tabTotal, 
    emptyLabel 
  }: { 
    items: Part[]; 
    loaderRef: React.RefObject<HTMLDivElement | null>; 
    query: typeof productsQuery;
    tabTotal: number;
    emptyLabel: string;
  }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SelectionControls items={items} label={emptyLabel} />
        {debouncedSearch && (
          <span className="text-sm text-muted-foreground">
            {tabTotal} result{tabTotal !== 1 ? 's' : ''} found
          </span>
        )}
      </div>
      
      <BulkDeleteBar />
      
      {query.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length > 0 ? (
        <>
          <ItemGrid items={items} />
          <div ref={loaderRef} className="flex justify-center py-4">
            {query.isFetchingNextPage && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
            {!query.hasNextPage && items.length > 0 && (
              <span className="text-sm text-muted-foreground">
                Showing all {tabTotal} items
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
              <p>No {emptyLabel} added yet</p>
              <p className="text-sm mt-1">Click "Add New" to create your first {emptyLabel.slice(0, -1)}</p>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="products-services-manager">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-semibold">Products & Services</h3>
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">v2.0</span>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={activeTab === "products" ? "Search products, filters, belts..." : "Search services..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-products"
              />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".csv"
              className="hidden"
              data-testid="input-file-import"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-import"
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              data-testid="button-export"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
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
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabCategory)} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="products" data-testid="tab-products" className="gap-2">
              <Package className="h-4 w-4" />
              Products ({productsTotal})
            </TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services" className="gap-2">
              <Wrench className="h-4 w-4" />
              Services ({servicesTotal})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="products" className="mt-4">
            <TabContent 
              items={productsParts} 
              loaderRef={productsLoaderRef} 
              query={productsQuery}
              tabTotal={productsTotal}
              emptyLabel="products"
            />
          </TabsContent>
          
          <TabsContent value="services" className="mt-4">
            <TabContent 
              items={servicesParts} 
              loaderRef={servicesLoaderRef} 
              query={servicesQuery}
              tabTotal={servicesTotal}
              emptyLabel="services"
            />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-[550px]" data-testid="dialog-product">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Item" : "Add New Item"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "Update the item details below." : "Fill in the details to create a new product or service."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="item-type">Type</Label>
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
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="e.g. HVAC-001"
                  data-testid="input-sku"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter item name"
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
                rows={2}
                data-testid="input-description"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g. HVAC Parts, Labor"
                data-testid="input-category"
              />
            </div>
            
            <div className="border-t pt-3 mt-3">
              <p className="text-sm font-medium mb-3">Pricing</p>
              <div className="grid grid-cols-3 gap-3">
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
                  <Label htmlFor="markup-percent">Markup (%)</Label>
                  <Input
                    id="markup-percent"
                    type="number"
                    step="1"
                    min="0"
                    value={formData.markupPercent}
                    onChange={(e) => setFormData(prev => ({ ...prev, markupPercent: e.target.value }))}
                    placeholder="e.g. 50"
                    data-testid="input-markup-percent"
                  />
                  <p className="text-[10px] text-muted-foreground">If set, calculates unit price</p>
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
            </div>
            
            <div className="border-t pt-3 mt-3">
              <p className="text-sm font-medium mb-3">Tax Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is-taxable"
                    checked={formData.isTaxable}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, isTaxable: checked as boolean }))
                    }
                    data-testid="checkbox-is-taxable"
                  />
                  <Label htmlFor="is-taxable" className="text-sm font-normal cursor-pointer">
                    Taxable
                  </Label>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tax-code">Tax Code</Label>
                  <Input
                    id="tax-code"
                    value={formData.taxCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, taxCode: e.target.value }))}
                    placeholder="e.g. TAX"
                    data-testid="input-tax-code"
                    disabled={!formData.isTaxable}
                  />
                </div>
              </div>
            </div>
            
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, isActive: checked as boolean }))
                  }
                  data-testid="checkbox-is-active"
                />
                <Label htmlFor="is-active" className="text-sm font-normal cursor-pointer">
                  Active (visible in item lists)
                </Label>
              </div>
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

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-[550px]" data-testid="dialog-import">
          <DialogHeader>
            <DialogTitle>Import Products & Services</DialogTitle>
            <DialogDescription>
              Import products and services from a CSV file.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{importFileName}</p>
                <p className="text-xs text-muted-foreground">
                  {importFileContent.split('\n').length - 1} rows to import
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border rounded-md">
              <Checkbox
                id="update-existing"
                checked={importUpdateExisting}
                onCheckedChange={(checked) => setImportUpdateExisting(checked as boolean)}
                data-testid="checkbox-update-existing"
              />
              <Label htmlFor="update-existing" className="text-sm font-normal cursor-pointer">
                Update existing items (match by name)
              </Label>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium">Expected CSV columns:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li><span className="font-medium">name</span> (required) - Product or service name</li>
                <li><span className="font-medium">type</span> (required) - "product" or "service"</li>
                <li><span className="font-medium">sku</span> - SKU / item code</li>
                <li><span className="font-medium">description</span> - Item description</li>
                <li><span className="font-medium">cost</span> - Your cost</li>
                <li><span className="font-medium">markup_percent</span> - Markup percentage</li>
                <li><span className="font-medium">unit_price</span> - Selling price</li>
                <li><span className="font-medium">is_taxable</span> - "true" or "false"</li>
                <li><span className="font-medium">tax_code</span> - Tax code for QBO</li>
                <li><span className="font-medium">category</span> - Category name</li>
                <li><span className="font-medium">is_active</span> - "true" or "false"</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setImportDialogOpen(false);
                setImportFileContent("");
                setImportFileName("");
                setImportUpdateExisting(false);
              }}
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleImport}
              disabled={importMutation.isPending}
              data-testid="button-confirm-import"
              className="gap-2"
            >
              {importMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
