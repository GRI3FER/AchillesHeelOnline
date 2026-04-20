import React, { useState } from 'react';
import ChessGame from './components/ChessGame';

const RULES = [
  { title: 'The Achilles', text: 'Before play begins, each player secretly selects a non-pawn piece as their Achilles — the equivalent of a King. Lose your Achilles and you lose the game.' },
  { title: 'Patroclus', text: 'The mirror-image piece of your Achilles (same column, opposite row) automatically becomes your Patroclus. Guard it well.' },
  { title: 'Immortality', text: 'If your Patroclus is captured, your Achilles becomes immortal for 5 of your opponent\'s moves. Any piece that tries to capture an immortal Achilles dies instead.' },
  { title: 'Pawn Promotion', text: 'Promoting a pawn offers a choice: Discover your opponent\'s Achilles type (the pawn becomes that type), or Change your Achilles (choose a new type; the pawn becomes your old type).' },
  { title: 'Immortal Clash', text: 'If both Achilles are immortal and one tries to capture the other, the move is cancelled and both Achilles are revealed to both players.' },
];

export default function App() {
  const [started, setStarted] = useState(false);

  if (started) {
    return (
      <div style={{
        minHeight:'100vh', background:'linear-gradient(135deg,#100c03 0%,#1a1305 60%,#0d0a02 100%)',
        overflowX:'hidden', overflowY:'auto',
      }}>
        <div style={{ padding:'12px 20px', borderBottom:'1px solid #3a2a10', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontFamily:'Palatino Linotype,Palatino,Georgia,serif', fontSize:20, fontWeight:700, color:'#c9a227', letterSpacing:'0.08em' }}>
            ⚔ ACHILLES HEEL
          </div>
          <button
            onClick={() => setStarted(false)}
            style={{ marginLeft:'auto', background:'none', border:'1px solid #3a2a10', borderRadius:6, color:'#8a7a5a', cursor:'pointer', padding:'5px 14px', fontSize:13, fontFamily:'Georgia,serif' }}
          >
            Rules
          </button>
        </div>
        <ChessGame />
      </div>
    );
  }

  return (
    <div style={{
      minHeight:'100vh',
      background:'linear-gradient(160deg,#100c03 0%,#1a1305 50%,#0d0a02 100%)',
      display:'flex', flexDirection:'column', alignItems:'center',
      fontFamily:'Palatino Linotype,Palatino,Georgia,serif',
      color:'#f5d87a', overflowX:'hidden',
    }}>
      {/* Hero */}
      <div style={{ width:'100%', maxWidth:720, padding:'60px 24px 40px', textAlign:'center' }}>
        <div style={{ fontSize:13, letterSpacing:'0.35em', color:'#8a7a5a', marginBottom:16, textTransform:'uppercase' }}>
          A Chess Variant of Hidden Identities
        </div>
        <h1 style={{
          fontSize: 'clamp(42px, 8vw, 80px)',
          fontWeight:700, margin:'0 0 8px',
          background:'linear-gradient(135deg,#f5d87a 30%,#c9a227 70%)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          letterSpacing:'0.06em', lineHeight:1.1,
        }}>
          ACHILLES HEEL
        </h1>
        {/* Tagline removed as requested */}
        <button
          onClick={() => setStarted(true)}
          style={{
            padding:'16px 56px', fontSize:20, borderRadius:12, cursor:'pointer',
            fontFamily:'Palatino Linotype,Palatino,Georgia,serif', fontWeight:700,
            letterSpacing:'0.08em', background:'linear-gradient(135deg,#c9a227,#9d7a10)',
            color:'#fff8e1', border:'none',
            boxShadow:'0 6px 30px rgba(201,162,39,0.35)',
            transition:'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 40px rgba(201,162,39,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 6px 30px rgba(201,162,39,0.35)'; }}
        >
          Enter the Arena
        </button>
      </div>

      {/* Divider */}
      <div style={{ width:'100%', maxWidth:600, height:1, background:'linear-gradient(90deg,transparent,#5c4a2a,transparent)', margin:'0 auto 48px' }} />

      {/* Rules */}
      <div style={{ width:'100%', maxWidth:680, padding:'0 24px 60px', display:'flex', flexDirection:'column', gap:24 }}>
        <div style={{ textAlign:'center', fontSize:14, letterSpacing:'0.25em', color:'#5c4a2a', textTransform:'uppercase', marginBottom:8 }}>
          Rules of Engagement
        </div>
        {RULES.map((rule, i) => (
          <div key={i} style={{
            display:'flex', gap:16, alignItems:'flex-start',
            background:'rgba(255,255,255,0.025)', border:'1px solid #2a1e08',
            borderRadius:12, padding:'18px 22px',
          }}>
            <div style={{
              width:32, height:32, borderRadius:'50%', flexShrink:0,
              background:'linear-gradient(135deg,#c9a227,#7a5c00)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:14, fontWeight:700, color:'#fff8e1',
            }}>{i+1}</div>
            <div>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:5, color:'#e8c87a', letterSpacing:'0.03em' }}>{rule.title}</div>
              <div style={{ fontSize:14, color:'#8a7a5a', lineHeight:1.6 }}>{rule.text}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ color:'#3a2a10', fontFamily:'Georgia,serif', fontSize:12, paddingBottom:24, letterSpacing:'0.08em', textTransform:'none' }}>
        Created by Ansh Gandhi
      </div>
    </div>
  );
}