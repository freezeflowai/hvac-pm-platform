import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

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

  // Sync selected technicians when assignment changes
  useEffect(() => {
    if (assignment) {
      setSelectedTechs(assignment.assignedTechnicianIds || []);
    }
  }, [assignment?.id]);

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ['/api/technicians'],
    enabled: open,
  });

  const clientParts = bulkParts[client?.id] || [];

  const handleTechnicianChange = (techId: string, checked: boolean) => {
    const newTechs = checked 
      ? [...selectedTechs, techId]
      : selectedTechs.filter(id => id !== techId);
    setSelectedTechs(newTechs);
    onAssignTechnicians(assignment.id, newTechs);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{client?.companyName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {client?.location && (
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="text-sm font-medium">{client.location}</p>
            </div>
          )}
          {client?.address && (
            <div>
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="text-sm">{client.address}{client.city ? `, ${client.city}` : ''}</p>
            </div>
          )}
          
          <div>
            <p className="text-xs text-muted-foreground mb-2">Parts Inventory</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {clientParts.length > 0 ? (
                clientParts.map((cp: any) => {
                  const part = cp.part;
                  let label = '';
                  if (part?.type === 'filter') {
                    label = `${part.filterType} ${part.size}`;
                  } else if (part?.type === 'belt') {
                    label = `Belt ${part.beltType} ${part.size}`;
                  } else {
                    label = part?.name || 'Unknown';
                  }
                  return (
                    <div key={cp.id} className="flex justify-between text-xs items-center gap-2">
                      <span>{label}</span>
                      <Badge variant="secondary" className="text-xs">{cp.quantity}</Badge>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No parts assigned</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Assign Technicians</p>
            <div className="space-y-2">
              {technicians.length > 0 ? (
                technicians.map((tech: any) => (
                  <label key={tech.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTechs.includes(tech.id)}
                      onChange={(e) => handleTechnicianChange(tech.id, e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>{tech.firstName && tech.lastName ? `${tech.firstName} ${tech.lastName}` : tech.email}</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No technicians available</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
