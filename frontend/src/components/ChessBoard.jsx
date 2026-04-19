import React from "react";
import PieceSprite from "./PieceSprite";

export default function ChessBoard({ board, onCellClick, selected, achilles, patroclus, myColor, revealedAchilles }) {
  // Helper to check if a square is Achilles or Patroclus for the current player
  function isAchillesSquare(r, c) {
    if (!achilles || !myColor) return false;
    const a = achilles[myColor];
    return a && a.row === r && a.col === c;
  }
  function isPatroclusSquare(r, c) {
    if (!patroclus || !myColor) return false;
    const p = patroclus[myColor];
    return p && p.row === r && p.col === c;
  }
  // Optionally highlight revealed opponent Achilles
  function isOpponentAchillesSquare(r, c) {
    if (!achilles || !myColor || !revealedAchilles) return false;
    const opp = myColor === "white" ? "black" : "white";
    if (!revealedAchilles[opp]) return false;
    const a = achilles[opp];
    return a && a.row === r && a.col === c;
  }
  // Larger board and pieces
  const SQUARE_SIZE = 72;
  const PIECE_SIZE = 60;
  return (
    <div style={{
      display: "grid",
      gridTemplateRows: `repeat(8, ${SQUARE_SIZE}px)`,
      gridTemplateColumns: `repeat(8, ${SQUARE_SIZE}px)`,
      border: "2px solid #333",
      background: "#fff",
      width: SQUARE_SIZE * 8,
      height: SQUARE_SIZE * 8,
      margin: "0 auto"
    }}>
      {board.map((row, r) =>
        row.map((cell, c) => {
          const isSelected = selected && selected[0] === r && selected[1] === c;
          // All squares white
          let bg = isSelected ? "#3c6" : "#fff";
          const ach = isAchillesSquare(r, c);
          const pat = isPatroclusSquare(r, c);
          const oppAch = isOpponentAchillesSquare(r, c);
          if (ach) bg = "#ffec8b";
          else if (pat) bg = "#b4e7ff";
          else if (oppAch) bg = "#ffb3b3";
          return (
            <div
              key={r + "-" + c}
              onClick={() => onCellClick(r, c)}
              style={{
                width: SQUARE_SIZE,
                height: SQUARE_SIZE,
                background: bg,
                border: isSelected ? "3px solid #2ecc40" : "1px solid #333",
                boxShadow: isSelected ? "0 0 0 4px #3c6b" : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                transition: 'background 0.15s, border 0.15s, box-shadow 0.15s',
              }}
            >
              {cell && <PieceSprite color={cell.color} type={cell.type} size={PIECE_SIZE} />}
              {ach ? <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 20, color: '#c90', fontWeight: 'bold' }}>A</div> : null}
              {pat ? <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 20, color: '#09c', fontWeight: 'bold' }}>P</div> : null}
              {oppAch ? <div style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 20, color: '#c33', fontWeight: 'bold' }}>?</div> : null}
            </div>
          );
        })
      )}
    </div>
  );
}
