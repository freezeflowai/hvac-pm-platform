
import express from "express";
import { attachUserContext } from "./auth/attachUserContext";
import { requireAuth } from "./auth/requireAuth";

import invitations from "./routes/invitations";
import invitationsResend from "./routes/invitations_resend";
import usersAdmin from "./routes/users_admin";

// existing route imports
import jobs from "./routes/jobs";
import invoices from "./routes/invoices";

const app = express();

app.use(express.json());
app.use(attachUserContext);

// public routes
app.use("/api/invitations/accept", invitations);

// protected routes
app.use(requireAuth);

app.use("/api/invitations", invitations);
app.use("/api/invitations", invitationsResend);
app.use("/api/users", usersAdmin);

// existing protected routes
app.use("/api/jobs", jobs);
app.use("/api/invoices", invoices);

export default app;
