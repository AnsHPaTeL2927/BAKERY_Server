// Step 1 of the MySQL -> Postgres move: dump every table from the OLD MySQL
// database to a single JSON file.
//
//   MYSQL_DATABASE_URL="mysql://user:pass@host:3306/cakes_by_tulsi" \
//     npm run db:export
//
// Reads through the companion prisma/mysql-export.prisma client, so it does not
// care that schema.prisma has already been switched to postgresql. Writes
// prisma/data-export.json, which importData.js then loads into Neon.
//
// Rows are written exactly as they come out, IDs included — importData.js
// re-inserts them with the same primary keys so that every foreign key,
// invoice number and image reference still lines up afterwards.
const fs = require('fs/promises');
const path = require('path');
const { TABLES } = require('./migrationTables');

const OUTPUT = path.join(__dirname, '..', 'prisma', 'data-export.json');

// Prisma's Decimal and Date values are not plain JSON. Decimals become strings
// (never floats — that would silently round money), Dates become ISO strings;
// Prisma accepts both back on insert.
function serialize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && typeof value.toFixed === 'function') return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) out[key] = serialize(val);
    return out;
  }
  return value;
}

async function main() {
  if (!process.env.MYSQL_DATABASE_URL) {
    console.error('MYSQL_DATABASE_URL is required — point it at the OLD MySQL database.');
    console.error('Example: MYSQL_DATABASE_URL="mysql://root:@localhost:3306/cakes_by_tulsi" npm run db:export');
    process.exit(1);
  }

  let PrismaClient;
  try {
    ({ PrismaClient } = require('../node_modules/.prisma/mysql-client'));
  } catch {
    console.error('MySQL export client not generated yet. Run:');
    console.error('  npx prisma generate --schema prisma/mysql-export.prisma');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const data = {};
  let total = 0;

  try {
    for (const { model } of TABLES) {
      const rows = await prisma[model].findMany();
      data[model] = rows.map(serialize);
      total += rows.length;
      console.log(`  ${model.padEnd(20)} ${rows.length} row(s)`);
    }
  } finally {
    await prisma.$disconnect();
  }

  await fs.writeFile(OUTPUT, JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2));
  console.log(`\nExported ${total} row(s) across ${TABLES.length} tables -> ${OUTPUT}`);
  console.log('Next: set DATABASE_URL_UNPOOLED to the Neon direct connection string and run `npm run db:import`.');
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
