import Logo from "@/components/Logo";

/**
 * Branded loader: the ChessInt rook inside a fast accent ring. The quick spin
 * (0.7s, linear) reads as snappy; the glyph breathes gently. Honors
 * prefers-reduced-motion (ring stops, only a soft opacity pulse remains).
 */
export default function Loader({ fullscreen = false }: { fullscreen?: boolean }) {
  return (
    <div
      className={
        fullscreen
          ? // fixed inset-0 so it centers in the viewport regardless of the
            // flex-row <body> layout (min-h-screen alone left it stuck at the edge)
            "fixed inset-0 z-50 flex items-center justify-center"
          : "flex items-center justify-center py-16"
      }
      role="status"
      aria-label="Loading"
    >
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span className="loader-ring absolute inset-0 rounded-full border-2 border-accent-500/15 border-t-accent-400" />
        <Logo className="loader-glyph h-6 w-6 text-accent-300" />
      </div>
    </div>
  );
}
