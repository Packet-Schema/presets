// Resolves the canonical PSDL 0.5 JSON Schema from @packet-schema/core.
//
// The schema is NOT vendored into this package — core is the single source of
// truth (project design: "presets … core に依存"). core ships schemas/ in its
// published files and exposes them via the "./schemas/*" export, so we resolve
// the path through Node's resolver and parse the YAML here.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parse as parseYaml } from "yaml";

const require = createRequire(import.meta.url);

export const SCHEMA_VERSION = "0.5";

export function loadSchema(): Record<string, unknown> {
  const path = require.resolve("@packet-schema/core/schemas/psdl-0.5.yaml");
  return parseYaml(readFileSync(path, "utf8")) as Record<string, unknown>;
}
