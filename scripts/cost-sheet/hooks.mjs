// ESM resolve hook: map the `@/…` tsconfig path alias to the repo root and add
// a `.ts`/`.tsx` extension when the specifier has none, so the generator can
// import the app's real TypeScript modules (VENDOR_FILTERS, vendorTags, …)
// under Node's native type-stripping. Registered via ./loader.mjs.
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.env.WR_ROOT || process.cwd();

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let p = path.join(ROOT, specifier.slice(2));
    if (!path.extname(p)) {
      if (existsSync(p + ".ts")) p += ".ts";
      else if (existsSync(p + ".tsx")) p += ".tsx";
      else if (existsSync(path.join(p, "index.ts"))) p = path.join(p, "index.ts");
    }
    return { url: pathToFileURL(p).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
