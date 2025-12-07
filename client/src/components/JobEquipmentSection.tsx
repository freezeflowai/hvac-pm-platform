import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Wrench, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { LocationEquipment, JobEquipment } from "@shared/schema";
import { format } from "date-fns";

interface JobEquipmentWithDetails extends JobEquipment {
  equipment: LocationEquipment;
}

interface JobEquipmentSectionProps {
  jobId: string;
  locationId: string | null;
}

const EQUIPMENT_TYPES: Record<string, string> = {
  rtu: "Rooftop Unit",
  split_system: "Split System",
  chiller: "Chiller",
  boiler: "Boiler",
  furnace: "Furnace",
  heat_pump: "Heat Pump",
  ahu: "Air Handler",
  vrf: "VRF System",
  walk_in_cooler: "Walk-in Cooler",
  walk_in_freezer: "Walk-in Freezer",
  reach_in_cooler: "Reach-in Cooler",
  reach_in_freezer: "Reach-in Freezer",
  ice_machine: "Ice Machine",
  exhaust_fan: "Exhaust Fan",
  makeup_air: "Makeup Air",
  other: "Other",
};

export default function JobEquipmentSection({ jobId, locationId }: JobEquipmentSectionProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const { data: jobEquipment = [], isLoading: jobEquipmentLoading } = useQuery<JobEquipmentWithDetails[]>({
    queryKey: ["/api/jobs", jobId, "equipment"],
  });

  const { data: locationEquipment = [], isLoading: locationEquipmentLoading } = useQuery<LocationEquipment[]>({
    queryKey: ["/api/locations", locationId, "equipment"],
    enabled: !!locationId,
  });

  const addMutation = useMutation({
    mutationFn: async (data: { equipmentId: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/equipment`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "equipment"] });
      setIsAddDialogOpen(false);
      setSelectedEquipmentId("");
      setNotes("");
      toast({
        title: "Equipment Added",
        description: "The equipment has been linked to this job.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add equipment to job.",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (jobEquipmentId: string) => {
      await apiRequest("DELETE", `/api/jobs/${jobId}/equipment/${jobEquipmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "equipment"] });
      toast({
        title: "Equipment Removed",
        description: "The equipment has been unlinked from this job.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove equipment from job.",
        variant: "destructive",
      });
    },
  });

  const handleAddEquipment = () => {
    if (selectedEquipmentId) {
      addMutation.mutate({ equipmentId: selectedEquipmentId, notes: notes || undefined });
    }
  };

  const linkedEquipmentIds = new Set(jobEquipment.map(je => je.equipmentId));
  const availableEquipment = locationEquipment.filter(e => !linkedEquipmentIds.has(e.id));

  const getEquipmentTypeLabel = (type: string | null) => {
    if (!type) return "-";
    return EQUIPMENT_TYPES[type] || type;
  };

  if (jobEquipmentLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Equipment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-job-equipment">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Equipment
            </CardTitle>
            <CardDescription>
              Equipment serviced on this job
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                disabled={!locationId || availableEquipment.length === 0}
                data-testid="button-add-job-equipment"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Equipment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Equipment to Job</DialogTitle>
                <DialogDescription>
                  Select equipment from this location to link to this job for service tracking.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Equipment</label>
                  <Select
                    value={selectedEquipmentId}
                    onValueChange={setSelectedEquipmentId}
                  >
                    <SelectTrigger data-testid="select-job-equipment">
                      <SelectValue placeholder="Select equipment..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEquipment.map(eq => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.name} ({getEquipmentTypeLabel(eq.equipmentType)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Service notes for this equipment..."
                    data-testid="input-job-equipment-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" data-testid="button-cancel-job-equipment">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={handleAddEquipment}
                  disabled={!selectedEquipmentId || addMutation.isPending}
                  data-testid="button-save-job-equipment"
                >
                  {addMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  Add to Job
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!locationId ? (
          <div className="text-center py-6 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No location assigned to this job.</p>
          </div>
        ) : jobEquipment.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No equipment linked to this job.</p>
            {availableEquipment.length === 0 && locationEquipment.length === 0 ? (
              <p className="text-sm mt-1">No equipment registered at this location yet.</p>
            ) : availableEquipment.length === 0 ? (
              <p className="text-sm mt-1">All location equipment is already linked.</p>
            ) : (
              <p className="text-sm mt-1">Click "Add Equipment" to link equipment from the location.</p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Make/Model</TableHead>
                <TableHead>Serial #</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-16">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobEquipment.map(je => (
                <TableRow key={je.id} data-testid={`row-job-equipment-${je.id}`}>
                  <TableCell className="font-medium">{je.equipment.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {getEquipmentTypeLabel(je.equipment.equipmentType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {je.equipment.manufacturer || je.equipment.modelNumber ? (
                      <span className="text-sm">
                        {je.equipment.manufacturer}
                        {je.equipment.manufacturer && je.equipment.modelNumber ? " - " : ""}
                        {je.equipment.modelNumber}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {je.equipment.serialNumber || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {je.notes ? (
                      <span className="text-sm">{je.notes}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMutation.mutate(je.id)}
                      disabled={removeMutation.isPending}
                      data-testid={`button-remove-job-equipment-${je.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
