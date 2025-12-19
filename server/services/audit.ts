
import { db } from "../storage";
import { auditLogs } from "../../shared/schema";

export async function writeAuditLog({
  companyId,
  userId,
  action,
  entity,
  entityId,
  metadata
}: {
  companyId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: any;
}) {
  await db.insert(auditLogs).values({
    companyId,
    userId,
    action,
    entity,
    entityId,
    metadata
  });
}
