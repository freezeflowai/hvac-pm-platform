import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, CheckCircle, Pencil, Package } from "lucide-react";
import { format } from "date-fns";

export interface MaintenanceItem {
  id: string;
  companyName: string;
  location: string;
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
  const isOverdue = item.status === "overdue";
  const monthsDisplay = item.selectedMonths.map(m => MONTH_NAMES[m]).join(", ");

  return (
    <Card 
      className={`hover-elevate ${isOverdue ? 'border-destructive' : ''}`}
      data-testid={`card-maintenance-${item.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="font-semibold text-base" data-testid={`text-company-${item.id}`}>
                {item.companyName}
              </h3>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span data-testid={`text-location-${item.id}`}>{item.location}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span data-testid={`text-due-date-${item.id}`}>
                  Due: {format(item.nextDue, "MMM d, yyyy")}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Months: {monthsDisplay}
              </div>
              {parts.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1 text-xs font-medium">
                    <Package className="h-3 w-3" />
                    <span>Required Parts:</span>
                  </div>
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
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(item.id)}
              data-testid={`button-edit-${item.id}`}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={isCompleted ? "default" : "outline"}
              onClick={() => onMarkComplete(item.id)}
              data-testid={`button-complete-${item.id}`}
              className="gap-2"
            >
              <CheckCircle className="h-3 w-3" />
              {isCompleted ? "Reopen" : "Complete"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
