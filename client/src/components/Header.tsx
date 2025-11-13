import { Button } from "@/components/ui/button";
import { Plus, LayoutDashboard, FileText, LogOut, User, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";

interface HeaderProps {
  onAddClient?: () => void;
}

export default function Header({ onAddClient }: HeaderProps) {
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
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {companySettings?.companyName || "HVAC/R Scheduler"}
              </h1>
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
              {user?.isAdmin && (
                <Link href="/admin">
                  <Button
                    variant={location === "/admin" ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                    data-testid="nav-admin"
                  >
                    <Shield className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span data-testid="text-email">{user.email}</span>
              </div>
            )}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="button-logout"
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
