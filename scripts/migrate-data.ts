import pg from "pg";

const { Pool } = pg;

async function migrateData() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const destUrl = process.env.DATABASE_URL;

  if (!sourceUrl) {
    throw new Error("SOURCE_DATABASE_URL is not set");
  }
  if (!destUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log("Connecting to source database...");
  const sourcePool = new Pool({ connectionString: sourceUrl });
  
  console.log("Connecting to destination database...");
  const destPool = new Pool({ connectionString: destUrl });

  try {
    // First, check which tables exist in source
    const sourceTablesResult = await sourcePool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const sourceTables = new Set(sourceTablesResult.rows.map(r => r.table_name));
    console.log("Source database tables:", Array.from(sourceTables).join(", "));

    // Get destination table columns
    async function getTableColumns(pool: pg.Pool, tableName: string): Promise<Set<string>> {
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );
      return new Set(result.rows.map(r => r.column_name));
    }

    // Tables to migrate in correct order (respecting FK dependencies)
    const tables = [
      'companies',
      'users',
      'subscription_plans',
      'password_reset_tokens',
      'audit_logs',
      'clients',
      'parts',
      'client_parts',
      'maintenance_records',
      'calendar_assignments',
      'equipment',
      'company_settings',
      'invitation_tokens',
      'feedback',
    ];

    for (const tableName of tables) {
      console.log(`\nMigrating ${tableName}...`);
      
      // Skip if table doesn't exist in source
      if (!sourceTables.has(tableName)) {
        console.log(`  Table ${tableName} doesn't exist in source, skipping...`);
        continue;
      }

      // Get columns from destination table
      const destColumns = await getTableColumns(destPool, tableName);
      if (destColumns.size === 0) {
        console.log(`  Table ${tableName} doesn't exist in destination, skipping...`);
        continue;
      }

      // Get data from source
      const sourceResult = await sourcePool.query(`SELECT * FROM ${tableName}`);
      const rows = sourceResult.rows;
      
      if (rows.length === 0) {
        console.log(`  No data in ${tableName}, skipping...`);
        continue;
      }

      console.log(`  Found ${rows.length} rows`);

      // Filter columns to only include those that exist in both source and destination
      const sourceColumns = Object.keys(rows[0]);
      const commonColumns = sourceColumns.filter(col => destColumns.has(col));
      
      console.log(`  Using ${commonColumns.length}/${sourceColumns.length} columns`);
      
      // Insert data into destination
      let successCount = 0;
      for (const row of rows) {
        const values = commonColumns.map(col => row[col]);
        const placeholders = commonColumns.map((_, i) => `$${i + 1}`).join(', ');
        const columnNames = commonColumns.map(c => `"${c}"`).join(', ');
        
        try {
          await destPool.query(
            `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
          successCount++;
        } catch (err: any) {
          console.error(`  Error inserting row into ${tableName}:`, err.message);
        }
      }
      
      console.log(`  Migrated ${successCount}/${rows.length} rows to ${tableName}`);
    }

    console.log("\n✅ Migration complete!");

    // Verify counts
    console.log("\nVerifying data counts:");
    for (const tableName of tables) {
      if (!sourceTables.has(tableName)) continue;
      
      try {
        const sourceCount = await sourcePool.query(`SELECT COUNT(*) FROM ${tableName}`);
        const destCount = await destPool.query(`SELECT COUNT(*) FROM ${tableName}`);
        console.log(`  ${tableName}: source=${sourceCount.rows[0].count}, dest=${destCount.rows[0].count}`);
      } catch (err: any) {
        console.log(`  ${tableName}: error - ${err.message}`);
      }
    }

  } finally {
    await sourcePool.end();
    await destPool.end();
  }
}

migrateData().catch(console.error);
