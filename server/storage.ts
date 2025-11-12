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
  type InsertEquipment
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  
  // Admin user management methods
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;
  updateUserAdminStatus(id: string, isAdmin: boolean): Promise<void>;
  
  // Password reset token methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(id: string): Promise<PasswordResetToken | undefined>;
  getPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | undefined>;
  markTokenUsed(id: string): Promise<void>;
  invalidateUserTokens(userId: string): Promise<void>;
  
  // Client methods
  getClient(userId: string, id: string): Promise<Client | undefined>;
  getAllClients(userId: string): Promise<Client[]>;
  createClient(userId: string, client: InsertClient): Promise<Client>;
  updateClient(userId: string, id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(userId: string, id: string): Promise<boolean>;
  
  // Part methods
  getPart(userId: string, id: string): Promise<Part | undefined>;
  getAllParts(userId: string): Promise<Part[]>;
  getPartsByType(userId: string, type: string): Promise<Part[]>;
  findDuplicatePart(userId: string, part: InsertPart): Promise<Part | undefined>;
  createPart(userId: string, part: InsertPart): Promise<Part>;
  updatePart(userId: string, id: string, part: Partial<InsertPart>): Promise<Part | undefined>;
  deletePart(userId: string, id: string): Promise<boolean>;
  seedUserParts(userId: string): Promise<void>;
  
  // Client-Part relationship methods
  getClientParts(userId: string, clientId: string): Promise<(ClientPart & { part: Part })[]>;
  addClientPart(userId: string, clientPart: InsertClientPart): Promise<ClientPart>;
  updateClientPart(userId: string, id: string, quantity: number): Promise<ClientPart | undefined>;
  deleteClientPart(userId: string, id: string): Promise<boolean>;
  deleteAllClientParts(userId: string, clientId: string): Promise<void>;
  
  // Reports
  getPartsReportByMonth(userId: string, month: number): Promise<Array<{ part: Part; totalQuantity: number }>>;
  
  // Maintenance record methods
  getMaintenanceRecord(userId: string, clientId: string, dueDate: string): Promise<MaintenanceRecord | undefined>;
  getLatestCompletedMaintenanceRecord(userId: string, clientId: string): Promise<MaintenanceRecord | undefined>;
  getRecentlyCompletedMaintenance(userId: string, month: number, year: number): Promise<MaintenanceRecord[]>;
  createMaintenanceRecord(userId: string, record: InsertMaintenanceRecord): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(userId: string, id: string, record: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined>;
  deleteMaintenanceRecord(userId: string, id: string): Promise<boolean>;
  
  // Equipment methods
  getAllEquipment(userId: string): Promise<Equipment[]>;
  getClientEquipment(userId: string, clientId: string): Promise<Equipment[]>;
  getEquipment(userId: string, id: string): Promise<Equipment | undefined>;
  createEquipment(userId: string, equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(userId: string, id: string, equipment: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  deleteEquipment(userId: string, id: string): Promise<boolean>;
  
  // Client report
  getClientReport(userId: string, clientId: string): Promise<{ client: Client; parts: (ClientPart & { part: Part })[]; equipment: Equipment[] } | null>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private clients: Map<string, Client>;
  private parts: Map<string, Part>;
  private clientParts: Map<string, ClientPart>;
  private maintenanceRecords: Map<string, MaintenanceRecord>;
  private passwordResetTokens: Map<string, PasswordResetToken>;

  constructor() {
    this.users = new Map();
    this.clients = new Map();
    this.parts = new Map();
    this.clientParts = new Map();
    this.maintenanceRecords = new Map();
    this.passwordResetTokens = new Map();
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id, isAdmin: false };
    this.users.set(id, user);
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      this.users.set(id, { ...user, password: hashedPassword });
    }
  }

  // Admin user management methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async updateUserAdminStatus(id: string, isAdmin: boolean): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      this.users.set(id, { ...user, isAdmin });
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
  async getClient(userId: string, id: string): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client || client.userId !== userId) return undefined;
    return client;
  }

  async getAllClients(userId: string): Promise<Client[]> {
    return Array.from(this.clients.values())
      .filter(client => client.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createClient(userId: string, insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = { 
      ...insertClient,
      userId,
      inactive: insertClient.inactive ?? false,
      id,
      createdAt: new Date().toISOString()
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(userId: string, id: string, clientUpdate: Partial<InsertClient>): Promise<Client | undefined> {
    const existing = this.clients.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    
    const updated: Client = { ...existing, ...clientUpdate };
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(userId: string, id: string): Promise<boolean> {
    const existing = this.clients.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.clients.delete(id);
  }

  // Part methods
  async getPart(userId: string, id: string): Promise<Part | undefined> {
    const part = this.parts.get(id);
    if (!part || part.userId !== userId) return undefined;
    return part;
  }

  async getAllParts(userId: string): Promise<Part[]> {
    return Array.from(this.parts.values())
      .filter(part => part.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPartsByType(userId: string, type: string): Promise<Part[]> {
    return Array.from(this.parts.values())
      .filter(part => part.userId === userId && part.type === type);
  }

  async findDuplicatePart(userId: string, insertPart: InsertPart): Promise<Part | undefined> {
    return Array.from(this.parts.values()).find(part => {
      if (part.userId !== userId) return false;
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

  async createPart(userId: string, insertPart: InsertPart): Promise<Part> {
    const id = randomUUID();
    const part: Part = { 
      id,
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

  async updatePart(userId: string, id: string, partUpdate: Partial<InsertPart>): Promise<Part | undefined> {
    const existing = this.parts.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    
    const updated: Part = { ...existing, ...partUpdate };
    this.parts.set(id, updated);
    return updated;
  }

  async deletePart(userId: string, id: string): Promise<boolean> {
    const existing = this.parts.get(id);
    if (!existing || existing.userId !== userId) return false;
    
    // Delete all client-part associations for this part
    const toDelete = Array.from(this.clientParts.entries())
      .filter(([_, cp]) => cp.partId === id && cp.userId === userId)
      .map(([cpId]) => cpId);
    
    toDelete.forEach(cpId => this.clientParts.delete(cpId));
    
    // Delete the part itself
    return this.parts.delete(id);
  }

  async seedUserParts(userId: string): Promise<void> {
    const { STANDARD_BELTS, STANDARD_FILTERS } = await import('./seed-data');
    const allSeedParts = [...STANDARD_FILTERS, ...STANDARD_BELTS];
    
    for (const partData of allSeedParts) {
      const existingPart = await this.findDuplicatePart(userId, partData);
      
      if (!existingPart) {
        await this.createPart(userId, partData);
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

  async addClientPart(userId: string, insertClientPart: InsertClientPart): Promise<ClientPart> {
    // Verify that the client belongs to the userId
    const client = this.clients.get(insertClientPart.clientId);
    if (!client || client.userId !== userId) {
      throw new Error("Client not found or does not belong to user");
    }
    
    // Verify that the part belongs to the userId
    const part = this.parts.get(insertClientPart.partId);
    if (!part || part.userId !== userId) {
      throw new Error("Part not found or does not belong to user");
    }
    
    const id = randomUUID();
    const clientPart: ClientPart = { ...insertClientPart, userId, id };
    this.clientParts.set(id, clientPart);
    return clientPart;
  }

  async updateClientPart(userId: string, id: string, quantity: number): Promise<ClientPart | undefined> {
    const existing = this.clientParts.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    
    const updated: ClientPart = { ...existing, quantity };
    this.clientParts.set(id, updated);
    return updated;
  }

  async deleteClientPart(userId: string, id: string): Promise<boolean> {
    const existing = this.clientParts.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.clientParts.delete(id);
  }

  async deleteAllClientParts(userId: string, clientId: string): Promise<void> {
    const toDelete = Array.from(this.clientParts.entries())
      .filter(([_, cp]) => cp.userId === userId && cp.clientId === clientId)
      .map(([id]) => id);
    
    toDelete.forEach(id => this.clientParts.delete(id));
  }

  async getPartsReportByMonth(userId: string, month: number): Promise<Array<{ part: Part; totalQuantity: number }>> {
    const clientsWithMaintenance = Array.from(this.clients.values())
      .filter(client => client.userId === userId && client.selectedMonths.includes(month) && !client.inactive);
    
    const clientIds = clientsWithMaintenance.map(c => c.id);
    
    const partsMap = new Map<string, { part: Part; totalQuantity: number }>();
    
    for (const clientId of clientIds) {
      const clientParts = await this.getClientParts(userId, clientId);
      
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
    return Array.from(this.maintenanceRecords.values()).filter(
      (eq) => eq.userId === userId && eq.clientId === clientId
    ) as unknown as Equipment[];
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
}

import { db } from './db';
import { users, clients, parts, clientParts, maintenanceRecords, passwordResetTokens, equipment } from '@shared/schema';
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

  async updateUserAdminStatus(id: string, isAdmin: boolean): Promise<void> {
    await db.update(users).set({ isAdmin }).where(eq(users.id, id));
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

  async seedUserParts(userId: string): Promise<void> {
    const { STANDARD_BELTS, STANDARD_FILTERS } = await import('./seed-data');
    const allSeedParts = [...STANDARD_FILTERS, ...STANDARD_BELTS];
    
    for (const partData of allSeedParts) {
      const existingPart = await this.findDuplicatePart(userId, partData);
      
      if (!existingPart) {
        await this.createPart(userId, partData);
      }
    }
  }

  // Client-Part relationship methods
  async getClientParts(userId: string, clientId: string): Promise<(ClientPart & { part: Part })[]> {
    const result = await db.select()
      .from(clientParts)
      .leftJoin(parts, eq(clientParts.partId, parts.id))
      .where(and(eq(clientParts.clientId, clientId), eq(clientParts.userId, userId)));
    
    return result
      .filter(row => row.parts !== null)
      .map(row => ({
        ...row.client_parts,
        part: row.parts!
      }));
  }

  async addClientPart(userId: string, insertClientPart: InsertClientPart): Promise<ClientPart> {
    // Verify that the client belongs to the userId
    const client = await this.getClient(userId, insertClientPart.clientId);
    if (!client) {
      throw new Error("Client not found or does not belong to user");
    }
    
    // Verify that the part belongs to the userId
    const part = await this.getPart(userId, insertClientPart.partId);
    if (!part) {
      throw new Error("Part not found or does not belong to user");
    }
    
    const result = await db.insert(clientParts).values({ ...insertClientPart, userId }).returning();
    return result[0];
  }

  async updateClientPart(userId: string, id: string, quantity: number): Promise<ClientPart | undefined> {
    const result = await db.update(clientParts).set({ quantity }).where(and(eq(clientParts.id, id), eq(clientParts.userId, userId))).returning();
    return result[0];
  }

  async deleteClientPart(userId: string, id: string): Promise<boolean> {
    const result = await db.delete(clientParts).where(and(eq(clientParts.id, id), eq(clientParts.userId, userId))).returning();
    return result.length > 0;
  }

  async deleteAllClientParts(userId: string, clientId: string): Promise<void> {
    await db.delete(clientParts).where(and(eq(clientParts.clientId, clientId), eq(clientParts.userId, userId)));
  }

  async getPartsReportByMonth(userId: string, month: number): Promise<Array<{ part: Part; totalQuantity: number }>> {
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
    
    const clientIds = clientsWithMaintenance.map(c => c.id);
    
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
}

export const storage = new DbStorage();
