import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import EquipmentPage from "@/pages/EquipmentPage";
import ClientReportPage from "@/pages/ClientReportPage";
import AddClientPage from "@/pages/AddClientPage";
import PartsManagementPage from "@/pages/PartsManagementPage";
import ClientPartsPage from "@/pages/ClientPartsPage";
import CompanySettingsPage from "@/pages/CompanySettingsPage";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import RequestReset from "@/pages/RequestReset";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";

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
      <Route path="/edit-client/:id">
        <ProtectedRoute>
          <AddClientPage />
        </ProtectedRoute>
      </Route>
      <Route path="/manage-parts">
        <ProtectedRoute>
          <PartsManagementPage />
        </ProtectedRoute>
      </Route>
      <Route path="/equipment/:clientId">
        <ProtectedRoute>
          <EquipmentPage />
        </ProtectedRoute>
      </Route>
      <Route path="/clients/:clientId/parts">
        <ProtectedRoute>
          <ClientPartsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/client-report/:clientId">
        <ProtectedRoute>
          <ClientReportPage />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
