import { db } from "../db";
import { eq, and, isNotNull, desc, sql } from "drizzle-orm";
import { calendarAssignments, clients } from "@shared/schema";
import { BaseRepository } from "./base";

export class MaintenanceRepository extends BaseRepository {
  /**
   * Get recently completed maintenance assignments
   */
  async getMaintenanceRecentlyCompleted(companyId: string, limit: number = 50) {
    return await db
      .select({
        assignment: calendarAssignments,
        client: clients,
      })
      .from(calendarAssignments)
      .innerJoin(clients, eq(calendarAssignments.clientId, clients.id))
      .where(
        and(
          eq(calendarAssignments.companyId, companyId),
          eq(calendarAssignments.completed, true),
          isNotNull(calendarAssignments.completionNotes)
        )
      )
      .orderBy(desc(calendarAssignments.scheduledDate))
      .limit(limit);
  }

  /**
   * Get maintenance status summary
   */
  async getMaintenanceStatuses(companyId: string) {
    const result = await db
      .select({
        status: sql<string>`
          CASE 
            WHEN ${calendarAssignments.completed} = true THEN 'completed'
            WHEN ${calendarAssignments.scheduledDate} < CURRENT_DATE THEN 'overdue'
            WHEN ${calendarAssignments.scheduledDate} = CURRENT_DATE THEN 'today'
            ELSE 'scheduled'
          END
        `,
        count: sql<number>`count(*)`,
      })
      .from(calendarAssignments)
      .where(eq(calendarAssignments.companyId, companyId))
      .groupBy(sql`status`);

    return result;
  }
}

export const maintenanceRepository = new MaintenanceRepository();