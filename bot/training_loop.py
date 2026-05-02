"""
Main Training Loop for MCTS Bot
Records games to SQLite and tracks progress
"""

import json
import time
from typing import Optional, Dict
from datetime import datetime
from achilles_game import AchillesGame, Color, PieceType
from fast_mcts_bot import FastMCTSBot
from training_db import TrainingDatabase, EloRating


class TrainingRunner:
    """Orchestrates bot training and logging"""
    
    def __init__(self, db_path: str = "training.db", bot_iterations: int = 50):
        self.db = TrainingDatabase(db_path)
        self.bot = FastMCTSBot()
        self.bot_iterations = bot_iterations
        self.elo = EloRating(initial_rating=1600)
        self.bot_version = f"v1_iter{bot_iterations}"
    
    def play_training_game(self, verbose: bool = False) -> Dict:
        """Play one training game and record to database"""
        game = AchillesGame()
        start_time = time.time()
        
        # Random Achilles selection
        achilles_types = {Color.WHITE: None, Color.BLACK: None}
        for color in [Color.WHITE, Color.BLACK]:
            while True:
                row, col = 0 if color == Color.BLACK else 7, 0
                while True:
                    piece = game.board[row][col]
                    if piece and piece.color == color and piece.type != PieceType.PAWN:
                        game.set_achilles(color, row, col)
                        achilles_types[color] = piece.type.value
                        if verbose:
                            print(f"  {color.value} Achilles: {piece.type.value}")
                        break
                    col += 1
                    if col > 7:
                        row += 1
                        col = 0
                    if row > 7:
                        break
                if achilles_types[color]:
                    break
        
        # Play game
        moves_played = []
        move_num = 0
        
        while move_num < 200 and not game.winner and not game.promotion:
            color = Color.WHITE if game.turn % 2 == 0 else Color.BLACK
            
            # Get MCTS move
            from_pos, to_pos = self.bot.mcts_search(game, color, iterations=self.bot_iterations)
            
            if from_pos is None:
                break
            
            # Record position before move
            fen = game.board_to_fen()
            legal_moves = len(game.get_legal_moves(color))
            evaluation = self.bot.evaluate_position(game, color)
            
            # Apply move
            game.apply_move(from_pos, to_pos)
            
            moves_played.append({
                'fen': fen,
                'legal_moves': legal_moves,
                'move': f"{from_pos}->{to_pos}",
                'evaluation': evaluation
            })
            
            move_num += 1
            
            if verbose and (move_num % 5 == 0 or game.winner):
                print(f"    Move {move_num}: {color.value} plays {from_pos} -> {to_pos}")
        
        # Handle promotion if needed
        if game.promotion:
            color = game.promotion['color']
            game.handle_promotion(color, 'discover')
        
        elapsed = time.time() - start_time
        
        game_data = {
            'white_achilles': achilles_types[Color.WHITE],
            'black_achilles': achilles_types[Color.BLACK],
            'winner': game.winner.value if game.winner else None,
            'moves': moves_played,
            'elapsed_seconds': elapsed
        }
        
        # Record to database
        game_id = self.db.record_game(game_data, self.bot_version)
        
        return {
            'game_id': game_id,
            'winner': game.winner,
            'moves': move_num,
            'elapsed': elapsed,
            'data': game_data
        }
    
    def train(self, num_games: int = 100, checkpoint_interval: int = 50):
        """Run training loop for N games"""
        print(f"\nStarting training: {num_games} games, {self.bot_iterations} MCTS iterations")
        print("=" * 70)
        
        start_time = time.time()
        
        for game_num in range(1, num_games + 1):
            print(f"\n[Game {game_num}/{num_games}]", end=" ")
            
            result = self.play_training_game(verbose=False)
            
            winner = result['winner']
            if winner == Color.WHITE:
                print(f"WHITE wins in {result['moves']} moves ({result['elapsed']:.1f}s)")
                self.elo.update(1.0)  # Bot (white) won
            elif winner == Color.BLACK:
                print(f"BLACK wins in {result['moves']} moves ({result['elapsed']:.1f}s)")
                self.elo.update(0.0)  # Bot (white) lost
            else:
                print(f"DRAW after {result['moves']} moves ({result['elapsed']:.1f}s)")
                self.elo.update(0.5)  # Draw
            
            # Periodic checkpoint
            if game_num % checkpoint_interval == 0:
                stats = self.db.get_stats()
                elapsed_total = time.time() - start_time
                
                print(f"\n--- CHECKPOINT: Game {game_num} ---")
                print(f"  White wins: {stats['white_wins']} ({stats['white_win_rate']*100:.1f}%)")
                print(f"  Black wins: {stats['black_wins']}")
                print(f"  Draws: {stats['draws']}")
                print(f"  Avg length: {stats['avg_game_length']:.1f} moves")
                print(f"  Bot Elo: {self.elo.get_rating():.0f}")
                print(f"  Time elapsed: {elapsed_total:.0f}s ({elapsed_total/60:.1f}m)")
                print(f"  Games/hour: {3600 * game_num / elapsed_total:.0f}")
                
                self.db.record_stats({
                    'games_played': game_num,
                    'white_wins': stats['white_wins'],
                    'black_wins': stats['black_wins'],
                    'draws': stats['draws'],
                    'avg_game_length': stats['avg_game_length'],
                    'elo_rating': self.elo.get_rating()
                }, self.bot_version)
        
        # Final stats
        total_time = time.time() - start_time
        stats = self.db.get_stats()
        
        print(f"\n{'=' * 70}")
        print(f"Training Complete: {num_games} games in {total_time:.0f}s ({total_time/60:.1f}m)")
        print(f"  White wins: {stats['white_wins']} ({stats['white_win_rate']*100:.1f}%)")
        print(f"  Black wins: {stats['black_wins']}")
        print(f"  Draws: {stats['draws']}")
        print(f"  Avg game length: {stats['avg_game_length']:.1f} moves")
        print(f"  Final Elo: {self.elo.get_rating():.0f}")
        print(f"  Games/hour: {3600 * num_games / total_time:.0f}")
        print(f"  Database: {self.db.db_path}")


if __name__ == "__main__":
    import sys
    
    # Configuration
    num_games = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    iterations = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    
    runner = TrainingRunner(bot_iterations=iterations)
    runner.train(num_games=num_games, checkpoint_interval=5)
