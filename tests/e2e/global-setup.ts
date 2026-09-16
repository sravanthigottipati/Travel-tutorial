import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Automates what Phases 8-10 did by hand for live verification: run the
// real app against a real (throwaway) database rather than mocking
// Prisma, since that's what actually catches integration bugs — two real
// ones were found this way (Phase 9's null-sessionId bug, Phase 11's
// negative-duration extraction bug). This just makes that process
// repeatable instead of re-typing the same commands every phase.
//
// SQLite stands in for Supabase Postgres here purely for a disposable,
// zero-setup local database — it required two schema-level type
// substitutions (String[] -> Json, Decimal -> Float) because SQLite's
// Prisma connector doesn't support arrays or fixed-point Decimal. The E2E
// journey deliberately avoids /profile and UserPreferences.interests
// (the two places that type change would surface as a TS mismatch), so
// no source files need to be patched for this to run against `next dev`.

const ROOT = path.resolve(__dirname, "../..");
const STATE_DIR = path.join(__dirname, ".state");
const SCHEMA_PATH = path.join(ROOT, "prisma/schema.prisma");
const ENV_PATH = path.join(ROOT, ".env");
const DB_FILE = "e2e-test.db";
const DB_PATH = path.join(ROOT, "prisma", DB_FILE);
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

function replaceOnce(content: string, search: string, replace: string, label: string): string {
  if (!content.includes(search)) {
    throw new Error(
      `E2E global-setup: expected to find ${label} in schema.prisma but didn't — ` +
        `the schema has likely changed shape since this script was written. Update the replacement.`
    );
  }
  return content.replace(search, replace);
}

export default async function globalSetup() {
  fs.mkdirSync(STATE_DIR, { recursive: true });

  fs.copyFileSync(SCHEMA_PATH, path.join(STATE_DIR, "schema.prisma.bak"));
  if (fs.existsSync(ENV_PATH)) {
    fs.copyFileSync(ENV_PATH, path.join(STATE_DIR, ".env.bak"));
  }

  let schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  // Regex rather than replaceOnce's exact string match: the alignment
  // whitespace around `=` shifts whenever a datasource field is added or
  // removed (e.g. directUrl), which isn't a meaningful schema-shape change
  // this script needs to care about.
  if (!/provider\s+=\s+"postgresql"/.test(schema)) {
    throw new Error(
      'E2E global-setup: expected to find provider = "postgresql" (any spacing) in schema.prisma but didn\'t.'
    );
  }
  schema = schema.replace(/provider(\s+)=(\s+)"postgresql"/, 'provider$1=$2"sqlite"');
  // directUrl is meaningless for sqlite (no pooler to bypass) and prisma
  // errors if the env var it references isn't set at all — point it at
  // the same throwaway database rather than trying to strip the line.
  const directUrlEnv = process.env.DIRECT_URL ?? `file:./${DB_FILE}`;
  schema = replaceOnce(
    schema,
    "interests     String[] @default([])",
    'interests     Json     @default("[]")',
    "UserPreferences.interests"
  );
  schema = replaceOnce(schema, "Decimal    @db.Decimal(12, 2)", "Float", "Trip.budget's Decimal type");
  schema = replaceOnce(
    schema,
    "Decimal  @default(0) @db.Decimal(12, 2)",
    "Float    @default(0)",
    "Activity.estimatedCost's Decimal type"
  );
  schema = replaceOnce(schema, "Decimal         @db.Decimal(12, 2)", "Float", "Expense.amount's Decimal type");
  fs.writeFileSync(SCHEMA_PATH, schema);

  if (fs.existsSync(DB_PATH)) fs.rmSync(DB_PATH);

  fs.writeFileSync(
    ENV_PATH,
    [
      "GROQ_API_KEY=your_groq_api_key",
      `DATABASE_URL=file:./${DB_FILE}`,
      // schema.prisma's datasource references DIRECT_URL unconditionally
      // (see prisma/schema.prisma) — Prisma errors if it's referenced but
      // unset, even though sqlite has no pooler for it to actually matter.
      `DIRECT_URL=${directUrlEnv}`,
      "AUTH_SECRET=e2e-test-secret-not-for-production-use",
      "",
    ].join("\n")
  );

  execSync("npx prisma db push --skip-generate", { cwd: ROOT, stdio: "inherit" });
  execSync("npx prisma generate", { cwd: ROOT, stdio: "inherit" });

  const logPath = path.join(STATE_DIR, "server.log");
  const logFd = fs.openSync(logPath, "w");
  const server = spawn("npm", ["run", "dev", "--", "-p", String(E2E_PORT)], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    shell: true,
  });
  fs.writeFileSync(path.join(STATE_DIR, "server.pid"), String(server.pid));

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(E2E_BASE_URL);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`E2E dev server didn't become ready within 60s — check ${logPath}`);
}
