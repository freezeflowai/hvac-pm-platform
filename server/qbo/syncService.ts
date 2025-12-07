import type { CustomerCompany, Client, InsertCustomerCompany, UpdateCustomerCompany } from "@shared/schema";
import {
  mapCustomerCompanyToQBO,
  mapClientToQBOSubCustomer,
  mapStandaloneClientToQBO,
  parseQBOCustomerResponse,
  type QBOCustomerPayload,
  type QBOCustomerResponse,
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
}

// Singleton instance
export const qboSyncService = new QBOSyncService();
