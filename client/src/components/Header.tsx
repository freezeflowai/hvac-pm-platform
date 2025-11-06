import { Button } from "@/components/ui/button";
import { Plus, LayoutDashboard, FileText } from "lucide-react";
import { Link, useLocation } from "wouter";

interface HeaderProps {
  onAddClient?: () => void;
}

export default function Header({ onAddClient }: HeaderProps) {
  const [location] = useLocation();

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">HVAC/R Scheduler</h1>
              <p className="text-sm text-muted-foreground">Preventive Maintenance Tracking</p>
            </div>
            <nav className="flex gap-2">
              <Link href="/">
                <Button
                  variant={location === "/" ? "default" : "ghost"}
                  size="sm"
                  className="gap-2"
                  data-testid="nav-dashboard"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/reports">
                <Button
                  variant={location === "/reports" ? "default" : "ghost"}
                  size="sm"
                  className="gap-2"
                  data-testid="nav-reports"
                >
                  <FileText className="h-4 w-4" />
                  Reports
                </Button>
              </Link>
            </nav>
          </div>
          {onAddClient && (
            <Button 
              onClick={onAddClient}
              data-testid="button-add-client"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
