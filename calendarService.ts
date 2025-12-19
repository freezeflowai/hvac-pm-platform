
import { CALENDAR_RULES } from "../../shared/calendarRules";

export function resizeJobTime(job, newEndTime) {
  if (!CALENDAR_RULES.allowResize) {
    throw new Error("Resize not allowed");
  }

  return {
    ...job,
    endTime: newEndTime,
    updatedFrom: "calendar",
  };
}
