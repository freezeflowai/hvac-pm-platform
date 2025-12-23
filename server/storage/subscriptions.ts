import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { clients, companies, subscriptionPlans } from "@shared/schema";
import { BaseRepository } from "./base";

export class SubscriptionRepository extends BaseRepository {
  /**
   * Get subscription usage info for a company
   */
  async getSubscriptionUsage(companyId: string) {
    // Get company info
    const company = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company[0]) {
      throw this.notFoundError("Company");
    }

    // Get active client count
    const clientCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(and(eq(clients.companyId, companyId), eq(clients.inactive, false)));

    // Get plan info
    let plan = null;
    if (company[0].subscriptionPlan) {
      const planRows = await db
        .select()
        .from(subscriptionPlans)
        .where(
          and(
            eq(subscriptionPlans.name, company[0].subscriptionPlan),
            eq(subscriptionPlans.active, true)
          )
        )
        .limit(1);

      plan = planRows[0] ?? null;
    }

    // Default to trial plan if no plan set
    if (!plan) {
      const trialPlan = await db
        .select()
        .from(subscriptionPlans)
        .where(
          and(eq(subscriptionPlans.name, "trial"), eq(subscriptionPlans.active, true))
        )
        .limit(1);

      plan = trialPlan[0] ?? null;
    }

    const locations = Number(clientCount[0]?.count || 0);
    const percentUsed =
      plan && plan.locationLimit > 0
        ? Math.round((locations / plan.locationLimit) * 100)
        : 0;

    return {
      plan: plan
        ? {
            name: plan.name,
            displayName: plan.displayName,
            locationLimit: plan.locationLimit,
            price: plan.monthlyPriceCents ? plan.monthlyPriceCents / 100 : 0,
          }
        : null,
      usage: {
        locations,
      },
      percentUsed,
      trialEndsAt: company[0].trialEndsAt?.toISOString() || null,
      subscriptionStatus: company[0].subscriptionStatus || null,
    };
  }

  /**
   * Check if company can add more locations
   */
  async canAddLocation(companyId: string) {
    const usage = await this.getSubscriptionUsage(companyId);

    if (!usage.plan) {
      return {
        allowed: false,
        reason: "No active plan found",
        current: usage.usage.locations,
        limit: 0,
      };
    }

    // Check if subscription is active
    const company = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company[0]) {
      return {
        allowed: false,
        reason: "Company not found",
        current: 0,
        limit: 0,
      };
    }

    // Check trial expiration
    if (
      company[0].subscriptionStatus === "trial" &&
      company[0].trialEndsAt &&
      new Date(company[0].trialEndsAt) < new Date()
    ) {
      return {
        allowed: false,
        reason: "Your free trial has expired. Please upgrade to continue.",
        current: usage.usage.locations,
        limit: usage.plan.locationLimit,
      };
    }

    // Check active subscription
    const activeStatuses = ["trial", "trialing", "active"];
    if (!activeStatuses.includes(company[0].subscriptionStatus)) {
      return {
        allowed: false,
        reason:
          "Your subscription is not active. Please update your payment method.",
        current: usage.usage.locations,
        limit: usage.plan.locationLimit,
      };
    }

    // Check location limit
    if (usage.usage.locations >= usage.plan.locationLimit) {
      return {
        allowed: false,
        reason: `You've reached your plan limit of ${usage.plan.locationLimit} locations. Upgrade to add more.`,
        current: usage.usage.locations,
        limit: usage.plan.locationLimit,
      };
    }

    return {
      allowed: true,
      current: usage.usage.locations,
      limit: usage.plan.locationLimit,
    };
  }
}

export const subscriptionRepository = new SubscriptionRepository();