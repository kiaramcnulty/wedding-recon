/**
 * Every screen under (app) arrives with a gentle fade (bridal polish, Kiara,
 * 2026-11-08). A template, not the layout, because Next remounts a template on
 * each navigation, which is what replays the animation.
 *
 * Opacity only: a transform on this wrapper would become the containing block
 * for the map overlays and every other position:fixed child, and move them.
 * The class stops under reduced motion (app/globals.css).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-screen-in flex flex-1 flex-col">{children}</div>;
}
