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
      controls={["flip", "coords", "reset"]}
      caption="Drag any piece to try it yourself. Tap “Flip board” to see the setup from Black’s side, and “Show labels” to reveal the a–h files and 1–8 ranks. “Reset” puts every piece back."
    />
  );
}
