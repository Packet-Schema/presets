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

/* ------------------------------------------------------------------ *
 * Ajv interop
 * ------------------------------------------------------------------ */

/** The slice of Ajv these scripts actually use. */
export type AjvLike = {
  compile: (schema: unknown) => (data: unknown) => boolean;
};

/** An Ajv validator, with the error list Ajv hangs off the function object. */
export type AjvValidator = ((data: unknown) => boolean) & {
  errors?: { instancePath?: string; message?: string }[] | null;
};

/**
 * `ajv/dist/2020.js` and `ajv-formats` are CJS. Under `module: NodeNext` a
 * default import of a CJS module resolves to the module NAMESPACE, so the
 * constructor sits on `.default` — but only on some interop paths, which is
 * why the runtime shim tries both. TypeScript types the namespace, not the
 * class, so `new` on it is an error however the runtime behaves.
 *
 * Resolving both once here keeps the cast in a single place and gives callers
 * the structural type they actually depend on.
 */
export function resolveAjv(
  Ajv2020: unknown,
  addFormats: unknown,
): {
  AjvCtor: new (opts: { allErrors: boolean; strict: boolean }) => AjvLike;
  addFormatsFn: (ajv: AjvLike) => void;
} {
  const ctor = (Ajv2020 as { default?: unknown }).default ?? Ajv2020;
  const fmt = (addFormats as { default?: unknown }).default ?? addFormats;
  return {
    AjvCtor: ctor as new (opts: {
      allErrors: boolean;
      strict: boolean;
    }) => AjvLike,
    addFormatsFn: fmt as (ajv: AjvLike) => void,
  };
}
