import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { PortalAuthProvider } from "@/lib/portal-auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import PortalProtectedRoute from "@/components/PortalProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import EquipmentPage from "@/pages/EquipmentPage";
import ClientReportPage from "@/pages/ClientReportPage";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import RequestReset from "@/pages/RequestReset";
import ResetPassword from "@/pages/ResetPassword";
import ClientPortalLogin from "@/pages/ClientPortalLogin";
import ClientPortalDashboard from "@/pages/ClientPortalDashboard";
import NotFound from "@/pages/not-found";

function ContractorRoutes() {
  return (
    <AuthProvider>
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
        <Route path="/equipment/:clientId">
          <ProtectedRoute>
            <EquipmentPage />
          </ProtectedRoute>
        </Route>
        <Route path="/client-report/:clientId">
          <ProtectedRoute>
            <ClientReportPage />
          </ProtectedRoute>
        </Route>
      </Switch>
    </AuthProvider>
  );
}

function PortalRoutes() {
  return (
    <PortalAuthProvider>
      <Switch>
        <Route path="/portal/login" component={ClientPortalLogin} />
        <Route path="/portal/dashboard">
          <PortalProtectedRoute>
            <ClientPortalDashboard />
          </PortalProtectedRoute>
        </Route>
      </Switch>
    </PortalAuthProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/portal/:rest*">
        <PortalRoutes />
      </Route>
      <Route>
        <ContractorRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
