import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [currentLocation, setLocation] = useLocation();

  useEffect(() => {
    // Only redirect once auth is loaded
    if (isLoading) return;
    
    if (!user && currentLocation !== "/login") {
      setLocation("/login");
    } else if (user && requireAdmin && user.role !== "owner" && user.role !== "admin" && currentLocation !== "/technician") {
      setLocation("/technician");
    }
  }, [user, isLoading, requireAdmin, currentLocation, setLocation]);

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
    return null;
  }

  return <>{children}</>;
}
