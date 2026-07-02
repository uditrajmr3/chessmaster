// The Capablanca positional system, as a structured rule set.
//
// This is the single source of truth for both the /learn/capablanca reference
// guide AND (later) the Guided Play coach panel, so the wording a student reads
// in the lesson is exactly what the coach nudges them with in a live game.
//
// Written in ChessInt's beginner-first voice; the principles and the historical
// games are Capablanca's. `phase` maps each rule to when the coach surfaces it.

export type GamePhase = "opening" | "middlegame" | "endgame";

export type Rule = {
  id: string;
  title: string;
  short: string; // one line — used by the coach panel
  body: string; // fuller explanation — used by the lesson
};

/**
 * The habit that runs the whole system. The coach answers these three, in
 * order, before every move.
 */
export const THREE_QUESTIONS: { q: string; hint: string }[] = [
  {
    q: "What did my opponent just threaten?",
    hint: "If the threat is real, deal with it before anything else. Most games are lost by the player who stops asking this.",
  },
  {
    q: "Which of my pieces is the least active?",
    hint: "If a piece is doing nothing — undeveloped, or stuck with no squares — improving it is usually your best move.",
  },
  {
    q: "Are any enemy pieces or pawns on my half of the board?",
    hint: "An intruder in your camp is dangerous. Trade it, chase it back, or blockade it before it settles in.",
  },
];

export const OPENING_RULES: Rule[] = [
  {
    id: "O-1",
    title: "Develop every piece before you attack",
    short: "Give every piece a job before starting a plan.",
    body: "An attack launched with half your army still on the back rank fizzles out — and those sleeping pieces can't defend either. Give every piece a job first. A knight on f3 is working; a knight still on g1 is not.",
  },
  {
    id: "O-2",
    title: "Break pins calmly",
    short: "Pinned knight? Support it with the other knight on d2/e2, then unpin.",
    body: "If a bishop pins your knight, don't panic. Develop your other knight to d2 or e2 to add support, then reposition your queen to undo the pin. You lose no time, because the supporting knight was a useful developing move anyway.",
  },
  {
    id: "O-3",
    title: "Prefer moves that make a threat",
    short: "A developing move that also threatens something forces your opponent to react.",
    body: "The best opening moves develop a piece and create a threat on the opponent's side, forcing them to react and lose time. A check or an attack on a piece can be worth it even if it means moving the same piece twice.",
  },
  {
    id: "O-4",
    title: "Castle early — usually kingside",
    short: "Get your king safe as soon as you can; an uncastled king is a liability.",
    body: "Castle as soon as you reasonably can. Kingside is usually safer — the king hides behind untouched pawns. Queenside is sharper (your rook lands on an open file immediately) but the king is more exposed.",
  },
  {
    id: "O-5",
    title: "Don't move the same piece twice without a reason",
    short: "Every wasted tempo gives your opponent a free developing move.",
    body: "Moving a piece a second time delays developing the rest of your army. The only excuse is a concrete threat — a check, a capture, a fork — that forces your opponent to reply.",
  },
];

export const MIDDLEGAME_RULES: Rule[] = [
  {
    id: "M-1",
    title: "Make every piece active before you make a plan",
    short: "Find your most passive piece and improve it before doing anything else.",
    body: "The single most important middlegame habit. Before any attack or pawn push, improve your most passive piece. Rooks want open files, knights want strong central squares (d5/e5/d4/e4), bishops want open diagonals, and the queen wants an active but safe post.",
  },
  {
    id: "M-2",
    title: "After every opponent move, ask what it threatens",
    short: "Answer 'what does this threaten?' before you look for your own plan.",
    body: "Before hunting for your own idea, ask what your opponent's move just threatened. This single habit prevents most tactical losses — Capablanca went undefeated for eight years largely because he never stopped asking.",
  },
  {
    id: "M-3",
    title: "Neutralise enemy pieces on your half",
    short: "Trade, chase back, or blockade any enemy piece that reaches your side.",
    body: "Any enemy piece that reaches your half of the board is a problem — deal with it immediately. A knight on d3 is far more dangerous than one on d6. Don't let intruders settle in.",
  },
  {
    id: "M-4",
    title: "Build domination — tactics appear on their own",
    short: "Don't hunt tactics; make your pieces active and your opponent's passive.",
    body: "Don't go looking for combinations. Make all your pieces active and force your opponent's pieces to be passive; once they've run out of good squares, the winning tactic appears by itself. You rarely need to calculate more than a couple of moves ahead.",
  },
  {
    id: "M-5",
    title: "Choose simple plans",
    short: "Either attack a weak pawn, or make a passed pawn and push it.",
    body: "When your pieces are active and you need a plan, pick one of two: attack a weak pawn (isolated, doubled, or backward), or create a passed pawn and advance it. Both build lasting pressure with almost no calculation.",
  },
];

export const ENDGAME_RULES: Rule[] = [
  {
    id: "E-1",
    title: "Activate your king",
    short: "Once queens are off, march the king to the centre — it's a fighting piece.",
    body: "In the endgame the king becomes a strong piece. The moment the queens come off, march it toward the centre (d4/e4/d5/e5). A centralised king is worth about a minor piece; a king hiding in the corner is wasted.",
  },
  {
    id: "E-2",
    title: "Attack the pawns",
    short: "Aim your king and rook at the weakest enemy pawn.",
    body: "You can't checkmate with few pieces, but you can win pawns and promote one of your own. Find the weakest enemy pawn — isolated, doubled, or backward — and direct your king and rook at it.",
  },
  {
    id: "E-3",
    title: "Rooks belong behind passed pawns",
    short: "Put your rook behind a passed pawn — yours or theirs.",
    body: "Behind your own passed pawn, the rook grows stronger as the pawn advances. Behind the opponent's, it restrains the pawn cheaply while your king does other work. A rook in front of a passed pawn is passive and weak.",
  },
  {
    id: "E-4",
    title: "Don't push pawns without a reason",
    short: "Every careless pawn move leaves a permanent weakness.",
    body: "Pawn moves can't be taken back. Advance a pawn only to open a file for your rook, make or support a passed pawn, restrict the enemy king, or escape an attack. Otherwise, leave it alone.",
  },
  {
    id: "E-5",
    title: "Play on two weaknesses",
    short: "One target can be defended; two on opposite wings cannot.",
    body: "Create or find two weak points on opposite sides of the board. Attack one to drag the defender across, then switch to the other — your opponent can't be in two places at once. This is how Capablanca won 'equal' endgames.",
  },
];

export const RULES_BY_PHASE: Record<GamePhase, Rule[]> = {
  opening: OPENING_RULES,
  middlegame: MIDDLEGAME_RULES,
  endgame: ENDGAME_RULES,
};
