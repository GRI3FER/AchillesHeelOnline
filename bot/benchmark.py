"""
Benchmark Suite - Test bot against random baseline
Tracks improvement over training iterations
"""

import time
from typing import Dict, Tuple
from achilles_game import AchillesGame, Color, PieceType
import random
from fast_mcts_bot import FastMCTSBot
from random_bot import RandomBot


class BotVsBotMatchup:
    """Play games between two bots"""
    
    def __init__(self, bot1, bot2, bot1_name: str = "Bot1", bot2_name: str = "Bot2"):
        self.bot1 = bot1
        self.bot2 = bot2
        self.bot1_name = bot1_name
        self.bot2_name = bot2_name
    
    def play_game(self, max_moves: int = 100, verbose: bool = False) -> Tuple[str, int]:
        """Play one game: bot1 is white, bot2 is black"""
        game = AchillesGame()
        
        # Random Achilles
        for color in [Color.WHITE, Color.BLACK]:
            while True:
                row, col = random.randint(0, 7), random.randint(0, 7)
                piece = game.board[row][col]
                if piece and piece.color == color and piece.type != PieceType.PAWN:
                    game.set_achilles(color, row, col)
                    break
        
        # Play game
        for move_num in range(1, max_moves + 1):
            if game.winner:
                return 'white' if game.winner == Color.WHITE else 'black', move_num
            
            if game.promotion:
                game.handle_promotion(game.promotion['color'], 'discover')
                continue
            
            color = Color.WHITE if game.turn % 2 == 0 else Color.BLACK
            
            # Get move from appropriate bot
            if color == Color.WHITE:
                from_pos, to_pos = self.bot1.get_move(game, color)
            else:
                from_pos, to_pos = self.bot2.get_move(game, color)
            
            if from_pos is None:
                return None, move_num
            
            game.apply_move(from_pos, to_pos)
        
        return None, max_moves
    
    def play_series(self, n_games: int = 10, verbose: bool = False) -> Dict:
        """Play N games and return statistics"""
        results = {'white_wins': 0, 'black_wins': 0, 'draws': 0, 'avg_length': 0}
        total_length = 0
        
        for game_num in range(n_games):
            winner, length = self.play_game(verbose=verbose)
            total_length += length
            
            if winner == 'white':
                results['white_wins'] += 1
            elif winner == 'black':
                results['black_wins'] += 1
            else:
                results['draws'] += 1
            
            if verbose or (game_num + 1) % max(1, n_games // 10) == 0:
                print(f"  Game {game_num + 1}/{n_games}: {winner or 'DRAW'}")
        
        results['avg_length'] = total_length / n_games
        results['white_win_rate'] = results['white_wins'] / n_games
        results['black_win_rate'] = results['black_wins'] / n_games
        
        return results


class BenchmarkSuite:
    """Comprehensive bot evaluation"""
    
    def __init__(self, bot_iterations: int = 50):
        self.mcts_bot = FastMCTSBot()
        self.random_bot = RandomBot()
        self.bot_iterations = bot_iterations
    
    def benchmark_vs_random(self, n_games: int = 20) -> Dict:
        """Test MCTS bot vs Random bot (MCTS plays white)"""
        print(f"\nMCTS Bot ({self.bot_iterations} iter) vs Random Bot")
        print("-" * 50)
        
        # Create a modified MCTS bot that uses get_move interface
        class MCTSBotInterface:
            def __init__(self, mcts_bot, iterations):
                self.mcts_bot = mcts_bot
                self.iterations = iterations
            
            def get_move(self, game, color):
                return self.mcts_bot.mcts_search(game, color, iterations=self.iterations)
        
        mcts_interface = MCTSBotInterface(self.mcts_bot, self.bot_iterations)
        matchup = BotVsBotMatchup(mcts_interface, self.random_bot, "MCTS", "Random")
        
        start_time = time.time()
        results = matchup.play_series(n_games, verbose=True)
        elapsed = time.time() - start_time
        
        print(f"\nResults:")
        print(f"  MCTS (white): {results['white_wins']}/{n_games} wins ({results['white_win_rate']*100:.1f}%)")
        print(f"  Random (black): {results['black_wins']}/{n_games} wins ({results['black_win_rate']*100:.1f}%)")
        print(f"  Draws: {results['draws']}")
        print(f"  Avg game length: {results['avg_length']:.1f} moves")
        print(f"  Time: {elapsed:.1f}s ({n_games/elapsed:.1f} games/min)")
        
        return results
    
    def benchmark_vs_self(self, n_games: int = 10) -> Dict:
        """Test MCTS bot vs itself"""
        print(f"\nMCTS Bot (self-play, {self.bot_iterations} iter)")
        print("-" * 50)
        
        class MCTSBotInterface:
            def __init__(self, mcts_bot, iterations):
                self.mcts_bot = mcts_bot
                self.iterations = iterations
            
            def get_move(self, game, color):
                return self.mcts_bot.mcts_search(game, color, iterations=self.iterations)
        
        mcts1 = MCTSBotInterface(FastMCTSBot(), self.bot_iterations)
        mcts2 = MCTSBotInterface(FastMCTSBot(), self.bot_iterations)
        matchup = BotVsBotMatchup(mcts1, mcts2, "MCTS1", "MCTS2")
        
        start_time = time.time()
        results = matchup.play_series(n_games, verbose=True)
        elapsed = time.time() - start_time
        
        print(f"\nResults:")
        print(f"  White wins: {results['white_wins']}/{n_games} ({results['white_win_rate']*100:.1f}%)")
        print(f"  Black wins: {results['black_wins']}/{n_games} ({results['black_win_rate']*100:.1f}%)")
        print(f"  Draws: {results['draws']}")
        print(f"  Avg game length: {results['avg_length']:.1f} moves")
        print(f"  Time: {elapsed:.1f}s ({n_games/elapsed:.1f} games/min)")
        
        return results
    
    def run_full_benchmark(self):
        """Run complete benchmark suite"""
        print("\n" + "=" * 70)
        print("BENCHMARK SUITE")
        print("=" * 70)
        
        # Test 1: vs Random
        random_results = self.benchmark_vs_random(n_games=20)
        
        # Test 2: vs Self
        self_results = self.benchmark_vs_self(n_games=10)
        
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)
        print(f"\nvs Random:")
        print(f"  Win rate: {random_results['white_win_rate']*100:.1f}%")
        print(f"  Target: >90% (indicate strong performance)")
        
        print(f"\nvs Self:")
        print(f"  White win rate: {self_results['white_win_rate']*100:.1f}%")
        print(f"  Expected: ~50% (fair game)")
        
        # Overall assessment
        if random_results['white_win_rate'] > 0.9:
            print("\n[PASS] Bot is strong - beats random >90%")
        elif random_results['white_win_rate'] > 0.7:
            print("\n[OKAY] Bot is decent - beats random >70%")
        else:
            print("\n[WARN] Bot is weak - beats random <70%")


if __name__ == "__main__":
    import sys
    
    iterations = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    
    benchmark = BenchmarkSuite(bot_iterations=iterations)
    benchmark.run_full_benchmark()
