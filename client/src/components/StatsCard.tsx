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
}

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = "default",
  subtitle,
  trend,
  trendValue,
  total
}: StatsCardProps) {
  const variantClasses = {
    default: "text-muted-foreground",
    warning: "text-yellow-600 dark:text-yellow-500",
    danger: "text-destructive",
    success: "text-green-600 dark:text-green-500",
  };

  const bgVariantClasses = {
    default: "bg-muted",
    warning: "bg-yellow-50 dark:bg-yellow-950/20",
    danger: "bg-destructive/10",
    success: "bg-green-50 dark:bg-green-950/20",
  };

  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="h-3 w-3" />;
    if (trend === "down") return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (variant === "danger") {
      return trend === "down" ? "text-green-600 dark:text-green-500" : "text-destructive";
    }
    if (trend === "up") return "text-green-600 dark:text-green-500";
    if (trend === "down") return "text-destructive";
    return "text-muted-foreground";
  };

  const percentage = total && total > 0 ? Math.round((value / total) * 100) : null;

  return (
    <Card data-testid={`card-stats-${title.toLowerCase().replace(/\s+/g, '-')}`} className={bgVariantClasses[variant]}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${variantClasses[variant]}`} />
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-3xl font-bold tabular-nums" data-testid={`text-stats-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </div>
          {percentage !== null && (
            <Badge variant="outline" className="text-xs font-normal">
              {percentage}%
            </Badge>
          )}
        </div>
        {(subtitle || trendValue) && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            {trendValue && trend && (
              <span className={`flex items-center gap-1 font-medium ${getTrendColor()}`}>
                {getTrendIcon()}
                {trendValue}
              </span>
            )}
            {subtitle && (
              <span className="text-muted-foreground">{subtitle}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
