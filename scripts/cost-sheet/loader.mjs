// Passed to `node --import`; registers the `@/` resolve hook on the loader
// thread so the alias resolves in every imported module, not just the entry.
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
