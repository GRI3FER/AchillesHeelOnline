"""
Parallel Training - Run multiple games concurrently
Uses multiprocessing to maximize CPU utilization
"""

import multiprocessing as mp
from multiprocessing import Pool, Queue
import sys
import time
from training_loop import TrainingRunner
from training_db import TrainingDatabase


def play_game_worker(args):
    """Worker function for multiprocessing"""
    game_num, iterations = args
    runner = TrainingRunner(bot_iterations=iterations)
    result = runner.play_training_game(verbose=False)
    return result


class ParallelTrainingRunner:
    """Orchestrates parallel self-play training"""
    
    def __init__(self, num_workers: int = 4, bot_iterations: int = 50, db_path: str = "training.db"):
        self.num_workers = num_workers
        self.bot_iterations = bot_iterations
        self.db = TrainingDatabase(db_path)
    
    def train_parallel(self, num_games: int = 100, checkpoint_interval: int = 50):
        """Run training using multiprocessing"""
        print(f"\nStarting parallel training:")
        print(f"  Games: {num_games}")
        print(f"  Workers: {self.num_workers}")
        print(f"  Iterations: {self.bot_iterations}")
        print("=" * 70)
        
        start_time = time.time()
        
        # Create work queue
        with Pool(self.num_workers) as pool:
            results = []
            
            for game_num in range(num_games):
                result = pool.apply_async(
                    play_game_worker,
                    ((game_num + 1, self.bot_iterations),)
                )
                results.append((game_num + 1, result))
                
                # Get result when available
                if len(results) >= checkpoint_interval or game_num == num_games - 1:
                    completed = 0
                    for g_num, res in results:
                        try:
                            game_result = res.get(timeout=300)
                            completed += 1
                            
                            winner_str = game_result['winner'].value if game_result['winner'] else "DRAW"
                            print(f"[Game {g_num}] {winner_str} in {game_result['moves']} moves")
                            
                        except Exception as e:
                            print(f"[Game {g_num}] FAILED: {e}")
                    
                    if completed % checkpoint_interval == 0 or game_num == num_games - 1:
                        stats = self.db.get_stats()
                        elapsed = time.time() - start_time
                        print(f"\n--- Progress: {completed}/{num_games} games ---")
                        print(f"  White: {stats['white_wins']} ({stats['white_win_rate']*100:.1f}%)")
                        print(f"  Black: {stats['black_wins']}")
                        print(f"  Draws: {stats['draws']}")
                        print(f"  Time: {elapsed/60:.1f}m, {3600*completed/elapsed:.0f} games/hour")
        
        total_time = time.time() - start_time
        stats = self.db.get_stats()
        
        print(f"\n{'=' * 70}")
        print(f"Parallel training complete: {num_games} games in {total_time:.0f}s")
        print(f"  White wins: {stats['white_wins']} ({stats['white_win_rate']*100:.1f}%)")
        print(f"  Black wins: {stats['black_wins']}")
        print(f"  Avg length: {stats['avg_game_length']:.1f} moves")
        print(f"  Games/hour: {3600 * num_games / total_time:.0f}")


if __name__ == "__main__":
    num_games = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    workers = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    iterations = int(sys.argv[3]) if len(sys.argv) > 3 else 30
    
    # Note: multiprocessing requires 'if __name__ == "__main__"'
    runner = ParallelTrainingRunner(num_workers=workers, bot_iterations=iterations)
    runner.train_parallel(num_games=num_games, checkpoint_interval=10)
