import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: "default" | "warning" | "danger";
}

export default function StatsCard({ title, value, icon: Icon, variant = "default" }: StatsCardProps) {
  const variantClasses = {
    default: "text-muted-foreground",
    warning: "text-yellow-600 dark:text-yellow-500",
    danger: "text-destructive",
  };

  return (
    <Card data-testid={`card-stats-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-1.5">
        <CardTitle className="text-xs font-medium">{title}</CardTitle>
        <Icon className={`h-3.5 w-3.5 ${variantClasses[variant]}`} />
      </CardHeader>
      <CardContent className="pb-2">
        <div className="text-2xl font-bold tabular-nums" data-testid={`text-stats-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
