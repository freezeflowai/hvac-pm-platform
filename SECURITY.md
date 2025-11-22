# Security Documentation - Platform Admin Guide

This document outlines security features, setup instructions, and best practices for platform administrators.

## Platform Admin Role

Platform admins (`role: "platform_admin"`) have elevated privileges to:
- Impersonate any company admin or owner for customer support
- View read-only analytics across all companies
- Manually adjust billing and trial periods
- Access comprehensive audit logs

**Important:** Platform admins should be limited to trusted personnel only. All actions are logged and auditable.

## Impersonation System

The impersonation system allows platform admins to "act as" a specific user for troubleshooting and support, while maintaining full audit trails.

### How It Works

1. **Start Impersonation:**
   - Platform admin selects a target user
   - Provides a reason (minimum 10 characters, e.g., "Customer support ticket #123")
   - System creates a time-limited impersonation session

2. **During Impersonation:**
   - Platform admin sees and operates the application as the target user
   - All tenant-scoped validations work automatically (no special bypass logic)
   - Prominent banner displays who is impersonating and time remaining
   - All impersonated actions are attributed to the target user in logs

3. **Session Expiry:**
   - **60-minute maximum session** - Hard limit, cannot be extended
   - **15-minute idle timeout** - Automatically ends if no activity
   - Manual "Stop Impersonation" button available at any time

4. **Audit Trail:**
   - All impersonation events logged with timestamp, reason, IP address, user agent
   - Start, stop, and auto-timeout events tracked
   - Cross-tenant reads/writes logged separately
   - Audit logs accessible via `/api/admin/audit-logs` endpoint

### API Endpoints

```
POST /api/impersonation/start
Body: { targetUserId: string, reason: string }
Requires: platform_admin role
Returns: Session info with expiry timestamp

POST /api/impersonation/stop
Requires: Active impersonation session
Returns: Success confirmation

GET /api/impersonation/status
Returns: Current impersonation status + remaining time
```

### Best Practices

1. **Always provide a clear reason** - Include ticket numbers, customer names, or specific issue descriptions
2. **Stop impersonation when done** - Don't let sessions timeout automatically if you finish early
3. **Never impersonate to make changes** - Most data changes should be done by the customer themselves
4. **Use for observation and diagnosis** - Primary use case is viewing customer data to troubleshoot issues

## Multi-Factor Authentication (MFA)

**MANDATORY for Platform Admins**

Currently, the application uses password-based authentication. To add MFA:

### Recommended MFA Solutions

1. **Using Auth0:**
   ```bash
   npm install @auth0/auth0-react
   ```
   - Configure Auth0 tenant with MFA enabled
   - Require MFA for platform_admin role
   - Update authentication flow in `server/auth.ts`

2. **Using Passport-TOTP:**
   ```bash
   npm install passport-totp qrcode
   ```
   - Add TOTP secret field to users table
   - Generate QR codes for authenticator apps
   - Verify TOTP tokens on login

3. **Using OTP via Email/SMS:**
   - Generate 6-digit codes on login
   - Send via Resend (email) or Twilio (SMS)
   - Require code entry before session creation

### Implementation Steps

1. Choose MFA provider
2. Update `users` table schema with MFA fields
3. Modify `/api/auth/login` to require MFA for platform_admin users
4. Add MFA setup flow for new platform admins
5. Update `SECURITY.md` with specific MFA provider documentation

## IP Restriction (Optional)

Limit platform admin access to specific IP addresses or ranges.

### Environment Variables

Add to `.env`:

```bash
# Comma-separated list of allowed IP addresses or CIDR ranges
PLATFORM_ADMIN_IP_WHITELIST=203.0.113.0/24,198.51.100.50

# Set to 'true' to enable IP restriction
ENABLE_IP_RESTRICTION=true
```

### Implementation

Create middleware in `server/ipRestrictionMiddleware.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import { impersonationService } from "./impersonationService";

export function requireWhitelistedIP(req: Request, res: Response, next: NextFunction) {
  if (process.env.ENABLE_IP_RESTRICTION !== 'true') {
    return next();
  }

  const actualUser = (req as any).platformAdmin || req.user;
  if (!impersonationService.isPlatformAdmin(actualUser)) {
    return next(); // Only check IPs for platform admins
  }

  const clientIP = getClientIP(req);
  const whitelist = (process.env.PLATFORM_ADMIN_IP_WHITELIST || '').split(',').map(ip => ip.trim());

  if (!isIPWhitelisted(clientIP, whitelist)) {
    return res.status(403).json({ error: "Access denied from this IP address" });
  }

  next();
}

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

function isIPWhitelisted(ip: string, whitelist: string[]): boolean {
  // Implement IP matching logic (exact match or CIDR range check)
  // Can use 'ip-range-check' npm package for CIDR support
  return whitelist.some(allowedIP => {
    if (allowedIP.includes('/')) {
      // CIDR range check (requires library)
      return false; // Placeholder
    }
    return ip === allowedIP;
  });
}
```

Apply to routes:
```typescript
app.use('/api/impersonation', requireWhitelistedIP);
app.use('/api/admin', requireWhitelistedIP);
```

## Audit Log Access

View audit logs to monitor platform admin activity:

```
GET /api/admin/audit-logs?limit=100
Requires: platform_admin role
Returns: Recent audit log entries
```

### Log Entry Fields

- `platformAdminId` - ID of the platform admin
- `platformAdminEmail` - Email of the platform admin
- `action` - Type of action (impersonation_start, cross_tenant_write, etc.)
- `targetCompanyId` - Affected company
- `targetUserId` - Affected user
- `reason` - Reason provided (for impersonation)
- `details` - JSON with additional context
- `ipAddress` - IP address of the request
- `userAgent` - Browser/client information
- `createdAt` - Timestamp

### Common Audit Queries

1. **Recent impersonations:**
   - Filter by `action: "impersonation_start"`
   - Sort by `createdAt DESC`

2. **All activity for a company:**
   - Filter by `targetCompanyId`

3. **Suspicious activity:**
   - Look for `auth_failure` actions
   - Check unusual `ipAddress` values
   - Review late-night activity timestamps

## Security Best Practices

### For Platform Admins

1. **Use strong, unique passwords** - Minimum 16 characters with mixed case, numbers, symbols
2. **Enable MFA immediately** - Once implemented, never disable it
3. **Log out when done** - Don't leave platform admin sessions open
4. **Use VPN from untrusted networks** - Public WiFi should go through VPN
5. **Review audit logs regularly** - Check for unauthorized access attempts
6. **Report security incidents immediately** - Any suspicious activity should be escalated

### For Development Team

1. **Limit platform_admin accounts** - Only create for necessary personnel
2. **Rotate credentials regularly** - Every 90 days minimum
3. **Monitor audit logs** - Set up alerts for unusual patterns
4. **Keep dependencies updated** - Run `npm audit fix` regularly
5. **Use environment-specific credentials** - Never reuse production credentials in development
6. **Enable Stripe webhook validation** - Prevents forged billing events
7. **Regular security reviews** - Quarterly reviews of access controls and logs

## Upgrading Existing Users to Platform Admin

To promote a user to platform admin role:

```sql
-- Via SQL (development database only)
UPDATE users 
SET role = 'platform_admin' 
WHERE email = 'admin@yourcompany.com';
```

Or via API (future enhancement):
```typescript
PATCH /api/admin/users/:id/role
Body: { role: "platform_admin" }
Requires: Existing platform_admin role
```

**Important:** The first platform admin must be created manually via SQL or during initial setup.

## Emergency Procedures

### Lost Platform Admin Access

1. Access database directly via Replit console
2. Reset password hash for platform admin user:
   ```sql
   UPDATE users 
   SET password = '$2a$10$...'  -- bcrypt hash of temporary password
   WHERE email = 'admin@yourcompany.com';
   ```
3. Log in with temporary password
4. Change password immediately

### Suspected Compromise

1. **Immediately revoke access:**
   ```sql
   UPDATE users 
   SET role = 'technician'  -- Downgrade compromised account
   WHERE id = 'compromised-user-id';
   ```

2. **Review audit logs:**
   - Check all actions by the compromised account
   - Identify affected companies/users
   - Look for unusual IP addresses or user agents

3. **Notify affected parties** if data was accessed/modified

4. **Rotate credentials:**
   - Change passwords for all platform admins
   - Regenerate API keys
   - Update Stripe webhook secrets

5. **Investigate and remediate:**
   - Determine how compromise occurred
   - Patch vulnerabilities
   - Implement additional security controls

## Support and Questions

For security-related questions or to report vulnerabilities, contact:
- Email: security@yourcompany.com
- Internal: #security Slack channel

**Do not discuss security issues in public channels.**
