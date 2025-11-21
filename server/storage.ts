import { 
  type User, 
  type InsertUser,
  type Client,
  type InsertClient,
  type Part,
  type InsertPart,
  type ClientPart,
  type InsertClientPart,
  type MaintenanceRecord,
  type InsertMaintenanceRecord,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type Equipment,
  type InsertEquipment,
  type CompanySettings,
  type InsertCompanySettings,
  type CalendarAssignment,
  type InsertCalendarAssignment,
  type UpdateCalendarAssignment,
  type Feedback,
  type InsertFeedback
} from "@shared/schema";
import { randomUUID } from "crypto";
import { STANDARD_BELTS, STANDARD_FILTERS } from "./seed-data";

// Helper function to calculate the next maintenance due date
function calculateNextDueDate(selectedMonths: number[], inactive: boolean): string {
  if (inactive || selectedMonths.length === 0) {
    return '9999-12-31'; // Far future date for inactive clients
  }
  
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const currentDay = today.getDate();
  
  // Sort months to ensure consistent behavior
  const sortedMonths = [...selectedMonths].sort((a, b) => a - b);
  
  // If current month is selected and we haven't passed the 15th, use current month
  if (sortedMonths.includes(currentMonth) && currentDay < 15) {
    return new Date(currentYear, currentMonth, 15).toISOString();
  }
  
  // Otherwise find the next scheduled month
  let nextMonth = sortedMonths.find(m => m > currentMonth);
  
  if (nextMonth === undefined) {
    // Wrap to next year
    nextMonth = sortedMonths[0];
    return new Date(currentYear + 1, nextMonth, 15).toISOString();
  }
  
  return new Date(currentYear, nextMonth, 15).toISOString();
}

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByCompanyId(companyId: string): Promise<User[]>;
  getTechniciansByCompanyId(companyId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  updateUserRole(id: string, role: string): Promise<void>;
  
  // Admin user management methods
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;
  updateUserTrialDate(id: string, trialEndsAt: Date): Promise<void>;
  updateUserStripeCustomer(id: string, stripeCustomerId: string): Promise<void>;
  
  // Password reset token methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(id: string): Promise<PasswordResetToken | undefined>;
  getPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | undefined>;
  markTokenUsed(id: string): Promise<void>;
  invalidateUserTokens(userId: string): Promise<void>;
  
  // Client methods
  getClient(companyId: string, id: string): Promise<Client | undefined>;
  getAllClients(companyId: string): Promise<Client[]>;
  createClient(companyId: string, userId: string, client: InsertClient): Promise<Client>;
  createClientWithParts(companyId: string, userId: string, client: InsertClient, partsList: Array<{ partId: string; quantity: number }>): Promise<Client>;
  updateClient(companyId: string, id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(companyId: string, id: string): Promise<boolean>;
  deleteClients(companyId: string, ids: string[]): Promise<{ deletedIds: string[]; notFoundIds: string[] }>;
  
  // Part methods
  getPart(companyId: string, id: string): Promise<Part | undefined>;
  getAllParts(companyId: string): Promise<Part[]>;
  getPartsByType(companyId: string, type: string): Promise<Part[]>;
  findDuplicatePart(companyId: string, part: InsertPart): Promise<Part | undefined>;
  createPart(companyId: string, userId: string, part: InsertPart): Promise<Part>;
  updatePart(companyId: string, id: string, part: Partial<InsertPart>): Promise<Part | undefined>;
  deletePart(companyId: string, id: string): Promise<boolean>;
  deleteParts(companyId: string, ids: string[]): Promise<{ deletedIds: string[]; notFoundIds: string[] }>;
  seedUserParts(companyId: string, userId: string): Promise<void>;
  
  // Client-Part relationship methods
  getClientParts(companyId: string, clientId: string): Promise<(ClientPart & { part: Part })[]>;
  getAllClientPartsBulk(companyId: string): Promise<Record<string, (ClientPart & { part: Part })[]>>;
  addClientPart(companyId: string, userId: string, clientPart: InsertClientPart): Promise<ClientPart>;
  updateClientPart(companyId: string, id: string, quantity: number): Promise<ClientPart | undefined>;
  deleteClientPart(companyId: string, id: string): Promise<boolean>;
  deleteAllClientParts(companyId: string, clientId: string): Promise<void>;
  
  // Reports
  getPartsReportByMonth(companyId: string, month: number, outstandingOnly?: boolean): Promise<Array<{ part: Part; totalQuantity: number }>>;
  
  // Maintenance record methods
  getMaintenanceRecord(companyId: string, clientId: string, dueDate: string): Promise<MaintenanceRecord | undefined>;
  getLatestCompletedMaintenanceRecord(companyId: string, clientId: string): Promise<MaintenanceRecord | undefined>;
  getAllLatestCompletedMaintenanceRecords(companyId: string): Promise<Record<string, MaintenanceRecord>>;
  getRecentlyCompletedMaintenance(companyId: string, month: number, year: number): Promise<MaintenanceRecord[]>;
  getCompletedUnscheduledMaintenance(companyId: string): Promise<MaintenanceRecord[]>;
  createMaintenanceRecord(companyId: string, userId: string, record: InsertMaintenanceRecord): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(companyId: string, id: string, record: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined>;
  deleteMaintenanceRecord(companyId: string, id: string): Promise<boolean>;
  
  // Equipment methods
  getAllEquipment(companyId: string): Promise<Equipment[]>;
  getClientEquipment(companyId: string, clientId: string): Promise<Equipment[]>;
  getEquipment(companyId: string, id: string): Promise<Equipment | undefined>;
  createEquipment(companyId: string, userId: string, equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(companyId: string, id: string, equipment: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  deleteEquipment(companyId: string, id: string): Promise<boolean>;
  deleteAllClientEquipment(companyId: string, clientId: string): Promise<void>;
  
  // Client report
  getClientReport(companyId: string, clientId: string): Promise<{ client: Client; parts: (ClientPart & { part: Part })[]; equipment: Equipment[] } | null>;
  
  // Company settings methods
  getCompanySettings(companyId: string): Promise<CompanySettings | undefined>;
  upsertCompanySettings(companyId: string, userId: string, settings: InsertCompanySettings): Promise<CompanySettings>;
  
  // Calendar assignment methods
  getCalendarAssignments(companyId: string, year: number, month: number, assignedTechnicianId?: string): Promise<CalendarAssignment[]>;
  getCalendarAssignment(companyId: string, id: string): Promise<CalendarAssignment | undefined>;
  createCalendarAssignment(companyId: string, userId: string, assignment: InsertCalendarAssignment): Promise<CalendarAssignment>;
  updateCalendarAssignment(companyId: string, id: string, assignment: UpdateCalendarAssignment): Promise<CalendarAssignment | undefined>;
  deleteCalendarAssignment(companyId: string, id: string): Promise<boolean>;
  getClientCalendarAssignment(companyId: string, clientId: string, year: number, month: number): Promise<CalendarAssignment | undefined>;
  getUnscheduledClients(companyId: string, year: number, month: number): Promise<Client[]>;
  
  // Feedback methods
  createFeedback(companyId: string, userId: string, userEmail: string, feedback: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;
  getCompanyFeedback(companyId: string): Promise<Feedback[]>;
  updateFeedbackStatus(id: string, status: string): Promise<Feedback | undefined>;
  archiveFeedback(id: string, archived: boolean): Promise<Feedback | undefined>;
  deleteFeedback(id: string): Promise<boolean>;

  // Invitation token methods
  createInvitationToken(token: any): Promise<any>;
  getInvitationByToken(token: string): Promise<any | undefined>;
  markInvitationUsed(id: string, usedByUserId: string): Promise<void>;
  
  // Company methods
  getCompanyById(id: string): Promise<any | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private clients: Map<string, Client>;
  private parts: Map<string, Part>;
  private clientParts: Map<string, ClientPart>;
  private maintenanceRecords: Map<string, MaintenanceRecord>;
  private passwordResetTokens: Map<string, PasswordResetToken>;
  private companySettings: Map<string, CompanySettings>;
  private equipment: Map<string, Equipment>;
  private calendarAssignments: Map<string, CalendarAssignment>;
  private feedback: Map<string, Feedback>;
  private invitationTokens: Map<string, any>;
  private companies: Map<string, any>;

  constructor() {
    this.users = new Map();
    this.feedback = new Map();
    this.clients = new Map();
    this.parts = new Map();
    this.clientParts = new Map();
    this.maintenanceRecords = new Map();
    this.passwordResetTokens = new Map();
    this.companySettings = new Map();
    this.equipment = new Map();
    this.calendarAssignments = new Map();
    this.invitationTokens = new Map();
    this.companies = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async getUsersByCompanyId(companyId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.companyId === companyId,
    );
  }

  async getTechniciansByCompanyId(companyId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.companyId === companyId && user.role === "technician",
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      isAdmin: false,
      trialEndsAt: null,
      subscriptionStatus: "trial",
      subscriptionPlan: null,
      billingInterval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      this.users.set(id, { ...user, password: hashedPassword });
    }
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      this.users.set(id, { ...user, role });
    }
  }

  // Admin user management methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async updateUserTrialDate(id: string, trialEndsAt: Date): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      this.users.set(id, { ...user, trialEndsAt });
    }
  }

  async updateUserStripeCustomer(id: string, stripeCustomerId: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      this.users.set(id, { ...user, stripeCustomerId });
    }
  }

  // Password reset token methods
  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const id = randomUUID();
    const token: PasswordResetToken = {
      ...insertToken,
      id,
      createdAt: new Date(),
      usedAt: null,
      requestedIp: insertToken.requestedIp ?? null,
    };
    this.passwordResetTokens.set(id, token);
    return token;
  }

  async getPasswordResetToken(id: string): Promise<PasswordResetToken | undefined> {
    return this.passwordResetTokens.get(id);
  }

  async getPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | undefined> {
    return Array.from(this.passwordResetTokens.values()).find(
      (token) => token.tokenHash === tokenHash
    );
  }

  async markTokenUsed(id: string): Promise<void> {
    const token = this.passwordResetTokens.get(id);
    if (token) {
      this.passwordResetTokens.set(id, { ...token, usedAt: new Date() });
    }
  }

  async invalidateUserTokens(userId: string): Promise<void> {
    const entries = Array.from(this.passwordResetTokens.entries());
    for (const [id, token] of entries) {
      if (token.userId === userId && !token.usedAt) {
        this.passwordResetTokens.set(id, { ...token, usedAt: new Date() });
      }
    }
  }

  // Client methods
  async getClient(companyId: string, id: string): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client || client.companyId !== companyId) return undefined;
    return client;
  }

  async getAllClients(companyId: string): Promise<Client[]> {
    return Array.from(this.clients.values())
      .filter(client => client.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createClient(companyId: string, userId: string, insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const inactive = insertClient.inactive ?? false;
    const selectedMonths = insertClient.selectedMonths ?? [];
    
    const client: Client = { 
      ...insertClient,
      location: insertClient.location ?? null,
      address: insertClient.address ?? null,
      city: insertClient.city ?? null,
      province: insertClient.province ?? null,
      postalCode: insertClient.postalCode ?? null,
      contactName: insertClient.contactName ?? null,
      email: insertClient.email ?? null,
      phone: insertClient.phone ?? null,
      roofLadderCode: insertClient.roofLadderCode ?? null,
      notes: insertClient.notes ?? null,
      companyId,
      userId,
      inactive,
      selectedMonths,
      nextDue: calculateNextDueDate(selectedMonths, inactive),
      id,
      createdAt: new Date().toISOString()
    };
    this.clients.set(id, client);
    return client;
  }

  async createClientWithParts(companyId: string, userId: string, insertClient: InsertClient, partsList: Array<{ partId: string; quantity: number }>): Promise<Client> {
    // Validate all parts exist and belong to company before creating client
    for (const partItem of partsList) {
      const existingPart = await this.getPart(companyId, partItem.partId);
      if (!existingPart) {
        throw new Error(`Part with ID ${partItem.partId} not found or does not belong to company`);
      }
    }
    
    // Create the client
    const client = await this.createClient(companyId, userId, insertClient);
    const createdClientPartIds: string[] = [];
    
    try {
      // Add all parts to the client
      for (const partItem of partsList) {
        const clientPart = await this.addClientPart(companyId, userId, {
          clientId: client.id,
          partId: partItem.partId,
          quantity: partItem.quantity
        });
        createdClientPartIds.push(clientPart.id);
      }
      
      return client;
    } catch (error) {
      // Rollback: delete all created client-parts and the client
      for (const clientPartId of createdClientPartIds) {
        this.clientParts.delete(clientPartId);
      }
      this.clients.delete(client.id);
      throw error;
    }
  }

  async updateClient(companyId: string, id: string, clientUpdate: Partial<InsertClient>): Promise<Client | undefined> {
    const existing = this.clients.get(id);
    if (!existing || existing.companyId !== companyId) return undefined;
    
    const updated: Client = { 
      ...existing, 
      ...clientUpdate,
      location: clientUpdate.location !== undefined ? (clientUpdate.location ?? null) : existing.location,
      address: clientUpdate.address !== undefined ? (clientUpdate.address ?? null) : existing.address,
      city: clientUpdate.city !== undefined ? (clientUpdate.city ?? null) : existing.city,
      province: clientUpdate.province !== undefined ? (clientUpdate.province ?? null) : existing.province,
      postalCode: clientUpdate.postalCode !== undefined ? (clientUpdate.postalCode ?? null) : existing.postalCode,
      contactName: clientUpdate.contactName !== undefined ? (clientUpdate.contactName ?? null) : existing.contactName,
      email: clientUpdate.email !== undefined ? (clientUpdate.email ?? null) : existing.email,
      phone: clientUpdate.phone !== undefined ? (clientUpdate.phone ?? null) : existing.phone,
      roofLadderCode: clientUpdate.roofLadderCode !== undefined ? (clientUpdate.roofLadderCode ?? null) : existing.roofLadderCode,
      notes: clientUpdate.notes !== undefined ? (clientUpdate.notes ?? null) : existing.notes,
    };
    
    // Recalculate nextDue if selectedMonths or inactive status changed
    if (clientUpdate.selectedMonths !== undefined || clientUpdate.inactive !== undefined) {
      const selectedMonths = clientUpdate.selectedMonths ?? existing.selectedMonths;
      const inactive = clientUpdate.inactive ?? existing.inactive;
      console.log(`[Update Client] Recalculating nextDue for ${existing.companyName}:`, {
        selectedMonths,
        inactive,
        oldNextDue: existing.nextDue
      });
      updated.nextDue = calculateNextDueDate(selectedMonths, inactive);
      console.log(`[Update Client] New nextDue: ${updated.nextDue}`);
    }
    
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(companyId: string, id: string): Promise<boolean> {
    const existing = this.clients.get(id);
    if (!existing || existing.companyId !== companyId) return false;
    return this.clients.delete(id);
  }

  async deleteClients(companyId: string, ids: string[]): Promise<{ deletedIds: string[]; notFoundIds: string[] }> {
    const deletedIds: string[] = [];
    const notFoundIds: string[] = [];

    for (const id of ids) {
      const existing = this.clients.get(id);
      if (!existing || existing.companyId !== companyId) {
        notFoundIds.push(id);
        continue;
      }

      // Delete associated client parts
      await this.deleteAllClientParts(companyId, id);
      
      // Delete associated maintenance records
      const maintenanceToDelete = Array.from(this.maintenanceRecords.entries())
        .filter(([_, record]) => record.clientId === id && record.companyId === companyId)
        .map(([recordId]) => recordId);
      maintenanceToDelete.forEach(recordId => this.maintenanceRecords.delete(recordId));
      
      // Delete associated equipment
      const equipmentToDelete = Array.from(this.equipment.entries())
        .filter(([_, eq]) => eq.clientId === id && eq.companyId === companyId)
        .map(([eqId]) => eqId);
      equipmentToDelete.forEach(eqId => this.equipment.delete(eqId));

      // Delete the client
      if (this.clients.delete(id)) {
        deletedIds.push(id);
      }
    }

    return { deletedIds, notFoundIds };
  }

  // Part methods
  async getPart(companyId: string, id: string): Promise<Part | undefined> {
    const part = this.parts.get(id);
    if (!part || part.companyId !== companyId) return undefined;
    return part;
  }

  async getAllParts(companyId: string): Promise<Part[]> {
    return Array.from(this.parts.values())
      .filter(part => part.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPartsByType(companyId: string, type: string): Promise<Part[]> {
    return Array.from(this.parts.values())
      .filter(part => part.companyId === companyId && part.type === type);
  }

  async findDuplicatePart(companyId: string, insertPart: InsertPart): Promise<Part | undefined> {
    return Array.from(this.parts.values()).find(part => {
      if (part.companyId !== companyId) return false;
      if (part.type !== insertPart.type) return false;
      
      if (insertPart.type === 'filter') {
        return part.filterType === insertPart.filterType && part.size === insertPart.size;
      } else if (insertPart.type === 'belt') {
        return part.beltType === insertPart.beltType && part.size === insertPart.size;
      } else if (insertPart.type === 'other') {
        return part.name === insertPart.name;
      }
      
      return false;
    });
  }

  async createPart(companyId: string, userId: string, insertPart: InsertPart): Promise<Part> {
    const id = randomUUID();
    const part: Part = { 
      id,
      companyId,
      userId,
      type: insertPart.type,
      filterType: insertPart.filterType ?? null,
      beltType: insertPart.beltType ?? null,
      size: insertPart.size ?? null,
      name: insertPart.name ?? null,
      description: insertPart.description ?? null,
      createdAt: new Date().toISOString()
    };
    this.parts.set(id, part);
    return part;
  }

  async updatePart(companyId: string, id: string, partUpdate: Partial<InsertPart>): Promise<Part | undefined> {
    const existing = this.parts.get(id);
    if (!existing || existing.companyId !== companyId) return undefined;
    
    const updated: Part = { ...existing, ...partUpdate };
    this.parts.set(id, updated);
    return updated;
  }

  async deletePart(companyId: string, id: string): Promise<boolean> {
    const existing = this.parts.get(id);
    if (!existing || existing.companyId !== companyId) return false;
    
    // Delete all client-part associations for this part
    const toDelete = Array.from(this.clientParts.entries())
      .filter(([_, cp]) => cp.partId === id && cp.companyId === companyId)
      .map(([cpId]) => cpId);
    
    toDelete.forEach(cpId => this.clientParts.delete(cpId));
    
    // Delete the part itself
    return this.parts.delete(id);
  }

  async deleteParts(companyId: string, ids: string[]): Promise<{ deletedIds: string[]; notFoundIds: string[] }> {
    const deletedIds: string[] = [];
    const notFoundIds: string[] = [];

    for (const id of ids) {
      const existing = this.parts.get(id);
      if (!existing || existing.companyId !== companyId) {
        notFoundIds.push(id);
        continue;
      }

      // Delete all client-part associations for this part
      const toDelete = Array.from(this.clientParts.entries())
        .filter(([_, cp]) => cp.partId === id && cp.companyId === companyId)
        .map(([cpId]) => cpId);
      
      toDelete.forEach(cpId => this.clientParts.delete(cpId));

      // Delete the part itself
      if (this.parts.delete(id)) {
        deletedIds.push(id);
      }
    }

    return { deletedIds, notFoundIds };
  }

  async seedUserParts(companyId: string, userId: string): Promise<void> {
    const allSeedParts = [...STANDARD_FILTERS, ...STANDARD_BELTS];
    
    for (const partData of allSeedParts) {
      const existingPart = await this.findDuplicatePart(companyId, partData);
      
      if (!existingPart) {
        await this.createPart(companyId, userId, partData);
      }
    }
  }

  // Client-Part relationship methods
  async getClientParts(userId: string, clientId: string): Promise<(ClientPart & { part: Part })[]> {
    const clientPartsList = Array.from(this.clientParts.values())
      .filter(cp => cp.userId === userId && cp.clientId === clientId);
    
    // Filter out any client-parts where the part no longer exists
    return clientPartsList
      .map(cp => {
        const part = this.parts.get(cp.partId);
        if (!part) return null;
        return { ...cp, part };
      })
      .filter((cp): cp is (ClientPart & { part: Part }) => cp !== null);
  }

  async getAllClientPartsBulk(userId: string): Promise<Record<string, (ClientPart & { part: Part })[]>> {
    const bulkMap: Record<string, (ClientPart & { part: Part })[]> = {};
    
    const allClientParts = Array.from(this.clientParts.values())
      .filter(cp => cp.userId === userId);
    
    for (const cp of allClientParts) {
      const part = this.parts.get(cp.partId);
      if (!part) continue;
      
      if (!bulkMap[cp.clientId]) {
        bulkMap[cp.clientId] = [];
      }
      
      bulkMap[cp.clientId].push({ ...cp, part });
    }
    
    return bulkMap;
  }

  async addClientPart(companyId: string, userId: string, insertClientPart: InsertClientPart): Promise<ClientPart> {
    // Verify that the client belongs to the company
    const client = this.clients.get(insertClientPart.clientId);
    if (!client || client.companyId !== companyId) {
      throw new Error("Client not found or does not belong to company");
    }
    
    // Verify that the part belongs to the company
    const part = this.parts.get(insertClientPart.partId);
    if (!part || part.companyId !== companyId) {
      throw new Error("Part not found or does not belong to company");
    }
    
    const id = randomUUID();
    const clientPart: ClientPart = { ...insertClientPart, companyId, userId, id };
    this.clientParts.set(id, clientPart);
    return clientPart;
  }

  async updateClientPart(companyId: string, id: string, quantity: number): Promise<ClientPart | undefined> {
    const existing = this.clientParts.get(id);
    if (!existing || existing.companyId !== companyId) return undefined;
    
    const updated: ClientPart = { ...existing, quantity };
    this.clientParts.set(id, updated);
    return updated;
  }

  async deleteClientPart(companyId: string, id: string): Promise<boolean> {
    const existing = this.clientParts.get(id);
    if (!existing || existing.companyId !== companyId) return false;
    return this.clientParts.delete(id);
  }

  async deleteAllClientParts(companyId: string, clientId: string): Promise<void> {
    const toDelete = Array.from(this.clientParts.entries())
      .filter(([_, cp]) => cp.companyId === companyId && cp.clientId === clientId)
      .map(([id]) => id);
    
    toDelete.forEach(id => this.clientParts.delete(id));
  }

  async getPartsReportByMonth(userId: string, month: number, outstandingOnly = false): Promise<Array<{ part: Part; totalQuantity: number }>> {
    const clientsWithMaintenance = Array.from(this.clients.values())
      .filter(client => client.userId === userId && client.selectedMonths.includes(month) && !client.inactive);
    
    let clientIds = clientsWithMaintenance.map(c => c.id);
    
    // Filter out clients with completed maintenance if outstandingOnly is true
    if (outstandingOnly) {
      const completedClientIds = new Set<string>();
      const currentYear = new Date().getFullYear();
      
      // Get all maintenance records for this month
      const allRecords = Array.from(this.maintenanceRecords.values());
      for (const record of allRecords) {
        if (record.userId === userId && record.completedAt) {
          const dueDate = new Date(record.dueDate);
          if (dueDate.getMonth() === month && dueDate.getFullYear() === currentYear) {
            completedClientIds.add(record.clientId);
          }
        }
      }
      
      clientIds = clientIds.filter(id => !completedClientIds.has(id));
    }
    
    const partsMap = new Map<string, { part: Part; totalQuantity: number }>();
    
    for (const clientId of clientIds) {
      const clientParts = await this.getClientParts(companyId, clientId);
      
      for (const cp of clientParts) {
        // Generate unique key based on part type
        let key: string;
        if (cp.part.type === 'filter') {
          key = `filter-${cp.part.filterType}-${cp.part.size}`;
        } else if (cp.part.type === 'belt') {
          key = `belt-${cp.part.beltType}-${cp.part.size}`;
        } else {
          key = `other-${cp.part.name}`;
        }
        
        if (partsMap.has(key)) {
          const existing = partsMap.get(key)!;
          existing.totalQuantity += cp.quantity;
        } else {
          partsMap.set(key, {
            part: cp.part,
            totalQuantity: cp.quantity
          });
        }
      }
    }
    
    return Array.from(partsMap.values()).sort((a, b) => {
      // Sort by type first
      if (a.part.type !== b.part.type) {
        return a.part.type.localeCompare(b.part.type);
      }
      
      // Then sort within type
      if (a.part.type === 'filter') {
        return (a.part.filterType || '').localeCompare(b.part.filterType || '');
      } else if (a.part.type === 'belt') {
        return (a.part.beltType || '').localeCompare(b.part.beltType || '');
      } else {
        return (a.part.name || '').localeCompare(b.part.name || '');
      }
    });
  }

  // Maintenance record methods
  async getMaintenanceRecord(userId: string, clientId: string, dueDate: string): Promise<MaintenanceRecord | undefined> {
    return Array.from(this.maintenanceRecords.values()).find(
      record => record.userId === userId && record.clientId === clientId && record.dueDate === dueDate
    );
  }

  async getLatestCompletedMaintenanceRecord(userId: string, clientId: string): Promise<MaintenanceRecord | undefined> {
    const records = Array.from(this.maintenanceRecords.values())
      .filter(record => record.userId === userId && record.clientId === clientId && record.completedAt);
    
    if (records.length === 0) return undefined;
    
    // Sort by completedAt descending and return the most recent
    return records.sort((a, b) => {
      const dateA = new Date(a.completedAt!).getTime();
      const dateB = new Date(b.completedAt!).getTime();
      return dateB - dateA;
    })[0];
  }

  async getAllLatestCompletedMaintenanceRecords(userId: string): Promise<Record<string, MaintenanceRecord>> {
    const allRecords = Array.from(this.maintenanceRecords.values())
      .filter(record => record.userId === userId && record.completedAt);
    
    const latestByClient: Record<string, MaintenanceRecord> = {};
    
    for (const record of allRecords) {
      const existing = latestByClient[record.clientId];
      if (!existing || new Date(record.completedAt!) > new Date(existing.completedAt!)) {
        latestByClient[record.clientId] = record;
      }
    }
    
    return latestByClient;
  }

  async getRecentlyCompletedMaintenance(userId: string, month: number, year: number): Promise<MaintenanceRecord[]> {
    return Array.from(this.maintenanceRecords.values())
      .filter(record => {
        if (record.userId !== userId) return false;
        if (!record.completedAt) return false;
        const completedDate = new Date(record.completedAt);
        return completedDate.getMonth() === month && completedDate.getFullYear() === year;
      })
      .sort((a, b) => {
        const dateA = new Date(a.completedAt!).getTime();
        const dateB = new Date(b.completedAt!).getTime();
        return dateB - dateA; // Most recent first
      });
  }

  async getCompletedUnscheduledMaintenance(userId: string): Promise<MaintenanceRecord[]> {
    const completedRecords = Array.from(this.maintenanceRecords.values())
      .filter(record => record.userId === userId && record.completedAt);
    
    const result = [];
    for (const record of completedRecords) {
      const dueDate = new Date(record.dueDate);
      const year = dueDate.getFullYear();
      const month = dueDate.getMonth() + 1;
      
      // Check if there was a calendar assignment for this client in this month
      const assignment = await this.getClientCalendarAssignment(userId, record.clientId, year, month);
      if (!assignment) {
        result.push(record);
      }
    }
    
    return result.sort((a, b) => {
      const dateA = new Date(a.completedAt!).getTime();
      const dateB = new Date(b.completedAt!).getTime();
      return dateB - dateA;
    });
  }

  async createMaintenanceRecord(userId: string, insertRecord: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    // Verify that the client belongs to the userId
    const client = this.clients.get(insertRecord.clientId);
    if (!client || client.userId !== userId) {
      throw new Error("Client not found or does not belong to user");
    }
    
    const id = randomUUID();
    const record: MaintenanceRecord = { 
      ...insertRecord,
      userId,
      id,
      completedAt: insertRecord.completedAt ?? null 
    };
    this.maintenanceRecords.set(id, record);
    return record;
  }

  async updateMaintenanceRecord(userId: string, id: string, recordUpdate: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined> {
    const existing = this.maintenanceRecords.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    
    const updated: MaintenanceRecord = { ...existing, ...recordUpdate };
    this.maintenanceRecords.set(id, updated);
    return updated;
  }

  async deleteMaintenanceRecord(userId: string, id: string): Promise<boolean> {
    const existing = this.maintenanceRecords.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.maintenanceRecords.delete(id);
  }

  // Equipment methods
  async getAllEquipment(userId: string): Promise<Equipment[]> {
    return [];
  }

  async getClientEquipment(userId: string, clientId: string): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter(
      (eq) => eq.userId === userId && eq.clientId === clientId
    );
  }

  async getEquipment(userId: string, id: string): Promise<Equipment | undefined> {
    return undefined;
  }

  async createEquipment(userId: string, equipment: InsertEquipment): Promise<Equipment> {
    const id = randomUUID();
    const newEquipment: Equipment = { 
      ...equipment,
      userId,
      id,
      createdAt: new Date().toISOString(),
      type: equipment.type ?? null,
      location: equipment.location ?? null,
      modelNumber: equipment.modelNumber ?? null,
      serialNumber: equipment.serialNumber ?? null,
      notes: equipment.notes ?? null
    };
    return newEquipment;
  }

  async updateEquipment(userId: string, id: string, equipment: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    return undefined;
  }

  async deleteEquipment(userId: string, id: string): Promise<boolean> {
    return false;
  }

  async deleteAllClientEquipment(userId: string, clientId: string): Promise<void> {
    return;
  }

  async getClientReport(userId: string, clientId: string): Promise<{ client: Client; parts: (ClientPart & { part: Part })[]; equipment: Equipment[] } | null> {
    const client = await this.getClient(userId, clientId);
    if (!client) {
      return null;
    }

    const parts = await this.getClientParts(userId, clientId);
    const equip = await this.getClientEquipment(userId, clientId);

    return {
      client,
      parts,
      equipment: equip
    };
  }

  // Company settings methods
  async getCompanySettings(userId: string): Promise<CompanySettings | undefined> {
    return Array.from(this.companySettings.values()).find(
      (settings) => settings.userId === userId
    );
  }

  async upsertCompanySettings(userId: string, settings: InsertCompanySettings): Promise<CompanySettings> {
    const existing = await this.getCompanySettings(userId);
    
    if (existing) {
      const updated: CompanySettings = {
        ...existing,
        ...settings,
        address: settings.address ?? null,
        email: settings.email ?? null,
        companyName: settings.companyName ?? null,
        city: settings.city ?? null,
        provinceState: settings.provinceState ?? null,
        postalCode: settings.postalCode ?? null,
        phone: settings.phone ?? null,
        updatedAt: new Date().toISOString()
      };
      this.companySettings.set(existing.id, updated);
      return updated;
    }
    
    const id = randomUUID();
    const newSettings: CompanySettings = {
      ...settings,
      address: settings.address ?? null,
      email: settings.email ?? null,
      companyName: settings.companyName ?? null,
      city: settings.city ?? null,
      provinceState: settings.provinceState ?? null,
      postalCode: settings.postalCode ?? null,
      phone: settings.phone ?? null,
      id,
      userId,
      updatedAt: new Date().toISOString()
    };
    this.companySettings.set(id, newSettings);
    return newSettings;
  }

  // Calendar assignment methods
  async getCalendarAssignments(userId: string, year: number, month: number): Promise<CalendarAssignment[]> {
    return Array.from(this.calendarAssignments.values()).filter(
      (assignment) => assignment.userId === userId && assignment.year === year && assignment.month === month
    );
  }

  async getCalendarAssignment(userId: string, id: string): Promise<CalendarAssignment | undefined> {
    const assignment = this.calendarAssignments.get(id);
    if (assignment && assignment.userId === userId) {
      return assignment;
    }
    return undefined;
  }

  async createCalendarAssignment(userId: string, insertAssignment: InsertCalendarAssignment): Promise<CalendarAssignment> {
    const id = randomUUID();
    const assignment: CalendarAssignment = {
      ...insertAssignment,
      id,
      userId,
      day: insertAssignment.day ?? null,
      autoDueDate: insertAssignment.autoDueDate ?? false,
      completed: insertAssignment.completed ?? false
    };
    this.calendarAssignments.set(id, assignment);
    return assignment;
  }

  async updateCalendarAssignment(userId: string, id: string, assignmentUpdate: UpdateCalendarAssignment): Promise<CalendarAssignment | undefined> {
    const existing = await this.getCalendarAssignment(userId, id);
    if (!existing) {
      return undefined;
    }

    const updated: CalendarAssignment = {
      ...existing,
      day: assignmentUpdate.day !== undefined ? assignmentUpdate.day : existing.day,
      scheduledDate: assignmentUpdate.scheduledDate !== undefined ? assignmentUpdate.scheduledDate : existing.scheduledDate,
      autoDueDate: assignmentUpdate.autoDueDate !== undefined ? assignmentUpdate.autoDueDate : existing.autoDueDate
    };
    this.calendarAssignments.set(id, updated);
    return updated;
  }

  async deleteCalendarAssignment(userId: string, id: string): Promise<boolean> {
    const assignment = await this.getCalendarAssignment(userId, id);
    if (!assignment) {
      return false;
    }
    return this.calendarAssignments.delete(id);
  }

  async getClientCalendarAssignment(userId: string, clientId: string, year: number, month: number): Promise<CalendarAssignment | undefined> {
    return Array.from(this.calendarAssignments.values()).find(
      (assignment) => assignment.userId === userId && 
                      assignment.clientId === clientId && 
                      assignment.year === year && 
                      assignment.month === month
    );
  }

  async getUnscheduledClients(userId: string, year: number, month: number): Promise<Client[]> {
    const allClients = await this.getAllClients(userId);
    const assignments = await this.getCalendarAssignments(userId, year, month);
    const scheduledClientIds = new Set(assignments.map(a => a.clientId));
    
    const monthIndex = month - 1; // Convert to 0-indexed
    
    return allClients.filter(client => {
      // Exclude inactive clients
      if (client.inactive) return false;
      
      // Exclude clients not scheduled for this month
      if (!client.selectedMonths?.includes(monthIndex)) return false;
      
      // Exclude clients already scheduled
      if (scheduledClientIds.has(client.id)) return false;
      
      // Check if maintenance is completed
      const latestRecord = Array.from(this.maintenanceRecords.values())
        .filter(r => r.userId === userId && r.clientId === client.id && r.completedAt)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];
      
      if (latestRecord) {
        const completedDate = new Date(latestRecord.completedAt!);
        const completedDueDate = latestRecord.dueDate ? new Date(latestRecord.dueDate) : null;
        
        // Check if completed for this month's schedule
        if (completedDueDate) {
          const dueMonth = completedDueDate.getMonth();
          const dueYear = completedDueDate.getFullYear();
          if (dueMonth === monthIndex && dueYear === year) {
            return false; // Already completed for this month
          }
        }
      }
      
      return true;
    });
  }

  async createFeedback(userId: string, userEmail: string, feedback: InsertFeedback): Promise<Feedback> {
    const newFeedback: Feedback = {
      id: randomUUID(),
      userId,
      userEmail,
      category: feedback.category,
      message: feedback.message,
      createdAt: new Date(),
      status: "new",
      archived: false
    };
    this.feedback.set(newFeedback.id, newFeedback);
    return newFeedback;
  }

  async getAllFeedback(): Promise<Feedback[]> {
    return Array.from(this.feedback.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getUserFeedback(userId: string): Promise<Feedback[]> {
    return Array.from(this.feedback.values())
      .filter(f => f.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateFeedbackStatus(id: string, status: string): Promise<Feedback | undefined> {
    const feedbackItem = this.feedback.get(id);
    if (!feedbackItem) return undefined;
    
    const updated = { ...feedbackItem, status };
    this.feedback.set(id, updated);
    return updated;
  }

  async archiveFeedback(id: string, archived: boolean): Promise<Feedback | undefined> {
    const feedbackItem = this.feedback.get(id);
    if (!feedbackItem) return undefined;
    
    const updated = { ...feedbackItem, archived };
    this.feedback.set(id, updated);
    return updated;
  }

  async deleteFeedback(id: string): Promise<boolean> {
    return this.feedback.delete(id);
  }

  async createInvitationToken(tokenData: any): Promise<any> {
    const id = randomUUID();
    const token = { ...tokenData, id };
    this.invitationTokens.set(id, token);
    return token;
  }

  async getInvitationByToken(token: string): Promise<any | undefined> {
    return Array.from(this.invitationTokens.values()).find(
      (invite) => invite.token === token && !invite.usedAt
    );
  }

  async markInvitationUsed(id: string, usedByUserId: string): Promise<void> {
    const invitation = this.invitationTokens.get(id);
    if (invitation) {
      const updated = { ...invitation, usedAt: new Date(), usedByUserId };
      this.invitationTokens.set(id, updated);
    }
  }

  async getCompanyById(id: string): Promise<any | undefined> {
    return this.companies.get(id);
  }
}

import { db } from './db';
import { users, clients, parts, clientParts, maintenanceRecords, passwordResetTokens, equipment, companySettings, calendarAssignments, feedback, invitationTokens, companies } from '@shared/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';

export class DbStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  }

  // Admin user management methods
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async deleteUser(id: string): Promise<boolean> {
    // Foreign key constraints with ON DELETE CASCADE will automatically delete
    // all user data (clients, parts, client_parts, maintenance_records)
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, id));
  }

  async updateUserTrialDate(id: string, trialEndsAt: Date): Promise<void> {
    await db.update(users).set({ trialEndsAt }).where(eq(users.id, id));
  }

  async updateUserStripeCustomer(id: string, stripeCustomerId: string): Promise<void> {
    await db.update(users).set({ stripeCustomerId }).where(eq(users.id, id));
  }

  async getTechniciansByCompanyId(companyId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.companyId, companyId));
  }

  async createInvitationToken(tokenData: any): Promise<any> {
    const result = await db.insert(invitationTokens).values(tokenData).returning();
    return result[0];
  }

  // Password reset token methods
  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const result = await db.insert(passwordResetTokens).values(insertToken).returning();
    return result[0];
  }

  async getPasswordResetToken(id: string): Promise<PasswordResetToken | undefined> {
    const result = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.id, id)).limit(1);
    return result[0];
  }

  async getPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const result = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);
    return result[0];
  }

  async markTokenUsed(id: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id));
  }

  async invalidateUserTokens(userId: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(
        eq(passwordResetTokens.userId, userId),
        sql`${passwordResetTokens.usedAt} IS NULL`
      ));
  }

  // Client methods
  async getClient(userId: string, id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.userId, userId))).limit(1);
    return result[0];
  }

  async getAllClients(userId: string): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.userId, userId)).orderBy(desc(clients.createdAt));
  }

  async createClient(userId: string, insertClient: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values({ ...insertClient, userId }).returning();
    return result[0];
  }

  async createClientWithParts(userId: string, insertClient: InsertClient, partsList: Array<{ partId: string; quantity: number }>): Promise<Client> {
    return await db.transaction(async (tx) => {
      // Validate all parts exist and belong to user
      for (const partItem of partsList) {
        const existingPart = await tx.select().from(parts).where(
          and(eq(parts.id, partItem.partId), eq(parts.userId, userId))
        ).limit(1);
        
        if (!existingPart || existingPart.length === 0) {
          throw new Error(`Part with ID ${partItem.partId} not found or does not belong to user`);
        }
      }
      
      // Create the client
      const clientResult = await tx.insert(clients).values({ ...insertClient, userId }).returning();
      const client = clientResult[0];
      
      // Bulk insert all client-part associations
      if (partsList.length > 0) {
        await tx.insert(clientParts).values(
          partsList.map(partItem => ({
            clientId: client.id,
            partId: partItem.partId,
            quantity: partItem.quantity,
            userId
          }))
        );
      }
      
      return client;
    });
  }

  async updateClient(userId: string, id: string, clientUpdate: Partial<InsertClient>): Promise<Client | undefined> {
    const result = await db.update(clients).set(clientUpdate).where(and(eq(clients.id, id), eq(clients.userId, userId))).returning();
    return result[0];
  }

  async deleteClient(userId: string, id: string): Promise<boolean> {
    // Foreign key constraints with ON DELETE CASCADE will automatically delete
    // client_parts and maintenance_records, but we keep manual deletes as defensive fallback
    await this.deleteAllClientParts(userId, id);
    await db.delete(maintenanceRecords).where(and(eq(maintenanceRecords.clientId, id), eq(maintenanceRecords.userId, userId)));
    const result = await db.delete(clients).where(and(eq(clients.id, id), eq(clients.userId, userId))).returning();
    return result.length > 0;
  }

  async deleteClients(userId: string, ids: string[]): Promise<{ deletedIds: string[]; notFoundIds: string[] }> {
    const deletedIds: string[] = [];
    const notFoundIds: string[] = [];

    // Verify all IDs belong to the user first
    const clientChecks = await Promise.all(
      ids.map(id => this.getClient(userId, id))
    );
    
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const existing = clientChecks[i];
      
      if (!existing) {
        notFoundIds.push(id);
        continue;
      }

      // Delete associated data (foreign key cascades should handle this, but being defensive)
      await this.deleteAllClientParts(userId, id);
      await db.delete(maintenanceRecords).where(and(eq(maintenanceRecords.clientId, id), eq(maintenanceRecords.userId, userId)));
      await db.delete(equipment).where(and(eq(equipment.clientId, id), eq(equipment.userId, userId)));

      // Delete the client
      const result = await db.delete(clients).where(and(eq(clients.id, id), eq(clients.userId, userId))).returning();
      if (result.length > 0) {
        deletedIds.push(id);
      }
    }

    return { deletedIds, notFoundIds };
  }

  // Part methods
  async getPart(userId: string, id: string): Promise<Part | undefined> {
    const result = await db.select().from(parts).where(and(eq(parts.id, id), eq(parts.userId, userId))).limit(1);
    return result[0];
  }

  async getAllParts(userId: string): Promise<Part[]> {
    return db.select().from(parts).where(eq(parts.userId, userId)).orderBy(desc(parts.createdAt));
  }

  async getPartsByType(userId: string, type: string): Promise<Part[]> {
    return db.select().from(parts).where(and(eq(parts.userId, userId), eq(parts.type, type)));
  }

  async findDuplicatePart(userId: string, insertPart: InsertPart): Promise<Part | undefined> {
    if (insertPart.type === 'filter') {
      const result = await db.select().from(parts)
        .where(and(
          eq(parts.userId, userId),
          eq(parts.type, 'filter'),
          eq(parts.filterType, insertPart.filterType ?? ''),
          eq(parts.size, insertPart.size ?? '')
        ))
        .limit(1);
      return result[0];
    } else if (insertPart.type === 'belt') {
      const result = await db.select().from(parts)
        .where(and(
          eq(parts.userId, userId),
          eq(parts.type, 'belt'),
          eq(parts.beltType, insertPart.beltType ?? ''),
          eq(parts.size, insertPart.size ?? '')
        ))
        .limit(1);
      return result[0];
    } else if (insertPart.type === 'other') {
      const result = await db.select().from(parts)
        .where(and(
          eq(parts.userId, userId),
          eq(parts.type, 'other'),
          eq(parts.name, insertPart.name ?? '')
        ))
        .limit(1);
      return result[0];
    }
    return undefined;
  }

  async createPart(userId: string, insertPart: InsertPart): Promise<Part> {
    const result = await db.insert(parts).values({ ...insertPart, userId }).returning();
    return result[0];
  }

  async updatePart(userId: string, id: string, partUpdate: Partial<InsertPart>): Promise<Part | undefined> {
    const result = await db.update(parts).set(partUpdate).where(and(eq(parts.id, id), eq(parts.userId, userId))).returning();
    return result[0];
  }

  async deletePart(userId: string, id: string): Promise<boolean> {
    await db.delete(clientParts).where(and(eq(clientParts.partId, id), eq(clientParts.userId, userId)));
    const result = await db.delete(parts).where(and(eq(parts.id, id), eq(parts.userId, userId))).returning();
    return result.length > 0;
  }

  async deleteParts(userId: string, ids: string[]): Promise<{ deletedIds: string[]; notFoundIds: string[] }> {
    const deletedIds: string[] = [];
    const notFoundIds: string[] = [];

    // Verify all IDs belong to the user first
    const partChecks = await Promise.all(
      ids.map(id => this.getPart(userId, id))
    );
    
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const existing = partChecks[i];
      
      if (!existing) {
        notFoundIds.push(id);
        continue;
      }

      // Delete all client-part associations
      await db.delete(clientParts).where(and(eq(clientParts.partId, id), eq(clientParts.userId, userId)));

      // Delete the part
      const result = await db.delete(parts).where(and(eq(parts.id, id), eq(parts.userId, userId))).returning();
      if (result.length > 0) {
        deletedIds.push(id);
      }
    }

    return { deletedIds, notFoundIds };
  }

  async seedUserParts(userId: string): Promise<void> {
    const allSeedParts = [...STANDARD_FILTERS, ...STANDARD_BELTS];
    
    for (const partData of allSeedParts) {
      const existingPart = await this.findDuplicatePart(userId, partData);
      
      if (!existingPart) {
        await this.createPart(userId, partData);
      }
    }
  }

  // Client-Part relationship methods
  async getClientParts(companyId: string, clientId: string): Promise<(ClientPart & { part: Part })[]> {
    const result = await db.select()
      .from(clientParts)
      .leftJoin(parts, eq(clientParts.partId, parts.id))
      .where(and(eq(clientParts.clientId, clientId), eq(clientParts.companyId, companyId)));
    
    return result
      .filter(row => row.parts !== null)
      .map(row => ({
        ...row.client_parts,
        part: row.parts!
      }));
  }

  async getAllClientPartsBulk(companyId: string): Promise<Record<string, (ClientPart & { part: Part })[]>> {
    const result = await db.select()
      .from(clientParts)
      .leftJoin(parts, eq(clientParts.partId, parts.id))
      .where(eq(clientParts.companyId, companyId));
    
    const bulkMap: Record<string, (ClientPart & { part: Part })[]> = {};
    
    for (const row of result) {
      if (row.parts === null) continue;
      
      const clientId = row.client_parts.clientId;
      if (!bulkMap[clientId]) {
        bulkMap[clientId] = [];
      }
      
      bulkMap[clientId].push({
        ...row.client_parts,
        part: row.parts
      });
    }
    
    return bulkMap;
  }

  async addClientPart(companyId: string, userId: string, insertClientPart: InsertClientPart): Promise<ClientPart> {
    // Verify that the client belongs to the companyId
    const client = await this.getClient(companyId, insertClientPart.clientId);
    if (!client) {
      throw new Error("Client not found or does not belong to company");
    }
    
    // Verify that the part belongs to the companyId
    const part = await this.getPart(companyId, insertClientPart.partId);
    if (!part) {
      throw new Error("Part not found or does not belong to company");
    }
    
    const result = await db.insert(clientParts).values({ ...insertClientPart, companyId, userId }).returning();
    return result[0];
  }

  async updateClientPart(companyId: string, id: string, quantity: number): Promise<ClientPart | undefined> {
    const result = await db.update(clientParts).set({ quantity }).where(and(eq(clientParts.id, id), eq(clientParts.companyId, companyId))).returning();
    return result[0];
  }

  async deleteClientPart(companyId: string, id: string): Promise<boolean> {
    const result = await db.delete(clientParts).where(and(eq(clientParts.id, id), eq(clientParts.companyId, companyId))).returning();
    return result.length > 0;
  }

  async deleteAllClientParts(companyId: string, clientId: string): Promise<void> {
    await db.delete(clientParts).where(and(eq(clientParts.clientId, clientId), eq(clientParts.companyId, companyId)));
  }

  async getPartsReportByMonth(userId: string, month: number, outstandingOnly = false): Promise<Array<{ part: Part; totalQuantity: number }>> {
    const clientsWithMaintenance = await db.select()
      .from(clients)
      .where(and(
        eq(clients.userId, userId),
        sql`${month} = ANY(${clients.selectedMonths})`,
        eq(clients.inactive, false)
      ));
    
    if (clientsWithMaintenance.length === 0) {
      return [];
    }
    
    let clientIds = clientsWithMaintenance.map(c => c.id);
    
    // Filter out clients with completed maintenance if outstandingOnly is true
    if (outstandingOnly) {
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear, month, 1).toISOString();
      const endDate = new Date(currentYear, month + 1, 0, 23, 59, 59).toISOString();
      
      const completedRecords = await db.select()
        .from(maintenanceRecords)
        .where(and(
          eq(maintenanceRecords.userId, userId),
          inArray(maintenanceRecords.clientId, clientIds),
          sql`${maintenanceRecords.completedAt} IS NOT NULL`,
          sql`${maintenanceRecords.dueDate} >= ${startDate}`,
          sql`${maintenanceRecords.dueDate} <= ${endDate}`
        ));
      
      const completedClientIds = new Set(completedRecords.map(r => r.clientId));
      clientIds = clientIds.filter(id => !completedClientIds.has(id));
    }
    
    if (clientIds.length === 0) {
      return [];
    }
    
    const partsData = await db.select()
      .from(clientParts)
      .leftJoin(parts, eq(clientParts.partId, parts.id))
      .where(and(
        inArray(clientParts.clientId, clientIds),
        eq(clientParts.userId, userId)
      ));
    
    const partsMap = new Map<string, { part: Part; totalQuantity: number }>();
    
    for (const row of partsData) {
      if (!row.parts) continue;
      
      let key: string;
      if (row.parts.type === 'filter') {
        key = `filter-${row.parts.filterType}-${row.parts.size}`;
      } else if (row.parts.type === 'belt') {
        key = `belt-${row.parts.beltType}-${row.parts.size}`;
      } else {
        key = `other-${row.parts.name}`;
      }
      
      if (partsMap.has(key)) {
        const existing = partsMap.get(key)!;
        existing.totalQuantity += row.client_parts.quantity;
      } else {
        partsMap.set(key, {
          part: row.parts,
          totalQuantity: row.client_parts.quantity
        });
      }
    }
    
    return Array.from(partsMap.values()).sort((a, b) => {
      if (a.part.type !== b.part.type) {
        return a.part.type.localeCompare(b.part.type);
      }
      
      if (a.part.type === 'filter') {
        return (a.part.filterType || '').localeCompare(b.part.filterType || '');
      } else if (a.part.type === 'belt') {
        return (a.part.beltType || '').localeCompare(b.part.beltType || '');
      } else {
        return (a.part.name || '').localeCompare(b.part.name || '');
      }
    });
  }

  // Maintenance record methods
  async getMaintenanceRecord(userId: string, clientId: string, dueDate: string): Promise<MaintenanceRecord | undefined> {
    const result = await db.select()
      .from(maintenanceRecords)
      .where(and(
        eq(maintenanceRecords.userId, userId),
        eq(maintenanceRecords.clientId, clientId),
        eq(maintenanceRecords.dueDate, dueDate)
      ))
      .limit(1);
    return result[0];
  }

  async getLatestCompletedMaintenanceRecord(userId: string, clientId: string): Promise<MaintenanceRecord | undefined> {
    const result = await db.select()
      .from(maintenanceRecords)
      .where(and(
        eq(maintenanceRecords.userId, userId),
        eq(maintenanceRecords.clientId, clientId),
        sql`${maintenanceRecords.completedAt} IS NOT NULL`
      ))
      .orderBy(desc(maintenanceRecords.completedAt))
      .limit(1);
    return result[0];
  }

  async getAllLatestCompletedMaintenanceRecords(userId: string): Promise<Record<string, MaintenanceRecord>> {
    // Use a window function to get the latest completed record for each client
    const records = await db.execute<MaintenanceRecord>(sql`
      WITH ranked_records AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY completed_at DESC) as rn
        FROM maintenance_records
        WHERE user_id = ${userId}
          AND completed_at IS NOT NULL
      )
      SELECT id, user_id, client_id, due_date, completed_at
      FROM ranked_records
      WHERE rn = 1
    `);
    
    const result: Record<string, MaintenanceRecord> = {};
    for (const record of records.rows as any[]) {
      result[record.client_id] = {
        id: record.id,
        userId: record.user_id,
        clientId: record.client_id,
        dueDate: record.due_date,
        completedAt: record.completed_at,
      };
    }
    
    return result;
  }

  async getRecentlyCompletedMaintenance(userId: string, month: number, year: number): Promise<MaintenanceRecord[]> {
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    
    return db.select()
      .from(maintenanceRecords)
      .where(and(
        eq(maintenanceRecords.userId, userId),
        sql`${maintenanceRecords.completedAt} IS NOT NULL`,
        sql`${maintenanceRecords.completedAt} >= ${startDate}`,
        sql`${maintenanceRecords.completedAt} <= ${endDate}`
      ))
      .orderBy(desc(maintenanceRecords.completedAt));
  }

  async getCompletedUnscheduledMaintenance(userId: string): Promise<MaintenanceRecord[]> {
    const completedRecords = await db.select()
      .from(maintenanceRecords)
      .where(and(
        eq(maintenanceRecords.userId, userId),
        sql`${maintenanceRecords.completedAt} IS NOT NULL`
      ))
      .orderBy(desc(maintenanceRecords.completedAt));
    
    const result = [];
    for (const record of completedRecords) {
      const dueDate = new Date(record.dueDate);
      const year = dueDate.getFullYear();
      const month = dueDate.getMonth() + 1;
      
      // Check if there was a calendar assignment for this client in this month
      const assignment = await this.getClientCalendarAssignment(userId, record.clientId, year, month);
      if (!assignment) {
        result.push(record);
      }
    }
    
    return result;
  }

  async createMaintenanceRecord(userId: string, insertRecord: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    // Verify that the client belongs to the userId
    const client = await this.getClient(userId, insertRecord.clientId);
    if (!client) {
      throw new Error("Client not found or does not belong to user");
    }
    
    const result = await db.insert(maintenanceRecords).values({ ...insertRecord, userId }).returning();
    return result[0];
  }

  async updateMaintenanceRecord(userId: string, id: string, recordUpdate: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined> {
    const result = await db.update(maintenanceRecords).set(recordUpdate).where(and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.userId, userId))).returning();
    return result[0];
  }

  async deleteMaintenanceRecord(userId: string, id: string): Promise<boolean> {
    const result = await db.delete(maintenanceRecords).where(and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.userId, userId))).returning();
    return result.length > 0;
  }

  // Equipment methods
  async getAllEquipment(userId: string): Promise<Equipment[]> {
    return db.select()
      .from(equipment)
      .where(eq(equipment.userId, userId))
      .orderBy(equipment.createdAt);
  }

  async getClientEquipment(userId: string, clientId: string): Promise<Equipment[]> {
    return db.select()
      .from(equipment)
      .where(and(
        eq(equipment.userId, userId),
        eq(equipment.clientId, clientId)
      ))
      .orderBy(equipment.createdAt);
  }

  async getEquipment(userId: string, id: string): Promise<Equipment | undefined> {
    const result = await db.select()
      .from(equipment)
      .where(and(eq(equipment.id, id), eq(equipment.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createEquipment(userId: string, insertEquipment: InsertEquipment): Promise<Equipment> {
    // Verify that the client belongs to the userId
    const client = await this.getClient(userId, insertEquipment.clientId);
    if (!client) {
      throw new Error("Client not found or does not belong to user");
    }
    
    const result = await db.insert(equipment).values({ ...insertEquipment, userId }).returning();
    return result[0];
  }

  async updateEquipment(userId: string, id: string, equipmentUpdate: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const result = await db.update(equipment).set(equipmentUpdate).where(and(eq(equipment.id, id), eq(equipment.userId, userId))).returning();
    return result[0];
  }

  async deleteEquipment(userId: string, id: string): Promise<boolean> {
    const result = await db.delete(equipment).where(and(eq(equipment.id, id), eq(equipment.userId, userId))).returning();
    return result.length > 0;
  }

  async deleteAllClientEquipment(userId: string, clientId: string): Promise<void> {
    await db.delete(equipment).where(and(eq(equipment.userId, userId), eq(equipment.clientId, clientId)));
  }

  async getClientReport(userId: string, clientId: string): Promise<{ client: Client; parts: (ClientPart & { part: Part })[]; equipment: Equipment[] } | null> {
    const client = await this.getClient(userId, clientId);
    if (!client) {
      return null;
    }

    const parts = await this.getClientParts(userId, clientId);
    const equip = await this.getClientEquipment(userId, clientId);

    return {
      client,
      parts,
      equipment: equip
    };
  }

  // Company settings methods
  async getCompanySettings(userId: string): Promise<CompanySettings | undefined> {
    const result = await db.select()
      .from(companySettings)
      .where(eq(companySettings.userId, userId))
      .limit(1);
    return result[0];
  }

  async upsertCompanySettings(userId: string, settings: InsertCompanySettings): Promise<CompanySettings> {
    const existing = await this.getCompanySettings(userId);
    
    if (existing) {
      const result = await db.update(companySettings)
        .set({ ...settings, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(companySettings.userId, userId))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(companySettings)
        .values({ ...settings, userId })
        .returning();
      return result[0];
    }
  }

  // Calendar assignment methods
  async getCalendarAssignments(userId: string, year: number, month: number): Promise<CalendarAssignment[]> {
    return db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.userId, userId),
        eq(calendarAssignments.year, year),
        eq(calendarAssignments.month, month)
      ));
  }

  async getCalendarAssignment(userId: string, id: string): Promise<CalendarAssignment | undefined> {
    const result = await db.select()
      .from(calendarAssignments)
      .where(and(eq(calendarAssignments.id, id), eq(calendarAssignments.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createCalendarAssignment(userId: string, companyId: string, insertAssignment: InsertCalendarAssignment): Promise<CalendarAssignment> {
    // Verify that the client belongs to the userId
    const client = await this.getClient(userId, insertAssignment.clientId);
    if (!client) {
      throw new Error("Client not found or does not belong to user");
    }
    
    const result = await db.insert(calendarAssignments).values({ ...insertAssignment, userId, companyId }).returning();
    return result[0];
  }

  async updateCalendarAssignment(userId: string, id: string, assignmentUpdate: UpdateCalendarAssignment): Promise<CalendarAssignment | undefined> {
    // Build update object with only provided fields
    const updateFields: Partial<Pick<CalendarAssignment, 'day' | 'scheduledDate' | 'autoDueDate' | 'completed' | 'assignedTechnicianIds'>> = {};
    if (assignmentUpdate.day !== undefined) updateFields.day = assignmentUpdate.day;
    if (assignmentUpdate.scheduledDate !== undefined) updateFields.scheduledDate = assignmentUpdate.scheduledDate;
    if (assignmentUpdate.autoDueDate !== undefined) updateFields.autoDueDate = assignmentUpdate.autoDueDate;
    if (assignmentUpdate.completed !== undefined) updateFields.completed = assignmentUpdate.completed;
    if (assignmentUpdate.assignedTechnicianIds !== undefined) updateFields.assignedTechnicianIds = assignmentUpdate.assignedTechnicianIds;
    
    const result = await db.update(calendarAssignments)
      .set(updateFields)
      .where(and(eq(calendarAssignments.id, id), eq(calendarAssignments.userId, userId)))
      .returning();
    return result[0];
  }

  async getTechnicianTodayAssignments(technicianId: string): Promise<Array<{ id: string; client: Client; assignment: CalendarAssignment }>> {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    
    console.log(`[Technician Today] Looking for assignments for ${technicianId} on ${year}-${month}-${day}`);
    
    const assignments = await db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.year, year),
        eq(calendarAssignments.month, month),
        eq(calendarAssignments.day, day),
        eq(calendarAssignments.completed, false)
      ));

    console.log(`[Technician Today] Found ${assignments.length} total assignments for today`);

    const result = [];
    for (const assignment of assignments) {
      let techIds = assignment.assignedTechnicianIds;
      
      // Handle array that might be a string or actual array
      if (typeof techIds === 'string') {
        try {
          techIds = JSON.parse(techIds);
        } catch (e) {
          techIds = [];
        }
      }
      
      // Ensure it's an array
      if (!Array.isArray(techIds)) {
        techIds = techIds ? [techIds] : [];
      }
      
      // Check if technician is in the array
      if (techIds.includes(technicianId)) {
        const client = await this.getClient(assignment.companyId, assignment.clientId);
        if (client) {
          result.push({ id: assignment.id, client, assignment });
        }
      }
    }
    return result;
  }

  async deleteCalendarAssignment(userId: string, id: string): Promise<boolean> {
    const result = await db.delete(calendarAssignments)
      .where(and(eq(calendarAssignments.id, id), eq(calendarAssignments.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getClientCalendarAssignment(userId: string, clientId: string, year: number, month: number): Promise<CalendarAssignment | undefined> {
    const result = await db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.userId, userId),
        eq(calendarAssignments.clientId, clientId),
        eq(calendarAssignments.year, year),
        eq(calendarAssignments.month, month)
      ))
      .limit(1);
    return result[0];
  }

  async getUnscheduledClients(userId: string, year: number, month: number): Promise<Client[]> {
    const monthIndex = month - 1; // Convert to 0-indexed
    
    // Get all assignments for this month
    const assignments = await db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.userId, userId),
        eq(calendarAssignments.year, year),
        eq(calendarAssignments.month, month)
      ));
    
    const scheduledClientIds = new Set(assignments.map(a => a.clientId));
    
    // Get all clients for this user
    const allClients = await db.select()
      .from(clients)
      .where(eq(clients.userId, userId));
    
    // Filter clients
    const unscheduled: Client[] = [];
    
    for (const client of allClients) {
      // Exclude inactive clients
      if (client.inactive) continue;
      
      // Exclude clients not scheduled for this month
      if (!client.selectedMonths?.includes(monthIndex)) continue;
      
      // Exclude clients already scheduled
      if (scheduledClientIds.has(client.id)) continue;
      
      // Check if maintenance is completed for this month
      const latestRecord = await db.select()
        .from(maintenanceRecords)
        .where(and(
          eq(maintenanceRecords.userId, userId),
          eq(maintenanceRecords.clientId, client.id),
          sql`${maintenanceRecords.completedAt} IS NOT NULL`
        ))
        .orderBy(desc(maintenanceRecords.completedAt))
        .limit(1);
      
      if (latestRecord.length > 0) {
        const record = latestRecord[0];
        const completedDueDate = record.dueDate ? new Date(record.dueDate) : null;
        
        // Check if completed for this month's schedule
        if (completedDueDate) {
          const dueMonth = completedDueDate.getMonth();
          const dueYear = completedDueDate.getFullYear();
          if (dueMonth === monthIndex && dueYear === year) {
            continue; // Already completed for this month
          }
        }
      }
      
      unscheduled.push(client);
    }
    
    return unscheduled;
  }

  async cleanupInvalidCalendarAssignments(userId: string, clientId: string, validMonths: number[]): Promise<{ removedCount: number }> {
    // Get all calendar assignments for this client
    const allAssignments = await db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.userId, userId),
        eq(calendarAssignments.clientId, clientId)
      ));
    
    if (allAssignments.length === 0) {
      return { removedCount: 0 };
    }
    
    // Get all completed maintenance records for this client
    const completedRecords = await db.select()
      .from(maintenanceRecords)
      .where(and(
        eq(maintenanceRecords.userId, userId),
        eq(maintenanceRecords.clientId, clientId),
        sql`${maintenanceRecords.completedAt} IS NOT NULL`
      ));
    
    // Create a Set of completed dates for fast lookup (using month-year key)
    const completedMonthYears = new Set<string>();
    for (const record of completedRecords) {
      const dueDate = new Date(record.dueDate);
      const key = `${dueDate.getFullYear()}-${dueDate.getMonth() + 1}`;
      completedMonthYears.add(key);
    }
    
    // Find assignments to remove: not completed AND in invalid month
    const assignmentsToRemove: string[] = [];
    for (const assignment of allAssignments) {
      const assignmentKey = `${assignment.year}-${assignment.month}`;
      const isCompleted = completedMonthYears.has(assignmentKey);
      const isValidMonth = validMonths.includes(assignment.month - 1); // validMonths is 0-indexed
      
      // Remove if NOT completed AND NOT in a valid month
      if (!isCompleted && !isValidMonth) {
        assignmentsToRemove.push(assignment.id);
      }
    }
    
    // Delete the invalid assignments
    if (assignmentsToRemove.length > 0) {
      await db.delete(calendarAssignments)
        .where(
          and(
            eq(calendarAssignments.userId, userId),
            sql`${calendarAssignments.id} IN (${sql.join(assignmentsToRemove.map(id => sql`${id}`), sql`, `)})`
          )
        );
    }
    
    return { removedCount: assignmentsToRemove.length };
  }

  async createFeedback(userId: string, userEmail: string, feedbackData: InsertFeedback): Promise<Feedback> {
    const result = await db.insert(feedback).values({
      userId,
      userEmail,
      category: feedbackData.category,
      message: feedbackData.message
    }).returning();
    return result[0];
  }

  async getAllFeedback(): Promise<Feedback[]> {
    return db.select()
      .from(feedback)
      .orderBy(desc(feedback.createdAt));
  }

  async getUserFeedback(userId: string): Promise<Feedback[]> {
    return db.select()
      .from(feedback)
      .where(eq(feedback.userId, userId))
      .orderBy(desc(feedback.createdAt));
  }

  async updateFeedbackStatus(id: string, status: string): Promise<Feedback | undefined> {
    const result = await db.update(feedback)
      .set({ status })
      .where(eq(feedback.id, id))
      .returning();
    return result[0];
  }

  async archiveFeedback(id: string, archived: boolean): Promise<Feedback | undefined> {
    const result = await db.update(feedback)
      .set({ archived })
      .where(eq(feedback.id, id))
      .returning();
    return result[0];
  }

  async deleteFeedback(id: string): Promise<boolean> {
    const result = await db.delete(feedback)
      .where(eq(feedback.id, id))
      .returning();
    return result.length > 0;
  }

  async createInvitationToken(tokenData: any): Promise<any> {
    const result = await db.insert(invitationTokens).values(tokenData).returning();
    return result[0];
  }

  async getInvitationByToken(token: string): Promise<any | undefined> {
    const result = await db.select()
      .from(invitationTokens)
      .where(and(
        eq(invitationTokens.token, token),
        sql`${invitationTokens.usedAt} IS NULL`,
        sql`${invitationTokens.expiresAt} > NOW()`
      ))
      .limit(1);
    return result[0];
  }

  async markInvitationUsed(id: string, usedByUserId: string): Promise<void> {
    await db.update(invitationTokens)
      .set({ usedAt: new Date(), usedByUserId })
      .where(eq(invitationTokens.id, id));
  }

  async getCompanyById(id: string): Promise<any | undefined> {
    const result = await db.select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);
    return result[0];
  }
}

export const storage = new DbStorage();
