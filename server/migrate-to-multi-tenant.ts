import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Migration script to convert existing single-tenant database to multi-tenant
 * This should be run ONCE after schema changes
 */
async function migrateToMultiTenant() {
  console.log("Starting multi-tenant migration...");

  try {
    // Step 1: Create companies table if not exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        province_state TEXT,
        postal_code TEXT,
        email TEXT,
        phone TEXT,
        trial_ends_at TIMESTAMP,
        subscription_status TEXT NOT NULL DEFAULT 'trial',
        subscription_plan TEXT,
        billing_interval TEXT,
        current_period_end TIMESTAMP,
        cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Companies table created");

    // Step 2: Check if users table already has companyId column
    const hasCompanyId = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'company_id'
    `);

    if (hasCompanyId.rows.length === 0) {
      // Step 3: For each existing user, create a company and update the user
      const existingUsers = await db.execute(sql`SELECT id, email FROM users`);
      
      for (const user of existingUsers.rows) {
        // Create a company for this user
        const companyResult = await db.execute(sql`
          INSERT INTO companies (name, subscription_status)
          VALUES (${(user as any).email + "'s Company"}, 'trial')
          RETURNING id
        `);
        
        const companyId = (companyResult.rows[0] as any).id;
        console.log(`✓ Created company for user ${(user as any).email}: ${companyId}`);
        
        // Store mapping for later use
        await db.execute(sql`
          CREATE TEMP TABLE IF NOT EXISTS user_company_mapping (
            user_id VARCHAR,
            company_id VARCHAR
          )
        `);
        
        await db.execute(sql`
          INSERT INTO user_company_mapping (user_id, company_id)
          VALUES (${(user as any).id}, ${companyId})
        `);
      }
      
      console.log("✓ Created companies for all existing users");

      // Step 4: Add companyId column to users table
      await db.execute(sql`
        ALTER TABLE users ADD COLUMN company_id VARCHAR
      `);
      console.log("✓ Added company_id column to users table");

      // Step 5: Update users with their company IDs
      await db.execute(sql`
        UPDATE users 
        SET company_id = user_company_mapping.company_id
        FROM user_company_mapping
        WHERE users.id = user_company_mapping.user_id
      `);
      console.log("✓ Updated users with company_id");

      // Step 6: Make company_id NOT NULL and add foreign key
      await db.execute(sql`
        ALTER TABLE users 
        ALTER COLUMN company_id SET NOT NULL
      `);
      
      await db.execute(sql`
        ALTER TABLE users 
        ADD CONSTRAINT users_company_id_fkey 
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      `);
      console.log("✓ Added foreign key constraint");

      // Step 7: Add role column and set existing users as owners
      await db.execute(sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'technician'
      `);
      
      await db.execute(sql`
        UPDATE users SET role = 'owner' WHERE role IS NULL OR role = 'technician'
      `);
      
      await db.execute(sql`
        ALTER TABLE users ALTER COLUMN role SET NOT NULL
      `);
      console.log("✓ Added role column and set existing users as owners");

      // Step 8: Add fullName and createdAt columns
      await db.execute(sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT
      `);
      
      await db.execute(sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log("✓ Added fullName and createdAt columns to users");

      // Step 9: Remove old subscription fields from users
      await db.execute(sql`
        ALTER TABLE users DROP COLUMN IF EXISTS trial_ends_at,
        DROP COLUMN IF EXISTS subscription_status,
        DROP COLUMN IF EXISTS subscription_plan,
        DROP COLUMN IF EXISTS billing_interval,
        DROP COLUMN IF EXISTS current_period_end,
        DROP COLUMN IF EXISTS cancel_at_period_end,
        DROP COLUMN IF EXISTS stripe_customer_id,
        DROP COLUMN IF EXISTS stripe_subscription_id,
        DROP COLUMN IF EXISTS is_admin
      `);
      console.log("✓ Removed old subscription fields from users");
    }

    // Step 10: Add companyId to all other tables
    const tables = ['clients', 'parts', 'client_parts', 'maintenance_records', 'calendar_assignments', 'equipment', 'company_settings', 'feedback'];
    
    for (const table of tables) {
      const hasCompanyIdColumn = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${table} AND column_name = 'company_id'
      `);
      
      if (hasCompanyIdColumn.rows.length === 0) {
        // Add company_id column
        await db.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN company_id VARCHAR`));
        
        // Update with company_id from user
        await db.execute(sql.raw(`
          UPDATE ${table}
          SET company_id = users.company_id
          FROM users
          WHERE ${table}.user_id = users.id
        `));
        
        // Make NOT NULL
        await db.execute(sql.raw(`ALTER TABLE ${table} ALTER COLUMN company_id SET NOT NULL`));
        
        // Add foreign key
        await db.execute(sql.raw(`
          ALTER TABLE ${table}
          ADD CONSTRAINT ${table}_company_id_fkey
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        `));
        
        console.log(`✓ Added company_id to ${table}`);
      }
    }

    // Step 11: Add assignedTechnicianId to calendar_assignments
    const hasAssignedTech = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'calendar_assignments' AND column_name = 'assigned_technician_id'
    `);
    
    if (hasAssignedTech.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE calendar_assignments 
        ADD COLUMN assigned_technician_id VARCHAR
        REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log("✓ Added assignedTechnicianId to calendar_assignments");
    }

    // Step 12: Create invitation_tokens table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invitation_tokens (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        created_by_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'technician',
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        used_by_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Created invitation_tokens table");

    console.log("\n✅ Migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration
migrateToMultiTenant()
  .then(() => {
    console.log("Migration script finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration script failed:", error);
    process.exit(1);
  });
