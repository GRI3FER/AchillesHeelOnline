import React from "react";
import PieceSprite from "./PieceSprite";

export default function ChessBoard({ board, onCellClick, selected, achilles, patroclus, myColor, revealedAchilles }) {
  // Helper to check if a square is Achilles or Patroclus for the current player
  function isAchillesSquare(r, c) {
    if (!achilles || !myColor) return false;
    const a = achilles[myColor];
    const piece = board[r][c];
    if (!a || !piece) return false;
    if (a.id && piece.id) return a.id === piece.id;
    return a.row === r && a.col === c;
  }
  function isPatroclusSquare(r, c) {
    if (!patroclus || !myColor) return false;
    const p = patroclus[myColor];
    const piece = board[r][c];
    if (!p || !piece) return false;
    if (p.id && piece.id) return p.id === piece.id;
    return p.row === r && p.col === c;
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
  // Classic chessboard colors
  const LIGHT = '#f0d9b5';
  const DARK = '#b58863';
  // Chessboard coordinates
  const files = ['a','b','c','d','e','f','g','h'];
  const ranks = [8,7,6,5,4,3,2,1];
  return (
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', margin: '0 auto' }}>
      {/* Rank labels */}
      <div style={{ display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
        {ranks.map((rank, i) => (
          <div key={rank} style={{ height: SQUARE_SIZE, width: 20, textAlign: 'right', lineHeight: SQUARE_SIZE + 'px', fontWeight: 600, color: '#333', fontSize: 18 }}>{rank}</div>
        ))}
      </div>
      {/* Board grid */}
      <div style={{
        display: "grid",
        gridTemplateRows: `repeat(8, ${SQUARE_SIZE}px)`,
        gridTemplateColumns: `repeat(8, ${SQUARE_SIZE}px)`,
        border: "4px solid #333",
        background: DARK,
        width: SQUARE_SIZE * 8,
        height: SQUARE_SIZE * 8,
        boxShadow: '0 4px 24px #0003',
        position: 'relative',
      }}>
        {board.map((row, r) =>
          row.map((cell, c) => {
            const isSelected = selected && selected[0] === r && selected[1] === c;
            let bg = (r + c) % 2 === 0 ? LIGHT : DARK;
            if (isSelected) bg = "#3c6";
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
                  border: "1px solid #333",
                  boxShadow: undefined,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  transition: 'background 0.15s, border 0.15s, box-shadow 0.15s',
                  fontSize: 18,
                }}
              >
                {cell && <PieceSprite color={cell.color} type={cell.type} size={PIECE_SIZE} />}
                {ach ? <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 20, color: '#c90', fontWeight: 'bold' }}>A</div> : null}
                {pat ? <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 20, color: '#09c', fontWeight: 'bold' }}>P</div> : null}
                {oppAch ? <div style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 20, color: '#c33', fontWeight: 'bold' }}>?</div> : null}
                {/* File label in bottom row */}
                {r === 7 && <div style={{ position: 'absolute', bottom: 2, left: 4, fontSize: 15, color: '#333', opacity: 0.7 }}>{files[c]}</div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
