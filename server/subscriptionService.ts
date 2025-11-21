import { db } from './db';
import { users, companies, subscriptionPlans, clients } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export class SubscriptionService {
  // Check if subscriptions are enabled
  isEnabled(): boolean {
    return process.env.ENABLE_SUBSCRIPTIONS === 'true';
  }

  // Get plan by name
  async getPlanByName(name: string) {
    const [plan] = await db.select()
      .from(subscriptionPlans)
      .where(and(
        eq(subscriptionPlans.name, name),
        eq(subscriptionPlans.active, true)
      ));
    return plan || null;
  }

  // Get all active plans
  async getActivePlans() {
    return await db.select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.active, true))
      .orderBy(subscriptionPlans.sortOrder);
  }

  // Get user's current plan
  async getUserPlan(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return null;

    // Get company subscription plan
    const [company] = await db.select().from(companies).where(eq(companies.id, user.companyId));
    if (!company) return await this.getPlanByName('trial');

    // If subscription plan name is set, get that plan
    if (company.subscriptionPlan) {
      const plan = await this.getPlanByName(company.subscriptionPlan);
      if (plan) return plan;
    }

    // Default to trial
    return await this.getPlanByName('trial');
  }

  // Check if company's trial has expired
  isTrialExpired(company: any): boolean {
    if (!company.trialEndsAt) return false;
    return new Date(company.trialEndsAt) < new Date();
  }

  // Check if company's subscription is active
  isSubscriptionActive(company: any): boolean {
    const activeStatuses = ['trial', 'trialing', 'active'];
    
    // Check trial expiration
    if (company.subscriptionStatus === 'trial' && this.isTrialExpired(company)) {
      return false;
    }

    return activeStatuses.includes(company.subscriptionStatus);
  }

  // Get user's current location count
  async getUserLocationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(and(
        eq(clients.userId, userId),
        eq(clients.inactive, false)
      ));
    return Number(result[0]?.count || 0);
  }

  // Check if user can add more locations
  async canAddLocation(userId: string): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
    if (!this.isEnabled()) {
      return { allowed: true, current: 0, limit: 999999 };
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return { allowed: false, reason: 'User not found', current: 0, limit: 0 };
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, user.companyId));
    if (!company) {
      return { allowed: false, reason: 'Company not found', current: 0, limit: 0 };
    }

    // Check if subscription is active
    if (!this.isSubscriptionActive(company)) {
      return { 
        allowed: false, 
        reason: company.subscriptionStatus === 'trial' && this.isTrialExpired(company)
          ? 'Your free trial has expired. Please upgrade to continue.'
          : 'Your subscription is not active. Please update your payment method.',
        current: 0,
        limit: 0
      };
    }

    const plan = await this.getUserPlan(userId);
    if (!plan) {
      return { allowed: false, reason: 'No active plan found', current: 0, limit: 0 };
    }

    const currentCount = await this.getUserLocationCount(userId);
    
    if (currentCount >= plan.locationLimit) {
      return {
        allowed: false,
        reason: `You've reached your plan limit of ${plan.locationLimit} locations. Upgrade to add more.`,
        current: currentCount,
        limit: plan.locationLimit
      };
    }

    return {
      allowed: true,
      current: currentCount,
      limit: plan.locationLimit
    };
  }

  // Assign plan to user (updates company subscription)
  async assignPlanToUser(userId: string, planName: string, setTrial: boolean = false) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error('User not found');
    }

    const plan = await this.getPlanByName(planName);
    if (!plan) {
      throw new Error(`Plan '${planName}' not found or not active`);
    }

    const updateData: any = {
      subscriptionPlan: plan.name,
      subscriptionStatus: plan.isTrial ? 'trial' : 'active',
    };

    if (setTrial && plan.isTrial && plan.trialDays) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + plan.trialDays);
      updateData.trialEndsAt = trialEndsAt;
    }

    try {
      await db.update(companies)
        .set(updateData)
        .where(eq(companies.id, user.companyId));
      
      return await this.getUserPlan(userId);
    } catch (error: any) {
      console.error("Error updating company subscription:", error);
      throw new Error(`Failed to update subscription: ${error.message}`);
    }
  }

  // Get subscription usage info for a user
  async getUsageInfo(userId: string) {
    const plan = await this.getUserPlan(userId);
    const locationCount = await this.getUserLocationCount(userId);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const [company] = await db.select().from(companies).where(eq(companies.id, user?.companyId || ''));

    const percentUsed = plan && plan.locationLimit > 0 
      ? Math.round((locationCount / plan.locationLimit) * 100) 
      : 0;

    return {
      plan: plan ? {
        name: plan.name,
        displayName: plan.displayName,
        locationLimit: plan.locationLimit,
        price: plan.monthlyPriceCents / 100, // Convert cents to dollars
      } : null,
      usage: {
        locations: locationCount,
      },
      percentUsed,
      trialEndsAt: company?.trialEndsAt?.toISOString() || null,
      subscriptionStatus: company?.subscriptionStatus || null,
    };
  }
}

export const subscriptionService = new SubscriptionService();
