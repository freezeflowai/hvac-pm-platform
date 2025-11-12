import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { AuthUser, SerializedAuthUser, ContractorAuthUser, ClientPortalAuthUser } from "./auth-types";

// Contractor authentication strategy
passport.use(
  "contractor-local",
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

      const authUser: ContractorAuthUser = { ...user, userType: 'contractor' as const };
      return done(null, authUser as any);
    } catch (error) {
      return done(error);
    }
  })
);

// Client portal authentication strategy
passport.use(
  "client-local",
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const clientUser = await storage.getClientUserByEmail(email);
      
      if (!clientUser) {
        return done(null, false, { message: "Invalid email or password" });
      }

      const isValidPassword = await bcrypt.compare(password, clientUser.password);
      
      if (!isValidPassword) {
        return done(null, false, { message: "Invalid email or password" });
      }

      // Check if portal is enabled for this client
      const client = await storage.getClientById(clientUser.clientId);
      if (!client || !client.portalEnabled) {
        return done(null, false, { message: "Portal access not enabled" });
      }

      // Update last portal login
      await storage.updateClientLastPortalLogin(clientUser.clientId);

      const authUser: ClientPortalAuthUser = { ...clientUser, userType: 'client' as const };
      return done(null, authUser as any);
    } catch (error) {
      return done(error);
    }
  })
);

passport.serializeUser<SerializedAuthUser>((user, done) => {
  const authUser = user as AuthUser;
  // Store both ID and type to know which table to query on deserialize
  done(null, { id: authUser.id, userType: authUser.userType });
});

passport.deserializeUser<SerializedAuthUser>(async (data, done) => {
  try {
    if (data.userType === 'contractor') {
      const user = await storage.getUser(data.id);
      const authUser: ContractorAuthUser | null = user ? { ...user, userType: 'contractor' as const } : null;
      done(null, authUser as any);
    } else if (data.userType === 'client') {
      const clientUser = await storage.getClientUser(data.id);
      const authUser: ClientPortalAuthUser | null = clientUser ? { ...clientUser, userType: 'client' as const } : null;
      done(null, authUser as any);
    } else {
      done(null, null);
    }
  } catch (error) {
    done(error);
  }
});

export { passport };

// Middleware to check if contractor is authenticated
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated() && req.user?.userType === 'contractor') {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}

// Middleware to check if user is an admin
export function isAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || req.user?.userType !== 'contractor') {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
  
  next();
}

// Middleware to check if client is authenticated
export function isClientAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated() && req.user?.userType === 'client') {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}
