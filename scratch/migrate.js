const { neon } = require("@neondatabase/serverless");

const connectionString = "postgresql://neondb_owner:npg_MOnaBetq6HU7@ep-shiny-sound-b5y62lzb-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(connectionString);

async function run() {
  console.log("Running DDL migration on Neon DB...");
  try {
    await sql`ALTER TABLE trip_member ADD COLUMN IF NOT EXISTS latitude text;`;
    console.log("✓ Added column latitude to trip_member");
  } catch (e) {
    console.error("latitude col:", e.message);
  }

  try {
    await sql`ALTER TABLE trip_member ADD COLUMN IF NOT EXISTS longitude text;`;
    console.log("✓ Added column longitude to trip_member");
  } catch (e) {
    console.error("longitude col:", e.message);
  }

  try {
    await sql`ALTER TABLE trip_member ADD COLUMN IF NOT EXISTS last_location_at timestamp;`;
    console.log("✓ Added column last_location_at to trip_member");
  } catch (e) {
    console.error("last_location_at col:", e.message);
  }

  console.log("Migration finished successfully!");
}

run();
