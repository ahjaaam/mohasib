import { execFileSync } from "node:child_process";

const productionUrl = (process.env.PRODUCTION_URL ?? "https://app.mohasibai.com").replace(/\/$/, "");
const localCommit = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();

if (dirty) {
  console.error("Release parity failed: the local worktree is not clean.");
  process.exit(1);
}

const response = await fetch(`${productionUrl}/api/health`, {
  headers: { accept: "application/json" },
  cache: "no-store",
});
const health = await response.json().catch(() => null);

if (!response.ok || !health) {
  console.error(`Release parity failed: production health returned HTTP ${response.status}.`);
  process.exit(1);
}
if (health.version !== localCommit) {
  console.error(`Release parity failed: production ${health.version ?? "unknown"} != local ${localCommit}.`);
  process.exit(1);
}
if (health.checks?.database !== "ok" || health.checks?.schema !== "ok") {
  console.error(`Release parity failed: database=${health.checks?.database ?? "unknown"}, schema=${health.checks?.schema ?? "unknown"}.`);
  process.exit(1);
}

console.log(`Production parity verified for commit ${localCommit}, schema ${health.schemaVersion}.`);
