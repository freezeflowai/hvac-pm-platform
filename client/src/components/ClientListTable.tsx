import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Pencil } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export interface Client {
  id: string;
  companyName: string;
  location: string;
  selectedMonths: number[];
  nextDue: Date;
}

interface ClientListTableProps {
  clients: Client[];
  onEdit: (id: string) => void;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function ClientListTable({ clients, onEdit }: ClientListTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = clients.filter(
    (client) =>
      client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMonthsDisplay = (selectedMonths: number[]) => {
    if (selectedMonths.length > 4) {
      return `${selectedMonths.length} months/year`;
    }
    return selectedMonths.map(m => MONTH_NAMES[m]).join(", ");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>All Clients</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              data-testid="input-search-clients"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Company</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Location</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Maintenance Months</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Next Due</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr 
                  key={client.id} 
                  className="border-b hover-elevate"
                  data-testid={`row-client-${client.id}`}
                >
                  <td className="py-3 px-4 text-sm font-medium" data-testid={`text-company-${client.id}`}>
                    {client.companyName}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`text-location-${client.id}`}>
                    {client.location}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <Badge variant="secondary">{getMonthsDisplay(client.selectedMonths)}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground" data-testid={`text-next-due-${client.id}`}>
                    {format(client.nextDue, "MMM d, yyyy")}
                  </td>
                  <td className="py-3 px-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(client.id)}
                      data-testid={`button-edit-client-${client.id}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-4">
          {filteredClients.map((client) => (
            <Card key={client.id} data-testid={`card-client-${client.id}`}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{client.companyName}</div>
                      <div className="text-sm text-muted-foreground">{client.location}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(client.id)}
                      data-testid={`button-edit-client-${client.id}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">{getMonthsDisplay(client.selectedMonths)}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(client.nextDue, "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {filteredClients.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No clients found
          </div>
        )}
      </CardContent>
    </Card>
  );
}
