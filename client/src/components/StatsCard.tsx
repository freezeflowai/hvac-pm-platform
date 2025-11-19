import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: "default" | "warning" | "danger" | "success" | "neutral";
  subtitle?: string;
  onClick?: () => void;
  completedValue?: number;
}

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = "default",
  subtitle,
  onClick,
  completedValue
}: StatsCardProps) {
  const borderColorClass = {
    danger: 'border-t-status-overdue',
    warning: 'border-t-status-upcoming',
    default: 'border-t-status-this-month',
    success: 'border-t-status-this-month',
    neutral: 'border-t-status-unscheduled',
  }[variant];

  return (
    <Card 
      data-testid={`card-stats-${title.toLowerCase().replace(/\s+/g, '-')}`} 
      className={`bg-card shadow-sm border-t-4 ${borderColorClass} ${onClick ? 'cursor-pointer hover-elevate' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <p className="text-sm font-bold text-foreground mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          {completedValue !== undefined ? (
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold tabular-nums text-primary" data-testid={`text-stats-completed-${title.toLowerCase().replace(/\s+/g, '-')}`}>
                {completedValue}
              </p>
              <p className="text-lg font-bold text-muted-foreground">/</p>
              <p className="text-2xl font-bold tabular-nums" data-testid={`text-stats-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
                {value}
              </p>
            </div>
          ) : (
            <p className="text-2xl font-bold tabular-nums" data-testid={`text-stats-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
