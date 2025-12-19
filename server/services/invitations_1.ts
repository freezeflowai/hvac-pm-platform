
import crypto from "crypto";
import { db } from "../storage";
import { invitations } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

export async function createInvitation(companyId: string, email: string, role: string, invitedBy: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const existing = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.companyId, companyId),
      eq(invitations.email, email.toLowerCase()),
      eq(invitations.status, "pending")
    )
  });

  if (existing) throw new Error("Invitation already exists");

  await db.insert(invitations).values({
    companyId,
    email: email.toLowerCase(),
    role,
    token,
    expiresAt
  });

  return token;
}

export async function acceptInvitation(token: string, passwordHash: string) {
  return db.transaction(async (tx) => {
    const invite = await tx.query.invitations.findFirst({
      where: eq(invitations.token, token)
    });

    if (!invite || invite.status !== "pending") {
      throw new Error("Invalid invitation");
    }

    if (invite.expiresAt < new Date()) {
      throw new Error("Invitation expired");
    }

    const user = await tx.insertInto("users").values({
      email: invite.email,
      passwordHash,
      companyId: invite.companyId,
      role: invite.role
    }).returning();

    await tx.update(invitations)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(invitations.id, invite.id));

    return user;
  });
}
