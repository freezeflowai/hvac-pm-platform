import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

export interface MaintenanceItem {
  id: string;
  companyName: string;
  location?: string | null;
  selectedMonths: number[];
  nextDue: Date;
  status: "overdue" | "upcoming" | "completed";
}

interface MaintenanceCardProps {
  item: MaintenanceItem;
  onMarkComplete: (id: string) => void;
  onEdit: (id: string) => void;
  parts?: ClientPart[];
  isCompleted?: boolean;
}

interface ClientPart {
  id: string;
  partId: string;
  quantity: number;
  part: {
    id: string;
    name: string;
    type: string;
    size: string;
  };
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function MaintenanceCard({ item, onMarkComplete, onEdit, parts = [], isCompleted = false }: MaintenanceCardProps) {
  const [, setLocation] = useLocation();
  const isOverdue = item.status === "overdue";
  const monthsDisplay = item.selectedMonths.map(m => MONTH_NAMES[m]).join(", ");

  const handleCardClick = () => {
    setLocation(`/client-report/${item.id}`);
  };

  return (
    <Card 
      className={`hover-elevate cursor-pointer ${isOverdue ? 'border-destructive' : ''}`}
      data-testid={`card-maintenance-${item.id}`}
      onClick={handleCardClick}
    >
      <CardContent className="p-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
              <h3 className="font-semibold text-sm" data-testid={`text-company-${item.id}`}>
                {item.companyName}
              </h3>
              {item.location && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                  <span data-testid={`text-location-${item.id}`}>{item.location}</span>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              <div className="text-muted-foreground">
                {monthsDisplay}
              </div>
              {parts.length > 0 && (
                <div className="mt-0.5">
                  <div className="flex flex-wrap gap-1">
                    {parts.map(cp => (
                      <Badge key={cp.id} variant="outline" className="text-[10px] px-1 py-0 h-4">
                        {cp.quantity}x {cp.part.name} ({cp.part.size})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button
              size="icon"
              variant={isCompleted ? "default" : "outline"}
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete(item.id);
              }}
              data-testid={`button-complete-${item.id}`}
              title={isCompleted ? "Reopen" : "Complete"}
              aria-label={isCompleted ? "Reopen maintenance" : "Mark maintenance complete"}
            >
              <CheckCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
