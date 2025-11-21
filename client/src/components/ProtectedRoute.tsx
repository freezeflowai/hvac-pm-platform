import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    
    // Only perform auth checks once on mount, not on hot reload
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;
    
    if (!user) {
      setLocation("/login");
      return;
    }
    
    if (requireAdmin && user.role !== "owner" && user.role !== "admin") {
      setLocation("/technician");
      return;
    }
  }, [user, isLoading, requireAdmin, setLocation]);

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
