// File: frontend/src/components/ChessGame.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ChessBoard from './ChessBoard';

// ─── Constants ────────────────────────────────────────────────
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (window.location.hostname === 'localhost'
    ? 'ws://localhost:10000'
    : 'wss://achillesheelonline.onrender.com');

function safeSend(ws, data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(data));
  return true;
}

// ─── Local engine ──────────────────────────────────────────────
function makeId() { return Math.random().toString(36).slice(2); }
function makePiece(type, color) { return { type, color, id: makeId() }; }
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

// ─── Styled button ────────────────────────────────────────────
const Btn = ({ children, onClick, disabled, style={}, variant='gold' }) => {
  const variants = {
    gold:  { background: 'linear-gradient(135deg,#c9a227,#8a6800)', color:'#fff8e1', border:'1px solid #c9a227' },
    grey:  { background: 'linear-gradient(135deg,#4a4035,#2a2018)', color:'#c8b89a', border:'1px solid #5a5045' },
    red:   { background: 'linear-gradient(135deg,#8b2222,#5a0f0f)',  color:'#ffe0d0', border:'1px solid #aa3333' },
    steel: { background: 'linear-gradient(135deg,#2c4a6e,#1a2e47)', color:'#a8c8ee', border:'1px solid #3a6090' },
    olive: { background: 'linear-gradient(135deg,#556B2F,#3a4a1f)',  color:'#d4e8a0', border:'1px solid #6a8040' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:'10px 22px', fontSize:14, borderRadius:6, cursor:disabled?'not-allowed':'pointer',
      fontFamily:'"Trajan Pro","Palatino Linotype",Palatino,Georgia,serif',
      fontWeight:700, letterSpacing:'0.08em',
      boxShadow:'0 2px 8px rgba(0,0,0,0.5)', transition:'filter 0.15s, transform 0.1s',
      opacity:disabled?0.5:1, textTransform:'uppercase', ...variants[variant], ...style,
    }}
    onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.filter='brightness(1.2)'; }}
    onMouseLeave={e=>{ e.currentTarget.style.filter='none'; }}
    >{children}</button>
  );
};

// ─── Toast ────────────────────────────────────────────────────
function ToastLayer({ toasts }) {
  return (
    <div style={{ position:'fixed', right:18, bottom:18, zIndex:1200, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background:'rgba(20,14,4,0.97)', color:'#e8c87a', padding:'11px 18px',
          borderRadius:8, fontSize:13, fontFamily:'"Palatino Linotype",Georgia,serif',
          border:'1px solid #7a5c00', boxShadow:'0 4px 20px rgba(0,0,0,0.7)',
          maxWidth:300, lineHeight:1.5, letterSpacing:'0.02em',
        }}>{t.message}</div>
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────
function Modal({ title, children, onClose }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:2000,
      background:'rgba(8,6,2,0.85)',
      display:'flex', alignItems:'center', justifyContent:'center',
      backdropFilter:'blur(4px)',
    }}>
      <div style={{
        background:'linear-gradient(160deg,#1e1608,#120e04)',
        border:'1px solid #8a6820',
        borderRadius:12, padding:'36px 40px', maxWidth:520, width:'92%',
        boxShadow:'0 20px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(201,162,39,0.15)',
        textAlign:'center', color:'#f0d890',
        fontFamily:'"Palatino Linotype",Georgia,serif',
      }}>
        {title && <div style={{ fontSize:24, fontWeight:700, marginBottom:20, letterSpacing:'0.06em',
          fontFamily:'"Trajan Pro","Palatino Linotype",Georgia,serif',
          textShadow:'0 0 20px rgba(201,162,39,0.4)',
        }}>{title}</div>}
        {children}
        {onClose && <div style={{ marginTop:24 }}><Btn onClick={onClose}>Continue</Btn></div>}
      </div>
    </div>
  );
}

// ─── Rules Modal ──────────────────────────────────────────────
const RULES = [
  { icon:'⚔', title:'The Achilles', text:"Before the battle, each warrior secretly designates one non-pawn piece as their Achilles — their hidden vulnerability. Lose your Achilles and the war is over." },
  { icon:'🛡', title:'Patroclus — The Shield', text:"The piece mirroring your Achilles across the board becomes your Patroclus. When Patroclus falls, your Achilles is roused to fury." },
  { icon:'✦', title:'The Rage of Achilles', text:"If your Patroclus is captured, your Achilles becomes immortal for 5 of your opponent's moves. Any piece that dares attack an immortal Achilles dies instead." },
  { icon:'☽', title:'The Immortal Clash', text:"Should both Achilles be immortal and one charges the other, the attack is cancelled and both identities are revealed to the battlefield." },
  { icon:'♟', title:'Pawn Promotion', text:"A promoted pawn offers two gifts: Discover your foe's Achilles type — or Change your own Achilles by touching a piece on the board." },
];

function RulesModal({ onClose }) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:3000,
      background:'rgba(8,6,2,0.92)',
      display:'flex', alignItems:'center', justifyContent:'center',
      backdropFilter:'blur(6px)',
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'linear-gradient(160deg,#1e1608,#120e04)',
        border:'1px solid #8a6820',
        borderRadius:12, padding:'36px 40px', maxWidth:560, width:'92%',
        maxHeight:'85vh', overflowY:'auto',
        boxShadow:'0 20px 80px rgba(0,0,0,0.9), inset 0 1px 0 rgba(201,162,39,0.15)',
        color:'#f0d890', fontFamily:'"Palatino Linotype",Georgia,serif',
      }}>
        <div style={{ fontSize:22, fontWeight:700, marginBottom:24, letterSpacing:'0.1em', textAlign:'center',
          fontFamily:'"Trajan Pro","Palatino Linotype",Georgia,serif',
          color:'#c9a227', textShadow:'0 0 20px rgba(201,162,39,0.4)',
        }}>⚔ Laws of War</div>

        {RULES.map((rule, i) => (
          <div key={i}>
            <div style={{ display:'flex', gap:16, alignItems:'flex-start', padding:'16px 0' }}>
              <div style={{
                width:40, height:40, borderRadius:'50%', flexShrink:0,
                border:'1px solid #3a2a0e',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:16, color:'#7a5a20',
              }}>{rule.icon}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:5, color:'#c9a227',
                  letterSpacing:'0.08em', textTransform:'uppercase',
                  fontFamily:'"Trajan Pro","Palatino Linotype",Georgia,serif',
                }}>{rule.title}</div>
                <div style={{ fontSize:13, color:'#7a6030', lineHeight:1.75 }}>{rule.text}</div>
              </div>
            </div>
            {i < RULES.length-1 && (
              <div style={{ height:1, background:'linear-gradient(90deg,transparent,#2a1e08 30%,#2a1e08 70%,transparent)' }} />
            )}
          </div>
        ))}

        <div style={{ marginTop:24, textAlign:'center' }}>
          <Btn onClick={onClose}>Close</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Promotion modal ──────────────────────────────────────────
function PromotionModal({ color, onChoose, onChangeMode, changeMode }) {
  if (changeMode) {
    return (
      <div style={{
        width:'100%', maxWidth:590,
        background:'linear-gradient(90deg,rgba(20,14,4,0.97),rgba(30,20,6,0.97))',
        border:'1px solid #c9a227', borderRadius:8,
        padding:'12px 18px', display:'flex', alignItems:'center', gap:14,
        fontFamily:'"Palatino Linotype",Georgia,serif',
        boxShadow:'0 0 20px rgba(201,162,39,0.2)',
      }}>
        <span style={{ fontSize:18 }}>⚡</span>
        <span style={{ flex:1, fontSize:14, color:'#f0d890', lineHeight:1.5 }}>
          <b>Click any of your non-pawn pieces</b> to crown it as your new Achilles.
          Your pawn will become your current Achilles type.
        </span>
        <Btn onClick={() => onChangeMode(false)} variant='grey' style={{ padding:'6px 14px', fontSize:12, flexShrink:0 }}>
          Cancel
        </Btn>
      </div>
    );
  }

  return (
    <Modal title="⚔ Pawn Promoted">
      <div style={{ fontSize:14, color:'#c8a86a', marginBottom:20, lineHeight:1.7 }}>
        {color[0].toUpperCase()+color.slice(1)}'s pawn reached the end of the board. Choose your fate:
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <button onClick={() => onChoose('discover', null)} style={{
          padding:'14px 20px', borderRadius:8, cursor:'pointer', textAlign:'left',
          background:'rgba(44,74,110,0.3)', border:'1px solid #3a6090',
          color:'#a8c8ee', fontFamily:'"Palatino Linotype",Georgia,serif',
          transition:'all 0.15s',
        }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(44,74,110,0.5)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(44,74,110,0.3)'}
        >
          <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>🔍 Discover Enemy Achilles Type</div>
          <div style={{ fontSize:12, opacity:0.8 }}>Reveal what type of piece the enemy Achilles is. Your pawn becomes that type.</div>
        </button>
        <button onClick={() => onChangeMode(true)} style={{
          padding:'14px 20px', borderRadius:8, cursor:'pointer', textAlign:'left',
          background:'rgba(201,162,39,0.15)', border:'1px solid #8a6820',
          color:'#f0d890', fontFamily:'"Palatino Linotype",Georgia,serif',
          transition:'all 0.15s',
        }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(201,162,39,0.25)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(201,162,39,0.15)'}
        >
          <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>⚡ Change Your Achilles</div>
          <div style={{ fontSize:12, opacity:0.8 }}>Click a piece on the board to crown it as your new Achilles. Your pawn takes the old Achilles type.</div>
        </button>
      </div>
    </Modal>
  );
}

// ─── Status bar ───────────────────────────────────────────────
function StatusBar({ text, immortal }) {
  return (
    <div style={{
      background:'linear-gradient(90deg,rgba(20,14,4,0.9),rgba(30,20,6,0.9))',
      border:'1px solid #4a3a15',
      borderRadius:8, padding:'10px 18px',
      display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
      fontFamily:'"Palatino Linotype",Georgia,serif',
    }}>
      <span style={{ fontSize:15, color:'#f0d890', flex:1, letterSpacing:'0.02em' }}>{text}</span>
      {immortal?.white && (
        <span style={{ background:'rgba(255,215,0,0.12)', border:'1px solid rgba(255,215,0,0.4)',
          borderRadius:6, padding:'3px 10px', fontSize:12, color:'#ffd700', letterSpacing:'0.04em' }}>
          ✦ WHITE IMMORTAL ({immortal.countdown?.white ?? immortal.immortalCountdown?.white ?? 0})
        </span>
      )}
      {immortal?.black && (
        <span style={{ background:'rgba(147,112,219,0.15)', border:'1px solid rgba(147,112,219,0.4)',
          borderRadius:6, padding:'3px 10px', fontSize:12, color:'#9370db', letterSpacing:'0.04em' }}>
          ✦ BLACK IMMORTAL ({immortal.countdown?.black ?? immortal.immortalCountdown?.black ?? 0})
        </span>
      )}
    </div>
  );
}

// ─── Move log ─────────────────────────────────────────────────
function MoveLog({ moves }) {
  const ref = useRef(null);
  useEffect(() => { if(ref.current) ref.current.scrollTop=ref.current.scrollHeight; }, [moves]);
  const toAlg = sq => sq ? String.fromCharCode(97+sq[1])+(8-sq[0]) : '?';
  return (
    <div style={{
      width:220, minWidth:180,
      background:'linear-gradient(180deg,rgba(14,10,3,0.95),rgba(20,14,4,0.95))',
      border:'1px solid #3a2a0e',
      borderRadius:10, overflow:'hidden',
      display:'flex', flexDirection:'column',
      fontFamily:'"Palatino Linotype",Georgia,serif',
    }}>
      <div style={{
        padding:'12px 14px', borderBottom:'1px solid #3a2a0e',
        fontSize:12, fontWeight:700, letterSpacing:'0.15em',
        color:'#8a7040', textTransform:'uppercase',
        background:'rgba(201,162,39,0.06)',
      }}>Scroll of Moves</div>
      <div ref={ref} style={{ flex:1, overflowY:'auto', padding:'10px 12px', maxHeight:500 }}>
        {(!moves||moves.length===0) && (
          <div style={{ color:'#4a3a15', fontSize:12, fontStyle:'italic', textAlign:'center', paddingTop:20 }}>
            No moves yet...
          </div>
        )}
        {(moves||[]).map((m,i) => (
          <div key={i} style={{
            marginBottom:6, paddingBottom:6,
            borderBottom: i<moves.length-1 ? '1px solid rgba(58,42,14,0.5)' : 'none',
            lineHeight:1.5,
          }}>
            <span style={{ color:'#5a4a20', fontSize:11 }}>{i+1}.</span>{' '}
            <span style={{ fontSize:13, color:'#d4b870' }}>
              {m.from ? `${toAlg(m.from)}→${toAlg(m.to)} ` : ''}
              {m.piece?.type||''}
            </span>
            {m.captured && <span style={{ color:'#c05050', fontSize:12 }}> ×{m.captured.type}</span>}
            {m.note && <div style={{ color:'#9a7a30', fontSize:11, fontStyle:'italic', marginTop:2 }}>{m.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────
function Legend() {
  const items = [
    { color:'#c9a227', symbol:'A', label:'Your Achilles' },
    { color:'#4a9fd6', symbol:'P', label:'Your Patroclus' },
  ];
  return (
    <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontFamily:'"Palatino Linotype",Georgia,serif', fontSize:12, color:'#7a6030' }}>
      {items.map(({color,symbol,label})=>(
        <span key={symbol} style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontWeight:900, color, fontSize:13 }}>{symbol}</span>
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

function GreekDivider() {
  return (
    <div style={{ width:'100%', display:'flex', alignItems:'center', gap:10, margin:'4px 0' }}>
      <div style={{ flex:1, height:1, background:'linear-gradient(90deg,transparent,#4a3a15)' }} />
      <span style={{ color:'#4a3a15', fontSize:16 }}>⊕</span>
      <div style={{ flex:1, height:1, background:'linear-gradient(90deg,#4a3a15,transparent)' }} />
    </div>
  );
}

// ─── Top bar (shared between local and online game views) ─────
function GameTopBar({ label, sublabel, onBack, onRules }) {
  return (
    <div style={{
      padding:'10px 20px',
      borderBottom:'1px solid #2a1e08',
      display:'flex',
      alignItems:'center',
      gap:12,
      background:'linear-gradient(90deg,rgba(14,10,3,0.98),rgba(20,14,4,0.98))',
      position:'sticky',
      top:0,
      zIndex:100,
    }}>
      <div style={{
        fontFamily:'"Trajan Pro","Palatino Linotype",Palatino,Georgia,serif',
        fontSize:17,
        fontWeight:700,
        color:'#c9a227',
        letterSpacing:'0.15em',
        textTransform:'uppercase',
        textShadow:'0 0 20px rgba(201,162,39,0.3)',
      }}>
        {label || '⚔ Achilles Heel'}
      </div>

      {sublabel && (
        <div style={{
          fontSize:13,
          color:'#7a6030',
          fontFamily:'"Palatino Linotype",Georgia,serif'
        }}>
          {sublabel}
        </div>
      )}

      <div style={{ marginLeft:'auto', display:'flex', gap:10, alignItems:'center' }}>
      
      <button
      onClick={onRules}
      style={{
        background:'none',
        border:'1px solid #3a2a10',
        borderRadius:6,
        color:'#c9a227',
        cursor:'pointer',
        padding:'5px 14px',
        fontSize:11,
        fontFamily:'"Palatino Linotype",Georgia,serif',
        letterSpacing:'0.1em',
        textTransform:'uppercase',
      }}
    >
      ⚔ Rules
      </button>

        <button
          onClick={onBack}
          style={{
            background:'none',
            border:'1px solid #3a2a10',
            borderRadius:6,
            color:'#6a5a30',
            cursor:'pointer',
            padding:'5px 14px',
            fontSize:11,
            fontFamily:'"Palatino Linotype",Georgia,serif',
            letterSpacing:'0.1em',
            textTransform:'uppercase',
            transition:'all 0.15s',
          }}
        >
          ← Home
        </button>
      </div>
    </div>
  );
}
// ─── Share URL bar ────────────────────────────────────────────
function ShareBar({ url, roomCode }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div style={{
      width:'100%', maxWidth:590,
      background:'rgba(201,162,39,0.06)',
      border:'1px solid #4a3a15',
      borderRadius:8, padding:'10px 14px',
      display:'flex', alignItems:'center', gap:10,
      fontFamily:'"Palatino Linotype",Georgia,serif',
    }}>
      <div style={{ fontSize:11, color:'#5a4820', letterSpacing:'0.08em', textTransform:'uppercase', flexShrink:0 }}>
        Room <b style={{ color:'#c9a227', letterSpacing:'0.15em' }}>{roomCode}</b>
      </div>
      <div style={{
        flex:1, fontSize:12, color:'#9a8050', fontFamily:'monospace',
        background:'rgba(0,0,0,0.25)', border:'1px solid #2a1e08',
        borderRadius:5, padding:'5px 8px',
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>{url}</div>
      <button onClick={copy} style={{
        flexShrink:0,
        background: copied ? 'linear-gradient(135deg,#556B2F,#3a4a1f)' : 'linear-gradient(135deg,#c9a227,#8a6800)',
        color: copied ? '#d4e8a0' : '#fff8e1',
        border:'none', borderRadius:5,
        padding:'6px 14px', fontSize:12, cursor:'pointer',
        fontFamily:'"Trajan Pro","Palatino Linotype",Georgia,serif',
        fontWeight:700, letterSpacing:'0.08em',
        transition:'all 0.2s',
      }}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
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
  const [selected, setSelected]     = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [modal, setModal]           = useState(null);
  const [toasts, setToasts]         = useState([]);
  const [promotionChangeMode, setPromotionChangeMode] = useState(false);
  const [showRules, setShowRules]   = useState(false);

  const addToast = useCallback((msg, ms=3500) => {
    const id = Date.now()+Math.random();
    setToasts(t=>[...t,{id,message:msg}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),ms);
  },[]);

  const turnColor = state.turn % 2 === 0 ? 'white' : 'black';
  const bothChosen = state.achilles.white && state.achilles.black;

  function statusText() {
    if (state.winner) return `⚔ ${state.winner[0].toUpperCase()+state.winner.slice(1)} is Victorious`;
    if (promotionChangeMode) return `${turnColor[0].toUpperCase()+turnColor.slice(1)}: click the piece you wish to crown as your new Achilles`;
    if (!bothChosen) {
      if (!state.achilles[turnColor]) return `${turnColor[0].toUpperCase()+turnColor.slice(1)}: secretly choose your Achilles (click any non-pawn)`;
      return `Waiting for ${turnColor==='white'?'Black':'White'} to choose their Achilles…`;
    }
    return `${turnColor[0].toUpperCase()+turnColor.slice(1)}'s Turn`;
  }

  function handleClick(r, c) {
    if (state.winner) return;

    if (promotionChangeMode && state.promotion) {
      const piece = state.board[r]?.[c];
      const pColor = state.promotion.color;
      if (!piece || piece.color !== pColor || piece.type === 'Pawn') {
        addToast('Choose one of your non-pawn pieces as your new Achilles');
        return;
      }
      const { row: pRow, col: pCol } = state.promotion;
      if (r === pRow && c === pCol) { addToast('Cannot choose the promoting pawn itself'); return; }

      setState(prev => {
        const nb = prev.board.map(row=>row.slice());
        const ach = prev.achilles[pColor];
        const oldType = ach?.type || 'Queen';
        const { row: promRow, col: promCol } = prev.promotion;
        const pawn = nb[promRow][promCol];
        nb[promRow][promCol] = { ...pawn, type: oldType };
        const newAch = { ...prev.achilles, [pColor]: { id: piece.id, row: r, col: c, type: piece.type } };
        let newPat = null;
        for(let pr=0;pr<8&&!newPat;pr++) for(let pc=0;pc<8&&!newPat;pc++) {
          const p = nb[pr]?.[pc];
          if(p&&p.color===pColor&&p.type===piece.type&&p.id!==piece.id) newPat={id:p.id,row:pr,col:pc,type:piece.type};
        }
        const newPatroclus = { ...prev.patroclus, [pColor]: newPat };
        const opp = pColor==='white'?'black':'white';
        let ic = { ...prev.immortalCountdown };
        let im = { ...prev.immortal };
        if(im[opp]&&ic[opp]>0){ic[opp]--;if(ic[opp]<=0){im[opp]=false;ic[opp]=0;}}
        addToast(`${piece.type} is your new Achilles!`);
        return { ...prev, board: nb, achilles: newAch, patroclus: newPatroclus, immortal:im, immortalCountdown:ic,
          promotion: null, turn: prev.turn+1,
          moveLog: [...prev.moveLog, { from:null, to:[promRow,promCol], piece:pawn, captured:null,
            note:`Promotion: ${piece.type} crowned as new Achilles, pawn → ${oldType}` }] };
      });
      setPromotionChangeMode(false);
      setSelected(null); setLegalMoves([]);
      return;
    }

    if (state.promotion) return;

    if (!bothChosen) {
      const piece = state.board[r]?.[c];
      if (!piece || piece.color !== turnColor || piece.type === 'Pawn') return;
      if (state.achilles[turnColor]) return;
      setState(prev => {
        const board = prev.board;
        const mr = 7-r;
        let pat = null;
        const mirrorCell = board[mr]?.[c];
        if (mirrorCell && mirrorCell.color===turnColor && mirrorCell.type===piece.type && mirrorCell.id!==piece.id) {
          pat = { id:mirrorCell.id, row:mr, col:c, type:mirrorCell.type };
        } else {
          for(let pr=0;pr<8&&!pat;pr++) for(let pc=0;pc<8&&!pat;pc++) {
            const p = board[pr]?.[pc];
            if(p&&p.color===turnColor&&p.type===piece.type&&p.id!==piece.id)
              pat={id:p.id,row:pr,col:pc,type:p.type};
          }
        }
        return {
          ...prev,
          achilles:  { ...prev.achilles,  [turnColor]: { id:piece.id, row:r, col:c, type:piece.type } },
          patroclus: { ...prev.patroclus, [turnColor]: pat },
          turn: prev.turn+1,
        };
      });
      setSelected(null); setLegalMoves([]);
      return;
    }

    if (!selected) {
      const piece = state.board[r]?.[c];
      if (!piece || piece.color !== turnColor) return;
      setSelected([r,c]);
      setLegalMoves(getLegalMovesLocal(state.board, r, c));
      return;
    }

    const [sr, sc] = selected;
    if (sr===r && sc===c) { setSelected(null); setLegalMoves([]); return; }

    const target = state.board[r]?.[c];
    if (target && target.color === turnColor) {
      setSelected([r,c]);
      setLegalMoves(getLegalMovesLocal(state.board, r, c));
      return;
    }

    if (!isValidMoveLocal(state.board, [sr,sc], [r,c])) {
      addToast('That move is not permitted');
      setSelected(null); setLegalMoves([]);
      return;
    }

    {
      const piece  = state.board[sr][sc];
      const tgt    = state.board[r][c];
      const opp    = turnColor === 'white' ? 'black' : 'white';
      const oppAch = state.achilles[opp];
      const myAch  = state.achilles[turnColor];
      const isOppAch = oppAch && tgt && tgt.id === oppAch.id;
      const isMeAch  = myAch  && piece.id === myAch.id;

      if (isOppAch && state.immortal[opp]) {
        if (isMeAch && state.immortal[turnColor]) {
          setState(prev => ({
            ...prev,
            revealedAchilles: { white: true, black: true },
            moveLog: [...prev.moveLog, { from:[sr,sc], to:[r,c], piece, captured:null,
              note:'⚔ Immortal Clash! Both Achilles revealed — move cancelled' }],
          }));
          setSelected(null); setLegalMoves([]);
          return;
        }
        if (isMeAch && !state.immortal[turnColor]) {
          setState(prev => {
            const nb = prev.board.map(row => row.slice());
            nb[sr][sc] = null;
            let ic = { ...prev.immortalCountdown };
            let im = { ...prev.immortal };
            ic[opp]--; if (ic[opp] <= 0) { im[opp] = false; ic[opp] = 0; }
            return { ...prev, board: nb, winner: opp, immortal: im, immortalCountdown: ic,
              moveLog: [...prev.moveLog, { from:[sr,sc], to:[r,c], piece, captured:null,
                note:`⚔ Your Achilles charged into an immortal — ${opp} wins!` }] };
          });
          setSelected(null); setLegalMoves([]);
          return;
        }
        setState(prev => {
          const nb = prev.board.map(row => row.slice());
          nb[sr][sc] = null;
          let ic = { ...prev.immortalCountdown };
          let im = { ...prev.immortal };
          ic[opp]--; if (ic[opp] <= 0) { im[opp] = false; ic[opp] = 0; }
          return { ...prev, board: nb, turn: prev.turn + 1, immortal: im, immortalCountdown: ic,
            moveLog: [...prev.moveLog, { from:[sr,sc], to:[r,c], piece, captured:null,
              note:`Attacker slain — ${opp} Achilles is immortal` }] };
        });
        setSelected(null); setLegalMoves([]);
        return;
      }
    }

    setState(prev => {
      const piece  = prev.board[sr][sc];
      const tgt    = prev.board[r][c];
      const opp    = turnColor==='white'?'black':'white';
      const nb     = prev.board.map(row=>row.slice());
      const oppAch = prev.achilles[opp];
      const oppPat = prev.patroclus[opp];
      const isOppAch = oppAch && tgt && tgt.id === oppAch.id;
      const isOppPat = oppPat && tgt && tgt.id === oppPat.id;

      if (isOppAch) {
        nb[r][c] = piece; nb[sr][sc] = null;
        return { ...prev, board:nb, winner:turnColor,
          moveLog:[...prev.moveLog,{from:[sr,sc],to:[r,c],piece,captured:tgt,
            note:'⚔ Achilles slain — the war is over'}] };
      }
      if (isOppPat) {
        nb[r][c] = piece; nb[sr][sc] = null;
        const im={...prev.immortal,[opp]:true};
        const ic={...prev.immortalCountdown,[opp]:5};
        const newPat={...prev.patroclus,[opp]:null};
        return { ...prev, board:nb, patroclus:newPat, immortal:im, immortalCountdown:ic, turn:prev.turn+1,
          moveLog:[...prev.moveLog,{from:[sr,sc],to:[r,c],piece,captured:tgt,
            note:`Patroclus slain — ${opp} Achilles immortal for 5 moves`}] };
      }

      nb[r][c] = piece; nb[sr][sc] = null;
      let newAch  = {...prev.achilles};
      let newPat2 = {...prev.patroclus};
      for(const col of ['white','black']) {
        if(newAch[col]?.row===sr&&newAch[col]?.col===sc) newAch[col]={...newAch[col],row:r,col:c};
        if(newPat2[col]?.row===sr&&newPat2[col]?.col===sc) newPat2[col]={...newPat2[col],row:r,col:c};
      }
      let ic={...prev.immortalCountdown}, im={...prev.immortal};
      if(im[opp]&&ic[opp]>0){ic[opp]--;if(ic[opp]<=0){im[opp]=false;ic[opp]=0;}}

      if(piece.type==='Pawn'&&((turnColor==='white'&&r===0)||(turnColor==='black'&&r===7))) {
        return { ...prev, board:nb, achilles:newAch, patroclus:newPat2, immortal:im, immortalCountdown:ic,
          promotion:{ row:r, col:c, color:turnColor },
          moveLog:[...prev.moveLog,{from:[sr,sc],to:[r,c],piece,captured:tgt,note:'Promotion pending'}] };
      }
      return { ...prev, board:nb, turn:prev.turn+1, achilles:newAch, patroclus:newPat2,
        immortal:im, immortalCountdown:ic,
        moveLog:[...prev.moveLog,{from:[sr,sc],to:[r,c],piece,captured:tgt}] };
    });
    setSelected(null); setLegalMoves([]);
  }

  function handlePromotion(option) {
    if (option === 'discover') {
      setState(prev => {
        if (!prev.promotion) return prev;
        const { row, col, color } = prev.promotion;
        const opp = color==='white'?'black':'white';
        const pawn = prev.board[row][col];
        const nb = prev.board.map(r=>r.slice());
        const oppAchType = prev.achilles[opp]?.type || 'Queen';
        nb[row][col] = { ...pawn, type: oppAchType };
        const revealed = { ...prev.revealedAchilles, [opp]: true };
        let ic={...prev.immortalCountdown}, im={...prev.immortal};
        const oppColor = color==='white'?'black':'white';
        if(im[oppColor]&&ic[oppColor]>0){ic[oppColor]--;if(ic[oppColor]<=0){im[oppColor]=false;ic[oppColor]=0;}}
        addToast(`Enemy Achilles is a ${oppAchType}! Both ${oppAchType}s are now highlighted.`);
        return { ...prev, board:nb, revealedAchilles:revealed, promotion:null, turn:prev.turn+1,
          immortal:im, immortalCountdown:ic,
          moveLog:[...prev.moveLog,{from:null,to:[row,col],piece:pawn,captured:null,
            note:`Discover: enemy Achilles type = ${oppAchType}`}] };
      });
    } else if (option === 'change') {
      setPromotionChangeMode(true);
    }
  }

  const localRevealedEnemyType = (() => {
    const opp = turnColor === 'white' ? 'black' : 'white';
    if (state.revealedAchilles[opp]) return state.achilles[opp]?.type ?? null;
    return null;
  })();

  return (
    <div style={{ minHeight:'100vh', background:'#0e0a03' }}>
      {showRules && (
  <Modal title="⚔ Laws of War" onClose={() => setShowRules(false)}>
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {RULES.map((rule, i) => (
        <div key={i} style={{ display:'flex', gap:14 }}>
          <div style={{ fontSize:18 }}>{rule.icon}</div>
          <div>
            <div style={{
              fontWeight:700,
              fontSize:13,
              color:'#c9a227',
              letterSpacing:'0.08em',
              textTransform:'uppercase'
            }}>
              {rule.title}
            </div>
            <div style={{
              fontSize:13,
              color:'#7a6030',
              lineHeight:1.6
            }}>
              {rule.text}
            </div>
          </div>
        </div>
      ))}
    </div>
  </Modal>
)}

      <div style={{ display:'flex', gap:0, alignItems:'flex-start', justifyContent:'center', padding:'16px 8px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center', flex:'0 0 auto' }}>
          <div style={{ width:'100%', maxWidth:590 }}>
            <StatusBar text={statusText()} immortal={{ ...state.immortal, countdown:state.immortalCountdown }} />
          </div>

          {state.promotion && !promotionChangeMode && (
            <PromotionModal color={state.promotion.color} onChoose={handlePromotion} onChangeMode={setPromotionChangeMode} changeMode={false} />
          )}
          {modal && <Modal title={modal.title} onClose={()=>setModal(null)}>{modal.body}</Modal>}
          <ToastLayer toasts={toasts} />
          {promotionChangeMode && (
            <PromotionModal color={state.promotion?.color} onChoose={()=>{}} onChangeMode={setPromotionChangeMode} changeMode={true} />
          )}

          <ChessBoard
            board={state.board}
            onCellClick={handleClick}
            selected={selected}
            legalMoves={bothChosen && !state.winner ? legalMoves : []}
            achilles={state.achilles}
            patroclus={state.patroclus}
            myColor={turnColor}
            revealedAchilles={state.revealedAchilles}
            revealedEnemyType={localRevealedEnemyType}
            immortal={state.immortal}
            hideMarkers={true}
            highlightChangeMode={promotionChangeMode}
            promotionColor={state.promotion?.color}
          />
        </div>
        <div style={{ paddingLeft:16, paddingTop:6, flex:'0 0 220px' }}>
          <MoveLog moves={state.moveLog} />
        </div>
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
  const [promotionChangeMode, setPromotionChangeMode] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

  const addToast = useCallback((msg, ms=3500) => {
    const id = Date.now()+Math.random();
    setToasts(t=>[...t,{id,message:msg}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),ms);
  },[]);

  useEffect(() => {
    if (!ws) return;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type==='sync') {
        setGame(prev => ({...msg.gameState, myColor: prev?.myColor || myColor}));
        setSelected(null); setLegalMoves([]);
        setPromotionChangeMode(false);
      } else if (msg.type==='invalid-move') {
        addToast(`⚔ ${msg.reason||'Invalid move'}`);
      } else if (msg.type==='opponent-disconnected') {
        addToast('Your opponent has fled the battlefield.');
      } else if (msg.type==='game-over') {
        setModal({ title:`${msg.winner[0].toUpperCase()+msg.winner.slice(1)} is Victorious ⚔` });
      } else if (msg.type==='player-joined') {
        addToast('Your opponent has entered the arena!');
      }
    };
  }, [ws, addToast, myColor]);

  const board = game?.board;
  const opp = myColor==='white'?'black':'white';
  const turnColor = game ? (game.turn%2===0?'white':'black') : 'white';
  const isMyTurn = turnColor===myColor;
  const myAchillesChosen = !!game?.achilles?.[myColor];
  const oppAchillesChosen = !!game?.achilles?.[opp];
  const bothChosen = myAchillesChosen && oppAchillesChosen;
  const myPromotion = game?.promotion?.color===myColor ? game.promotion : null;

  function statusText() {
    if (!game) return 'Awaiting connection…';
    if (game.winner) return `⚔ ${game.winner[0].toUpperCase()+game.winner.slice(1)} is Victorious`;
    if (!myAchillesChosen) return 'Choose your Achilles — click any non-pawn piece';
    if (!oppAchillesChosen) return 'Your Achilles is set. Awaiting your opponent…';
    if (myPromotion && promotionChangeMode) return 'Click a piece on the board to crown your new Achilles';
    if (myPromotion) return 'Promotion awaits your decision';
    return isMyTurn ? '⚔ Your Turn' : "Awaiting opponent's move…";
  }

  function sendWS(obj) {
    try { ws.send(JSON.stringify(obj)); } catch(_) {}
  }

  function handleClick(r, c) {
    if (!game || game.winner) return;

    if (promotionChangeMode && myPromotion) {
      const piece = board?.[r]?.[c];
      if (!piece || piece.color!==myColor || piece.type==='Pawn') {
        addToast('Click one of your non-pawn pieces'); return;
      }
      const {row:pRow,col:pCol} = myPromotion;
      if(r===pRow&&c===pCol){addToast('Cannot choose the promoting pawn');return;}
      // Send flat fields (server reads data.option, data.chosenRow, etc.)
      sendWS({ type:'promotion', option:'change', newType:piece.type, chosenRow:r, chosenCol:c });
      setPromotionChangeMode(false);
      return;
    }

    if (!myAchillesChosen) {
      const piece = board?.[r]?.[c];
      if (!piece || piece.color!==myColor || piece.type==='Pawn') return;
      sendWS({ type:'choose-achilles', row:r, col:c });
      return;
    }

    if (!bothChosen||!isMyTurn||game.promotion) return;

    if (!selected) {
      const piece = board?.[r]?.[c];
      if (!piece||piece.color!==myColor) return;
      setSelected([r,c]);
      setLegalMoves(getLegalMovesLocal(board,r,c));
      return;
    }

    const [sr,sc] = selected;
    if(sr===r&&sc===c){setSelected(null);setLegalMoves([]);return;}
    const target = board?.[r]?.[c];
    if(target&&target.color===myColor){setSelected([r,c]);setLegalMoves(getLegalMovesLocal(board,r,c));return;}

    // Send flat fields (server reads data.from, data.to)
    sendWS({ type:'move', from:[sr,sc], to:[r,c] });
    setSelected(null); setLegalMoves([]);
  }

  function handlePromotion(option) {
    if (option==='discover') {
      sendWS({ type:'promotion', option:'discover' });
    } else if (option==='change') {
      setPromotionChangeMode(true);
    }
  }

  const revealedEnemyType = game?.revealedAchilles?.[opp] ? game?.achilles?.[opp]?.type : null;

  return (
    <div style={{ minHeight:'100vh', background:'#0e0a03' }}>
      <GameTopBar
        label={`ROOM ${roomCode}`}
        sublabel={`You are ${myColor.toUpperCase()}`}
        onBack={onBack}
        onRules={() => setShowRules(true)}
      />
      {showRules && (
  <Modal title="⚔ Laws of War" onClose={() => setShowRules(false)}>
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {RULES.map((rule, i) => (
        <div key={i} style={{ display:'flex', gap:14 }}>
          <div style={{ fontSize:18 }}>{rule.icon}</div>
          <div>
            <div style={{
              fontWeight:700,
              fontSize:13,
              color:'#c9a227',
              letterSpacing:'0.08em',
              textTransform:'uppercase'
            }}>
              {rule.title}
            </div>
            <div style={{
              fontSize:13,
              color:'#7a6030',
              lineHeight:1.6
            }}>
              {rule.text}
            </div>
          </div>
        </div>
      ))}
    </div>
  </Modal>
)}

      <div style={{ display:'flex', gap:0, alignItems:'flex-start', justifyContent:'center', padding:'16px 8px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center', flex:'0 0 auto' }}>

          {/* Share URL bar */}
          <ShareBar url={shareUrl} roomCode={roomCode} />

          <div style={{ width:'100%', maxWidth:590 }}>
            <StatusBar text={statusText()} immortal={game?{...game.immortal,countdown:game.immortalCountdown}:null} />
          </div>

          {myPromotion && !promotionChangeMode && (
            <PromotionModal color={myColor} onChoose={handlePromotion} onChangeMode={setPromotionChangeMode} changeMode={false} />
          )}
          {modal && <Modal title={modal.title} onClose={()=>setModal(null)} />}
          <ToastLayer toasts={toasts} />
          {promotionChangeMode && (
            <PromotionModal color={myColor} onChoose={()=>{}} onChangeMode={setPromotionChangeMode} changeMode={true} />
          )}

          {board && (
            <ChessBoard
              board={board}
              onCellClick={handleClick}
              selected={selected}
              legalMoves={bothChosen&&isMyTurn&&!game?.winner?legalMoves:[]}
              achilles={game?.achilles}
              patroclus={game?.patroclus}
              myColor={myColor}
              revealedAchilles={game?.revealedAchilles}
              revealedEnemyType={revealedEnemyType}
              immortal={game?.immortal}
              flipped={myColor==='black'}
              highlightChangeMode={promotionChangeMode}
              promotionColor={myPromotion?.color}
            />
          )}
          <div style={{ width:'100%', maxWidth:590 }}><Legend /></div>
        </div>

        <div style={{ paddingLeft:16, paddingTop:6, flex:'0 0 220px' }}>
          <MoveLog moves={game?.moveLog} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  LOBBY
// ═══════════════════════════════════════════════════════════════
function Lobby({ onLocalPlay, onEnterGame }) {
  const [inputCode, setInputCode]    = useState('');
  const [status, setStatus]          = useState('');
  const [shareLink, setShareLink]    = useState('');
  const [roomCode, setRoomCode]      = useState('');
  const [copied, setCopied]          = useState(false);
  const wsRef = useRef(null);

  // Auto-join from URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code?.length >= 4) joinRoom(code.toUpperCase());
  }, []);

  function connect(onOpen) {
    if (wsRef.current) { try { wsRef.current.close(); } catch(_) {} }
    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;
    socket.onopen = onOpen;
    socket.onerror = () => setStatus('⚔ Connection failed. The server may be asleep — try again in a moment.');
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type==='room-created') {
        const code = msg.roomCode || Math.random().toString(36).slice(2, 8).toUpperCase();
        setRoomCode(code);
        const link = `${window.location.origin}${window.location.pathname}?room=${code}`;
        setShareLink(link);
        // Update URL without navigation
        window.history.replaceState({}, '', `?room=${code}`);
        setStatus('Room created! Share the link with your opponent, then wait here.');
      } else if (msg.type==='player-joined') {
        setStatus('⚔ Opponent arrived! Entering arena…');
      } else if (msg.type==='sync') {
        // Enter the game screen — push a new history entry so back button works
        window.history.pushState({ game: true }, '', window.location.href);
        onEnterGame({
          roomCode:
            roomCode ||
            new URLSearchParams(window.location.search).get('room') ||
            Math.random().toString(36).slice(2, 8).toUpperCase(),
          myColor: msg.myColor,
          initialState: msg.gameState,
          ws: wsRef.current,
        });
      } else if (msg.type==='error') {
        setStatus(msg.message || 'An error occurred');
      }
    };
  }

  function createRoom() {
    setStatus('Forging the arena…');
    connect(() => wsRef.current.send(JSON.stringify({ type:'create-room' })));
  }

  function joinRoom(code) {
    const room = (code || inputCode).toUpperCase().trim();
    if (!room) { setStatus('Enter a room code first'); return; }
    setStatus(`Entering room ${room}…`);
    connect(() => wsRef.current.send(JSON.stringify({ type:'join-room', roomCode: room })));
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18, alignItems:'center', padding:'40px 20px', maxWidth:480, margin:'0 auto' }}>
      <div style={{ fontSize:22, color:'#4a3a15', letterSpacing:'0.3em' }}>⊕ ⚔ ⊕</div>

      <Btn onClick={createRoom} style={{ width:'100%', fontSize:16, padding:'16px 0', letterSpacing:'0.1em' }}>
        ⊕ Create Online Room
      </Btn>

      {shareLink && (
        <div style={{
          width:'100%', background:'rgba(201,162,39,0.08)',
          border:'1px solid #5a4420', borderRadius:8, padding:16,
          fontFamily:'"Palatino Linotype",Georgia,serif',
        }}>
          <div style={{ fontSize:12, color:'#8a7040', marginBottom:8, letterSpacing:'0.1em', textTransform:'uppercase' }}>
            Share this link with your opponent:
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{
              flex:1, fontSize:12, color:'#c9a227', background:'rgba(0,0,0,0.3)',
              border:'1px solid #3a2a0e', borderRadius:6, padding:'8px 10px',
              wordBreak:'break-all', fontFamily:'monospace',
            }}>{shareLink}</div>
            <Btn onClick={copyLink} variant={copied?'olive':'gold'} style={{ padding:'8px 14px', fontSize:12, flexShrink:0 }}>
              {copied ? '✓ Copied' : 'Copy'}
            </Btn>
          </div>
          <div style={{ marginTop:8, fontSize:12, color:'#5a4420' }}>
            Room code: <b style={{ color:'#c9a227', letterSpacing:'0.15em' }}>{roomCode}</b>
          </div>
        </div>
      )}

      <GreekDivider />

      <div style={{ display:'flex', gap:10, width:'100%' }}>
        <input
          value={inputCode}
          onChange={e=>setInputCode(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==='Enter'&&joinRoom()}
          maxLength={8}
          placeholder='Enter room code…'
          style={{
            flex:1, fontSize:15, padding:'11px 14px', borderRadius:6,
            border:'1px solid #4a3a15', background:'rgba(201,162,39,0.05)',
            color:'#f0d890', fontFamily:'"Palatino Linotype",Georgia,serif',
            outline:'none', letterSpacing:'0.1em',
          }}
        />
        <Btn onClick={()=>joinRoom()}>Join</Btn>
      </div>

      <GreekDivider />

      <Btn onClick={onLocalPlay} variant='steel' style={{ width:'100%', fontSize:16, padding:'16px 0', letterSpacing:'0.1em' }}>
        ⚔ Local 2-Player Duel
      </Btn>

      {status && (
        <div style={{
          fontFamily:'"Palatino Linotype",Georgia,serif', fontSize:14, color:'#c9a227',
          textAlign:'center', background:'rgba(20,14,4,0.8)',
          border:'1px solid #4a3a15', borderRadius:8, padding:'12px 18px',
          width:'100%', letterSpacing:'0.02em', lineHeight:1.6,
        }}>{status}</div>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────
export default function ChessGame() {
  const [screen, setScreen] = useState('lobby'); // 'lobby' | 'local' | 'online'
  const [onlineProps, setOnlineProps] = useState(null);

  // Handle browser back button
  useEffect(() => {
    function handlePop(e) {
      // If we're in a game, popstate means user pressed back → go to lobby
      if (screen === 'online' || screen === 'local') {
        setScreen('lobby');
        setOnlineProps(null);
      }
    }
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [screen]);

  function enterOnlineGame(props) {
    setOnlineProps(props);
    setScreen('online');
  }

  function goHome() {
  const confirmLeave = window.confirm('Are you sure you want to leave the game?');
  if (!confirmLeave) return;

  window.history.replaceState({}, '', window.location.pathname);
  setScreen('lobby');
  setOnlineProps(null);
}

  if (screen === 'local') {
    return <LocalGame onBack={goHome} />;
  }

  if (screen === 'online' && onlineProps) {
    return (
      <OnlineGame
        {...onlineProps}
        onBack={() => {
          try { onlineProps.ws?.close(); } catch(_) {}
          goHome();
        }}
      />
    );
  }

  return <Lobby onLocalPlay={() => setScreen('local')} onEnterGame={enterOnlineGame} />;
} 