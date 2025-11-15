import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"monthly" | "weekly">("monthly");
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/calendar", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/calendar?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch calendar data");
      return res.json();
    }
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center py-8">Loading calendar...</div>
        </main>
      </div>
    );
  }

  const { assignments = [], clients = [] } = data || {};
  
  // Get unscheduled clients (active clients not in assignments for this month)
  const scheduledClientIds = new Set(assignments.map((a: any) => a.clientId));
  const unscheduledClients = clients.filter((c: any) => !c.inactive && !scheduledClientIds.has(c.id));

  // Create a map of assignments by day
  const assignmentsByDay: Record<number, any[]> = {};
  assignments.forEach((assignment: any) => {
    if (assignment.day) {
      if (!assignmentsByDay[assignment.day]) {
        assignmentsByDay[assignment.day] = [];
      }
      assignmentsByDay[assignment.day].push(assignment);
    }
  });

  // Render calendar grid
  const renderMonthlyView = () => {
    const days = [];
    const totalCells = Math.ceil((daysInMonth + firstDayOfMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const dayNumber = i - firstDayOfMonth + 1;
      const isValidDay = dayNumber > 0 && dayNumber <= daysInMonth;
      const dayAssignments = isValidDay ? (assignmentsByDay[dayNumber] || []) : [];

      days.push(
        <Card
          key={i}
          className={`min-h-24 ${!isValidDay ? "bg-muted/20" : "hover-elevate"}`}
          data-testid={isValidDay ? `calendar-day-${dayNumber}` : undefined}
        >
          <CardContent className="p-2">
            {isValidDay && (
              <>
                <div className="font-semibold text-sm mb-1">{dayNumber}</div>
                <div className="space-y-1">
                  {dayAssignments.map((assignment: any) => {
                    const client = clients.find((c: any) => c.id === assignment.clientId);
                    return (
                      <div
                        key={assignment.id}
                        className="text-xs p-1 bg-primary/10 rounded cursor-pointer"
                        data-testid={`assigned-client-${assignment.id}`}
                      >
                        {client?.companyName || "Unknown"}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      );
    }

    return days;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={previousMonth}
              data-testid="button-previous-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-bold">
              {monthNames[month - 1]} {year}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={nextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={goToToday}
              data-testid="button-today"
            >
              Today
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value={view} onValueChange={(v) => setView(v as "monthly" | "weekly")}>
              <SelectTrigger className="w-32" data-testid="select-view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Calendar View</CardTitle>
              </CardHeader>
              <CardContent>
                {view === "monthly" && (
                  <>
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="text-center font-semibold text-sm">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {renderMonthlyView()}
                    </div>
                  </>
                )}
                {view === "weekly" && (
                  <div className="text-center py-8 text-muted-foreground">
                    Weekly view coming soon...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Unscheduled ({unscheduledClients.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {unscheduledClients.map((client: any) => (
                    <div
                      key={client.id}
                      className="text-xs p-2 border rounded hover-elevate cursor-move"
                      data-testid={`unscheduled-client-${client.id}`}
                    >
                      <div className="font-medium">{client.companyName}</div>
                      {client.location && (
                        <div className="text-muted-foreground">{client.location}</div>
                      )}
                    </div>
                  ))}
                  {unscheduledClients.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      All clients scheduled
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
