import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Users, 
  Package, 
  FileText, 
  Shield, 
  LogOut,
  Smartphone,
  MessageCircle,
  UserCheck
} from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
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
import FeedbackDialog from "./FeedbackDialog";
interface AppSidebarProps {
  onDashboardClick?: () => void;
}

export function AppSidebar({ onDashboardClick }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const { data: companySettings } = useQuery<CompanySettings | null>({
    queryKey: ["/api/company-settings"],
    enabled: Boolean(user?.id),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Derive isClientsTab from URL search params
  const searchString = useSearch();
  const isClientsTab = useMemo(() => {
    return location === "/" && searchString.includes("tab=clients");
  }, [location, searchString]);

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
        setLocation('/?tab=clients');
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
    {
      title: "Technician",
      icon: Smartphone,
      href: "/technician",
      isActive: location === "/technician",
      testId: "nav-technician"
    },
  ];

  if (user?.role === "owner" || user?.role === "admin") {
    menuItems.push({
      title: "Manage Team",
      icon: UserCheck,
      href: "/manage-technicians",
      isActive: location === "/manage-technicians",
      testId: "nav-manage-technicians"
    });
    menuItems.push({
      title: "Admin",
      icon: Shield,
      href: "/admin",
      isActive: location === "/admin",
      testId: "nav-admin"
    });
  }

  return (
    <Sidebar collapsible="icon">
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
                    <SidebarMenuButton 
                      asChild 
                      isActive={item.isActive} 
                      data-testid={item.testId}
                      className="h-10 data-[active=true]:bg-[#EEF4FF] data-[active=true]:border-l-[3px] data-[active=true]:border-l-primary data-[active=true]:font-semibold data-[active=true]:pl-[7px] hover:bg-[#F8F9FB]"
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton 
                      isActive={item.isActive} 
                      onClick={item.onClick} 
                      data-testid={item.testId}
                      className="h-10 data-[active=true]:bg-[#EEF4FF] data-[active=true]:border-l-[3px] data-[active=true]:border-l-primary data-[active=true]:font-semibold data-[active=true]:pl-[7px] hover:bg-[#F8F9FB]"
                    >
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
            <SidebarMenuButton onClick={() => setFeedbackOpen(true)} data-testid="button-feedback" className="h-10 hover:bg-[#F8F9FB]">
              <MessageCircle className="h-4 w-4" />
              <span>Feedback</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} data-testid="button-logout" className="h-10 hover:bg-[#F8F9FB]">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </Sidebar>
  );
}
