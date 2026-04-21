// File: frontend/src/components/ChessBoard.jsx
// Path: AchillesHeelOnline/frontend/src/components/ChessBoard.jsx
import React from 'react';

const SYMBOLS = {
  white: { Pawn:'♙', Rook:'♖', Knight:'♘', Bishop:'♗', Queen:'♕' },
  black: { Pawn:'♟', Rook:'♜', Knight:'♞', Bishop:'♝', Queen:'♛' },
};

const FILES = ['a','b','c','d','e','f','g','h'];

export default function ChessBoard({
  board,
  onCellClick,
  selected,
  legalMoves = [],
  achilles,
  patroclus,
  myColor,
  revealedAchilles,
  revealedEnemyType,   // string type like 'Queen' — highlight ALL enemy pieces of this type
  immortal,
  flipped = false,
  hideMarkers = false,
  highlightChangeMode = false,  // true when user should click a piece for new Achilles
  promotionColor,               // color of player in change mode
}) {
  const S = 70;
  const opp = myColor === 'white' ? 'black' : 'white';

  function isMyAchilles(r, c) {
    if (hideMarkers || !achilles || !myColor) return false;
    const a = achilles[myColor];
    return a && a.row === r && a.col === c;
  }

  function isMyPatroclus(r, c) {
    if (hideMarkers || !patroclus || !myColor) return false;
    const p = patroclus[myColor];
    return p && p.row === r && p.col === c;
  }

  // Only highlight enemy pieces by TYPE (not location) when revealed
  function isRevealedEnemyType(r, c) {
    if (!revealedEnemyType || !board) return false;
    const cell = board[r]?.[c];
    return cell && cell.color === opp && cell.type === revealedEnemyType;
  }

  // Highlight valid targets for Achilles change
  function isChangeTarget(r, c) {
    if (!highlightChangeMode || !promotionColor) return false;
    const cell = board?.[r]?.[c];
    if (!cell || cell.color !== promotionColor || cell.type === 'Pawn') return false;
    // Don't highlight the pawn on promotion square (we need to find it)
    return true;
  }

  function isLegal(r, c) {
    return legalMoves.some(([lr,lc]) => lr===r && lc===c);
  }

  const rows = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const cols = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  function rankLabel(rowIdx) { return 8 - rowIdx; }
  const bottomRenderedRow = rows[rows.length-1];

  // Light/dark square base colors — aged parchment + olive/umber for greco feel
  const lightSq = '#e8d5a3';
  const darkSq  = '#8b6914';

  return (
    <div style={{ display:'flex', gap:0, userSelect:'none' }}>
      {/* Rank labels */}
      <div style={{ display:'flex', flexDirection:'column' }}>
        {rows.map(rowIdx => (
          <div key={rowIdx} style={{
            width:22, height:S, display:'flex', alignItems:'center', justifyContent:'flex-end',
            paddingRight:5, fontSize:12, fontWeight:700, color:'#7a6030',
            fontFamily:'"Palatino Linotype",Georgia,serif',
          }}>{rankLabel(rowIdx)}</div>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column' }}>
        {/* Board */}
        <div style={{
          display:'grid',
          gridTemplateColumns: `repeat(8,${S}px)`,
          gridTemplateRows: `repeat(8,${S}px)`,
          border:'3px solid #5a3e0a',
          boxShadow:'0 10px 50px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(201,162,39,0.2), 0 0 0 1px rgba(0,0,0,0.8)',
          position:'relative',
        }}>
          {rows.map(r =>
            cols.map(c => {
              const isLight  = (r+c)%2===0;
              const isSel    = selected && selected[0]===r && selected[1]===c;
              const legal    = isLegal(r, c);
              const ach      = isMyAchilles(r, c);
              const pat      = isMyPatroclus(r, c);
              const revealed = isRevealedEnemyType(r, c);
              const chTarget = isChangeTarget(r, c);
              const cell     = board?.[r]?.[c];

              // Background priority
              let bg = isLight ? lightSq : darkSq;
              let overlay = null;

              if (isSel) {
                bg = isLight ? '#b8d468' : '#7aaa20';
              } else if (chTarget) {
                bg = isLight ? '#f0e060' : '#b09010';
                overlay = <div style={{
                  position:'absolute', inset:0,
                  background:'rgba(255,230,0,0.15)',
                  animation:'pulse 1s ease-in-out infinite alternate',
                  pointerEvents:'none',
                }} />;
              } else if (ach) {
                bg = isLight ? '#ffd060' : '#c09000';
              } else if (pat) {
                bg = isLight ? '#80d4f8' : '#3090c0';
              } else if (revealed) {
                // Subtle red tint for revealed enemy type (both pieces)
                bg = isLight ? '#f5b8b8' : '#a04040';
              } else if (legal && cell) {
                bg = isLight ? '#d4bc50' : '#a08800';
              }

              const isImmortalPiece = cell && immortal?.[cell.color];
              const isAchillesPiece = cell && (
                (achilles?.white?.row===r && achilles?.white?.col===c) ||
                (achilles?.black?.row===r && achilles?.black?.col===c)
              );

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => onCellClick(r, c)}
                  style={{
                    width:S, height:S, background:bg,
                    position:'relative', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'background 0.1s',
                  }}
                >
                  {overlay}

                  {/* Legal move indicator */}
                  {legal && !cell && (
                    <div style={{
                      width:20, height:20, borderRadius:'50%',
                      background:'rgba(0,0,0,0.25)',
                      position:'absolute',
                    }} />
                  )}

                  {/* Legal capture ring */}
                  {legal && cell && (
                    <div style={{
                      position:'absolute', inset:2,
                      border:'3px solid rgba(0,0,0,0.3)',
                      borderRadius:'50%', pointerEvents:'none',
                    }} />
                  )}

                  {/* Piece */}
                  {cell && (
                    <span style={{
                      fontSize:44, lineHeight:1,
                      color: cell.color==='white' ? '#f8f4e8' : '#1a1208',
                      textShadow: cell.color==='white'
                        ? '0 0 4px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.9)'
                        : '0 0 4px rgba(255,255,255,0.15)',
                      filter: isImmortalPiece && isAchillesPiece
                        ? 'drop-shadow(0 0 10px gold) drop-shadow(0 0 4px rgba(255,200,0,0.8))'
                        : 'none',
                      transition:'filter 0.3s',
                      position:'relative', zIndex:1,
                    }}>
                      {SYMBOLS[cell.color]?.[cell.type]||'?'}
                    </span>
                  )}

                  {/* Achilles badge */}
                  {ach && !hideMarkers && (
                    <span style={{
                      position:'absolute', top:2, right:3, fontSize:10, fontWeight:900,
                      color:'#8a5c00', fontFamily:'Georgia,serif',
                      textShadow:'0 0 3px rgba(255,255,255,0.8)',
                      zIndex:2,
                    }}>A</span>
                  )}

                  {/* Patroclus badge */}
                  {pat && !hideMarkers && (
                    <span style={{
                      position:'absolute', top:2, left:3, fontSize:10, fontWeight:900,
                      color:'#1a5878', fontFamily:'Georgia,serif',
                      textShadow:'0 0 3px rgba(255,255,255,0.8)',
                      zIndex:2,
                    }}>P</span>
                  )}

                  {/* Revealed enemy type badge (subtle) */}
                  {revealed && !hideMarkers && (
                    <span style={{
                      position:'absolute', bottom:2, right:3, fontSize:9, fontWeight:900,
                      color:'#8b2222', fontFamily:'Georgia,serif',
                      zIndex:2,
                    }}>?</span>
                  )}

                  {/* File label on bottom row */}
                  {r === bottomRenderedRow && (
                    <span style={{
                      position:'absolute', bottom:2, left:3, fontSize:10,
                      color: isLight ? darkSq : lightSq,
                      fontFamily:'Georgia,serif', fontWeight:700,
                      opacity:0.7, zIndex:2,
                    }}>{FILES[c]}</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* File labels */}
        <div style={{ display:'flex' }}>
          {cols.map(c => (
            <div key={c} style={{
              width:S, height:20, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, fontWeight:700, color:'#7a6030',
              fontFamily:'"Palatino Linotype",Georgia,serif',
            }}>{FILES[c]}</div>
          ))}
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          from { opacity: 0.4; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}