import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, CheckCircle, Pencil } from "lucide-react";
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
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-base" data-testid={`text-company-${item.id}`}>
                {item.companyName}
              </h3>
              {item.location && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span data-testid={`text-location-${item.id}`}>{item.location}</span>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 text-xs">
              <div className="text-muted-foreground">
                PM Schedule: {monthsDisplay}
              </div>
              {parts.length > 0 && (
                <div className="mt-1">
                  <div className="flex flex-wrap gap-1">
                    {parts.map(cp => (
                      <Badge key={cp.id} variant="outline" className="text-xs">
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
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item.id);
              }}
              data-testid={`button-edit-${item.id}`}
              className="h-8 w-8"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={isCompleted ? "default" : "outline"}
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete(item.id);
              }}
              data-testid={`button-complete-${item.id}`}
              className="gap-1.5"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isCompleted ? "Reopen" : "Complete"}</span>
              <span className="sm:hidden">{isCompleted ? "Undo" : "Done"}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
