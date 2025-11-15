import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: "default" | "warning" | "danger" | "success";
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  total?: number;
  onClick?: () => void;
}

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = "default",
  subtitle,
  trend,
  trendValue,
  total,
  onClick
}: StatsCardProps) {
  const variantClasses = {
    default: {
      bg: "bg-card border-border",
      icon: "text-muted-foreground",
      number: "text-foreground"
    },
    warning: {
      bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900",
      icon: "text-yellow-600 dark:text-yellow-500",
      number: "text-yellow-700 dark:text-yellow-400"
    },
    danger: {
      bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900",
      icon: "text-red-600 dark:text-red-500",
      number: "text-red-700 dark:text-red-400"
    },
    success: {
      bg: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
      icon: "text-green-600 dark:text-green-500",
      number: "text-green-700 dark:text-green-400"
    },
  };

  const currentVariant = variantClasses[variant];

  return (
    <Card 
      data-testid={`card-stats-${title.toLowerCase().replace(/\s+/g, '-')}`} 
      className={`${currentVariant.bg} shadow-sm ${onClick ? 'cursor-pointer hover-elevate' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
            <p className="text-3xl font-bold tabular-nums mb-1" data-testid={`text-stats-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={`rounded-full p-3 ${currentVariant.bg}`}>
            <Icon className={`h-5 w-5 ${currentVariant.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
