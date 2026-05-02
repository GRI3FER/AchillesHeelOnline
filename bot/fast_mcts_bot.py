"""
MCTS Bot using Native Python Game Engine
Much faster than HTTP-based version - no API calls needed
"""

import random
import math
from typing import Tuple, Optional, List
from stockfish import Stockfish
from achilles_game import AchillesGame, Color, PieceType


class MCTSNode:
    """Node in the MCTS tree"""
    def __init__(self, game_state: AchillesGame = None, parent: 'MCTSNode' = None):
        self.game = game_state
        self.parent = parent
        self.children: List['MCTSNode'] = []
        self.visits = 0
        self.wins = 0.0
    
    def ucb1(self, c=1.4) -> float:
        """UCB1 calculation for node selection"""
        if self.visits == 0:
            return float('inf')
        exploitation = self.wins / self.visits
        exploration = c * math.sqrt(math.log(self.parent.visits) / self.visits)
        return exploitation + exploration
    
    def best_child(self, c=1.4) -> Optional['MCTSNode']:
        """Select best child by UCB1"""
        if not self.children:
            return None
        return max(self.children, key=lambda n: n.ucb1(c))
    
    def backpropagate(self, value: float):
        """Backprop up the tree"""
        self.visits += 1
        self.wins += value
        if self.parent:
            self.parent.backpropagate(value)


class FastMCTSBot:
    """Fast MCTS bot using native game engine"""
    
    def __init__(self):
        # Try to load Stockfish
        self.sf = None
        stockfish_paths = [
            "C:\\Users\\anshg\\Downloads\\stockfish\\stockfish-windows-x86-64-avx2.exe",
            "C:\\Program Files\\stockfish\\stockfish.exe",
            "/usr/bin/stockfish",
            "/opt/homebrew/bin/stockfish",
        ]
        
        for path in stockfish_paths:
            try:
                self.sf = Stockfish(path)
                print(f"✓ Loaded Stockfish from: {path}")
                break
            except:
                pass
        
        if not self.sf:
            print("⚠️  Stockfish not found - bot will use heuristic evaluation")
    
    def evaluate_position(self, game: AchillesGame, color: Color) -> float:
        """Evaluate position from color's perspective (0-1)"""
        # Material count
        material_score = 0.0
        piece_values = {
            PieceType.PAWN: 1,
            PieceType.KNIGHT: 3,
            PieceType.BISHOP: 3,
            PieceType.ROOK: 5,
            PieceType.QUEEN: 9
        }
        
        for r in range(8):
            for c in range(8):
                piece = game.board[r][c]
                if piece:
                    value = piece_values.get(piece.type, 0)
                    if piece.color == color:
                        material_score += value
                    else:
                        material_score -= value
        
        # Normalize to roughly 0-1 range (max material = ~39)
        material_score = max(-1.0, min(1.0, material_score / 39.0))
        
        # Bonus/penalty for Achilles/Patroclus
        if game.achilles[color]:
            material_score += 0.1
        if game.patroclus[color]:
            material_score += 0.05
        
        # Immortality bonus
        if game.immortal[color]:
            material_score += 0.2
        
        # Opponent immortality penalty
        opp_color = color.opposite()
        if game.immortal[opp_color]:
            material_score -= 0.15
        
        # Pawn advancement bonus
        for r in range(8):
            for c in range(8):
                piece = game.board[r][c]
                if piece and piece.type == PieceType.PAWN:
                    if piece.color == color:
                        # Closer to enemy = better
                        if color == Color.WHITE:
                            material_score += 0.01 * (7 - r)
                        else:
                            material_score += 0.01 * r
                    else:
                        # Enemy pawns are bad
                        if piece.color == Color.WHITE:
                            material_score -= 0.005 * (7 - r)
                        else:
                            material_score -= 0.005 * r
        
        # Normalize to [0, 1] from [-1, 1]
        return (material_score + 1.0) / 2.0
    
    def mcts_search(self, game: AchillesGame, color: Color, iterations: int = 50) -> Tuple[Tuple[int, int], Tuple[int, int]]:
        """Monte Carlo Tree Search"""
        legal_moves = game.get_legal_moves(color)
        
        if not legal_moves:
            print(f"No legal moves for {color.value}!")
            return None, None
        
        print(f"MCTS: {len(legal_moves)} moves, {iterations} iterations")
        
        # Create root
        root = MCTSNode(game_state=game.clone())
        
        for iteration in range(iterations):
            # Clone game for this iteration
            sim_game = root.game.clone()
            
            # Expand children at root if needed
            if not root.children:
                for from_pos, to_pos in legal_moves:
                    child_game = root.game.clone()
                    child_game.apply_move(from_pos, to_pos)
                    child = MCTSNode(game_state=child_game, parent=root)
                    root.children.append(child)
            
            # Select best child
            node = root.best_child(c=1.4)
            if not node:
                break
            
            # Evaluate resulting position
            opp_color = color.opposite()
            value = self.evaluate_position(node.game, color)
            
            # Backpropagate
            node.backpropagate(value)
            
            if (iteration + 1) % 25 == 0:
                print(f"  {iteration + 1}/{iterations}")
        
        # Pick best move
        if not root.children:
            return None, None
        
        best_node = max(root.children, key=lambda n: n.visits)
        win_pct = (best_node.wins / best_node.visits * 100) if best_node.visits > 0 else 0
        
        # Extract move from game states
        for i, child in enumerate(root.children):
            if child == best_node:
                from_pos, to_pos = legal_moves[i]
                print(f"Best: {from_pos} -> {to_pos} (visits: {best_node.visits}, win%: {win_pct:.1f}%)")
                return from_pos, to_pos
        
        return None, None
    
    def self_play_game(self, max_moves: int = 30) -> AchillesGame:
        """Play a complete self-play game"""
        print(">> Starting self-play game...")
        print("=" * 60)
        
        game = AchillesGame()
        
        # Random Achilles selection
        for color in [Color.WHITE, Color.BLACK]:
            while True:
                row, col = random.randint(0, 7), random.randint(0, 7)
                piece = game.board[row][col]
                if piece and piece.color == color and piece.type != PieceType.PAWN:
                    game.set_achilles(color, row, col)
                    print(f"✓ {color.value} Achilles: {piece.type.value} at ({row},{col})")
                    break
        
        # Play moves
        for move_num in range(1, max_moves + 1):
            if game.winner:
                print(f"\n🏆 {game.winner.value.upper()} WINS!")
                return game
            
            if game.promotion:
                print(f"\n❌ Promotion pending (stopping)")
                return game
            
            color = Color.WHITE if game.turn % 2 == 0 else Color.BLACK
            print(f"\n--- Move {move_num}: {color.value.upper()}'s Turn ---")
            
            # MCTS search
            from_pos, to_pos = self.mcts_search(game, color, iterations=20)
            
            if from_pos is None:
                print(f"❌ No move found")
                return game
            
            # Apply move
            success = game.apply_move(from_pos, to_pos)
            if success:
                print(f"✓ Played: {from_pos} -> {to_pos}")
            else:
                print(f"❌ Move failed!")
                return game
        
        print(f"\n⏱️  Game ended after {max_moves} moves")
        return game
    
    def test_engine(self):
        """Quick engine test"""
        print("Testing Achilles Game Engine...")
        game = AchillesGame()
        print(game)
        
        # Set Achilles
        game.set_achilles(Color.WHITE, 7, 4)
        game.set_achilles(Color.BLACK, 0, 4)
        
        # Get moves
        white_moves = game.get_legal_moves(Color.WHITE)
        print(f"\nWhite has {len(white_moves)} legal moves")
        
        # Apply a move
        from_pos, to_pos = white_moves[0]
        game.apply_move(from_pos, to_pos)
        print(f"Applied move: {from_pos} -> {to_pos}")
        print(f"Turn: {game.turn}")


if __name__ == "__main__":
    bot = FastMCTSBot()
    
    # Optionally test engine first
    # bot.test_engine()
    
    print("\n" + "=" * 60)
    print("MCTS Bot - Achilles Heel (Python Engine)")
    print("=" * 60 + "\n")
    
    final_game = bot.self_play_game(max_moves=30)
    
    print("\n" + "=" * 60)
    print("FINAL BOARD:")
    print(final_game)
    print("=" * 60)
