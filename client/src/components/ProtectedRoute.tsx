import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log("ProtectedRoute effect:", { 
      isLoading, 
      user: user ? { id: user.id, role: user.role } : null, 
      requireAdmin 
    });
    
    if (isLoading) return;
    
    if (!user) {
      console.log("No user, redirecting to login");
      setLocation("/login");
      return;
    }
    
    if (requireAdmin && user.role !== "owner" && user.role !== "admin") {
      console.log("User role check failed:", { role: user.role, requireAdmin });
      setLocation("/technician");
      return;
    }
    
    console.log("ProtectedRoute: Access granted");
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
