// Helpers for the interactive teaching boards (/learn interactive lessons).
// Piece move generation here is GEOMETRIC (a lone piece on an empty board) so
// we can teach "how the knight moves" without a full legal game — chess.js
// requires kings and a valid position, which the piece lessons don't have.

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

function toSquare(fileIdx: number, rankIdx: number): string | null {
  if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) return null;
  return FILES[fileIdx] + (rankIdx + 1);
}

function parseSquare(s: string): [number, number] {
  return [FILES.indexOf(s[0]), Number(s[1]) - 1];
}

const ROOK_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT_DIRS: [number, number][] = [
  [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
];

/**
 * Squares a lone piece could move to from `square` on an otherwise empty board.
 * `dots` are quiet moves; `rings` are the pawn's diagonal capture squares
 * (shown differently so beginners learn pawns capture sideways).
 */
export function pieceMoves(
  type: PieceType,
  square: string,
  color: "w" | "b" = "w"
): { dots: string[]; rings: string[] } {
  const [f, r] = parseSquare(square);
  const dots: string[] = [];
  const rings: string[] = [];

  const slide = (dirs: [number, number][]) => {
    for (const [df, dr] of dirs) {
      let nf = f + df;
      let nr = r + dr;
      let s = toSquare(nf, nr);
      while (s) {
        dots.push(s);
        nf += df;
        nr += dr;
        s = toSquare(nf, nr);
      }
    }
  };
  const step = (dirs: [number, number][]) => {
    for (const [df, dr] of dirs) {
      const s = toSquare(f + df, r + dr);
      if (s) dots.push(s);
    }
  };

  switch (type) {
    case "r": slide(ROOK_DIRS); break;
    case "b": slide(BISHOP_DIRS); break;
    case "q": slide([...ROOK_DIRS, ...BISHOP_DIRS]); break;
    case "k": step([...ROOK_DIRS, ...BISHOP_DIRS]); break;
    case "n": step(KNIGHT_DIRS); break;
    case "p": {
      const dir = color === "w" ? 1 : -1;
      const one = toSquare(f, r + dir);
      if (one) dots.push(one);
      const homeRank = color === "w" ? 1 : 6;
      if (r === homeRank) {
        const two = toSquare(f, r + 2 * dir);
        if (two) dots.push(two);
      }
      for (const df of [-1, 1]) {
        const c = toSquare(f + df, r + dir);
        if (c) rings.push(c);
      }
      break;
    }
  }
  return { dots, rings };
}

/** FEN (placement + side to move) for a single piece on an empty board. */
export function singlePieceFen(pieceChar: string, square: string): string {
  const [f, r] = parseSquare(square);
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      if (file === f && rank === r) {
        if (empty) { row += empty; empty = 0; }
        row += pieceChar;
      } else {
        empty++;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join("/") + " w - - 0 1";
}

/** Relocate a piece from `from` to `to` ignoring legality — for free setup. */
export function freeMove(fen: string, from: string, to: string): string {
  const parts = fen.split(" ");
  const placement = parts[0];
  const rest = parts.slice(1).join(" ") || "w - - 0 1";
  const grid: (string | null)[][] = placement.split("/").map((row) => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) cells.push(null);
      else cells.push(ch);
    }
    return cells;
  }); // grid[0] = rank 8
  const [ff, fr] = parseSquare(from);
  const [tf, tr] = parseSquare(to);
  const piece = grid[7 - fr]?.[ff];
  if (!piece) return fen;
  grid[7 - fr][ff] = null;
  grid[7 - tr][tf] = piece;
  const newPlacement = grid
    .map((cells) => {
      let row = "";
      let empty = 0;
      for (const c of cells) {
        if (c === null) empty++;
        else {
          if (empty) { row += empty; empty = 0; }
          row += c;
        }
      }
      if (empty) row += empty;
      return row;
    })
    .join("/");
  return `${newPlacement} ${rest}`;
}
