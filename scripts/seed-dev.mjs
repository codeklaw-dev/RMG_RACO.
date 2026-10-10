// Local development seed: one fictional organisation per test tenant plus users.
// Usage: SEED_PASSWORD='at-least-12-chars' npm run db:seed
// Refuses to run against anything but a local database.
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import pg from "pg";

for (const f of [".env.local", ".env"]) { try { process.loadEnvFile(f); } catch {} }
const url = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error("Seed only runs against a local database");
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12) throw new Error("Set SEED_PASSWORD (12+ characters)");

const hash = (pw) => {
  const salt = randomBytes(16);
  const h = scryptSync(pw.normalize("NFKC"), salt, 64, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", 2 ** 15, 8, 1, salt.toString("base64"), h.toString("base64")].join("$");
};

const client = new pg.Client({ connectionString: url });
await client.connect();
const orgs = [
  { name: "Serein Atelier (fictional)", users: [["owner@serein.test", "Amara Okafor", "owner"], ["designer@serein.test", "Lea Novak", "designer"], ["viewer@serein.test", "Sam Reyes", "viewer"]] },
  { name: "Northfold Studio (fictional)", users: [["owner@northfold.test", "Kai Morgan", "owner"]] },
];
for (const o of orgs) {
  const existing = await client.query('SELECT id FROM "Organization" WHERE name = $1', [o.name]);
  const orgId = existing.rows[0]?.id ?? randomUUID();
  if (!existing.rows[0]) await client.query('INSERT INTO "Organization" (id, name) VALUES ($1, $2)', [orgId, o.name]);
  for (const [email, name, role] of o.users) {
    const u = await client.query(
      'INSERT INTO "User" (id, email, name, "passwordHash") VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash" RETURNING id',
      [randomUUID(), email, name, hash(password)],
    );
    await client.query(
      'INSERT INTO "Membership" (id, "userId", "orgId", role) VALUES ($1,$2,$3,$4::"Role") ON CONFLICT ("userId","orgId") DO UPDATE SET role = EXCLUDED.role',
      [randomUUID(), u.rows[0].id, orgId, role],
    );
  }
}
await client.end();
console.log("Seeded fictional organisations and users (password from SEED_PASSWORD).");
