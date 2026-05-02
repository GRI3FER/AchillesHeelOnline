#!/usr/bin/env python3
"""
Web-based Chess Game UI - Better visuals with browser interface
Play against bot, watch bot games, track training progress
Requires: Flask (pip install flask)
Run: python bot/web_server.py
Then open: http://localhost:5000
"""

from flask import Flask, render_template_string, request, jsonify
import json
import sqlite3
import random
import threading
import time
from achilles_game import AchillesGame, Color
from fast_mcts_bot import FastMCTSBot

app = Flask(__name__)

# Global game state
game_state = {
    'game': None,
    'bot_white': FastMCTSBot(),
    'bot_black': FastMCTSBot(),
    'move_history': [],
    'status': 'idle',
    'current_color': 'white',
    'game_mode': None,  # 'human_vs_bot' or 'bot_vs_bot'
    'human_color': None,
    'lock': threading.Lock()
}

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Achilles Heel Chess - Interactive</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 10px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 1200px;
            width: 100%;
            padding: 30px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            color: #333;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            color: #667eea;
        }
        
        .header p {
            color: #666;
            font-size: 1.1em;
        }
        
        .content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }
        
        @media (max-width: 900px) {
            .content {
                grid-template-columns: 1fr;
            }
        }
        
        .board-section {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .chess-board {
            display: grid;
            grid-template-columns: repeat(8, 60px);
            gap: 0;
            background: #8B7355;
            border: 3px solid #333;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        .square {
            width: 60px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2em;
            cursor: pointer;
            user-select: none;
            border: 1px solid rgba(0,0,0,0.1);
            position: relative;
        }
        
        .square.light {
            background: #F0D9B5;
        }
        
        .square.dark {
            background: #B58863;
        }
        
        .square.selected {
            background: #BACA44 !important;
            box-shadow: inset 0 0 10px rgba(186, 202, 68, 0.8);
        }
        
        .square.legal-move {
            background: radial-gradient(circle, #BACA44 30%, transparent 30%) !important;
        }
        
        .square:hover {
            opacity: 0.9;
        }
        
        .board-labels {
            display: flex;
            justify-content: space-between;
            width: 480px;
            margin-bottom: 10px;
            font-weight: bold;
            color: #333;
        }
        
        .board-labels-left {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            width: 30px;
            height: 480px;
            margin-right: 10px;
            font-weight: bold;
            color: #333;
            text-align: center;
        }
        
        .side-panel {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .info-box {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        
        .info-box h3 {
            color: #333;
            margin-bottom: 10px;
            font-size: 1.2em;
        }
        
        .info-box p {
            color: #666;
            line-height: 1.6;
            margin: 5px 0;
        }
        
        .info-box .stat {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 8px 0;
            font-size: 1em;
        }
        
        .stat-label {
            color: #666;
            font-weight: 500;
        }
        
        .stat-value {
            color: #667eea;
            font-weight: bold;
            font-size: 1.1em;
        }
        
        .button-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        button {
            flex: 1;
            min-width: 120px;
            padding: 12px 20px;
            border: none;
            border-radius: 5px;
            font-size: 1em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .btn-primary {
            background: #667eea;
            color: white;
        }
        
        .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        .btn-secondary {
            background: #764ba2;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #653a8a;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(118, 75, 162, 0.4);
        }
        
        .btn-success {
            background: #48c774;
            color: white;
        }
        
        .btn-success:hover {
            background: #3aa373;
            transform: translateY(-2px);
        }
        
        .btn-danger {
            background: #f14668;
            color: white;
        }
        
        .btn-danger:hover {
            background: #d43a5a;
            transform: translateY(-2px);
        }
        
        .status-box {
            background: #fff3cd;
            border: 2px solid #ffc107;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
            font-weight: bold;
            color: #856404;
        }
        
        .status-box.thinking {
            background: #d1ecf1;
            border-color: #17a2b8;
            color: #0c5460;
        }
        
        .status-box.win {
            background: #d4edda;
            border-color: #28a745;
            color: #155724;
        }
        
        .status-box.lose {
            background: #f8d7da;
            border-color: #f5c6cb;
            color: #721c24;
        }
        
        .move-history {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #ddd;
        }
        
        .move-item {
            padding: 5px;
            margin: 2px 0;
            background: white;
            border-radius: 3px;
            font-family: monospace;
            color: #333;
        }
        
        .move-number {
            color: #667eea;
            font-weight: bold;
        }
        
        .training-stats {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
        }
        
        .training-stats h3 {
            margin-bottom: 15px;
            font-size: 1.3em;
        }
        
        .progress-bar {
            background: rgba(255,255,255,0.3);
            height: 30px;
            border-radius: 5px;
            margin: 10px 0;
            overflow: hidden;
        }
        
        .progress-fill {
            background: #48c774;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 0.9em;
            transition: width 0.3s ease;
        }
        
        .piece-legend {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin: 15px 0;
            font-size: 0.95em;
        }
        
        .legend-item {
            padding: 8px;
            background: white;
            border-radius: 3px;
            border-left: 4px solid #667eea;
        }
        
        .mcts-stats {
            background: #f0f4ff;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
            font-size: 0.9em;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>♔ Achilles Heel Chess ♚</h1>
            <p>Interactive Game Interface</p>
        </div>
        
        <div class="content">
            <div class="board-section">
                <div style="display: flex;">
                    <div class="board-labels-left" id="rowLabels">
                        <div>8</div><div>7</div><div>6</div><div>5</div><div>4</div><div>3</div><div>2</div><div>1</div>
                    </div>
                    <div class="chess-board" id="board"></div>
                </div>
                <div class="board-labels">
                    <span>A B C D E F G H</span>
                </div>
                
                <div class="status-box" id="statusBox">
                    Loading game...
                </div>
                
                <div id="mctsStats" class="mcts-stats" style="display: none;"></div>
                
                <div class="button-group">
                    <button class="btn-primary" onclick="startHumanVsBot('white')">Play as White</button>
                    <button class="btn-primary" onclick="startHumanVsBot('black')">Play as Black</button>
                    <button class="btn-secondary" onclick="startBotVsBot()">Bot vs Bot</button>
                    <button class="btn-danger" onclick="resetGame()">New Game</button>
                </div>
            </div>
            
            <div class="side-panel">
                <div class="info-box">
                    <h3>Game Status</h3>
                    <div class="stat">
                        <span class="stat-label">White Pieces:</span>
                        <span class="stat-value" id="whitePieces">16</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Black Pieces:</span>
                        <span class="stat-value" id="blackPieces">16</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Move Count:</span>
                        <span class="stat-value" id="moveCount">0</span>
                    </div>
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                        <p><strong>White Achilles:</strong> <span id="whiteAchilles">Not set</span></p>
                        <p><strong>Black Achilles:</strong> <span id="blackAchilles">Not set</span></p>
                    </div>
                </div>
                
                <div class="info-box">
                    <h3>Recent Moves</h3>
                    <div class="move-history" id="moveHistory">
                        <div style="color: #999; text-align: center;">No moves yet</div>
                    </div>
                </div>
                
                <div class="info-box training-stats" id="trainingStats">
                    <h3>📊 Training Progress</h3>
                    <div class="stat" style="color: white;">
                        <span>Games Played:</span>
                        <span id="totalGames">0</span>
                    </div>
                    <div class="stat" style="color: white;">
                        <span>Win Rate (vs Random):</span>
                        <span id="winRate">N/A</span>
                    </div>
                    <div id="progressContainer" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill" style="width: 0%">0%</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        const PIECE_SYMBOLS = {
            'pawn': '♙',
            'rook': '♖',
            'knight': '♘',
            'bishop': '♗',
            'queen': '♕',
            'king': '♔'
        };
        
        let selectedSquare = null;
        let legalMoves = [];
        
        // Initialize board on page load
        window.onload = function() {
            renderBoard();
            loadTrainingStats();
            initializeGame();
        };
        
        function renderBoard() {
            const board = document.getElementById('board');
            board.innerHTML = '';
            
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const square = document.createElement('div');
                    const isLight = (row + col) % 2 === 0;
                    square.className = `square ${isLight ? 'light' : 'dark'}`;
                    square.id = `square-${row}-${col}`;
                    square.onclick = () => squareClicked(row, col);
                    board.appendChild(square);
                }
            }
            
            updateBoard();
        }
        
        function updateBoard() {
            fetch('/api/board')
                .then(r => r.json())
                .then(data => {
                    for (let row = 0; row < 8; row++) {
                        for (let col = 0; col < 8; col++) {
                            const square = document.getElementById(`square-${row}-${col}`);
                            const piece = data.board[row][col];
                            
                            if (piece) {
                                let symbol = PIECE_SYMBOLS[piece.type] || '?';
                                if (piece.color === 'white') {
                                    symbol = symbol.toUpperCase();
                                } else {
                                    symbol = symbol.toLowerCase();
                                }
                                
                                if (piece.is_achilles) {
                                    symbol = '★ ' + symbol;
                                }
                                
                                square.innerHTML = symbol;
                            } else {
                                square.innerHTML = '';
                            }
                        }
                    }
                    
                    document.getElementById('whitePieces').textContent = data.white_pieces;
                    document.getElementById('blackPieces').textContent = data.black_pieces;
                    document.getElementById('moveCount').textContent = data.move_count;
                    document.getElementById('whiteAchilles').textContent = data.white_achilles || 'Not set';
                    document.getElementById('blackAchilles').textContent = data.black_achilles || 'Not set';
                    
                    updateStatus(data.status, data.current_color);
                });
        }
        
        function squareClicked(row, col) {
            if (selectedSquare === null) {
                // Select piece
                fetch(`/api/legal-moves/${row}/${col}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data.legal_moves.length > 0) {
                            selectedSquare = [row, col];
                            legalMoves = data.legal_moves;
                            highlightLegalMoves();
                        }
                    });
            } else {
                // Try to move
                const [fromRow, fromCol] = selectedSquare;
                if (legalMoves.some(m => m[0] === row && m[1] === col)) {
                    makeMove(fromRow, fromCol, row, col);
                } else {
                    selectedSquare = null;
                    legalMoves = [];
                    renderBoard();
                }
            }
        }
        
        function highlightLegalMoves() {
            renderBoard();
            const [row, col] = selectedSquare;
            document.getElementById(`square-${row}-${col}`).classList.add('selected');
            
            legalMoves.forEach(([r, c]) => {
                document.getElementById(`square-${r}-${c}`).classList.add('legal-move');
            });
        }
        
        function makeMove(fromRow, fromCol, toRow, toCol) {
            fetch('/api/move', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({from_row: fromRow, from_col: fromCol, to_row: toRow, to_col: toCol})
            })
            .then(r => r.json())
            .then(data => {
                selectedSquare = null;
                legalMoves = [];
                
                if (data.success) {
                    updateBoard();
                    addMoveToHistory(`${String.fromCharCode(65+fromCol)}${8-fromRow}-${String.fromCharCode(65+toCol)}${8-toRow}`);
                    
                    if (data.game_over) {
                        updateStatus(`Game Over! ${data.winner} wins!`, 'none');
                    } else if (data.is_bot_turn) {
                        makeBot Move();
                    }
                } else {
                    alert('Invalid move: ' + data.error);
                    renderBoard();
                }
            });
        }
        
        function makeBotMove() {
            document.getElementById('statusBox').innerHTML = '🤖 Bot thinking...';
            document.getElementById('statusBox').className = 'status-box thinking';
            
            fetch('/api/bot-move', {method: 'POST'})
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        updateBoard();
                        addMoveToHistory(data.move);
                        document.getElementById('mctsStats').innerHTML = `
                            Visits: ${data.stats.visits} | Win%: ${data.stats.win_pct.toFixed(1)}%
                        `;
                        document.getElementById('mctsStats').style.display = 'block';
                    }
                    if (data.game_over) {
                        updateStatus(`Game Over! ${data.winner} wins!`, 'none');
                    }
                });
        }
        
        function startHumanVsBot(humanColor) {
            fetch('/api/new-game', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({mode: 'human_vs_bot', human_color: humanColor})
            })
            .then(r => r.json())
            .then(data => {
                renderBoard();
                document.getElementById('moveHistory').innerHTML = '<div style="color: #999; text-align: center;">Game started!</div>';
                updateStatus('Game started! Your turn.', humanColor);
            });
        }
        
        function startBotVsBot() {
            fetch('/api/new-game', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({mode: 'bot_vs_bot'})
            })
            .then(r => r.json())
            .then(data => {
                renderBoard();
                document.getElementById('moveHistory').innerHTML = '<div style="color: #999; text-align: center;">Bot game in progress...</div>';
                playBotVsBot();
            });
        }
        
        function playBotVsBot() {
            fetch('/api/bot-move', {method: 'POST'})
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        updateBoard();
                        addMoveToHistory(data.move);
                        
                        if (data.game_over) {
                            updateStatus(`${data.winner} wins!`, 'none');
                        } else {
                            setTimeout(playBotVsBot, 500);
                        }
                    }
                });
        }
        
        function resetGame() {
            selectedSquare = null;
            legalMoves = [];
            renderBoard();
            document.getElementById('moveHistory').innerHTML = '<div style="color: #999; text-align: center;">No moves yet</div>';
            updateStatus('Game reset', 'white');
        }
        
        function addMoveToHistory(move) {
            const history = document.getElementById('moveHistory');
            if (history.innerHTML.includes('No moves')) {
                history.innerHTML = '';
            }
            const moveNum = Math.floor((document.getElementById('moveCount').textContent - 1) / 2) + 1;
            const item = document.createElement('div');
            item.className = 'move-item';
            item.innerHTML = `<span class="move-number">${moveNum}.</span> ${move}`;
            history.insertBefore(item, history.firstChild);
        }
        
        function updateStatus(status, color) {
            const box = document.getElementById('statusBox');
            box.textContent = status;
            if (status.includes('Game Over')) {
                box.className = 'status-box win';
            } else if (status.includes('Your turn')) {
                box.className = 'status-box';
            } else {
                box.className = 'status-box';
            }
        }
        
        function loadTrainingStats() {
            fetch('/api/training-stats')
                .then(r => r.json())
                .then(data => {
                    if (data.total_games > 0) {
                        document.getElementById('totalGames').textContent = data.total_games;
                        const winRate = ((data.white_wins / data.total_games) * 100).toFixed(1);
                        document.getElementById('winRate').textContent = winRate + '%';
                        
                        if (data.total_games >= 50) {
                            document.getElementById('progressContainer').style.display = 'block';
                            const progress = Math.min(100, (data.total_games / 500) * 100);
                            document.getElementById('progressFill').style.width = progress + '%';
                            document.getElementById('progressFill').textContent = progress.toFixed(0) + '%';
                        }
                    }
                });
        }
        
        function initializeGame() {
            fetch('/api/new-game', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({mode: 'idle'})
            })
            .then(r => r.json())
            .then(data => {
                updateBoard();
                updateStatus('Select a game mode to start', 'white');
            });
        }
        
        // Auto-refresh board every 500ms during bot games
        setInterval(() => {
            if (document.getElementById('statusBox').textContent.includes('Bot thinking')) {
                updateBoard();
            }
        }, 500);
    </script>
</body>
</html>
'''

def get_board_data():
    """Get current board state as JSON"""
    if game_state['game'] is None:
        return {'board': [[None for _ in range(8)] for _ in range(8)]}
    
    board = [[None for _ in range(8)] for _ in range(8)]
    
    for piece in game_state['game'].pieces:
        board[piece.row][piece.col] = {
            'type': piece.type,
            'color': piece.color,
            'id': piece.id,
            'is_achilles': (
                (piece.row, piece.col) == game_state['game'].achilles or
                (piece.row, piece.col) == game_state['game'].black_achilles
            )
        }
    
    white_pieces = sum(1 for p in game_state['game'].pieces if p.color == 'white')
    black_pieces = sum(1 for p in game_state['game'].pieces if p.color == 'black')
    
    white_ach = f"{game_state['game'].achilles[2].type} at {game_state['game'].achilles}" if game_state['game'].achilles else None
    black_ach = f"{game_state['game'].black_achilles[2].type} at {game_state['game'].black_achilles}" if game_state['game'].black_achilles else None
    
    return {
        'board': board,
        'white_pieces': white_pieces,
        'black_pieces': black_pieces,
        'move_count': len(game_state['move_history']),
        'white_achilles': white_ach,
        'black_achilles': black_ach,
        'status': game_state['status'],
        'current_color': game_state['current_color']
    }

def get_legal_moves(row, col):
    """Get legal moves from a position"""
    if game_state['game'] is None:
        return []
    
    try:
        moves = game_state['game'].get_legal_moves((row, col))
        return moves
    except:
        return []

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/board')
def api_board():
    return jsonify(get_board_data())

@app.route('/api/legal-moves/<int:row>/<int:col>')
def api_legal_moves(row, col):
    moves = get_legal_moves(row, col)
    return jsonify({'legal_moves': moves})

@app.route('/api/move', methods=['POST'])
def api_move():
    data = request.json
    from_row, from_col = data['from_row'], data['from_col']
    to_row, to_col = data['to_row'], data['to_col']
    
    try:
        game_state['game'].apply_move((from_row, from_col), (to_row, to_col))
        game_state['move_history'].append(((from_row, from_col), (to_row, to_col)))
        game_state['current_color'] = 'black' if game_state['current_color'] == 'white' else 'white'
        
        # Check if game over
        game_over = False
        winner = None
        
        return jsonify({
            'success': True,
            'game_over': game_over,
            'winner': winner,
            'is_bot_turn': game_state['game_mode'] == 'human_vs_bot' and game_state['current_color'] != game_state['human_color']
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/bot-move', methods=['POST'])
def api_bot_move():
    if game_state['game'] is None:
        return jsonify({'success': False, 'error': 'No game in progress'})
    
    try:
        bot = game_state['bot_white'] if game_state['current_color'] == 'white' else game_state['bot_black']
        result = bot.get_best_move(game_state['game'], 30, game_state['current_color'])
        
        if result is None:
            return jsonify({
                'success': False,
                'game_over': True,
                'winner': 'black' if game_state['current_color'] == 'white' else 'white'
            })
        
        move, stats = result
        game_state['game'].apply_move(move[0], move[1])
        game_state['move_history'].append((move[0], move[1]))
        game_state['current_color'] = 'black' if game_state['current_color'] == 'white' else 'white'
        
        move_str = f"{chr(ord('a')+move[0][1])}{8-move[0][0]}-{chr(ord('a')+move[1][1])}{8-move[1][0]}"
        
        return jsonify({
            'success': True,
            'move': move_str,
            'stats': stats,
            'game_over': False
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/new-game', methods=['POST'])
def api_new_game():
    data = request.json
    mode = data.get('mode', 'idle')
    
    game_state['game'] = AchillesGame()
    game_state['move_history'] = []
    game_state['current_color'] = 'white'
    game_state['game_mode'] = mode
    game_state['human_color'] = data.get('human_color', 'white')
    
    # Set random Achilles
    game_state['game'].set_achilles('white', random.randint(0, 7), random.randint(0, 7))
    game_state['game'].set_achilles('black', random.randint(0, 7), random.randint(0, 7))
    
    game_state['status'] = f'Game started: {mode}'
    
    return jsonify({'success': True, 'message': 'Game initialized'})

@app.route('/api/training-stats')
def api_training_stats():
    try:
        db = sqlite3.connect('training.db')
        cursor = db.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM games")
        total = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM games WHERE winner='white'")
        white_wins = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM games WHERE winner='black'")
        black_wins = cursor.fetchone()[0]
        
        db.close()
        
        return jsonify({
            'total_games': total,
            'white_wins': white_wins,
            'black_wins': black_wins
        })
    except:
        return jsonify({'total_games': 0, 'white_wins': 0, 'black_wins': 0})

if __name__ == '__main__':
    print("\n" + "="*60)
    print("Achilles Heel Chess - Web Interface".center(60))
    print("="*60)
    print("\nOpening at http://localhost:5000")
    print("Press Ctrl+C to stop\n")
    
    try:
        app.run(debug=False, port=5000, use_reloader=False)
    except KeyboardInterrupt:
        print("\nShutting down...")
