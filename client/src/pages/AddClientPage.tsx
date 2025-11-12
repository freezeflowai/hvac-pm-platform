import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AddClientDialog, { ClientFormData } from "@/components/AddClientDialog";

export default function AddClientPage() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const isEditing = Boolean(id);

  const {data: client, isLoading} = useQuery({
    queryKey: id ? ["/api/clients", id] : [],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error("Failed to fetch client");
      return res.json();
    },
  });

  const { data: clientParts } = useQuery({
    queryKey: id ? [`/api/clients/${id}/parts`] : [],
    enabled: Boolean(id),
  });

  const calculateNextDueDate = (selectedMonths: number[], inactive: boolean) => {
    if (inactive || selectedMonths.length === 0) return null;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const sortedMonths = [...selectedMonths].sort((a, b) => a - b);
    const nextMonth = sortedMonths.find(m => m >= currentMonth) ?? sortedMonths[0];
    const year = nextMonth >= currentMonth ? currentYear : currentYear + 1;
    return new Date(year, nextMonth, 1);
  };

  const createClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const nextDue = calculateNextDueDate(data.selectedMonths, data.inactive);
      const clientData = {
        companyName: data.companyName,
        location: data.location,
        address: data.address,
        city: data.city,
        province: data.province,
        postalCode: data.postalCode,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        roofLadderCode: data.roofLadderCode,
        notes: data.notes,
        selectedMonths: data.selectedMonths,
        inactive: data.inactive,
        nextDue: nextDue ? nextDue.toISOString() : new Date('9999-12-31').toISOString(),
      };
      
      const res = await apiRequest("POST", "/api/clients", clientData);
      const newClient = await res.json();
      
      if (data.parts.length > 0) {
        await apiRequest("POST", `/api/clients/${newClient.id}/parts`, { parts: data.parts });
      }
      
      return newClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/parts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/schedule"] });
      toast({
        title: "Client added",
        description: "The client has been added successfully.",
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add client.",
        variant: "destructive",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClientFormData }) => {
      const nextDue = calculateNextDueDate(data.selectedMonths, data.inactive);
      const clientData = {
        companyName: data.companyName,
        location: data.location,
        address: data.address,
        city: data.city,
        province: data.province,
        postalCode: data.postalCode,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        roofLadderCode: data.roofLadderCode,
        notes: data.notes,
        selectedMonths: data.selectedMonths,
        inactive: data.inactive,
        nextDue: nextDue ? nextDue.toISOString() : new Date('9999-12-31').toISOString(),
      };
      
      const res = await apiRequest("PUT", `/api/clients/${id}`, clientData);
      const updatedClient = await res.json();
      
      await apiRequest("POST", `/api/clients/${id}/parts`, { parts: data.parts });
      
      return updatedClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/parts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/schedule"] });
      toast({
        title: "Client updated",
        description: "The client has been updated successfully.",
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update client.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ClientFormData) => {
    if (isEditing && id) {
      updateClientMutation.mutate({ id, data });
    } else {
      createClientMutation.mutate(data);
    }
  };

  const editData = client && clientParts ? {
    id: client.id,
    companyName: client.companyName,
    location: client.location,
    address: client.address,
    city: client.city,
    province: client.province,
    postalCode: client.postalCode,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    roofLadderCode: client.roofLadderCode,
    notes: client.notes,
    selectedMonths: client.selectedMonths,
    inactive: client.inactive,
    parts: clientParts.map((cp: any) => ({
      partId: cp.partId,
      quantity: cp.quantity,
    })),
  } : undefined;

  if (isEditing && isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Edit Client' : 'Add New Client'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Update client information and required parts.' : 'Add a new client with their maintenance schedule and required parts.'}
          </p>
        </div>
      </div>

      <AddClientDialog
        open={true}
        onClose={() => setLocation("/")}
        onSubmit={handleSubmit}
        editData={editData}
      />
    </div>
  );
}
