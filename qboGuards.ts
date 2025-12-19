
export function assertInvoiceSyncAllowed(invoice) {
  if (invoice.status !== "sent") {
    throw new Error("Invoice must be sent before syncing");
  }
  if (invoice.paid) {
    throw new Error("Paid invoices cannot be modified");
  }
}
