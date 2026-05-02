"""
Analysis Tools for Training Data
Elo tracking, weight tuning, performance analysis
"""

import sqlite3
import numpy as np
from typing import List, Dict, Tuple
from sklearn.linear_model import LinearRegression
from training_db import TrainingDatabase


class TrainingAnalyzer:
    """Analyze training progress and optimize bot"""
    
    def __init__(self, db_path: str = "training.db"):
        self.db = TrainingDatabase(db_path)
    
    def get_win_rate_over_time(self, window: int = 50) -> List[Tuple[int, float]]:
        """Get moving average win rate"""
        with sqlite3.connect(self.db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT game_id, winner FROM games ORDER BY game_id
            """)
            games = cursor.fetchall()
        
        win_rates = []
        for i in range(window, len(games), 10):
            window_games = games[i-window:i]
            white_wins = sum(1 for _, w in window_games if w == 'white')
            win_rate = white_wins / window
            win_rates.append((i, win_rate))
        
        return win_rates
    
    def extract_features(self) -> Tuple[np.ndarray, np.ndarray]:
        """
        Extract feature vectors and outcomes from positions for weight tuning
        
        Features: [material_balance, pawn_advancement, immortal_status, ...]
        Outcome: result from that position (1=win, 0=loss)
        """
        with sqlite3.connect(self.db.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT pos_id, evaluation, outcome FROM positions LIMIT 5000
            """)
            positions = cursor.fetchall()
        
        X = np.array([[p['evaluation']] for p in positions])
        y = np.array([p['outcome'] for p in positions])
        
        return X, y
    
    def tune_weights(self) -> Dict[str, float]:
        """
        Fit a linear model to map position evaluation to outcome
        Returns tuned weight coefficients
        """
        print("Extracting features from training data...")
        X, y = self.extract_features()
        
        if len(X) < 10:
            print("Not enough data for tuning (need 10+)")
            return {}
        
        print(f"Training on {len(X)} positions...")
        model = LinearRegression()
        model.fit(X, y)
        
        print(f"\nTuned Weights:")
        print(f"  Evaluation coefficient: {model.coef_[0]:.4f}")
        print(f"  Intercept: {model.intercept_:.4f}")
        print(f"  Model score (R^2): {model.score(X, y):.3f}")
        
        return {
            'evaluation_weight': float(model.coef_[0]),
            'intercept': float(model.intercept_)
        }
    
    def compute_elo_from_outcomes(self, k_factor: int = 32) -> List[float]:
        """Compute Elo rating progression from game outcomes"""
        with sqlite3.connect(self.db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT game_id, winner FROM games ORDER BY game_id
            """)
            games = cursor.fetchall()
        
        elo = 1600.0
        elos = [elo]
        
        for game_id, winner in games:
            # Simple Elo: +32 for win, +0 for loss (vs equal opponent)
            if winner == 'white':
                elo += k_factor * 0.5  # Win
            else:
                elo -= k_factor * 0.5  # Loss
            elos.append(elo)
        
        return elos
    
    def print_summary(self):
        """Print training summary"""
        stats = self.db.get_stats()
        elos = self.compute_elo_from_outcomes()
        win_rates = self.get_win_rate_over_time(window=50)
        
        print("\n" + "=" * 70)
        print("TRAINING SUMMARY")
        print("=" * 70)
        
        print(f"\nTotal games: {stats['games_played']}")
        print(f"  White wins: {stats['white_wins']} ({stats['white_win_rate']*100:.1f}%)")
        print(f"  Black wins: {stats['black_wins']}")
        print(f"  Draws: {stats['draws']}")
        print(f"  Avg game length: {stats['avg_game_length']:.1f} moves")
        
        if elos:
            print(f"\nElo Rating:")
            print(f"  Start: {elos[0]:.0f}")
            print(f"  Current: {elos[-1]:.0f}")
            print(f"  Change: {elos[-1] - elos[0]:+.0f}")
        
        if win_rates:
            print(f"\nRecent win rate (50-game window):")
            for games, rate in win_rates[-3:]:
                print(f"  Game {games}: {rate*100:.1f}%")
        
        print("\n" + "=" * 70)
    
    def export_training_data(self, output_file: str = "training_data.json"):
        """Export training data for external analysis"""
        import json
        
        stats = self.db.get_stats()
        elos = self.compute_elo_from_outcomes()
        win_rates = self.get_win_rate_over_time(window=50)
        
        data = {
            'summary': stats,
            'elo_progression': elos[-100:],  # Last 100
            'win_rates': [{'games': g, 'rate': r} for g, r in win_rates[-20:]]
        }
        
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"Exported to {output_file}")


if __name__ == "__main__":
    analyzer = TrainingAnalyzer()
    analyzer.print_summary()
    
    # Try to tune weights if we have data
    print("\nAttempting weight tuning...")
    weights = analyzer.tune_weights()
    
    # Export data
    analyzer.export_training_data()
