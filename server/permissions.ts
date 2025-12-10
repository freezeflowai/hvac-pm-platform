import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { roles, permissions, rolePermissions, userPermissionOverrides, users } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

// Cache for user permissions (per-request caching)
const permissionCache = new Map<string, Set<string>>();

// Clear cache (call on user/permission updates)
export function clearPermissionCache(userId?: string) {
  if (userId) {
    permissionCache.delete(userId);
  } else {
    permissionCache.clear();
  }
}

// Get effective permissions for a user
export async function getUserEffectivePermissions(userId: string): Promise<Set<string>> {
  // Check cache first
  if (permissionCache.has(userId)) {
    return permissionCache.get(userId)!;
  }

  // Get user with role
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return new Set();
  }

  const effectivePermissions = new Set<string>();

  // Get role permissions if user has a roleId
  if (user.roleId) {
    const rolePerms = await db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, user.roleId));

    rolePerms.forEach((rp) => effectivePermissions.add(rp.key));
  } else {
    // Fallback: map legacy role field to new role
    const legacyRoleMapping: Record<string, string> = {
      admin: "role-admin",
      owner: "role-admin",
      manager: "role-manager",
      technician: "role-technician",
    };

    const mappedRoleId = legacyRoleMapping[user.role] || "role-technician";
    
    const rolePerms = await db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, mappedRoleId));

    rolePerms.forEach((rp) => effectivePermissions.add(rp.key));
  }

  // Apply user-specific overrides
  const overrides = await db
    .select({
      key: permissions.key,
      override: userPermissionOverrides.override,
    })
    .from(userPermissionOverrides)
    .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
    .where(eq(userPermissionOverrides.userId, userId));

  overrides.forEach(({ key, override }) => {
    if (override === "grant") {
      effectivePermissions.add(key);
    } else if (override === "revoke") {
      effectivePermissions.delete(key);
    }
  });

  // Cache the result
  permissionCache.set(userId, effectivePermissions);

  return effectivePermissions;
}

// Check if user has a specific permission
export async function userHasPermission(userId: string, permissionKey: string): Promise<boolean> {
  const permissions = await getUserEffectivePermissions(userId);
  return permissions.has(permissionKey);
}

// Express middleware to require a permission
export function requirePermission(permissionKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    
    if (!user) {
      return res.status(401).json({ 
        error: "Authentication required",
        message: "You must be logged in to access this resource"
      });
    }

    // Platform admins bypass permission checks
    if (user.role === "platform_admin") {
      return next();
    }

    const hasPermission = await userHasPermission(user.id, permissionKey);
    
    if (!hasPermission) {
      return res.status(403).json({
        error: "Permission denied",
        message: `You do not have the required permission: ${permissionKey}`,
        requiredPermission: permissionKey
      });
    }

    next();
  };
}

// Get all roles with their permissions (for UI display)
export async function getRolesWithPermissions() {
  const allRoles = await db.select().from(roles);
  const allPermissions = await db.select().from(permissions);
  
  const rolePermissionMappings = await db.select().from(rolePermissions);
  
  // Build permission lookup
  const permissionMap = new Map(allPermissions.map(p => [p.id, p]));
  
  // Build role with permissions
  const rolesWithPerms = allRoles.map(role => {
    const rolePerms = rolePermissionMappings
      .filter(rp => rp.roleId === role.id)
      .map(rp => permissionMap.get(rp.permissionId))
      .filter(Boolean);
    
    // Group permissions by group
    const groupedPermissions: Record<string, typeof allPermissions> = {};
    rolePerms.forEach(perm => {
      if (perm) {
        if (!groupedPermissions[perm.group]) {
          groupedPermissions[perm.group] = [];
        }
        groupedPermissions[perm.group].push(perm);
      }
    });
    
    return {
      ...role,
      permissions: rolePerms,
      permissionsByGroup: groupedPermissions,
      permissionKeys: rolePerms.map(p => p?.key).filter(Boolean) as string[],
    };
  });
  
  return rolesWithPerms;
}

// Get all permissions grouped by group
export async function getPermissionsGrouped() {
  const allPermissions = await db.select().from(permissions);
  
  const grouped: Record<string, typeof allPermissions> = {};
  allPermissions.forEach(perm => {
    if (!grouped[perm.group]) {
      grouped[perm.group] = [];
    }
    grouped[perm.group].push(perm);
  });
  
  return {
    all: allPermissions,
    grouped
  };
}

// Permission pack definitions (for quick toggles in UI)
export const PERMISSION_PACKS = {
  pricing: {
    label: "Pricing Access",
    description: "View and edit pricing, see profitability",
    permissions: ["pricing.view", "pricing.edit", "profitability.view"]
  },
  quotes_invoices: {
    label: "Quotes & Invoices",
    description: "Create quotes and invoices, record payments",
    permissions: ["quotes.create", "quotes.approve", "invoices.create", "invoices.record_payment"]
  },
  time_timesheets: {
    label: "Time & Timesheets",
    description: "Track and approve time entries",
    permissions: ["timesheets.track_own", "timesheets.approve_team"]
  },
  reports: {
    label: "Reports & Analytics",
    description: "View operational and financial reports",
    permissions: ["reports.view_basic", "reports.view_financial"]
  },
  admin: {
    label: "User & Settings Management",
    description: "Manage team members and company settings",
    permissions: ["users.manage", "settings.manage"]
  }
};
