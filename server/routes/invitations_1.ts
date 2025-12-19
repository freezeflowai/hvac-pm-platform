
import express from "express";
import { createInvitation, acceptInvitation } from "../services/invitations";

const router = express.Router();

router.post("/", async (req, res) => {
  const { email, role } = req.body;
  const token = await createInvitation(req.user.companyId, email, role, req.user.id);
  res.json({ token });
});

router.post("/accept", async (req, res) => {
  const { token, passwordHash } = req.body;
  const user = await acceptInvitation(token, passwordHash);
  res.json({ success: true, user });
});

export default router;
