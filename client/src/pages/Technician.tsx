import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Phone, Mail, MapPin, Package } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function Technician() {
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Get today's assigned PMs
  const { data: todaysPMs = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/technician/today'],
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (user?.id) {
      refetch();
    }
  }, [user?.id, refetch]);

  // Get client parts for selected client
  const { data: clientParts = {} } = useQuery<Record<string, any>>({
    queryKey: ['/api/client-parts', selectedClient?.id],
    enabled: !!selectedClient,
  });

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const technicianName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Technician';
  const displayName = `${technicianName}${user?.email ? ` (${user.email})` : ''}`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-4xl px-4 py-6">
          <div className="text-center py-8">Loading your schedule...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">Your Schedule</h1>
            <p className="text-sm text-muted-foreground">{displayName}</p>
          </div>
          <p className="text-muted-foreground">{dateStr}</p>
        </div>

        {todaysPMs && todaysPMs.length > 0 ? (
          <div className="space-y-4">
            {todaysPMs.map((pm: any) => (
              <Card 
                key={pm.id} 
                className="cursor-pointer hover-elevate"
                onClick={() => setSelectedClient(pm.client)}
                data-testid={`card-pm-${pm.id}`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{pm.client.companyName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{pm.client.location}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pm.client.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${pm.client.phone}`} className="hover:underline">{pm.client.phone}</a>
                    </div>
                  )}
                  {pm.client.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${pm.client.email}`} className="hover:underline">{pm.client.email}</a>
                    </div>
                  )}
                  {pm.client.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <span>{pm.client.address}, {pm.client.city} {pm.client.province}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No PMs scheduled for today</p>
            </CardContent>
          </Card>
        )}

        <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedClient?.companyName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Details
                </h3>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>{selectedClient?.location}</p>
                  <p>{selectedClient?.address}</p>
                  <p>{selectedClient?.city}, {selectedClient?.province} {selectedClient?.postalCode}</p>
                  {selectedClient?.contactName && <p>Contact: {selectedClient.contactName}</p>}
                </div>
              </div>

              {Object.keys(clientParts).length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Parts for this location
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(clientParts).map(([partId, data]: [string, any]) => {
                      if (!data || !data.part) return null;
                      return (
                        <div key={partId} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                          <span>{data.part.name || `${data.part.type} - ${data.part.size}`}</span>
                          <span className="font-semibold">Qty: {data.quantity}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button className="w-full" variant="outline">
                Mark Complete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
