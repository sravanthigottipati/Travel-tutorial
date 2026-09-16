import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const STATE_DIR = path.join(__dirname, ".state");
const SCHEMA_PATH = path.join(ROOT, "prisma/schema.prisma");
const ENV_PATH = path.join(ROOT, ".env");
const DB_PATH = path.join(ROOT, "prisma", "e2e-test.db");

export default async function globalTeardown() {
  const pidFile = path.join(STATE_DIR, "server.pid");
  if (fs.existsSync(pidFile)) {
    const pid = fs.readFileSync(pidFile, "utf-8").trim();
    try {
      // /T kills the whole process tree — the captured PID is cmd.exe's
      // (spawned via shell: true), with `next dev` as its child.
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    } catch {
      // Already exited — fine.
    }
  }

  const schemaBackup = path.join(STATE_DIR, "schema.prisma.bak");
  if (fs.existsSync(schemaBackup)) {
    fs.copyFileSync(schemaBackup, SCHEMA_PATH);
  }

  const envBackup = path.join(STATE_DIR, ".env.bak");
  if (fs.existsSync(envBackup)) {
    fs.copyFileSync(envBackup, ENV_PATH);
  } else if (fs.existsSync(ENV_PATH)) {
    fs.rmSync(ENV_PATH);
  }

  if (fs.existsSync(DB_PATH)) fs.rmSync(DB_PATH);
  const journal = `${DB_PATH}-journal`;
  if (fs.existsSync(journal)) fs.rmSync(journal);

  execSync("npx prisma generate", { cwd: ROOT, stdio: "inherit" });

  fs.rmSync(STATE_DIR, { recursive: true, force: true });
}
