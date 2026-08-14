/**
 * The URL an in-app iframe should load to preview `url`.
 *
 * The app is served over HTTPS, and a browser refuses to frame an `http://`
 * subresource inside an https page ("mixed active content"). It blocks the
 * request outright — and crucially it blocks it *before* the site's own
 * `http -> https` redirect can run, so the iframe's `load` event never fires and
 * the overlay's loading spinner hangs forever. Opening the same link in a new
 * TAB is a top-level navigation, not a subresource, so it follows the redirect
 * and loads normally — which is exactly why a stuck preview "loads immediately
 * if I open it in an external browser".
 *
 * Forcing the scheme to https makes the frame request the same secure URL the
 * site would have redirected to anyway. A vendor site with no working https is
 * caught by /api/embed-check (which probes this *same* upgraded URL) and falls
 * back to a plain new-tab link, so we never open an overlay we can't fill.
 *
 * Only the iframe src and the embed-check target are upgraded — never the
 * anchor's own href / the header's "open in new tab", which are top-level
 * navigations that follow redirects fine and should honor the stored URL.
 */
export function toEmbedSrc(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === "http:") u.protocol = "https:";
    return u.toString();
  } catch {
    return url;
  }
}
