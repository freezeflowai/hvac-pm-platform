import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface PartItem {
  description: string;
  quantity: number;
  date?: string;
}

interface DayData {
  dayName: string;
  dateLabel: string;
  date: Date;
}

interface PartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  parts: PartItem[];
  weekDays?: DayData[];
}

export function PartsDialog({ open, onOpenChange, title, parts, weekDays }: PartsDialogProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>("week");

  const filteredParts = selectedFilter === "week" 
    ? parts 
    : parts.filter(p => p.date === selectedFilter);

  const groupedParts = filteredParts
    .reduce((acc, part) => {
      const existing = acc.find(p => p.description === part.description);
      if (existing) {
        existing.quantity += part.quantity;
      } else {
        acc.push({ ...part });
      }
      return acc;
    }, [] as PartItem[])
    .sort((a, b) => a.description.localeCompare(b.description));

  const partsByDate = parts.reduce((acc, part) => {
    if (part.date) {
      if (!acc[part.date]) acc[part.date] = [];
      acc[part.date].push(part);
    }
    return acc;
  }, {} as Record<string, PartItem[]>);

  const totalParts = groupedParts.reduce((sum, part) => sum + part.quantity, 0);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedFilter("week");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <button
          onClick={() => handleOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          data-testid="button-close-parts-dialog"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <DialogHeader>
          <DialogTitle className="text-base font-semibold pr-6">
            Parts for this schedule
          </DialogTitle>
        </DialogHeader>

        {weekDays && weekDays.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-3 border-b">
            <Button
              variant={selectedFilter === "week" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedFilter("week")}
              data-testid="filter-parts-week"
            >
              This Week
            </Button>
            {weekDays.map((day) => {
              const dateKey = day.date.toISOString().split('T')[0];
              const dayPartCount = (partsByDate[dateKey] || []).reduce((sum, p) => sum + p.quantity, 0);
              return (
                <Button
                  key={dateKey}
                  variant={selectedFilter === dateKey ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedFilter(dateKey)}
                  data-testid={`filter-parts-${day.dayName.toLowerCase()}`}
                >
                  {day.dayName} {day.date.getDate()}
                  {dayPartCount > 0 && (
                    <span className="ml-1 text-[10px] opacity-70">({dayPartCount})</span>
                  )}
                </Button>
              );
            })}
          </div>
        )}

        <div className="space-y-4 pt-3">
          <div className="text-sm font-medium text-foreground">
            {selectedFilter === "week" ? "Week total" : "Day total"}: {totalParts} part{totalParts !== 1 ? 's' : ''}
          </div>

          <div className="bg-muted/30 rounded-md max-h-96 overflow-y-auto">
            {groupedParts.length > 0 ? (
              <table className="w-full text-sm" data-testid="parts-table">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Part</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide w-16">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedParts.map((part, index) => (
                    <tr 
                      key={index} 
                      className="border-b border-border/30 last:border-b-0 hover:bg-muted/50 transition-colors"
                      data-testid={`part-row-${index}`}
                    >
                      <td className="py-2 px-3 text-foreground">{part.description}</td>
                      <td className="py-2 px-3 text-right font-medium text-foreground tabular-nums">{part.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No parts scheduled</p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} data-testid="button-close-parts">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
