
import express from "express";
import { resendInvitation } from "../services/invitations_resend";
import { requireRole } from "../auth/requireRole";

const router = express.Router();

router.post("/:id/resend", requireRole(["admin","dispatcher"]), async (req, res) => {
  const token = await resendInvitation(req.params.id);
  res.json({ token });
});

export default router;
