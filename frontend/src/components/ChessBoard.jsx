import React from 'react';

// Piece unicode symbols
const SYMBOLS = {
  white: { Pawn:'♙', Rook:'♖', Knight:'♘', Bishop:'♗', Queen:'♕' },
  black: { Pawn:'♟', Rook:'♜', Knight:'♞', Bishop:'♝', Queen:'♛' },
};

const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = [8,7,6,5,4,3,2,1];

export default function ChessBoard({
  board,
  onCellClick,
  selected,
  legalMoves = [],
  achilles,
  patroclus,
  myColor,
  revealedAchilles,
  immortal,
  flipped = false,
  hideMarkers = false,
}) {
  const S = 72;

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
  function isRevealedOppAchilles(r, c) {
    if (hideMarkers || !achilles || !myColor || !revealedAchilles) return false;
    const opp = myColor === 'white' ? 'black' : 'white';
    if (!revealedAchilles[opp]) return false;
    const a = achilles[opp];
    return a && a.row === r && a.col === c;
  }
  function isLegal(r, c) {
    return legalMoves.some(([lr, lc]) => lr === r && lc === c);
  }

  // Board array: row 0 = black back rank (rank 8), row 7 = white back rank (rank 1)
  // flipped=false (white POV): iterate rows 0..7 top-to-bottom → black at top, white at bottom ✓
  // flipped=true  (black POV): iterate rows 7..0 top-to-bottom → white at top, black at bottom ✓
  const rows = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const cols = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  // Rank number beside each row: row 0 → rank 8, row 7 → rank 1
  function rankLabel(rowIdx) { return 8 - rowIdx; }
  // Bottom-most rendered row (for file label overlay)
  const bottomRenderedRow = rows[rows.length - 1];

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {/* Rank labels */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map(rowIdx => (
          <div key={rowIdx} style={{
            width: 24, height: S, display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', paddingRight: 6,
            fontSize: 13, fontWeight: 700, color: 'var(--label-color, #8a7a5a)',
            fontFamily: 'Georgia, serif', userSelect: 'none',
          }}>
            {rankLabel(rowIdx)}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Board grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(8, ${S}px)`,
          gridTemplateRows: `repeat(8, ${S}px)`,
          border: '3px solid #5c4a2a',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,220,140,0.15)',
        }}>
          {rows.map(r =>
            cols.map(c => {
              const isLight = (r + c) % 2 === 0;
              const isSelected = selected && selected[0] === r && selected[1] === c;
              const legal = isLegal(r, c);
              const ach   = isMyAchilles(r, c);
              const pat   = isMyPatroclus(r, c);
              const oAch  = isRevealedOppAchilles(r, c);
              const cell  = board?.[r]?.[c];

              let bg = isLight ? '#f0d9b5' : '#b58863';
              if (isSelected)                bg = isLight ? '#7fc97f' : '#5aaa5a';
              else if (ach && !hideMarkers)  bg = isLight ? '#ffe066' : '#d4a800';
              else if (pat && !hideMarkers)  bg = isLight ? '#82d4f5' : '#4fa8d6';
              else if (oAch && !hideMarkers) bg = isLight ? '#ff9999' : '#cc5555';
              else if (legal && cell)        bg = isLight ? '#e8c060' : '#c09830';

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => onCellClick(r, c)}
                  style={{
                    width: S, height: S, background: bg,
                    position: 'relative',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.12s',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Legal move dot */}
                  {legal && !cell && (
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.22)',
                      position: 'absolute',
                    }} />
                  )}
                  {/* Piece */}
                  {cell && (
                    <span style={{
                      fontSize: 46,
                      lineHeight: 1,
                      userSelect: 'none',
                      color: cell.color === 'white' ? '#fff' : '#1a1108',
                      textShadow: cell.color === 'white'
                        ? '0 0 3px #555, 0 1px 3px #000'
                        : '0 0 3px rgba(255,255,255,0.3)',
                      filter: immortal?.[cell.color] && (ach || oAch)
                        ? 'drop-shadow(0 0 8px gold)'
                        : 'none',
                      transition: 'filter 0.3s',
                    }}>
                      {SYMBOLS[cell.color]?.[cell.type] || '?'}
                    </span>
                  )}
                  {/* Achilles marker — only shown when not hidden (online/post-game) */}
                  {ach && !hideMarkers && (
                    <span style={{
                      position: 'absolute', top: 2, right: 3,
                      fontSize: 11, fontWeight: 900, color: '#b8860b',
                      fontFamily: 'Georgia, serif',
                      textShadow: '0 0 2px #fff',
                    }}>A</span>
                  )}
                  {/* Patroclus marker */}
                  {pat && !hideMarkers && (
                    <span style={{
                      position: 'absolute', top: 2, left: 3,
                      fontSize: 11, fontWeight: 900, color: '#1a6896',
                      fontFamily: 'Georgia, serif',
                      textShadow: '0 0 2px #fff',
                    }}>P</span>
                  )}
                  {/* Revealed opponent Achilles */}
                  {oAch && !hideMarkers && (
                    <span style={{
                      position: 'absolute', bottom: 2, right: 3,
                      fontSize: 11, fontWeight: 900, color: '#8b0000',
                      fontFamily: 'Georgia, serif',
                    }}>!</span>
                  )}
                  {/* File label on bottom-most rendered row */}
                  {r === bottomRenderedRow && (
                    <span style={{
                      position: 'absolute', bottom: 2, left: 3,
                      fontSize: 11, color: isLight ? '#b58863' : '#f0d9b5',
                      fontFamily: 'Georgia, serif', fontWeight: 700,
                      userSelect: 'none', opacity: 0.85,
                    }}>
                      {FILES[c]}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* File labels */}
        <div style={{ display: 'flex', paddingLeft: 0 }}>
          {cols.map(c => (
            <div key={c} style={{
              width: S, height: 22, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 13, fontWeight: 700,
              color: 'var(--label-color, #8a7a5a)',
              fontFamily: 'Georgia, serif', userSelect: 'none',
            }}>
              {FILES[c]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}