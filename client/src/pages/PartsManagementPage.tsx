import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import PartsManagementDialog from "@/components/PartsManagementDialog";
import NewAddClientDialog from "@/components/NewAddClientDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function PartsManagementPage() {
  const [, setLocation] = useLocation();
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: allClients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const seedPartsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/parts/seed");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      toast({
        title: "Success",
        description: "Standard parts seeded successfully. Missing parts have been restored (244 filters and belts available).",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to seed standard parts.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      
      <main className="container mx-auto p-6">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Manage Parts Inventory</h1>
            <p className="text-muted-foreground">Add and manage parts for maintenance schedules.</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="text-xs text-muted-foreground">Need standard parts?</p>
            <Button
              onClick={() => seedPartsMutation.mutate()}
              disabled={seedPartsMutation.isPending}
              data-testid="button-seed-parts"
              size="sm"
            >
              {seedPartsMutation.isPending ? "Seeding..." : "Seed Parts"}
            </Button>
          </div>
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
