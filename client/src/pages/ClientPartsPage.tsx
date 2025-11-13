import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowLeft, Save, Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  type: string;
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
  const [activeType, setActiveType] = useState<string>("filter");
  const [openRowIndex, setOpenRowIndex] = useState<number | null>(null);

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

  // Memoize parts by type for efficient filtering
  const partsByType = useMemo(() => {
    return {
      filter: availableParts.filter((p: Part) => p.type === 'filter'),
      belt: availableParts.filter((p: Part) => p.type === 'belt'),
      other: availableParts.filter((p: Part) => p.type === 'other'),
    };
  }, [availableParts]);

  useEffect(() => {
    if (clientParts.length > 0 && rows.length === 0) {
      setRows(clientParts.map((cp: ClientPart) => ({
        id: cp.id,
        partId: cp.partId,
        quantity: cp.quantity,
        type: cp.part.type,
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
    setRows([...rows, { partId: '', quantity: 1, type: activeType, isNew: true }]);
  };

  const handleUpdateRow = (index: number, field: 'partId' | 'quantity', value: string | number) => {
    const updatedRows = [...rows];
    const row = updatedRows[index];
    
    if (field === 'partId') {
      const selectedPart = availableParts.find((p: Part) => p.id === value);
      if (selectedPart) {
        updatedRows[index] = { 
          ...row, 
          partId: value as string,
          type: selectedPart.type,
          isModified: !row.isNew 
        };
      }
    } else {
      updatedRows[index] = { 
        ...row, 
        quantity: value as number,
        isModified: !row.isNew 
      };
    }
    
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
        type: cp.part.type,
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

  const hasChanges = rows.some(row => row.isNew || row.isModified);

  const getFilteredRowsForType = (type: string) => {
    return rows.map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => row.type === type);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
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
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Manage Parts
          </h1>
          {client && (
            <p className="text-sm text-muted-foreground" data-testid="text-client-name">
              {client.companyName}
              {client.location && ` - ${client.location}`}
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="text-lg">Client Parts</CardTitle>
          <div className="flex gap-2">
            {hasChanges && (
              <Button
                onClick={handleSaveAll}
                disabled={isSaving}
                data-testid="button-save-all"
                size="sm"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save All
              </Button>
            )}
            <Button
              onClick={handleAddRow}
              data-testid="button-add-part"
              size="sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Part
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={activeType} onValueChange={setActiveType}>
            <TabsList className="grid w-full grid-cols-3 mb-4" data-testid="tabs-part-type">
              <TabsTrigger value="filter" data-testid="tab-filters">Filters</TabsTrigger>
              <TabsTrigger value="belt" data-testid="tab-belts">Belts</TabsTrigger>
              <TabsTrigger value="other" data-testid="tab-other">Other</TabsTrigger>
            </TabsList>

            {['filter', 'belt', 'other'].map((type) => {
              const filteredRows = getFilteredRowsForType(type);
              
              return (
                <TabsContent key={type} value={type} className="mt-0">
                  {isLoading ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">Loading parts...</div>
                  ) : filteredRows.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      No {type === 'filter' ? 'filters' : type === 'belt' ? 'belts' : 'other parts'} added yet. Click "Add Part" to get started.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="hidden md:grid grid-cols-[1fr,120px,48px] gap-3 pb-2 text-xs font-medium text-muted-foreground border-b">
                        <div>Part</div>
                        <div>Quantity</div>
                        <div></div>
                      </div>
                      {filteredRows.map(({ row, originalIndex }) => {
                      const selectedPart = getPart(row.partId);
                      const availablePartsForType = type === 'filter' ? partsByType.filter : 
                                                    type === 'belt' ? partsByType.belt : 
                                                    partsByType.other;
                      
                      return (
                        <div 
                          key={originalIndex} 
                          className="grid grid-cols-1 md:grid-cols-[1fr,120px,48px] gap-3 items-center" 
                          data-testid={`row-part-${originalIndex}`}
                        >
                          <div className="space-y-1.5 md:space-y-0">
                            <Label className="md:hidden text-xs">Part</Label>
                            <Popover 
                              open={openRowIndex === originalIndex} 
                              onOpenChange={(open) => setOpenRowIndex(open ? originalIndex : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={openRowIndex === originalIndex}
                                  className="w-full justify-between text-sm h-9"
                                  data-testid={`button-select-part-${originalIndex}`}
                                >
                                  <span className="truncate">
                                    {selectedPart ? getPartDisplayName(selectedPart) : "Select part..."}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder={`Search ${type}s...`} />
                                  <CommandList>
                                    <CommandEmpty>No parts found.</CommandEmpty>
                                    <ScrollArea className="h-[300px]">
                                      <CommandGroup>
                                        {availablePartsForType.map((part: Part) => (
                                          <CommandItem
                                            key={part.id}
                                            value={`${getPartDisplayName(part)}-${part.id}`}
                                            onSelect={() => {
                                              handleUpdateRow(originalIndex, 'partId', part.id);
                                              setOpenRowIndex(null);
                                            }}
                                            data-testid={`option-part-${part.id}`}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                row.partId === part.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {getPartDisplayName(part)}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </ScrollArea>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          
                          <div className="space-y-1.5 md:space-y-0">
                            <Label className="md:hidden text-xs">Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) => handleUpdateRow(originalIndex, 'quantity', parseInt(e.target.value) || 1)}
                              data-testid={`input-quantity-${originalIndex}`}
                              className="h-9"
                            />
                          </div>
                          
                          <div className="flex md:block justify-end">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDeleteRow(originalIndex)}
                              data-testid={`button-delete-${originalIndex}`}
                              className="h-9 w-9"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
