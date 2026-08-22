// Step 2 of the MySQL -> Postgres move: load prisma/data-export.json into the
// database that POSTGRES_PRISMA_URL currently points at (Neon) — that is the
// URL the Prisma client actually connects with at runtime (config/prisma.js),
// regardless of what DATABASE_URL_UNPOOLED (used only by the Prisma CLI) is
// set to.
//
//   POSTGRES_PRISMA_URL="postgresql://...-pooler...neon.tech/...?sslmode=require&pgbouncer=true" npm run db:import
//
// Run `npx prisma migrate deploy` first so the tables exist (that command
// needs DATABASE_URL_UNPOOLED set too — see schema.prisma).
//
// Safe to re-run: it refuses to touch a database that already holds rows
// unless --force is passed, in which case it clears the tables first.
const fs = require('fs/promises');
const path = require('path');
const prisma = require('../config/prisma');
const { TABLES } = require('./migrationTables');

const INPUT = path.join(__dirname, '..', 'prisma', 'data-export.json');
const FORCE = process.argv.includes('--force');

// Inserted in modest batches: createMany with several thousand rows in one
// statement can exceed Postgres' parameter limit, and Neon's free tier is
// happier with smaller round trips.
const BATCH_SIZE = 500;

async function main() {
  let payload;
  try {
    payload = JSON.parse(await fs.readFile(INPUT, 'utf8'));
  } catch {
    console.error(`No export found at ${INPUT}. Run \`npm run db:export\` against MySQL first.`);
    process.exit(1);
  }

  const { data } = payload;
  console.log(`Loading export taken at ${payload.exportedAt}\n`);

  // Guard against silently doubling live data by running this twice.
  const existing = await prisma.admin.count();
  if (existing > 0 && !FORCE) {
    console.error(`Target database already has ${existing} admin row(s). Refusing to import.`);
    console.error('Re-run with --force to CLEAR the target tables and import fresh.');
    process.exit(1);
  }

  if (existing > 0 && FORCE) {
    console.log('--force: clearing target tables (children first)…');
    for (const { model } of [...TABLES].reverse()) {
      await prisma[model].deleteMany();
    }
  }

  let total = 0;
  for (const { model } of TABLES) {
    const rows = data[model] || [];
    if (rows.length === 0) {
      console.log(`  ${model.padEnd(20)} 0 row(s) — skipped`);
      continue;
    }

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await prisma[model].createMany({ data: rows.slice(i, i + BATCH_SIZE), skipDuplicates: true });
    }

    total += rows.length;
    console.log(`  ${model.padEnd(20)} ${rows.length} row(s)`);
  }

  // Rows were inserted with explicit IDs, which leaves Postgres' identity
  // sequences still sitting at 1 — the very next insert through the app would
  // collide with an existing primary key. MySQL's AUTO_INCREMENT did not need
  // this, so it is easy to miss until the first new order fails.
  console.log('\nResyncing identity sequences…');
  for (const { model, table } of TABLES) {
    const rows = data[model] || [];
    if (rows.length === 0) continue;
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`,
    );
  }

  console.log(`\nImported ${total} row(s). Next: \`npm run blob:migrate\` to move the image files.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Import failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
