import type { CustomerCompany, Client, Invoice, InvoiceLine } from "@shared/schema";
import {
  mapCustomerCompanyToQBO,
  mapClientToQBOSubCustomer,
  mapStandaloneClientToQBO,
  parseQBOCustomerResponse,
  toQboInvoicePayload,
  fromQboInvoicePayload,
  extractLocationIdFromMemo,
  type QBOCustomerPayload,
  type QBOCustomerResponse,
  type QBOInvoicePayload,
  type QBOInvoiceResponse,
} from "./mappers";

// QBO API Error types
export class QBOSyncError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "QBOSyncError";
  }
}

export class QBODuplicateNameError extends QBOSyncError {
  constructor(displayName: string) {
    super(
      `A customer with the name "${displayName}" already exists in QuickBooks`,
      "DUPLICATE_NAME"
    );
  }
}

// Sync result types
export interface QBOSyncResult {
  success: boolean;
  qboCustomerId?: string;
  qboSyncToken?: string;
  error?: QBOSyncError;
}

export interface QBOInvoiceSyncResult {
  success: boolean;
  qboInvoiceId?: string;
  qboSyncToken?: string;
  qboDocNumber?: string;
  error?: QBOSyncError;
}

/**
 * QBO Sync Service
 * Handles synchronization between app entities and QuickBooks Online
 * 
 * NOTE: This is a stub implementation. The actual QBO API calls need to be
 * implemented when QBO OAuth integration is set up.
 */
export class QBOSyncService {
  private realmId: string | null = null;
  private accessToken: string | null = null;
  private baseUrl: string = "https://sandbox-quickbooks.api.intuit.com"; // Use production URL for live

  /**
   * Initialize the sync service with QBO credentials
   */
  setCredentials(realmId: string, accessToken: string, useSandbox: boolean = true) {
    this.realmId = realmId;
    this.accessToken = accessToken;
    this.baseUrl = useSandbox
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com";
  }

  /**
   * Check if QBO credentials are configured
   */
  isConfigured(): boolean {
    return !!this.realmId && !!this.accessToken;
  }

  // ============================================================
  // CUSTOMER COMPANY (Parent) SYNC METHODS
  // ============================================================

  /**
   * Create a new QBO Customer from a CustomerCompany
   */
  async createCustomerCompanyInQBO(company: CustomerCompany): Promise<QBOSyncResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: new QBOSyncError("QBO credentials not configured", "NOT_CONFIGURED"),
      };
    }

    try {
      const payload = mapCustomerCompanyToQBO(company, false);
      
      // TODO: Implement actual QBO API call
      // const response = await this.makeQBORequest("POST", "/v3/company/{realmId}/customer", payload);
      
      console.log("[QBO Sync] Would create Customer:", JSON.stringify(payload, null, 2));
      
      // Stub response for development
      return {
        success: true,
        qboCustomerId: `stub-${Date.now()}`,
        qboSyncToken: "0",
      };
    } catch (error) {
      console.error("[QBO Sync] Error creating customer:", error);
      return {
        success: false,
        error: error instanceof QBOSyncError ? error : new QBOSyncError(
          "Failed to create customer in QBO",
          "CREATE_FAILED",
          error
        ),
      };
    }
  }

  /**
   * Update an existing QBO Customer from a CustomerCompany
   */
  async updateCustomerCompanyInQBO(company: CustomerCompany): Promise<QBOSyncResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: new QBOSyncError("QBO credentials not configured", "NOT_CONFIGURED"),
      };
    }

    if (!company.qboCustomerId || !company.qboSyncToken) {
      return {
        success: false,
        error: new QBOSyncError(
          "Cannot update: Missing QBO Customer ID or SyncToken",
          "MISSING_QBO_ID"
        ),
      };
    }

    try {
      const payload = mapCustomerCompanyToQBO(company, true);
      
      // TODO: Implement actual QBO API call
      // const response = await this.makeQBORequest("POST", "/v3/company/{realmId}/customer", payload);
      
      console.log("[QBO Sync] Would update Customer:", JSON.stringify(payload, null, 2));
      
      // Stub response - increment sync token
      const newSyncToken = String(parseInt(company.qboSyncToken) + 1);
      
      return {
        success: true,
        qboCustomerId: company.qboCustomerId,
        qboSyncToken: newSyncToken,
      };
    } catch (error) {
      console.error("[QBO Sync] Error updating customer:", error);
      return {
        success: false,
        error: error instanceof QBOSyncError ? error : new QBOSyncError(
          "Failed to update customer in QBO",
          "UPDATE_FAILED",
          error
        ),
      };
    }
  }

  /**
   * Deactivate (soft delete) a QBO Customer
   */
  async deactivateCustomerCompanyInQBO(company: CustomerCompany): Promise<QBOSyncResult> {
    if (!company.qboCustomerId) {
      return {
        success: true, // Nothing to deactivate
      };
    }

    // Create a copy with isActive = false and sync
    const deactivatedCompany: CustomerCompany = {
      ...company,
      isActive: false,
    };
    
    return this.updateCustomerCompanyInQBO(deactivatedCompany);
  }

  // ============================================================
  // CLIENT (Location/Sub-Customer) SYNC METHODS
  // ============================================================

  /**
   * Create a new QBO Sub-Customer from a Client
   */
  async createClientInQBO(
    client: Client,
    parentCompanyName: string,
    parentQboCustomerId: string
  ): Promise<QBOSyncResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: new QBOSyncError("QBO credentials not configured", "NOT_CONFIGURED"),
      };
    }

    try {
      const payload = mapClientToQBOSubCustomer(
        client,
        parentCompanyName,
        parentQboCustomerId,
        false
      );
      
      // TODO: Implement actual QBO API call
      console.log("[QBO Sync] Would create Sub-Customer:", JSON.stringify(payload, null, 2));
      
      return {
        success: true,
        qboCustomerId: `stub-sub-${Date.now()}`,
        qboSyncToken: "0",
      };
    } catch (error) {
      console.error("[QBO Sync] Error creating sub-customer:", error);
      return {
        success: false,
        error: error instanceof QBOSyncError ? error : new QBOSyncError(
          "Failed to create sub-customer in QBO",
          "CREATE_FAILED",
          error
        ),
      };
    }
  }

  /**
   * Create a standalone Client as a QBO Customer (no parent)
   */
  async createStandaloneClientInQBO(client: Client): Promise<QBOSyncResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: new QBOSyncError("QBO credentials not configured", "NOT_CONFIGURED"),
      };
    }

    try {
      const payload = mapStandaloneClientToQBO(client, false);
      
      // TODO: Implement actual QBO API call
      console.log("[QBO Sync] Would create standalone Customer:", JSON.stringify(payload, null, 2));
      
      return {
        success: true,
        qboCustomerId: `stub-standalone-${Date.now()}`,
        qboSyncToken: "0",
      };
    } catch (error) {
      console.error("[QBO Sync] Error creating standalone customer:", error);
      return {
        success: false,
        error: error instanceof QBOSyncError ? error : new QBOSyncError(
          "Failed to create customer in QBO",
          "CREATE_FAILED",
          error
        ),
      };
    }
  }

  /**
   * Update an existing QBO Sub-Customer from a Client
   */
  async updateClientInQBO(
    client: Client,
    parentCompanyName: string,
    parentQboCustomerId: string
  ): Promise<QBOSyncResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: new QBOSyncError("QBO credentials not configured", "NOT_CONFIGURED"),
      };
    }

    if (!client.qboCustomerId || !client.qboSyncToken) {
      return {
        success: false,
        error: new QBOSyncError(
          "Cannot update: Missing QBO Customer ID or SyncToken",
          "MISSING_QBO_ID"
        ),
      };
    }

    try {
      const payload = mapClientToQBOSubCustomer(
        client,
        parentCompanyName,
        parentQboCustomerId,
        true
      );
      
      // TODO: Implement actual QBO API call
      console.log("[QBO Sync] Would update Sub-Customer:", JSON.stringify(payload, null, 2));
      
      const newSyncToken = String(parseInt(client.qboSyncToken) + 1);
      
      return {
        success: true,
        qboCustomerId: client.qboCustomerId,
        qboSyncToken: newSyncToken,
      };
    } catch (error) {
      console.error("[QBO Sync] Error updating sub-customer:", error);
      return {
        success: false,
        error: error instanceof QBOSyncError ? error : new QBOSyncError(
          "Failed to update sub-customer in QBO",
          "UPDATE_FAILED",
          error
        ),
      };
    }
  }

  /**
   * Deactivate (soft delete) a QBO Sub-Customer
   */
  async deactivateClientInQBO(
    client: Client,
    parentCompanyName: string,
    parentQboCustomerId: string
  ): Promise<QBOSyncResult> {
    if (!client.qboCustomerId) {
      return {
        success: true, // Nothing to deactivate
      };
    }

    const deactivatedClient: Client = {
      ...client,
      inactive: true,
    };
    
    return this.updateClientInQBO(deactivatedClient, parentCompanyName, parentQboCustomerId);
  }

  // ============================================================
  // BULK SYNC METHODS
  // ============================================================

  /**
   * Fetch all customers from QBO for a realm
   * Used for initial sync or reconciliation
   */
  async fetchAllQBOCustomers(): Promise<QBOCustomerResponse[]> {
    if (!this.isConfigured()) {
      throw new QBOSyncError("QBO credentials not configured", "NOT_CONFIGURED");
    }

    // TODO: Implement actual QBO API call with pagination
    // SELECT * FROM Customer MAXRESULTS 1000
    
    console.log("[QBO Sync] Would fetch all customers from QBO");
    return [];
  }

  /**
   * Sync all customer companies and their locations to QBO
   */
  async syncAllToQBO(
    companies: CustomerCompany[],
    clients: Client[]
  ): Promise<{ companies: QBOSyncResult[]; clients: QBOSyncResult[] }> {
    const companyResults: QBOSyncResult[] = [];
    const clientResults: QBOSyncResult[] = [];

    // First, sync all parent companies
    for (const company of companies) {
      const result = company.qboCustomerId
        ? await this.updateCustomerCompanyInQBO(company)
        : await this.createCustomerCompanyInQBO(company);
      companyResults.push(result);
    }

    // Build a map of company ID to QBO customer ID
    const companyQboMap = new Map<string, { name: string; qboId: string }>();
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const result = companyResults[i];
      if (result.success && result.qboCustomerId) {
        companyQboMap.set(company.id, {
          name: company.name,
          qboId: result.qboCustomerId,
        });
      }
    }

    // Then sync all clients/locations
    for (const client of clients) {
      if (client.parentCompanyId) {
        const parent = companyQboMap.get(client.parentCompanyId);
        if (parent) {
          const result = client.qboCustomerId
            ? await this.updateClientInQBO(client, parent.name, parent.qboId)
            : await this.createClientInQBO(client, parent.name, parent.qboId);
          clientResults.push(result);
        } else {
          clientResults.push({
            success: false,
            error: new QBOSyncError(
              "Parent company not synced to QBO",
              "PARENT_NOT_SYNCED"
            ),
          });
        }
      } else {
        // Standalone client
        const result = client.qboCustomerId
          ? await this.updateClientInQBO(client, client.companyName, client.qboCustomerId)
          : await this.createStandaloneClientInQBO(client);
        clientResults.push(result);
      }
    }

    return { companies: companyResults, clients: clientResults };
  }

  // ============================================================
  // INVOICE SYNC METHODS
  // ============================================================

  /**
   * Create a new QBO Invoice
   * CustomerRef is determined by location.billWithParent:
   * - If true: bills to parent company's qboCustomerId
   * - If false: bills to location's qboCustomerId
   */
  async createInvoiceInQBO(
    invoice: Invoice,
    location: Client,
    customerCompany: CustomerCompany | undefined,
    lines: InvoiceLine[]
  ): Promise<QBOInvoiceSyncResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: new QBOSyncError("QBO credentials not configured", "NOT_CONFIGURED"),
      };
    }

    try {
      const payload = toQboInvoicePayload(invoice, location, customerCompany, lines, false);
      
      // TODO: Implement actual QBO API call
      // const response = await this.makeQBORequest("POST", "/v3/company/{realmId}/invoice", payload);
      
      console.log("[QBO Sync] Would create Invoice:", JSON.stringify(payload, null, 2));
      
      // Stub response for development
      return {
        success: true,
        qboInvoiceId: `stub-inv-${Date.now()}`,
        qboSyncToken: "0",
        qboDocNumber: invoice.invoiceNumber || undefined,
      };
    } catch (error) {
      console.error("[QBO Sync] Error creating invoice:", error);
      return {
        success: false,
        error: error instanceof QBOSyncError ? error : new QBOSyncError(
          "Failed to create invoice in QBO",
          "CREATE_FAILED",
          error
        ),
      };
    }
  }

  /**
   * Update an existing QBO Invoice
   */
  async updateInvoiceInQBO(
    invoice: Invoice,
    location: Client,
    customerCompany: CustomerCompany | undefined,
    lines: InvoiceLine[]
  ): Promise<QBOInvoiceSyncResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: new QBOSyncError("QBO credentials not configured", "NOT_CONFIGURED"),
      };
    }

    if (!invoice.qboInvoiceId || !invoice.qboSyncToken) {
      return {
        success: false,
        error: new QBOSyncError(
          "Cannot update: Missing QBO Invoice ID or SyncToken",
          "MISSING_QBO_ID"
        ),
      };
    }

    try {
      const payload = toQboInvoicePayload(invoice, location, customerCompany, lines, true);
      
      // TODO: Implement actual QBO API call
      console.log("[QBO Sync] Would update Invoice:", JSON.stringify(payload, null, 2));
      
      // Stub response - increment sync token
      const newSyncToken = String(parseInt(invoice.qboSyncToken) + 1);
      
      return {
        success: true,
        qboInvoiceId: invoice.qboInvoiceId,
        qboSyncToken: newSyncToken,
        qboDocNumber: payload.DocNumber,
      };
    } catch (error) {
      console.error("[QBO Sync] Error updating invoice:", error);
      return {
        success: false,
        error: error instanceof QBOSyncError ? error : new QBOSyncError(
          "Failed to update invoice in QBO",
          "UPDATE_FAILED",
          error
        ),
      };
    }
  }

  /**
   * Void an invoice in QBO
   * QBO doesn't allow hard deletion of invoices - they must be voided
   */
  async voidInvoiceInQBO(
    invoice: Invoice,
    location: Client,
    customerCompany: CustomerCompany | undefined,
    lines: InvoiceLine[]
  ): Promise<QBOInvoiceSyncResult> {
    if (!invoice.qboInvoiceId) {
      return {
        success: true, // Nothing to void
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        error: new QBOSyncError("QBO credentials not configured", "NOT_CONFIGURED"),
      };
    }

    try {
      // In QBO, you void an invoice by updating it with the void operation
      // POST /v3/company/{realmId}/invoice?operation=void
      
      console.log("[QBO Sync] Would void Invoice:", invoice.qboInvoiceId);
      
      return {
        success: true,
        qboInvoiceId: invoice.qboInvoiceId,
        qboSyncToken: String(parseInt(invoice.qboSyncToken || "0") + 1),
      };
    } catch (error) {
      console.error("[QBO Sync] Error voiding invoice:", error);
      return {
        success: false,
        error: error instanceof QBOSyncError ? error : new QBOSyncError(
          "Failed to void invoice in QBO",
          "VOID_FAILED",
          error
        ),
      };
    }
  }

  /**
   * Sync an invoice to QBO (create or update)
   * High-level method that determines whether to create or update
   */
  async syncInvoiceToQBO(
    invoice: Invoice,
    location: Client,
    customerCompany: CustomerCompany | undefined,
    lines: InvoiceLine[]
  ): Promise<QBOInvoiceSyncResult> {
    // If invoice is voided/cancelled in app, void it in QBO
    if (invoice.status === "void" || invoice.status === "cancelled" || !invoice.isActive) {
      if (invoice.qboInvoiceId) {
        return this.voidInvoiceInQBO(invoice, location, customerCompany, lines);
      }
      return { success: true }; // Nothing to sync for unsynced void invoice
    }

    // Create or update
    if (invoice.qboInvoiceId) {
      return this.updateInvoiceInQBO(invoice, location, customerCompany, lines);
    } else {
      return this.createInvoiceInQBO(invoice, location, customerCompany, lines);
    }
  }

  /**
   * Fetch invoices from QBO modified since a given date
   * Used for pulling changes from QBO to the app
   */
  async fetchInvoicesFromQBO(since?: Date): Promise<QBOInvoiceResponse[]> {
    if (!this.isConfigured()) {
      throw new QBOSyncError("QBO credentials not configured", "NOT_CONFIGURED");
    }

    // TODO: Implement actual QBO API call with query
    // Example: SELECT * FROM Invoice WHERE MetaData.LastUpdatedTime > '2024-01-01'
    
    console.log("[QBO Sync] Would fetch invoices from QBO", since ? `since ${since.toISOString()}` : "");
    return [];
  }

  /**
   * Process a QBO invoice response and map it to local entities
   * Returns parsed data that can be used to upsert the local invoice
   */
  processQBOInvoice(
    qboInvoice: QBOInvoiceResponse,
    customerMap: Map<string, { type: "company" | "location"; id: string }>
  ): {
    parsed: ReturnType<typeof fromQboInvoicePayload>;
    locationId: string | null;
    customerCompanyId: string | null;
    error?: string;
  } {
    const parsed = fromQboInvoicePayload(qboInvoice);
    
    // Try to find the location from the CustomerMemo
    let locationId = extractLocationIdFromMemo(parsed.customerMemo);
    let customerCompanyId: string | null = null;

    // If no location ID in memo, try to determine from CustomerRef
    if (!locationId) {
      const customer = customerMap.get(parsed.customerRefId);
      if (customer) {
        if (customer.type === "location") {
          locationId = customer.id;
        } else {
          // CustomerRef points to a company, we need more info to find location
          customerCompanyId = customer.id;
        }
      }
    }

    return {
      parsed,
      locationId,
      customerCompanyId,
      error: !locationId ? "Could not determine location for invoice" : undefined,
    };
  }
}

// Singleton instance
export const qboSyncService = new QBOSyncService();
