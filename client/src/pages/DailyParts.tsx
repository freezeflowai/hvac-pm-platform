import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DailyParts() {
  const { user } = useAuth();

  // Get parts needed for today
  const { data: dailyParts, isLoading } = useQuery({
    queryKey: ['/api/technician/daily-parts'],
    enabled: !!user?.id,
  });

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-4xl px-4 py-6">
          <div className="text-center py-8">Loading parts...</div>
        </main>
      </div>
    );
  }

  // Calculate totals by part type
  const partTotals: Record<string, { name: string; total: number }> = {};
  if (dailyParts) {
    for (const [partId, { part, quantity }] of Object.entries(dailyParts)) {
      const partName = part.name || `${part.type} - ${part.size}`;
      if (!partTotals[partName]) {
        partTotals[partName] = { name: partName, total: 0 };
      }
      partTotals[partName].total += quantity as number;
    }
  }

  const sortedParts = Object.values(partTotals).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Parts Required</h1>
          <p className="text-muted-foreground mt-1">{dateStr}</p>
        </div>

        {sortedParts.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Total Parts Needed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sortedParts.map((part) => (
                  <div key={part.name} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">{part.name}</span>
                    <span className="text-lg font-bold text-primary">{part.total}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No parts needed for today</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
