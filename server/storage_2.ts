
import { db } from "./db";
import {
  users,
  companies,
  invoices,
  jobs,
  calendarAssignments,
} from "../shared/schema";

export const storage = {
  async getCalendarAssignments(companyId: string) {
    return db.select().from(calendarAssignments).where({ companyId });
  },
};
