// Semantic validation gate — runs @packet-schema/core's parsePsdl (the §11.1
// validator) over presets. This catches what the JSON Schema (scripts/check.ts)
// cannot: undeclared ref targets, forward-reference/order violations, peek
// placement, checksum width, value-dictionary rules, etc.
//
// Usage: tsx scripts/semcheck.ts [presets/foo.psdl.yaml ...]   (default: all)

import { readdirSync, readFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePsdl } from "@packet-schema/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = join(__dirname, "..", "presets");

function main(): void {
  const argv = process.argv.slice(2);
  const files = argv.length > 0 ? argv : readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".psdl.yaml"))
    .sort()
    .map((f) => join(PRESETS_DIR, f));

  let failed = 0;
  for (const file of files) {
    const res = parsePsdl(readFileSync(file, "utf8"));
    if (res.ok) {
      console.log(`✓ ${basename(file)}`);
      continue;
    }
    failed++;
    console.error(`✗ ${basename(file)}`);
    for (const e of res.errors) console.error(`    ${e}`);
  }

  if (failed > 0) {
    console.error(`\n${failed} file(s) fail core semantic validation.`);
    process.exit(1);
  }
  console.log(`\nAll ${files.length} file(s) semantically valid.`);
}

main();
