import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Users, 
  Package, 
  FileText, 
  Shield, 
  LogOut
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
interface AppSidebarProps {
  onDashboardClick?: () => void;
}

export function AppSidebar({ onDashboardClick }: AppSidebarProps) {
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

  const isClientsTab = location === "/" && window.location.search.includes("tab=clients");

  const menuItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      isActive: location === "/" && !isClientsTab,
      onClick: () => {
        if (onDashboardClick) {
          onDashboardClick();
        } else {
          setLocation('/');
        }
      },
      testId: "nav-dashboard"
    },
    {
      title: "Calendar",
      icon: CalendarIcon,
      href: "/calendar",
      isActive: location === "/calendar",
      testId: "nav-calendar"
    },
    {
      title: "Clients",
      icon: Users,
      isActive: isClientsTab,
      onClick: () => {
        window.history.pushState({}, '', '/?tab=clients');
        window.dispatchEvent(new PopStateEvent('popstate'));
      },
      testId: "nav-clients"
    },
    {
      title: "Parts",
      icon: Package,
      href: "/manage-parts",
      isActive: location === "/manage-parts",
      testId: "nav-parts"
    },
    {
      title: "Reports",
      icon: FileText,
      href: "/reports",
      isActive: location === "/reports",
      testId: "nav-reports"
    },
  ];

  if (user?.isAdmin) {
    menuItems.push({
      title: "Admin",
      icon: Shield,
      href: "/admin",
      isActive: location === "/admin",
      testId: "nav-admin"
    });
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-3 py-3">
        <div className="font-semibold text-sm truncate">
          {companySettings?.companyName || "HVAC/R Scheduler"}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.href ? (
                    <SidebarMenuButton asChild isActive={item.isActive} data-testid={item.testId}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton isActive={item.isActive} onClick={item.onClick} data-testid={item.testId}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
