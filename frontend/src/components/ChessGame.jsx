import React, { useState, useRef, useEffect, useCallback } from 'react';
import ChessBoard from './ChessBoard';

// ─── Constants ────────────────────────────────────────────────
const WS_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:8080'
  : 'wss://achilles-heel-chess-backend.onrender.com';

const PIECE_TYPES = ['Queen', 'Rook', 'Bishop', 'Knight'];

// ─── Local engine (mirrors backend, used for local 2-player) ──
function makeId() {
  return Math.random().toString(36).slice(2);
}
function makePiece(type, color) {
  return { type, color, id: makeId() };
}
function initialBoard() {
  const back = c => [
    makePiece('Rook',c), makePiece('Knight',c), makePiece('Bishop',c),
    makePiece('Queen',c), makePiece('Queen',c),
    makePiece('Bishop',c), makePiece('Knight',c), makePiece('Rook',c),
  ];
  const pawns = c => Array.from({length:8}, () => makePiece('Pawn',c));
  const empty = () => Array(8).fill(null);
  return [
    back('black'), pawns('black'),
    empty(), empty(), empty(), empty(),
    pawns('white'), back('white'),
  ];
}
function isValidMoveLocal(board, [fr,fc], [tr,tc]) {
  if (fr===tr&&fc===tc) return false;
  if (tr<0||tr>7||tc<0||tc>7) return false;
  const piece = board[fr]?.[fc];
  if (!piece) return false;
  const target = board[tr]?.[tc];
  if (target && target.color===piece.color) return false;
  const dr=tr-fr, dc=tc-fc;
  function clear() {
    const steps=Math.max(Math.abs(dr),Math.abs(dc));
    const sr=Math.sign(dr), sc=Math.sign(dc);
    for(let i=1;i<steps;i++) if(board[fr+i*sr]?.[fc+i*sc]) return false;
    return true;
  }
  switch(piece.type) {
    case 'Pawn': {
      const dir=piece.color==='white'?-1:1, startRow=piece.color==='white'?6:1;
      if(dc===0&&dr===dir&&!target) return true;
      if(dc===0&&dr===2*dir&&fr===startRow&&!target&&!board[fr+dir]?.[fc]) return true;
      if(Math.abs(dc)===1&&dr===dir&&target&&target.color!==piece.color) return true;
      return false;
    }
    case 'Knight': return (Math.abs(dr)===2&&Math.abs(dc)===1)||(Math.abs(dr)===1&&Math.abs(dc)===2);
    case 'Bishop': return Math.abs(dr)===Math.abs(dc)&&clear();
    case 'Rook':   return (dr===0||dc===0)&&clear();
    case 'Queen':  return (Math.abs(dr)===Math.abs(dc)||dr===0||dc===0)&&clear();
    default: return false;
  }
}
function getLegalMovesLocal(board, r, c) {
  const moves = [];
  for(let tr=0;tr<8;tr++) for(let tc=0;tc<8;tc++)
    if(isValidMoveLocal(board,[r,c],[tr,tc])) moves.push([tr,tc]);
  return moves;
}
function findById(board, id) {
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r]?.[c]?.id===id) return {row:r,col:c};
  return null;
}

// ─── Styled button ────────────────────────────────────────────
const Btn = ({ children, onClick, disabled, style={}, variant='gold' }) => {
  const variants = {
    gold:  { background: 'linear-gradient(135deg,#c9a227,#9d7a10)', color:'#fff2cc', border:'1px solid #7a5c00' },
    grey:  { background: 'linear-gradient(135deg,#666,#444)',        color:'#ddd',    border:'1px solid #333' },
    red:   { background: 'linear-gradient(135deg,#b22222,#8b0000)',  color:'#ffe',    border:'1px solid #600' },
    steel: { background: 'linear-gradient(135deg,#3a6186,#1a3a5c)',  color:'#cde',    border:'1px solid #1a3a5c' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:'10px 24px', fontSize:15, borderRadius:8, cursor: disabled?'not-allowed':'pointer',
        fontFamily:'Georgia,serif', fontWeight:700, letterSpacing:'0.03em',
        boxShadow:'0 3px 10px rgba(0,0,0,0.35)', transition:'filter 0.15s, transform 0.1s',
        opacity: disabled?0.55:1,
        ...variants[variant],
        ...style,
      }}
      onMouseEnter={e => { if(!disabled) e.currentTarget.style.filter='brightness(1.15)'; }}
      onMouseLeave={e => { e.currentTarget.style.filter='none'; }}
    >
      {children}
    </button>
  );
};

// ─── Toast system ─────────────────────────────────────────────
function ToastLayer({ toasts }) {
  return (
    <div style={{ position:'fixed', right:18, bottom:18, zIndex:1200, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background:'rgba(30,20,5,0.95)', color:'#f5d87a', padding:'11px 18px',
          borderRadius:10, fontSize:14, fontFamily:'Georgia,serif',
          border:'1px solid #7a5c00', boxShadow:'0 4px 20px rgba(0,0,0,0.5)',
          maxWidth:320, lineHeight:1.4,
        }}>{t.message}</div>
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────
function Modal({ title, children, onClose }) {
  if (!children && !title) return null;
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:2000,
      background:'rgba(10,8,3,0.75)',
      display:'flex', alignItems:'center', justifyContent:'center',
      backdropFilter:'blur(3px)',
    }}>
      <div style={{
        background:'linear-gradient(160deg,#2a1f08,#1a1305)',
        border:'1px solid #7a5c00', borderRadius:16,
        padding:'36px 40px', maxWidth:480, width:'90%',
        boxShadow:'0 16px 60px rgba(0,0,0,0.7)',
        textAlign:'center', color:'#f5d87a', fontFamily:'Georgia,serif',
      }}>
        {title && <div style={{ fontSize:26, fontWeight:700, marginBottom:20, letterSpacing:'0.04em' }}>{title}</div>}
        {children}
        {onClose && (
          <div style={{ marginTop:24 }}>
            <Btn onClick={onClose}>Continue</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Promotion modal ──────────────────────────────────────────
function PromotionModal({ color, onChoose }) {
  const [mode, setMode] = useState(null); // null | 'change'
  const [newType, setNewType] = useState('Queen');

  return (
    <Modal title="Pawn Promoted — Choose">
      <div style={{ fontSize:14, color:'#cdb97a', marginBottom:20 }}>
        {color[0].toUpperCase()+color.slice(1)}'s pawn has reached the end of the board.
      </div>
      {!mode ? (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Btn onClick={() => onChoose('discover', null)} variant='steel'>
            🔍 Discover Opponent's Achilles Type
            <div style={{ fontSize:11, fontWeight:400, opacity:0.8, marginTop:3 }}>
              Your pawn becomes that piece type
            </div>
          </Btn>
          <Btn onClick={() => setMode('change')}>
            ⚡ Change Your Achilles
            <div style={{ fontSize:11, fontWeight:400, opacity:0.8, marginTop:3 }}>
              Choose a new type for your Achilles; pawn takes the old type
            </div>
          </Btn>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center' }}>
          <div style={{ fontSize:14, color:'#cdb97a' }}>Choose new Achilles type:</div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
            {PIECE_TYPES.map(t => (
              <button key={t} onClick={() => setNewType(t)} style={{
                padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:14,
                fontFamily:'Georgia,serif', fontWeight:700,
                background: newType===t ? 'linear-gradient(135deg,#c9a227,#9d7a10)' : 'rgba(255,255,255,0.07)',
                color: newType===t ? '#fff2cc' : '#cdb97a',
                border: newType===t ? '2px solid #c9a227' : '1px solid #5c4a2a',
                transition:'all 0.15s',
              }}>{t}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <Btn onClick={() => onChoose('change', newType)}>Confirm</Btn>
            <Btn onClick={() => setMode(null)} variant='grey'>Back</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Status bar ───────────────────────────────────────────────
function StatusBar({ text, immortal, myColor, turn, achillesChosen, opponentAchillesChosen }) {
  const opp = myColor === 'white' ? 'black' : 'white';
  return (
    <div style={{
      background:'rgba(30,20,5,0.85)', border:'1px solid #5c4a2a',
      borderRadius:10, padding:'12px 20px',
      display:'flex', alignItems:'center', gap:16,
      flexWrap:'wrap', fontFamily:'Georgia,serif',
    }}>
      <span style={{ fontSize:16, color:'#f5d87a', fontWeight:600, flex:1 }}>{text}</span>
      {immortal?.white && <span style={{ background:'rgba(255,215,0,0.2)', border:'1px solid gold', borderRadius:6, padding:'3px 10px', fontSize:13, color:'gold' }}>⚡ White IMMORTAL ({immortal.countdown?.white})</span>}
      {immortal?.black && <span style={{ background:'rgba(100,149,237,0.2)', border:'1px solid cornflowerblue', borderRadius:6, padding:'3px 10px', fontSize:13, color:'cornflowerblue' }}>⚡ Black IMMORTAL ({immortal.countdown?.black})</span>}
    </div>
  );
}

// ─── Move log ─────────────────────────────────────────────────
function MoveLog({ moves }) {
  const ref = useRef(null);
  useEffect(() => { if(ref.current) ref.current.scrollTop=ref.current.scrollHeight; }, [moves]);
  if(!moves?.length) return null;
  const toAlg = (sq) => sq ? String.fromCharCode(97+sq[1]) + (8-sq[0]) : '?';
  return (
    <div ref={ref} style={{
      maxHeight:160, overflowY:'auto', background:'rgba(10,8,3,0.6)',
      border:'1px solid #3a2a10', borderRadius:8, padding:10,
      fontFamily:'Georgia,serif', fontSize:13, color:'#cdb97a',
    }}>
      <div style={{ fontWeight:700, marginBottom:6, color:'#f5d87a' }}>Move Log</div>
      {moves.map((m,i) => (
        <div key={i} style={{ marginBottom:3, opacity:0.9 }}>
          <span style={{ color:'#8a7a5a' }}>{i+1}.</span>{' '}
          {m.from ? `${toAlg(m.from)}→${toAlg(m.to)} ` : ''}
          {m.piece?.type || ''}
          {m.captured ? <span style={{ color:'#c05050' }}> ×{m.captured.type}</span> : ''}
          {m.note ? <span style={{ color:'#c9a227', fontStyle:'italic' }}> ({m.note})</span> : ''}
        </div>
      ))}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{ fontFamily:'Georgia,serif', fontSize:12, color:'#8a7a5a', display:'flex', gap:16, flexWrap:'wrap' }}>
      <span><span style={{ fontWeight:700, color:'#b8860b' }}>A</span> = Your Achilles</span>
      <span><span style={{ fontWeight:700, color:'#1a6896' }}>P</span> = Your Patroclus</span>
      <span><span style={{ fontWeight:700, color:'#8b0000' }}>!</span> = Revealed Enemy Achilles</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  LOCAL 2-PLAYER GAME
// ═══════════════════════════════════════════════════════════════
function LocalGame({ onBack }) {
  const [state, setState] = useState(() => ({
    board: initialBoard(),
    turn: 0,
    achilles:  { white: null, black: null },
    patroclus: { white: null, black: null },
    immortal:  { white: false, black: false },
    immortalCountdown: { white: 0, black: 0 },
    revealedAchilles: { white: false, black: false },
    winner: null,
    promotion: null,
    moveLog: [],
  }));
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [modal, setModal] = useState(null); // { title, body }
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((msg, ms=3500) => {
    const id = Date.now()+Math.random();
    setToasts(t => [...t, {id, message: msg}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id!==id)), ms);
  }, []);

  const turnColor = state.turn % 2 === 0 ? 'white' : 'black';
  const bothAchillesChosen = state.achilles.white && state.achilles.black;
  const needsAchilles = !bothAchillesChosen;

  function statusText() {
    if (state.winner) return `🏆 ${state.winner[0].toUpperCase()+state.winner.slice(1)} wins!`;
    if (needsAchilles) {
      if (!state.achilles[turnColor]) return `${turnColor[0].toUpperCase()+turnColor.slice(1)}: secretly choose your Achilles piece (click any non-pawn)`;
      return `Waiting for ${turnColor==='white'?'black':'white'} to choose their Achilles…`;
    }
    return `${turnColor[0].toUpperCase()+turnColor.slice(1)}'s turn`;
  }

  function handleClick(r, c) {
    if (state.winner || state.promotion) return;

    // Achilles selection phase
    if (needsAchilles) {
      const piece = state.board[r]?.[c];
      if (!piece || piece.color !== turnColor || piece.type === 'Pawn') return;
      if (state.achilles[turnColor]) return; // already chosen

      setState(prev => {
        const board = prev.board;
        // Find Patroclus: prefer mirror square (same col, opposite row), else search board
        // CRITICAL: Patroclus MUST be same color as the player choosing Achilles
        const mr = 7 - r;
        let pat = null;
        const mirrorCell = board[mr]?.[c];
        if (
          mirrorCell &&
          mirrorCell.color === turnColor &&   // must be same color
          mirrorCell.type  === piece.type &&
          mirrorCell.id    !== piece.id
        ) {
          pat = { id: mirrorCell.id, row: mr, col: c, type: mirrorCell.type };
        } else {
          // Fallback: find any other piece of same type AND same color that isn't Achilles
          for (let pr = 0; pr < 8 && !pat; pr++) {
            for (let pc = 0; pc < 8 && !pat; pc++) {
              const p = board[pr]?.[pc];
              if (
                p &&
                p.color === turnColor &&   // must be same color
                p.type  === piece.type &&
                p.id    !== piece.id
              ) {
                pat = { id: p.id, row: pr, col: pc, type: p.type };
              }
            }
          }
        }
        const newAch  = { ...prev.achilles,  [turnColor]: { id: piece.id, row: r, col: c, type: piece.type } };
        const newPat  = { ...prev.patroclus, [turnColor]: pat };
        const newTurn = prev.turn + 1;
        return { ...prev, achilles: newAch, patroclus: newPat, turn: newTurn };
      });
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    // Normal play
    if (!selected) {
      const piece = state.board[r]?.[c];
      if (!piece || piece.color !== turnColor) return;
      setSelected([r, c]);
      setLegalMoves(getLegalMovesLocal(state.board, r, c));
      return;
    }

    const [sr, sc] = selected;
    if (sr === r && sc === c) { setSelected(null); setLegalMoves([]); return; }

    // Clicking own piece → re-select
    const target = state.board[r]?.[c];
    if (target && target.color === turnColor) {
      setSelected([r, c]);
      setLegalMoves(getLegalMovesLocal(state.board, r, c));
      return;
    }

    if (!isValidMoveLocal(state.board, [sr,sc], [r,c])) {
      addToast('Illegal move');
      setSelected(null); setLegalMoves([]);
      return;
    }

    // Execute move
    setState(prev => {
      const piece  = prev.board[sr][sc];
      const target = prev.board[r][c];
      const opp    = turnColor === 'white' ? 'black' : 'white';
      const nb     = prev.board.map(row => row.slice());

      // Check if target is opponent Achilles
      const oppAch = prev.achilles[opp];
      const isOppAch = oppAch && target && target.id === oppAch.id;
      // Check if target is opponent Patroclus
      const oppPat = prev.patroclus[opp];
      const isOppPat = oppPat && target && target.id === oppPat.id;

      // Immortality: if opponent Achilles and they are immortal → attacker dies
      if (isOppAch && prev.immortal[opp]) {
        nb[sr][sc] = null;
        const newLog = [...prev.moveLog, { from:[sr,sc], to:[r,c], piece, captured:null, note:`Attacker dies — ${opp} Achilles is immortal` }];
        // Tick immortality
        let ic = { ...prev.immortalCountdown };
        let im = { ...prev.immortal };
        ic[opp]--;
        if (ic[opp] <= 0) { im[opp] = false; ic[opp] = 0; }
        return { ...prev, board: nb, turn: prev.turn+1, immortal: im, immortalCountdown: ic, moveLog: newLog };
      }

      // Normal capture of opponent Achilles → game over
      if (isOppAch && !prev.immortal[opp]) {
        nb[r][c] = piece; nb[sr][sc] = null;
        return { ...prev, board: nb, winner: turnColor, moveLog: [...prev.moveLog, { from:[sr,sc], to:[r,c], piece, captured:target, note:'Achilles captured — game over' }] };
      }

      // Capture opponent Patroclus → grant immortality
      if (isOppPat) {
        nb[r][c] = piece; nb[sr][sc] = null;
        const im = { ...prev.immortal, [opp]: true };
        const ic = { ...prev.immortalCountdown, [opp]: 5 };
        const newPat = { ...prev.patroclus, [opp]: null };
        return { ...prev, board: nb, patroclus: newPat, immortal: im, immortalCountdown: ic, turn: prev.turn+1,
          moveLog: [...prev.moveLog, { from:[sr,sc], to:[r,c], piece, captured:target, note:`Patroclus captured — ${opp} Achilles immortal for 5 moves` }] };
      }

      // Normal move
      nb[r][c] = piece; nb[sr][sc] = null;

      // Update achilles positions
      let newAch  = { ...prev.achilles };
      let newPat2 = { ...prev.patroclus };
      for (const col of ['white','black']) {
        if (newAch[col] && newAch[col].row===sr && newAch[col].col===sc) newAch[col] = { ...newAch[col], row:r, col:c };
        if (newPat2[col] && newPat2[col].row===sr && newPat2[col].col===sc) newPat2[col] = { ...newPat2[col], row:r, col:c };
      }

      // Tick immortality
      let ic = { ...prev.immortalCountdown };
      let im = { ...prev.immortal };
      if (im[opp] && ic[opp] > 0) { ic[opp]--; if(ic[opp]<=0){im[opp]=false;ic[opp]=0;} }

      // Promotion?
      if (piece.type==='Pawn' && ((turnColor==='white'&&r===0)||(turnColor==='black'&&r===7))) {
        return { ...prev, board: nb, achilles: newAch, patroclus: newPat2, immortal: im, immortalCountdown: ic,
          promotion: { row:r, col:c, color: turnColor },
          moveLog: [...prev.moveLog, { from:[sr,sc], to:[r,c], piece, captured:target, note:'Promotion pending' }] };
      }

      return { ...prev, board: nb, turn: prev.turn+1, achilles: newAch, patroclus: newPat2, immortal: im, immortalCountdown: ic,
        moveLog: [...prev.moveLog, { from:[sr,sc], to:[r,c], piece, captured:target }] };
    });
    setSelected(null); setLegalMoves([]);
  }

  function handlePromotion(option, newType) {
    setState(prev => {
      if (!prev.promotion) return prev;
      const { row, col, color } = prev.promotion;
      const opp = color==='white'?'black':'white';
      const pawn = prev.board[row][col];
      const nb = prev.board.map(r=>r.slice());

      let newAch  = { ...prev.achilles };
      let newPat  = { ...prev.patroclus };
      let revealed = { ...prev.revealedAchilles };
      let noteStr = '';

      if (option === 'discover') {
        const oppAchType = prev.achilles[opp]?.type || 'Queen';
        nb[row][col] = { ...pawn, type: oppAchType };
        revealed[opp] = true;
        noteStr = `Promotion (discover): opponent Achilles is a ${oppAchType}`;
        addToast(`Discovered! Opponent's Achilles is a ${oppAchType}`);
      }

      if (option === 'change') {
        const chosen = newType || 'Queen';
        const ach = prev.achilles[color];
        if (ach) {
          const oldType = ach.type;
          // Pawn becomes old Achilles type
          nb[row][col] = { ...pawn, type: oldType };
          // Achilles piece changes to chosen type
          const achPos = findById(prev.board, ach.id);
          if (achPos) nb[achPos.row][achPos.col] = { ...nb[achPos.row][achPos.col], type: chosen };
          newAch[color] = { ...ach, type: chosen };
          // Find new Patroclus of chosen type (not the Achilles)
          let newP = null;
          for(let r=0;r<8&&!newP;r++) for(let c=0;c<8&&!newP;c++) {
            const p = nb[r]?.[c];
            if(p&&p.color===color&&p.type===chosen&&p.id!==ach.id) newP={id:p.id,row:r,col:c,type:chosen};
          }
          newPat[color] = newP;
          noteStr = `Promotion (change): Achilles → ${chosen}, pawn → ${oldType}`;
          addToast(`Achilles changed to ${chosen}`);
        }
      }

      // Tick immortality
      let ic = { ...prev.immortalCountdown };
      let im = { ...prev.immortal };
      const oppColor = color==='white'?'black':'white';
      if (im[oppColor] && ic[oppColor]>0) { ic[oppColor]--; if(ic[oppColor]<=0){im[oppColor]=false;ic[oppColor]=0;} }

      return { ...prev, board: nb, achilles: newAch, patroclus: newPat, revealedAchilles: revealed,
        immortal: im, immortalCountdown: ic, promotion: null, turn: prev.turn+1,
        moveLog: [...prev.moveLog, { from:null, to:[row,col], piece:pawn, captured:null, note: noteStr }] };
    });
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center', padding:'16px 8px', maxWidth:700, margin:'0 auto' }}>
      <div style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#f5d87a', letterSpacing:'0.05em' }}>Local 2-Player</div>
        <Btn onClick={onBack} variant='grey' style={{ padding:'7px 18px', fontSize:14 }}>← Back</Btn>
      </div>

      <div style={{ width:'100%' }}>
        <StatusBar
          text={statusText()}
          immortal={{ ...state.immortal, countdown: state.immortalCountdown }}
          myColor={turnColor}
        />
      </div>

      {state.promotion && <PromotionModal color={state.promotion.color} onChoose={handlePromotion} />}
      {modal && <Modal title={modal.title} onClose={() => setModal(null)}>{modal.body}</Modal>}
      <ToastLayer toasts={toasts} />

      <ChessBoard
        board={state.board}
        onCellClick={handleClick}
        selected={selected}
        legalMoves={bothAchillesChosen ? legalMoves : []}
        achilles={state.achilles}
        patroclus={state.patroclus}
        myColor={turnColor}
        revealedAchilles={state.revealedAchilles}
        immortal={state.immortal}
        hideMarkers={true}
      />

      <div style={{ width:'100%' }}>
        <MoveLog moves={state.moveLog} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ONLINE GAME
// ═══════════════════════════════════════════════════════════════
function OnlineGame({ roomCode, myColor, initialState, ws, onBack }) {
  const [game, setGame]           = useState(initialState);
  const [selected, setSelected]   = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [toasts, setToasts]       = useState([]);
  const [modal, setModal]         = useState(null);

  const addToast = useCallback((msg, ms=3500) => {
    const id = Date.now()+Math.random();
    setToasts(t => [...t, {id, message: msg}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id!==id)), ms);
  }, []);

  useEffect(() => {
    if (!ws) return;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'sync') {
        setGame({ ...msg.gameState, myColor: msg.myColor });
        setSelected(null); setLegalMoves([]);
      } else if (msg.type === 'invalid-move') {
        addToast(`❌ ${msg.reason || 'Invalid move'}`);
      } else if (msg.type === 'opponent-disconnected') {
        addToast('Opponent disconnected.');
      } else if (msg.type === 'game-over') {
        setModal({ title: `${msg.winner[0].toUpperCase()+msg.winner.slice(1)} wins! 🏆`, body: null });
      }
    };
  }, [ws, addToast]);

  const board = game?.board;
  const opp = myColor === 'white' ? 'black' : 'white';
  const turnColor = game ? (game.turn % 2 === 0 ? 'white' : 'black') : 'white';
  const isMyTurn = turnColor === myColor;
  const myAchillesChosen = !!game?.achilles?.[myColor];
  const oppAchillesChosen = !!game?.achilles?.[opp];
  const bothChosen = myAchillesChosen && oppAchillesChosen;

  function statusText() {
    if (!game) return 'Connecting…';
    if (game.winner) return `${game.winner[0].toUpperCase()+game.winner.slice(1)} wins! 🏆`;
    if (!myAchillesChosen) return 'Choose your Achilles piece (click any non-pawn)';
    if (!oppAchillesChosen) return 'Waiting for opponent to choose their Achilles…';
    if (game.promotion?.color === myColor) return 'Choose promotion option below';
    return isMyTurn ? 'Your turn' : "Opponent's turn";
  }

  function send(obj) {
    try { ws.send(JSON.stringify({ ...obj, roomCode })); } catch(_) {}
  }

  function handleClick(r, c) {
    if (!game || game.winner) return;

    // Achilles selection
    if (!myAchillesChosen) {
      const piece = board?.[r]?.[c];
      if (!piece || piece.color !== myColor || piece.type === 'Pawn') return;
      send({ type:'choose-achilles', payload:{ row:r, col:c } });
      return;
    }

    if (!bothChosen || !isMyTurn || game.promotion) return;

    // Selection / move
    if (!selected) {
      const piece = board?.[r]?.[c];
      if (!piece || piece.color !== myColor) return;
      setSelected([r, c]);
      setLegalMoves(getLegalMovesLocal(board, r, c));
      return;
    }

    const [sr, sc] = selected;
    if (sr===r && sc===c) { setSelected(null); setLegalMoves([]); return; }

    const target = board?.[r]?.[c];
    if (target && target.color === myColor) {
      setSelected([r, c]);
      setLegalMoves(getLegalMovesLocal(board, r, c));
      return;
    }

    send({ type:'move', payload:{ from:[sr,sc], to:[r,c] } });
    setSelected(null); setLegalMoves([]);
  }

  function handlePromotion(option, newType) {
    send({ type:'promotion', payload:{ option, newType } });
  }

  const myPromotion = game?.promotion?.color === myColor ? game.promotion : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center', padding:'16px 8px', maxWidth:700, margin:'0 auto' }}>
      <div style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontFamily:'Georgia,serif', color:'#f5d87a' }}>
          <span style={{ fontSize:22, fontWeight:700, letterSpacing:'0.05em' }}>Room: {roomCode}</span>
          <span style={{ fontSize:14, color:'#8a7a5a', marginLeft:12 }}>You are <b style={{ color: myColor==='white'?'#fff':'#aaa' }}>{myColor}</b></span>
        </div>
        <Btn onClick={onBack} variant='grey' style={{ padding:'7px 18px', fontSize:14 }}>← Back</Btn>
      </div>

      <div style={{ width:'100%' }}>
        <StatusBar
          text={statusText()}
          immortal={game ? { ...game.immortal, countdown: game.immortalCountdown } : null}
          myColor={myColor}
        />
      </div>

      {myPromotion && <PromotionModal color={myColor} onChoose={handlePromotion} />}
      {modal && <Modal title={modal.title} onClose={() => setModal(null)} />}
      <ToastLayer toasts={toasts} />

      {board && (
        <ChessBoard
          board={board}
          onCellClick={handleClick}
          selected={selected}
          legalMoves={bothChosen && isMyTurn ? legalMoves : []}
          achilles={game?.achilles}
          patroclus={game?.patroclus}
          myColor={myColor}
          revealedAchilles={game?.revealedAchilles}
          immortal={game?.immortal}
          flipped={myColor === 'black'}
        />
      )}

      <div style={{ width:'100%' }}>
        <Legend />
      </div>
      <div style={{ width:'100%' }}>
        <MoveLog moves={game?.moveLog} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  LOBBY
// ═══════════════════════════════════════════════════════════════
function Lobby({ onLocalPlay }) {
  const [inputCode, setInputCode]     = useState('');
  const [status, setStatus]           = useState('');
  const [connected, setConnected]     = useState(false);
  const [roomCode, setRoomCode]       = useState('');
  const [myColor, setMyColor]         = useState('');
  const [initialState, setInitState]  = useState(null);
  const wsRef = useRef(null);

  // URL auto-join
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code?.length === 6) joinRoom(code.toUpperCase());
  }, []);

  function connect(onOpen) {
    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;
    socket.onopen = onOpen;
    socket.onerror = () => setStatus('Connection failed.');
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'room-created') {
        setRoomCode(msg.roomCode);
        setStatus(`Room ${msg.roomCode} created — share this code!`);
        window.history.replaceState({}, '', `?room=${msg.roomCode}`);
      } else if (msg.type === 'player-joined') {
        setStatus('Opponent joined!');
      } else if (msg.type === 'sync') {
        setMyColor(msg.myColor);
        setInitState({ ...msg.gameState, myColor: msg.myColor });
        setConnected(true);
      } else if (msg.type === 'error') {
        setStatus(msg.message || 'Error');
      }
    };
    socket.onclose = () => {};
  }

  function createRoom() {
    setStatus('Creating room…');
    connect(() => wsRef.current.send(JSON.stringify({ type:'create-room' })));
  }

  function joinRoom(code) {
    const room = (code || inputCode).toUpperCase();
    setStatus(`Joining ${room}…`);
    connect(() => wsRef.current.send(JSON.stringify({ type:'join-room', roomCode: room })));
  }

  if (connected && initialState) {
    return (
      <OnlineGame
        roomCode={roomCode}
        myColor={myColor}
        initialState={initialState}
        ws={wsRef.current}
        onBack={() => {
          setConnected(false);
          setInitState(null);
          try { wsRef.current?.close(); } catch(_) {}
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, alignItems:'center', padding:'40px 20px', maxWidth:440, margin:'0 auto' }}>
      <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:12 }}>
        <Btn onClick={createRoom} style={{ width:'100%', fontSize:17, padding:'14px 0' }}>
          + Create Online Room
        </Btn>
        <div style={{ display:'flex', gap:10 }}>
          <input
            value={inputCode}
            onChange={e => setInputCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key==='Enter' && joinRoom()}
            maxLength={6}
            placeholder='Room code…'
            style={{
              flex:1, fontSize:16, padding:'11px 14px', borderRadius:8,
              border:'1px solid #5c4a2a', background:'rgba(255,255,255,0.05)',
              color:'#f5d87a', fontFamily:'Georgia,serif', outline:'none',
            }}
          />
          <Btn onClick={() => joinRoom()}>Join</Btn>
        </div>
        <div style={{ textAlign:'center', color:'#5c4a2a', fontSize:14, fontFamily:'Georgia,serif' }}>— or —</div>
        <Btn onClick={onLocalPlay} variant='steel' style={{ width:'100%', fontSize:17, padding:'14px 0' }}>
          ⚔ Play Local 2-Player
        </Btn>
      </div>
      {status && (
        <div style={{ fontFamily:'Georgia,serif', fontSize:15, color:'#cdb97a', textAlign:'center', background:'rgba(30,20,5,0.6)', border:'1px solid #5c4a2a', borderRadius:8, padding:'10px 16px' }}>
          {status}
        </div>
      )}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────
export default function ChessGame() {
  const [screen, setScreen] = useState('lobby'); // 'lobby' | 'local'
  if (screen === 'local') return <LocalGame onBack={() => setScreen('lobby')} />;
  return <Lobby onLocalPlay={() => setScreen('local')} />;
}