// Opening presets for Guided Play. Each is a short mainline (SAN) played out
// automatically to reach a natural starting position ("tabiya"), after which
// the student is on their own with the coach. The student may take either
// colour; `forSide` is just which side the opening is characteristically "for"
// (used for labelling/among defaults).
//
// Every line here is verified legal by openings.test.ts (applied through
// chess.js), so a typo can't ship a broken preset.

export type Opening = {
  key: string;
  name: string;
  forSide: "white" | "black";
  moves: string[]; // SAN, from the initial position
  idea: string; // one-line plan, shown to the student
};

export const OPENINGS: Opening[] = [
  {
    key: "italian",
    name: "Italian Game",
    forSide: "white",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
    idea: "Develop naturally, aim the bishop at f7, castle, and fight for the centre.",
  },
  {
    key: "ruy-lopez",
    name: "Ruy López (Spanish)",
    forSide: "white",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"],
    idea: "Pressure the knight defending e5, develop, castle, and build a slow bind.",
  },
  {
    key: "london",
    name: "London System",
    forSide: "white",
    moves: ["d4", "d5", "Nf3", "Nf6", "Bf4", "e6", "e3", "Bd6"],
    idea: "A solid setup you can play against almost anything: Bf4, e3, Bd3, c3, castle.",
  },
  {
    key: "queens-gambit",
    name: "Queen's Gambit",
    forSide: "white",
    moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6"],
    idea: "Challenge the centre with c4, develop, and pressure Black's d5-pawn.",
  },
  {
    key: "kings-indian",
    name: "King's Indian Defence",
    forSide: "black",
    moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"],
    idea: "Let White build a big centre, fianchetto the bishop, then strike back with e5 or c5.",
  },
  {
    key: "pirc",
    name: "Pirc Defence",
    forSide: "black",
    moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6"],
    idea: "A flexible fianchetto setup for Black — give White the centre, then undermine it.",
  },
];

export function getOpening(key: string): Opening | undefined {
  return OPENINGS.find((o) => o.key === key);
}
