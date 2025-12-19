
import {
  type Invoice,
  type InvoiceLine,
} from "../schemas";
import { assertInvoiceSyncAllowed } from "../services/qboGuards";

export async function syncInvoiceToQBO(invoice: Invoice) {
  assertInvoiceSyncAllowed(invoice);
  // existing QBO sync logic remains unchanged
}
