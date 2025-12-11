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
  type InsertFeedback,
  type JobNote,
  type InsertJobNote,
  type UpdateJobNote,
  type ClientNote,
  type InsertClientNote,
  type UpdateClientNote,
  type CustomerCompany,
  type InsertCustomerCompany,
  type UpdateCustomerCompany,
  type Invoice,
  type InsertInvoice,
  type UpdateInvoice,
  type InvoiceLine,
  type InsertInvoiceLine,
  type UpdateInvoiceLine,
  type Job,
  type InsertJob,
  type UpdateJob,
  type RecurringJobSeries,
  type InsertRecurringJobSeries,
  type RecurringJobPhase,
  type InsertRecurringJobPhase,
  type LocationPMPlan,
  type InsertLocationPMPlan,
  type UpdateLocationPMPlan,
  type LocationPMPartTemplate,
  type InsertLocationPMPartTemplate,
  type UpdateLocationPMPartTemplate,
  type JobPart,
  type InsertJobPart,
  type UpdateJobPart,
  type LocationEquipment,
  type InsertLocationEquipment,
  type UpdateLocationEquipment,
  type JobEquipment,
  type InsertJobEquipment,
  type UpdateJobEquipment,
  type TechnicianProfile,
  type WorkingHours,
  type UserPermissionOverride,
  type Payment,
  type InsertPayment,
  type UpdatePayment,
  type JobTemplate,
  type InsertJobTemplate,
  type UpdateJobTemplate,
  type JobTemplateLineItem,
  type InsertJobTemplateLineItem,
  customerCompanies,
  jobTemplates,
  jobTemplateLineItems,
  invoices,
  invoiceLines,
  payments,
  jobs,
  recurringJobSeries,
  recurringJobPhases,
  locationPMPlans,
  locationPMPartTemplates,
  jobParts,
  locationEquipment,
  jobEquipment,
  parts,
  technicianProfiles,
  workingHours,
  userPermissionOverrides,
  roles,
  permissions,
  rolePermissions
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
  validateUserInCompany(userId: string, companyId: string): Promise<boolean>;
  
  // Admin user management methods
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string, requesterCompanyId?: string): Promise<boolean>;
  updateUserRole(id: string, role: string, requesterCompanyId?: string): Promise<void>;
  updateUserTrialDate(id: string, trialEndsAt: Date): Promise<void>;
  updateUserStripeCustomer(id: string, stripeCustomerId: string): Promise<void>;
  
  // Company subscription methods
  updateCompanyTrial(companyId: string, trialEndsAt: Date, requesterCompanyId?: string): Promise<void>;
  updateCompanyStripeCustomer(companyId: string, stripeCustomerId: string, requesterCompanyId?: string): Promise<void>;
  
  // Password reset token methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(id: string): Promise<PasswordResetToken | undefined>;
  getPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | undefined>;
  markTokenUsed(id: string): Promise<void>;
  invalidateUserTokens(userId: string): Promise<void>;
  
  // Client methods
  getClient(companyId: string, id: string): Promise<Client | undefined>;
  getAllClients(companyId: string): Promise<Client[]>;
  getClientsByParentCompany(companyId: string, parentCompanyId: string): Promise<Client[]>;
  createClient(companyId: string, userId: string, client: InsertClient): Promise<Client>;
  createClientWithParts(companyId: string, userId: string, client: InsertClient, partsList: Array<{ partId: string; quantity: number }>): Promise<Client>;
  updateClient(companyId: string, id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(companyId: string, id: string): Promise<boolean>;
  deleteClients(companyId: string, ids: string[]): Promise<{ deletedIds: string[]; notFoundIds: string[] }>;
  
  // Part methods
  getPart(companyId: string, id: string): Promise<Part | undefined>;
  getAllParts(companyId: string): Promise<Part[]>;
  getPartsByType(companyId: string, type: string): Promise<Part[]>;
  getPartBySku(companyId: string, sku: string): Promise<Part | undefined>;
  getPartsPaginated(companyId: string, options: { 
    limit?: number; 
    offset?: number; 
    type?: string; 
    search?: string; 
    isActive?: boolean; 
    category?: string;
  }): Promise<{ items: Part[]; total: number; hasMore: boolean }>;
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
  getAllCalendarAssignments(companyId: string): Promise<CalendarAssignment[]>;
  getAllCalendarAssignmentsPaginated(companyId: string, options: { limit?: number; offset?: number; status?: string; search?: string }): Promise<{ assignments: CalendarAssignment[]; total: number; hasMore: boolean }>;
  getCalendarAssignment(companyId: string, id: string): Promise<CalendarAssignment | undefined>;
  createCalendarAssignment(companyId: string, userId: string, assignment: InsertCalendarAssignment): Promise<CalendarAssignment>;
  updateCalendarAssignment(companyId: string, id: string, assignment: UpdateCalendarAssignment): Promise<CalendarAssignment | undefined>;
  deleteCalendarAssignment(companyId: string, id: string): Promise<boolean>;
  getClientCalendarAssignment(companyId: string, clientId: string, year: number, month: number): Promise<CalendarAssignment | undefined>;
  getUnscheduledClients(companyId: string, year: number, month: number): Promise<Client[]>;
  getAllUnscheduledAssignments(companyId: string): Promise<Array<{ client: Client; assignment: CalendarAssignment }>>;
  getAllUnscheduledBacklog(companyId: string): Promise<Array<{ 
    id: string;
    clientId: string;
    companyName: string;
    location: string | null;
    month: number;
    year: number;
    assignmentId: string | null;
    status: 'existing' | 'missing';
  }>>;
  getPastIncompleteAssignments(companyId: string): Promise<CalendarAssignment[]>;
  getOldUnscheduledAssignments(companyId: string): Promise<CalendarAssignment[]>;
  getAssignmentsByClient(companyId: string, clientId: string): Promise<CalendarAssignment[]>;
  getAssignmentsByParentCompany(companyId: string, parentCompanyId: string, locationId?: string): Promise<CalendarAssignment[]>;
  
  // Job notes methods
  getJobNotes(companyId: string, assignmentId: string): Promise<JobNote[]>;
  getJobNote(companyId: string, id: string): Promise<JobNote | undefined>;
  createJobNote(companyId: string, userId: string, note: InsertJobNote): Promise<JobNote>;
  updateJobNote(companyId: string, id: string, note: UpdateJobNote): Promise<JobNote | undefined>;
  deleteJobNote(companyId: string, id: string): Promise<boolean>;
  
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
  getAllCompanies(): Promise<any[]>;
  updateCompany(companyId: string, updates: Partial<any>): Promise<void>;
  
  // Jobs methods
  getJobs(companyId: string, filters?: {
    status?: string;
    technicianId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Job[]>;
  getJob(companyId: string, id: string): Promise<Job | undefined>;
  createJob(companyId: string, data: InsertJob): Promise<Job>;
  updateJob(companyId: string, id: string, data: UpdateJob): Promise<Job | undefined>;
  updateJobStatus(companyId: string, id: string, status: string): Promise<Job | undefined>;
  deleteJob(companyId: string, id: string): Promise<boolean>;
  getNextJobNumber(companyId: string): Promise<number>;
  getNextInvoiceNumber(companyId: string): Promise<number>;
  getCompanyCounters(companyId: string): Promise<{ nextJobNumber: number; nextInvoiceNumber: number }>;
  updateCompanyCounters(companyId: string, updates: { nextJobNumber?: number; nextInvoiceNumber?: number }): Promise<void>;
  
  // Recurring Job Series methods
  getRecurringSeries(companyId: string, id: string): Promise<RecurringJobSeries | undefined>;
  getRecurringSeriesByLocation(companyId: string, locationId: string): Promise<RecurringJobSeries[]>;
  createRecurringSeries(companyId: string, data: InsertRecurringJobSeries, phases: InsertRecurringJobPhase[]): Promise<RecurringJobSeries>;
  getRecurringPhases(seriesId: string): Promise<RecurringJobPhase[]>;
  generateJobsFromSeries(companyId: string, seriesId: string, count: number): Promise<Job[]>;
  
  // Location PM Plan methods
  getLocationPMPlan(locationId: string): Promise<LocationPMPlan | undefined>;
  createOrUpdateLocationPMPlan(locationId: string, data: InsertLocationPMPlan): Promise<LocationPMPlan>;
  deleteLocationPMPlan(locationId: string): Promise<boolean>;
  
  // Location PM Part Template methods
  getLocationPMParts(locationId: string): Promise<LocationPMPartTemplate[]>;
  createLocationPMPart(locationId: string, data: InsertLocationPMPartTemplate): Promise<LocationPMPartTemplate>;
  updateLocationPMPart(id: string, data: UpdateLocationPMPartTemplate): Promise<LocationPMPartTemplate | undefined>;
  deleteLocationPMPart(id: string): Promise<boolean>;
  
  // Job Parts methods
  getJobParts(jobId: string): Promise<JobPart[]>;
  createJobPart(jobId: string, data: InsertJobPart): Promise<JobPart>;
  updateJobPart(id: string, data: UpdateJobPart): Promise<JobPart | undefined>;
  deleteJobPart(id: string): Promise<boolean>;
  reorderJobParts(jobId: string, parts: { id: string; sortOrder: number }[]): Promise<void>;
  
  // PM Job generation
  generatePMJobForLocation(companyId: string, locationId: string, date: Date): Promise<{ job: Job; parts: JobPart[] } | null>;
  
  // Location Equipment methods (separate from legacy Equipment)
  getLocationEquipment(locationId: string): Promise<LocationEquipment[]>;
  getLocationEquipmentItem(id: string): Promise<LocationEquipment | undefined>;
  createLocationEquipment(locationId: string, data: InsertLocationEquipment): Promise<LocationEquipment>;
  updateLocationEquipment(id: string, data: UpdateLocationEquipment): Promise<LocationEquipment | undefined>;
  deleteLocationEquipment(id: string): Promise<boolean>;
  
  // Job Equipment methods (job-equipment associations)
  getJobEquipment(jobId: string): Promise<(JobEquipment & { equipment: LocationEquipment })[]>;
  createJobEquipment(jobId: string, data: InsertJobEquipment): Promise<JobEquipment>;
  updateJobEquipment(id: string, data: UpdateJobEquipment): Promise<JobEquipment | undefined>;
  deleteJobEquipment(id: string): Promise<boolean>;
  
  // Equipment service history
  getEquipmentServiceHistory(equipmentId: string): Promise<Job[]>;
  
  // Team Management methods
  getTeamMembers(companyId: string): Promise<User[]>;
  getTeamMember(companyId: string, userId: string): Promise<User | undefined>;
  updateTeamMember(companyId: string, userId: string, updates: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phone?: string;
    roleId?: string;
    status?: string;
    useCustomSchedule?: boolean;
  }): Promise<User | undefined>;
  deactivateTeamMember(companyId: string, userId: string): Promise<User | undefined>;
  
  // Technician Profile methods
  getTechnicianProfile(userId: string): Promise<TechnicianProfile | undefined>;
  upsertTechnicianProfile(userId: string, data: {
    laborCostPerHour?: string | null;
    billableRatePerHour?: string | null;
    color?: string | null;
    phone?: string | null;
    note?: string | null;
  }): Promise<TechnicianProfile>;
  
  // Working Hours methods
  getWorkingHours(userId: string): Promise<WorkingHours[]>;
  setWorkingHours(userId: string, hours: Array<{
    dayOfWeek: number;
    startTime?: string | null;
    endTime?: string | null;
    isWorking: boolean;
  }>): Promise<WorkingHours[]>;
  
  // User Permission Overrides methods
  getUserPermissionOverrides(userId: string): Promise<UserPermissionOverride[]>;
  setUserPermissionOverrides(userId: string, overrides: Array<{
    permissionId: string;
    override: 'grant' | 'revoke';
  }>): Promise<void>;
  
  // Job Template methods
  getJobTemplates(companyId: string, filter?: { jobType?: string; activeOnly?: boolean }): Promise<JobTemplate[]>;
  getJobTemplate(companyId: string, id: string): Promise<JobTemplate | undefined>;
  getJobTemplateLineItems(templateId: string): Promise<JobTemplateLineItem[]>;
  createJobTemplate(companyId: string, data: InsertJobTemplate, lines: Omit<InsertJobTemplateLineItem, 'templateId'>[]): Promise<JobTemplate>;
  updateJobTemplate(companyId: string, id: string, data: UpdateJobTemplate, lines?: Omit<InsertJobTemplateLineItem, 'templateId'>[]): Promise<JobTemplate | undefined>;
  deleteJobTemplate(companyId: string, id: string): Promise<boolean>;
  setJobTemplateAsDefault(companyId: string, id: string, jobType: string): Promise<JobTemplate | undefined>;
  getDefaultJobTemplateForJobType(companyId: string, jobType: string): Promise<JobTemplate | undefined>;
  applyJobTemplateToJob(companyId: string, jobId: string, templateId: string): Promise<JobPart[]>;
  cloneJobTemplate(companyId: string, id: string): Promise<JobTemplate | undefined>;
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
  private jobNotes: Map<string, JobNote>;
  private jobsMap: Map<string, Job>;
  private recurringSeriesMap: Map<string, RecurringJobSeries>;
  private recurringPhasesMap: Map<string, RecurringJobPhase>;
  private jobNumberCounters: Map<string, number>;
  private locationPMPlansMap: Map<string, LocationPMPlan>;
  private locationPMPartTemplatesMap: Map<string, LocationPMPartTemplate>;
  private jobPartsMap: Map<string, JobPart>;
  private locationEquipmentMap: Map<string, LocationEquipment>;
  private jobEquipmentMap: Map<string, JobEquipment>;

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
    this.jobNotes = new Map();
    this.jobsMap = new Map();
    this.recurringSeriesMap = new Map();
    this.recurringPhasesMap = new Map();
    this.jobNumberCounters = new Map();
    this.locationPMPlansMap = new Map();
    this.locationPMPartTemplatesMap = new Map();
    this.jobPartsMap = new Map();
    this.locationEquipmentMap = new Map();
    this.jobEquipmentMap = new Map();
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
      (user) => user.companyId === companyId
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
      id,
      createdAt: new Date(),
      companyId: insertUser.companyId,
      email: insertUser.email,
      password: insertUser.password,
      role: insertUser.role || 'technician',
      fullName: insertUser.fullName || null,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null
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

  async updateUserRole(id: string, role: string, requesterCompanyId?: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      // Validate company membership if requesterCompanyId is provided
      if (requesterCompanyId && user.companyId !== requesterCompanyId) {
        throw new Error("Cannot update user from another company");
      }
      this.users.set(id, { ...user, role });
    }
  }

  async validateUserInCompany(userId: string, companyId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return user?.companyId === companyId;
  }

  // Admin user management methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async deleteUser(id: string, requesterCompanyId?: string): Promise<boolean> {
    const user = this.users.get(id);
    if (user) {
      // Validate company membership if requesterCompanyId is provided
      if (requesterCompanyId && user.companyId !== requesterCompanyId) {
        throw new Error("Cannot delete user from another company");
      }
    }
    return this.users.delete(id);
  }

  async updateUserTrialDate(id: string, trialEndsAt: Date): Promise<void> {
    // Trial date is now on Company, not User - this is a no-op for MemStorage
  }

  async updateUserStripeCustomer(id: string, stripeCustomerId: string): Promise<void> {
    // Stripe customer is now on Company, not User - this is a no-op for MemStorage
  }

  async updateCompanyTrial(companyId: string, trialEndsAt: Date, requesterCompanyId?: string): Promise<void> {
    // Validate company membership if requesterCompanyId is provided
    if (requesterCompanyId && companyId !== requesterCompanyId) {
      throw new Error("Cannot update trial for another company");
    }
    const company = this.companies.get(companyId);
    if (company) {
      company.trialEndsAt = trialEndsAt;
      this.companies.set(companyId, company);
    }
  }

  async updateCompanyStripeCustomer(companyId: string, stripeCustomerId: string, requesterCompanyId?: string): Promise<void> {
    // Validate company membership if requesterCompanyId is provided
    if (requesterCompanyId && companyId !== requesterCompanyId) {
      throw new Error("Cannot update Stripe customer for another company");
    }
    const company = this.companies.get(companyId);
    if (company) {
      company.stripeCustomerId = stripeCustomerId;
      this.companies.set(companyId, company);
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

  async getClientsByParentCompany(companyId: string, parentCompanyId: string): Promise<Client[]> {
    return Array.from(this.clients.values())
      .filter(client => client.companyId === companyId && client.parentCompanyId === parentCompanyId)
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }

  async createClient(companyId: string, userId: string, insertClient: InsertClient): Promise<Client> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
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
      parentCompanyId: insertClient.parentCompanyId ?? null,
      billWithParent: insertClient.billWithParent ?? true,
      qboCustomerId: insertClient.qboCustomerId ?? null,
      qboParentCustomerId: insertClient.qboParentCustomerId ?? null,
      qboSyncToken: insertClient.qboSyncToken ?? null,
      qboLastSyncedAt: insertClient.qboLastSyncedAt ?? null,
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
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
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

  async getPartBySku(companyId: string, sku: string): Promise<Part | undefined> {
    return Array.from(this.parts.values())
      .find(part => part.companyId === companyId && part.sku === sku);
  }

  async getPartsPaginated(companyId: string, options: { 
    limit?: number; 
    offset?: number; 
    type?: string; 
    search?: string; 
    isActive?: boolean; 
    category?: string;
  }): Promise<{ items: Part[]; total: number; hasMore: boolean }> {
    const { limit = 50, offset = 0, type, search, isActive, category } = options;
    
    let filtered = Array.from(this.parts.values())
      .filter(part => part.companyId === companyId);
    
    if (type) {
      filtered = filtered.filter(part => part.type === type);
    }
    
    if (isActive !== undefined) {
      filtered = filtered.filter(part => part.isActive === isActive);
    }
    
    if (category) {
      filtered = filtered.filter(part => part.category === category);
    }
    
    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(part => 
        (part.name?.toLowerCase().includes(lowerSearch)) ||
        (part.sku?.toLowerCase().includes(lowerSearch)) ||
        (part.description?.toLowerCase().includes(lowerSearch))
      );
    }
    
    const total = filtered.length;
    const items = filtered
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + limit);
    
    return { items, total, hasMore: offset + limit < total };
  }

  async findDuplicatePart(companyId: string, insertPart: InsertPart): Promise<Part | undefined> {
    return Array.from(this.parts.values()).find(part => {
      if (part.companyId !== companyId) return false;
      if (part.type !== insertPart.type) return false;
      
      if (insertPart.type === 'filter') {
        return part.filterType === insertPart.filterType && part.size === insertPart.size;
      } else if (insertPart.type === 'belt') {
        return part.beltType === insertPart.beltType && part.size === insertPart.size;
      } else if (insertPart.type === 'other' || insertPart.type === 'service' || insertPart.type === 'product') {
        return part.name === insertPart.name;
      }
      
      return false;
    });
  }

  async createPart(companyId: string, userId: string, insertPart: InsertPart): Promise<Part> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
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
      sku: insertPart.sku ?? null,
      description: insertPart.description ?? null,
      cost: insertPart.cost ?? null,
      markupPercent: insertPart.markupPercent ?? null,
      unitPrice: insertPart.unitPrice ?? null,
      isTaxable: insertPart.isTaxable ?? true,
      taxExempt: insertPart.taxExempt ?? false,
      taxCode: insertPart.taxCode ?? null,
      category: insertPart.category ?? null,
      isActive: insertPart.isActive ?? true,
      qboItemId: insertPart.qboItemId ?? null,
      qboSyncToken: insertPart.qboSyncToken ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: null
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
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    const allSeedParts = [...STANDARD_FILTERS, ...STANDARD_BELTS];
    
    for (const partData of allSeedParts) {
      const existingPart = await this.findDuplicatePart(companyId, partData);
      
      if (!existingPart) {
        await this.createPart(companyId, userId, partData);
      }
    }
  }

  // Client-Part relationship methods
  async getClientParts(companyId: string, clientId: string): Promise<(ClientPart & { part: Part })[]> {
    const clientPartsList = Array.from(this.clientParts.values())
      .filter(cp => cp.companyId === companyId && cp.clientId === clientId);
    
    // Filter out any client-parts where the part no longer exists
    return clientPartsList
      .map(cp => {
        const part = this.parts.get(cp.partId);
        if (!part) return null;
        return { ...cp, part };
      })
      .filter((cp): cp is (ClientPart & { part: Part }) => cp !== null);
  }

  async getAllClientPartsBulk(companyId: string): Promise<Record<string, (ClientPart & { part: Part })[]>> {
    const bulkMap: Record<string, (ClientPart & { part: Part })[]> = {};
    
    const allClientParts = Array.from(this.clientParts.values())
      .filter(cp => cp.companyId === companyId);
    
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
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
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

  async getPartsReportByMonth(companyId: string, month: number, outstandingOnly = false): Promise<Array<{ part: Part; totalQuantity: number }>> {
    const clientsWithMaintenance = Array.from(this.clients.values())
      .filter(client => client.companyId === companyId && client.selectedMonths.includes(month) && !client.inactive);
    
    let clientIds = clientsWithMaintenance.map(c => c.id);
    
    // Filter out clients with completed maintenance if outstandingOnly is true
    if (outstandingOnly) {
      const completedClientIds = new Set<string>();
      const currentYear = new Date().getFullYear();
      
      // Get all maintenance records for this month
      const allRecords = Array.from(this.maintenanceRecords.values());
      for (const record of allRecords) {
        if (record.companyId === companyId && record.completedAt) {
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
  async getMaintenanceRecord(companyId: string, clientId: string, dueDate: string): Promise<MaintenanceRecord | undefined> {
    return Array.from(this.maintenanceRecords.values()).find(
      record => record.companyId === companyId && record.clientId === clientId && record.dueDate === dueDate
    );
  }

  async getLatestCompletedMaintenanceRecord(companyId: string, clientId: string): Promise<MaintenanceRecord | undefined> {
    const records = Array.from(this.maintenanceRecords.values())
      .filter(record => record.companyId === companyId && record.clientId === clientId && record.completedAt);
    
    if (records.length === 0) return undefined;
    
    // Sort by completedAt descending and return the most recent
    return records.sort((a, b) => {
      const dateA = new Date(a.completedAt!).getTime();
      const dateB = new Date(b.completedAt!).getTime();
      return dateB - dateA;
    })[0];
  }

  async getAllLatestCompletedMaintenanceRecords(companyId: string): Promise<Record<string, MaintenanceRecord>> {
    const allRecords = Array.from(this.maintenanceRecords.values())
      .filter(record => record.companyId === companyId && record.completedAt);
    
    const latestByClient: Record<string, MaintenanceRecord> = {};
    
    for (const record of allRecords) {
      const existing = latestByClient[record.clientId];
      if (!existing || new Date(record.completedAt!) > new Date(existing.completedAt!)) {
        latestByClient[record.clientId] = record;
      }
    }
    
    return latestByClient;
  }

  async getRecentlyCompletedMaintenance(companyId: string, month: number, year: number): Promise<MaintenanceRecord[]> {
    return Array.from(this.maintenanceRecords.values())
      .filter(record => {
        if (record.companyId !== companyId) return false;
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

  async getCompletedUnscheduledMaintenance(companyId: string): Promise<MaintenanceRecord[]> {
    const completedRecords = Array.from(this.maintenanceRecords.values())
      .filter(record => record.companyId === companyId && record.completedAt);
    
    const result = [];
    for (const record of completedRecords) {
      const dueDate = new Date(record.dueDate);
      const year = dueDate.getFullYear();
      const month = dueDate.getMonth() + 1;
      
      // Check if there was a calendar assignment for this client in this month
      const assignment = await this.getClientCalendarAssignment(companyId, record.clientId, year, month);
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

  async createMaintenanceRecord(companyId: string, userId: string, insertRecord: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    // Verify that the client belongs to the company
    const client = this.clients.get(insertRecord.clientId);
    if (!client || client.companyId !== companyId) {
      throw new Error("Client not found or does not belong to company");
    }
    
    const id = randomUUID();
    const record: MaintenanceRecord = { 
      ...insertRecord,
      companyId,
      userId,
      id,
      completedAt: insertRecord.completedAt ?? null 
    };
    this.maintenanceRecords.set(id, record);
    return record;
  }

  async updateMaintenanceRecord(companyId: string, id: string, recordUpdate: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined> {
    const existing = this.maintenanceRecords.get(id);
    if (!existing || existing.companyId !== companyId) return undefined;
    
    const updated: MaintenanceRecord = { ...existing, ...recordUpdate };
    this.maintenanceRecords.set(id, updated);
    return updated;
  }

  async deleteMaintenanceRecord(companyId: string, id: string): Promise<boolean> {
    const existing = this.maintenanceRecords.get(id);
    if (!existing || existing.companyId !== companyId) return false;
    return this.maintenanceRecords.delete(id);
  }

  // Equipment methods
  async getAllEquipment(companyId: string): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter(
      (eq) => eq.companyId === companyId
    );
  }

  async getClientEquipment(companyId: string, clientId: string): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter(
      (eq) => eq.companyId === companyId && eq.clientId === clientId
    );
  }

  async getEquipment(companyId: string, id: string): Promise<Equipment | undefined> {
    const equipment = this.equipment.get(id);
    if (!equipment || equipment.companyId !== companyId) return undefined;
    return equipment;
  }

  async createEquipment(companyId: string, userId: string, equipment: InsertEquipment): Promise<Equipment> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    const id = randomUUID();
    const newEquipment: Equipment = { 
      ...equipment,
      companyId,
      userId,
      id,
      createdAt: new Date().toISOString(),
      type: equipment.type ?? null,
      location: equipment.location ?? null,
      modelNumber: equipment.modelNumber ?? null,
      serialNumber: equipment.serialNumber ?? null,
      notes: equipment.notes ?? null
    };
    this.equipment.set(id, newEquipment);
    return newEquipment;
  }

  async updateEquipment(companyId: string, id: string, equipment: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const existing = this.equipment.get(id);
    if (!existing || existing.companyId !== companyId) return undefined;
    
    const updated: Equipment = { ...existing, ...equipment };
    this.equipment.set(id, updated);
    return updated;
  }

  async deleteEquipment(companyId: string, id: string): Promise<boolean> {
    const existing = this.equipment.get(id);
    if (!existing || existing.companyId !== companyId) return false;
    return this.equipment.delete(id);
  }

  async deleteAllClientEquipment(companyId: string, clientId: string): Promise<void> {
    const toDelete = Array.from(this.equipment.entries())
      .filter(([_, eq]) => eq.companyId === companyId && eq.clientId === clientId)
      .map(([id]) => id);
    
    toDelete.forEach(id => this.equipment.delete(id));
  }

  async getClientReport(companyId: string, clientId: string): Promise<{ client: Client; parts: (ClientPart & { part: Part })[]; equipment: Equipment[] } | null> {
    const client = await this.getClient(companyId, clientId);
    if (!client) {
      return null;
    }

    const parts = await this.getClientParts(companyId, clientId);
    const equip = await this.getClientEquipment(companyId, clientId);

    return {
      client,
      parts,
      equipment: equip
    };
  }

  // Company settings methods
  async getCompanySettings(companyId: string): Promise<CompanySettings | undefined> {
    return Array.from(this.companySettings.values()).find(
      (settings) => settings.companyId === companyId
    );
  }

  async upsertCompanySettings(companyId: string, userId: string, settings: InsertCompanySettings): Promise<CompanySettings> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    const existing = await this.getCompanySettings(companyId);
    
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
      calendarStartHour: settings.calendarStartHour ?? 8,
      id,
      companyId,
      userId,
      updatedAt: new Date().toISOString()
    };
    this.companySettings.set(id, newSettings);
    return newSettings;
  }

  // Calendar assignment methods
  async getCalendarAssignments(companyId: string, year: number, month: number, assignedTechnicianId?: string): Promise<CalendarAssignment[]> {
    // Validate that the technician belongs to the company if provided
    if (assignedTechnicianId) {
      const isValid = await this.validateUserInCompany(assignedTechnicianId, companyId);
      if (!isValid) {
        throw new Error("Technician does not belong to this company");
      }
    }
    
    return Array.from(this.calendarAssignments.values()).filter(
      (assignment) => {
        if (assignment.companyId !== companyId) return false;
        if (assignment.year !== year) return false;
        if (assignment.month !== month) return false;
        if (assignedTechnicianId && !assignment.assignedTechnicianIds?.includes(assignedTechnicianId)) return false;
        return true;
      }
    );
  }

  async getAllCalendarAssignments(companyId: string): Promise<CalendarAssignment[]> {
    return Array.from(this.calendarAssignments.values()).filter(
      (assignment) => assignment.companyId === companyId
    );
  }

  async getAssignmentsByClient(companyId: string, clientId: string): Promise<CalendarAssignment[]> {
    return Array.from(this.calendarAssignments.values())
      .filter((assignment) => assignment.companyId === companyId && assignment.clientId === clientId)
      .sort((a, b) => {
        const dateA = new Date(b.year, b.month - 1, b.day || 1);
        const dateB = new Date(a.year, a.month - 1, a.day || 1);
        return dateA.getTime() - dateB.getTime();
      });
  }

  async getAssignmentsByParentCompany(companyId: string, parentCompanyId: string, locationId?: string): Promise<CalendarAssignment[]> {
    const locations = Array.from(this.clients.values()).filter(
      (client) => client.companyId === companyId && client.parentCompanyId === parentCompanyId
    );
    const locationIds = locationId ? [locationId] : locations.map(l => l.id);
    
    return Array.from(this.calendarAssignments.values())
      .filter((assignment) => assignment.companyId === companyId && locationIds.includes(assignment.clientId))
      .sort((a, b) => {
        const dateA = new Date(b.year, b.month - 1, b.day || 1);
        const dateB = new Date(a.year, a.month - 1, a.day || 1);
        return dateA.getTime() - dateB.getTime();
      });
  }

  async getAllCalendarAssignmentsPaginated(companyId: string, options: { limit?: number; offset?: number; status?: string; search?: string }): Promise<{ assignments: CalendarAssignment[]; total: number; hasMore: boolean }> {
    const { limit, offset = 0, status, search } = options;
    let assignments = Array.from(this.calendarAssignments.values()).filter(
      (assignment) => assignment.companyId === companyId
    );
    
    const total = assignments.length;
    
    if (limit !== undefined) {
      assignments = assignments.slice(offset, offset + limit);
    }
    
    return {
      assignments,
      total,
      hasMore: limit !== undefined ? offset + limit < total : false
    };
  }

  async getCalendarAssignment(companyId: string, id: string): Promise<CalendarAssignment | undefined> {
    const assignment = this.calendarAssignments.get(id);
    if (assignment && assignment.companyId === companyId) {
      return assignment;
    }
    return undefined;
  }

  async createCalendarAssignment(companyId: string, userId: string, insertAssignment: InsertCalendarAssignment): Promise<CalendarAssignment> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    // Get next job number for this company
    const companyAssignments = Array.from(this.calendarAssignments.values())
      .filter(a => a.companyId === companyId);
    const maxJobNumber = companyAssignments.length > 0 
      ? Math.max(...companyAssignments.map(a => a.jobNumber))
      : 9999;
    const jobNumber = maxJobNumber + 1;
    
    const id = randomUUID();
    const assignment: CalendarAssignment = {
      ...insertAssignment,
      id,
      companyId,
      userId,
      jobNumber,
      day: insertAssignment.day ?? null,
      scheduledHour: insertAssignment.scheduledHour ?? null,
      autoDueDate: insertAssignment.autoDueDate ?? false,
      completed: insertAssignment.completed ?? false,
      assignedTechnicianIds: insertAssignment.assignedTechnicianIds ?? null,
      completionNotes: insertAssignment.completionNotes ?? null
    };
    this.calendarAssignments.set(id, assignment);
    return assignment;
  }

  async updateCalendarAssignment(companyId: string, id: string, assignmentUpdate: UpdateCalendarAssignment): Promise<CalendarAssignment | undefined> {
    const existing = await this.getCalendarAssignment(companyId, id);
    if (!existing) {
      return undefined;
    }

    const updated: CalendarAssignment = {
      ...existing,
      day: assignmentUpdate.day !== undefined ? assignmentUpdate.day : existing.day,
      scheduledDate: assignmentUpdate.scheduledDate !== undefined && assignmentUpdate.scheduledDate !== null ? assignmentUpdate.scheduledDate : existing.scheduledDate,
      scheduledHour: assignmentUpdate.scheduledHour !== undefined ? assignmentUpdate.scheduledHour : existing.scheduledHour,
      autoDueDate: assignmentUpdate.autoDueDate !== undefined ? assignmentUpdate.autoDueDate : existing.autoDueDate
    };
    this.calendarAssignments.set(id, updated);
    return updated;
  }

  async deleteCalendarAssignment(companyId: string, id: string): Promise<boolean> {
    const assignment = await this.getCalendarAssignment(companyId, id);
    if (!assignment) {
      return false;
    }
    return this.calendarAssignments.delete(id);
  }

  async getClientCalendarAssignment(companyId: string, clientId: string, year: number, month: number): Promise<CalendarAssignment | undefined> {
    return Array.from(this.calendarAssignments.values()).find(
      (assignment) => assignment.companyId === companyId && 
                      assignment.clientId === clientId && 
                      assignment.year === year && 
                      assignment.month === month
    );
  }

  async getUnscheduledClients(companyId: string, year: number, month: number): Promise<Client[]> {
    const allClients = await this.getAllClients(companyId);
    const assignments = await this.getCalendarAssignments(companyId, year, month);
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
        .filter(r => r.companyId === companyId && r.clientId === client.id && r.completedAt)
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

  async getAllUnscheduledAssignments(companyId: string): Promise<Array<{ client: Client; assignment: CalendarAssignment }>> {
    const allClients = await this.getAllClients(companyId);
    const allAssignments = Array.from(this.calendarAssignments.values())
      .filter(a => a.companyId === companyId && a.day === null && !a.completed);
    
    const result: Array<{ client: Client; assignment: CalendarAssignment }> = [];
    
    for (const assignment of allAssignments) {
      const client = allClients.find(c => c.id === assignment.clientId);
      if (client && !client.inactive) {
        result.push({ client, assignment });
      }
    }
    
    return result.sort((a, b) => {
      if (a.assignment.year !== b.assignment.year) return a.assignment.year - b.assignment.year;
      return a.assignment.month - b.assignment.month;
    });
  }

  async getAllUnscheduledBacklog(companyId: string): Promise<Array<{ 
    id: string;
    clientId: string;
    companyName: string;
    location: string | null;
    month: number;
    year: number;
    assignmentId: string | null;
    status: 'existing' | 'missing';
  }>> {
    const allClients = await this.getAllClients(companyId);
    const allAssignments = Array.from(this.calendarAssignments.values())
      .filter(a => a.companyId === companyId);
    
    const result: Array<{ 
      id: string;
      clientId: string;
      companyName: string;
      location: string | null;
      month: number;
      year: number;
      assignmentId: string | null;
      status: 'existing' | 'missing';
    }> = [];
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Calculate month boundaries (prev, current, next)
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    
    // Helper to check if a year/month is within our 3-month window (prev, current, next)
    const isWithinWindow = (year: number, month: number): boolean => {
      // Previous month
      if (year === prevMonthYear && month === prevMonth) return true;
      // Current month
      if (year === currentYear && month === currentMonth) return true;
      // Next month
      if (year === nextMonthYear && month === nextMonth) return true;
      return false;
    };
    
    // 1. Add all day=null incomplete assignments that are within our window (existing unscheduled)
    for (const assignment of allAssignments) {
      if (assignment.day === null && !assignment.completed) {
        // Only include if within our 3-month window
        if (!isWithinWindow(assignment.year, assignment.month)) continue;
        
        const client = allClients.find(c => c.id === assignment.clientId);
        if (client && !client.inactive) {
          result.push({
            id: assignment.id,
            clientId: client.id,
            companyName: client.companyName,
            location: client.location,
            month: assignment.month,
            year: assignment.year,
            assignmentId: assignment.id,
            status: 'existing'
          });
        }
      }
    }
    
    // 2. Find clients missing assignments for their selected months
    // Only include: previous month, current month, and next month
    for (const client of allClients) {
      if (client.inactive) continue;
      if (!client.selectedMonths || client.selectedMonths.length === 0) continue;
      
      for (const monthIndex of client.selectedMonths) {
        const month = monthIndex + 1; // Convert 0-indexed to 1-indexed
        
        // Only include previous month, current month, and next month
        const isPrevMonth = month === prevMonth;
        const isCurrentMonth = month === currentMonth;
        const isNextMonth = month === nextMonth;
        
        if (!isPrevMonth && !isCurrentMonth && !isNextMonth) {
          continue;
        }
        
        // Determine target year based on which month bucket
        let targetYear = currentYear;
        if (isPrevMonth) {
          targetYear = prevMonthYear;
        } else if (isNextMonth) {
          targetYear = nextMonthYear;
        }
        
        // Check if assignment exists for this client/year/month (any assignment, including completed)
        const existingAssignment = allAssignments.find(a => 
          a.clientId === client.id && 
          a.year === targetYear && 
          a.month === month
        );
        
        // If no assignment exists, add as "missing"
        if (!existingAssignment) {
          result.push({
            id: `${client.id}:${targetYear}-${month}`,
            clientId: client.id,
            companyName: client.companyName,
            location: client.location,
            month: month,
            year: targetYear,
            assignmentId: null,
            status: 'missing'
          });
        }
      }
    }
    
    // Sort by year, then month
    return result.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }

  async getPastIncompleteAssignments(companyId: string): Promise<CalendarAssignment[]> {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-indexed
    
    return Array.from(this.calendarAssignments.values()).filter(assignment => {
      if (assignment.companyId !== companyId) return false;
      if (assignment.completed) return false;
      
      // Check if the assignment is from a past month
      if (assignment.year < currentYear) return true;
      if (assignment.year === currentYear && assignment.month < currentMonth) return true;
      
      return false;
    });
  }
  
  // Get old unscheduled assignments (older than previous month) that need user action
  async getOldUnscheduledAssignments(companyId: string): Promise<CalendarAssignment[]> {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-indexed
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    return Array.from(this.calendarAssignments.values()).filter(assignment => {
      if (assignment.companyId !== companyId) return false;
      if (assignment.completed) return false;
      if (assignment.day !== null) return false; // Only unscheduled
      
      // Check if older than previous month
      if (assignment.year < prevMonthYear) return true;
      if (assignment.year === prevMonthYear && assignment.month < prevMonth) return true;
      
      return false;
    });
  }

  async createFeedback(companyId: string, userId: string, userEmail: string, feedback: InsertFeedback): Promise<Feedback> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    const newFeedback: Feedback = {
      id: randomUUID(),
      companyId,
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

  async getCompanyFeedback(companyId: string): Promise<Feedback[]> {
    return Array.from(this.feedback.values())
      .filter(f => f.companyId === companyId)
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

  async getAllCompanies(): Promise<any[]> {
    return Array.from(this.companies.values());
  }

  async updateCompany(companyId: string, updates: Partial<any>): Promise<void> {
    const company = this.companies.get(companyId);
    if (company) {
      this.companies.set(companyId, { ...company, ...updates });
    }
  }

  // Job notes methods
  async getJobNotes(companyId: string, assignmentId: string): Promise<JobNote[]> {
    return Array.from(this.jobNotes.values())
      .filter(note => note.companyId === companyId && note.assignmentId === assignmentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getJobNote(companyId: string, id: string): Promise<JobNote | undefined> {
    const note = this.jobNotes.get(id);
    if (note && note.companyId === companyId) {
      return note;
    }
    return undefined;
  }

  async createJobNote(companyId: string, userId: string, note: InsertJobNote): Promise<JobNote> {
    const id = randomUUID();
    const now = new Date();
    const newNote: JobNote = {
      id,
      companyId,
      userId,
      assignmentId: note.assignmentId,
      noteText: note.noteText,
      imageUrl: note.imageUrl || null,
      createdAt: now,
      updatedAt: now,
    };
    this.jobNotes.set(id, newNote);
    return newNote;
  }

  async updateJobNote(companyId: string, id: string, note: UpdateJobNote): Promise<JobNote | undefined> {
    const existing = this.jobNotes.get(id);
    if (!existing || existing.companyId !== companyId) {
      return undefined;
    }
    const updated: JobNote = {
      ...existing,
      ...note,
      updatedAt: new Date(),
    };
    this.jobNotes.set(id, updated);
    return updated;
  }

  async deleteJobNote(companyId: string, id: string): Promise<boolean> {
    const note = this.jobNotes.get(id);
    if (note && note.companyId === companyId) {
      this.jobNotes.delete(id);
      return true;
    }
    return false;
  }

  // Jobs methods
  async getJobs(companyId: string, filters?: {
    status?: string;
    technicianId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Job[]> {
    let result = Array.from(this.jobsMap.values())
      .filter(job => job.companyId === companyId && job.isActive);
    
    if (filters?.status) {
      result = result.filter(job => job.status === filters.status);
    }
    if (filters?.technicianId) {
      result = result.filter(job => 
        job.primaryTechnicianId === filters.technicianId ||
        job.assignedTechnicianIds?.includes(filters.technicianId!)
      );
    }
    if (filters?.locationId) {
      result = result.filter(job => job.locationId === filters.locationId);
    }
    if (filters?.startDate) {
      const start = new Date(filters.startDate);
      result = result.filter(job => job.scheduledStart && new Date(job.scheduledStart) >= start);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate);
      result = result.filter(job => job.scheduledStart && new Date(job.scheduledStart) <= end);
    }
    
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getJob(companyId: string, id: string): Promise<Job | undefined> {
    const job = this.jobsMap.get(id);
    if (job && job.companyId === companyId) {
      return job;
    }
    return undefined;
  }

  async getNextJobNumber(companyId: string): Promise<number> {
    const current = this.jobNumberCounters.get(companyId) || 10000;
    const next = current + 1;
    this.jobNumberCounters.set(companyId, next);
    return next;
  }

  async getNextInvoiceNumber(_companyId: string): Promise<number> {
    return 1001;
  }

  async getCompanyCounters(companyId: string): Promise<{ nextJobNumber: number; nextInvoiceNumber: number }> {
    const nextJobNumber = this.jobNumberCounters.get(companyId) || 10000;
    return { nextJobNumber, nextInvoiceNumber: 1001 };
  }

  async updateCompanyCounters(companyId: string, updates: { nextJobNumber?: number; nextInvoiceNumber?: number }): Promise<void> {
    if (updates.nextJobNumber !== undefined) {
      this.jobNumberCounters.set(companyId, updates.nextJobNumber);
    }
  }

  async createJob(companyId: string, data: InsertJob): Promise<Job> {
    const id = randomUUID();
    const jobNumber = await this.getNextJobNumber(companyId);
    const now = new Date();
    
    // If primaryTechnicianId is set but assignedTechnicianIds is not, include primary in assigned list
    let assignedTechnicianIds = data.assignedTechnicianIds || null;
    if (data.primaryTechnicianId && (!assignedTechnicianIds || assignedTechnicianIds.length === 0)) {
      assignedTechnicianIds = [data.primaryTechnicianId];
    }
    
    const newJob: Job = {
      id,
      companyId,
      jobNumber,
      locationId: data.locationId,
      primaryTechnicianId: data.primaryTechnicianId || null,
      assignedTechnicianIds,
      status: data.status || 'draft',
      priority: data.priority || 'medium',
      jobType: data.jobType || 'maintenance',
      summary: data.summary,
      description: data.description || null,
      accessInstructions: data.accessInstructions || null,
      scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
      scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null,
      actualStart: null,
      actualEnd: null,
      invoiceId: data.invoiceId || null,
      qboInvoiceId: data.qboInvoiceId || null,
      billingNotes: data.billingNotes || null,
      recurringSeriesId: data.recurringSeriesId || null,
      calendarAssignmentId: data.calendarAssignmentId || null,
      isActive: true,
      createdAt: now,
      updatedAt: null,
    };
    this.jobsMap.set(id, newJob);
    return newJob;
  }

  async updateJob(companyId: string, id: string, data: UpdateJob): Promise<Job | undefined> {
    const existing = this.jobsMap.get(id);
    if (!existing || existing.companyId !== companyId) {
      return undefined;
    }
    const updated: Job = {
      ...existing,
      ...data,
      scheduledStart: data.scheduledStart !== undefined ? (data.scheduledStart ? new Date(data.scheduledStart) : null) : existing.scheduledStart,
      scheduledEnd: data.scheduledEnd !== undefined ? (data.scheduledEnd ? new Date(data.scheduledEnd) : null) : existing.scheduledEnd,
      actualStart: data.actualStart !== undefined ? (data.actualStart ? new Date(data.actualStart) : null) : existing.actualStart,
      actualEnd: data.actualEnd !== undefined ? (data.actualEnd ? new Date(data.actualEnd) : null) : existing.actualEnd,
      updatedAt: new Date(),
    };
    this.jobsMap.set(id, updated);
    return updated;
  }

  async updateJobStatus(companyId: string, id: string, status: string): Promise<Job | undefined> {
    return this.updateJob(companyId, id, { status: status as any });
  }

  async deleteJob(companyId: string, id: string): Promise<boolean> {
    const job = this.jobsMap.get(id);
    if (job && job.companyId === companyId) {
      // Soft delete
      job.isActive = false;
      job.updatedAt = new Date();
      this.jobsMap.set(id, job);
      return true;
    }
    return false;
  }

  // Recurring Job Series methods
  async getRecurringSeries(companyId: string, id: string): Promise<RecurringJobSeries | undefined> {
    const series = this.recurringSeriesMap.get(id);
    if (series && series.companyId === companyId) {
      return series;
    }
    return undefined;
  }

  async getRecurringSeriesByLocation(companyId: string, locationId: string): Promise<RecurringJobSeries[]> {
    return Array.from(this.recurringSeriesMap.values())
      .filter(s => s.companyId === companyId && s.locationId === locationId && s.isActive);
  }

  async createRecurringSeries(companyId: string, data: InsertRecurringJobSeries, phases: InsertRecurringJobPhase[]): Promise<RecurringJobSeries> {
    const id = randomUUID();
    const now = new Date();
    const series: RecurringJobSeries = {
      id,
      companyId,
      locationId: data.locationId,
      baseSummary: data.baseSummary,
      baseDescription: data.baseDescription || null,
      baseJobType: data.baseJobType || 'service',
      basePriority: data.basePriority || 'normal',
      defaultTechnicianId: data.defaultTechnicianId || null,
      startDate: data.startDate,
      timezone: data.timezone || 'America/Toronto',
      notes: data.notes || null,
      isActive: true,
      createdByUserId: data.createdByUserId || null,
      createdAt: now,
      updatedAt: null,
    };
    this.recurringSeriesMap.set(id, series);

    // Create phases
    for (const phaseData of phases) {
      const phaseId = randomUUID();
      const phase: RecurringJobPhase = {
        id: phaseId,
        seriesId: id,
        orderIndex: phaseData.orderIndex ?? 0,
        frequency: phaseData.frequency,
        interval: phaseData.interval || 1,
        occurrences: phaseData.occurrences || null,
        untilDate: phaseData.untilDate || null,
      };
      this.recurringPhasesMap.set(phaseId, phase);
    }

    return series;
  }

  async getRecurringPhases(seriesId: string): Promise<RecurringJobPhase[]> {
    return Array.from(this.recurringPhasesMap.values())
      .filter(p => p.seriesId === seriesId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async generateJobsFromSeries(companyId: string, seriesId: string, count: number): Promise<Job[]> {
    const series = await this.getRecurringSeries(companyId, seriesId);
    if (!series) return [];

    const phases = await this.getRecurringPhases(seriesId);
    if (phases.length === 0) return [];

    const generatedJobs: Job[] = [];
    let currentDate = new Date(series.startDate);
    let jobsGenerated = 0;
    let phaseIndex = 0;
    let phaseOccurrenceCount = 0;

    while (jobsGenerated < count && phaseIndex < phases.length) {
      const phase = phases[phaseIndex];
      
      // Check if phase is complete
      if (phase.occurrences && phaseOccurrenceCount >= phase.occurrences) {
        phaseIndex++;
        phaseOccurrenceCount = 0;
        continue;
      }
      if (phase.untilDate && currentDate > new Date(phase.untilDate)) {
        phaseIndex++;
        phaseOccurrenceCount = 0;
        continue;
      }

      // Create job for current date
      const job = await this.createJob(companyId, {
        locationId: series.locationId,
        summary: series.baseSummary,
        description: series.baseDescription,
        jobType: series.baseJobType as any,
        priority: series.basePriority as any,
        primaryTechnicianId: series.defaultTechnicianId,
        scheduledStart: currentDate.toISOString(),
        recurringSeriesId: seriesId,
        status: 'scheduled',
      });
      generatedJobs.push(job);
      jobsGenerated++;
      phaseOccurrenceCount++;

      // Advance to next date based on frequency
      currentDate = this.advanceDate(currentDate, phase.frequency, phase.interval);
    }

    return generatedJobs;
  }

  private advanceDate(date: Date, frequency: string, interval: number): Date {
    const result = new Date(date);
    switch (frequency) {
      case 'daily':
        result.setDate(result.getDate() + interval);
        break;
      case 'weekly':
        result.setDate(result.getDate() + (7 * interval));
        break;
      case 'monthly':
        result.setMonth(result.getMonth() + interval);
        break;
      case 'quarterly':
        result.setMonth(result.getMonth() + (3 * interval));
        break;
      case 'yearly':
        result.setFullYear(result.getFullYear() + interval);
        break;
    }
    return result;
  }

  // Location PM Plan methods
  async getLocationPMPlan(locationId: string): Promise<LocationPMPlan | undefined> {
    return Array.from(this.locationPMPlansMap.values())
      .find(p => p.locationId === locationId && p.isActive);
  }

  async createOrUpdateLocationPMPlan(locationId: string, data: InsertLocationPMPlan): Promise<LocationPMPlan> {
    const existing = await this.getLocationPMPlan(locationId);
    if (existing) {
      const updated: LocationPMPlan = {
        ...existing,
        ...data,
        locationId,
        updatedAt: new Date(),
      };
      this.locationPMPlansMap.set(existing.id, updated);
      return updated;
    }
    const id = randomUUID();
    const plan: LocationPMPlan = {
      id,
      locationId,
      hasPm: data.hasPm ?? false,
      pmType: data.pmType ?? null,
      pmJan: data.pmJan ?? false,
      pmFeb: data.pmFeb ?? false,
      pmMar: data.pmMar ?? false,
      pmApr: data.pmApr ?? false,
      pmMay: data.pmMay ?? false,
      pmJun: data.pmJun ?? false,
      pmJul: data.pmJul ?? false,
      pmAug: data.pmAug ?? false,
      pmSep: data.pmSep ?? false,
      pmOct: data.pmOct ?? false,
      pmNov: data.pmNov ?? false,
      pmDec: data.pmDec ?? false,
      notes: data.notes ?? null,
      recurringSeriesId: data.recurringSeriesId ?? null,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: null,
    };
    this.locationPMPlansMap.set(id, plan);
    return plan;
  }

  async deleteLocationPMPlan(locationId: string): Promise<boolean> {
    const plan = await this.getLocationPMPlan(locationId);
    if (plan) {
      const updated = { ...plan, isActive: false, updatedAt: new Date() };
      this.locationPMPlansMap.set(plan.id, updated);
      return true;
    }
    return false;
  }

  // Location PM Part Template methods
  async getLocationPMParts(locationId: string): Promise<LocationPMPartTemplate[]> {
    return Array.from(this.locationPMPartTemplatesMap.values())
      .filter(p => p.locationId === locationId && p.isActive);
  }

  async createLocationPMPart(locationId: string, data: InsertLocationPMPartTemplate): Promise<LocationPMPartTemplate> {
    const id = randomUUID();
    const template: LocationPMPartTemplate = {
      id,
      locationId,
      productId: data.productId,
      descriptionOverride: data.descriptionOverride ?? null,
      quantityPerVisit: data.quantityPerVisit,
      equipmentLabel: data.equipmentLabel ?? null,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: null,
    };
    this.locationPMPartTemplatesMap.set(id, template);
    return template;
  }

  async updateLocationPMPart(id: string, data: UpdateLocationPMPartTemplate): Promise<LocationPMPartTemplate | undefined> {
    const template = this.locationPMPartTemplatesMap.get(id);
    if (!template) return undefined;
    const updated: LocationPMPartTemplate = {
      ...template,
      ...data,
      updatedAt: new Date(),
    };
    this.locationPMPartTemplatesMap.set(id, updated);
    return updated;
  }

  async deleteLocationPMPart(id: string): Promise<boolean> {
    const template = this.locationPMPartTemplatesMap.get(id);
    if (template) {
      const updated = { ...template, isActive: false, updatedAt: new Date() };
      this.locationPMPartTemplatesMap.set(id, updated);
      return true;
    }
    return false;
  }

  // Job Parts methods
  async getJobParts(jobId: string): Promise<JobPart[]> {
    return Array.from(this.jobPartsMap.values())
      .filter(p => p.jobId === jobId && p.isActive)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async createJobPart(jobId: string, data: InsertJobPart): Promise<JobPart> {
    const id = randomUUID();
    const jobPart: JobPart = {
      id,
      jobId,
      productId: data.productId ?? null,
      equipmentId: data.equipmentId ?? null,
      description: data.description,
      quantity: data.quantity,
      unitCost: data.unitCost ?? null,
      unitPrice: data.unitPrice ?? null,
      source: data.source ?? 'manual',
      equipmentLabel: data.equipmentLabel ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: null,
    };
    this.jobPartsMap.set(id, jobPart);
    return jobPart;
  }

  async updateJobPart(id: string, data: UpdateJobPart): Promise<JobPart | undefined> {
    const part = this.jobPartsMap.get(id);
    if (!part) return undefined;
    const updated: JobPart = {
      ...part,
      ...data,
      updatedAt: new Date(),
    };
    this.jobPartsMap.set(id, updated);
    return updated;
  }

  async deleteJobPart(id: string): Promise<boolean> {
    const part = this.jobPartsMap.get(id);
    if (part) {
      const updated = { ...part, isActive: false, updatedAt: new Date() };
      this.jobPartsMap.set(id, updated);
      return true;
    }
    return false;
  }

  async reorderJobParts(jobId: string, parts: { id: string; sortOrder: number }[]): Promise<void> {
    for (const { id, sortOrder } of parts) {
      const part = this.jobPartsMap.get(id);
      if (part && part.jobId === jobId) {
        this.jobPartsMap.set(id, { ...part, sortOrder, updatedAt: new Date() });
      }
    }
  }

  // PM Job generation
  async generatePMJobForLocation(companyId: string, locationId: string, date: Date): Promise<{ job: Job; parts: JobPart[] } | null> {
    const pmPlan = await this.getLocationPMPlan(locationId);
    if (!pmPlan || !pmPlan.hasPm) return null;

    const month = date.getMonth();
    const monthFlags = [
      pmPlan.pmJan, pmPlan.pmFeb, pmPlan.pmMar, pmPlan.pmApr,
      pmPlan.pmMay, pmPlan.pmJun, pmPlan.pmJul, pmPlan.pmAug,
      pmPlan.pmSep, pmPlan.pmOct, pmPlan.pmNov, pmPlan.pmDec
    ];
    if (!monthFlags[month]) return null;

    const location = await this.getClient(companyId, locationId);
    if (!location) return null;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const summary = `PM Visit - ${monthNames[month]} ${date.getFullYear()} - ${location.companyName}`;

    const job = await this.createJob(companyId, {
      locationId,
      summary,
      description: pmPlan.notes || undefined,
      jobType: 'maintenance',
      priority: 'medium',
      status: 'scheduled',
      scheduledStart: date.toISOString(),
      recurringSeriesId: pmPlan.recurringSeriesId || undefined,
    });

    const pmPartTemplates = await this.getLocationPMParts(locationId);
    const createdParts: JobPart[] = [];

    // Collect unique equipment IDs from templates and auto-link to job
    const uniqueEquipmentIds = new Set<string>();
    for (const template of pmPartTemplates) {
      if (template.equipmentId) {
        uniqueEquipmentIds.add(template.equipmentId);
      }
    }
    
    // Create JobEquipment entries for each unique equipment
    for (const equipmentId of uniqueEquipmentIds) {
      await this.createJobEquipment(job.id, {
        jobId: job.id,
        equipmentId,
        notes: 'PM visit auto-linked',
      });
    }

    for (const template of pmPartTemplates) {
      const part = this.parts.get(template.productId);
      const description = template.descriptionOverride || part?.name || part?.description || 'Unknown Part';
      
      const jobPart = await this.createJobPart(job.id, {
        jobId: job.id,
        productId: template.productId,
        equipmentId: template.equipmentId || undefined,
        description,
        quantity: template.quantityPerVisit,
        unitPrice: part?.unitPrice || null,
        source: 'pm_template',
        equipmentLabel: template.equipmentLabel,
      });
      createdParts.push(jobPart);
    }

    return { job, parts: createdParts };
  }

  // Location Equipment methods
  async getLocationEquipment(locationId: string): Promise<LocationEquipment[]> {
    return Array.from(this.locationEquipmentMap.values())
      .filter(e => e.locationId === locationId && e.isActive);
  }

  async getLocationEquipmentItem(id: string): Promise<LocationEquipment | undefined> {
    return this.locationEquipmentMap.get(id);
  }

  async createLocationEquipment(locationId: string, data: InsertLocationEquipment): Promise<LocationEquipment> {
    const id = randomUUID();
    const equipment: LocationEquipment = {
      id,
      locationId,
      name: data.name,
      equipmentType: data.equipmentType ?? null,
      manufacturer: data.manufacturer ?? null,
      modelNumber: data.modelNumber ?? null,
      serialNumber: data.serialNumber ?? null,
      tagNumber: data.tagNumber ?? null,
      installDate: data.installDate ?? null,
      warrantyExpiry: data.warrantyExpiry ?? null,
      notes: data.notes ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: null,
    };
    this.locationEquipmentMap.set(id, equipment);
    return equipment;
  }

  async updateLocationEquipment(id: string, data: UpdateLocationEquipment): Promise<LocationEquipment | undefined> {
    const equipment = this.locationEquipmentMap.get(id);
    if (!equipment) return undefined;
    const updated: LocationEquipment = {
      ...equipment,
      ...data,
      updatedAt: new Date(),
    };
    this.locationEquipmentMap.set(id, updated);
    return updated;
  }

  async deleteLocationEquipment(id: string): Promise<boolean> {
    const equipment = this.locationEquipmentMap.get(id);
    if (equipment) {
      const updated = { ...equipment, isActive: false, updatedAt: new Date() };
      this.locationEquipmentMap.set(id, updated);
      return true;
    }
    return false;
  }

  // Job Equipment methods
  async getJobEquipment(jobId: string): Promise<(JobEquipment & { equipment: LocationEquipment })[]> {
    const results: (JobEquipment & { equipment: LocationEquipment })[] = [];
    for (const je of this.jobEquipmentMap.values()) {
      if (je.jobId === jobId) {
        const equipment = this.locationEquipmentMap.get(je.equipmentId);
        if (equipment) {
          results.push({ ...je, equipment });
        }
      }
    }
    return results;
  }

  async createJobEquipment(jobId: string, data: InsertJobEquipment): Promise<JobEquipment> {
    const id = randomUUID();
    const jobEquipment: JobEquipment = {
      id,
      jobId,
      equipmentId: data.equipmentId,
      notes: data.notes ?? null,
      createdAt: new Date(),
      updatedAt: null,
    };
    this.jobEquipmentMap.set(id, jobEquipment);
    return jobEquipment;
  }

  async updateJobEquipment(id: string, data: UpdateJobEquipment): Promise<JobEquipment | undefined> {
    const je = this.jobEquipmentMap.get(id);
    if (!je) return undefined;
    const updated: JobEquipment = {
      ...je,
      ...data,
      updatedAt: new Date(),
    };
    this.jobEquipmentMap.set(id, updated);
    return updated;
  }

  async deleteJobEquipment(id: string): Promise<boolean> {
    return this.jobEquipmentMap.delete(id);
  }

  // Equipment service history
  async getEquipmentServiceHistory(equipmentId: string): Promise<Job[]> {
    const jobIds = new Set<string>();
    for (const je of this.jobEquipmentMap.values()) {
      if (je.equipmentId === equipmentId) {
        jobIds.add(je.jobId);
      }
    }
    return Array.from(this.jobsMap.values())
      .filter(job => jobIds.has(job.id))
      .sort((a, b) => {
        const dateA = a.scheduledStart ? new Date(a.scheduledStart).getTime() : 0;
        const dateB = b.scheduledStart ? new Date(b.scheduledStart).getTime() : 0;
        return dateB - dateA;
      });
  }

  // Job Template methods - MemStorage stubs (not implemented for in-memory storage)
  async getJobTemplates(_companyId: string, _filter?: { jobType?: string; activeOnly?: boolean }): Promise<JobTemplate[]> {
    return [];
  }
  async getJobTemplate(_companyId: string, _id: string): Promise<JobTemplate | undefined> {
    return undefined;
  }
  async getJobTemplateLineItems(_templateId: string): Promise<JobTemplateLineItem[]> {
    return [];
  }
  async createJobTemplate(_companyId: string, _data: InsertJobTemplate, _lines: Omit<InsertJobTemplateLineItem, 'templateId'>[]): Promise<JobTemplate> {
    throw new Error("Job templates not implemented in MemStorage");
  }
  async updateJobTemplate(_companyId: string, _id: string, _data: UpdateJobTemplate, _lines?: Omit<InsertJobTemplateLineItem, 'templateId'>[]): Promise<JobTemplate | undefined> {
    return undefined;
  }
  async deleteJobTemplate(_companyId: string, _id: string): Promise<boolean> {
    return false;
  }
  async setJobTemplateAsDefault(_companyId: string, _id: string, _jobType: string): Promise<JobTemplate | undefined> {
    return undefined;
  }
  async getDefaultJobTemplateForJobType(_companyId: string, _jobType: string): Promise<JobTemplate | undefined> {
    return undefined;
  }
  async applyJobTemplateToJob(_companyId: string, _jobId: string, _templateId: string): Promise<JobPart[]> {
    return [];
  }
}

import { db } from './db';
import { users, clients, parts as partsTable, clientParts, maintenanceRecords, passwordResetTokens, equipment, companySettings, calendarAssignments, feedback, invitationTokens, companies, jobNotes, clientNotes, companyCounters } from '@shared/schema';
import { eq, and, desc, inArray, sql, or, lt } from 'drizzle-orm';

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

  async deleteUser(id: string, requesterCompanyId?: string): Promise<boolean> {
    // Validate company membership if requesterCompanyId is provided
    if (requesterCompanyId) {
      const user = await this.getUser(id);
      if (user && user.companyId !== requesterCompanyId) {
        throw new Error("Cannot delete user from another company");
      }
    }
    
    // Foreign key constraints with ON DELETE CASCADE will automatically delete
    // all user data (clients, parts, client_parts, maintenance_records)
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async updateUserRole(id: string, role: string, requesterCompanyId?: string): Promise<void> {
    // Validate company membership if requesterCompanyId is provided
    if (requesterCompanyId) {
      const user = await this.getUser(id);
      if (user && user.companyId !== requesterCompanyId) {
        throw new Error("Cannot update user from another company");
      }
    }
    
    await db.update(users).set({ role }).where(eq(users.id, id));
  }

  async validateUserInCompany(userId: string, companyId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return user?.companyId === companyId;
  }

  async getUsersByCompanyId(companyId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.companyId, companyId));
  }

  async updateUserTrialDate(id: string, trialEndsAt: Date): Promise<void> {
    // Get user's companyId first
    const user = await this.getUser(id);
    if (user && user.companyId) {
      await db.update(companies).set({ trialEndsAt }).where(eq(companies.id, user.companyId));
    }
  }

  async updateUserStripeCustomer(id: string, stripeCustomerId: string): Promise<void> {
    // Get user's companyId first
    const user = await this.getUser(id);
    if (user && user.companyId) {
      await db.update(companies).set({ stripeCustomerId }).where(eq(companies.id, user.companyId));
    }
  }

  async updateCompanyTrial(companyId: string, trialEndsAt: Date, requesterCompanyId?: string): Promise<void> {
    // Validate company membership if requesterCompanyId is provided
    if (requesterCompanyId && companyId !== requesterCompanyId) {
      throw new Error("Cannot update trial for another company");
    }
    await db.update(companies).set({ trialEndsAt }).where(eq(companies.id, companyId));
  }

  async updateCompanyStripeCustomer(companyId: string, stripeCustomerId: string, requesterCompanyId?: string): Promise<void> {
    // Validate company membership if requesterCompanyId is provided
    if (requesterCompanyId && companyId !== requesterCompanyId) {
      throw new Error("Cannot update Stripe customer for another company");
    }
    await db.update(companies).set({ stripeCustomerId }).where(eq(companies.id, companyId));
  }

  async getTechniciansByCompanyId(companyId: string): Promise<User[]> {
    return db.select().from(users).where(and(eq(users.companyId, companyId), eq(users.role, "technician")));
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
  async getClient(companyId: string, id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.companyId, companyId))).limit(1);
    return result[0];
  }

  async getAllClients(companyId: string): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.companyId, companyId)).orderBy(desc(clients.createdAt));
  }

  async getClientsByParentCompany(companyId: string, parentCompanyId: string): Promise<Client[]> {
    return db.select()
      .from(clients)
      .where(
        and(
          eq(clients.companyId, companyId),
          eq(clients.parentCompanyId, parentCompanyId)
        )
      )
      .orderBy(clients.companyName);
  }

  async createClient(companyId: string, userId: string, insertClient: InsertClient): Promise<Client> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    const result = await db.insert(clients).values({ ...insertClient, companyId, userId }).returning();
    return result[0];
  }

  async createClientWithParts(companyId: string, userId: string, insertClient: InsertClient, partsList: Array<{ partId: string; quantity: number }>): Promise<Client> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    return await db.transaction(async (tx) => {
      // Validate all parts exist and belong to company
      for (const partItem of partsList) {
        const existingPart = await tx.select().from(parts).where(
          and(eq(parts.id, partItem.partId), eq(parts.companyId, companyId))
        ).limit(1);
        
        if (!existingPart || existingPart.length === 0) {
          throw new Error(`Part with ID ${partItem.partId} not found or does not belong to company`);
        }
      }
      
      // Create the client
      const clientResult = await tx.insert(clients).values({ ...insertClient, companyId, userId }).returning();
      const client = clientResult[0];
      
      // Bulk insert all client-part associations
      if (partsList.length > 0) {
        await tx.insert(clientParts).values(
          partsList.map(partItem => ({
            clientId: client.id,
            partId: partItem.partId,
            quantity: partItem.quantity,
            companyId,
            userId
          }))
        );
      }
      
      return client;
    });
  }

  async updateClient(companyId: string, id: string, clientUpdate: Partial<InsertClient>): Promise<Client | undefined> {
    const result = await db.update(clients).set(clientUpdate).where(and(eq(clients.id, id), eq(clients.companyId, companyId))).returning();
    return result[0];
  }

  async deleteClient(companyId: string, id: string): Promise<boolean> {
    // Foreign key constraints with ON DELETE CASCADE will automatically delete
    // client_parts and maintenance_records, but we keep manual deletes as defensive fallback
    await this.deleteAllClientParts(companyId, id);
    await db.delete(maintenanceRecords).where(and(eq(maintenanceRecords.clientId, id), eq(maintenanceRecords.companyId, companyId)));
    const result = await db.delete(clients).where(and(eq(clients.id, id), eq(clients.companyId, companyId))).returning();
    return result.length > 0;
  }

  async deleteClients(companyId: string, ids: string[]): Promise<{ deletedIds: string[]; notFoundIds: string[] }> {
    const deletedIds: string[] = [];
    const notFoundIds: string[] = [];

    // Verify all IDs belong to the company first
    const clientChecks = await Promise.all(
      ids.map(id => this.getClient(companyId, id))
    );
    
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const existing = clientChecks[i];
      
      if (!existing) {
        notFoundIds.push(id);
        continue;
      }

      // Delete associated data (foreign key cascades should handle this, but being defensive)
      await this.deleteAllClientParts(companyId, id);
      await db.delete(maintenanceRecords).where(and(eq(maintenanceRecords.clientId, id), eq(maintenanceRecords.companyId, companyId)));
      await db.delete(equipment).where(and(eq(equipment.clientId, id), eq(equipment.companyId, companyId)));

      // Delete the client
      const result = await db.delete(clients).where(and(eq(clients.id, id), eq(clients.companyId, companyId))).returning();
      if (result.length > 0) {
        deletedIds.push(id);
      }
    }

    return { deletedIds, notFoundIds };
  }

  // Part methods
  async getPart(companyId: string, id: string): Promise<Part | undefined> {
    const result = await db.select().from(parts).where(and(eq(parts.id, id), eq(parts.companyId, companyId))).limit(1);
    return result[0];
  }

  async getAllParts(companyId: string): Promise<Part[]> {
    return db.select().from(parts).where(eq(parts.companyId, companyId)).orderBy(desc(parts.createdAt));
  }

  async getPartsByType(companyId: string, type: string): Promise<Part[]> {
    return db.select().from(parts).where(and(eq(parts.companyId, companyId), eq(parts.type, type)));
  }

  async getPartBySku(companyId: string, sku: string): Promise<Part | undefined> {
    const result = await db.select().from(parts)
      .where(and(eq(parts.companyId, companyId), eq(parts.sku, sku)))
      .limit(1);
    return result[0];
  }

  async getPartsPaginated(companyId: string, options: { 
    limit?: number; 
    offset?: number; 
    type?: string; 
    search?: string; 
    isActive?: boolean; 
    category?: string;
  }): Promise<{ items: Part[]; total: number; hasMore: boolean }> {
    const { limit = 50, offset = 0, type, search, isActive, category } = options;
    
    const conditions = [eq(parts.companyId, companyId)];
    
    if (type) {
      conditions.push(eq(parts.type, type));
    }
    
    if (isActive !== undefined) {
      conditions.push(eq(parts.isActive, isActive));
    }
    
    if (category) {
      conditions.push(eq(parts.category, category));
    }
    
    if (search) {
      const lowerSearch = search.toLowerCase();
      conditions.push(sql`(
        LOWER(${parts.name}) LIKE ${`%${lowerSearch}%`} OR 
        LOWER(${parts.sku}) LIKE ${`%${lowerSearch}%`} OR 
        LOWER(${parts.description}) LIKE ${`%${lowerSearch}%`}
      )`);
    }
    
    const whereClause = and(...conditions);
    
    const [countResult, items] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(parts).where(whereClause),
      db.select().from(parts).where(whereClause).orderBy(desc(parts.createdAt)).limit(limit).offset(offset)
    ]);
    
    const total = Number(countResult[0]?.count ?? 0);
    
    return { items, total, hasMore: offset + limit < total };
  }

  async findDuplicatePart(companyId: string, insertPart: InsertPart): Promise<Part | undefined> {
    if (insertPart.type === 'filter') {
      const result = await db.select().from(parts)
        .where(and(
          eq(parts.companyId, companyId),
          eq(parts.type, 'filter'),
          eq(parts.filterType, insertPart.filterType ?? ''),
          eq(parts.size, insertPart.size ?? '')
        ))
        .limit(1);
      return result[0];
    } else if (insertPart.type === 'belt') {
      const result = await db.select().from(parts)
        .where(and(
          eq(parts.companyId, companyId),
          eq(parts.type, 'belt'),
          eq(parts.beltType, insertPart.beltType ?? ''),
          eq(parts.size, insertPart.size ?? '')
        ))
        .limit(1);
      return result[0];
    } else if (insertPart.type === 'other' || insertPart.type === 'service' || insertPart.type === 'product') {
      const result = await db.select().from(parts)
        .where(and(
          eq(parts.companyId, companyId),
          eq(parts.type, insertPart.type),
          eq(parts.name, insertPart.name ?? '')
        ))
        .limit(1);
      return result[0];
    }
    return undefined;
  }

  async createPart(companyId: string, userId: string, insertPart: InsertPart): Promise<Part> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    const result = await db.insert(parts).values({ ...insertPart, companyId, userId }).returning();
    return result[0];
  }

  async updatePart(companyId: string, id: string, partUpdate: Partial<InsertPart>): Promise<Part | undefined> {
    const result = await db.update(parts).set(partUpdate).where(and(eq(parts.id, id), eq(parts.companyId, companyId))).returning();
    return result[0];
  }

  async deletePart(companyId: string, id: string): Promise<boolean> {
    await db.delete(clientParts).where(and(eq(clientParts.partId, id), eq(clientParts.companyId, companyId)));
    const result = await db.delete(parts).where(and(eq(parts.id, id), eq(parts.companyId, companyId))).returning();
    return result.length > 0;
  }

  async deleteParts(companyId: string, ids: string[]): Promise<{ deletedIds: string[]; notFoundIds: string[] }> {
    const deletedIds: string[] = [];
    const notFoundIds: string[] = [];

    // Verify all IDs belong to the company first
    const partChecks = await Promise.all(
      ids.map(id => this.getPart(companyId, id))
    );
    
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const existing = partChecks[i];
      
      if (!existing) {
        notFoundIds.push(id);
        continue;
      }

      // Delete all client-part associations
      await db.delete(clientParts).where(and(eq(clientParts.partId, id), eq(clientParts.companyId, companyId)));

      // Delete the part
      const result = await db.delete(parts).where(and(eq(parts.id, id), eq(parts.companyId, companyId))).returning();
      if (result.length > 0) {
        deletedIds.push(id);
      }
    }

    return { deletedIds, notFoundIds };
  }

  async seedUserParts(companyId: string, userId: string): Promise<void> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    const allSeedParts = [...STANDARD_FILTERS, ...STANDARD_BELTS];
    
    for (const partData of allSeedParts) {
      const existingPart = await this.findDuplicatePart(companyId, partData);
      
      if (!existingPart) {
        await this.createPart(companyId, userId, partData);
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
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    // Verify that the client belongs to the companyId
    const client = await db.select().from(clients).where(and(eq(clients.id, insertClientPart.clientId), eq(clients.companyId, companyId))).limit(1);
    if (!client || client.length === 0) {
      throw new Error("Client not found or does not belong to company");
    }
    
    // Verify that the part belongs to the companyId
    const part = await db.select().from(parts).where(and(eq(parts.id, insertClientPart.partId), eq(parts.companyId, companyId))).limit(1);
    if (!part || part.length === 0) {
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

  async getPartsReportByMonth(companyId: string, month: number, outstandingOnly = false): Promise<Array<{ part: Part; totalQuantity: number }>> {
    const clientsWithMaintenance = await db.select()
      .from(clients)
      .where(and(
        eq(clients.companyId, companyId),
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
          eq(maintenanceRecords.companyId, companyId),
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
        eq(clientParts.companyId, companyId)
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
  async getMaintenanceRecord(companyId: string, clientId: string, dueDate: string): Promise<MaintenanceRecord | undefined> {
    const result = await db.select()
      .from(maintenanceRecords)
      .where(and(
        eq(maintenanceRecords.companyId, companyId),
        eq(maintenanceRecords.clientId, clientId),
        eq(maintenanceRecords.dueDate, dueDate)
      ))
      .limit(1);
    return result[0];
  }

  async getLatestCompletedMaintenanceRecord(companyId: string, clientId: string): Promise<MaintenanceRecord | undefined> {
    const result = await db.select()
      .from(maintenanceRecords)
      .where(and(
        eq(maintenanceRecords.companyId, companyId),
        eq(maintenanceRecords.clientId, clientId),
        sql`${maintenanceRecords.completedAt} IS NOT NULL`
      ))
      .orderBy(desc(maintenanceRecords.completedAt))
      .limit(1);
    return result[0];
  }

  async getAllLatestCompletedMaintenanceRecords(companyId: string): Promise<Record<string, MaintenanceRecord>> {
    // Use a window function to get the latest completed record for each client
    const records = await db.execute<MaintenanceRecord>(sql`
      WITH ranked_records AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY completed_at DESC) as rn
        FROM maintenance_records
        WHERE company_id = ${companyId}
          AND completed_at IS NOT NULL
      )
      SELECT id, company_id, user_id, client_id, due_date, completed_at
      FROM ranked_records
      WHERE rn = 1
    `);
    
    const result: Record<string, MaintenanceRecord> = {};
    for (const record of records.rows as any[]) {
      result[record.client_id] = {
        id: record.id,
        companyId: record.company_id,
        userId: record.user_id,
        clientId: record.client_id,
        dueDate: record.due_date,
        completedAt: record.completed_at,
      };
    }
    
    return result;
  }

  async getRecentlyCompletedMaintenance(companyId: string, month: number, year: number): Promise<MaintenanceRecord[]> {
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    
    return db.select()
      .from(maintenanceRecords)
      .where(and(
        eq(maintenanceRecords.companyId, companyId),
        sql`${maintenanceRecords.completedAt} IS NOT NULL`,
        sql`${maintenanceRecords.completedAt} >= ${startDate}`,
        sql`${maintenanceRecords.completedAt} <= ${endDate}`
      ))
      .orderBy(desc(maintenanceRecords.completedAt));
  }

  async getCompletedUnscheduledMaintenance(companyId: string): Promise<MaintenanceRecord[]> {
    const completedRecords = await db.select()
      .from(maintenanceRecords)
      .where(and(
        eq(maintenanceRecords.companyId, companyId),
        sql`${maintenanceRecords.completedAt} IS NOT NULL`
      ))
      .orderBy(desc(maintenanceRecords.completedAt));
    
    const result = [];
    for (const record of completedRecords) {
      const dueDate = new Date(record.dueDate);
      const year = dueDate.getFullYear();
      const month = dueDate.getMonth() + 1;
      
      // Check if there was a calendar assignment for this client in this month
      const assignment = await this.getClientCalendarAssignment(companyId, record.clientId, year, month);
      if (!assignment) {
        result.push(record);
      }
    }
    
    return result;
  }

  async createMaintenanceRecord(companyId: string, userId: string, insertRecord: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    // Verify that the client belongs to the company
    const client = await this.getClient(companyId, insertRecord.clientId);
    if (!client) {
      throw new Error("Client not found or does not belong to company");
    }
    
    const result = await db.insert(maintenanceRecords).values({ ...insertRecord, companyId, userId }).returning();
    return result[0];
  }

  async updateMaintenanceRecord(companyId: string, id: string, recordUpdate: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined> {
    const result = await db.update(maintenanceRecords).set(recordUpdate).where(and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.companyId, companyId))).returning();
    return result[0];
  }

  async deleteMaintenanceRecord(companyId: string, id: string): Promise<boolean> {
    const result = await db.delete(maintenanceRecords).where(and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.companyId, companyId))).returning();
    return result.length > 0;
  }

  // Equipment methods
  async getAllEquipment(companyId: string): Promise<Equipment[]> {
    return db.select()
      .from(equipment)
      .where(eq(equipment.companyId, companyId))
      .orderBy(equipment.createdAt);
  }

  async getClientEquipment(companyId: string, clientId: string): Promise<Equipment[]> {
    return db.select()
      .from(equipment)
      .where(and(
        eq(equipment.companyId, companyId),
        eq(equipment.clientId, clientId)
      ))
      .orderBy(equipment.createdAt);
  }

  async getEquipment(companyId: string, id: string): Promise<Equipment | undefined> {
    const result = await db.select()
      .from(equipment)
      .where(and(eq(equipment.id, id), eq(equipment.companyId, companyId)))
      .limit(1);
    return result[0];
  }

  async createEquipment(companyId: string, userId: string, insertEquipment: InsertEquipment): Promise<Equipment> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    // Verify that the client belongs to the company
    const client = await this.getClient(companyId, insertEquipment.clientId);
    if (!client) {
      throw new Error("Client not found or does not belong to company");
    }
    
    const result = await db.insert(equipment).values({ ...insertEquipment, companyId, userId }).returning();
    return result[0];
  }

  async updateEquipment(companyId: string, id: string, equipmentUpdate: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const result = await db.update(equipment).set(equipmentUpdate).where(and(eq(equipment.id, id), eq(equipment.companyId, companyId))).returning();
    return result[0];
  }

  async deleteEquipment(companyId: string, id: string): Promise<boolean> {
    const result = await db.delete(equipment).where(and(eq(equipment.id, id), eq(equipment.companyId, companyId))).returning();
    return result.length > 0;
  }

  async deleteAllClientEquipment(companyId: string, clientId: string): Promise<void> {
    await db.delete(equipment).where(and(eq(equipment.companyId, companyId), eq(equipment.clientId, clientId)));
  }

  async getClientReport(companyId: string, clientId: string): Promise<{ client: Client; parts: (ClientPart & { part: Part })[]; equipment: Equipment[] } | null> {
    const client = await this.getClient(companyId, clientId);
    if (!client) {
      return null;
    }

    const parts = await this.getClientParts(companyId, clientId);
    const equip = await this.getClientEquipment(companyId, clientId);

    return {
      client,
      parts,
      equipment: equip
    };
  }

  // Company settings methods
  async getCompanySettings(companyId: string): Promise<CompanySettings | undefined> {
    const result = await db.select()
      .from(companySettings)
      .where(eq(companySettings.companyId, companyId))
      .limit(1);
    return result[0];
  }

  async upsertCompanySettings(companyId: string, userId: string, settings: InsertCompanySettings): Promise<CompanySettings> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    const existing = await this.getCompanySettings(companyId);
    
    if (existing) {
      const result = await db.update(companySettings)
        .set({ ...settings, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(companySettings.companyId, companyId))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(companySettings)
        .values({ ...settings, companyId, userId })
        .returning();
      return result[0];
    }
  }

  // Calendar assignment methods
  async getCalendarAssignments(companyId: string, year: number, month: number, assignedTechnicianId?: string): Promise<CalendarAssignment[]> {
    // Validate that the technician belongs to the company if provided
    if (assignedTechnicianId) {
      const isValid = await this.validateUserInCompany(assignedTechnicianId, companyId);
      if (!isValid) {
        throw new Error("Technician does not belong to this company");
      }
    }
    
    const conditions = [
      eq(calendarAssignments.companyId, companyId),
      eq(calendarAssignments.year, year),
      eq(calendarAssignments.month, month)
    ];
    
    // Get all assignments for the company/year/month first
    const allAssignments = await db.select()
      .from(calendarAssignments)
      .where(and(...conditions));
    
    // Filter by assignedTechnicianId in JavaScript if provided
    // (array contains check is more reliable in JS than SQL for this case)
    if (assignedTechnicianId) {
      return allAssignments.filter(assignment => 
        assignment.assignedTechnicianIds?.includes(assignedTechnicianId)
      );
    }
    
    return allAssignments;
  }

  async getAllCalendarAssignments(companyId: string): Promise<CalendarAssignment[]> {
    return await db.select()
      .from(calendarAssignments)
      .where(eq(calendarAssignments.companyId, companyId));
  }

  async getAssignmentsByClient(companyId: string, clientId: string): Promise<CalendarAssignment[]> {
    return await db.select()
      .from(calendarAssignments)
      .where(
        and(
          eq(calendarAssignments.companyId, companyId),
          eq(calendarAssignments.clientId, clientId)
        )
      )
      .orderBy(desc(calendarAssignments.year), desc(calendarAssignments.month), desc(calendarAssignments.day));
  }

  async getAssignmentsByParentCompany(companyId: string, parentCompanyId: string, locationId?: string): Promise<CalendarAssignment[]> {
    const locationIds = locationId 
      ? [locationId]
      : (await db.select({ id: clients.id })
          .from(clients)
          .where(
            and(
              eq(clients.companyId, companyId),
              eq(clients.parentCompanyId, parentCompanyId)
            )
          )).map(l => l.id);
    
    if (locationIds.length === 0) return [];

    return await db.select()
      .from(calendarAssignments)
      .where(
        and(
          eq(calendarAssignments.companyId, companyId),
          inArray(calendarAssignments.clientId, locationIds)
        )
      )
      .orderBy(desc(calendarAssignments.year), desc(calendarAssignments.month), desc(calendarAssignments.day));
  }

  async getAllCalendarAssignmentsPaginated(companyId: string, options: { limit?: number; offset?: number; status?: string; search?: string }): Promise<{ assignments: CalendarAssignment[]; total: number; hasMore: boolean }> {
    const { limit, offset = 0 } = options;
    
    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(calendarAssignments)
      .where(eq(calendarAssignments.companyId, companyId));
    const total = Number(countResult[0]?.count || 0);
    
    // Build query with pagination
    let query = db.select()
      .from(calendarAssignments)
      .where(eq(calendarAssignments.companyId, companyId))
      .orderBy(desc(calendarAssignments.scheduledDate), desc(calendarAssignments.year), desc(calendarAssignments.month));
    
    if (limit !== undefined) {
      query = query.limit(limit).offset(offset) as typeof query;
    }
    
    const assignments = await query;
    
    return {
      assignments,
      total,
      hasMore: limit !== undefined ? offset + assignments.length < total : false
    };
  }

  async getCalendarAssignment(companyId: string, id: string): Promise<CalendarAssignment | undefined> {
    const result = await db.select()
      .from(calendarAssignments)
      .where(and(eq(calendarAssignments.id, id), eq(calendarAssignments.companyId, companyId)))
      .limit(1);
    return result[0];
  }

  async createCalendarAssignment(companyId: string, userId: string, insertAssignment: InsertCalendarAssignment): Promise<CalendarAssignment> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }
    
    // Verify that the client belongs to the company
    const client = await this.getClient(companyId, insertAssignment.clientId);
    if (!client) {
      throw new Error("Client not found or does not belong to company");
    }
    
    // Use transaction to ensure atomic job number generation and assignment creation
    // This prevents gaps in job numbers if the insert fails
    return await db.transaction(async (tx) => {
      // Get next job number atomically using upsert
      const counterResult = await tx.insert(companyCounters)
        .values({ companyId, nextJobNumber: 10001 })
        .onConflictDoUpdate({
          target: companyCounters.companyId,
          set: { nextJobNumber: sql`${companyCounters.nextJobNumber} + 1` }
        })
        .returning();
      
      // The job number is the value before increment (nextJobNumber - 1 after the update, or 10000 for new)
      let jobNumber: number;
      if (counterResult[0]) {
        // If we just created the counter, job number is 10000; otherwise it's the pre-increment value
        const currentNext = counterResult[0].nextJobNumber;
        jobNumber = currentNext - 1; // The job number is the value we just "consumed"
      } else {
        // Fallback: get current max and use next
        const maxResult = await tx.select({ max: sql<number>`COALESCE(MAX(job_number), 9999)` })
          .from(calendarAssignments)
          .where(eq(calendarAssignments.companyId, companyId));
        jobNumber = (maxResult[0]?.max || 9999) + 1;
      }
      
      const result = await tx.insert(calendarAssignments).values({ 
        ...insertAssignment, 
        companyId, 
        userId,
        jobNumber 
      }).returning();
      return result[0];
    });
  }

  async updateCalendarAssignment(companyId: string, id: string, assignmentUpdate: UpdateCalendarAssignment): Promise<CalendarAssignment | undefined> {
    // Build update object with only provided fields
    const updateFields: Partial<Pick<CalendarAssignment, 'year' | 'month' | 'day' | 'scheduledDate' | 'scheduledHour' | 'autoDueDate' | 'completed' | 'assignedTechnicianIds' | 'completionNotes'>> = {};
    if (assignmentUpdate.year !== undefined) updateFields.year = assignmentUpdate.year;
    if (assignmentUpdate.month !== undefined) updateFields.month = assignmentUpdate.month;
    if (assignmentUpdate.day !== undefined) updateFields.day = assignmentUpdate.day;
    if (assignmentUpdate.scheduledDate !== undefined && assignmentUpdate.scheduledDate !== null) updateFields.scheduledDate = assignmentUpdate.scheduledDate;
    if (assignmentUpdate.scheduledHour !== undefined) updateFields.scheduledHour = assignmentUpdate.scheduledHour;
    if (assignmentUpdate.autoDueDate !== undefined) updateFields.autoDueDate = assignmentUpdate.autoDueDate;
    if (assignmentUpdate.completed !== undefined) updateFields.completed = assignmentUpdate.completed;
    if (assignmentUpdate.assignedTechnicianIds !== undefined) updateFields.assignedTechnicianIds = assignmentUpdate.assignedTechnicianIds;
    if (assignmentUpdate.completionNotes !== undefined) updateFields.completionNotes = assignmentUpdate.completionNotes;
    
    const result = await db.update(calendarAssignments)
      .set(updateFields)
      .where(and(eq(calendarAssignments.id, id), eq(calendarAssignments.companyId, companyId)))
      .returning();
    return result[0];
  }

  async getTechnicianTodayAssignments(technicianId: string): Promise<Array<{ id: string; client: Client; assignment: CalendarAssignment }>> {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    
    const assignments = await db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.year, year),
        eq(calendarAssignments.month, month),
        eq(calendarAssignments.day, day),
        eq(calendarAssignments.completed, false)
      ));

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
        // Get client by companyId and clientId directly from database
        const client = await db.select()
          .from(clients)
          .where(and(
            eq(clients.companyId, assignment.companyId),
            eq(clients.id, assignment.clientId)
          ))
          .limit(1);
        
        if (client && client.length > 0) {
          result.push({ id: assignment.id, client: client[0], assignment });
        }
      }
    }
    return result;
  }

  async deleteCalendarAssignment(companyId: string, id: string): Promise<boolean> {
    const result = await db.delete(calendarAssignments)
      .where(and(eq(calendarAssignments.id, id), eq(calendarAssignments.companyId, companyId)))
      .returning();
    return result.length > 0;
  }

  async getClientCalendarAssignment(companyId: string, clientId: string, year: number, month: number): Promise<CalendarAssignment | undefined> {
    const result = await db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.companyId, companyId),
        eq(calendarAssignments.clientId, clientId),
        eq(calendarAssignments.year, year),
        eq(calendarAssignments.month, month)
      ))
      .limit(1);
    return result[0];
  }

  async getUnscheduledClients(companyId: string, year: number, month: number): Promise<Client[]> {
    const monthIndex = month - 1; // Convert to 0-indexed
    
    // Get all assignments for this month
    const assignments = await db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.companyId, companyId),
        eq(calendarAssignments.year, year),
        eq(calendarAssignments.month, month)
      ));
    
    // Only consider clients with a specific day as "scheduled"
    // Clients with day = null still need to appear in the unscheduled panel
    const scheduledClientIds = new Set(
      assignments
        .filter(a => a.day !== null && !a.completed)
        .map(a => a.clientId)
    );
    
    // Track clients that have unscheduled assignments (day = null)
    const unscheduledAssignmentClientIds = new Set(
      assignments
        .filter(a => a.day === null && !a.completed)
        .map(a => a.clientId)
    );
    
    // Get all clients for this company
    const allClients = await db.select()
      .from(clients)
      .where(eq(clients.companyId, companyId));
    
    // Filter clients
    const unscheduled: Client[] = [];
    
    for (const client of allClients) {
      // Exclude inactive clients
      if (client.inactive) continue;
      
      // Exclude clients already scheduled with a specific day
      if (scheduledClientIds.has(client.id)) continue;
      
      // Include clients that have unscheduled assignments (day = null)
      if (unscheduledAssignmentClientIds.has(client.id)) {
        unscheduled.push(client);
        continue;
      }
      
      // Exclude clients not scheduled for this month (and don't have an unscheduled assignment)
      if (!client.selectedMonths?.includes(monthIndex)) continue;
      
      // Check if maintenance is completed for this month
      const latestRecord = await db.select()
        .from(maintenanceRecords)
        .where(and(
          eq(maintenanceRecords.companyId, companyId),
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

  async getAllUnscheduledAssignments(companyId: string): Promise<Array<{ client: Client; assignment: CalendarAssignment }>> {
    // Get all unscheduled assignments (day = null, completed = false)
    const assignments = await db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.companyId, companyId),
        eq(calendarAssignments.completed, false),
        sql`${calendarAssignments.day} IS NULL`
      ))
      .orderBy(calendarAssignments.year, calendarAssignments.month);
    
    // Get client data for each assignment
    const result: Array<{ client: Client; assignment: CalendarAssignment }> = [];
    
    for (const assignment of assignments) {
      const client = await db.select()
        .from(clients)
        .where(and(
          eq(clients.id, assignment.clientId),
          eq(clients.companyId, companyId)
        ))
        .limit(1);
      
      // Only include if client exists and is not inactive
      if (client.length > 0 && !client[0].inactive) {
        result.push({ client: client[0], assignment });
      }
    }
    
    return result;
  }

  async getAllUnscheduledBacklog(companyId: string): Promise<Array<{ 
    id: string;
    clientId: string;
    companyName: string;
    location: string | null;
    month: number;
    year: number;
    assignmentId: string | null;
    status: 'existing' | 'missing';
  }>> {
    const allClients = await this.getAllClients(companyId);
    const allAssignments = await db.select()
      .from(calendarAssignments)
      .where(eq(calendarAssignments.companyId, companyId));
    
    const result: Array<{ 
      id: string;
      clientId: string;
      companyName: string;
      location: string | null;
      month: number;
      year: number;
      assignmentId: string | null;
      status: 'existing' | 'missing';
    }> = [];
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Calculate month boundaries (prev, current, next)
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    
    // Helper to check if a year/month is within our 3-month window (prev, current, next)
    const isWithinWindow = (year: number, month: number): boolean => {
      // Previous month
      if (year === prevMonthYear && month === prevMonth) return true;
      // Current month
      if (year === currentYear && month === currentMonth) return true;
      // Next month
      if (year === nextMonthYear && month === nextMonth) return true;
      return false;
    };
    
    // 1. Add all day=null incomplete assignments that are within our window (existing unscheduled)
    for (const assignment of allAssignments) {
      if (assignment.day === null && !assignment.completed) {
        // Only include if within our 3-month window
        if (!isWithinWindow(assignment.year, assignment.month)) continue;
        
        const client = allClients.find(c => c.id === assignment.clientId);
        if (client && !client.inactive) {
          result.push({
            id: assignment.id,
            clientId: client.id,
            companyName: client.companyName,
            location: client.location,
            month: assignment.month,
            year: assignment.year,
            assignmentId: assignment.id,
            status: 'existing'
          });
        }
      }
    }
    
    // 2. Find clients missing assignments for their selected months
    // Only include: previous month, current month, and next month
    for (const client of allClients) {
      if (client.inactive) continue;
      if (!client.selectedMonths || client.selectedMonths.length === 0) continue;
      
      for (const monthIndex of client.selectedMonths) {
        const month = monthIndex + 1; // Convert 0-indexed to 1-indexed
        
        // Only include previous month, current month, and next month
        const isPrevMonth = month === prevMonth;
        const isCurrentMonth = month === currentMonth;
        const isNextMonth = month === nextMonth;
        
        if (!isPrevMonth && !isCurrentMonth && !isNextMonth) {
          continue;
        }
        
        // Determine target year based on which month bucket
        let targetYear = currentYear;
        if (isPrevMonth) {
          targetYear = prevMonthYear;
        } else if (isNextMonth) {
          targetYear = nextMonthYear;
        }
        
        // Check if assignment exists for this client/year/month (any assignment, including completed)
        const existingAssignment = allAssignments.find(a => 
          a.clientId === client.id && 
          a.year === targetYear && 
          a.month === month
        );
        
        // If no assignment exists, add as "missing"
        if (!existingAssignment) {
          result.push({
            id: `${client.id}:${targetYear}-${month}`,
            clientId: client.id,
            companyName: client.companyName,
            location: client.location,
            month: month,
            year: targetYear,
            assignmentId: null,
            status: 'missing'
          });
        }
      }
    }
    
    // Sort by year, then month
    return result.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }

  async getPastIncompleteAssignments(companyId: string): Promise<CalendarAssignment[]> {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-indexed
    
    // Get all incomplete assignments from past months
    const result = await db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.companyId, companyId),
        eq(calendarAssignments.completed, false),
        or(
          lt(calendarAssignments.year, currentYear),
          and(
            eq(calendarAssignments.year, currentYear),
            lt(calendarAssignments.month, currentMonth)
          )
        )
      ));
    
    return result;
  }
  
  // Get old unscheduled assignments (older than previous month) that need user action
  async getOldUnscheduledAssignments(companyId: string): Promise<CalendarAssignment[]> {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-indexed
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    // Get all incomplete unscheduled assignments older than previous month
    const result = await db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.companyId, companyId),
        eq(calendarAssignments.completed, false),
        sql`${calendarAssignments.day} IS NULL`,
        or(
          lt(calendarAssignments.year, prevMonthYear),
          and(
            eq(calendarAssignments.year, prevMonthYear),
            lt(calendarAssignments.month, prevMonth)
          )
        )
      ));
    
    return result;
  }

  async cleanupInvalidCalendarAssignments(companyId: string, clientId: string, validMonths: number[]): Promise<{ removedCount: number }> {
    // Get all calendar assignments for this client
    const allAssignments = await db.select()
      .from(calendarAssignments)
      .where(and(
        eq(calendarAssignments.companyId, companyId),
        eq(calendarAssignments.clientId, clientId)
      ));
    
    if (allAssignments.length === 0) {
      return { removedCount: 0 };
    }
    
    // Get all completed maintenance records for this client
    const completedRecords = await db.select()
      .from(maintenanceRecords)
      .where(and(
        eq(maintenanceRecords.companyId, companyId),
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
            eq(calendarAssignments.companyId, companyId),
            sql`${calendarAssignments.id} IN (${sql.join(assignmentsToRemove.map(id => sql`${id}`), sql`, `)})`
          )
        );
    }
    
    return { removedCount: assignmentsToRemove.length };
  }

  async createFeedback(companyId: string, userId: string, userEmail: string, feedbackData: InsertFeedback): Promise<Feedback> {
    const result = await db.insert(feedback).values({
      companyId,
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

  async getCompanyFeedback(companyId: string): Promise<Feedback[]> {
    return db.select()
      .from(feedback)
      .where(eq(feedback.companyId, companyId))
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

  async getAllCompanies(): Promise<any[]> {
    return db.select().from(companies);
  }

  async updateCompany(companyId: string, updates: Partial<any>): Promise<void> {
    await db.update(companies).set(updates).where(eq(companies.id, companyId));
  }

  async getEquipmentByClient(companyId: string, clientId: string): Promise<any[]> {
    const result = await db.select()
      .from(equipment)
      .where(and(eq(equipment.companyId, companyId), eq(equipment.clientId, clientId)));
    return result;
  }

  // Job notes methods
  async getJobNotes(companyId: string, assignmentId: string): Promise<JobNote[]> {
    return db.select()
      .from(jobNotes)
      .where(and(eq(jobNotes.companyId, companyId), eq(jobNotes.assignmentId, assignmentId)))
      .orderBy(desc(jobNotes.createdAt));
  }

  async getJobNote(companyId: string, id: string): Promise<JobNote | undefined> {
    const result = await db.select()
      .from(jobNotes)
      .where(and(eq(jobNotes.id, id), eq(jobNotes.companyId, companyId)))
      .limit(1);
    return result[0];
  }

  async createJobNote(companyId: string, userId: string, note: InsertJobNote): Promise<JobNote> {
    const result = await db.insert(jobNotes).values({
      companyId,
      userId,
      assignmentId: note.assignmentId,
      noteText: note.noteText,
      imageUrl: note.imageUrl || null,
    }).returning();
    return result[0];
  }

  async updateJobNote(companyId: string, id: string, note: UpdateJobNote): Promise<JobNote | undefined> {
    const result = await db.update(jobNotes)
      .set({
        ...note,
        updatedAt: new Date(),
      })
      .where(and(eq(jobNotes.id, id), eq(jobNotes.companyId, companyId)))
      .returning();
    return result[0];
  }

  async deleteJobNote(companyId: string, id: string): Promise<boolean> {
    const result = await db.delete(jobNotes)
      .where(and(eq(jobNotes.id, id), eq(jobNotes.companyId, companyId)))
      .returning();
    return result.length > 0;
  }

  // Client notes methods
  async getClientNotes(companyId: string, clientId: string): Promise<ClientNote[]> {
    return db.select()
      .from(clientNotes)
      .where(and(eq(clientNotes.companyId, companyId), eq(clientNotes.clientId, clientId)))
      .orderBy(desc(clientNotes.createdAt));
  }

  async getClientNote(companyId: string, id: string): Promise<ClientNote | undefined> {
    const result = await db.select()
      .from(clientNotes)
      .where(and(eq(clientNotes.id, id), eq(clientNotes.companyId, companyId)))
      .limit(1);
    return result[0];
  }

  async createClientNote(companyId: string, userId: string, note: InsertClientNote): Promise<ClientNote> {
    const result = await db.insert(clientNotes).values({
      companyId,
      userId,
      clientId: note.clientId,
      noteText: note.noteText,
    }).returning();
    return result[0];
  }

  async updateClientNote(companyId: string, id: string, note: UpdateClientNote): Promise<ClientNote | undefined> {
    const result = await db.update(clientNotes)
      .set({
        ...note,
        updatedAt: new Date(),
      })
      .where(and(eq(clientNotes.id, id), eq(clientNotes.companyId, companyId)))
      .returning();
    return result[0];
  }

  async deleteClientNote(companyId: string, id: string): Promise<boolean> {
    const result = await db.delete(clientNotes)
      .where(and(eq(clientNotes.id, id), eq(clientNotes.companyId, companyId)))
      .returning();
    return result.length > 0;
  }

  // Customer Companies (QBO Parent Company) methods
  async getCustomerCompanies(companyId: string): Promise<CustomerCompany[]> {
    return db.select()
      .from(customerCompanies)
      .where(eq(customerCompanies.companyId, companyId))
      .orderBy(customerCompanies.name);
  }

  async getCustomerCompany(companyId: string, id: string): Promise<CustomerCompany | undefined> {
    const result = await db.select()
      .from(customerCompanies)
      .where(and(eq(customerCompanies.id, id), eq(customerCompanies.companyId, companyId)))
      .limit(1);
    return result[0];
  }

  async createCustomerCompany(companyId: string, data: InsertCustomerCompany): Promise<CustomerCompany> {
    const result = await db.insert(customerCompanies).values({
      ...data,
      companyId,
    }).returning();
    return result[0];
  }

  async updateCustomerCompany(companyId: string, id: string, data: UpdateCustomerCompany): Promise<CustomerCompany | undefined> {
    const result = await db.update(customerCompanies)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(customerCompanies.id, id), eq(customerCompanies.companyId, companyId)))
      .returning();
    return result[0];
  }

  async deleteCustomerCompany(companyId: string, id: string): Promise<boolean> {
    const result = await db.delete(customerCompanies)
      .where(and(eq(customerCompanies.id, id), eq(customerCompanies.companyId, companyId)))
      .returning();
    return result.length > 0;
  }

  async deactivateCustomerCompany(companyId: string, id: string): Promise<CustomerCompany | undefined> {
    return this.updateCustomerCompany(companyId, id, { isActive: false });
  }

  // Create CustomerCompany and Client atomically in a transaction
  async createCustomerCompanyWithClient(
    companyId: string,
    userId: string,
    companyData: InsertCustomerCompany,
    clientData: InsertClient,
    partsList?: Array<{ partId: string; quantity: number }>
  ): Promise<{ customerCompany: CustomerCompany; client: Client }> {
    // Validate user belongs to company
    const isValid = await this.validateUserInCompany(userId, companyId);
    if (!isValid) {
      throw new Error("User does not belong to this company");
    }

    return await db.transaction(async (tx) => {
      // Validate all parts exist and belong to company first
      if (partsList && partsList.length > 0) {
        for (const partItem of partsList) {
          const existingPart = await tx.select().from(parts).where(
            and(eq(parts.id, partItem.partId), eq(parts.companyId, companyId))
          ).limit(1);
          
          if (!existingPart || existingPart.length === 0) {
            throw new Error(`Part with ID ${partItem.partId} not found or does not belong to company`);
          }
        }
      }

      // Create the customer company
      const customerCompanyResult = await tx.insert(customerCompanies).values({
        ...companyData,
        companyId,
      }).returning();
      const customerCompany = customerCompanyResult[0];

      // Create the client linked to the customer company
      const clientResult = await tx.insert(clients).values({
        ...clientData,
        parentCompanyId: customerCompany.id,
        companyId,
        userId,
      }).returning();
      const client = clientResult[0];

      // Bulk insert all client-part associations if parts were provided
      if (partsList && partsList.length > 0) {
        await tx.insert(clientParts).values(
          partsList.map(partItem => ({
            clientId: client.id,
            partId: partItem.partId,
            quantity: partItem.quantity,
            companyId,
            userId,
          }))
        );
      }

      return { customerCompany, client };
    });
  }

  // Invoice methods
  async getInvoices(companyId: string): Promise<Invoice[]> {
    return db.select()
      .from(invoices)
      .where(eq(invoices.companyId, companyId))
      .orderBy(desc(invoices.createdAt));
  }

  async getInvoicesByLocation(companyId: string, locationId: string): Promise<Invoice[]> {
    return db.select()
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), eq(invoices.locationId, locationId)))
      .orderBy(desc(invoices.createdAt));
  }

  async getInvoicesByJob(companyId: string, jobId: string): Promise<Invoice[]> {
    return db.select()
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), eq(invoices.jobId, jobId)))
      .orderBy(desc(invoices.createdAt));
  }

  async getInvoicesByCustomerCompany(companyId: string, customerCompanyId: string): Promise<Invoice[]> {
    return db.select()
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), eq(invoices.customerCompanyId, customerCompanyId)))
      .orderBy(desc(invoices.createdAt));
  }

  async getInvoice(companyId: string, id: string): Promise<Invoice | undefined> {
    const result = await db.select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.companyId, companyId)))
      .limit(1);
    return result[0];
  }

  async getInvoiceByQboId(companyId: string, qboInvoiceId: string): Promise<Invoice | undefined> {
    const result = await db.select()
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), eq(invoices.qboInvoiceId, qboInvoiceId)))
      .limit(1);
    return result[0];
  }

  async createInvoice(companyId: string, data: InsertInvoice): Promise<Invoice> {
    const result = await db.insert(invoices).values({
      ...data,
      companyId,
    }).returning();
    return result[0];
  }

  async updateInvoice(companyId: string, id: string, data: UpdateInvoice): Promise<Invoice | undefined> {
    const result = await db.update(invoices)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, id), eq(invoices.companyId, companyId)))
      .returning();
    return result[0];
  }

  async deleteInvoice(companyId: string, id: string): Promise<boolean> {
    const result = await db.delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.companyId, companyId)))
      .returning();
    return result.length > 0;
  }

  async voidInvoice(companyId: string, id: string): Promise<Invoice | undefined> {
    return this.updateInvoice(companyId, id, { status: "voided", isActive: false });
  }

  // Invoice Line methods
  async getInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
    return db.select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .orderBy(invoiceLines.lineNumber);
  }

  async getInvoiceLine(invoiceId: string, id: string): Promise<InvoiceLine | undefined> {
    const result = await db.select()
      .from(invoiceLines)
      .where(and(eq(invoiceLines.id, id), eq(invoiceLines.invoiceId, invoiceId)))
      .limit(1);
    return result[0];
  }

  async createInvoiceLine(data: InsertInvoiceLine): Promise<InvoiceLine> {
    const result = await db.insert(invoiceLines).values(data).returning();
    return result[0];
  }

  async createInvoiceLines(lines: InsertInvoiceLine[]): Promise<InvoiceLine[]> {
    if (lines.length === 0) return [];
    const result = await db.insert(invoiceLines).values(lines).returning();
    return result;
  }

  async updateInvoiceLine(invoiceId: string, id: string, data: UpdateInvoiceLine): Promise<InvoiceLine | undefined> {
    const result = await db.update(invoiceLines)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(invoiceLines.id, id), eq(invoiceLines.invoiceId, invoiceId)))
      .returning();
    return result[0];
  }

  async deleteInvoiceLine(invoiceId: string, id: string): Promise<boolean> {
    const result = await db.delete(invoiceLines)
      .where(and(eq(invoiceLines.id, id), eq(invoiceLines.invoiceId, invoiceId)))
      .returning();
    return result.length > 0;
  }

  async deleteInvoiceLines(invoiceId: string): Promise<number> {
    const result = await db.delete(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .returning();
    return result.length;
  }

  async replaceInvoiceLines(invoiceId: string, lines: InsertInvoiceLine[]): Promise<InvoiceLine[]> {
    await this.deleteInvoiceLines(invoiceId);
    if (lines.length === 0) return [];
    return this.createInvoiceLines(lines.map(line => ({ ...line, invoiceId })));
  }

  // Get invoice with all related data for QBO sync
  async getInvoiceWithDetails(companyId: string, id: string): Promise<{
    invoice: Invoice;
    lines: InvoiceLine[];
    location: Client;
    customerCompany?: CustomerCompany;
  } | undefined> {
    const invoice = await this.getInvoice(companyId, id);
    if (!invoice) return undefined;

    const lines = await this.getInvoiceLines(id);
    const location = await this.getClient(companyId, invoice.locationId);
    if (!location) return undefined;

    let customerCompany: CustomerCompany | undefined;
    if (invoice.customerCompanyId) {
      customerCompany = await this.getCustomerCompany(companyId, invoice.customerCompanyId);
    } else if (location.parentCompanyId) {
      customerCompany = await this.getCustomerCompany(companyId, location.parentCompanyId);
    }

    return { invoice, lines, location, customerCompany };
  }

  // Payment methods
  async getPayments(invoiceId: string): Promise<Payment[]> {
    return db.select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.receivedAt));
  }

  async getPayment(invoiceId: string, id: string): Promise<Payment | undefined> {
    const result = await db.select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.invoiceId, invoiceId)))
      .limit(1);
    return result[0];
  }

  async createPayment(companyId: string, invoiceId: string, data: InsertPayment): Promise<Payment> {
    // Verify invoice belongs to company
    const invoice = await this.getInvoice(companyId, invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    
    const result = await db.insert(payments).values({
      invoiceId,
      amount: data.amount,
      method: data.method || "other",
      reference: data.reference || null,
      receivedAt: data.receivedAt ? new Date(data.receivedAt) : new Date(),
      notes: data.notes || null,
    }).returning();
    
    // Update invoice amountPaid and balance
    const allPayments = await this.getPayments(invoiceId);
    const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const invoiceTotal = parseFloat(invoice.total);
    const newBalance = invoiceTotal - totalPaid;
    
    // Determine new status
    let newStatus = invoice.status;
    if (newBalance <= 0) {
      newStatus = "paid";
    } else if (totalPaid > 0) {
      newStatus = "partial_paid";
    }
    
    await this.updateInvoice(companyId, invoiceId, {
      amountPaid: totalPaid.toFixed(2),
      balance: newBalance.toFixed(2),
      status: newStatus as any,
    });
    
    // If invoice is fully paid and linked to a job, update job status to "invoiced"
    if (newStatus === "paid" && invoice.jobId) {
      await this.updateJob(companyId, invoice.jobId, { status: "invoiced" });
    }
    
    return result[0];
  }

  async updatePayment(companyId: string, invoiceId: string, id: string, data: UpdatePayment): Promise<Payment | undefined> {
    // Verify invoice belongs to company
    const invoice = await this.getInvoice(companyId, invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    
    const updates: Partial<Payment> = {};
    if (data.amount !== undefined) updates.amount = data.amount;
    if (data.method !== undefined) updates.method = data.method;
    if (data.reference !== undefined) updates.reference = data.reference;
    if (data.receivedAt !== undefined) updates.receivedAt = new Date(data.receivedAt);
    if (data.notes !== undefined) updates.notes = data.notes;

    const result = await db.update(payments)
      .set(updates)
      .where(and(eq(payments.id, id), eq(payments.invoiceId, invoiceId)))
      .returning();
    
    // Recalculate invoice totals
    if (result.length > 0) {
      const allPayments = await this.getPayments(invoiceId);
      const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const invoiceTotal = parseFloat(invoice.total);
      const newBalance = invoiceTotal - totalPaid;
      
      let newStatus = invoice.status;
      if (newBalance <= 0) {
        newStatus = "paid";
      } else if (totalPaid > 0) {
        newStatus = "partial_paid";
      }
      
      await this.updateInvoice(companyId, invoiceId, {
        amountPaid: totalPaid.toFixed(2),
        balance: newBalance.toFixed(2),
        status: newStatus as any,
      });
    }
    
    return result[0];
  }

  async deletePayment(companyId: string, invoiceId: string, id: string): Promise<boolean> {
    // Verify invoice belongs to company
    const invoice = await this.getInvoice(companyId, invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    
    const result = await db.delete(payments)
      .where(and(eq(payments.id, id), eq(payments.invoiceId, invoiceId)))
      .returning();
    
    // Recalculate invoice totals
    if (result.length > 0) {
      const allPayments = await this.getPayments(invoiceId);
      const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const invoiceTotal = parseFloat(invoice.total);
      const newBalance = invoiceTotal - totalPaid;
      
      let newStatus: string = invoice.status;
      if (newBalance >= invoiceTotal) {
        newStatus = invoice.sentAt ? "sent" : "draft";
      } else if (newBalance > 0 && totalPaid > 0) {
        newStatus = "partial_paid";
      }
      
      await this.updateInvoice(companyId, invoiceId, {
        amountPaid: totalPaid.toFixed(2),
        balance: newBalance.toFixed(2),
        status: newStatus as any,
      });
    }
    
    return result.length > 0;
  }

  // Get invoices with statistics for list view
  async getInvoicesWithStats(companyId: string, filters?: {
    status?: string;
    clientId?: string;
    search?: string;
    from?: string;
    to?: string;
  }): Promise<(Invoice & { locationName?: string; customerCompanyName?: string })[]> {
    const conditions = [eq(invoices.companyId, companyId), eq(invoices.isActive, true)];
    
    if (filters?.status) {
      conditions.push(eq(invoices.status, filters.status));
    }
    if (filters?.clientId) {
      conditions.push(eq(invoices.locationId, filters.clientId));
    }
    if (filters?.from) {
      conditions.push(sql`${invoices.issueDate} >= ${filters.from}`);
    }
    if (filters?.to) {
      conditions.push(sql`${invoices.issueDate} <= ${filters.to}`);
    }
    if (filters?.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        sql`(LOWER(${invoices.invoiceNumber}) LIKE ${searchTerm})`
      );
    }
    
    const result = await db.select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt));
    
    // Enrich with location and customer company names
    const enriched = await Promise.all(result.map(async (inv) => {
      const location = await this.getClient(companyId, inv.locationId);
      let customerCompanyName: string | undefined;
      if (inv.customerCompanyId) {
        const cc = await this.getCustomerCompany(companyId, inv.customerCompanyId);
        customerCompanyName = cc?.name;
      }
      return {
        ...inv,
        locationName: location?.companyName,
        customerCompanyName,
      };
    }));
    
    return enriched;
  }

  // Get invoice summary stats
  async getInvoiceSummaryStats(companyId: string): Promise<{
    outstanding: { amount: number; count: number };
    issuedLast30Days: { count: number };
    averageInvoice: number;
    overdue: { amount: number; count: number };
  }> {
    const allInvoices = await db.select()
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), eq(invoices.isActive, true)));
    
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    let outstandingAmount = 0;
    let outstandingCount = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let issuedLast30Count = 0;
    let totalAmount = 0;
    
    for (const inv of allInvoices) {
      const balance = parseFloat(inv.balance);
      const total = parseFloat(inv.total);
      
      // Outstanding (unpaid balance)
      if (balance > 0 && inv.status !== "voided") {
        outstandingAmount += balance;
        outstandingCount++;
        
        // Overdue
        if (inv.dueDate && new Date(inv.dueDate) < today) {
          overdueAmount += balance;
          overdueCount++;
        }
      }
      
      // Issued in last 30 days
      if (new Date(inv.issueDate) >= thirtyDaysAgo) {
        issuedLast30Count++;
      }
      
      // Total for average
      if (inv.status !== "voided") {
        totalAmount += total;
      }
    }
    
    const nonVoidedCount = allInvoices.filter(i => i.status !== "voided").length;
    
    return {
      outstanding: { amount: outstandingAmount, count: outstandingCount },
      issuedLast30Days: { count: issuedLast30Count },
      averageInvoice: nonVoidedCount > 0 ? totalAmount / nonVoidedCount : 0,
      overdue: { amount: overdueAmount, count: overdueCount },
    };
  }

  // Create invoice from job
  async createInvoiceFromJob(companyId: string, jobId: string, options?: {
    includeLineItems?: boolean;
    includeNotes?: boolean;
  }): Promise<Invoice> {
    const job = await this.getJob(companyId, jobId);
    if (!job) throw new Error("Job not found");
    
    const location = await this.getClient(companyId, job.locationId);
    if (!location) throw new Error("Location not found");
    
    // Get next invoice number atomically
    const nextInvoiceNumber = await this.getNextInvoiceNumber(companyId);
    
    const today = new Date();
    const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // Net 30
    
    // Create the invoice
    const invoiceData: InsertInvoice = {
      locationId: job.locationId,
      customerCompanyId: location.parentCompanyId || null,
      invoiceNumber: `${nextInvoiceNumber}`,
      status: "draft",
      issueDate: today.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      currency: "CAD",
      subtotal: "0",
      taxTotal: "0",
      total: "0",
      notesInternal: options?.includeNotes ? job.description || null : null,
      workDescription: job.description || null, // Copy job description as work performed
    };
    
    const invoice = await this.createInvoice(companyId, invoiceData);
    
    // Link job to invoice
    await this.updateJob(companyId, jobId, { invoiceId: invoice.id });
    
    // Update invoice with jobId reference
    await this.updateInvoice(companyId, invoice.id, { jobId: jobId });
    
    // Copy job parts as invoice line items
    if (options?.includeLineItems !== false) {
      const jobParts = await this.getJobParts(jobId);
      let lineNumber = 1;
      let subtotal = 0;
      
      for (const part of jobParts) {
        const qty = parseFloat(part.quantity);
        const price = parseFloat(part.unitPrice || "0");
        const lineTotal = qty * price;
        subtotal += lineTotal;
        
        await this.createInvoiceLine({
          invoiceId: invoice.id,
          lineNumber: lineNumber++,
          lineItemType: "material",
          description: part.description,
          quantity: part.quantity,
          unitCost: part.unitCost || "0",
          unitPrice: part.unitPrice || "0",
          taxRate: "0.13", // Default 13% HST
          lineSubtotal: lineTotal.toFixed(2),
          jobLineItemId: part.id,
        });
      }
      
      // Update invoice totals
      const taxTotal = subtotal * 0.13;
      const total = subtotal + taxTotal;
      
      await this.updateInvoice(companyId, invoice.id, {
        subtotal: subtotal.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        total: total.toFixed(2),
        balance: total.toFixed(2),
      });
    }
    
    // Return updated invoice
    return (await this.getInvoice(companyId, invoice.id))!;
  }

  // Refresh invoice line items from linked job (for draft invoices only)
  async refreshInvoiceFromJob(companyId: string, invoiceId: string, jobId: string): Promise<Invoice> {
    const invoice = await this.getInvoice(companyId, invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "draft") throw new Error("Can only refresh draft invoices");
    
    // Delete existing line items
    const existingLines = await this.getInvoiceLines(invoiceId);
    for (const line of existingLines) {
      await this.deleteInvoiceLine(line.id);
    }
    
    // Copy fresh job parts as invoice line items
    const jobParts = await this.getJobParts(jobId);
    let lineNumber = 1;
    let subtotal = 0;
    
    for (const part of jobParts) {
      const qty = parseFloat(part.quantity);
      const price = parseFloat(part.unitPrice || "0");
      const lineTotal = qty * price;
      subtotal += lineTotal;
      
      await this.createInvoiceLine({
        invoiceId: invoiceId,
        lineNumber: lineNumber++,
        lineItemType: "material",
        description: part.description,
        quantity: part.quantity,
        unitCost: part.unitCost || "0",
        unitPrice: part.unitPrice || "0",
        taxRate: "0.13",
        lineSubtotal: lineTotal.toFixed(2),
        jobLineItemId: part.id,
      });
    }
    
    // Update invoice totals
    const taxTotal = subtotal * 0.13;
    const total = subtotal + taxTotal;
    const amountPaid = parseFloat(invoice.amountPaid || "0");
    
    await this.updateInvoice(companyId, invoiceId, {
      subtotal: subtotal.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: total.toFixed(2),
      balance: (total - amountPaid).toFixed(2),
    });
    
    return (await this.getInvoice(companyId, invoiceId))!;
  }

  // Send invoice
  async sendInvoice(companyId: string, id: string): Promise<Invoice | undefined> {
    const invoice = await this.getInvoice(companyId, id);
    if (!invoice) return undefined;
    
    // Update linked job status to "invoiced" when invoice is sent
    if (invoice.jobId) {
      await this.updateJob(companyId, invoice.jobId, { status: "invoiced" });
    }
    
    return this.updateInvoice(companyId, id, {
      status: "sent",
      sentAt: new Date(),
    });
  }

  // Jobs methods
  async getJobs(companyId: string, filters?: {
    status?: string;
    technicianId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Job[]> {
    const conditions = [eq(jobs.companyId, companyId), eq(jobs.isActive, true)];
    
    if (filters?.status) {
      conditions.push(eq(jobs.status, filters.status));
    }
    if (filters?.locationId) {
      conditions.push(eq(jobs.locationId, filters.locationId));
    }
    if (filters?.technicianId) {
      conditions.push(
        or(
          eq(jobs.primaryTechnicianId, filters.technicianId),
          sql`${filters.technicianId} = ANY(${jobs.assignedTechnicianIds})`
        )!
      );
    }
    if (filters?.startDate) {
      conditions.push(sql`${jobs.scheduledStart} >= ${filters.startDate}::timestamp`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${jobs.scheduledStart} <= ${filters.endDate}::timestamp`);
    }

    return db.select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt));
  }

  async getJob(companyId: string, id: string): Promise<Job | undefined> {
    const result = await db.select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))
      .limit(1);
    return result[0];
  }

  async getNextJobNumber(companyId: string): Promise<number> {
    // Use company_counters table for atomic job number generation
    const result = await db.select()
      .from(companyCounters)
      .where(eq(companyCounters.companyId, companyId))
      .limit(1);
    
    if (result.length === 0) {
      // Initialize counter for this company
      await db.insert(companyCounters).values({
        companyId,
        nextJobNumber: 10001,
        nextInvoiceNumber: 1002,
      });
      return 10000;
    }
    
    const current = result[0].nextJobNumber;
    await db.update(companyCounters)
      .set({ nextJobNumber: current + 1 })
      .where(eq(companyCounters.companyId, companyId));
    
    return current;
  }

  async getNextInvoiceNumber(companyId: string): Promise<number> {
    // Use company_counters table for atomic invoice number generation
    const result = await db.select()
      .from(companyCounters)
      .where(eq(companyCounters.companyId, companyId))
      .limit(1);
    
    if (result.length === 0) {
      // Initialize counter for this company
      await db.insert(companyCounters).values({
        companyId,
        nextJobNumber: 10000,
        nextInvoiceNumber: 1002,
      });
      return 1001;
    }
    
    const current = result[0].nextInvoiceNumber;
    await db.update(companyCounters)
      .set({ nextInvoiceNumber: current + 1 })
      .where(eq(companyCounters.companyId, companyId));
    
    return current;
  }

  async getCompanyCounters(companyId: string): Promise<{ nextJobNumber: number; nextInvoiceNumber: number }> {
    const result = await db.select()
      .from(companyCounters)
      .where(eq(companyCounters.companyId, companyId))
      .limit(1);
    
    if (result.length === 0) {
      return { nextJobNumber: 10000, nextInvoiceNumber: 1001 };
    }
    
    return {
      nextJobNumber: result[0].nextJobNumber,
      nextInvoiceNumber: result[0].nextInvoiceNumber,
    };
  }

  async updateCompanyCounters(companyId: string, updates: { nextJobNumber?: number; nextInvoiceNumber?: number }): Promise<void> {
    const result = await db.select()
      .from(companyCounters)
      .where(eq(companyCounters.companyId, companyId))
      .limit(1);
    
    if (result.length === 0) {
      // Create counter with provided values
      await db.insert(companyCounters).values({
        companyId,
        nextJobNumber: updates.nextJobNumber ?? 10000,
        nextInvoiceNumber: updates.nextInvoiceNumber ?? 1001,
      });
    } else {
      // Update existing counters
      const updateData: Partial<{ nextJobNumber: number; nextInvoiceNumber: number }> = {};
      if (updates.nextJobNumber !== undefined) updateData.nextJobNumber = updates.nextJobNumber;
      if (updates.nextInvoiceNumber !== undefined) updateData.nextInvoiceNumber = updates.nextInvoiceNumber;
      
      if (Object.keys(updateData).length > 0) {
        await db.update(companyCounters)
          .set(updateData)
          .where(eq(companyCounters.companyId, companyId));
      }
    }
  }

  async createJob(companyId: string, data: InsertJob): Promise<Job> {
    const jobNumber = await this.getNextJobNumber(companyId);
    
    // If primaryTechnicianId is set but assignedTechnicianIds is not, include primary in assigned list
    let assignedTechnicianIds = data.assignedTechnicianIds || null;
    if (data.primaryTechnicianId && (!assignedTechnicianIds || assignedTechnicianIds.length === 0)) {
      assignedTechnicianIds = [data.primaryTechnicianId];
    }
    
    const result = await db.insert(jobs).values({
      companyId,
      jobNumber,
      locationId: data.locationId,
      primaryTechnicianId: data.primaryTechnicianId || null,
      assignedTechnicianIds,
      status: data.status || 'draft',
      priority: data.priority || 'medium',
      jobType: data.jobType || 'maintenance',
      summary: data.summary,
      description: data.description || null,
      accessInstructions: data.accessInstructions || null,
      scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
      scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null,
      invoiceId: data.invoiceId || null,
      qboInvoiceId: data.qboInvoiceId || null,
      billingNotes: data.billingNotes || null,
      recurringSeriesId: data.recurringSeriesId || null,
      calendarAssignmentId: data.calendarAssignmentId || null,
    }).returning();
    return result[0];
  }

  async updateJob(companyId: string, id: string, data: UpdateJob): Promise<Job | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    
    // Handle date conversions
    if (data.scheduledStart !== undefined) {
      updateData.scheduledStart = data.scheduledStart ? new Date(data.scheduledStart) : null;
    }
    if (data.scheduledEnd !== undefined) {
      updateData.scheduledEnd = data.scheduledEnd ? new Date(data.scheduledEnd) : null;
    }
    if (data.actualStart !== undefined) {
      updateData.actualStart = data.actualStart ? new Date(data.actualStart) : null;
    }
    if (data.actualEnd !== undefined) {
      updateData.actualEnd = data.actualEnd ? new Date(data.actualEnd) : null;
    }

    const result = await db.update(jobs)
      .set(updateData)
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))
      .returning();
    return result[0];
  }

  async updateJobStatus(companyId: string, id: string, status: string): Promise<Job | undefined> {
    return this.updateJob(companyId, id, { status: status as any });
  }

  async deleteJob(companyId: string, id: string): Promise<boolean> {
    // Soft delete
    const result = await db.update(jobs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))
      .returning();
    return result.length > 0;
  }

  // Recurring Job Series methods
  async getRecurringSeries(companyId: string, id: string): Promise<RecurringJobSeries | undefined> {
    const result = await db.select()
      .from(recurringJobSeries)
      .where(and(eq(recurringJobSeries.id, id), eq(recurringJobSeries.companyId, companyId)))
      .limit(1);
    return result[0];
  }

  async getRecurringSeriesByLocation(companyId: string, locationId: string): Promise<RecurringJobSeries[]> {
    return db.select()
      .from(recurringJobSeries)
      .where(and(
        eq(recurringJobSeries.companyId, companyId),
        eq(recurringJobSeries.locationId, locationId),
        eq(recurringJobSeries.isActive, true)
      ))
      .orderBy(desc(recurringJobSeries.createdAt));
  }

  async createRecurringSeries(companyId: string, data: InsertRecurringJobSeries, phases: InsertRecurringJobPhase[]): Promise<RecurringJobSeries> {
    return await db.transaction(async (tx) => {
      const seriesResult = await tx.insert(recurringJobSeries).values({
        companyId,
        locationId: data.locationId,
        baseSummary: data.baseSummary,
        baseDescription: data.baseDescription || null,
        baseJobType: data.baseJobType || 'service',
        basePriority: data.basePriority || 'normal',
        defaultTechnicianId: data.defaultTechnicianId || null,
        startDate: data.startDate,
        timezone: data.timezone || 'America/Toronto',
        notes: data.notes || null,
        createdByUserId: data.createdByUserId || null,
      }).returning();
      const series = seriesResult[0];

      // Create phases
      if (phases.length > 0) {
        await tx.insert(recurringJobPhases).values(
          phases.map(phase => ({
            seriesId: series.id,
            orderIndex: phase.orderIndex,
            frequency: phase.frequency,
            interval: phase.interval || 1,
            occurrences: phase.occurrences || null,
            untilDate: phase.untilDate || null,
          }))
        );
      }

      return series;
    });
  }

  async getRecurringPhases(seriesId: string): Promise<RecurringJobPhase[]> {
    return db.select()
      .from(recurringJobPhases)
      .where(eq(recurringJobPhases.seriesId, seriesId))
      .orderBy(recurringJobPhases.orderIndex);
  }

  async generateJobsFromSeries(companyId: string, seriesId: string, count: number): Promise<Job[]> {
    const series = await this.getRecurringSeries(companyId, seriesId);
    if (!series) return [];

    const phases = await this.getRecurringPhases(seriesId);
    if (phases.length === 0) return [];

    const generatedJobs: Job[] = [];
    let currentDate = new Date(series.startDate);
    let jobsGenerated = 0;
    let phaseIndex = 0;
    let phaseOccurrenceCount = 0;

    while (jobsGenerated < count && phaseIndex < phases.length) {
      const phase = phases[phaseIndex];
      
      // Check if phase is complete
      if (phase.occurrences && phaseOccurrenceCount >= phase.occurrences) {
        phaseIndex++;
        phaseOccurrenceCount = 0;
        continue;
      }
      if (phase.untilDate && currentDate > new Date(phase.untilDate)) {
        phaseIndex++;
        phaseOccurrenceCount = 0;
        continue;
      }

      // Create job for current date
      const job = await this.createJob(companyId, {
        locationId: series.locationId,
        summary: series.baseSummary,
        description: series.baseDescription,
        jobType: series.baseJobType as any,
        priority: series.basePriority as any,
        primaryTechnicianId: series.defaultTechnicianId,
        scheduledStart: currentDate.toISOString(),
        recurringSeriesId: seriesId,
        status: 'scheduled',
      });
      generatedJobs.push(job);
      jobsGenerated++;
      phaseOccurrenceCount++;

      // Advance to next date based on frequency
      currentDate = this.advanceDate(currentDate, phase.frequency, phase.interval);
    }

    return generatedJobs;
  }

  private advanceDate(date: Date, frequency: string, interval: number): Date {
    const result = new Date(date);
    switch (frequency) {
      case 'daily':
        result.setDate(result.getDate() + interval);
        break;
      case 'weekly':
        result.setDate(result.getDate() + (7 * interval));
        break;
      case 'monthly':
        result.setMonth(result.getMonth() + interval);
        break;
      case 'quarterly':
        result.setMonth(result.getMonth() + (3 * interval));
        break;
      case 'yearly':
        result.setFullYear(result.getFullYear() + interval);
        break;
    }
    return result;
  }

  // Location PM Plan methods
  async getLocationPMPlan(locationId: string): Promise<LocationPMPlan | undefined> {
    const result = await db.select()
      .from(locationPMPlans)
      .where(and(
        eq(locationPMPlans.locationId, locationId),
        eq(locationPMPlans.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  async createOrUpdateLocationPMPlan(locationId: string, data: InsertLocationPMPlan): Promise<LocationPMPlan> {
    const existing = await this.getLocationPMPlan(locationId);
    if (existing) {
      const [updated] = await db.update(locationPMPlans)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(locationPMPlans.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(locationPMPlans)
      .values({
        ...data,
        locationId,
      })
      .returning();
    return created;
  }

  async deleteLocationPMPlan(locationId: string): Promise<boolean> {
    const result = await db.update(locationPMPlans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(locationPMPlans.locationId, locationId),
        eq(locationPMPlans.isActive, true)
      ))
      .returning();
    return result.length > 0;
  }

  // Location PM Part Template methods
  async getLocationPMParts(locationId: string): Promise<LocationPMPartTemplate[]> {
    return db.select()
      .from(locationPMPartTemplates)
      .where(and(
        eq(locationPMPartTemplates.locationId, locationId),
        eq(locationPMPartTemplates.isActive, true)
      ));
  }

  async createLocationPMPart(locationId: string, data: InsertLocationPMPartTemplate): Promise<LocationPMPartTemplate> {
    const [created] = await db.insert(locationPMPartTemplates)
      .values({
        ...data,
        locationId,
      })
      .returning();
    return created;
  }

  async updateLocationPMPart(id: string, data: UpdateLocationPMPartTemplate): Promise<LocationPMPartTemplate | undefined> {
    const [updated] = await db.update(locationPMPartTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(locationPMPartTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteLocationPMPart(id: string): Promise<boolean> {
    const result = await db.update(locationPMPartTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(locationPMPartTemplates.id, id))
      .returning();
    return result.length > 0;
  }

  // Job Parts methods
  async getJobParts(jobId: string): Promise<JobPart[]> {
    return db.select()
      .from(jobParts)
      .where(and(
        eq(jobParts.jobId, jobId),
        eq(jobParts.isActive, true)
      ))
      .orderBy(jobParts.sortOrder);
  }

  async createJobPart(jobId: string, data: InsertJobPart): Promise<JobPart> {
    const [created] = await db.insert(jobParts)
      .values({
        ...data,
        jobId,
      })
      .returning();
    return created;
  }

  async updateJobPart(id: string, data: UpdateJobPart): Promise<JobPart | undefined> {
    const [updated] = await db.update(jobParts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(jobParts.id, id))
      .returning();
    return updated;
  }

  async deleteJobPart(id: string): Promise<boolean> {
    const result = await db.update(jobParts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(jobParts.id, id))
      .returning();
    return result.length > 0;
  }

  async reorderJobParts(jobId: string, parts: { id: string; sortOrder: number }[]): Promise<void> {
    for (const { id, sortOrder } of parts) {
      await db.update(jobParts)
        .set({ sortOrder, updatedAt: new Date() })
        .where(and(
          eq(jobParts.id, id),
          eq(jobParts.jobId, jobId)
        ));
    }
  }

  // PM Job generation
  async generatePMJobForLocation(companyId: string, locationId: string, date: Date): Promise<{ job: Job; parts: JobPart[] } | null> {
    const pmPlan = await this.getLocationPMPlan(locationId);
    if (!pmPlan || !pmPlan.hasPm) return null;

    const month = date.getMonth();
    const monthFlags = [
      pmPlan.pmJan, pmPlan.pmFeb, pmPlan.pmMar, pmPlan.pmApr,
      pmPlan.pmMay, pmPlan.pmJun, pmPlan.pmJul, pmPlan.pmAug,
      pmPlan.pmSep, pmPlan.pmOct, pmPlan.pmNov, pmPlan.pmDec
    ];
    if (!monthFlags[month]) return null;

    const location = await this.getClient(companyId, locationId);
    if (!location) return null;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const summary = `PM Visit - ${monthNames[month]} ${date.getFullYear()} - ${location.companyName}`;

    const job = await this.createJob(companyId, {
      locationId,
      summary,
      description: pmPlan.notes || undefined,
      jobType: 'maintenance',
      priority: 'medium',
      status: 'scheduled',
      scheduledStart: date.toISOString(),
      recurringSeriesId: pmPlan.recurringSeriesId || undefined,
    });

    const pmPartTemplates = await this.getLocationPMParts(locationId);
    const createdParts: JobPart[] = [];

    // Collect unique equipment IDs from templates and auto-link to job
    const uniqueEquipmentIds = new Set<string>();
    for (const template of pmPartTemplates) {
      if (template.equipmentId) {
        uniqueEquipmentIds.add(template.equipmentId);
      }
    }
    
    // Create JobEquipment entries for each unique equipment
    for (const equipmentId of uniqueEquipmentIds) {
      await this.createJobEquipment(job.id, {
        jobId: job.id,
        equipmentId,
        notes: 'PM visit auto-linked',
      });
    }

    for (const template of pmPartTemplates) {
      const [part] = await db.select()
        .from(partsTable)
        .where(eq(partsTable.id, template.productId))
        .limit(1);
      
      const description = template.descriptionOverride || part?.name || part?.description || 'Unknown Part';
      
      const jobPart = await this.createJobPart(job.id, {
        jobId: job.id,
        productId: template.productId,
        equipmentId: template.equipmentId || undefined,
        description,
        quantity: template.quantityPerVisit,
        unitPrice: part?.unitPrice || null,
        source: 'pm_template',
        equipmentLabel: template.equipmentLabel,
      });
      createdParts.push(jobPart);
    }

    return { job, parts: createdParts };
  }

  // Location Equipment methods
  async getLocationEquipment(locationId: string): Promise<LocationEquipment[]> {
    return db.select()
      .from(locationEquipment)
      .where(and(
        eq(locationEquipment.locationId, locationId),
        eq(locationEquipment.isActive, true)
      ));
  }

  async getLocationEquipmentItem(id: string): Promise<LocationEquipment | undefined> {
    const [item] = await db.select()
      .from(locationEquipment)
      .where(eq(locationEquipment.id, id))
      .limit(1);
    return item;
  }

  async createLocationEquipment(locationId: string, data: InsertLocationEquipment): Promise<LocationEquipment> {
    const [created] = await db.insert(locationEquipment)
      .values({
        ...data,
        locationId,
      })
      .returning();
    return created;
  }

  async updateLocationEquipment(id: string, data: UpdateLocationEquipment): Promise<LocationEquipment | undefined> {
    const [updated] = await db.update(locationEquipment)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(locationEquipment.id, id))
      .returning();
    return updated;
  }

  async deleteLocationEquipment(id: string): Promise<boolean> {
    const result = await db.update(locationEquipment)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(locationEquipment.id, id))
      .returning();
    return result.length > 0;
  }

  // Job Equipment methods
  async getJobEquipment(jobId: string): Promise<(JobEquipment & { equipment: LocationEquipment })[]> {
    const results = await db.select({
      id: jobEquipment.id,
      jobId: jobEquipment.jobId,
      equipmentId: jobEquipment.equipmentId,
      notes: jobEquipment.notes,
      createdAt: jobEquipment.createdAt,
      updatedAt: jobEquipment.updatedAt,
      equipment: locationEquipment,
    })
      .from(jobEquipment)
      .innerJoin(locationEquipment, eq(jobEquipment.equipmentId, locationEquipment.id))
      .where(eq(jobEquipment.jobId, jobId));
    
    return results.map(r => ({
      id: r.id,
      jobId: r.jobId,
      equipmentId: r.equipmentId,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      equipment: r.equipment,
    }));
  }

  async createJobEquipment(jobId: string, data: InsertJobEquipment): Promise<JobEquipment> {
    const [created] = await db.insert(jobEquipment)
      .values({
        ...data,
        jobId,
      })
      .returning();
    return created;
  }

  async updateJobEquipment(id: string, data: UpdateJobEquipment): Promise<JobEquipment | undefined> {
    const [updated] = await db.update(jobEquipment)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(jobEquipment.id, id))
      .returning();
    return updated;
  }

  async deleteJobEquipment(id: string): Promise<boolean> {
    const result = await db.delete(jobEquipment)
      .where(eq(jobEquipment.id, id))
      .returning();
    return result.length > 0;
  }

  // Equipment service history
  async getEquipmentServiceHistory(equipmentId: string): Promise<Job[]> {
    const jobIds = await db.select({ jobId: jobEquipment.jobId })
      .from(jobEquipment)
      .where(eq(jobEquipment.equipmentId, equipmentId));
    
    if (jobIds.length === 0) return [];
    
    return db.select()
      .from(jobs)
      .where(inArray(jobs.id, jobIds.map(j => j.jobId)))
      .orderBy(desc(jobs.scheduledStart));
  }

  // Team Management methods
  async getTeamMembers(companyId: string): Promise<User[]> {
    return db.select()
      .from(users)
      .where(eq(users.companyId, companyId))
      .orderBy(users.firstName, users.lastName);
  }

  async getTeamMember(companyId: string, userId: string): Promise<User | undefined> {
    const [user] = await db.select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.companyId, companyId)));
    return user;
  }

  async updateTeamMember(companyId: string, userId: string, updates: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phone?: string;
    roleId?: string;
    status?: string;
    useCustomSchedule?: boolean;
  }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set(updates)
      .where(and(eq(users.id, userId), eq(users.companyId, companyId)))
      .returning();
    return updated;
  }

  async deactivateTeamMember(companyId: string, userId: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ status: 'deactivated' })
      .where(and(eq(users.id, userId), eq(users.companyId, companyId)))
      .returning();
    return updated;
  }

  // Technician Profile methods
  async getTechnicianProfile(userId: string): Promise<TechnicianProfile | undefined> {
    const [profile] = await db.select()
      .from(technicianProfiles)
      .where(eq(technicianProfiles.userId, userId));
    return profile;
  }

  async upsertTechnicianProfile(userId: string, data: {
    laborCostPerHour?: string | null;
    billableRatePerHour?: string | null;
    color?: string | null;
    phone?: string | null;
    note?: string | null;
  }): Promise<TechnicianProfile> {
    // Try to update first
    const existing = await this.getTechnicianProfile(userId);
    if (existing) {
      const [updated] = await db.update(technicianProfiles)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(technicianProfiles.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(technicianProfiles)
        .values({
          userId,
          ...data,
        })
        .returning();
      return created;
    }
  }

  // Working Hours methods
  async getWorkingHours(userId: string): Promise<WorkingHours[]> {
    return db.select()
      .from(workingHours)
      .where(eq(workingHours.userId, userId))
      .orderBy(workingHours.dayOfWeek);
  }

  async setWorkingHours(userId: string, hours: Array<{
    dayOfWeek: number;
    startTime?: string | null;
    endTime?: string | null;
    isWorking: boolean;
  }>): Promise<WorkingHours[]> {
    // Delete existing hours
    await db.delete(workingHours)
      .where(eq(workingHours.userId, userId));
    
    // Insert new hours
    if (hours.length > 0) {
      await db.insert(workingHours)
        .values(hours.map(h => ({
          userId,
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
          isWorking: h.isWorking,
        })));
    }
    
    return this.getWorkingHours(userId);
  }

  // User Permission Overrides methods
  async getUserPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
    return db.select()
      .from(userPermissionOverrides)
      .where(eq(userPermissionOverrides.userId, userId));
  }

  async setUserPermissionOverrides(userId: string, overrides: Array<{
    permissionId: string;
    override: 'grant' | 'revoke';
  }>): Promise<void> {
    // Delete existing overrides
    await db.delete(userPermissionOverrides)
      .where(eq(userPermissionOverrides.userId, userId));
    
    // Insert new overrides
    if (overrides.length > 0) {
      await db.insert(userPermissionOverrides)
        .values(overrides.map(o => ({
          userId,
          permissionId: o.permissionId,
          override: o.override,
        })));
    }
  }

  // Get role permissions
  async getRolePermissions(roleId: string): Promise<string[]> {
    const result = await db.select({
      permissionKey: permissions.key,
    })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    
    return result.map(r => r.permissionKey);
  }

  // Job Template methods
  async getJobTemplates(companyId: string, filter?: { jobType?: string; activeOnly?: boolean }): Promise<JobTemplate[]> {
    let query = db.select()
      .from(jobTemplates)
      .where(eq(jobTemplates.companyId, companyId));
    
    const conditions = [eq(jobTemplates.companyId, companyId)];
    
    if (filter?.jobType) {
      conditions.push(eq(jobTemplates.jobType, filter.jobType));
    }
    if (filter?.activeOnly !== false) {
      conditions.push(eq(jobTemplates.isActive, true));
    }
    
    return db.select()
      .from(jobTemplates)
      .where(and(...conditions))
      .orderBy(desc(jobTemplates.isDefaultForJobType), jobTemplates.name);
  }

  async getJobTemplate(companyId: string, id: string): Promise<JobTemplate | undefined> {
    const result = await db.select()
      .from(jobTemplates)
      .where(and(
        eq(jobTemplates.id, id),
        eq(jobTemplates.companyId, companyId)
      ))
      .limit(1);
    return result[0];
  }

  async getJobTemplateLineItems(templateId: string): Promise<JobTemplateLineItem[]> {
    return db.select({
      id: jobTemplateLineItems.id,
      templateId: jobTemplateLineItems.templateId,
      productId: jobTemplateLineItems.productId,
      descriptionOverride: jobTemplateLineItems.descriptionOverride,
      quantity: jobTemplateLineItems.quantity,
      unitPriceOverride: jobTemplateLineItems.unitPriceOverride,
      sortOrder: jobTemplateLineItems.sortOrder,
      createdAt: jobTemplateLineItems.createdAt,
    })
      .from(jobTemplateLineItems)
      .where(eq(jobTemplateLineItems.templateId, templateId))
      .orderBy(jobTemplateLineItems.sortOrder);
  }

  async createJobTemplate(companyId: string, data: InsertJobTemplate, lines: Omit<InsertJobTemplateLineItem, 'templateId'>[]): Promise<JobTemplate> {
    // If setting as default for a job type, first unset any existing default
    if (data.isDefaultForJobType && data.jobType) {
      await db.update(jobTemplates)
        .set({ isDefaultForJobType: false, updatedAt: new Date() })
        .where(and(
          eq(jobTemplates.companyId, companyId),
          eq(jobTemplates.jobType, data.jobType),
          eq(jobTemplates.isDefaultForJobType, true)
        ));
    }

    const [template] = await db.insert(jobTemplates)
      .values({
        ...data,
        companyId,
      })
      .returning();

    // Insert line items
    if (lines.length > 0) {
      await db.insert(jobTemplateLineItems)
        .values(lines.map((line, index) => ({
          templateId: template.id,
          productId: line.productId,
          descriptionOverride: line.descriptionOverride ?? null,
          quantity: String(line.quantity ?? '1'),
          unitPriceOverride: line.unitPriceOverride ? String(line.unitPriceOverride) : null,
          sortOrder: line.sortOrder ?? index,
        })));
    }

    return template;
  }

  async updateJobTemplate(companyId: string, id: string, data: UpdateJobTemplate, lines?: Omit<InsertJobTemplateLineItem, 'templateId'>[]): Promise<JobTemplate | undefined> {
    // Verify template belongs to company
    const existing = await this.getJobTemplate(companyId, id);
    if (!existing) return undefined;

    // If setting as default for a job type, first unset any existing default
    if (data.isDefaultForJobType && data.jobType) {
      await db.update(jobTemplates)
        .set({ isDefaultForJobType: false, updatedAt: new Date() })
        .where(and(
          eq(jobTemplates.companyId, companyId),
          eq(jobTemplates.jobType, data.jobType),
          eq(jobTemplates.isDefaultForJobType, true)
        ));
    }

    const [updated] = await db.update(jobTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(jobTemplates.id, id))
      .returning();

    // If lines provided, replace them
    if (lines !== undefined) {
      await db.delete(jobTemplateLineItems)
        .where(eq(jobTemplateLineItems.templateId, id));

      if (lines.length > 0) {
        await db.insert(jobTemplateLineItems)
          .values(lines.map((line, index) => ({
            templateId: id,
            productId: line.productId,
            descriptionOverride: line.descriptionOverride ?? null,
            quantity: String(line.quantity ?? '1'),
            unitPriceOverride: line.unitPriceOverride ? String(line.unitPriceOverride) : null,
            sortOrder: line.sortOrder ?? index,
          })));
      }
    }

    return updated;
  }

  async deleteJobTemplate(companyId: string, id: string): Promise<boolean> {
    const existing = await this.getJobTemplate(companyId, id);
    if (!existing) return false;

    const result = await db.delete(jobTemplates)
      .where(eq(jobTemplates.id, id))
      .returning();
    
    return result.length > 0;
  }

  async setJobTemplateAsDefault(companyId: string, id: string, jobType: string): Promise<JobTemplate | undefined> {
    // Unset any existing default for this job type
    await db.update(jobTemplates)
      .set({ isDefaultForJobType: false, updatedAt: new Date() })
      .where(and(
        eq(jobTemplates.companyId, companyId),
        eq(jobTemplates.jobType, jobType),
        eq(jobTemplates.isDefaultForJobType, true)
      ));

    // Set the new default
    const [updated] = await db.update(jobTemplates)
      .set({ 
        isDefaultForJobType: true, 
        jobType,
        updatedAt: new Date() 
      })
      .where(and(
        eq(jobTemplates.id, id),
        eq(jobTemplates.companyId, companyId)
      ))
      .returning();

    return updated;
  }

  async getDefaultJobTemplateForJobType(companyId: string, jobType: string): Promise<JobTemplate | undefined> {
    const result = await db.select()
      .from(jobTemplates)
      .where(and(
        eq(jobTemplates.companyId, companyId),
        eq(jobTemplates.jobType, jobType),
        eq(jobTemplates.isDefaultForJobType, true),
        eq(jobTemplates.isActive, true)
      ))
      .limit(1);
    return result[0];
  }

  async applyJobTemplateToJob(companyId: string, jobId: string, templateId: string): Promise<JobPart[]> {
    // Verify job exists and belongs to company
    const job = await this.getJob(companyId, jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Verify template exists and belongs to company
    const template = await this.getJobTemplate(companyId, templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    // Always replace job description with template description (or clear if template has none)
    await this.updateJob(companyId, jobId, { description: template.description || null });

    // Get template line items
    const templateLines = await this.getJobTemplateLineItems(templateId);
    if (templateLines.length === 0) {
      return [];
    }

    // Get existing job parts count to determine sortOrder start
    const existingParts = await this.getJobParts(jobId);
    const startSortOrder = existingParts.length;

    // Get product details for each line item
    const productIds = templateLines.map(line => line.productId);
    const products = await db.select()
      .from(partsTable)
      .where(inArray(partsTable.id, productIds));
    
    const productMap = new Map(products.map(p => [p.id, p]));

    // Create job parts from template lines
    const createdParts: JobPart[] = [];
    for (let i = 0; i < templateLines.length; i++) {
      const line = templateLines[i];
      const product = productMap.get(line.productId);
      if (!product) continue;

      const description = line.descriptionOverride ?? product.description ?? product.name ?? 'Unknown item';
      const unitPrice = line.unitPriceOverride ?? product.unitPrice ?? '0';
      const quantity = line.quantity ?? '1';

      const [created] = await db.insert(jobParts)
        .values({
          jobId,
          productId: line.productId,
          description,
          quantity,
          unitPrice,
          unitCost: product.cost ?? null,
          source: 'manual',
          sortOrder: startSortOrder + i,
          isActive: true,
        })
        .returning();
      
      createdParts.push(created);
    }

    return createdParts;
  }

  async cloneJobTemplate(companyId: string, id: string): Promise<JobTemplate | undefined> {
    const original = await this.getJobTemplate(companyId, id);
    if (!original) return undefined;

    const lines = await this.getJobTemplateLineItems(id);

    const clonedData = {
      name: `${original.name} (Copy)`,
      jobType: original.jobType ?? null,
      description: original.description ?? null,
      isDefaultForJobType: false,
      isActive: true,
    };

    const clonedLines = lines.map((line, index) => ({
      productId: line.productId,
      descriptionOverride: line.descriptionOverride ?? null,
      quantity: line.quantity ?? '1',
      unitPriceOverride: line.unitPriceOverride ?? null,
      sortOrder: line.sortOrder ?? index,
    }));

    return this.createJobTemplate(companyId, clonedData, clonedLines);
  }
}

export const storage = new DbStorage();
