import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/Header";
import PartsManagementDialog from "@/components/PartsManagementDialog";
import NewAddClientDialog from "@/components/NewAddClientDialog";

export default function PartsManagementPage() {
  const [, setLocation] = useLocation();
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);

  const { data: allClients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  return (
    <div className="min-h-screen bg-background">
      <Header clients={allClients} onAddClient={() => setAddClientDialogOpen(true)} />
      
      <main className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Manage Parts Inventory</h1>
          <p className="text-muted-foreground">Add and manage parts for maintenance schedules.</p>
        </div>

        <PartsManagementDialog onCancel={() => setLocation("/")} />
      </main>

      <NewAddClientDialog 
        open={addClientDialogOpen}
        onOpenChange={setAddClientDialogOpen}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        }}
      />
    </div>
  );
}
