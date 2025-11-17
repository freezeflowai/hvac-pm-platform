import { Switch, Route, useLocation } from "wouter";
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
  const [location] = useLocation();
  const { user } = useAuth();
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  
  const { data: allClients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: Boolean(user?.id),
  });

  const isAuthPage = ['/login', '/signup', '/request-reset', '/reset-password'].includes(location);

  const handleClientSelect = (clientId: string) => {
    window.dispatchEvent(new CustomEvent('openClientDialog', { detail: { clientId } }));
  };

  const handleDashboardClick = () => {
    window.location.href = '/';
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isAuthPage) {
    return <Router />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar 
          clients={allClients}
          onAddClient={() => {
            window.dispatchEvent(new CustomEvent('openAddClientDialog'));
          }}
          onDashboardClick={handleDashboardClick}
          onClientSelect={handleClientSelect}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center gap-2 border-b px-4 py-2">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
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
