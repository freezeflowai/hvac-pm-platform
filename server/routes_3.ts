
import express from "express";
import invitations from "./routes/invitations";
import { requireAuth } from "./auth/requireAuth";
import { attachUserContext } from "./auth/attachUserContext";

const app = express();

app.use(express.json());
app.use(attachUserContext);

app.use("/api/invitations", invitations);

// all routes below require auth
app.use(requireAuth);

// ... existing protected routes remain unchanged

export default app;
