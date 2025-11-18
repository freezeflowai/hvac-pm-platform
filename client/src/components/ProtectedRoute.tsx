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
    if (!isLoading && !user) {
      setLocation("/login");
      return;
    }

    if (!isLoading && user) {
      if (requireAdmin && !user.isAdmin) {
        setLocation("/technician");
      } else if (!requireAdmin && !user.isAdmin && location !== "/technician") {
        setLocation("/technician");
      }
    }
  }, [user, isLoading, setLocation, requireAdmin, location]);

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

  if (requireAdmin && !user.isAdmin) {
    return null;
  }

  return <>{children}</>;
}
