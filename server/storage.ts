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
  type InsertMaintenanceRecord
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Client methods
  getClient(id: string): Promise<Client | undefined>;
  getAllClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  
  // Part methods
  getPart(id: string): Promise<Part | undefined>;
  getAllParts(): Promise<Part[]>;
  getPartsByType(type: string): Promise<Part[]>;
  findDuplicatePart(part: InsertPart): Promise<Part | undefined>;
  createPart(part: InsertPart): Promise<Part>;
  updatePart(id: string, part: Partial<InsertPart>): Promise<Part | undefined>;
  deletePart(id: string): Promise<boolean>;
  
  // Client-Part relationship methods
  getClientParts(clientId: string): Promise<(ClientPart & { part: Part })[]>;
  addClientPart(clientPart: InsertClientPart): Promise<ClientPart>;
  updateClientPart(id: string, quantity: number): Promise<ClientPart | undefined>;
  deleteClientPart(id: string): Promise<boolean>;
  deleteAllClientParts(clientId: string): Promise<void>;
  
  // Reports
  getPartsReportByMonth(month: number): Promise<Array<{ part: Part; totalQuantity: number }>>;
  
  // Maintenance record methods
  getMaintenanceRecord(clientId: string, dueDate: string): Promise<MaintenanceRecord | undefined>;
  getLatestCompletedMaintenanceRecord(clientId: string): Promise<MaintenanceRecord | undefined>;
  getRecentlyCompletedMaintenance(month: number, year: number): Promise<MaintenanceRecord[]>;
  createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(id: string, record: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined>;
  deleteMaintenanceRecord(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private clients: Map<string, Client>;
  private parts: Map<string, Part>;
  private clientParts: Map<string, ClientPart>;
  private maintenanceRecords: Map<string, MaintenanceRecord>;

  constructor() {
    this.users = new Map();
    this.clients = new Map();
    this.parts = new Map();
    this.clientParts = new Map();
    this.maintenanceRecords = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Client methods
  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getAllClients(): Promise<Client[]> {
    return Array.from(this.clients.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = { 
      ...insertClient, 
      id,
      createdAt: new Date().toISOString()
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: string, clientUpdate: Partial<InsertClient>): Promise<Client | undefined> {
    const existing = this.clients.get(id);
    if (!existing) return undefined;
    
    const updated: Client = { ...existing, ...clientUpdate };
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  // Part methods
  async getPart(id: string): Promise<Part | undefined> {
    return this.parts.get(id);
  }

  async getAllParts(): Promise<Part[]> {
    return Array.from(this.parts.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPartsByType(type: string): Promise<Part[]> {
    return Array.from(this.parts.values()).filter(part => part.type === type);
  }

  async findDuplicatePart(insertPart: InsertPart): Promise<Part | undefined> {
    return Array.from(this.parts.values()).find(part => {
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

  async createPart(insertPart: InsertPart): Promise<Part> {
    const id = randomUUID();
    const part: Part = { 
      id,
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

  async updatePart(id: string, partUpdate: Partial<InsertPart>): Promise<Part | undefined> {
    const existing = this.parts.get(id);
    if (!existing) return undefined;
    
    const updated: Part = { ...existing, ...partUpdate };
    this.parts.set(id, updated);
    return updated;
  }

  async deletePart(id: string): Promise<boolean> {
    // Delete all client-part associations for this part
    const toDelete = Array.from(this.clientParts.entries())
      .filter(([_, cp]) => cp.partId === id)
      .map(([cpId]) => cpId);
    
    toDelete.forEach(cpId => this.clientParts.delete(cpId));
    
    // Delete the part itself
    return this.parts.delete(id);
  }

  // Client-Part relationship methods
  async getClientParts(clientId: string): Promise<(ClientPart & { part: Part })[]> {
    const clientPartsList = Array.from(this.clientParts.values())
      .filter(cp => cp.clientId === clientId);
    
    // Filter out any client-parts where the part no longer exists
    return clientPartsList
      .map(cp => {
        const part = this.parts.get(cp.partId);
        if (!part) return null;
        return { ...cp, part };
      })
      .filter((cp): cp is (ClientPart & { part: Part }) => cp !== null);
  }

  async addClientPart(insertClientPart: InsertClientPart): Promise<ClientPart> {
    const id = randomUUID();
    const clientPart: ClientPart = { ...insertClientPart, id };
    this.clientParts.set(id, clientPart);
    return clientPart;
  }

  async updateClientPart(id: string, quantity: number): Promise<ClientPart | undefined> {
    const existing = this.clientParts.get(id);
    if (!existing) return undefined;
    
    const updated: ClientPart = { ...existing, quantity };
    this.clientParts.set(id, updated);
    return updated;
  }

  async deleteClientPart(id: string): Promise<boolean> {
    return this.clientParts.delete(id);
  }

  async deleteAllClientParts(clientId: string): Promise<void> {
    const toDelete = Array.from(this.clientParts.entries())
      .filter(([_, cp]) => cp.clientId === clientId)
      .map(([id]) => id);
    
    toDelete.forEach(id => this.clientParts.delete(id));
  }

  async getPartsReportByMonth(month: number): Promise<Array<{ part: Part; totalQuantity: number }>> {
    const clientsWithMaintenance = Array.from(this.clients.values())
      .filter(client => client.selectedMonths.includes(month));
    
    const clientIds = clientsWithMaintenance.map(c => c.id);
    
    const partsMap = new Map<string, { part: Part; totalQuantity: number }>();
    
    for (const clientId of clientIds) {
      const clientParts = await this.getClientParts(clientId);
      
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
  async getMaintenanceRecord(clientId: string, dueDate: string): Promise<MaintenanceRecord | undefined> {
    return Array.from(this.maintenanceRecords.values()).find(
      record => record.clientId === clientId && record.dueDate === dueDate
    );
  }

  async getLatestCompletedMaintenanceRecord(clientId: string): Promise<MaintenanceRecord | undefined> {
    const records = Array.from(this.maintenanceRecords.values())
      .filter(record => record.clientId === clientId && record.completedAt);
    
    if (records.length === 0) return undefined;
    
    // Sort by completedAt descending and return the most recent
    return records.sort((a, b) => {
      const dateA = new Date(a.completedAt!).getTime();
      const dateB = new Date(b.completedAt!).getTime();
      return dateB - dateA;
    })[0];
  }

  async getRecentlyCompletedMaintenance(month: number, year: number): Promise<MaintenanceRecord[]> {
    return Array.from(this.maintenanceRecords.values())
      .filter(record => {
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

  async createMaintenanceRecord(insertRecord: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    const id = randomUUID();
    const record: MaintenanceRecord = { 
      ...insertRecord, 
      id,
      completedAt: insertRecord.completedAt ?? null 
    };
    this.maintenanceRecords.set(id, record);
    return record;
  }

  async updateMaintenanceRecord(id: string, recordUpdate: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined> {
    const existing = this.maintenanceRecords.get(id);
    if (!existing) return undefined;
    
    const updated: MaintenanceRecord = { ...existing, ...recordUpdate };
    this.maintenanceRecords.set(id, updated);
    return updated;
  }

  async deleteMaintenanceRecord(id: string): Promise<boolean> {
    return this.maintenanceRecords.delete(id);
  }
}

export const storage = new MemStorage();
