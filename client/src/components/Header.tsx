import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut, User, Shield, Settings, Calendar as CalendarIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";

interface HeaderProps {
  onAddClient?: () => void;
  onDashboardClick?: () => void;
}

export default function Header({ onAddClient, onDashboardClick }: HeaderProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const { data: companySettings } = useQuery<CompanySettings | null>({
    queryKey: ["/api/company-settings"],
    enabled: Boolean(user?.id),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/login");
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: "Could not log out. Please try again.",
      });
    }
  };

  return (
    <header className="border-b bg-background sticky top-0 z-50 shadow-sm">
      <div className="mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-8">
            <h1 className="text-lg font-semibold text-foreground">
              {companySettings?.companyName || "HVAC/R Scheduler"}
            </h1>
            <nav className="flex gap-1 bg-muted/50 p-1 rounded-full">
              <Button
                variant={location === "/" || location.startsWith("/?") ? "default" : "ghost"}
                size="sm"
                className={`rounded-full ${location === "/" || location.startsWith("/?") ? "" : "hover:bg-background/60"}`}
                data-testid="nav-dashboard"
                onClick={() => {
                  if (onDashboardClick) {
                    onDashboardClick();
                  } else {
                    setLocation('/');
                  }
                }}
              >
                <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
                Dashboard
              </Button>
              <Link href="/calendar">
                <Button
                  variant={location === "/calendar" ? "default" : "ghost"}
                  size="sm"
                  className={`rounded-full ${location === "/calendar" ? "" : "hover:bg-background/60"}`}
                  data-testid="nav-calendar"
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                  Calendar
                </Button>
              </Link>
              {user?.isAdmin && (
                <Link href="/admin">
                  <Button
                    variant={location === "/admin" ? "default" : "ghost"}
                    size="sm"
                    className={`rounded-full ${location === "/admin" ? "" : "hover:bg-background/60"}`}
                    data-testid="nav-admin"
                  >
                    <Shield className="h-3.5 w-3.5 mr-1.5" />
                    Admin
                  </Button>
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span data-testid="text-email" className="font-medium">{user.email}</span>
              </div>
            )}
            <Link href="/company-settings">
              <Button 
                variant="ghost"
                size="icon"
                data-testid="button-settings-header"
                className="h-8 w-8"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
              className="h-8 w-8"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
