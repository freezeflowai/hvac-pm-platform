import { db } from './db';
import { users, subscriptionPlans, clients } from '@shared/schema';
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

    // If subscription plan name is set, get that plan
    if (user.subscriptionPlan) {
      const plan = await this.getPlanByName(user.subscriptionPlan);
      if (plan) return plan;
    }

    // Default to trial
    return await this.getPlanByName('trial');
  }

  // Check if user's trial has expired
  isTrialExpired(user: any): boolean {
    if (!user.trialEndsAt) return false;
    return new Date(user.trialEndsAt) < new Date();
  }

  // Check if user's subscription is active
  isSubscriptionActive(user: any): boolean {
    const activeStatuses = ['trial', 'trialing', 'active'];
    
    // Check trial expiration
    if (user.subscriptionStatus === 'trial' && this.isTrialExpired(user)) {
      return false;
    }

    return activeStatuses.includes(user.subscriptionStatus);
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

    // Check if subscription is active
    if (!this.isSubscriptionActive(user)) {
      return { 
        allowed: false, 
        reason: user.subscriptionStatus === 'trial' && this.isTrialExpired(user)
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

  // Assign plan to user
  async assignPlanToUser(userId: string, planName: string, setTrial: boolean = false) {
    const plan = await this.getPlanByName(planName);
    if (!plan) {
      throw new Error(`Plan ${planName} not found`);
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

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    return await this.getUserPlan(userId);
  }

  // Get subscription usage info for a user
  async getUsageInfo(userId: string) {
    const plan = await this.getUserPlan(userId);
    const locationCount = await this.getUserLocationCount(userId);
    const [user] = await db.select().from(users).where(eq(users.id, userId));

    return {
      plan: plan ? {
        name: plan.name,
        displayName: plan.displayName,
        locationLimit: plan.locationLimit,
        monthlyPriceCents: plan.monthlyPriceCents,
      } : null,
      usage: {
        locations: locationCount,
        limit: plan?.locationLimit || 0,
        percentage: plan ? Math.round((locationCount / plan.locationLimit) * 100) : 0,
      },
      subscription: {
        status: user?.subscriptionStatus || 'trial',
        trialEndsAt: user?.trialEndsAt,
        isTrialExpired: user ? this.isTrialExpired(user) : false,
        isActive: user ? this.isSubscriptionActive(user) : false,
      }
    };
  }
}

export const subscriptionService = new SubscriptionService();
