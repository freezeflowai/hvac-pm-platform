import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, CheckCircle, AlertTriangle } from "lucide-react";
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
  isScheduled?: boolean;
  isThisMonthPM?: boolean;
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

export default function MaintenanceCard({ item, onMarkComplete, onEdit, parts = [], isCompleted = false, isScheduled = false, isThisMonthPM = false }: MaintenanceCardProps) {
  const [, setLocation] = useLocation();
  const isOverdue = item.status === "overdue";
  const monthsDisplay = item.selectedMonths.map(m => MONTH_NAMES[m]).join(", ");

  const handleCardClick = () => {
    const clientId = item.id.includes('|') ? item.id.split('|')[0] : item.id;
    setLocation(`/client-report/${clientId}`);
  };

  const getStatusStyles = () => {
    // White background with subtle border for all cards
    return 'border-border';
  };

  const getIconColor = () => {
    // Keep icon colors for status indication
    if (isCompleted) return 'text-primary';
    if (isOverdue) return 'text-status-overdue';
    
    if (isThisMonthPM && !isScheduled) return 'text-status-unscheduled';
    
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    if (item.nextDue <= weekFromNow && !isOverdue) return 'text-status-upcoming';
    
    if (isScheduled) return 'text-status-this-month';
    
    return 'text-muted-foreground';
  };

  return (
    <Card 
      className={`bg-card hover-elevate cursor-pointer shadow-sm rounded-xl border ${getStatusStyles()}`}
      data-testid={`card-maintenance-${item.id}`}
      onClick={handleCardClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="space-y-0.5">
              <h3 className="font-bold text-sm leading-tight" data-testid={`text-company-${item.id}`}>
                {item.companyName}
              </h3>
              {item.location && (
                <p className="text-xs text-muted-foreground" data-testid={`text-location-${item.id}`}>
                  {item.location}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {monthsDisplay}
            </p>
            {parts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {parts.map(cp => (
                  <Badge key={cp.id} variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full font-normal">
                    {cp.quantity}x {cp.part.name} {cp.part.size}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            <Button
              size="icon"
              variant={isCompleted ? "default" : "ghost"}
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete(item.id);
              }}
              data-testid={`button-complete-${item.id}`}
              title={isCompleted ? "Reopen" : "Complete"}
              aria-label={isCompleted ? "Reopen maintenance" : "Mark maintenance complete"}
              className={`h-7 w-7 rounded-full ${getIconColor()}`}
            >
              {isOverdue ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
