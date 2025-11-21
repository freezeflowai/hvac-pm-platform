import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { Phone, Mail, MapPin, Package, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Technician() {
  const { user } = useAuth();
  const [selectedPM, setSelectedPM] = useState<any>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [isSubmittingNotes, setIsSubmittingNotes] = useState(false);
  const [allParts, setAllParts] = useState<Record<string, any>>({});
  const [allEquipment, setAllEquipment] = useState<Record<string, any[]>>({});

  // Get today's assigned PMs
  const { data: todaysPMs = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/technician/today'],
    enabled: !!user?.id,
    staleTime: 0,
    gcTime: 0,
  });

  // DEBUG: Log the raw data
  useEffect(() => {
    console.log("[FRONTEND DEBUG] Raw todaysPMs data:", todaysPMs);
    console.log("[FRONTEND DEBUG] Total count:", todaysPMs.length);
    todaysPMs.forEach((pm, idx) => {
      console.log(`[FRONTEND DEBUG] PM ${idx}:`, {
        id: pm.id,
        clientName: pm.client?.companyName,
        completed: pm.assignment?.completed,
        assignmentStructure: pm.assignment
      });
    });
  }, [todaysPMs]);

  // Fetch parts and equipment for all PMs on mount/update
  useEffect(() => {
    const fetchAllData = async () => {
      const partsMap: Record<string, any> = {};
      const equipmentMap: Record<string, any[]> = {};

      for (const pm of todaysPMs) {
        try {
          const partsRes = await fetch(`/api/client-parts/${pm.client.id}`);
          if (partsRes.ok) {
            const data = await partsRes.json();
            partsMap[pm.client.id] = data;
          }
        } catch (error) {
          console.error("Error fetching parts:", error);
        }

        try {
          const equipRes = await fetch(`/api/equipment/${pm.client.id}`);
          if (equipRes.ok) {
            const data = await equipRes.json();
            equipmentMap[pm.client.id] = Array.isArray(data) ? data : [];
          } else {
            equipmentMap[pm.client.id] = [];
          }
        } catch (error) {
          console.error("Error fetching equipment:", error);
          equipmentMap[pm.client.id] = [];
        }
      }

      setAllParts(partsMap);
      setAllEquipment(equipmentMap);
    };

    if (todaysPMs.length > 0) {
      fetchAllData();
    }
  }, [todaysPMs]);

  useEffect(() => {
    if (user?.id) {
      refetch();
    }
  }, [user?.id, refetch]);

  const handleMarkComplete = async () => {
    if (!selectedPM) return;
    
    try {
      setIsSubmittingNotes(true);
      await apiRequest(`PATCH`, `/api/calendar/${selectedPM.id}`, {
        completed: true,
        completionNotes: completionNotes
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/technician/today'] });
      setSelectedPM(null);
      setCompletionNotes("");
      await refetch();
    } catch (error) {
      console.error("Failed to mark complete:", error);
      alert("Failed to mark complete. Please try again.");
    } finally {
      setIsSubmittingNotes(false);
    }
  };

  const handleUncomplete = async (pm: any) => {
    try {
      await apiRequest(`PATCH`, `/api/calendar/${pm.id}`, {
        completed: false,
        completionNotes: null
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/technician/today'] });
      setSelectedPM(null);
      setCompletionNotes("");
      await refetch();
    } catch (error) {
      console.error("Failed to uncomplete:", error);
      alert("Failed to uncomplete. Please try again.");
    }
  };

  const handleEditNotes = (pm: any) => {
    setSelectedPM(pm);
    setCompletionNotes(pm.assignment.completionNotes || "");
  };

  const handleSaveNotes = async () => {
    if (!selectedPM) return;
    
    try {
      setIsSubmittingNotes(true);
      await apiRequest(`PATCH`, `/api/calendar/${selectedPM.id}`, {
        completionNotes: completionNotes
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/technician/today'] });
      setSelectedPM(null);
      setCompletionNotes("");
      await refetch();
    } catch (error) {
      console.error("Failed to save notes:", error);
      alert("Failed to save notes. Please try again.");
    } finally {
      setIsSubmittingNotes(false);
    }
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const technicianName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Technician';
  const displayName = `${technicianName}${user?.email ? ` (${user.email})` : ''}`;

  const pendingPMs = todaysPMs.filter((pm: any) => !pm.assignment.completed);
  const completedPMs = todaysPMs.filter((pm: any) => pm.assignment.completed);

  // DEBUG: Log filtering results
  console.log("[FRONTEND DEBUG] Pending PMs:", pendingPMs.length, pendingPMs);
  console.log("[FRONTEND DEBUG] Completed PMs:", completedPMs.length, completedPMs);

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

        {/* Pending PMs */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Circle className="h-5 w-5" />
            Today's Jobs ({pendingPMs.length})
          </h2>
          {pendingPMs.length > 0 ? (
            <div className="space-y-3">
              {pendingPMs.map((pm: any) => {
                const parts = allParts[pm.client.id] || {};
                const equip = allEquipment[pm.client.id] || [];
                const partCount = Object.keys(parts).length;
                const equipCount = equip.length;

                return (
                  <Card 
                    key={pm.id} 
                    className="cursor-pointer hover-elevate"
                    onClick={() => {
                      setSelectedPM(pm);
                      setCompletionNotes("");
                    }}
                    data-testid={`card-pm-${pm.id}`}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{pm.client.companyName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{pm.client.location}</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {pm.client.address && (
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 mt-0.5" />
                          <span>{pm.client.address}, {pm.client.city} {pm.client.province}</span>
                        </div>
                      )}
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
                      <div className="flex gap-4 text-sm text-muted-foreground pt-1">
                        {partCount > 0 && (
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4" />
                            <span>{partCount} parts</span>
                          </div>
                        )}
                        {equipCount > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            <span>{equipCount} equipment</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground">No jobs scheduled for today</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Completed PMs */}
        {completedPMs.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Completed ({completedPMs.length})
            </h2>
            <div className="space-y-3">
              {completedPMs.map((pm: any) => (
                <Card 
                  key={pm.id} 
                  className="opacity-75"
                  data-testid={`card-completed-${pm.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{pm.client.companyName}</CardTitle>
                        <p className="text-sm text-muted-foreground">{pm.client.location}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleEditNotes(pm)}
                          data-testid={`button-edit-notes-${pm.id}`}
                        >
                          Notes
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleUncomplete(pm)}
                          data-testid={`button-uncomplete-${pm.id}`}
                        >
                          Uncomplete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {pm.assignment.completionNotes && (
                    <CardContent className="pt-0">
                      <div className="text-sm bg-muted/50 p-2 rounded">
                        <p className="text-muted-foreground">Notes: {pm.assignment.completionNotes}</p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Dialog for job details and completion */}
        <Dialog open={!!selectedPM && !selectedPM.assignment.completed} onOpenChange={() => setSelectedPM(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedPM?.client?.companyName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Details
                </h3>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>{selectedPM?.client?.location}</p>
                  <p>{selectedPM?.client?.address}</p>
                  <p>{selectedPM?.client?.city}, {selectedPM?.client?.province} {selectedPM?.client?.postalCode}</p>
                  {selectedPM?.client?.contactName && <p>Contact: {selectedPM.client.contactName}</p>}
                </div>
              </div>

              {selectedPM && allParts[selectedPM.client.id] && Object.keys(allParts[selectedPM.client.id]).length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Parts for this location
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(allParts[selectedPM.client.id] || {}).map(([partId, data]: [string, any]) => {
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

              {selectedPM && allEquipment[selectedPM.client.id] && allEquipment[selectedPM.client.id].length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Equipment
                  </h3>
                  <div className="space-y-2">
                    {allEquipment[selectedPM.client.id].map((item: any) => (
                      <div key={item.id} className="text-sm p-2 bg-muted/50 rounded">
                        <p className="font-medium">{item.name}</p>
                        {item.type && <p className="text-muted-foreground">Type: {item.type}</p>}
                        {item.modelNumber && <p className="text-muted-foreground">Model: {item.modelNumber}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="font-semibold text-sm">Notes for this job (optional)</label>
                <Textarea
                  placeholder="Add any notes about this PM..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="resize-none"
                  data-testid="input-completion-notes"
                />
              </div>

              <Button 
                onClick={handleMarkComplete} 
                disabled={isSubmittingNotes}
                className="w-full"
                data-testid="button-mark-complete"
              >
                {isSubmittingNotes ? "Saving..." : "Mark Complete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog for editing notes on completed jobs */}
        <Dialog open={!!selectedPM && selectedPM.assignment?.completed} onOpenChange={() => setSelectedPM(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Notes - {selectedPM?.client?.companyName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="font-semibold text-sm">Completion Notes</label>
                <Textarea
                  placeholder="Edit notes for this completed PM..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="resize-none"
                  data-testid="input-edit-completion-notes"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveNotes} 
                  disabled={isSubmittingNotes}
                  className="flex-1"
                  data-testid="button-save-notes"
                >
                  {isSubmittingNotes ? "Saving..." : "Save Notes"}
                </Button>
                <Button 
                  onClick={() => setSelectedPM(null)} 
                  variant="outline"
                  className="flex-1"
                  data-testid="button-cancel-notes"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
