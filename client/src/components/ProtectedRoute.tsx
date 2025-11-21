import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      console.log("ProtectedRoute check:", { user, requireAdmin, currentLocation: location });
      if (!user) {
        console.log("No user, redirecting to login");
        setLocation("/login");
      } else if (requireAdmin && user.role !== "owner" && user.role !== "admin") {
        console.log("User role not admin/owner:", user.role, "redirecting to /technician");
        setLocation("/technician");
      } else if (requireAdmin) {
        console.log("User has admin access:", user.role);
      }
    }
  }, [user, isLoading, setLocation, requireAdmin]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requireAdmin && user.role !== "owner" && user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-destructive">Access denied. Admin privileges required.</div>
      </div>
    );
  }

  return <>{children}</>;
}
