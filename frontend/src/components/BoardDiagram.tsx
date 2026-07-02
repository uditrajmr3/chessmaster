// Static teaching board for the Learn guides. Renders a position from a FEN
// (placement field only is fine) with Unicode pieces — no engine, no JS, fully
// server-rendered. Optional `dots` mark squares (e.g. where a piece can move)
// and `from` highlights an origin square. Built for clarity over realism so a
// total beginner can read it.

const GLYPH: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function parsePlacement(fen: string): (string | null)[][] {
  const placement = fen.trim().split(" ")[0];
  return placement.split("/").map((row) => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) cells.push(null);
      } else {
        cells.push(ch);
      }
    }
    return cells;
  });
}

export default function BoardDiagram({
  fen,
  dots = [],
  from,
  caption,
}: {
  fen: string;
  dots?: string[];
  from?: string;
  caption?: string;
}) {
  const rows = parsePlacement(fen); // rows[0] = rank 8
  const dotSet = new Set(dots);

  return (
    <figure className="my-6">
      <div className="mx-auto grid aspect-square w-full max-w-[20rem] grid-cols-8 overflow-hidden rounded-lg border border-white/10">
        {rows.map((cells, r) =>
          cells.map((piece, c) => {
            const square = `${FILES[c]}${8 - r}`;
            const light = (r + c) % 2 === 0;
            const isFrom = from === square;
            const isDot = dotSet.has(square);
            const white = piece && piece === piece.toUpperCase();
            return (
              <div
                key={square}
                className={`relative flex aspect-square items-center justify-center text-[clamp(1.1rem,5vw,1.9rem)] leading-none ${
                  light ? "bg-[#e9e2d3]" : "bg-[#7d9468]"
                } ${isFrom ? "ring-2 ring-inset ring-accent-400" : ""}`}
              >
                {piece && (
                  <span
                    className={white ? "text-white" : "text-[#1d2630]"}
                    style={{ textShadow: white ? "0 1px 1px rgba(0,0,0,0.35)" : "none" }}
                  >
                    {GLYPH[piece]}
                  </span>
                )}
                {isDot && !piece && (
                  <span className="absolute h-1/4 w-1/4 rounded-full bg-accent-500/70" />
                )}
                {isDot && piece && (
                  <span className="absolute inset-1 rounded-full ring-2 ring-accent-500/80" />
                )}
              </div>
            );
          })
        )}
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-gray-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
