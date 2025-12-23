import express from "express";
import { resizeJobTime } from "../services/calendarService";

/**
 * Calendar API
 *
 * The frontend expects `calendarData.assignments` to always exist.
 * Even when there are no assignments, we must return:
 *   { assignments: [] }
 *
 * Note: this module currently provides "contract-first" responses so the UI doesn't crash.
 * You can evolve these handlers later to return real assignment data from the DB.
 */
const router = express.Router();

// Basic calendar payload used by Dashboard
router.get("/", async (_req, res) => {
  res.json({ assignments: [] });
});

// Common alias endpoint (some clients call /assignments)
router.get("/assignments", async (_req, res) => {
  res.json({ assignments: [] });
});

// Lists used by various calendar widgets; keep contract stable (array)
router.get("/unscheduled", async (_req, res) => {
  res.json([]);
});

router.get("/overdue", async (_req, res) => {
  res.json([]);
});

router.get("/old-unscheduled", async (_req, res) => {
  res.json([]);
});

// Resize job block on calendar (used for drag-to-extend)
router.post("/resize", async (req, res) => {
  const { job, newEndTime } = req.body;
  const updated = await resizeJobTime(job, newEndTime);
  res.json(updated);
});

export default router;
