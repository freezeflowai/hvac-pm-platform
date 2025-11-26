import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

const DB_URL = 'postgresql://neondb_owner:npg_EgN2MlYnfSk0@ep-flat-dream-aet8mzr6.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function checkDatabase() {
  console.log('🔍 Checking database contents...\n');
  
  const pool = new Pool({ connectionString: DB_URL });
  const db = drizzle(pool);

  try {
    // Check if tables exist
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log(`Found ${tables.rows.length} tables:`);
    tables.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });

    if (tables.rows.length === 0) {
      console.log('\n⚠️  No tables found! This database appears to be completely empty.');
      console.log('   The schema has not been set up yet.');
      return;
    }

    // Check row counts for each table
    console.log('\nRow counts:');
    for (const row of tables.rows) {
      const tableName = row.table_name;
      const count = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`));
      console.log(`  ${tableName}: ${count.rows[0].count} rows`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkDatabase();
