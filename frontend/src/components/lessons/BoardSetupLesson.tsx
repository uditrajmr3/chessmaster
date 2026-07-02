"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import TeachingBoard, { ControlBtn } from "@/components/TeachingBoard";
import { START_FEN, EMPTY_FEN, freeMove } from "@/lib/teaching";

export default function BoardSetupLesson() {
  const [fen, setFen] = useState(START_FEN);
  const [showPieces, setShowPieces] = useState(true);

  return (
    <TeachingBoard
      position={showPieces ? fen : EMPTY_FEN}
      allowDragging={showPieces}
      onPieceDrop={(from, to) => {
        setFen((f) => freeMove(f, from, to));
        return true;
      }}
      onReset={() => {
        setFen(START_FEN);
        setShowPieces(true);
      }}
      controls={["flip", "turn", "coords", "reset"]}
      caption="Real boards have no letters or numbers — so labels stay off by default. Hit “Turn 90°” to rotate the board a quarter at a time: watch the light square leave your bottom-right corner — that orientation is set up wrong. “Hide pieces” gives you the bare board to focus on the squares, “Flip board” shows Black’s side, and you can drag any piece to try it."
      footer={
        <ControlBtn
          icon={showPieces ? EyeOff : Eye}
          label={showPieces ? "Hide pieces" : "Show pieces"}
          active={!showPieces}
          onClick={() => setShowPieces((s) => !s)}
        />
      }
    />
  );
}
