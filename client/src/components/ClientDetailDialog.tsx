import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ClientReportDialog from "@/components/ClientReportDialog";

export function ClientDetailDialog({ 
  open, 
  onOpenChange, 
  client, 
  assignment, 
  onAssignTechnicians, 
  bulkParts 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  client: any; 
  assignment: any;
  onAssignTechnicians: (assignmentId: string, technicianIds: string[]) => void;
  bulkParts: Record<string, any[]>;
}) {
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [reportClientId, setReportClientId] = useState<string | null>(null);
  const { toast } = useToast();

  // Sync selected technicians and completion status when assignment changes
  useEffect(() => {
    if (assignment) {
      setSelectedTechs(assignment.assignedTechnicianIds || []);
      setIsCompleted(assignment.completed || false);
    }
  }, [assignment?.id]);

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ['/api/technicians'],
    enabled: open,
  });

  const clientParts = bulkParts[client?.id] || [];

  const toggleComplete = useMutation({
    mutationFn: async (completed: boolean) => {
      if (!assignment) return;
      return apiRequest("PATCH", `/api/calendar/assign/${assignment.id}`, {
        completed
      });
    },
    onSuccess: (_data, completed) => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/overdue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/statuses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/recently-completed'] });
      toast({
        title: completed ? "Marked as complete" : "Marked as incomplete",
        description: completed ? "Job marked as completed" : "Job moved back to active"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive"
      });
    }
  });

  const handleToggleComplete = () => {
    const newStatus = !isCompleted;
    setIsCompleted(newStatus);
    toggleComplete.mutate(newStatus);
  };

  const handleTechnicianToggle = (techId: string) => {
    const newTechs = selectedTechs.includes(techId)
      ? selectedTechs.filter(id => id !== techId)
      : [...selectedTechs, techId];
    setSelectedTechs(newTechs);
    onAssignTechnicians(assignment.id, newTechs);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  // Format full address
  const fullAddress = [
    client?.address,
    client?.city,
    client?.province,
    client?.postalCode
  ].filter(Boolean).join(', ');

  // Build parts list - only actual parts, no PM line item
  const partsList: Array<{ quantity: number; description: string }> = [];

  // Add each part as a separate line item
  clientParts.forEach((cp: any) => {
    const part = cp.part;
    let partLabel = '';
    
    if (part?.type === 'filter') {
      partLabel = `${part.filterType || 'Filter'} ${part.size || ''}`.trim();
    } else if (part?.type === 'belt') {
      partLabel = `Belt ${part.beltType || ''} ${part.size || ''}`.trim();
    } else {
      partLabel = part?.name || 'Other Part';
    }
    
    partsList.push({ 
      quantity: cp.quantity || 1, 
      description: partLabel
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          data-testid="button-close-dialog"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <DialogHeader>
          <DialogTitle className="text-base font-semibold pr-6">
            {client?.companyName} - Preventive Maintenance
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-normal">Visit</p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Completed Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="completed"
              checked={isCompleted}
              onCheckedChange={handleToggleComplete}
              data-testid="checkbox-completed"
            />
            <label
              htmlFor="completed"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Completed
            </label>
          </div>

          {/* Details Section */}
          <div>
            <h3 className="text-sm font-semibold mb-1">Details</h3>
            <div className="flex gap-2 text-sm">
              <span 
                className="text-primary hover:underline cursor-pointer" 
                onClick={() => setReportClientId(client?.id)}
                data-testid="link-client-details"
              >
                {client?.companyName}
              </span>
              <span className="text-muted-foreground">-</span>
              <span className="text-muted-foreground" data-testid="text-job-id">
                Job #{assignment?.id?.slice(0, 6)}
              </span>
            </div>
          </div>

          {/* Team Section */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Team</h3>
            <div className="space-y-2">
              {selectedTechs.map((techId) => {
                const tech = technicians.find((t: any) => t.id === techId);
                if (!tech) return null;
                const techName = tech.firstName && tech.lastName 
                  ? `${tech.firstName} ${tech.lastName}` 
                  : tech.email;
                return (
                  <div 
                    key={techId} 
                    className="flex items-center justify-between gap-2 text-sm p-2 rounded border"
                    data-testid={`team-member-${techId}`}
                  >
                    <span>{techName}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleTechnicianToggle(techId)}
                      data-testid={`button-remove-tech-${techId}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() => {
                  // Show available technicians to add
                  const availableTechs = technicians.filter((t: any) => !selectedTechs.includes(t.id));
                  if (availableTechs.length > 0) {
                    handleTechnicianToggle(availableTechs[0].id);
                  }
                }}
                data-testid="button-add-technician"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Location Section */}
          {fullAddress && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Location</h3>
              <p className="text-sm" data-testid="text-location">{fullAddress}</p>
            </div>
          )}

          {/* Start and End Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Start</h3>
              <p className="text-sm" data-testid="text-start-date">
                {assignment?.scheduledDate ? formatDate(assignment.scheduledDate) : "Not scheduled"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-1">End</h3>
              <p className="text-sm" data-testid="text-end-date">
                {assignment?.scheduledDate ? formatDate(assignment.scheduledDate) : "Not scheduled"}
              </p>
            </div>
          </div>

          {/* Parts */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Parts</h3>
            <div className="space-y-2 bg-muted/30 rounded-md p-3">
              {partsList.length > 0 ? (
                partsList.map((item, index) => (
                  <div 
                    key={index} 
                    className="flex justify-between text-sm"
                    data-testid={`part-item-${index}`}
                  >
                    <span>{item.description}</span>
                    <span className="font-medium">{item.quantity}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No parts assigned</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      <ClientReportDialog
        clientId={reportClientId}
        open={!!reportClientId}
        onOpenChange={(open) => {
          if (!open) {
            setReportClientId(null);
          }
        }}
      />
    </Dialog>
  );
}
