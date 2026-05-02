"""
Training Infrastructure for Achilles Heel MCTS Bot
Handles game recording, Elo tracking, and experiment management
"""

import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from pathlib import Path


class TrainingDatabase:
    """SQLite database for training data"""
    
    def __init__(self, db_path: str = "training.db"):
        self.db_path = db_path
        self.init_db()
    
    def init_db(self):
        """Initialize database schema"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS games (
                    game_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    white_achilles TEXT,
                    black_achilles TEXT,
                    winner TEXT,
                    move_count INTEGER,
                    game_data JSON,
                    bot_version TEXT
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS positions (
                    pos_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id INTEGER,
                    move_number INTEGER,
                    fen TEXT,
                    color TEXT,
                    legal_moves_count INTEGER,
                    outcome REAL,
                    move_played TEXT,
                    evaluation REAL,
                    FOREIGN KEY(game_id) REFERENCES games(game_id)
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS stats (
                    stat_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    games_played INTEGER,
                    white_wins INTEGER,
                    black_wins INTEGER,
                    draws INTEGER,
                    avg_game_length REAL,
                    elo_rating REAL,
                    bot_version TEXT
                )
            """)
            
            conn.commit()
    
    def record_game(self, game_data: Dict, bot_version: str = "v1") -> int:
        """Record a completed game"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            winner = game_data.get('winner')
            white_ach = game_data.get('white_achilles')
            black_ach = game_data.get('black_achilles')
            
            cursor.execute("""
                INSERT INTO games (white_achilles, black_achilles, winner, move_count, game_data, bot_version)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (white_ach, black_ach, winner, len(game_data.get('moves', [])), 
                  json.dumps(game_data), bot_version))
            
            game_id = cursor.lastrowid
            
            # Record each position
            for move_num, move_data in enumerate(game_data.get('moves', [])):
                color = 'white' if move_num % 2 == 0 else 'black'
                
                # Outcome: 1 if this side won, 0 otherwise, -1 if lost, 0.5 if draw
                if winner is None:
                    outcome = 0.5
                elif winner == 'white':
                    outcome = 1.0 if color == 'white' else 0.0
                else:
                    outcome = 1.0 if color == 'black' else 0.0
                
                cursor.execute("""
                    INSERT INTO positions (game_id, move_number, fen, color, legal_moves_count, outcome, move_played, evaluation)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (game_id, move_num, move_data.get('fen'), color, 
                      move_data.get('legal_moves'), outcome, move_data.get('move'), 
                      move_data.get('evaluation')))
            
            conn.commit()
            return game_id
    
    def record_stats(self, stats: Dict, bot_version: str = "v1"):
        """Record training statistics"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO stats (games_played, white_wins, black_wins, draws, avg_game_length, elo_rating, bot_version)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (stats['games_played'], stats['white_wins'], stats['black_wins'],
                  stats['draws'], stats['avg_game_length'], stats['elo_rating'], bot_version))
            conn.commit()
    
    def get_game_count(self) -> int:
        """Get total games played"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM games")
            return cursor.fetchone()[0]
    
    def get_stats(self) -> Dict:
        """Get current training statistics"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM games")
            total_games = cursor.fetchone()[0]
            
            cursor.execute("SELECT winner, COUNT(*) FROM games GROUP BY winner")
            results = dict(cursor.fetchall())
            
            cursor.execute("SELECT AVG(move_count) FROM games")
            avg_length = cursor.fetchone()[0] or 0
            
            return {
                'games_played': total_games,
                'white_wins': results.get('white', 0),
                'black_wins': results.get('black', 0),
                'draws': results.get(None, 0),
                'avg_game_length': avg_length,
                'white_win_rate': results.get('white', 0) / max(1, total_games)
            }
    
    def get_last_n_games(self, n: int) -> List[Dict]:
        """Get last N games"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM games ORDER BY game_id DESC LIMIT ?
            """, (n,))
            return [dict(row) for row in cursor.fetchall()]


class EloRating:
    """Simple Elo rating system for bot versions"""
    
    def __init__(self, initial_rating: float = 1600):
        self.rating = initial_rating
        self.k_factor = 32  # Standard in chess
    
    def update(self, outcome: float, opponent_rating: float = 1600) -> float:
        """Update Elo rating based on game outcome (1=win, 0.5=draw, 0=loss)"""
        expected = 1.0 / (1.0 + 10 ** ((opponent_rating - self.rating) / 400))
        self.rating = self.rating + self.k_factor * (outcome - expected)
        return self.rating
    
    def get_rating(self) -> float:
        return self.rating


if __name__ == "__main__":
    # Test database
    db = TrainingDatabase()
    
    # Record a test game
    game_data = {
        'white_achilles': 'Queen',
        'black_achilles': 'Bishop',
        'winner': 'white',
        'moves': [
            {'fen': 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', 'legal_moves': 20, 'move': '(6,0)->(4,0)', 'evaluation': 0.0},
            {'fen': 'rnbqkbnr/pppppppp/8/8/P7/8/1PPPPPPP/RNBQKBNR', 'legal_moves': 20, 'move': '(1,0)->(3,0)', 'evaluation': 0.0}
        ]
    }
    
    game_id = db.record_game(game_data)
    print(f"Recorded game: {game_id}")
    
    stats = db.get_stats()
    print(f"Stats: {stats}")
    
    # Test Elo
    elo = EloRating()
    print(f"Initial Elo: {elo.get_rating()}")
    elo.update(1.0)  # Win
    print(f"After win: {elo.get_rating()}")
