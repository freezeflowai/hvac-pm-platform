import { db } from "./db";
import { eq } from "drizzle-orm";
import { users, companies, calendarAssignments } from "@shared/schema";

/**
 * NOTE:
 * This file was incomplete in your current build (literal "..." placeholders and missing exports),
 * which caused runtime failures like: "storage.getJobs is not a function".
 *
 * The goal of this replacement is to:
 *  1) Restore all exports used by routers so the server compiles and runs.
 *  2) Provide safe defaults for key "list" reads so the UI doesn't instantly crash.
 *  3) Fail loudly (501) for unimplemented mutations until the full storage layer is restored.
 */

function notImplemented(fn: string): never {
  const err: any = new Error(`storage.${fn} is not implemented in this build`);
  err.status = 501;
  throw err;
}

// --- AUTH SUPPORT (real DB implementations) ---
export async function getUser(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string) {
  const normalized = (email || "").trim().toLowerCase();
  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(userData: any) {
  const rows = await db.insert(users).values(userData).returning();
  return rows[0] ?? null;
}

export async function updateUser(id: string, patch: any) {
  const rows = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  return rows[0] ?? null;
}

export async function getCompanyById(companyId: string) {
  const rows = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  return rows[0] ?? null;
}

export async function getCalendarAssignments(companyId: string) {
  // Some parts of the app expect "all calendar assignments" for derived client due dates, etc.
  // If schema differs, adjust the where clause to match your actual column.
  const col: any = (calendarAssignments as any).companyId ?? (calendarAssignments as any).company_id;
  if (!col) {
    // If companyId column can't be resolved, return all (fallback).
    return await db.select().from(calendarAssignments);
  }
  return await db.select().from(calendarAssignments).where(eq(col, companyId));
}

// Aliases used by some routers
export async function getAllCalendarAssignments(companyId: string) {
  return getCalendarAssignments(companyId);
}


export async function addClientPart(..._args: any[]) {
  return notImplemented("addClientPart");
}
export async function applyJobTemplateToJob(..._args: any[]) {
  return notImplemented("applyJobTemplateToJob");
}
export async function cleanupInvalidCalendarAssignments(..._args: any[]) {
  return notImplemented("cleanupInvalidCalendarAssignments");
}
export async function cloneJobTemplate(..._args: any[]) {
  return notImplemented("cloneJobTemplate");
}
export async function createClient(..._args: any[]) {
  return notImplemented("createClient");
}
export async function createClientWithParts(..._args: any[]) {
  return notImplemented("createClientWithParts");
}
export async function createEquipment(..._args: any[]) {
  return notImplemented("createEquipment");
}
export async function createJob(..._args: any[]) {
  return notImplemented("createJob");
}
export async function createJobEquipment(..._args: any[]) {
  return notImplemented("createJobEquipment");
}
export async function createJobPart(..._args: any[]) {
  return notImplemented("createJobPart");
}
export async function createJobTemplate(..._args: any[]) {
  return notImplemented("createJobTemplate");
}
export async function createPart(..._args: any[]) {
  return notImplemented("createPart");
}
export async function deactivateTeamMember(..._args: any[]) {
  return notImplemented("deactivateTeamMember");
}
export async function deleteAllClientParts(..._args: any[]) {
  return notImplemented("deleteAllClientParts");
}
export async function deleteClient(..._args: any[]) {
  return notImplemented("deleteClient");
}
export async function deleteClients(..._args: any[]) {
  return notImplemented("deleteClients");
}
export async function deleteJob(..._args: any[]) {
  return notImplemented("deleteJob");
}
export async function deleteJobEquipment(..._args: any[]) {
  return notImplemented("deleteJobEquipment");
}
export async function deleteJobPart(..._args: any[]) {
  return notImplemented("deleteJobPart");
}
export async function deleteJobTemplate(..._args: any[]) {
  return notImplemented("deleteJobTemplate");
}
export async function getAllClients(..._args: any[]) {
  // Temporary safe default to keep the API responsive if storage is partially implemented.
  // Replace with real DB logic as you restore the full codebase.
  return [];
}
export async function getAssignmentsByClient(..._args: any[]) {
  // Temporary safe default to keep the API responsive if storage is partially implemented.
  // Replace with real DB logic as you restore the full codebase.
  return [];
}
export async function getClient(..._args: any[]) {
  // Temporary safe default.
  return null;
}
export async function getClientReport(..._args: any[]) {
  // Temporary safe default to keep the API responsive if storage is partially implemented.
  // Replace with real DB logic as you restore the full codebase.
  return [];
}
export async function getCustomerCompany(..._args: any[]) {
  return notImplemented("getCustomerCompany");
}
export async function getDefaultJobTemplateForJobType(..._args: any[]) {
  return notImplemented("getDefaultJobTemplateForJobType");
}
export async function getJob(..._args: any[]) {
  return notImplemented("getJob");
}
export async function getJobEquipment(..._args: any[]) {
  return notImplemented("getJobEquipment");
}
export async function getJobParts(..._args: any[]) {
  // Temporary safe default to keep the API responsive if storage is partially implemented.
  // Replace with real DB logic as you restore the full codebase.
  return [];
}
export async function getJobTemplate(..._args: any[]) {
  return notImplemented("getJobTemplate");
}
export async function getJobTemplateLineItems(..._args: any[]) {
  return notImplemented("getJobTemplateLineItems");
}
export async function getJobTemplates(..._args: any[]) {
  // Temporary safe default to keep the API responsive if storage is partially implemented.
  // Replace with real DB logic as you restore the full codebase.
  return [];
}
export async function getJobs(..._args: any[]) {
  // Temporary safe default to keep the API responsive if storage is partially implemented.
  // Replace with real DB logic as you restore the full codebase.
  return [];
}
export async function getLocationEquipmentItem(..._args: any[]) {
  return notImplemented("getLocationEquipmentItem");
}
export async function getRecurringSeries(..._args: any[]) {
  return notImplemented("getRecurringSeries");
}
export async function getTeamMember(..._args: any[]) {
  return notImplemented("getTeamMember");
}
export async function getTeamMembers(..._args: any[]) {
  // Temporary safe default to keep the API responsive if storage is partially implemented.
  // Replace with real DB logic as you restore the full codebase.
  return [];
}
export async function getTechnicianProfile(..._args: any[]) {
  // Temporary safe default.
  return null;
}
export async function getTechniciansByCompanyId(..._args: any[]) {
  return notImplemented("getTechniciansByCompanyId");
}
export async function getUserPermissionOverrides(..._args: any[]) {
  // Temporary safe default to keep the API responsive if storage is partially implemented.
  // Replace with real DB logic as you restore the full codebase.
  return [];
}
export async function getWorkingHours(..._args: any[]) {
  // Temporary safe default to keep the API responsive if storage is partially implemented.
  // Replace with real DB logic as you restore the full codebase.
  return [];
}
export async function reconcileJobInvoiceLinks(..._args: any[]) {
  return notImplemented("reconcileJobInvoiceLinks");
}
export async function reorderJobParts(..._args: any[]) {
  return notImplemented("reorderJobParts");
}
export async function setJobTemplateAsDefault(..._args: any[]) {
  return notImplemented("setJobTemplateAsDefault");
}
export async function setUserPermissionOverrides(..._args: any[]) {
  return notImplemented("setUserPermissionOverrides");
}
export async function setWorkingHours(..._args: any[]) {
  return notImplemented("setWorkingHours");
}
export async function updateClient(..._args: any[]) {
  return notImplemented("updateClient");
}
export async function updateJob(..._args: any[]) {
  return notImplemented("updateJob");
}
export async function updateJobEquipment(..._args: any[]) {
  return notImplemented("updateJobEquipment");
}
export async function updateJobPart(..._args: any[]) {
  return notImplemented("updateJobPart");
}
export async function updateJobStatus(..._args: any[]) {
  return notImplemented("updateJobStatus");
}
export async function updateJobTemplate(..._args: any[]) {
  return notImplemented("updateJobTemplate");
}
export async function updateTeamMember(..._args: any[]) {
  return notImplemented("updateTeamMember");
}
export async function upsertTechnicianProfile(..._args: any[]) {
  return notImplemented("upsertTechnicianProfile");
}

export const storage = {
  getUser,
  getUserByEmail,
  createUser,
  updateUser,
  getCompanyById,
  getCalendarAssignments,
  getAllCalendarAssignments,
  addClientPart,
  applyJobTemplateToJob,
  cleanupInvalidCalendarAssignments,
  cloneJobTemplate,
  createClient,
  createClientWithParts,
  createEquipment,
  createJob,
  createJobEquipment,
  createJobPart,
  createJobTemplate,
  createPart,
  deactivateTeamMember,
  deleteAllClientParts,
  deleteClient,
  deleteClients,
  deleteJob,
  deleteJobEquipment,
  deleteJobPart,
  deleteJobTemplate,
  getAllClients,
  getAssignmentsByClient,
  getClient,
  getClientReport,
  getCustomerCompany,
  getDefaultJobTemplateForJobType,
  getJob,
  getJobEquipment,
  getJobParts,
  getJobTemplate,
  getJobTemplateLineItems,
  getJobTemplates,
  getJobs,
  getLocationEquipmentItem,
  getRecurringSeries,
  getTeamMember,
  getTeamMembers,
  getTechnicianProfile,
  getTechniciansByCompanyId,
  getUserPermissionOverrides,
  getWorkingHours,
  reconcileJobInvoiceLinks,
  reorderJobParts,
  setJobTemplateAsDefault,
  setUserPermissionOverrides,
  setWorkingHours,
  updateClient,
  updateJob,
  updateJobEquipment,
  updateJobPart,
  updateJobStatus,
  updateJobTemplate,
  updateTeamMember,
  upsertTechnicianProfile,
};

export default storage;
