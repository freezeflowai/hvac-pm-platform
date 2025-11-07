import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Package } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface ReportItem {
  part: {
    id: string;
    type: string;
    filterType?: string | null;
    beltType?: string | null;
    size?: string | null;
    name?: string | null;
    description?: string | null;
  };
  totalQuantity: number;
}

function getPartDisplay(part: ReportItem['part']) {
  if (part.type === "filter") {
    return {
      name: `${part.filterType} Filter`,
      details: part.size || ""
    };
  } else if (part.type === "belt") {
    return {
      name: `Type ${part.beltType} Belt`,
      details: part.size || ""
    };
  } else {
    return {
      name: part.name || "",
      details: part.description || ""
    };
  }
}

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  const { data: reportData = [], isLoading } = useQuery<ReportItem[]>({
    queryKey: ["/api/reports/parts", selectedMonth],
    enabled: selectedMonth !== undefined,
  });

  const filters = reportData.filter(item => item.part.type === "filter");
  const belts = reportData.filter(item => item.part.type === "belt");
  const other = reportData.filter(item => item.part.type === "other");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Parts Order Report</h1>
              <p className="text-muted-foreground">View required parts for scheduled maintenance</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Month</CardTitle>
                <CardDescription>Choose a month to view parts needed for that month's maintenance</CardDescription>
              </div>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className="w-48" data-testid="select-report-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">Loading report...</p>
            </CardContent>
          </Card>
        ) : reportData.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No parts required for {MONTHS[selectedMonth]}</p>
                <p className="text-sm text-muted-foreground mt-1">No clients have maintenance scheduled for this month</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filters.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Filters
                  </CardTitle>
                  <CardDescription>
                    Total filters needed for {MONTHS[selectedMonth]}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Filter Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Total Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filters.map((item, index) => {
                        const display = getPartDisplay(item.part);
                        return (
                          <TableRow key={index} data-testid={`filter-row-${index}`}>
                            <TableCell className="font-medium">{display.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{display.details}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge data-testid={`filter-quantity-${index}`}>{item.totalQuantity}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {belts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Belts
                  </CardTitle>
                  <CardDescription>
                    Total belts needed for {MONTHS[selectedMonth]}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Belt Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Total Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {belts.map((item, index) => {
                        const display = getPartDisplay(item.part);
                        return (
                          <TableRow key={index} data-testid={`belt-row-${index}`}>
                            <TableCell className="font-medium">{display.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{display.details}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge data-testid={`belt-quantity-${index}`}>{item.totalQuantity}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {other.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Other Parts
                  </CardTitle>
                  <CardDescription>
                    Other parts needed for {MONTHS[selectedMonth]}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Part Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Total Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {other.map((item, index) => {
                        const display = getPartDisplay(item.part);
                        return (
                          <TableRow key={index} data-testid={`other-row-${index}`}>
                            <TableCell className="font-medium">{display.name}</TableCell>
                            <TableCell>
                              {display.details && <Badge variant="outline">{display.details}</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge data-testid={`other-quantity-${index}`}>{item.totalQuantity}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
