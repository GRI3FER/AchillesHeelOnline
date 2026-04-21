// File: frontend/src/main.jsx
// Path: AchillesHeelOnline/frontend/src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Global base styles
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background: #100c03;
    color: #f5d87a;
    font-family: Georgia, serif;
    -webkit-font-smoothing: antialiased;
  }
  button { font-family: inherit; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #100c03; }
  ::-webkit-scrollbar-thumb { background: #5c4a2a; border-radius: 3px; }
  select {
    background: rgba(20,14,3,0.9);
    color: #f5d87a;
    border: 1px solid #5c4a2a;
    border-radius: 6px;
    padding: 6px 10px;
    font-family: Georgia, serif;
    font-size: 15px;
    outline: none;
    cursor: pointer;
  }
`;
document.head.appendChild(style);

createRoot(document.getElementById('root')).render(<App />);