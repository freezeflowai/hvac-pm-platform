import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: "default" | "warning" | "danger" | "success";
  subtitle?: string;
  onClick?: () => void;
}

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = "default",
  subtitle,
  onClick
}: StatsCardProps) {
  return (
    <Card 
      data-testid={`card-stats-${title.toLowerCase().replace(/\s+/g, '-')}`} 
      className={`bg-card shadow-sm ${onClick ? 'cursor-pointer hover-elevate' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <p className="text-sm font-bold text-foreground mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold tabular-nums" data-testid={`text-stats-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
