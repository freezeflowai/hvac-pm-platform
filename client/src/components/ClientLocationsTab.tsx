import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, FileText, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import LocationFormModal from "./LocationFormModal";
import type { Client } from "@shared/schema";
import { Link } from "wouter";

// Each Location here maps to a QuickBooks Sub-Customer.
// billWithParent controls whether the invoice's CustomerRef will use the parent Company 
// or this Location in future QuickBooks sync logic.
// The app only supports one level of hierarchy: Company → Location. 
// We never attach a Location under another Location.

interface ClientLocationsTabProps {
  clientId: string;
  companyId: string;
  parentCompanyId?: string;
}

export default function ClientLocationsTab({ clientId, companyId, parentCompanyId }: ClientLocationsTabProps) {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Client | null>(null);

  // Fetch all locations (clients) for this company
  // If we have a parentCompanyId, fetch locations under that parent
  // Otherwise, fetch all clients for this company
  const { data: locations = [], isLoading, error } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    select: (clients) => {
      if (parentCompanyId) {
        // Filter to locations under this parent company
        return clients.filter(c => c.parentCompanyId === parentCompanyId);
      }
      // Fallback: filter by companyId
      return clients.filter(c => c.companyId === companyId);
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ locationId, isActive }: { locationId: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/clients/${locationId}`, { inactive: !isActive });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Location updated",
        description: "The location status has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update location status.",
        variant: "destructive",
      });
    },
  });

  const handleAddLocation = () => {
    setEditingLocation(null);
    setIsFormOpen(true);
  };

  const handleEditLocation = (location: Client) => {
    setEditingLocation(location);
    setIsFormOpen(true);
  };

  const handleToggleActive = (location: Client) => {
    toggleActiveMutation.mutate({
      locationId: location.id,
      isActive: location.inactive, // If inactive, we're activating it
    });
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingLocation(null);
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-destructive">
            <p>Failed to load locations. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Locations</CardTitle>
            <CardDescription>
              Manage service locations for this client. Each location maps to a QuickBooks Sub-Customer.
            </CardDescription>
          </div>
          <Button onClick={handleAddLocation} data-testid="button-add-location">
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No locations found for this client.</p>
              <p className="text-sm mt-2">Add a location to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location Name</TableHead>
                  <TableHead>Site Code</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Bill With Parent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id} data-testid={`row-location-${location.id}`}>
                    <TableCell className="font-medium">
                      {location.location || location.companyName}
                    </TableCell>
                    <TableCell>
                      {location.roofLadderCode || "-"}
                    </TableCell>
                    <TableCell>
                      {location.city || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={location.billWithParent ? "default" : "secondary"}>
                        {location.billWithParent ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={location.inactive ? "secondary" : "default"}>
                        {location.inactive ? "Inactive" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditLocation(location)}
                          data-testid={`button-edit-location-${location.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(location)}
                          disabled={toggleActiveMutation.isPending}
                          data-testid={`button-toggle-location-${location.id}`}
                        >
                          {toggleActiveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : location.inactive ? (
                            <ToggleRight className="h-4 w-4" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        </Button>
                        <Link href={`/invoices/new?locationId=${location.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-create-invoice-${location.id}`}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LocationFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        location={editingLocation}
        companyId={companyId}
        parentCompanyId={parentCompanyId}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}
