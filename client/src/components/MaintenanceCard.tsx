import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, CheckCircle, Pencil } from "lucide-react";
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
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function MaintenanceCard({ item, onMarkComplete, onEdit }: MaintenanceCardProps) {
  const isOverdue = item.status === "overdue";
  const isCompleted = item.status === "completed";

  const monthsDisplay = item.selectedMonths.length > 3
    ? `${item.selectedMonths.length} months/year`
    : item.selectedMonths.map(m => MONTH_NAMES[m]).join(", ");

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
              <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-xs">
                {monthsDisplay}
              </Badge>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span data-testid={`text-location-${item.id}`}>{item.location}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span data-testid={`text-due-date-${item.id}`}>
                  Due: {format(item.nextDue, "MMM d, yyyy")}
                </span>
              </div>
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
            {!isCompleted && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMarkComplete(item.id)}
                data-testid={`button-complete-${item.id}`}
                className="gap-2"
              >
                <CheckCircle className="h-3 w-3" />
                Complete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
