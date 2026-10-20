import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { HederaOperationError } from "../hederaErrors.js";

const localRequire = createRequire(__filename);
const canonicalize = loadCanonicalize(localRequire);

function loadCanonicalize(value: typeof localRequire): (value: unknown) => string | undefined {
  const searchPaths = value.resolve.paths("canonicalize") ?? [];
  const implementation = searchPaths
    .map((searchPath: string) => join(searchPath, "canonicalize", "lib", "canonicalize.js"))
    .find((candidate: string) => existsSync(candidate));

  if (!implementation) {
    throw new Error("Unable to locate canonicalize/lib/canonicalize.js");
  }

  const module = value(implementation);
  return module.default ?? module;
}

export class CanonicalSerializer {
  public serialize(value: unknown): Uint8Array {
    const serialized = canonicalize(value);
    if (serialized === undefined) {
      throw new HederaOperationError("Value cannot be represented as canonical JSON");
    }
    return Buffer.from(serialized, "utf8");
  }
}
