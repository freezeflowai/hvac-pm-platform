import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Calendar, Wrench, Package } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface MaintenanceRecord {
  id: string;
  completedAt: string;
  notes: string | null;
}

interface Equipment {
  id: string;
  name: string;
  modelNumber: string | null;
  serialNumber: string | null;
  notes: string | null;
}

interface ClientPart {
  id: string;
  partId: string;
  partName: string;
  partSize: string | null;
  partType: string | null;
  quantity: number;
}

export default function ClientPortalDashboard() {
  const { user, logout } = usePortalAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: maintenance, isLoading: loadingMaintenance } = useQuery<MaintenanceRecord[]>({
    queryKey: ["/api/portal/maintenance"],
  });

  const { data: equipment, isLoading: loadingEquipment } = useQuery<Equipment[]>({
    queryKey: ["/api/portal/equipment"],
  });

  const { data: parts, isLoading: loadingParts } = useQuery<ClientPart[]>({
    queryKey: ["/api/portal/parts"],
  });

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/portal/login");
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "An error occurred while logging out",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-portal-title">
              {user?.clientName}
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-portal-email">
              {user?.email}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            data-testid="button-portal-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="maintenance" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="maintenance" data-testid="tab-maintenance">
              <Calendar className="h-4 w-4 mr-2" />
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="equipment" data-testid="tab-equipment">
              <Wrench className="h-4 w-4 mr-2" />
              Equipment
            </TabsTrigger>
            <TabsTrigger value="parts" data-testid="tab-parts">
              <Package className="h-4 w-4 mr-2" />
              Parts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="maintenance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance History</CardTitle>
                <CardDescription>
                  View your completed preventive maintenance records
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMaintenance ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading maintenance history...
                  </div>
                ) : !maintenance || maintenance.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-maintenance">
                    No maintenance records found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {maintenance.map((record) => (
                      <Card key={record.id} data-testid={`card-maintenance-${record.id}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-medium">
                                Completed on {format(new Date(record.completedAt), "PPP")}
                              </p>
                              {record.notes && (
                                <p className="text-sm text-muted-foreground">
                                  {record.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Equipment</CardTitle>
                <CardDescription>
                  Your registered HVAC/R equipment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEquipment ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading equipment...
                  </div>
                ) : !equipment || equipment.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-equipment">
                    No equipment found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {equipment.map((item) => (
                      <Card key={item.id} data-testid={`card-equipment-${item.id}`}>
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <h3 className="font-semibold">{item.name}</h3>
                            {item.modelNumber && (
                              <p className="text-sm text-muted-foreground">
                                Model: {item.modelNumber}
                              </p>
                            )}
                            {item.serialNumber && (
                              <p className="text-sm text-muted-foreground">
                                Serial: {item.serialNumber}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-sm text-muted-foreground">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Parts Inventory</CardTitle>
                <CardDescription>
                  Parts associated with your equipment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingParts ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading parts...
                  </div>
                ) : !parts || parts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-parts">
                    No parts found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {parts.map((part) => (
                      <Card key={part.id} data-testid={`card-part-${part.id}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <h3 className="font-semibold">{part.partName}</h3>
                              <div className="flex gap-2 text-sm text-muted-foreground">
                                {part.partType && <span>Type: {part.partType}</span>}
                                {part.partSize && <span>Size: {part.partSize}</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Quantity</p>
                              <p className="text-lg font-semibold">{part.quantity}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
