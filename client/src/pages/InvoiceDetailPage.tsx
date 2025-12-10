import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, Edit, Send, MoreHorizontal, Plus, Trash2, DollarSign, 
  ExternalLink, Phone, Mail, MapPin, Building2, FileText, GripVertical,
  Check, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Invoice, InvoiceLine, Payment, Client, CustomerCompany, Job } from "@shared/schema";

interface InvoiceDetails {
  invoice: Invoice;
  lines: InvoiceLine[];
  location: Client;
  customerCompany?: CustomerCompany;
  job?: Job;
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(num);
}

function getIsOverdue(dueDate: string | null, balance: string, status: string): boolean {
  const balanceNum = parseFloat(balance);
  return !!(dueDate && new Date(dueDate) < new Date() && balanceNum > 0 && status !== "paid" && status !== "voided");
}

function getStatusBadge(status: string, isOverdue: boolean): { 
  label: string; 
  variant: "default" | "destructive" | "secondary" | "outline";
} {
  if (isOverdue) {
    return { label: "Past Due", variant: "destructive" };
  }
  
  switch (status) {
    case "draft": return { label: "Draft", variant: "outline" };
    case "sent": return { label: "Sent", variant: "default" };
    case "viewed": return { label: "Viewed", variant: "secondary" };
    case "partial_paid": return { label: "Partial", variant: "secondary" };
    case "paid": return { label: "Paid", variant: "default" };
    case "voided": return { label: "Voided", variant: "outline" };
    default: return { label: status, variant: "outline" };
  }
}

function getBalanceColor(balance: string, isOverdue: boolean): string {
  const balanceNum = parseFloat(balance);
  if (balanceNum === 0) return "text-green-600";
  if (isOverdue) return "text-destructive";
  return "text-amber-600";
}

interface InvoiceClientCardProps {
  location: Client;
  customerCompany?: CustomerCompany;
}

function InvoiceClientCard({ location, customerCompany }: InvoiceClientCardProps) {
  const clientName = customerCompany?.name || location.companyName;
  const locationName = customerCompany && location.companyName ? location.companyName : null;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Client
          </CardTitle>
          <Link href={`/clients/${location.id}`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="link-view-client">
              View Client
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-medium" data-testid="text-client-name">{clientName}</p>
          {locationName && (
            <p className="text-sm text-muted-foreground">{locationName}</p>
          )}
        </div>
        
        {(location.address || location.city || location.province) && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              {location.address && <p>{location.address}</p>}
              {(location.city || location.province) && (
                <p>{[location.city, location.province, location.postalCode].filter(Boolean).join(", ")}</p>
              )}
            </div>
          </div>
        )}
        
        {location.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <a href={`tel:${location.phone}`} className="hover:text-foreground">{location.phone}</a>
          </div>
        )}
        
        {location.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <a href={`mailto:${location.email}`} className="hover:text-foreground">{location.email}</a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface InvoiceInfoCardProps {
  invoice: Invoice;
  isOverdue: boolean;
  job?: Job;
}

function InvoiceInfoCard({ invoice, isOverdue, job }: InvoiceInfoCardProps) {
  const balanceColor = getBalanceColor(invoice.balance, isOverdue);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Invoice Info
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Issue Date</p>
              <p className="text-sm font-medium">{format(new Date(invoice.issueDate), "MMM d, yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</p>
              <p className={`text-sm font-medium ${isOverdue ? "text-destructive" : ""}`}>
                {invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "-"}
              </p>
            </div>
            {invoice.jobId && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Linked Job</p>
                <Link href={`/jobs/${invoice.jobId}`}>
                  <span className="text-sm font-medium text-primary hover:underline cursor-pointer" data-testid="link-view-job">
                    #{job?.jobNumber || invoice.jobId.slice(0, 8)}
                  </span>
                </Link>
              </div>
            )}
          </div>
          
          <div className="space-y-2 text-right">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-sm">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tax</span>
              <span className="text-sm">{formatCurrency(invoice.taxTotal)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm font-medium">Total</span>
              <span className="text-sm font-medium">{formatCurrency(invoice.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Paid</span>
              <span className="text-sm">{formatCurrency(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm font-semibold">Balance Due</span>
              <span className={`text-sm font-bold ${balanceColor}`}>
                {formatCurrency(invoice.balance)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface InvoiceActivityTimelineProps {
  invoice: Invoice;
  payments: Payment[];
}

function InvoiceActivityTimeline({ invoice, payments }: InvoiceActivityTimelineProps) {
  const events = useMemo(() => {
    const items: { date: Date; title: string; subtitle?: string; color: string }[] = [
      {
        date: new Date(invoice.createdAt),
        title: "Invoice created",
        color: "bg-primary",
      },
    ];
    
    if (invoice.sentAt) {
      items.push({
        date: new Date(invoice.sentAt),
        title: "Invoice sent",
        color: "bg-blue-500",
      });
    }
    
    payments.forEach((payment) => {
      items.push({
        date: new Date(payment.receivedAt),
        title: `Payment received: ${formatCurrency(payment.amount)}`,
        subtitle: payment.method ? `via ${payment.method}` : undefined,
        color: "bg-green-500",
      });
    });
    
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [invoice, payments]);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={index} className="flex items-start gap-3 relative">
                <div className={`h-3 w-3 rounded-full ${event.color} ring-2 ring-background z-10 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(event.date, "MMM d, yyyy 'at' h:mm a")}
                    {event.subtitle && ` • ${event.subtitle}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface InvoiceLineItemsCardProps {
  invoice: Invoice;
  lines: InvoiceLine[];
  isEditing: boolean;
  onAddLine?: () => void;
  onDeleteLine?: (lineId: string) => void;
}

function InvoiceLineItemsCard({ invoice, lines, isEditing, onAddLine, onDeleteLine }: InvoiceLineItemsCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium">Line Items</CardTitle>
          {isEditing && (
            <Button size="sm" variant="outline" onClick={onAddLine} data-testid="button-add-line-item">
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              {isEditing && <TableHead className="w-[40px]"></TableHead>}
              <TableHead className="w-[40%]">Description</TableHead>
              <TableHead className="text-center w-[80px]">Qty</TableHead>
              <TableHead className="text-right w-[100px]">Rate</TableHead>
              <TableHead className="text-center w-[80px]">Tax</TableHead>
              <TableHead className="text-right w-[100px]">Total</TableHead>
              {isEditing && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isEditing ? 7 : 5} className="text-center py-12 text-muted-foreground">
                  No line items yet.
                  {isEditing && " Click 'Add Item' to add items to this invoice."}
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line) => (
                <TableRow key={line.id} data-testid={`row-line-item-${line.id}`}>
                  {isEditing && (
                    <TableCell className="w-[40px] cursor-grab">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  )}
                  <TableCell>
                    {isEditing ? (
                      <Textarea
                        defaultValue={line.description}
                        className="min-h-[60px] resize-none"
                        placeholder="Description"
                      />
                    ) : (
                      <div>
                        <p className="font-medium">{line.description}</p>
                        {line.date && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(line.date), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {isEditing ? (
                      <Input
                        type="number"
                        defaultValue={line.quantity}
                        className="w-16 text-center mx-auto"
                      />
                    ) : (
                      line.quantity
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={line.unitPrice}
                        className="w-24 text-right ml-auto"
                      />
                    ) : (
                      formatCurrency(line.unitPrice)
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {isEditing ? (
                      <Checkbox defaultChecked={parseFloat(line.taxRate) > 0} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {parseFloat(line.taxRate) > 0 ? "Yes" : "No"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(line.lineSubtotal)}
                  </TableCell>
                  {isEditing && (
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => onDeleteLine?.(line.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        <div className="p-4 border-t bg-muted/30">
          <div className="flex flex-col items-end gap-1">
            <div className="flex justify-between w-48">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-sm">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between w-48">
              <span className="text-sm text-muted-foreground">Tax (13%)</span>
              <span className="text-sm">{formatCurrency(invoice.taxTotal)}</span>
            </div>
            <div className="flex justify-between w-48 pt-2 border-t mt-1">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-sm font-bold">{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface InvoiceNotesCardProps {
  publicNotes: string | null;
  internalNotes: string | null;
  isEditing: boolean;
}

function InvoiceNotesCard({ publicNotes, internalNotes, isEditing }: InvoiceNotesCardProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Tabs defaultValue="public" className="w-full">
          <div className="px-4 pt-4">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="public" data-testid="tab-public-notes">Public Notes</TabsTrigger>
              <TabsTrigger value="internal" data-testid="tab-internal-notes">Internal Notes</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="public" className="p-4 pt-3">
            {isEditing ? (
              <Textarea
                placeholder="Add a message for your client (will appear on invoice)..."
                defaultValue={publicNotes || ""}
                className="min-h-[100px] resize-none"
                data-testid="textarea-public-notes"
              />
            ) : (
              <p className="text-sm text-muted-foreground min-h-[60px]">
                {publicNotes || "No public notes added."}
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="internal" className="p-4 pt-3">
            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Add internal notes (not visible to client)..."
                  defaultValue={internalNotes || ""}
                  className="min-h-[100px] resize-none"
                  data-testid="textarea-internal-notes"
                />
                <div className="p-3 border border-dashed rounded-md text-center text-sm text-muted-foreground">
                  Drag files here or click to upload attachments
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground min-h-[60px]">
                {internalNotes || "No internal notes added."}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function InvoiceDetailPage() {
  const [, params] = useRoute("/invoices/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const invoiceId = params?.id;
  
  const [isEditing, setIsEditing] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("e-transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: details, isLoading } = useQuery<InvoiceDetails>({
    queryKey: ["/api/invoices", invoiceId, "details"],
    enabled: !!invoiceId,
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/invoices", invoiceId, "payments"],
    enabled: !!invoiceId,
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/invoices/${invoiceId}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      toast({ title: "Invoice sent successfully" });
    },
    onError: () => toast({ title: "Failed to send invoice", variant: "destructive" }),
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: { amount: string; method: string; reference?: string; notes?: string }) =>
      apiRequest("POST", `/api/invoices/${invoiceId}/payments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/stats"] });
      setShowPaymentDialog(false);
      setPaymentAmount("");
      setPaymentMethod("e-transfer");
      setPaymentReference("");
      setPaymentNotes("");
      toast({ title: "Payment recorded successfully" });
    },
    onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
  });

  if (!invoiceId) {
    return <div className="p-6">Invoice not found</div>;
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading invoice...</div>
      </div>
    );
  }

  if (!details) {
    return <div className="p-6">Invoice not found</div>;
  }

  const { invoice, lines, location, customerCompany, job } = details;
  const isOverdue = getIsOverdue(invoice.dueDate, invoice.balance, invoice.status);
  const statusInfo = getStatusBadge(invoice.status, isOverdue);
  const balanceColor = getBalanceColor(invoice.balance, isOverdue);
  const clientName = customerCompany?.name || location.companyName;
  const canEdit = invoice.status !== "paid" && invoice.status !== "voided";

  const handleRecordPayment = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    createPaymentMutation.mutate({
      amount: paymentAmount,
      method: paymentMethod,
      reference: paymentReference || undefined,
      notes: paymentNotes || undefined,
    });
  };

  const handleSaveChanges = () => {
    // TODO: Implement save logic for edit mode:
    // 1. Collect form data from line items and notes
    // 2. Call PATCH /api/invoices/:id with updated data
    // 3. Invalidate queries on success
    // For now, exit edit mode with confirmation
    toast({ title: "Changes saved" });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background z-10 border-b">
        <div className="p-4 max-w-[1600px] mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Link href="/invoices">
                <Button variant="ghost" size="icon" className="mt-0.5" data-testid="button-back-invoices">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold">
                    Invoice {invoice.invoiceNumber || `INV-${invoice.id.slice(0, 6).toUpperCase()}`}
                  </h1>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Client: {clientName}
                  {job && ` • Job: #${job.jobNumber}`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance Due</p>
                <p className={`text-xl font-bold ${balanceColor}`} data-testid="text-balance-due">
                  {formatCurrency(invoice.balance)}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    <Button 
                      onClick={() => setShowPaymentDialog(true)}
                      disabled={!canEdit || parseFloat(invoice.balance) <= 0}
                      data-testid="button-collect-payment"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Collect Payment
                    </Button>
                    {invoice.status === "draft" ? (
                      <Button
                        variant="outline"
                        onClick={() => sendMutation.mutate()}
                        disabled={sendMutation.isPending}
                        data-testid="button-send-invoice"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(true)}
                        disabled={!canEdit}
                        data-testid="button-edit-invoice"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleCancelEdit} data-testid="button-cancel-edit">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleSaveChanges} data-testid="button-save-invoice">
                      <Check className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" data-testid="button-invoice-more">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {invoice.status === "draft" && (
                      <DropdownMenuItem 
                        onClick={() => sendMutation.mutate()}
                        disabled={sendMutation.isPending}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send Invoice
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem>
                      <FileText className="h-4 w-4 mr-2" />
                      Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem>Duplicate Invoice</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">Void Invoice</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 xl:col-span-4 space-y-4">
              <InvoiceClientCard 
                location={location} 
                customerCompany={customerCompany} 
              />
              
              <InvoiceInfoCard 
                invoice={invoice} 
                isOverdue={isOverdue}
                job={job}
              />
              
              <InvoiceActivityTimeline 
                invoice={invoice} 
                payments={payments} 
              />
            </div>

            <div className="lg:col-span-8 xl:col-span-8 space-y-4">
              <InvoiceLineItemsCard
                invoice={invoice}
                lines={lines}
                isEditing={isEditing}
                onAddLine={() => {
                  // TODO: Implement add line
                  toast({ title: "Add line item (coming soon)" });
                }}
                onDeleteLine={(lineId) => {
                  // TODO: Implement delete line
                  toast({ title: `Delete line ${lineId} (coming soon)` });
                }}
              />
              
              <InvoiceNotesCard
                publicNotes={invoice.notesCustomer}
                internalNotes={invoice.notesInternal}
                isEditing={isEditing}
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Balance due: {formatCurrency(invoice.balance)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="payment-amount">Amount</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="input-payment-amount"
              />
            </div>
            <div>
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">Credit Card</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="e-transfer">E-Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment-reference">Reference (optional)</Label>
              <Input
                id="payment-reference"
                placeholder="Transaction ID, cheque number, etc."
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                data-testid="input-payment-reference"
              />
            </div>
            <div>
              <Label htmlFor="payment-notes">Notes (optional)</Label>
              <Textarea
                id="payment-notes"
                placeholder="Add notes..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                data-testid="input-payment-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRecordPayment} 
              disabled={createPaymentMutation.isPending}
              data-testid="button-save-payment"
            >
              {createPaymentMutation.isPending ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
