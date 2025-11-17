import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import AddClientPage from "@/pages/AddClientPage";
import PartsManagementPage from "@/pages/PartsManagementPage";
import CompanySettingsPage from "@/pages/CompanySettingsPage";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import RequestReset from "@/pages/RequestReset";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/request-reset" component={RequestReset} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/calendar">
        <ProtectedRoute>
          <Calendar />
        </ProtectedRoute>
      </Route>
      <Route path="/reports">
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute>
          <Admin />
        </ProtectedRoute>
      </Route>
      <Route path="/add-client">
        <ProtectedRoute>
          <AddClientPage />
        </ProtectedRoute>
      </Route>
      <Route path="/manage-parts">
        <ProtectedRoute>
          <PartsManagementPage />
        </ProtectedRoute>
      </Route>
      <Route path="/company-settings">
        <ProtectedRoute>
          <CompanySettingsPage />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: allClients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: Boolean(user?.id),
  });

  const isAuthPage = ['/login', '/signup', '/request-reset', '/reset-password'].includes(location);

  const handleClientSelect = (clientId: string) => {
    window.dispatchEvent(new CustomEvent('openClientDialog', { detail: { clientId } }));
  };

  const handleDashboardClick = () => {
    setLocation('/');
  };

  const handleAddClient = () => {
    window.dispatchEvent(new CustomEvent('openAddClientDialog'));
  };

  const filteredClients = allClients.filter(client =>
    client.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isAuthPage) {
    return <Router />;
  }

  return (
    <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar onDashboardClick={handleDashboardClick} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-search">
                    <Search className="h-4 w-4" />
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
                              handleClientSelect(client.id);
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
              <Button variant="ghost" size="icon" onClick={handleAddClient} data-testid="button-add-client">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" asChild data-testid="button-settings">
                <Link href="/company-settings">
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
