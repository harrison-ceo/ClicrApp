
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase URL or Service Key");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log("Starting FEATURE P0 Migration...");

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260205190000_features_p0.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute via RPC exec_sql
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error("RPC Execution Failed:", error);
        process.exit(1);
    } else {
        console.log("Migration executed successfully via exec_sql RPC.");
    }
}

runMigration().catch(console.error);
