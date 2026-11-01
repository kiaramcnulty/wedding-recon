/**
 * Maps the app's `@/` import alias onto the repo root for node check scripts
 * that load TypeScript modules directly. Import this FIRST, then load the TS
 * module with a dynamic `await import(...)`: static imports are all resolved
 * before any module body runs, so they would miss the hook.
 */
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      return next(pathToFileURL(resolve(ROOT, `${specifier.slice(2)}.ts`)).href, context);
    }
    return next(specifier, context);
  },
});
