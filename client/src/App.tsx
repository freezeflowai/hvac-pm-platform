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
import TechnicianDashboard from "@/pages/TechnicianDashboard";
import TechnicianManagementPage from "@/pages/TechnicianManagementPage";
import Technician from "@/pages/Technician";
import DailyParts from "@/pages/DailyParts";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import RequestReset from "@/pages/RequestReset";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
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
        <ProtectedRoute requireAdmin>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/calendar">
        <ProtectedRoute requireAdmin>
          <Calendar />
        </ProtectedRoute>
      </Route>
      <Route path="/reports">
        <ProtectedRoute requireAdmin>
          <Reports />
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute requireAdmin>
          <Admin />
        </ProtectedRoute>
      </Route>
      <Route path="/add-client">
        <ProtectedRoute requireAdmin>
          <AddClientPage />
        </ProtectedRoute>
      </Route>
      <Route path="/manage-parts">
        <ProtectedRoute requireAdmin>
          <PartsManagementPage />
        </ProtectedRoute>
      </Route>
      <Route path="/company-settings">
        <ProtectedRoute requireAdmin>
          <CompanySettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/manage-technicians">
        <ProtectedRoute requireAdmin>
          <TechnicianManagementPage />
        </ProtectedRoute>
      </Route>
      <Route path="/technician">
        <ProtectedRoute>
          <Technician />
        </ProtectedRoute>
      </Route>
      <Route path="/daily-parts">
        <ProtectedRoute>
          <DailyParts />
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
  const isTechnicianPage = location === '/technician' || location === '/daily-parts';

  const handleClientSelect = (clientId: string) => {
    window.dispatchEvent(new CustomEvent('openClientDialog', { detail: { clientId } }));
  };

  const handleDashboardClick = () => {
    // Navigate to dashboard and clear query params
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
            {!isTechnicianPage && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(e.target.value.length > 0);
                    }}
                    onFocus={() => searchQuery.length > 0 && setSearchOpen(true)}
                    onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                    data-testid="input-client-search"
                    className="h-9 w-64 rounded-md border border-input bg-white dark:bg-gray-900 pl-8 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                  {searchOpen && searchQuery && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md outline-none z-50">
                      <Command>
                        <CommandList>
                          <CommandEmpty className="py-6 text-center text-sm">No clients found.</CommandEmpty>
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
                    </div>
                  )}
                </div>
                <Button variant="default" size="default" onClick={handleAddClient} data-testid="button-add-client" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  <span>Add Client</span>
                </Button>
                <Button variant="ghost" size="icon" asChild data-testid="button-settings">
                  <Link href="/company-settings">
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </header>
          <SubscriptionBanner />
          <main className="flex-1 overflow-auto">
            <div className="max-w-[1550px] mx-auto">
              <Router />
            </div>
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
