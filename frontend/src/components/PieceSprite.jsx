// File: frontend/src/components/PieceSprite.jsx
// Path: AchillesHeelOnline/frontend/src/components/PieceSprite.jsx
import React from "react";
import { pieceSprites } from "../assets/pieces/pieceSprites";

export default function PieceSprite({ color, type, size = 40, alt = "" }) {
  const src = pieceSprites[color]?.[type];
  if (!src) return null;
  if (typeof src === 'string') {
    // Emoji fallback, force white color for white pieces
    const style = {
      fontSize: size,
      lineHeight: 1,
      userSelect: "none",
      color: color === 'white' ? '#fff' : undefined,
      WebkitTextStroke: color === 'white' ? '1.5px #222' : undefined,
      filter: color === 'white' ? 'drop-shadow(0 0 2px #222)' : undefined,
    };
    return <span style={style}>{src}</span>;
  }
  return <img src={src} alt={alt || `${color} ${type}`} width={size} height={size} draggable={false} style={{ userSelect: "none" }} />;
}
