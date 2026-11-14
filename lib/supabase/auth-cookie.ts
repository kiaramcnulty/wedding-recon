/**
 * The Supabase auth cookie's name, pinned.
 *
 * This is the name @supabase/ssr derives by default for this project
 * (`sb-<project ref>-auth-token`), so pinning it changed nothing for anyone's
 * session. It is pinned because `proxy.ts` has to name it: the proxy only runs
 * for a browser that carries it (plus the two paths every visitor needs, see
 * the matcher), and a matcher must be a string literal, so it cannot derive the
 * name from the Supabase URL. Every cookie-bound client passes it as
 * `cookieOptions.name`, which keeps the client and the matcher on one name even
 * if the project URL ever changes. `scripts/test-proxy-matcher.mjs` fails when
 * the literal in `proxy.ts` drifts from this constant.
 *
 * A session too big for one cookie is split into `<name>.0`, `<name>.1`, ...
 * (@supabase/ssr chunker), so a signed-in browser always carries either
 * `<name>` or `<name>.0`. The matcher checks for both.
 */
export const AUTH_COOKIE_NAME = "sb-pssxwffssopyomlzdtdo-auth-token";
