import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/Header";
import NewAddClientDialog from "@/components/NewAddClientDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Package, Calendar, Printer } from "lucide-react";

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
      name: `${part.beltType} Belt`,
      details: part.size || ""
    };
  } else {
    return {
      name: part.name || "",
      details: part.description || ""
    };
  }
}

interface ClientPart {
  id: string;
  partId: string;
  quantity: number;
  part: {
    id: string;
    type: string;
    filterType?: string | null;
    beltType?: string | null;
    size?: string | null;
    name?: string | null;
    description?: string | null;
  };
}

interface ClientScheduleItem {
  id: string;
  companyName: string;
  location: string;
  selectedMonths: number[];
  parts: ClientPart[];
}

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [scheduleMonth, setScheduleMonth] = useState<number>(new Date().getMonth());
  const [activeTab, setActiveTab] = useState<string>("parts");
  const [, setLocation] = useLocation();
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const [showOnlyOutstanding, setShowOnlyOutstanding] = useState(false);

  const { data: reportData = [], isLoading } = useQuery<ReportItem[]>({
    queryKey: ["/api/reports/parts", selectedMonth, showOnlyOutstanding ? "outstanding" : "all"],
    queryFn: async () => {
      const response = await fetch(`/api/reports/parts/${selectedMonth}?outstanding=${showOnlyOutstanding}`);
      if (!response.ok) throw new Error('Failed to fetch report');
      return response.json();
    },
    enabled: selectedMonth !== undefined,
  });

  const { data: scheduleData = [], isLoading: isLoadingSchedule } = useQuery<ClientScheduleItem[]>({
    queryKey: ["/api/reports/schedule", scheduleMonth],
    enabled: scheduleMonth !== undefined,
  });

  const filters = reportData.filter(item => item.part.type === "filter");
  const belts = reportData.filter(item => item.part.type === "belt");
  const other = reportData.filter(item => item.part.type === "other");

  const currentMonth = activeTab === "parts" ? selectedMonth : scheduleMonth;
  const setCurrentMonth = activeTab === "parts" ? setSelectedMonth : setScheduleMonth;

  const handlePrint = () => {
    window.print();
  };

  const { data: allClients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  return (
    <div className="min-h-screen bg-background">
      <Header clients={allClients} onAddClient={() => setAddClientDialogOpen(true)} />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Reports</h1>
              <p className="text-muted-foreground">View parts orders and maintenance schedules</p>
            </div>
          </div>
          <div className="flex items-center gap-3 no-print">
            {activeTab === "parts" && (
              <>
                <Button
                  variant={showOnlyOutstanding ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOnlyOutstanding(!showOnlyOutstanding)}
                  data-testid="button-toggle-outstanding-reports"
                >
                  {showOnlyOutstanding ? "Outstanding Only" : "All Parts"}
                </Button>
                {reportData.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handlePrint}
                    data-testid="button-print-report"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                )}
              </>
            )}
            <Select
              value={currentMonth.toString()}
              onValueChange={(value) => setCurrentMonth(parseInt(value))}
            >
              <SelectTrigger className="w-48" data-testid={activeTab === "parts" ? "select-report-month" : "select-schedule-month"}>
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
        </div>

        <Tabs defaultValue="parts" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList data-testid="tabs-reports">
            <TabsTrigger value="parts" data-testid="tab-parts-report">
              <Package className="h-4 w-4 mr-2" />
              Parts Order
            </TabsTrigger>
            <TabsTrigger value="schedule" data-testid="tab-schedule-report">
              <Calendar className="h-4 w-4 mr-2" />
              PM Schedule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parts" className="space-y-6">

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
            {(filters.length > 0 || belts.length > 0) && (
              <div className="grid md:grid-cols-2 gap-6">
                {filters.length > 0 && (
                  <Card className="shadow-md rounded-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                        <Package className="h-5 w-5" />
                        Filters
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Total needed for {MONTHS[selectedMonth]}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-2">
                            <TableHead className="font-bold text-foreground">Filter Type</TableHead>
                            <TableHead className="font-bold text-foreground">Size</TableHead>
                            <TableHead className="text-right font-bold text-foreground">Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filters.map((item, index) => {
                            const display = getPartDisplay(item.part);
                            return (
                              <TableRow key={index} data-testid={`filter-row-${index}`} className="border-b">
                                <TableCell className="font-medium py-1.5">{display.name}</TableCell>
                                <TableCell className="py-1.5">
                                  <span className="text-sm text-muted-foreground">{display.details}</span>
                                </TableCell>
                                <TableCell className="text-right py-1.5">
                                  <Badge 
                                    data-testid={`filter-quantity-${index}`}
                                    variant="secondary"
                                    className="rounded-full px-2 py-0.5"
                                  >
                                    {item.totalQuantity}
                                  </Badge>
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
                  <Card className="shadow-md rounded-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                        <Package className="h-5 w-5" />
                        Belts
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Total needed for {MONTHS[selectedMonth]}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-2">
                            <TableHead className="font-bold text-foreground">Belt Type</TableHead>
                            <TableHead className="font-bold text-foreground">Size</TableHead>
                            <TableHead className="text-right font-bold text-foreground">Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {belts.map((item, index) => {
                            const display = getPartDisplay(item.part);
                            return (
                              <TableRow key={index} data-testid={`belt-row-${index}`} className="border-b">
                                <TableCell className="font-medium py-1.5">{display.name}</TableCell>
                                <TableCell className="py-1.5">
                                  <span className="text-sm text-muted-foreground">{display.details}</span>
                                </TableCell>
                                <TableCell className="text-right py-1.5">
                                  <Badge 
                                    data-testid={`belt-quantity-${index}`}
                                    variant="secondary"
                                    className="rounded-full px-2 py-0.5"
                                  >
                                    {item.totalQuantity}
                                  </Badge>
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
                            <TableCell className="font-medium py-1.5">{display.name}</TableCell>
                            <TableCell className="py-1.5">
                              {display.details && <Badge variant="outline">{display.details}</Badge>}
                            </TableCell>
                            <TableCell className="text-right py-1.5">
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
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6">
            {isLoadingSchedule ? (
              <Card>
                <CardContent className="p-8">
                  <p className="text-center text-muted-foreground">Loading schedule...</p>
                </CardContent>
              </Card>
            ) : scheduleData.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No maintenance scheduled for {MONTHS[scheduleMonth]}</p>
                    <p className="text-sm text-muted-foreground mt-1">No clients have PM scheduled for this month</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Clients Scheduled for {MONTHS[scheduleMonth]}
                  </CardTitle>
                  <CardDescription>
                    {scheduleData.length} {scheduleData.length === 1 ? 'client' : 'clients'} scheduled for preventive maintenance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>PM Schedule</TableHead>
                        <TableHead>Parts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduleData.map((client, index) => {
                        const filters = client.parts.filter(cp => cp.part.type === "filter");
                        const belts = client.parts.filter(cp => cp.part.type === "belt");
                        const sortedFilters = filters.sort((a, b) => {
                          const aDisplay = getPartDisplay(a.part);
                          const bDisplay = getPartDisplay(b.part);
                          return aDisplay.name.localeCompare(bDisplay.name);
                        });
                        const sortedBelts = belts.sort((a, b) => {
                          const aDisplay = getPartDisplay(a.part);
                          const bDisplay = getPartDisplay(b.part);
                          return aDisplay.name.localeCompare(bDisplay.name);
                        });
                        
                        return (
                          <TableRow key={client.id} data-testid={`schedule-row-${index}`}>
                            <TableCell className="font-medium py-1.5" data-testid={`client-name-${index}`}>
                              {client.companyName}
                            </TableCell>
                            <TableCell className="py-1.5" data-testid={`client-location-${index}`}>
                              {client.location}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <div className="flex flex-wrap gap-1">
                                {client.selectedMonths.map(monthIndex => (
                                  <Badge
                                    key={monthIndex}
                                    variant={monthIndex === scheduleMonth ? "default" : "outline"}
                                    data-testid={`month-badge-${index}-${monthIndex}`}
                                  >
                                    {MONTHS[monthIndex]}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <div className="space-y-1">
                                {sortedFilters.length > 0 && (
                                  <div className="text-xs">
                                    <span className="font-medium">Filters: </span>
                                    <span className="text-muted-foreground">
                                      {sortedFilters.map((cp, i) => {
                                        const display = getPartDisplay(cp.part);
                                        return (
                                          <span key={cp.id}>
                                            {i > 0 && ", "}
                                            {display.details} ({cp.quantity})
                                          </span>
                                        );
                                      })}
                                    </span>
                                  </div>
                                )}
                                {sortedBelts.length > 0 && (
                                  <div className="text-xs">
                                    <span className="font-medium">Belts: </span>
                                    <span className="text-muted-foreground">
                                      {sortedBelts.map((cp, i) => {
                                        const display = getPartDisplay(cp.part);
                                        return (
                                          <span key={cp.id}>
                                            {i > 0 && ", "}
                                            {display.details} ({cp.quantity})
                                          </span>
                                        );
                                      })}
                                    </span>
                                  </div>
                                )}
                                {sortedFilters.length === 0 && sortedBelts.length === 0 && (
                                  <span className="text-xs text-muted-foreground">No parts</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <NewAddClientDialog 
        open={addClientDialogOpen}
        onOpenChange={setAddClientDialogOpen}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        }}
      />

      <style>{`
        @media print {
          /* Hide navigation and controls */
          header,
          .no-print,
          [role="tablist"] {
            display: none !important;
          }

          /* Reset page margins */
          @page {
            margin: 0.75in;
          }

          /* Ensure content fits on page */
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          /* Remove background colors for better printing */
          * {
            background: white !important;
          }

          /* Keep borders and text colors */
          table,
          th,
          td {
            border-color: #000 !important;
          }

          /* Prevent page breaks inside cards and tables */
          .grid,
          [class*="Card"] {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* Add print header */
          main::before {
            content: "Parts Order Report - ${MONTHS[selectedMonth]}";
            display: block;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
            text-align: center;
          }

          /* Ensure proper spacing */
          main {
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
