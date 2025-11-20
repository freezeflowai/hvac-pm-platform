import { StripeSync } from 'stripe-replit-sync';
import { getStripeSecretKey, getStripeWebhookSecret } from './stripeClient';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

let stripeSync: StripeSync | null = null;

async function getStripeSync(): Promise<StripeSync> {
  if (!stripeSync) {
    const secretKey = await getStripeSecretKey();
    const webhookSecret = await getStripeWebhookSecret();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
      stripeWebhookSecret: webhookSecret,
    });
  }
  return stripeSync;
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }
    
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature, undefined);
    
    // Parse the event to handle subscription updates
    const stripe = await import('stripe').then(m => m.default);
    const webhookSecret = await getStripeWebhookSecret();
    const secretKey = await getStripeSecretKey();
    const stripeClient = new stripe(secretKey, { apiVersion: '2025-10-29.clover' });
    
    const event = stripeClient.webhooks.constructEvent(payload, signature, webhookSecret);
    
    // Handle subscription lifecycle events
    if (event.type === 'customer.subscription.updated' || 
        event.type === 'customer.subscription.deleted' ||
        event.type === 'customer.subscription.created') {
      const subscription = event.data.object as any;
      
      // Find user by stripe customer ID
      const [user] = await db.select()
        .from(users)
        .where(eq(users.stripeCustomerId, subscription.customer));
      
      if (user) {
        const updateData: any = {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        };
        
        // Map Stripe subscription to plan name
        if (subscription.items?.data?.[0]?.price?.id) {
          const priceId = subscription.items.data[0].price.id;
          // We'll look up the plan by stripe price ID in storage layer
          // For now just update the subscription ID
        }
        
        await db.update(users)
          .set(updateData)
          .where(eq(users.id, user.id));
      }
    }
    
    // Handle checkout session completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      
      if (session.customer && session.subscription) {
        const [user] = await db.select()
          .from(users)
          .where(eq(users.stripeCustomerId, session.customer));
        
        if (user) {
          await db.update(users)
            .set({
              stripeSubscriptionId: session.subscription as string,
              subscriptionStatus: 'active',
            })
            .where(eq(users.id, user.id));
        }
      }
    }
  }
}
