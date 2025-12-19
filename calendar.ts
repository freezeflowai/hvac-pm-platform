
import express from "express";
import { resizeJobTime } from "../services/calendarService";

const router = express.Router();

router.post("/resize", async (req, res) => {
  const { job, newEndTime } = req.body;
  const updated = resizeJobTime(job, newEndTime);
  res.json(updated);
});

export default router;
