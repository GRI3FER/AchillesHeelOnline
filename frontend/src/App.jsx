import React, { useState } from 'react';
import ChessGame from './components/ChessGame';

const RULES = [
  {
    icon: '⚔',
    title: 'The Achilles',
    text: 'Before the battle, each warrior secretly designates one non-pawn piece as their Achilles — their hidden vulnerability. Lose your Achilles and the war is over.',
  },
  {
    icon: '🛡',
    title: 'Patroclus — The Shield',
    text: 'The piece mirroring your Achilles across the board becomes your Patroclus. When Patroclus falls, your Achilles is roused to fury.',
  },
  {
    icon: '✦',
    title: 'The Rage of Achilles',
    text: 'If your Patroclus is captured, your Achilles becomes immortal for 5 of your opponent\'s moves. Any piece that dares attack an immortal Achilles dies instead.',
  },
  {
    icon: '☽',
    title: 'The Immortal Clash',
    text: 'Should both Achilles be immortal and one charges the other, the attack is cancelled and both identities are revealed to the battlefield.',
  },
  {
    icon: '♟',
    title: 'Pawn Promotion',
    text: 'A promoted pawn offers two gifts: Discover your foe\'s Achilles type — or Change your own Achilles by touching a piece on the board.',
  },
];

export default function App() {
  const [started, setStarted] = useState(false);

  if (started) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0e0a03',
        overflowX: 'hidden', overflowY: 'auto',
      }}>
        {/* Top bar */}
        <div style={{
          padding: '10px 24px',
          borderBottom: '1px solid #2a1e08',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'linear-gradient(90deg,rgba(14,10,3,0.98),rgba(20,14,4,0.98))',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{
            fontFamily: '"Trajan Pro","Palatino Linotype",Palatino,Georgia,serif',
            fontSize: 17, fontWeight: 700, color: '#c9a227',
            letterSpacing: '0.15em', textTransform: 'uppercase',
            textShadow: '0 0 20px rgba(201,162,39,0.3)',
          }}>
            ⚔ Achilles Heel
          </div>
          <button
            onClick={() => setStarted(false)}
            style={{
              marginLeft: 'auto', background: 'none',
              border: '1px solid #3a2a10', borderRadius: 6,
              color: '#6a5a30', cursor: 'pointer', padding: '5px 14px',
              fontSize: 11, fontFamily: '"Palatino Linotype",Georgia,serif',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#c9a227'; e.currentTarget.style.color='#c9a227'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#3a2a10'; e.currentTarget.style.color='#6a5a30'; }}
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
      minHeight: '100vh',
      background: '#0a0703',
      backgroundImage: `
        radial-gradient(ellipse 80% 60% at 50% -10%, rgba(201,162,39,0.08) 0%, transparent 60%),
        radial-gradient(ellipse 60% 40% at 50% 110%, rgba(100,60,0,0.12) 0%, transparent 60%)
      `,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: '"Palatino Linotype",Palatino,Georgia,serif',
      color: '#d4b870', overflow: 'hidden',
    }}>
      {/* Greek key border top */}
      <div style={{
        width: '100%', height: 6,
        background: 'linear-gradient(90deg,#0a0703,#c9a227 20%,#8a6800 40%,#c9a227 60%,#8a6800 80%,#0a0703)',
        opacity: 0.6,
      }} />

      {/* Hero section */}
      <div style={{ width: '100%', maxWidth: 760, padding: '70px 28px 50px', textAlign: 'center' }}>

        {/* Subtitle */}
        <div style={{
          fontSize: 11, letterSpacing: '0.5em', color: '#5a4820',
          marginBottom: 24, textTransform: 'uppercase',
          fontFamily: '"Trajan Pro","Palatino Linotype",Georgia,serif',
        }}>
          A Chess Variant of Hidden Fate
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(48px,10vw,96px)',
          fontWeight: 700, margin: '0 0 6px',
          fontFamily: '"Trajan Pro","Palatino Linotype",Palatino,Georgia,serif',
          background: 'linear-gradient(160deg,#f5d878 10%,#c9a227 45%,#8a6010 70%,#c9a227 90%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          letterSpacing: '0.1em', lineHeight: 1.05,
          textShadow: 'none',
          filter: 'drop-shadow(0 4px 24px rgba(201,162,39,0.2))',
        }}>
          ACHILLES
        </h1>
        <h2 style={{
          fontSize: 'clamp(24px,4vw,40px)',
          fontWeight: 400, margin: '0 0 40px',
          fontFamily: '"Trajan Pro","Palatino Linotype",Palatino,Georgia,serif',
          color: '#7a5a20', letterSpacing: '0.4em',
          textTransform: 'uppercase',
        }}>
          HEEL
        </h2>

        {/* Ornamental divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 44, justifyContent: 'center' }}>
          <div style={{ width: 80, height: 1, background: 'linear-gradient(90deg,transparent,#5a4020)' }} />
          <span style={{ color: '#5a4020', fontSize: 18, letterSpacing: '0.2em' }}>⊕ ✦ ⊕</span>
          <div style={{ width: 80, height: 1, background: 'linear-gradient(90deg,#5a4020,transparent)' }} />
        </div>

        {/* CTA */}
        <button
          onClick={() => setStarted(true)}
          style={{
            padding: '18px 64px', fontSize: 14, borderRadius: 3, cursor: 'pointer',
            fontFamily: '"Trajan Pro","Palatino Linotype",Georgia,serif',
            fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase',
            background: 'linear-gradient(160deg,#c9a227 0%,#8a6800 50%,#c9a227 100%)',
            color: '#0e0a03', border: '1px solid #c9a227',
            boxShadow: '0 0 40px rgba(201,162,39,0.2), inset 0 1px 0 rgba(255,240,150,0.3)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 0 60px rgba(201,162,39,0.4), inset 0 1px 0 rgba(255,240,150,0.4)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '0 0 40px rgba(201,162,39,0.2), inset 0 1px 0 rgba(255,240,150,0.3)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          Enter the Arena
        </button>
      </div>

      {/* Wide rule divider */}
      <div style={{
        width: '100%', maxWidth: 700,
        display: 'flex', alignItems: 'center', gap: 20,
        margin: '0 auto 56px', padding: '0 28px',
      }}>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,#3a2a0e)' }} />
        <div style={{ fontSize: 11, letterSpacing: '0.4em', color: '#3a2a0e', textTransform: 'uppercase',
          fontFamily: '"Trajan Pro","Palatino Linotype",Georgia,serif' }}>
          Laws of War
        </div>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#3a2a0e,transparent)' }} />
      </div>

      {/* Rules */}
      <div style={{ width: '100%', maxWidth: 700, padding: '0 28px 80px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {RULES.map((rule, i) => (
          <div key={i}>
            <div style={{
              display: 'flex', gap: 20, alignItems: 'flex-start',
              padding: '22px 0',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: 'transparent',
                border: '1px solid #3a2a0e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: '#7a5a20',
                boxShadow: '0 0 20px rgba(201,162,39,0.05)',
              }}>{rule.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: 700, fontSize: 15, marginBottom: 6,
                  color: '#c9a227', letterSpacing: '0.08em',
                  fontFamily: '"Trajan Pro","Palatino Linotype",Georgia,serif',
                  textTransform: 'uppercase',
                }}>{rule.title}</div>
                <div style={{ fontSize: 14, color: '#7a6030', lineHeight: 1.75, letterSpacing: '0.01em' }}>
                  {rule.text}
                </div>
              </div>
            </div>
            {i < RULES.length - 1 && (
              <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#2a1e08 30%,#2a1e08 70%,transparent)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid #1a1208', width: '100%',
        padding: '20px 0', textAlign: 'center',
        fontFamily: '"Palatino Linotype",Georgia,serif',
        fontSize: 11, color: '#2a1e08', letterSpacing: '0.2em',
        textTransform: 'uppercase',
      }}>
        Created by Ansh Gandhi
      </div>

      {/* Greek key border bottom */}
      <div style={{
        width: '100%', height: 4,
        background: 'linear-gradient(90deg,#0a0703,#c9a227 20%,#8a6800 40%,#c9a227 60%,#8a6800 80%,#0a0703)',
        opacity: 0.4,
      }} />
    </div>
  );
}