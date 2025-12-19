
import express from "express";
import { refreshInvoiceFromJob } from "../services/invoiceSync";

const router = express.Router();

router.post("/:id/refresh-from-job", async (req, res) => {
  const { job, invoice } = req.body;
  const updated = refreshInvoiceFromJob(job, invoice);
  res.json(updated);
});

export default router;
