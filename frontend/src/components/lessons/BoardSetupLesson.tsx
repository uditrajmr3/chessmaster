"use client";

import { useState } from "react";
import TeachingBoard from "@/components/TeachingBoard";
import { START_FEN, freeMove } from "@/lib/teaching";

export default function BoardSetupLesson() {
  const [fen, setFen] = useState(START_FEN);

  return (
    <TeachingBoard
      position={fen}
      allowDragging
      onPieceDrop={(from, to) => {
        setFen((f) => freeMove(f, from, to));
        return true;
      }}
      onReset={() => setFen(START_FEN)}
      controls={["flip", "spin", "coords", "reset"]}
      caption="Real chess boards have no letters or numbers — so “Show labels” is off by default, just like the board in front of you. Hit “Spin 360°” to turn the board like you would on a table, “Flip board” to see it from Black’s side, and drag any piece to try it. However it’s turned, the rule holds: a light square sits in your bottom-right."
    />
  );
}
