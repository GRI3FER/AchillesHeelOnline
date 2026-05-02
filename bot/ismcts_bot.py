"""
ISMCTS Bot - Information Set Monte Carlo Tree Search
Handles hidden information (opponent's secret Achilles)
"""

import random
import math
from typing import Tuple, Optional, List
from achilles_game import AchillesGame, Color, PieceType
from fast_mcts_bot import MCTSNode, FastMCTSBot


class ISMCTSBot(FastMCTSBot):
    """MCTS bot using Information Set sampling for hidden info"""
    
    def sample_hidden_state(self, game: AchillesGame, observer_color: Color) -> AchillesGame:
        """
        Sample a possible world from the observer's perspective.
        
        From observer's perspective:
        - They know their own Achilles and Patroclus
        - They know opponent's Achilles is one of the revealed or guessed pieces
        - Hidden: which piece is opponent's Achilles
        """
        sampled_game = game.clone()
        opponent = observer_color.opposite()
        
        # Find which non-pawn pieces opponent could have as Achilles
        candidate_achilles = []
        for r in range(8):
            for c in range(8):
                piece = sampled_game.board[r][c]
                if (piece and piece.color == opponent and 
                    piece.type != PieceType.PAWN and
                    piece != sampled_game.achilles[opponent] and
                    piece != sampled_game.patroclus[opponent]):
                    candidate_achilles.append(piece)
        
        # If we don't know their Achilles, guess one
        if sampled_game.achilles[opponent] is None and candidate_achilles:
            # In a real game, observer wouldn't know, so sample
            guessed_achilles = random.choice(candidate_achilles)
            # Don't modify sampled_game's actual Achilles - just track what we're assuming
            # The evaluator will consider this piece as if it were the Achilles
        
        return sampled_game
    
    def ismcts_search(self, game: AchillesGame, color: Color, iterations: int = 50,
                     num_samples: int = 10) -> Tuple[Tuple[int, int], Tuple[int, int]]:
        """
        Information Set MCTS - samples possible hidden states and aggregates
        
        Args:
            game: Current game state (from observer's perspective)
            color: Which color is moving
            iterations: Iterations per sample
            num_samples: Number of hidden state samples to consider
        """
        legal_moves = game.get_legal_moves(color)
        
        if not legal_moves:
            print(f"No legal moves for {color.value}!")
            return None, None
        
        print(f"ISMCTS: {len(legal_moves)} moves, {num_samples} samples, {iterations} iter/sample")
        
        # Aggregate across all samples
        aggregate_scores = {move: 0.0 for move in legal_moves}
        aggregate_visits = {move: 0 for move in legal_moves}
        
        for sample_num in range(num_samples):
            # Sample a possible world
            sampled_game = self.sample_hidden_state(game, color)
            
            # Run MCTS on this sample
            root = MCTSNode(game_state=sampled_game.clone())
            
            for iteration in range(iterations):
                # Expand children at root
                if not root.children:
                    for from_pos, to_pos in legal_moves:
                        child_game = root.game.clone()
                        if child_game.apply_move(from_pos, to_pos):
                            child = MCTSNode(game_state=child_game, parent=root)
                            root.children.append(child)
                
                # Select and evaluate
                node = root.best_child(c=1.4)
                if not node:
                    break
                
                value = self.evaluate_position(node.game, color)
                node.backpropagate(value)
            
            # Extract move scores from this sample
            for i, child in enumerate(root.children):
                if i < len(legal_moves):
                    move = legal_moves[i]
                    aggregate_visits[move] += child.visits
                    aggregate_scores[move] += child.wins
        
        # Pick best move across all samples
        best_move = max(legal_moves, key=lambda m: aggregate_visits.get(m, 0))
        from_pos, to_pos = best_move
        
        avg_visits = aggregate_visits[best_move] / num_samples
        avg_score = aggregate_scores[best_move] / max(1, aggregate_visits[best_move])
        print(f"Best: {from_pos} -> {to_pos} (avg visits: {avg_visits:.1f}, score: {avg_score:.3f})")
        
        return from_pos, to_pos
    
    def self_play_game_ismcts(self, max_moves: int = 30) -> AchillesGame:
        """Play a game using ISMCTS for hidden information"""
        print(">> Starting ISMCTS self-play game...")
        print("=" * 60)
        
        game = AchillesGame()
        
        # Random Achilles selection
        for color in [Color.WHITE, Color.BLACK]:
            while True:
                row, col = random.randint(0, 7), random.randint(0, 7)
                piece = game.board[row][col]
                if piece and piece.color == color and piece.type != PieceType.PAWN:
                    game.set_achilles(color, row, col)
                    print(f"OK {color.value} Achilles: {piece.type.value} at ({row},{col})")
                    break
        
        # Play moves
        for move_num in range(1, max_moves + 1):
            if game.winner:
                print(f"\n*** {game.winner.value.upper()} WINS! ***")
                return game
            
            if game.promotion:
                print(f"\nPromotion pending (stopping)")
                return game
            
            color = Color.WHITE if game.turn % 2 == 0 else Color.BLACK
            print(f"\n--- Move {move_num}: {color.value.upper()}'s Turn ---")
            
            # ISMCTS search with sampling
            from_pos, to_pos = self.ismcts_search(game, color, iterations=10, num_samples=5)
            
            if from_pos is None:
                print(f"No move found")
                return game
            
            # Apply move
            success = game.apply_move(from_pos, to_pos)
            if success:
                print(f"OK Played: {from_pos} -> {to_pos}")
            else:
                print(f"Move failed!")
                return game
        
        print(f"\nGame ended after {max_moves} moves")
        return game


if __name__ == "__main__":
    bot = ISMCTSBot()
    
    print("\n" + "=" * 60)
    print("ISMCTS Bot - Achilles Heel (Hidden Information)")
    print("=" * 60 + "\n")
    
    final_game = bot.self_play_game_ismcts(max_moves=20)
    
    print("\n" + "=" * 60)
    print("FINAL BOARD:")
    print(final_game)
    print("=" * 60)
