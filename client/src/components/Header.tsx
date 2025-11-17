import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut, User, Shield, Settings, Calendar as CalendarIcon, Plus, Users, Package, FileText, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useState } from "react";

interface HeaderProps {
  onAddClient?: () => void;
  onDashboardClick?: () => void;
  onSearch?: (query: string) => void;
  onClientSelect?: (clientId: string) => void;
  clients?: any[];
}

export default function Header({ onAddClient, onDashboardClick, onSearch, onClientSelect, clients = [] }: HeaderProps) {
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

  // Check if we're on the clients tab
  const isClientsTab = location === "/" && window.location.search.includes("tab=clients");

  return (
    <header className="border-b bg-background sticky top-0 z-50 shadow-sm">
      <div className="mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-foreground">
              {companySettings?.companyName || "HVAC/R Scheduler"}
            </h1>
            <nav className="flex gap-1 bg-muted/50 p-1 rounded-full">
              <Button
                variant={location === "/" && !isClientsTab ? "default" : "ghost"}
                size="sm"
                className={`rounded-full ${location === "/" && !isClientsTab ? "" : "hover:bg-background/60"}`}
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
              <Button
                variant={isClientsTab ? "default" : "ghost"}
                size="sm"
                className={`rounded-full ${isClientsTab ? "" : "hover:bg-background/60"}`}
                data-testid="nav-all-clients"
                onClick={() => {
                  window.history.pushState({}, '', '/?tab=clients');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                All Clients
              </Button>
              <Link href="/manage-parts">
                <Button
                  variant={location === "/manage-parts" ? "default" : "ghost"}
                  size="sm"
                  className={`rounded-full ${location === "/manage-parts" ? "" : "hover:bg-background/60"}`}
                  data-testid="nav-parts"
                >
                  <Package className="h-3.5 w-3.5 mr-1.5" />
                  Parts
                </Button>
              </Link>
              <Link href="/reports">
                <Button
                  variant={location === "/reports" ? "default" : "ghost"}
                  size="sm"
                  className={`rounded-full ${location === "/reports" ? "" : "hover:bg-background/60"}`}
                  data-testid="nav-reports"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Reports
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
          <div className="flex items-center gap-2">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-search"
                  className="h-8 gap-2"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Search</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
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
            <Button
              variant="default"
              size="sm"
              onClick={onAddClient}
              data-testid="button-add-client"
              className="h-8 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add Client</span>
            </Button>
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
