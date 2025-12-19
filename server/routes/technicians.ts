
import express from "express";
import { createTechnician } from "../services/technicians";

const router = express.Router();

router.post("/", async (req, res) => {
  const { name, userId } = req.body;
  const tech = await createTechnician(req.user.companyId, name, userId);
  res.json(tech);
});

export default router;
