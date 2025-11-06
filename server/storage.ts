import { 
  type User, 
  type InsertUser,
  type Client,
  type InsertClient,
  type Part,
  type InsertPart,
  type ClientPart,
  type InsertClientPart
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
  createPart(part: InsertPart): Promise<Part>;
  updatePart(id: string, part: Partial<InsertPart>): Promise<Part | undefined>;
  deletePart(id: string): Promise<boolean>;
  
  // Client-Part relationship methods
  getClientParts(clientId: string): Promise<(ClientPart & { part: Part })[]>;
  addClientPart(clientPart: InsertClientPart): Promise<ClientPart>;
  updateClientPart(id: string, quantity: number): Promise<ClientPart | undefined>;
  deleteClientPart(id: string): Promise<boolean>;
  deleteAllClientParts(clientId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private clients: Map<string, Client>;
  private parts: Map<string, Part>;
  private clientParts: Map<string, ClientPart>;

  constructor() {
    this.users = new Map();
    this.clients = new Map();
    this.parts = new Map();
    this.clientParts = new Map();
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
    return Array.from(this.clients.values());
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = { ...insertClient, id };
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
    return Array.from(this.parts.values());
  }

  async getPartsByType(type: string): Promise<Part[]> {
    return Array.from(this.parts.values()).filter(part => part.type === type);
  }

  async createPart(insertPart: InsertPart): Promise<Part> {
    const id = randomUUID();
    const part: Part = { ...insertPart, id };
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
}

export const storage = new MemStorage();
