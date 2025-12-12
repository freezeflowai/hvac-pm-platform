import { useState } from "react";
import { format } from "date-fns";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, 
  Phone,
  Mail,
  Calendar, 
  MoreHorizontal,
  PenTool,
  Download,
  Printer,
  Trash2,
  Briefcase,
  DollarSign,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Invoice, Client, CustomerCompany, Job } from "@shared/schema";

interface InvoiceHeaderCardProps {
  invoice: Invoice;
  location: Client;
  customerCompany?: CustomerCompany;
  job?: Job;
  onEdit?: () => void;
  onSend?: () => void;
  onCollectPayment?: () => void;
  canEdit?: boolean;
  isDraft?: boolean;
  sendPending?: boolean;
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(num);
}

function getIsOverdue(dueDate: string | null, balance: string, status: string): boolean {
  const balanceNum = parseFloat(balance);
  return !!(dueDate && new Date(dueDate) < new Date() && balanceNum > 0 && status !== "paid" && status !== "voided");
}

function getStatusBadge(status: string, isOverdue: boolean, sentAt: string | null): { 
  label: string; 
  variant: "default" | "destructive" | "secondary" | "outline";
} {
  if (isOverdue) return { label: "Past Due", variant: "destructive" };
  switch (status) {
    case "draft": return { label: sentAt ? "Sent" : "Not Sent", variant: sentAt ? "default" : "outline" };
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

export function InvoiceHeaderCard({ 
  invoice,
  location,
  customerCompany,
  job,
  onEdit,
  onSend,
  onCollectPayment,
  canEdit = true,
  isDraft = false,
  sendPending = false
}: InvoiceHeaderCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isOverdue = getIsOverdue(invoice.dueDate, invoice.balance, invoice.status);
  const statusInfo = getStatusBadge(invoice.status, isOverdue, invoice.sentAt ? String(invoice.sentAt) : null);
  const balanceColor = getBalanceColor(invoice.balance, isOverdue);
  const clientName = customerCompany?.name || location.companyName;
  
  const fullAddress = [location.address, location.city, location.province, location.postalCode].filter(Boolean).join(", ");

  const deleteInvoiceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/invoices/${invoice.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/list"] });
      toast({ title: "Invoice Deleted", description: "Invoice has been deleted." });
      if (job) {
        setLocation(`/jobs/${job.id}`);
      } else {
        setLocation("/invoices");
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete invoice", variant: "destructive" });
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    toast({ title: "Coming Soon", description: "PDF download will be available soon." });
  };

  const handleCollectSignature = () => {
    toast({ title: "Coming Soon", description: "Signature collection will be available soon." });
  };

  const handleDelete = () => {
    deleteInvoiceMutation.mutate();
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <Card className="mb-4" data-testid="card-invoice-header">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* LEFT: Client info, invoice number, contact info */}
            <div className="flex-1 min-w-[280px]">
              <button
                type="button"
                onClick={() => setLocation(`/clients/${location.id}`)}
                className="text-left"
                data-testid="link-client-title"
              >
                <h1 className="text-2xl font-semibold hover:text-primary transition-colors" data-testid="text-client-title">
                  {clientName}
                </h1>
              </button>


              {/* Contact info */}
              <div className="mt-3 space-y-1 text-sm">
                {fullAddress && (
                  <div className="flex items-center gap-1.5" data-testid="text-address">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{fullAddress}</span>
                  </div>
                )}
                {location.email && (
                  <div className="flex items-center gap-1.5" data-testid="text-email">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{location.email}</span>
                  </div>
                )}
                {location.phone && (
                  <div className="flex items-center gap-1.5" data-testid="text-phone">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{location.phone}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {canEdit && onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onEdit}
                    data-testid="button-edit-invoice"
                  >
                    Edit Invoice
                  </Button>
                )}
                
                {onCollectPayment && parseFloat(invoice.balance) > 0 && canEdit && (
                  <Button 
                    size="sm"
                    onClick={onCollectPayment}
                    data-testid="button-collect-payment"
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    Collect Payment
                  </Button>
                )}

                {isDraft && onSend && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSend}
                    disabled={sendPending}
                    data-testid="button-send-invoice"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-more-actions">
                      <MoreHorizontal className="h-4 w-4 mr-1" />
                      More Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem 
                      onClick={handleCollectSignature}
                      data-testid="menu-collect-signature"
                    >
                      <PenTool className="h-4 w-4 mr-2" />
                      Collect Signature
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleDownloadPDF}
                      data-testid="menu-download-pdf"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handlePrint}
                      data-testid="menu-print"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-destructive"
                      disabled={invoice.status === "paid"}
                      data-testid="menu-delete-invoice"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Invoice
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* RIGHT: Invoice meta info */}
            <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs min-w-[220px]">
              {/* Invoice number row */}
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="font-medium text-muted-foreground">Invoice</span>
                <span className="font-semibold text-foreground" data-testid="text-invoice-number">
                  #{invoice.invoiceNumber || `INV-${invoice.id.slice(0, 6).toUpperCase()}`}
                </span>
              </div>

              {/* Job row - right after Invoice */}
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="font-medium text-muted-foreground">Job</span>
                {job ? (
                  <Link href={`/jobs/${job.id}`}>
                    <button 
                      type="button"
                      className="font-semibold text-primary hover:underline"
                      data-testid="link-job"
                    >
                      #{job.jobNumber}
                    </button>
                  </Link>
                ) : (
                  <span className="text-[11px] text-muted-foreground">N/A</span>
                )}
              </div>

              {/* Status row */}
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="font-medium text-muted-foreground">Status</span>
                <Badge variant={statusInfo.variant} className="text-[11px]">
                  {statusInfo.label}
                </Badge>
              </div>

              {/* Issue Date */}
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="font-medium text-muted-foreground">Issue Date</span>
                <div className="flex items-center gap-1 text-[11px]">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>{format(new Date(invoice.createdAt), "MMM d, yyyy")}</span>
                </div>
              </div>

              {/* Due Date */}
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="font-medium text-muted-foreground">Due Date</span>
                <div className="flex items-center gap-1 text-[11px]">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className={isOverdue ? "text-destructive font-medium" : ""}>
                    {invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "Not set"}
                  </span>
                </div>
              </div>

              {/* Balance Due */}
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-muted-foreground">Balance Due</span>
                <span className={`font-bold text-sm ${balanceColor}`} data-testid="text-balance-due">
                  {formatCurrency(invoice.balance)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="dialog-delete-invoice">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteInvoiceMutation.isPending}
            >
              {deleteInvoiceMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
