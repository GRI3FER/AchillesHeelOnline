"""
Achilles Heel Chess Game Engine (Python)
Optimized for MCTS training and Stockfish integration
"""

from enum import Enum
from typing import List, Tuple, Optional, Dict, Set
from dataclasses import dataclass, field
from copy import deepcopy
import json


class Color(Enum):
    WHITE = 'white'
    BLACK = 'black'
    
    def opposite(self):
        return Color.BLACK if self == Color.WHITE else Color.WHITE


class PieceType(Enum):
    PAWN = 'Pawn'
    KNIGHT = 'Knight'
    BISHOP = 'Bishop'
    ROOK = 'Rook'
    QUEEN = 'Queen'


@dataclass
class Piece:
    """Represents a chess piece"""
    type: PieceType
    color: Color
    row: int
    col: int
    id: str
    
    def to_dict(self):
        return {
            'type': self.type.value,
            'color': self.color.value,
            'row': self.row,
            'col': self.col,
            'id': self.id
        }
    
    def __hash__(self):
        return hash(self.id)
    
    def __eq__(self, other):
        return isinstance(other, Piece) and self.id == other.id


class AchillesGame:
    """Optimized Achilles Heel Chess Engine"""
    
    def __init__(self):
        self.piece_map: Dict[str, Piece] = {}  # id -> piece for fast lookup (init first!)
        self.board: List[List[Optional[Piece]]] = self._init_board()
        self.turn = 0  # 0 = white, 1 = black
        self.achilles: Dict[Color, Optional[Piece]] = {Color.WHITE: None, Color.BLACK: None}
        self.patroclus: Dict[Color, Optional[Piece]] = {Color.WHITE: None, Color.BLACK: None}
        self.immortal: Dict[Color, bool] = {Color.WHITE: False, Color.BLACK: False}
        self.immortal_countdown: Dict[Color, int] = {Color.WHITE: 0, Color.BLACK: 0}
        self.revealed_achilles: Dict[Color, bool] = {Color.WHITE: False, Color.BLACK: False}
        self.winner: Optional[Color] = None
        self.promotion: Optional[Dict] = None
        self.move_history: List[Dict] = []
    
    def _init_board(self) -> List[List[Optional[Piece]]]:
        """Initialize standard chess board"""
        board = [[None for _ in range(8)] for _ in range(8)]
        
        # Piece ordering: Rook, Knight, Bishop, Queen, Queen, Bishop, Knight, Rook
        back_pieces = [
            PieceType.ROOK, PieceType.KNIGHT, PieceType.BISHOP, PieceType.QUEEN,
            PieceType.QUEEN, PieceType.BISHOP, PieceType.KNIGHT, PieceType.ROOK
        ]
        
        # Black back row (row 0)
        for col, piece_type in enumerate(back_pieces):
            piece_id = f"b_{piece_type.value}_{col}"
            piece = Piece(piece_type, Color.BLACK, 0, col, piece_id)
            board[0][col] = piece
            self.piece_map[piece_id] = piece
        
        # Black pawns (row 1)
        for col in range(8):
            piece_id = f"b_pawn_{col}"
            piece = Piece(PieceType.PAWN, Color.BLACK, 1, col, piece_id)
            board[1][col] = piece
            self.piece_map[piece_id] = piece
        
        # White pawns (row 6)
        for col in range(8):
            piece_id = f"w_pawn_{col}"
            piece = Piece(PieceType.PAWN, Color.WHITE, 6, col, piece_id)
            board[6][col] = piece
            self.piece_map[piece_id] = piece
        
        # White back row (row 7)
        for col, piece_type in enumerate(back_pieces):
            piece_id = f"w_{piece_type.value}_{col}"
            piece = Piece(piece_type, Color.WHITE, 7, col, piece_id)
            board[7][col] = piece
            self.piece_map[piece_id] = piece
        
        return board
    
    def set_achilles(self, color: Color, row: int, col: int) -> bool:
        """Set a piece as the Achilles for a color"""
        if self.achilles[color]:
            return False  # Already set
        
        piece = self.board[row][col]
        if not piece or piece.color != color or piece.type == PieceType.PAWN:
            return False
        
        # Set Achilles
        self.achilles[color] = piece
        
        # Find Patroclus (mirror piece) - horizontal mirror in same rank
        # Columns mirror: 0↔7, 1↔6, 2↔5, 3↔4
        mirror_col = 7 - col
        mirror_piece = self.board[row][mirror_col]
        
        if (mirror_piece and mirror_piece.color == color and 
            mirror_piece.type == piece.type and mirror_piece != piece):
            self.patroclus[color] = mirror_piece
        else:
            # Find any piece of same type (fallback)
            for r in range(8):
                for c in range(8):
                    p = self.board[r][c]
                    if (p and p.color == color and p.type == piece.type and p != piece):
                        self.patroclus[color] = p
                        break
        
        return True
    
    def is_valid_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Check if a move is valid according to chess rules"""
        fr, fc = from_pos
        tr, tc = to_pos
        
        # Out of bounds
        if not (0 <= fr < 8 and 0 <= fc < 8 and 0 <= tr < 8 and 0 <= tc < 8):
            return False
        
        # No piece at source
        piece = self.board[fr][fc]
        if not piece:
            return False
        
        # Can't capture own piece
        target = self.board[tr][tc]
        if target and target.color == piece.color:
            return False
        
        piece_type = piece.type
        
        if piece_type == PieceType.PAWN:
            return self._is_valid_pawn_move(piece, from_pos, to_pos)
        elif piece_type == PieceType.KNIGHT:
            return self._is_valid_knight_move(from_pos, to_pos)
        elif piece_type == PieceType.BISHOP:
            return self._is_valid_diagonal_move(from_pos, to_pos)
        elif piece_type == PieceType.ROOK:
            return self._is_valid_straight_move(from_pos, to_pos)
        elif piece_type == PieceType.QUEEN:
            return self._is_valid_straight_move(from_pos, to_pos) or self._is_valid_diagonal_move(from_pos, to_pos)
        
        return False
    
    def _is_valid_pawn_move(self, piece: Piece, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Validate pawn move"""
        fr, fc = from_pos
        tr, tc = to_pos
        
        # Direction: white moves down (increasing row), black moves up (decreasing row)
        direction = 1 if piece.color == Color.WHITE else -1
        
        # One square forward
        if tr == fr + direction and tc == fc:
            return not self.board[tr][tc]  # Must be empty
        
        # Two squares forward from starting position
        start_row = 6 if piece.color == Color.WHITE else 1
        if fr == start_row and tr == fr + 2 * direction and tc == fc:
            # Must have no pieces in between or destination
            return not self.board[fr + direction][fc] and not self.board[tr][tc]
        
        # Diagonal capture
        if tr == fr + direction and abs(tc - fc) == 1:
            return bool(self.board[tr][tc])  # Must have piece to capture
        
        return False
    
    def _is_valid_knight_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Validate knight move (L-shape)"""
        fr, fc = from_pos
        tr, tc = to_pos
        dr, dc = abs(tr - fr), abs(tc - fc)
        return (dr == 2 and dc == 1) or (dr == 1 and dc == 2)
    
    def _is_valid_straight_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Validate rook/queen straight move"""
        fr, fc = from_pos
        tr, tc = to_pos
        
        if fr != tr and fc != tc:
            return False  # Not straight
        
        # Check path is clear
        dr = 0 if tr == fr else (1 if tr > fr else -1)
        dc = 0 if tc == fc else (1 if tc > fc else -1)
        
        r, c = fr + dr, fc + dc
        while (r, c) != (tr, tc):
            if self.board[r][c]:
                return False
            r += dr
            c += dc
        
        return True
    
    def _is_valid_diagonal_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Validate bishop/queen diagonal move"""
        fr, fc = from_pos
        tr, tc = to_pos
        
        dr, dc = abs(tr - fr), abs(tc - fc)
        if dr != dc:
            return False  # Not diagonal
        
        # Check path is clear
        dr_dir = 1 if tr > fr else -1
        dc_dir = 1 if tc > fc else -1
        
        r, c = fr + dr_dir, fc + dc_dir
        while (r, c) != (tr, tc):
            if self.board[r][c]:
                return False
            r += dr_dir
            c += dc_dir
        
        return True
    
    def get_legal_moves(self, color: Color) -> List[Tuple[Tuple[int, int], Tuple[int, int]]]:
        """Get all legal moves for a color"""
        moves = []
        for r in range(8):
            for c in range(8):
                piece = self.board[r][c]
                if piece and piece.color == color:
                    for tr in range(8):
                        for tc in range(8):
                            if self.is_valid_move((r, c), (tr, tc)):
                                moves.append(((r, c), (tr, tc)))
        return moves
    
    def apply_move(self, from_pos: Tuple[int, int], to_pos: Tuple[int, int]) -> bool:
        """Apply a move to the game state. Returns True if successful."""
        if not self.is_valid_move(from_pos, to_pos):
            return False
        
        fr, fc = from_pos
        tr, tc = to_pos
        piece = self.board[fr][fc]
        target = self.board[tr][tc]
        color = piece.color
        opp_color = color.opposite()
        
        # Check turn
        if self.turn % 2 == 0 and color != Color.WHITE:
            return False
        if self.turn % 2 == 1 and color != Color.BLACK:
            return False
        
        # Game must be initialized
        if not self.achilles[Color.WHITE] or not self.achilles[Color.BLACK]:
            return False
        
        # Game must not be over
        if self.winner or self.promotion:
            return False
        
        attacker_is_own_achilles = piece == self.achilles[color]
        target_is_opp_achilles = target == self.achilles[opp_color]
        target_is_opp_patroclus = target == self.patroclus[opp_color]
        
        # ── Case A: Attacking opponent's Achilles ─────────────────
        if target_is_opp_achilles:
            # Both immortal → cancel, reveal both
            if self.immortal[color] and self.immortal[opp_color]:
                self.revealed_achilles[Color.WHITE] = True
                self.revealed_achilles[Color.BLACK] = True
                self.move_history.append({
                    'from': from_pos, 'to': to_pos, 'note': 'Immortal clash'
                })
                return True
            
            # Defender immortal → attacker dies
            if self.immortal[opp_color]:
                self.board[fr][fc] = None
                if attacker_is_own_achilles:
                    self.winner = opp_color
                self.move_history.append({
                    'from': from_pos, 'to': to_pos, 'note': 'Attacker dies (immortal)'
                })
                self._tick_immortality(color)
                return True
            
            # Normal capture → attacker wins
            self.board[tr][tc] = piece
            self.board[fr][fc] = None
            self.winner = color
            self.move_history.append({
                'from': from_pos, 'to': to_pos, 'note': 'Achilles slain!'
            })
            return True
        
        # ── Case B: Attacking opponent's Patroclus ────────────────
        if target_is_opp_patroclus:
            self.board[tr][tc] = piece
            self.board[fr][fc] = None
            self.patroclus[opp_color] = None
            self.immortal[opp_color] = True
            self.immortal_countdown[opp_color] = 5
            self.move_history.append({
                'from': from_pos, 'to': to_pos, 'note': 'Patroclus killed (immortal activated)'
            })
            self.turn += 1
            return True
        
        # ── Case C: Normal move ───────────────────────────────────
        self.board[tr][tc] = piece
        self.board[fr][fc] = None
        piece.row, piece.col = tr, tc
        
        # Pawn promotion
        if piece.type == PieceType.PAWN:
            if (color == Color.WHITE and tr == 0) or (color == Color.BLACK and tr == 7):
                self.promotion = {'row': tr, 'col': tc, 'color': color}
                self.move_history.append({
                    'from': from_pos, 'to': to_pos, 'note': 'Promotion pending'
                })
                return True
        
        self.move_history.append({
            'from': from_pos, 'to': to_pos, 'note': 'Normal move'
        })
        self._tick_immortality(color)
        return True
    
    def handle_promotion(self, color: Color, option: str, new_type: PieceType = None,
                        chosen_row: int = None, chosen_col: int = None) -> bool:
        """Handle pawn promotion: 'discover' or 'change'"""
        if not self.promotion or self.promotion['color'] != color:
            return False
        
        r, c = self.promotion['row'], self.promotion['col']
        pawn = self.board[r][c]
        opp_color = color.opposite()
        
        if option == 'discover':
            self.revealed_achilles[opp_color] = True
            opp_achilles_type = self.achilles[opp_color].type if self.achilles[opp_color] else PieceType.QUEEN
            pawn.type = opp_achilles_type
        
        elif option == 'change':
            old_achilles_type = self.achilles[color].type
            pawn.type = old_achilles_type
            
            # New Achilles selection
            if chosen_row is not None and chosen_col is not None:
                new_piece = self.board[chosen_row][chosen_col]
                if (new_piece and new_piece.color == color and 
                    new_piece.type != PieceType.PAWN and new_piece != pawn):
                    self.achilles[color] = new_piece
                    # Recalc Patroclus
                    self._recalc_patroclus(color)
        
        self.promotion = None
        self._tick_immortality(color)
        return True
    
    def _recalc_patroclus(self, color: Color):
        """Recalculate Patroclus for a color after Achilles change"""
        ach = self.achilles[color]
        if not ach:
            return
        
        # Try horizontal mirror position first (same rank, opposite column)
        mirror_col = 7 - ach.col
        mirror_piece = self.board[ach.row][mirror_col]
        
        if (mirror_piece and mirror_piece.color == color and 
            mirror_piece.type == ach.type and mirror_piece != ach):
            self.patroclus[color] = mirror_piece
        else:
            # Find any piece of same type
            for r in range(8):
                for c in range(8):
                    p = self.board[r][c]
                    if (p and p.color == color and p.type == ach.type and p != ach):
                        self.patroclus[color] = p
                        return
            
            self.patroclus[color] = None
    
    def _tick_immortality(self, mover_color: Color):
        """Tick immortality countdown"""
        opp_color = mover_color.opposite()
        if self.immortal[opp_color] and self.immortal_countdown[opp_color] > 0:
            self.immortal_countdown[opp_color] -= 1
            if self.immortal_countdown[opp_color] <= 0:
                self.immortal[opp_color] = False
        
        self.turn += 1
    
    def board_to_fen(self) -> str:
        """Convert board to FEN-like string (for Stockfish evaluation)"""
        fen_rows = []
        for row in self.board:
            fen_row = ""
            empty = 0
            for piece in row:
                if piece is None:
                    empty += 1
                else:
                    if empty > 0:
                        fen_row += str(empty)
                        empty = 0
                    piece_char = piece.type.value[0]
                    fen_row += piece_char.upper() if piece.color == Color.WHITE else piece_char.lower()
            if empty > 0:
                fen_row += str(empty)
            fen_rows.append(fen_row)
        return '/'.join(fen_rows)
    
    def to_dict(self) -> Dict:
        """Export game state to dictionary"""
        board_data = []
        for row in self.board:
            board_data.append([piece.to_dict() if piece else None for piece in row])
        
        return {
            'board': board_data,
            'turn': self.turn,
            'achilles': {
                'white': self.achilles[Color.WHITE].id if self.achilles[Color.WHITE] else None,
                'black': self.achilles[Color.BLACK].id if self.achilles[Color.BLACK] else None
            },
            'patroclus': {
                'white': self.patroclus[Color.WHITE].id if self.patroclus[Color.WHITE] else None,
                'black': self.patroclus[Color.BLACK].id if self.patroclus[Color.BLACK] else None
            },
            'immortal': {
                'white': self.immortal[Color.WHITE],
                'black': self.immortal[Color.BLACK]
            },
            'immortal_countdown': {
                'white': self.immortal_countdown[Color.WHITE],
                'black': self.immortal_countdown[Color.BLACK]
            },
            'revealed_achilles': {
                'white': self.revealed_achilles[Color.WHITE],
                'black': self.revealed_achilles[Color.BLACK]
            },
            'winner': self.winner.value if self.winner else None,
            'promotion': self.promotion,
            'move_history': self.move_history
        }
    
    def clone(self) -> 'AchillesGame':
        """Deep copy the game state (fast for MCTS)"""
        return deepcopy(self)
    
    def __repr__(self):
        lines = []
        lines.append("  0 1 2 3 4 5 6 7")
        for r in range(8):
            row_str = f"{r} "
            for c in range(8):
                piece = self.board[r][c]
                if piece:
                    symbol = piece.type.value[0]
                    symbol = symbol.upper() if piece.color == Color.WHITE else symbol.lower()
                else:
                    symbol = "."
                row_str += symbol + " "
            lines.append(row_str)
        return "\n".join(lines)


if __name__ == "__main__":
    # Test the engine
    game = AchillesGame()
    print("Initial board:")
    print(game)
    print()
    
    # Set Achilles
    game.set_achilles(Color.WHITE, 7, 4)  # White Queen
    game.set_achilles(Color.BLACK, 0, 4)  # Black Queen
    
    print(f"White Achilles: {game.achilles[Color.WHITE].type.value}")
    print(f"Black Achilles: {game.achilles[Color.BLACK].type.value}")
    print()
    
    # Get legal moves for white
    white_moves = game.get_legal_moves(Color.WHITE)
    print(f"White has {len(white_moves)} legal moves")
    print(f"First few: {white_moves[:5]}")
