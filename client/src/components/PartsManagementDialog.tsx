import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
}

interface PartsManagementDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FilterRow {
  filterType: string;
  size: string;
}

interface BeltRow {
  beltType: string;
  size: string;
}

interface OtherRow {
  name: string;
  description: string;
}

export default function PartsManagementDialog({ open, onClose }: PartsManagementDialogProps) {
  const { toast } = useToast();
  const [filterRows, setFilterRows] = useState<FilterRow[]>([{ filterType: "Pleated", size: "" }]);
  const [beltRows, setBeltRows] = useState<BeltRow[]>([{ beltType: "A", size: "" }]);
  const [otherRows, setOtherRows] = useState<OtherRow[]>([{ name: "", description: "" }]);

  const { data: parts = [], isLoading } = useQuery<Part[]>({
    queryKey: ["/api/parts"],
    enabled: open,
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (parts: Partial<Part>[]) => {
      const res = await apiRequest("POST", "/api/parts/bulk", parts);
      return await res.json();
    },
    onSuccess: (data: { created: Part[]; errors?: Array<{ index: number; error: string }> }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      
      if (data.errors && data.errors.length > 0) {
        toast({
          title: "Partial success",
          description: `Created ${data.created.length} parts. ${data.errors.length} duplicates skipped.`,
        });
      } else {
        toast({
          title: "Parts added",
          description: `Successfully added ${data.created.length} parts.`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add parts.",
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
        title: "Part deleted",
        description: "The part has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete part.",
        variant: "destructive",
      });
    },
  });

  const handleSaveFilters = () => {
    const validRows = filterRows.filter(row => row.size.trim());
    if (validRows.length === 0) return;

    const parts = validRows.map(row => ({
      type: "filter",
      filterType: row.filterType,
      size: row.size,
    }));

    bulkCreateMutation.mutate(parts, {
      onSuccess: () => {
        setFilterRows([{ filterType: "Pleated", size: "" }]);
      }
    });
  };

  const handleSaveBelts = () => {
    const validRows = beltRows.filter(row => row.size.trim());
    if (validRows.length === 0) return;

    const parts = validRows.map(row => ({
      type: "belt",
      beltType: row.beltType,
      size: row.size,
    }));

    bulkCreateMutation.mutate(parts, {
      onSuccess: () => {
        setBeltRows([{ beltType: "A", size: "" }]);
      }
    });
  };

  const handleSaveOther = () => {
    const validRows = otherRows.filter(row => row.name.trim());
    if (validRows.length === 0) return;

    const parts = validRows.map(row => ({
      type: "other",
      name: row.name,
      description: row.description || null,
    }));

    bulkCreateMutation.mutate(parts, {
      onSuccess: () => {
        setOtherRows([{ name: "", description: "" }]);
      }
    });
  };

  const filterParts = parts.filter(p => p.type === "filter");
  const beltParts = parts.filter(p => p.type === "belt");
  const otherParts = parts.filter(p => p.type === "other");

  const getPartDisplay = (part: Part) => {
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
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" data-testid="dialog-parts-management">
        <DialogHeader>
          <DialogTitle>Manage Parts Inventory</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="filters" className="w-full">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-parts-types">
            <TabsTrigger value="filters" data-testid="tab-filters">Filters</TabsTrigger>
            <TabsTrigger value="belts" data-testid="tab-belts">Belts</TabsTrigger>
            <TabsTrigger value="other" data-testid="tab-other">Other</TabsTrigger>
          </TabsList>

          <TabsContent value="filters" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Add Filters</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFilterRows([...filterRows, { filterType: "Pleated", size: "" }])}
                  data-testid="button-add-filter-row"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                </Button>
              </div>

              <div className="space-y-2">
                {filterRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,2fr,auto] gap-2 items-end">
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Type</Label>}
                      <Select
                        value={row.filterType}
                        onValueChange={(value) => {
                          const newRows = [...filterRows];
                          newRows[index].filterType = value;
                          setFilterRows(newRows);
                        }}
                      >
                        <SelectTrigger data-testid={`select-filter-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pleated">Pleated</SelectItem>
                          <SelectItem value="Media">Media</SelectItem>
                          <SelectItem value="Ecology">Ecology</SelectItem>
                          <SelectItem value="Throwaway">Throwaway</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Size</Label>}
                      <Input
                        value={row.size}
                        onChange={(e) => {
                          const newRows = [...filterRows];
                          newRows[index].size = e.target.value;
                          setFilterRows(newRows);
                        }}
                        placeholder="e.g., 16x20x1"
                        data-testid={`input-filter-size-${index}`}
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setFilterRows(filterRows.filter((_, i) => i !== index))}
                      disabled={filterRows.length === 1}
                      data-testid={`button-remove-filter-row-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleSaveFilters}
                disabled={bulkCreateMutation.isPending || !filterRows.some(r => r.size.trim())}
                data-testid="button-save-filters"
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Save All Filters
              </Button>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-semibold">Existing Filters</h3>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : filterParts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filterParts.map((part) => {
                    const display = getPartDisplay(part);
                    return (
                      <Card key={part.id} data-testid={`card-part-${part.id}`}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{display.primary}</p>
                            <p className="text-xs text-muted-foreground">{display.secondary}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => deletePartMutation.mutate(part.id)}
                            data-testid={`button-delete-part-${part.id}`}
                            disabled={deletePartMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No filters added yet</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="belts" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Add Belts</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBeltRows([...beltRows, { beltType: "A", size: "" }])}
                  data-testid="button-add-belt-row"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                </Button>
              </div>

              <div className="space-y-2">
                {beltRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,2fr,auto] gap-2 items-end">
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Type</Label>}
                      <Select
                        value={row.beltType}
                        onValueChange={(value) => {
                          const newRows = [...beltRows];
                          newRows[index].beltType = value;
                          setBeltRows(newRows);
                        }}
                      >
                        <SelectTrigger data-testid={`select-belt-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Size</Label>}
                      <Input
                        value={row.size}
                        onChange={(e) => {
                          const newRows = [...beltRows];
                          newRows[index].size = e.target.value;
                          setBeltRows(newRows);
                        }}
                        placeholder="e.g., A42"
                        data-testid={`input-belt-size-${index}`}
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setBeltRows(beltRows.filter((_, i) => i !== index))}
                      disabled={beltRows.length === 1}
                      data-testid={`button-remove-belt-row-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleSaveBelts}
                disabled={bulkCreateMutation.isPending || !beltRows.some(r => r.size.trim())}
                data-testid="button-save-belts"
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Save All Belts
              </Button>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-semibold">Existing Belts</h3>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : beltParts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {beltParts.map((part) => {
                    const display = getPartDisplay(part);
                    return (
                      <Card key={part.id} data-testid={`card-part-${part.id}`}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{display.primary}</p>
                            <p className="text-xs text-muted-foreground">{display.secondary}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => deletePartMutation.mutate(part.id)}
                            data-testid={`button-delete-part-${part.id}`}
                            disabled={deletePartMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No belts added yet</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="other" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Add Other Parts</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOtherRows([...otherRows, { name: "", description: "" }])}
                  data-testid="button-add-other-row"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                </Button>
              </div>

              <div className="space-y-2">
                {otherRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr,3fr,auto] gap-2 items-end">
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Name</Label>}
                      <Input
                        value={row.name}
                        onChange={(e) => {
                          const newRows = [...otherRows];
                          newRows[index].name = e.target.value;
                          setOtherRows(newRows);
                        }}
                        placeholder="e.g., Motor Oil"
                        data-testid={`input-other-name-${index}`}
                      />
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Description</Label>}
                      <Input
                        value={row.description}
                        onChange={(e) => {
                          const newRows = [...otherRows];
                          newRows[index].description = e.target.value;
                          setOtherRows(newRows);
                        }}
                        placeholder="e.g., 5W-30 synthetic"
                        data-testid={`input-other-description-${index}`}
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setOtherRows(otherRows.filter((_, i) => i !== index))}
                      disabled={otherRows.length === 1}
                      data-testid={`button-remove-other-row-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleSaveOther}
                disabled={bulkCreateMutation.isPending || !otherRows.some(r => r.name.trim())}
                data-testid="button-save-other"
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Save All Other Parts
              </Button>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-semibold">Existing Other Parts</h3>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : otherParts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {otherParts.map((part) => {
                    const display = getPartDisplay(part);
                    return (
                      <Card key={part.id} data-testid={`card-part-${part.id}`}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{display.primary}</p>
                            {display.secondary && (
                              <p className="text-xs text-muted-foreground">{display.secondary}</p>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => deletePartMutation.mutate(part.id)}
                            data-testid={`button-delete-part-${part.id}`}
                            disabled={deletePartMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No other parts added yet</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
