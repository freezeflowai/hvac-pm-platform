import type { CustomerCompany, Client } from "@shared/schema";

// QBO Customer/Sub-Customer JSON payload interfaces
export interface QBOAddress {
  Line1?: string;
  City?: string;
  CountrySubDivisionCode?: string; // Province/State
  PostalCode?: string;
  Country?: string;
}

export interface QBOParentRef {
  value: string; // QBO Customer.Id of the parent
}

export interface QBOCustomerPayload {
  Id?: string; // Only for updates
  SyncToken?: string; // Required for updates
  DisplayName: string;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryPhone?: { FreeFormNumber: string };
  PrimaryEmailAddr?: { Address: string };
  BillAddr?: QBOAddress;
  Active: boolean;
  // Sub-customer specific fields
  ParentRef?: QBOParentRef;
  BillWithParent?: boolean;
  Job?: boolean; // Set to true for sub-customers
}

export interface QBOCustomerResponse {
  Id: string;
  SyncToken: string;
  DisplayName: string;
  CompanyName?: string;
  PrimaryPhone?: { FreeFormNumber: string };
  PrimaryEmailAddr?: { Address: string };
  BillAddr?: QBOAddress;
  Active: boolean;
  ParentRef?: QBOParentRef;
  BillWithParent?: boolean;
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

// ============================================================
// APP -> QBO MAPPERS
// ============================================================

/**
 * Maps a CustomerCompany (parent) to a QBO Customer payload
 * Used when creating or updating a QBO Customer
 */
export function mapCustomerCompanyToQBO(
  company: CustomerCompany,
  forUpdate: boolean = false
): QBOCustomerPayload {
  const payload: QBOCustomerPayload = {
    DisplayName: company.name,
    CompanyName: company.legalName || company.name,
    Active: company.isActive,
  };

  // Add phone if present
  if (company.phone) {
    payload.PrimaryPhone = { FreeFormNumber: company.phone };
  }

  // Add email if present
  if (company.email) {
    payload.PrimaryEmailAddr = { Address: company.email };
  }

  // Add billing address if any field is present
  if (company.billingStreet || company.billingCity || company.billingProvince || company.billingPostalCode) {
    payload.BillAddr = {
      Line1: company.billingStreet || undefined,
      City: company.billingCity || undefined,
      CountrySubDivisionCode: company.billingProvince || undefined,
      PostalCode: company.billingPostalCode || undefined,
      Country: company.billingCountry || undefined,
    };
  }

  // For updates, include Id and SyncToken
  if (forUpdate && company.qboCustomerId && company.qboSyncToken) {
    payload.Id = company.qboCustomerId;
    payload.SyncToken = company.qboSyncToken;
  }

  return payload;
}

/**
 * Maps a Client (location/child) to a QBO Sub-Customer payload
 * Requires the parent company name for building the DisplayName
 */
export function mapClientToQBOSubCustomer(
  client: Client,
  parentCompanyName: string,
  parentQboCustomerId: string,
  forUpdate: boolean = false
): QBOCustomerPayload {
  // Build DisplayName as "ParentName: LocationName" per QBO convention
  const locationName = client.location || client.companyName;
  const displayName = `${parentCompanyName}: ${locationName}`;

  const payload: QBOCustomerPayload = {
    DisplayName: displayName,
    CompanyName: client.companyName,
    Active: !client.inactive,
    Job: true, // Marks this as a sub-customer in QBO
    ParentRef: { value: parentQboCustomerId },
    BillWithParent: client.billWithParent,
  };

  // Add contact name if present
  if (client.contactName) {
    const nameParts = client.contactName.split(" ");
    payload.GivenName = nameParts[0] || undefined;
    payload.FamilyName = nameParts.slice(1).join(" ") || undefined;
  }

  // Add phone if present
  if (client.phone) {
    payload.PrimaryPhone = { FreeFormNumber: client.phone };
  }

  // Add email if present
  if (client.email) {
    payload.PrimaryEmailAddr = { Address: client.email };
  }

  // Add service address as billing address
  if (client.address || client.city || client.province || client.postalCode) {
    payload.BillAddr = {
      Line1: client.address || undefined,
      City: client.city || undefined,
      CountrySubDivisionCode: client.province || undefined,
      PostalCode: client.postalCode || undefined,
    };
  }

  // For updates, include Id and SyncToken
  if (forUpdate && client.qboCustomerId && client.qboSyncToken) {
    payload.Id = client.qboCustomerId;
    payload.SyncToken = client.qboSyncToken;
  }

  return payload;
}

/**
 * Maps a standalone Client (no parent) to a QBO Customer payload
 * Used for clients that don't belong to a parent company
 */
export function mapStandaloneClientToQBO(
  client: Client,
  forUpdate: boolean = false
): QBOCustomerPayload {
  const displayName = client.location 
    ? `${client.companyName}: ${client.location}`
    : client.companyName;

  const payload: QBOCustomerPayload = {
    DisplayName: displayName,
    CompanyName: client.companyName,
    Active: !client.inactive,
  };

  // Add contact name if present
  if (client.contactName) {
    const nameParts = client.contactName.split(" ");
    payload.GivenName = nameParts[0] || undefined;
    payload.FamilyName = nameParts.slice(1).join(" ") || undefined;
  }

  // Add phone if present
  if (client.phone) {
    payload.PrimaryPhone = { FreeFormNumber: client.phone };
  }

  // Add email if present
  if (client.email) {
    payload.PrimaryEmailAddr = { Address: client.email };
  }

  // Add address
  if (client.address || client.city || client.province || client.postalCode) {
    payload.BillAddr = {
      Line1: client.address || undefined,
      City: client.city || undefined,
      CountrySubDivisionCode: client.province || undefined,
      PostalCode: client.postalCode || undefined,
    };
  }

  // For updates, include Id and SyncToken
  if (forUpdate && client.qboCustomerId && client.qboSyncToken) {
    payload.Id = client.qboCustomerId;
    payload.SyncToken = client.qboSyncToken;
  }

  return payload;
}

// ============================================================
// QBO -> APP MAPPERS
// ============================================================

export interface ParsedQBOCustomer {
  isSubCustomer: boolean;
  parentQboId: string | null;
  displayName: string;
  parentName: string | null; // Extracted from DisplayName for sub-customers
  locationName: string | null; // Extracted from DisplayName for sub-customers
  companyName: string | null;
  phone: string | null;
  email: string | null;
  address: {
    street: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    country: string | null;
  };
  isActive: boolean;
  billWithParent: boolean;
  qboCustomerId: string;
  qboSyncToken: string;
}

/**
 * Parses a QBO Customer response and extracts relevant data
 * Determines if it's a parent Customer or Sub-Customer
 */
export function parseQBOCustomerResponse(qboCustomer: QBOCustomerResponse): ParsedQBOCustomer {
  const isSubCustomer = !!qboCustomer.ParentRef;
  let parentName: string | null = null;
  let locationName: string | null = null;

  // Parse DisplayName to extract parent and location names
  // QBO format: "ParentName: LocationName"
  if (isSubCustomer && qboCustomer.DisplayName.includes(": ")) {
    const parts = qboCustomer.DisplayName.split(": ");
    parentName = parts[0];
    locationName = parts.slice(1).join(": "); // Handle case where location has ":"
  }

  return {
    isSubCustomer,
    parentQboId: qboCustomer.ParentRef?.value || null,
    displayName: qboCustomer.DisplayName,
    parentName,
    locationName,
    companyName: qboCustomer.CompanyName || null,
    phone: qboCustomer.PrimaryPhone?.FreeFormNumber || null,
    email: qboCustomer.PrimaryEmailAddr?.Address || null,
    address: {
      street: qboCustomer.BillAddr?.Line1 || null,
      city: qboCustomer.BillAddr?.City || null,
      province: qboCustomer.BillAddr?.CountrySubDivisionCode || null,
      postalCode: qboCustomer.BillAddr?.PostalCode || null,
      country: qboCustomer.BillAddr?.Country || null,
    },
    isActive: qboCustomer.Active,
    billWithParent: qboCustomer.BillWithParent || false,
    qboCustomerId: qboCustomer.Id,
    qboSyncToken: qboCustomer.SyncToken,
  };
}

/**
 * Validates that a QBO customer is not a third-level hierarchy
 * QBO only supports 2 levels: Customer -> Sub-Customer
 * Returns true if valid, false if it's a sub-customer of a sub-customer
 */
export function validateQBOHierarchyDepth(
  qboCustomer: QBOCustomerResponse,
  allQboCustomers: Map<string, QBOCustomerResponse>
): { valid: boolean; reason?: string } {
  if (!qboCustomer.ParentRef) {
    return { valid: true }; // Top-level customer, always valid
  }

  const parent = allQboCustomers.get(qboCustomer.ParentRef.value);
  if (!parent) {
    return { valid: true }; // Parent not in our list, assume valid
  }

  if (parent.ParentRef) {
    return {
      valid: false,
      reason: `Customer "${qboCustomer.DisplayName}" is a sub-customer of a sub-customer (depth > 2). QBO only supports 2 levels.`,
    };
  }

  return { valid: true };
}

/**
 * Builds a QBO DisplayName ensuring uniqueness
 * If the base name is taken, appends a numeric suffix
 */
export function buildUniqueDisplayName(
  baseName: string,
  existingNames: Set<string>,
  maxAttempts: number = 100
): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  for (let i = 2; i <= maxAttempts; i++) {
    const candidate = `${baseName} (${i})`;
    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }

  // Fallback: append timestamp
  return `${baseName} (${Date.now()})`;
}
