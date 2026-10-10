// Prepares an isolated test database and bucket for *.db.test.ts.
import { execFileSync } from "node:child_process";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";

const TEST_DB = "raco_test";

export default async function setup() {
  const admin = new pg.Client({ connectionString: "postgresql://raco:raco_local_dev@127.0.0.1:54329/raco" });
  try {
    await admin.connect();
  } catch {
    throw new Error("Local Postgres is not running. Start it with: npm run db:up");
  }
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  const url = `postgresql://raco:raco_local_dev@127.0.0.1:54329/${TEST_DB}`;
  execFileSync("npx", ["prisma", "migrate", "reset", "--force"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });

  const s3 = new S3Client({ region: "us-east-1", endpoint: "http://127.0.0.1:8333", forcePathStyle: true, credentials: { accessKeyId: "raco_local", secretAccessKey: "raco_local_secret" } });
  await s3.send(new CreateBucketCommand({ Bucket: "raco-test" })).catch((e) => {
    if (!/BucketAlreadyOwnedByYou|BucketAlreadyExists/.test(String(e?.name ?? e))) throw e;
  });
}
