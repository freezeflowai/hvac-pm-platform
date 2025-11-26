import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

// Old database connection (current DATABASE_URL)
const OLD_DB_URL = process.env.DATABASE_URL;

// New database connection (provided by user)
const NEW_DB_URL = process.env.NEW_DATABASE_URL || 'postgresql://neondb_owner:npg_EgN2MlYnfSk0@ep-flat-dream-aet8mzr6.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

if (!OLD_DB_URL) {
  throw new Error('DATABASE_URL (old database) must be set');
}

async function migrateData() {
  console.log('🚀 Starting database migration...\n');

  // Connect to both databases
  console.log('📡 Connecting to old database...');
  const oldPool = new Pool({ connectionString: OLD_DB_URL });
  const oldDb = drizzle(oldPool, { schema });

  console.log('📡 Connecting to new database...');
  const newPool = new Pool({ connectionString: NEW_DB_URL });
  const newDb = drizzle(newPool, { schema });

  try {
    // Step 1: Schema should be set up using drizzle-kit push before running this script
    console.log('\n📦 Schema should already be set up on new database using drizzle-kit push');

    // Step 2: Fetch all data from old database
    console.log('\n📥 Fetching data from old database...');
    
    const [
      companies,
      users,
      passwordResetTokens,
      auditLogs,
      clients,
      parts,
      clientParts,
      maintenanceRecords,
      calendarAssignments,
      equipment,
      companySettings,
      invitationTokens,
      feedback,
      subscriptionPlans
    ] = await Promise.all([
      oldDb.select().from(schema.companies),
      oldDb.select().from(schema.users),
      oldDb.select().from(schema.passwordResetTokens),
      oldDb.select().from(schema.auditLogs),
      oldDb.select().from(schema.clients),
      oldDb.select().from(schema.parts),
      oldDb.select().from(schema.clientParts),
      oldDb.select().from(schema.maintenanceRecords),
      oldDb.select().from(schema.calendarAssignments),
      oldDb.select().from(schema.equipment),
      oldDb.select().from(schema.companySettings),
      oldDb.select().from(schema.invitationTokens),
      oldDb.select().from(schema.feedback),
      oldDb.select().from(schema.subscriptionPlans),
    ]);

    console.log(`✅ Fetched ${companies.length} companies`);
    console.log(`✅ Fetched ${users.length} users`);
    console.log(`✅ Fetched ${passwordResetTokens.length} password reset tokens`);
    console.log(`✅ Fetched ${auditLogs.length} audit logs`);
    console.log(`✅ Fetched ${clients.length} clients`);
    console.log(`✅ Fetched ${parts.length} parts`);
    console.log(`✅ Fetched ${clientParts.length} client parts`);
    console.log(`✅ Fetched ${maintenanceRecords.length} maintenance records`);
    console.log(`✅ Fetched ${calendarAssignments.length} calendar assignments`);
    console.log(`✅ Fetched ${equipment.length} equipment`);
    console.log(`✅ Fetched ${companySettings.length} company settings`);
    console.log(`✅ Fetched ${invitationTokens.length} invitation tokens`);
    console.log(`✅ Fetched ${feedback.length} feedback`);
    console.log(`✅ Fetched ${subscriptionPlans.length} subscription plans`);

    // Step 3: Insert data into new database in correct order (respecting foreign keys)
    console.log('\n📤 Inserting data into new database...');

    // Order matters due to foreign key constraints!
    
    // 1. Subscription plans (no dependencies)
    if (subscriptionPlans.length > 0) {
      console.log('  → Inserting subscription plans...');
      await newDb.insert(schema.subscriptionPlans).values(subscriptionPlans);
    }

    // 2. Companies (no dependencies)
    if (companies.length > 0) {
      console.log('  → Inserting companies...');
      await newDb.insert(schema.companies).values(companies);
    }

    // 3. Users (depends on companies)
    if (users.length > 0) {
      console.log('  → Inserting users...');
      await newDb.insert(schema.users).values(users);
    }

    // 4. Password reset tokens (depends on users)
    if (passwordResetTokens.length > 0) {
      console.log('  → Inserting password reset tokens...');
      await newDb.insert(schema.passwordResetTokens).values(passwordResetTokens);
    }

    // 5. Audit logs (depends on users and companies)
    if (auditLogs.length > 0) {
      console.log('  → Inserting audit logs...');
      await newDb.insert(schema.auditLogs).values(auditLogs);
    }

    // 6. Invitation tokens (depends on companies and users)
    if (invitationTokens.length > 0) {
      console.log('  → Inserting invitation tokens...');
      await newDb.insert(schema.invitationTokens).values(invitationTokens);
    }

    // 7. Company settings (depends on companies and users)
    if (companySettings.length > 0) {
      console.log('  → Inserting company settings...');
      await newDb.insert(schema.companySettings).values(companySettings);
    }

    // 8. Feedback (depends on companies and users)
    if (feedback.length > 0) {
      console.log('  → Inserting feedback...');
      await newDb.insert(schema.feedback).values(feedback);
    }

    // 9. Clients (depends on companies and users)
    if (clients.length > 0) {
      console.log('  → Inserting clients...');
      await newDb.insert(schema.clients).values(clients);
    }

    // 10. Parts (depends on companies and users)
    if (parts.length > 0) {
      console.log('  → Inserting parts...');
      await newDb.insert(schema.parts).values(parts);
    }

    // 11. Client parts (depends on companies, users, clients, and parts)
    if (clientParts.length > 0) {
      console.log('  → Inserting client parts...');
      await newDb.insert(schema.clientParts).values(clientParts);
    }

    // 12. Maintenance records (depends on companies, users, and clients)
    if (maintenanceRecords.length > 0) {
      console.log('  → Inserting maintenance records...');
      await newDb.insert(schema.maintenanceRecords).values(maintenanceRecords);
    }

    // 13. Calendar assignments (depends on companies, users, and clients)
    if (calendarAssignments.length > 0) {
      console.log('  → Inserting calendar assignments...');
      await newDb.insert(schema.calendarAssignments).values(calendarAssignments);
    }

    // 14. Equipment (depends on companies, users, and clients)
    if (equipment.length > 0) {
      console.log('  → Inserting equipment...');
      await newDb.insert(schema.equipment).values(equipment);
    }

    console.log('\n✅ All data inserted successfully!');

    // Step 4: Verify counts
    console.log('\n🔍 Verifying migration...');
    const [
      newCompanies,
      newUsers,
      newClients,
      newParts,
      newCalendarAssignments
    ] = await Promise.all([
      newDb.select().from(schema.companies),
      newDb.select().from(schema.users),
      newDb.select().from(schema.clients),
      newDb.select().from(schema.parts),
      newDb.select().from(schema.calendarAssignments),
    ]);

    console.log(`✅ New database has ${newCompanies.length} companies (expected ${companies.length})`);
    console.log(`✅ New database has ${newUsers.length} users (expected ${users.length})`);
    console.log(`✅ New database has ${newClients.length} clients (expected ${clients.length})`);
    console.log(`✅ New database has ${newParts.length} parts (expected ${parts.length})`);
    console.log(`✅ New database has ${newCalendarAssignments.length} calendar assignments (expected ${calendarAssignments.length})`);

    const success = 
      newCompanies.length === companies.length &&
      newUsers.length === users.length &&
      newClients.length === clients.length &&
      newParts.length === parts.length &&
      newCalendarAssignments.length === calendarAssignments.length;

    if (success) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Update your DATABASE_URL secret to point to the new database');
      console.log('2. Restart the application');
      console.log('3. Verify that everything works correctly');
      console.log('\n⚠️  Keep the old database running until you\'ve verified everything works!');
    } else {
      console.log('\n⚠️  Warning: Record counts do not match. Please review the migration.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

migrateData().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});
