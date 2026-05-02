#!/usr/bin/env python3
"""
Interactive Chess Game UI - Play against the bot or watch bot games
Supports Human vs Bot, Bot vs Bot, and training progress tracking
"""

import os
import sys
import time
import json
from datetime import datetime
from achilles_game import AchillesGame, Color
from fast_mcts_bot import FastMCTSBot
from random_bot import RandomBot
import sqlite3

# Color codes for terminal
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

# Piece symbols
PIECE_SYMBOLS = {
    'pawn': '♙',
    'rook': '♖',
    'knight': '♘',
    'bishop': '♗',
    'queen': '♕',
    'king': '♔'
}

# ASCII fallback (for Windows)
PIECE_SYMBOLS_ASCII = {
    'pawn': 'P',
    'rook': 'R',
    'knight': 'N',
    'bishop': 'B',
    'queen': 'Q',
    'king': 'K'
}

class InteractiveGame:
    def __init__(self, use_unicode=False):
        self.game = None
        self.bot_white = None
        self.bot_black = None
        self.use_unicode = use_unicode
        self.pieces = PIECE_SYMBOLS if use_unicode else PIECE_SYMBOLS_ASCII
        self.move_history = []
        
    def clear_screen(self):
        """Clear terminal screen"""
        os.system('cls' if os.name == 'nt' else 'clear')
    
    def print_header(self, title):
        """Print formatted header"""
        print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}{title:^60}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}\n")
    
    def get_piece_display(self, piece, achilles_pos_white, achilles_pos_black):
        """Get display character for a piece"""
        if piece is None:
            return ' '
        
        # Convert PieceType enum to string
        piece_type_str = piece.type.value.lower()
        symbol = self.pieces.get(piece_type_str, '?')
        
        # Check if this is the Achilles piece
        if piece.color == Color.WHITE:
            if achilles_pos_white and (piece.row, piece.col) == (achilles_pos_white.row, achilles_pos_white.col):
                return f"{Colors.RED}{symbol}{Colors.END}"
        else:
            if achilles_pos_black and (piece.row, piece.col) == (achilles_pos_black.row, achilles_pos_black.col):
                return f"{Colors.RED}{symbol}{Colors.END}"
        
        # Color based on piece color
        if piece.color == Color.WHITE:
            return f"{Colors.YELLOW}{symbol}{Colors.END}"
        else:
            return f"{Colors.BLUE}{symbol}{Colors.END}"
    
    def display_board(self, perspective='white'):
        """Display the board in terminal"""
        print(f"\n{Colors.BOLD}    A B C D E F G H{Colors.END}")
        print(f"{Colors.BOLD}  ┌─────────────────┐{Colors.END}")
        
        # Get Achilles positions
        achilles_white = self.game.achilles[Color.WHITE] if self.game.achilles.get(Color.WHITE) else None
        achilles_black = self.game.achilles[Color.BLACK] if self.game.achilles.get(Color.BLACK) else None
        
        for row in range(8):
            display_row = row if perspective == 'white' else 7 - row
            print(f"{Colors.BOLD}{display_row+1} │", end='')
            
            for col in range(8):
                display_col = col if perspective == 'white' else 7 - col
                
                # Get piece at position from board
                piece = self.game.board[display_row][display_col] if self.game.board else None
                
                # Background color for squares
                is_light = (display_row + display_col) % 2 == 0
                bg = '\033[47m' if is_light else '\033[40m'  # Light/dark square
                
                piece_char = self.get_piece_display(piece, achilles_white, achilles_black)
                print(f"{bg} {piece_char} {Colors.END}", end='')
            
            print(f"{Colors.BOLD}│ {display_row+1}{Colors.END}")
        
        print(f"{Colors.BOLD}  └─────────────────┘{Colors.END}")
        print(f"{Colors.BOLD}    A B C D E F G H{Colors.END}\n")
    
    def show_game_info(self):
        """Show current game information"""
        # Count pieces
        white_pieces = sum(1 for row in self.game.board for piece in row if piece and piece.color == Color.WHITE)
        black_pieces = sum(1 for row in self.game.board for piece in row if piece and piece.color == Color.BLACK)
        
        print(f"{Colors.CYAN}White Pieces: {white_pieces}  |  Black Pieces: {black_pieces}{Colors.END}")
        
        if self.game.achilles.get(Color.WHITE):
            ach = self.game.achilles[Color.WHITE]
            print(f"{Colors.YELLOW}White Achilles: {ach.type.value} at ({ach.row},{ach.col}){Colors.END}")
        if self.game.achilles.get(Color.BLACK):
            ach = self.game.achilles[Color.BLACK]
            print(f"{Colors.BLUE}Black Achilles: {ach.type.value} at ({ach.row},{ach.col}){Colors.END}")
        
        print(f"{Colors.GREEN}Moves: {len(self.move_history)}{Colors.END}\n")
    
    def parse_move_input(self, move_str):
        """Parse user move input (e.g., 'a2-a4')"""
        try:
            move_str = move_str.strip().lower()
            parts = move_str.split('-')
            if len(parts) != 2:
                print(f"{Colors.RED}Invalid format. Use: a2-a4{Colors.END}")
                return None
            
            from_pos = parts[0]
            to_pos = parts[1]
            
            if len(from_pos) != 2 or len(to_pos) != 2:
                print(f"{Colors.RED}Invalid positions. Use: a2-a4{Colors.END}")
                return None
            
            from_col = ord(from_pos[0]) - ord('a')
            from_row = int(from_pos[1]) - 1
            to_col = ord(to_pos[0]) - ord('a')
            to_row = int(to_pos[1]) - 1
            
            if not (0 <= from_row < 8 and 0 <= from_col < 8 and
                    0 <= to_row < 8 and 0 <= to_col < 8):
                print(f"{Colors.RED}Positions out of bounds (a1-h8){Colors.END}")
                return None
            
            return ((from_row, from_col), (to_row, to_col))
        except Exception as e:
            print(f"{Colors.RED}Error parsing move: {e}{Colors.END}")
            return None
    
    def get_human_move(self, color):
        """Get move from human player"""
        while True:
            legal_moves = []
            
            # Find all legal moves for this color
            for piece in self.game.pieces:
                if piece.color == color:
                    moves = self.game.get_legal_moves((piece.row, piece.col))
                    for move in moves:
                        legal_moves.append(((piece.row, piece.col), move))
            
            if not legal_moves:
                print(f"{Colors.RED}No legal moves! {color.upper()} loses!{Colors.END}")
                return None
            
            move_input = input(f"{Colors.BOLD}{color.upper()}'s move (e.g., a2-a4, q=quit): {Colors.END}")
            
            if move_input.lower() == 'q':
                return 'quit'
            
            move = self.parse_move_input(move_input)
            if move is None:
                continue
            
            # Check if move is legal
            if move in legal_moves:
                return move
            else:
                print(f"{Colors.RED}Illegal move! Try again.{Colors.END}")
                # Show legal moves from this piece
                if move[0] in [(m[0][0], m[0][1]) for m in legal_moves]:
                    valid_destinations = [m[1] for m in legal_moves if m[0] == move[0]]
                    print(f"Legal moves from {move[0]}: {valid_destinations}")
    
    def get_bot_move(self, bot, color, iterations=30):
        """Get move from bot"""
        legal_moves = []
        for piece in self.game.pieces:
            if piece.color == color:
                moves = self.game.get_legal_moves((piece.row, piece.col))
                for move in moves:
                    legal_moves.append(((piece.row, piece.col), move))
        
        if not legal_moves:
            return None
        
        move, stats = bot.get_best_move(self.game, iterations, color)
        return move, stats
    
    def play_move(self, from_pos, to_pos):
        """Apply move to game"""
        try:
            self.game.apply_move(from_pos, to_pos)
            self.move_history.append((from_pos, to_pos))
            return True
        except Exception as e:
            print(f"{Colors.RED}Error applying move: {e}{Colors.END}")
            return False
    
    def show_move_stats(self, stats):
        """Display MCTS statistics"""
        if stats:
            print(f"{Colors.CYAN}Move: {stats.get('move')} | Visits: {stats.get('visits', 0)} | Win%: {stats.get('win_pct', 0):.1f}%{Colors.END}")
    
    def play_human_vs_bot(self, human_color='white', bot_iterations=30):
        """Play game with human vs bot"""
        self.print_header(f"Human vs Bot - You are {human_color.upper()}")
        
        self.game = AchillesGame()
        self.bot_white = FastMCTSBot()
        self.bot_black = FastMCTSBot()
        
        # Set random Achilles positions
        import random
        achilles_pieces = random.choice(['pawn', 'rook', 'knight', 'bishop', 'queen'])
        self.game.set_achilles(Color.WHITE, random.randint(0, 7), random.randint(0, 7))
        self.game.set_achilles(Color.BLACK, random.randint(0, 7), random.randint(0, 7))
        
        move_count = 0
        current_color = 'white'
        
        while True:
            self.clear_screen()
            self.print_header(f"Human vs Bot - Move {move_count + 1}")
            self.display_board(perspective=human_color)
            self.show_game_info()
            
            # Check if game is over
            white_achilles_captured = not any(
                p.color == 'white' and p.row == self.game.achilles[0] and p.col == self.game.achilles[1]
                for p in self.game.pieces
            ) if self.game.achilles else False
            
            black_achilles_captured = not any(
                p.color == 'black' and p.row == self.game.black_achilles[0] and p.col == self.game.black_achilles[1]
                for p in self.game.pieces
            ) if self.game.black_achilles else False
            
            if white_achilles_captured:
                self.print_header(f"{Colors.BLUE}BLACK WINS!{Colors.END}")
                return 'black'
            
            if black_achilles_captured:
                self.print_header(f"{Colors.YELLOW}WHITE WINS!{Colors.END}")
                return 'white'
            
            # Get move
            if current_color == human_color:
                print(f"{Colors.YELLOW}YOUR TURN{Colors.END}")
                move = self.get_human_move(current_color)
                if move == 'quit':
                    return None
            else:
                print(f"{Colors.CYAN}Bot thinking...{Colors.END}", end='', flush=True)
                bot = self.bot_white if current_color == 'white' else self.bot_black
                result = self.get_bot_move(bot, current_color, bot_iterations)
                
                if result is None:
                    print(f"{Colors.RED}Bot has no moves!{Colors.END}")
                    return 'white' if current_color == 'black' else 'black'
                
                move, stats = result
                print(f"\r{Colors.CYAN}Bot played: {self._move_to_str(move)} | Visits: {stats['visits']} | Win%: {stats['win_pct']:.1f}%{Colors.END}")
                time.sleep(1)
            
            # Apply move
            self.play_move(move[0], move[1])
            move_count += 1
            current_color = 'black' if current_color == 'white' else 'white'
    
    def play_bot_vs_bot(self, iterations_white=30, iterations_black=30, pause_per_move=1):
        """Watch two bots play each other"""
        self.print_header("Bot vs Bot - Spectator Mode")
        
        self.game = AchillesGame()
        self.bot_white = FastMCTSBot()
        self.bot_black = FastMCTSBot()
        
        # Set random Achilles positions
        import random
        self.game.set_achilles(Color.WHITE, random.randint(0, 7), random.randint(0, 7))
        self.game.set_achilles(Color.BLACK, random.randint(0, 7), random.randint(0, 7))
        
        move_count = 0
        current_color = 'white'
        
        print(f"White Achilles: {self.game.achilles.type} at ({self.game.achilles.row},{self.game.achilles.col})")
        print(f"Black Achilles: {self.game.black_achilles.type} at ({self.game.black_achilles.row},{self.game.black_achilles.col})")
        print(f"\nPress ENTER to start...")
        input()
        
        while True:
            self.clear_screen()
            self.print_header(f"Bot vs Bot - Move {move_count + 1}")
            self.display_board()
            self.show_game_info()
            
            # Check if game is over
            white_achilles_captured = not any(
                p.color == 'white' and p.row == self.game.achilles[0] and p.col == self.game.achilles[1]
                for p in self.game.pieces
            ) if self.game.achilles else False
            
            black_achilles_captured = not any(
                p.color == 'black' and p.row == self.game.black_achilles[0] and p.col == self.game.black_achilles[1]
                for p in self.game.pieces
            ) if self.game.black_achilles else False
            
            if white_achilles_captured:
                print(f"{Colors.BLUE}{Colors.BOLD}BLACK WINS!{Colors.END}")
                return 'black', move_count
            
            if black_achilles_captured:
                print(f"{Colors.YELLOW}{Colors.BOLD}WHITE WINS!{Colors.END}")
                return 'white', move_count
            
            # Get bot move
            iterations = iterations_white if current_color == 'white' else iterations_black
            print(f"{Colors.CYAN}{current_color.upper()} thinking ({iterations} iterations)...{Colors.END}", end='', flush=True)
            
            bot = self.bot_white if current_color == 'white' else self.bot_black
            result = self.get_bot_move(bot, current_color, iterations)
            
            if result is None:
                print(f"\n{Colors.RED}{current_color.upper()} has no moves!{Colors.END}")
                return 'white' if current_color == 'black' else 'black', move_count
            
            move, stats = result
            self.play_move(move[0], move[1])
            
            print(f"\r{Colors.BOLD}{current_color.upper()} played: {self._move_to_str(move):12} | Visits: {stats['visits']:3} | Win%: {stats['win_pct']:5.1f}%{Colors.END}")
            
            move_count += 1
            current_color = 'black' if current_color == 'white' else 'white'
            
            time.sleep(pause_per_move)
    
    def _move_to_str(self, move):
        """Convert move tuple to string"""
        from_row, from_col = move[0]
        to_row, to_col = move[1]
        from_str = chr(ord('a') + from_col) + str(from_row + 1)
        to_str = chr(ord('a') + to_col) + str(to_row + 1)
        return f"{from_str}-{to_str}"
    
    def play_human_vs_human(self):
        """Play game with two human players - great for stress testing"""
        self.print_header("Human vs Human - Stress Test Mode")
        
        self.game = AchillesGame()
        
        # Each player sets their own Achilles
        print(f"{Colors.CYAN}WHITE PLAYER:{Colors.END}")
        print("Choose your secret Achilles piece (non-pawn):")
        print("0=Rook, 1=Knight, 2=Bishop, 3=Queen, 4=King (will show as Queen)")
        white_col = self._get_valid_input("Enter column (0-7): ", 0, 7)
        white_row = self._get_valid_input("Enter row (0-7): ", 0, 7)
        self.game.set_achilles(Color.WHITE, white_row, white_col)
        
        print(f"\n{Colors.BLUE}BLACK PLAYER:{Colors.END}")
        print("Choose your secret Achilles piece (non-pawn):")
        print("0=Rook, 1=Knight, 2=Bishop, 3=Queen, 4=King (will show as Queen)")
        black_col = self._get_valid_input("Enter column (0-7): ", 0, 7)
        black_row = self._get_valid_input("Enter row (0-7): ", 0, 7)
        self.game.set_achilles(Color.BLACK, black_row, black_col)
        
        move_count = 0
        current_player = 'white'
        
        while True:
            self.clear_screen()
            self.print_header(f"Human vs Human - Move {move_count + 1}")
            self.display_board()
            
            # Get legal moves for reference (may have bugs, so not used for validation)
            try:
                legal_moves = self.game.get_legal_moves(Color.WHITE if current_player == 'white' else Color.BLACK)
            except:
                legal_moves = []
            
            # Display whose turn it is
            print(f"\n{Colors.BOLD}{current_player.upper()}'S TURN{Colors.END}")
            print(f"Legal moves available: {len(legal_moves)}")
            
            # Note: Actual legality checked by game engine on move attempt
            
            # Get move from human player
            while True:
                move_str = input(f"{Colors.CYAN}Enter move (e.g. a2-a4) or 'q' to quit: {Colors.END}").strip().lower()
                
                if move_str == 'q':
                    print(f"\n{Colors.YELLOW}Game ended by player{Colors.END}")
                    return
                
                move = self._parse_move_str(move_str)
                if move is None:
                    print(f"{Colors.RED}Invalid format! Use a2-a4{Colors.END}")
                    continue
                
                # Try to apply the move - let game engine validate
                try:
                    self.game.apply_move(move[0], move[1])
                    print(f"{Colors.GREEN}✓ {current_player.upper()} played: {self._move_to_str(move)}{Colors.END}")
                    break
                except Exception as e:
                    print(f"{Colors.RED}Illegal move: {str(e)}{Colors.END}")
                    # Show some example legal moves
                    examples = legal_moves[:3] if legal_moves else []
                    if examples:
                        print(f"Examples: {', '.join([self._move_to_str(m) for m in examples])}")
                    continue
            
            # Check winner
            if self.game.winner:
                self.clear_screen()
                self.print_header("Game Over!")
                self.display_board()
                print(f"\n{Colors.GREEN}{self.game.winner.value.upper()} WINS!{Colors.END}")
                break
            
            move_count += 1
            current_player = 'black' if current_player == 'white' else 'white'
            input(f"{Colors.CYAN}Press ENTER to continue...{Colors.END}")
    
    def _get_valid_input(self, prompt, min_val, max_val):
        """Get valid integer input from user"""
        while True:
            try:
                val = int(input(prompt))
                if min_val <= val <= max_val:
                    return val
                print(f"{Colors.RED}Please enter a number between {min_val} and {max_val}{Colors.END}")
            except ValueError:
                print(f"{Colors.RED}Please enter a valid number{Colors.END}")
    
    def _parse_move_str(self, move_str):
        """Parse move string like 'a2-a4' into ((from_row, from_col), (to_row, to_col))"""
        try:
            if '-' not in move_str or len(move_str) != 5:
                return None
            from_pos, to_pos = move_str.split('-')
            if len(from_pos) != 2 or len(to_pos) != 2:
                return None
            
            from_col = ord(from_pos[0]) - ord('a')
            from_row = int(from_pos[1]) - 1
            to_col = ord(to_pos[0]) - ord('a')
            to_row = int(to_pos[1]) - 1
            
            if not (0 <= from_row <= 7 and 0 <= from_col <= 7 and 0 <= to_row <= 7 and 0 <= to_col <= 7):
                return None
            
            return ((from_row, from_col), (to_row, to_col))
        except (ValueError, IndexError):
            return None
    
    def show_training_stats(self):
        """Show training progress from database"""
        try:
            db = sqlite3.connect('training.db')
            cursor = db.cursor()
            
            # Get stats
            cursor.execute("SELECT COUNT(*) FROM games")
            total_games = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM games WHERE winner='white'")
            white_wins = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM games WHERE winner='black'")
            black_wins = cursor.fetchone()[0]
            
            cursor.execute("SELECT AVG(move_count) FROM games")
            avg_moves = cursor.fetchone()[0] or 0
            
            self.print_header("Training Progress")
            print(f"{Colors.CYAN}Total Games Played: {total_games}{Colors.END}")
            print(f"{Colors.YELLOW}White Wins: {white_wins} ({white_wins/total_games*100:.1f}%){Colors.END}")
            print(f"{Colors.BLUE}Black Wins: {black_wins} ({black_wins/total_games*100:.1f}%){Colors.END}")
            print(f"{Colors.GREEN}Average Game Length: {avg_moves:.1f} moves{Colors.END}")
            
            db.close()
        except Exception as e:
            print(f"{Colors.RED}Could not load training stats: {e}{Colors.END}")
    
    def main_menu(self):
        """Main menu"""
        while True:
            self.clear_screen()
            self.print_header("Achilles Heel Chess - Interactive Mode")
            
            print(f"{Colors.BOLD}1. Play vs Bot (You are White){Colors.END}")
            print(f"{Colors.BOLD}2. Play vs Bot (You are Black){Colors.END}")
            print(f"{Colors.BOLD}3. Human vs Human - Stress Test{Colors.END}")
            print(f"{Colors.BOLD}4. Watch Bot vs Bot{Colors.END}")
            print(f"{Colors.BOLD}5. Show Training Progress{Colors.END}")
            print(f"{Colors.BOLD}6. Exit{Colors.END}\n")
            
            choice = input(f"{Colors.CYAN}Select option (1-6): {Colors.END}").strip()
            
            if choice == '1':
                self.play_human_vs_bot('white', bot_iterations=30)
            elif choice == '2':
                self.play_human_vs_bot('black', bot_iterations=30)
            elif choice == '3':
                self.play_human_vs_human()
                input(f"\n{Colors.CYAN}Press ENTER to continue...{Colors.END}")
            elif choice == '4':
                winner, moves = self.play_bot_vs_bot(30, 30)
                print(f"\n{winner.upper()} won in {moves} moves!")
                input("Press ENTER to continue...")
            elif choice == '5':
                self.show_training_stats()
                input(f"\n{Colors.CYAN}Press ENTER to continue...{Colors.END}")
            elif choice == '6':
                print(f"\n{Colors.GREEN}Goodbye!{Colors.END}\n")
                break
            else:
                print(f"{Colors.RED}Invalid choice!{Colors.END}")
                time.sleep(1)


def main():
    """Entry point"""
    print(f"{Colors.CYAN}Detecting terminal capabilities...{Colors.END}")
    
    # Try to use unicode on supported terminals
    use_unicode = True
    try:
        # Test unicode support
        print("Testing: ♔")
    except:
        use_unicode = False
    
    game = InteractiveGame(use_unicode=use_unicode)
    game.main_menu()


if __name__ == '__main__':
    main()
