import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MaintenanceCard, { MaintenanceItem } from "./MaintenanceCard";

interface MaintenanceSectionProps {
  title: string;
  items: MaintenanceItem[];
  onMarkComplete: (id: string) => void;
  emptyMessage?: string;
}

export default function MaintenanceSection({
  title,
  items,
  onMarkComplete,
  emptyMessage = "No items"
}: MaintenanceSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item) => (
              <MaintenanceCard
                key={item.id}
                item={item}
                onMarkComplete={onMarkComplete}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
