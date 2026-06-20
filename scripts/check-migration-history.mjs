import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const migrationsDir = path.resolve("supabase/migrations");
const entries = (await readdir(migrationsDir)).filter(name => name.endsWith(".sql")).sort();
const versioned = [];
const legacy = [];

for (const name of entries) {
  const match = name.match(/^(\d{3,14})_[a-z0-9_]+\.sql$/);
  if (!match) {
    legacy.push(name);
    continue;
  }
  const body = await readFile(path.join(migrationsDir, name));
  versioned.push({
    name,
    version: match[1],
    sha256: createHash("sha256").update(body).digest("hex"),
  });
}

const duplicates = versioned
  .map(item => item.version)
  .filter((version, index, versions) => versions.indexOf(version) !== index);

if (duplicates.length) {
  console.error(`Duplicate migration versions: ${[...new Set(duplicates)].join(", ")}`);
  process.exitCode = 1;
}

if (legacy.length) {
  console.warn(`Legacy SQL excluded from ordered migrations: ${legacy.join(", ")}`);
}

console.log(`Validated ${versioned.length} ordered migrations.`);
for (const item of versioned) {
  console.log(`${item.version}  ${item.sha256}  ${item.name}`);
}
