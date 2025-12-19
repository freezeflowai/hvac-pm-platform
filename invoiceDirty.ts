
import { db } from "../storage";

export async function markInvoiceDirty(invoiceId: string) {
  await db.update("invoices").set({ dirty: true }).where({ id: invoiceId });
}
