import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface Client {
  id: string;
  companyName: string;
  location?: string | null;
}

interface Part {
  id: string;
  type: string;
  filterType?: string | null;
  beltType?: string | null;
  size?: string | null;
  name?: string | null;
  description?: string | null;
}

interface ClientPart {
  id: string;
  partId: string;
  quantity: number;
  part: Part;
}

interface PartRow {
  id?: string;
  partId: string;
  quantity: number;
  isNew?: boolean;
  isModified?: boolean;
}

const getPartDisplayName = (part: Part): string => {
  if (part.type === 'filter') {
    return `${part.filterType || 'Filter'} ${part.size || ''}`.trim();
  } else if (part.type === 'belt') {
    return `Belt ${part.beltType || ''} ${part.size || ''}`.trim();
  } else {
    return part.name || part.description || 'Other Part';
  }
};

export default function ClientPartsPage() {
  const [, params] = useRoute("/clients/:clientId/parts");
  const [, setLocation] = useLocation();
  const clientId = params?.clientId || "";
  const { toast } = useToast();
  const [rows, setRows] = useState<PartRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: client } = useQuery<Client>({
    queryKey: ['/api/clients', clientId],
    enabled: !!clientId,
  });

  const { data: clientParts = [], isLoading } = useQuery<ClientPart[]>({
    queryKey: ['/api/clients', clientId, 'parts'],
    enabled: !!clientId,
  });

  const { data: availableParts = [] } = useQuery<Part[]>({
    queryKey: ['/api/parts'],
  });

  useEffect(() => {
    if (clientParts.length > 0 && rows.length === 0) {
      setRows(clientParts.map((cp: ClientPart) => ({
        id: cp.id,
        partId: cp.partId,
        quantity: cp.quantity,
      })));
    }
  }, [clientParts, rows.length]);

  const handleAddRow = () => {
    if (availableParts.length === 0) {
      toast({
        title: "No parts available",
        description: "Please add parts to your inventory first.",
        variant: "destructive",
      });
      return;
    }
    setRows([...rows, { partId: '', quantity: 1, isNew: true }]);
  };

  const handleUpdateRow = (index: number, field: 'partId' | 'quantity', value: string | number) => {
    const updatedRows = [...rows];
    updatedRows[index] = { 
      ...updatedRows[index], 
      [field]: value,
      isModified: !updatedRows[index].isNew 
    };
    setRows(updatedRows);
  };

  const handleDeleteRow = async (index: number) => {
    const row = rows[index];
    
    if (row.isNew) {
      const updatedRows = [...rows];
      updatedRows.splice(index, 1);
      setRows(updatedRows);
      return;
    }

    if (row.id && window.confirm('Are you sure you want to delete this part?')) {
      try {
        await apiRequest('DELETE', `/api/client-parts/${row.id}`);
        queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'parts'] });
        queryClient.invalidateQueries({ queryKey: ['/api/reports/parts'] });
        const updatedRows = [...rows];
        updatedRows.splice(index, 1);
        setRows(updatedRows);
        toast({ title: "Success", description: "Part deleted successfully" });
      } catch (error) {
        toast({ title: "Error", description: "Failed to delete part", variant: "destructive" });
      }
    }
  };

  const handleSaveAll = async () => {
    const invalidRows = rows.filter(row => !row.partId || row.quantity <= 0);
    if (invalidRows.length > 0) {
      toast({
        title: "Validation Error",
        description: "Please ensure all parts have a valid selection and quantity greater than 0.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const partsData = rows.map(row => ({
        partId: row.partId,
        quantity: row.quantity,
      }));

      await apiRequest('POST', `/api/clients/${clientId}/parts`, { parts: partsData });
      
      await queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'parts'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/reports/parts'] });
      
      const updatedParts = await queryClient.fetchQuery({
        queryKey: ['/api/clients', clientId, 'parts'],
      });
      
      setRows((updatedParts as ClientPart[]).map((cp: ClientPart) => ({
        id: cp.id,
        partId: cp.partId,
        quantity: cp.quantity,
      })));
      
      toast({ title: "Success", description: "Parts saved successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save parts", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const getPart = (partId: string): Part | undefined => {
    return availableParts.find((p: Part) => p.id === partId);
  };

  const filterByType = (type: string): Part[] => {
    return availableParts.filter((p: Part) => p.type === type);
  };

  const hasChanges = rows.some(row => row.isNew || row.isModified);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Manage Parts
          </h1>
          {client && (
            <p className="text-muted-foreground" data-testid="text-client-name">
              {client.companyName}
              {client.location && ` - ${client.location}`}
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Client Parts</CardTitle>
          <div className="flex gap-2">
            {hasChanges && (
              <Button
                onClick={handleSaveAll}
                disabled={isSaving}
                data-testid="button-save-all"
              >
                <Save className="h-4 w-4 mr-2" />
                Save All Changes
              </Button>
            )}
            <Button
              onClick={handleAddRow}
              data-testid="button-add-part"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Part
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading parts...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No parts added yet. Click "Add Part" to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row, index) => {
                const selectedPart = getPart(row.partId);
                return (
                  <div key={index} className="flex gap-3 items-start" data-testid={`row-part-${index}`}>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`part-${index}`}>Part</Label>
                      <Select
                        value={row.partId}
                        onValueChange={(value) => handleUpdateRow(index, 'partId', value)}
                      >
                        <SelectTrigger id={`part-${index}`} data-testid={`select-part-${index}`}>
                          <SelectValue placeholder="Select a part">
                            {selectedPart && getPartDisplayName(selectedPart)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {filterByType('filter').length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                Filters
                              </div>
                              {filterByType('filter').map((part) => (
                                <SelectItem key={part.id} value={part.id}>
                                  {getPartDisplayName(part)}
                                </SelectItem>
                              ))}
                              <Separator className="my-2" />
                            </>
                          )}
                          {filterByType('belt').length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                Belts
                              </div>
                              {filterByType('belt').map((part) => (
                                <SelectItem key={part.id} value={part.id}>
                                  {getPartDisplayName(part)}
                                </SelectItem>
                              ))}
                              <Separator className="my-2" />
                            </>
                          )}
                          {filterByType('other').length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                Other Parts
                              </div>
                              {filterByType('other').map((part) => (
                                <SelectItem key={part.id} value={part.id}>
                                  {getPartDisplayName(part)}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="w-32 space-y-2">
                      <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                      <Input
                        id={`quantity-${index}`}
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => handleUpdateRow(index, 'quantity', parseInt(e.target.value) || 1)}
                        data-testid={`input-quantity-${index}`}
                      />
                    </div>
                    
                    <div className="pt-8">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDeleteRow(index)}
                        data-testid={`button-delete-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
