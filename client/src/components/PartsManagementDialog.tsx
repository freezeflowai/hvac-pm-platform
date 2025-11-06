import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Part {
  id: string;
  name: string;
  type: string;
  size: string;
}

interface PartsManagementDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function PartsManagementDialog({ open, onClose }: PartsManagementDialogProps) {
  const { toast } = useToast();
  const [newPart, setNewPart] = useState({
    name: "",
    type: "filter",
    size: "",
  });

  const { data: parts = [], isLoading } = useQuery<Part[]>({
    queryKey: ["/api/parts"],
    enabled: open,
  });

  const createPartMutation = useMutation({
    mutationFn: async (part: typeof newPart) => {
      const res = await apiRequest("POST", "/api/parts", part);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      setNewPart({ name: "", type: "filter", size: "" });
      toast({
        title: "Part added",
        description: "The part has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add part.",
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

  const handleAddPart = () => {
    if (!newPart.name || !newPart.size) return;
    createPartMutation.mutate(newPart);
  };

  const filterParts = parts.filter(p => p.type === "filter");
  const beltParts = parts.filter(p => p.type === "belt");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-parts-management">
        <DialogHeader>
          <DialogTitle>Manage Parts Inventory</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="font-semibold">Add New Part</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partName">Name</Label>
                <Input
                  id="partName"
                  data-testid="input-part-name"
                  value={newPart.name}
                  onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                  placeholder="e.g., MERV 11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partType">Type</Label>
                <Select
                  value={newPart.type}
                  onValueChange={(value) => setNewPart({ ...newPart, type: value })}
                >
                  <SelectTrigger id="partType" data-testid="select-part-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filter">Filter</SelectItem>
                    <SelectItem value="belt">Belt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="partSize">Size</Label>
                <Input
                  id="partSize"
                  data-testid="input-part-size"
                  value={newPart.size}
                  onChange={(e) => setNewPart({ ...newPart, size: e.target.value })}
                  placeholder="e.g., 16x20x1"
                />
              </div>
              <div className="space-y-2">
                <Label className="invisible">Add</Label>
                <Button
                  onClick={handleAddPart}
                  data-testid="button-add-part"
                  disabled={!newPart.name || !newPart.size || createPartMutation.isPending}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Part
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Filters</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : filterParts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filterParts.map((part) => (
                  <Card key={part.id} data-testid={`card-part-${part.id}`}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{part.name}</p>
                        <p className="text-xs text-muted-foreground">{part.size}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deletePartMutation.mutate(part.id)}
                        data-testid={`button-delete-part-${part.id}`}
                        disabled={deletePartMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No filters added yet</p>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Belts</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : beltParts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {beltParts.map((part) => (
                  <Card key={part.id} data-testid={`card-part-${part.id}`}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{part.name}</p>
                        <p className="text-xs text-muted-foreground">{part.size}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deletePartMutation.mutate(part.id)}
                        data-testid={`button-delete-part-${part.id}`}
                        disabled={deletePartMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No belts added yet</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
