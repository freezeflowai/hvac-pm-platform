import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [currentLocation, setLocation] = useLocation();

  // Don't do anything while loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Check auth after loading completes
  if (!user) {
    // User not authenticated - redirect to login if not already there
    if (currentLocation !== "/login") {
      setLocation("/login");
    }
    return null;
  }

  // Check admin requirement
  if (requireAdmin && user.role !== "owner" && user.role !== "admin") {
    // User is not admin - redirect to technician dashboard
    if (currentLocation !== "/technician") {
      setLocation("/technician");
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-destructive">Access denied. Admin privileges required.</div>
      </div>
    );
  }

  // User is authenticated and authorized
  return <>{children}</>;
}
