// Per-file PSDL 0.5 validator with localized, noise-free errors.
//
// Usage: tsx scripts/check.ts presets/tcp.psdl.yaml [more files...]
//        tsx scripts/check.ts            (checks every presets/*.psdl.yaml)
//
// Ajv's raw output for the Container / Type / Expr oneOf unions reports an
// error for *every* failing branch, burying the real problem. Instead we
// discriminate each node by its `kind` and validate only that node's own shape
// against the matching $def — with recursive child refs ($ref to Container,
// Struct, Expr, …) stubbed to `true` — then walk into the children ourselves.
// The result: one precise error at the exact path (a stray key, a missing
// required key, a bad enum/pattern), and a real pass/fail signal for agents to
// converge against. Exits non-zero if any file fails.

import { readdirSync, readFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { loadSchema, SCHEMA_VERSION } from "./schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = join(__dirname, "..", "presets");

// $defs whose occurrences are recursive / child-bearing; stub to `true` so a
// node is validated for its OWN shape only and we recurse into children below.
const STUB = new Set([
  "Container",
  "Struct",
  "NamedStruct",
  "Expr",
  "RepeatCount",
  "Constraint",
]);

// Map a container's `kind` to its $def name (absent kind ⇒ Field).
const KIND_DEF: Record<string, string> = {
  field: "Field",
  virtual: "Virtual",
  group: "Group",
  optional: "Optional",
  repeat: "Repeat",
  switch: "Switch",
  align: "AlignContainer",
  bounded: "BoundedContainer",
  encrypted: "Encrypted",
  ref: "RefContainer",
};

type Json = unknown;
type Obj = Record<string, unknown>;
const isObj = (v: Json): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

// Deep-clone the schema, replacing every { $ref: "#/$defs/X" } (X in STUB)
// with `true` so a parent validator does not descend into that child.
function stubRefs(node: Json): Json {
  if (Array.isArray(node)) return node.map(stubRefs);
  if (isObj(node)) {
    const ref = node.$ref;
    if (typeof ref === "string") {
      const m = /^#\/\$defs\/(.+)$/.exec(ref);
      if (m && STUB.has(m[1])) return true;
    }
    const out: Obj = {};
    for (const [k, v] of Object.entries(node)) out[k] = stubRefs(v);
    return out;
  }
  return node;
}

type AjvError = {
  instancePath?: string;
  message?: string;
  keyword?: string;
  params?: Record<string, unknown>;
};

function fmt(e: AjvError): string {
  switch (e.keyword) {
    case "additionalProperties":
    case "unevaluatedProperties":
      return `unknown property '${String(e.params?.additionalProperty ?? e.params?.unevaluatedProperty)}'`;
    case "required":
      return `missing required property '${String(e.params?.missingProperty)}'`;
    case "enum":
      return `${e.message} (${JSON.stringify(e.params?.allowedValues)})`;
    default:
      return e.message ?? e.keyword ?? "invalid";
  }
}

class Checker {
  private ajv: InstanceType<typeof Ajv2020>;
  private shallowDefs: Obj;
  private cache = new Map<string, ValidateFunction>();
  errors: string[] = [];

  constructor(schema: Obj) {
    const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
    const addFormatsFn = (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
    this.ajv = new AjvCtor({ allErrors: true, strict: false });
    addFormatsFn(this.ajv);
    this.shallowDefs = stubRefs(schema.$defs) as Obj;
  }

  // Shallow validator for a named $def (children stubbed).
  private vdef(def: string): ValidateFunction {
    let v = this.cache.get(def);
    if (!v) {
      v = this.ajv.compile({ $ref: `#/$defs/${def}`, $defs: this.shallowDefs });
      this.cache.set(def, v);
    }
    return v;
  }

  private check(def: string, node: Json, path: string): void {
    const v = this.vdef(def);
    if (!v(node)) {
      const seen = new Set<string>();
      for (const e of (v.errors ?? []) as AjvError[]) {
        const at = `${path}${e.instancePath ?? ""}` || "/";
        const line = `${at || "/"}: ${fmt(e)}`;
        if (!seen.has(line)) {
          seen.add(line);
          this.errors.push(line);
        }
      }
    }
  }

  // Validate the shallow Packet shape, then walk the body and defs.
  packet(pkt: Obj, rootSchema: Obj): void {
    const shallowRoot = stubRefs(rootSchema) as Obj;
    shallowRoot.$defs = this.shallowDefs;
    const v = this.ajv.compile(shallowRoot);
    if (!v(pkt)) {
      for (const e of (v.errors ?? []) as AjvError[]) {
        this.errors.push(`${e.instancePath || "/"}: ${fmt(e)}`);
      }
    }
    if (Array.isArray(pkt.body)) pkt.body.forEach((c, i) => this.container(c, `/body/${i}`));
    if (isObj(pkt.defs)) {
      for (const [k, d] of Object.entries(pkt.defs)) this.struct(d, `/defs/${k}`, "NamedStruct");
    }
  }

  private struct(node: Json, path: string, def: "Struct" | "NamedStruct" = "Struct"): void {
    this.check(def, node, path);
    if (isObj(node) && Array.isArray(node.fields)) {
      node.fields.forEach((c, i) => this.container(c, `${path}/fields/${i}`));
    }
  }

  private container(node: Json, path: string): void {
    if (!isObj(node)) {
      this.errors.push(`${path}: expected a container object`);
      return;
    }
    const kind = typeof node.kind === "string" ? node.kind : "field";
    const def = KIND_DEF[kind];
    if (!def) {
      this.errors.push(`${path}: unknown container kind '${kind}'`);
      return;
    }
    this.check(def, node, path);

    switch (kind) {
      case "group":
        if (Array.isArray(node.children)) node.children.forEach((c, i) => this.container(c, `${path}/children/${i}`));
        break;
      case "optional":
        if (node.container !== undefined) this.container(node.container, `${path}/container`);
        break;
      case "bounded":
        if (Array.isArray(node.fields)) node.fields.forEach((c, i) => this.container(c, `${path}/fields/${i}`));
        break;
      case "repeat":
        if (node.element !== undefined) this.struct(node.element, `${path}/element`);
        break;
      case "encrypted":
        if (node.plaintext !== undefined) this.struct(node.plaintext, `${path}/plaintext`);
        break;
      case "switch":
        if (isObj(node.cases)) {
          for (const [k, arm] of Object.entries(node.cases)) this.struct(arm, `${path}/cases/${k}`);
        }
        break;
      default:
        break; // field, virtual, align, ref — leaves
    }
  }
}

function main(): void {
  const schema = loadSchema();
  const argv = process.argv.slice(2);
  const files = argv.length > 0 ? argv : readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".psdl.yaml"))
    .sort()
    .map((f) => join(PRESETS_DIR, f));

  let failed = 0;
  for (const file of files) {
    let raw: Obj;
    try {
      raw = parseYaml(readFileSync(file, "utf8")) as Obj;
    } catch (err) {
      console.error(`✗ ${basename(file)}: YAML parse error: ${String(err)}`);
      failed++;
      continue;
    }
    const stripped = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("_")));
    const doc: Obj = { version: SCHEMA_VERSION, ...stripped };

    const checker = new Checker(schema as Obj);
    checker.packet(doc, schema as Obj);
    if (checker.errors.length === 0) {
      console.log(`✓ ${basename(file)}`);
      continue;
    }
    failed++;
    console.error(`✗ ${basename(file)}`);
    for (const l of [...new Set(checker.errors)].sort()) console.error(`    ${l}`);
  }

  if (failed > 0) {
    console.error(`\n${failed} file(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${files.length} file(s) valid.`);
}

main();
