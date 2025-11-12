import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";

interface PortalUser {
  id: string;
  email: string;
  clientId: string;
  clientName: string;
}

interface PortalAuthContextType {
  user: PortalUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextType | undefined>(undefined);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);

  const { data, isLoading } = useQuery<PortalUser>({
    queryKey: ["/api/portal/user"],
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data]);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      try {
        const response = await apiRequest("POST", "/api/portal/login", { email, password });
        return await response.json() as PortalUser;
      } catch (error: any) {
        throw new Error(error.message || "Invalid email or password");
      }
    },
    onSuccess: (userData) => {
      setUser(userData);
      queryClient.setQueryData(["/api/portal/user"], userData);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/portal/logout");
    },
    onSuccess: () => {
      setUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/portal/user"] });
      queryClient.clear();
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <PortalAuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const context = useContext(PortalAuthContext);
  if (context === undefined) {
    throw new Error("usePortalAuth must be used within a PortalAuthProvider");
  }
  return context;
}
