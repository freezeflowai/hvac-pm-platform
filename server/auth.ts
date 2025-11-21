import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { User, AuthenticatedUser } from "@shared/schema";

passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return done(null, false, { message: "Invalid email or password" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return done(null, false, { message: "Invalid email or password" });
      }

      return done(null, user as any);
    } catch (error) {
      return done(error);
    }
  })
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    if (!user) {
      return done(null, false);
    }
    
    // Fetch company data to merge subscription fields
    const company = await storage.getCompanyById(user.companyId);
    if (!company) {
      return done(null, false);
    }
    
    // Merge user + company subscription data
    const authenticatedUser: AuthenticatedUser = {
      ...user,
      trialEndsAt: company.trialEndsAt,
      subscriptionStatus: company.subscriptionStatus,
      subscriptionPlan: company.subscriptionPlan,
      stripeCustomerId: company.stripeCustomerId,
      stripeSubscriptionId: company.stripeSubscriptionId,
      billingInterval: company.billingInterval,
      currentPeriodEnd: company.currentPeriodEnd,
      cancelAtPeriodEnd: company.cancelAtPeriodEnd
    };
    
    done(null, authenticatedUser as any);
  } catch (error: any) {
    console.error("Deserialize user error:", error);
    done(error);
  }
});

export { passport };

// Middleware to check if user is authenticated
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}

// Middleware to check if user is an admin or owner
export function isAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const userRole = req.user?.role;
  if (userRole !== "owner" && userRole !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
  
  next();
}

// Middleware to require admin for mutating operations
export function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const userRole = req.user?.role;
  if (userRole !== "owner" && userRole !== "admin") {
    return res.status(403).json({ error: "Technicians have read-only access" });
  }
  
  next();
}

// Middleware to ensure user can only access their company's data
export function requireCompanyAccess(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  if (!req.user?.companyId) {
    return res.status(403).json({ error: "User not associated with a company" });
  }
  
  // Store companyId in request for use in routes
  req.companyId = req.user.companyId;
  next();
}
