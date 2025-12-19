
export function refreshInvoiceFromJob(job, invoice) {
  // HARD RULE:
  // - Job is source of work
  // - Invoice is source of billing
  // - Refresh is idempotent

  const jobItems = job.items || [];
  const invoiceItems = [];

  for (const item of jobItems) {
    invoiceItems.push({
      description: item.description,
      qty: item.qty,
      rate: item.rate,
      source: "job"
    });
  }

  return {
    ...invoice,
    items: invoiceItems
  };
}
