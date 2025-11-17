import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Users, 
  Package, 
  FileText, 
  Shield, 
  Settings, 
  LogOut,
  Plus,
  Search
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
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useState } from "react";

interface AppSidebarProps {
  onAddClient?: () => void;
  onDashboardClick?: () => void;
  onClientSelect?: (clientId: string) => void;
  clients?: any[];
}

export function AppSidebar({ onAddClient, onDashboardClick, onClientSelect, clients = [] }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredClients = clients.filter(client =>
    client.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      title: "All Clients",
      icon: Users,
      isActive: isClientsTab,
      onClick: () => {
        window.history.pushState({}, '', '/?tab=clients');
        window.dispatchEvent(new PopStateEvent('popstate'));
      },
      testId: "nav-all-clients"
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
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild={!item.onClick}
                    isActive={item.isActive}
                    onClick={item.onClick}
                    data-testid={item.testId}
                  >
                    {item.href ? (
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    ) : (
                      <button>
                        <item.icon />
                        <span>{item.title}</span>
                      </button>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
                    <SidebarMenuButton data-testid="button-search">
                      <Search />
                      <span>Search Clients</span>
                    </SidebarMenuButton>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start" side="right">
                    <Command>
                      <CommandInput
                        placeholder="Search clients..."
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        data-testid="input-client-search"
                      />
                      <CommandList>
                        <CommandEmpty>No clients found.</CommandEmpty>
                        <CommandGroup>
                          {filteredClients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.id}
                              keywords={[client.companyName, client.location || '']}
                              onSelect={() => {
                                if (onClientSelect) {
                                  onClientSelect(client.id);
                                }
                                setSearchOpen(false);
                                setSearchQuery("");
                              }}
                              data-testid={`client-search-item-${client.id}`}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{client.companyName}</span>
                                {client.location && (
                                  <span className="text-xs text-muted-foreground">{client.location}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onAddClient} data-testid="button-add-client">
                  <Plus />
                  <span>Add Client</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/company-settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} data-testid="button-logout">
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
