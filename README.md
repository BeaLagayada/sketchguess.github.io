# 🎨 SketchGuess — Real-Time Multiplayer Drawing Game

A full-stack real-time web application where players draw and guess words together.

---

## 🚀 Quick Start (VS Code / Terminal)

### Prerequisites
- Node.js v18+ installed

### Setup
```bash
# 1. Go into the project folder
cd sketchguess

# 2. Install dependencies
npm install

# 3. Start the server
npm start
# → Server starts at http://localhost:3000
```

### Playing
1. Open **http://localhost:3000** in multiple browser tabs or share with friends on the same network
2. Enter your name and click **Create New Room** (you become the host)
3. Share the 6-character room code with friends
4. Friends click **Join Room**, enter the code, and join
5. Host clicks **▶ Start Game** once at least 2 players are in
6. Game starts — rotate who draws each round!

---

## ⚙️ System Architecture

```
Client (Browser)
    ↕ WebSocket (Socket.io)
Node.js + Express Server
    └── In-memory room/game state
    └── Concurrent connections: 5–10+ users
```

### Files
```
sketchguess/
├── server.js          ← Backend (Node.js + Socket.io)
├── package.json       ← Dependencies
└── public/
    └── index.html     ← Full frontend (HTML + CSS + JS)
```

---

## ✅ System Requirements Met

| Requirement | Implementation |
|-------------|---------------|
| 5–10 concurrent users | Socket.io handles concurrent WebSocket connections; rooms cap at 10 |
| Create/Join with code | 6-char alphanumeric room codes generated server-side |
| Real-time updates (no refresh) | Socket.io events push all state changes instantly |
| Backend with concurrency | Node.js event loop + Socket.io handles all concurrent requests |
| Persistent shared data | In-memory `rooms` object stores all game state on the server |

---

## 🎮 Game Features

- **Lobby** — Create or join a room with a shareable code
- **Waiting Room** — See all connected players, host starts the game
- **Drawing Phase** — Drawer gets the secret word; others guess via chat
- **Live Canvas** — Strokes broadcast in real-time to all room members
- **Drawing Tools** — 12 colors, 3 brush sizes, eraser, clear canvas
- **Guessing** — Type guesses in chat; correct answers earn points
- **Scoring** — Faster correct guesses = more points; drawer earns bonus points
- **Hints** — At 50% time remaining, letters are progressively revealed
- **Close guesses** — Levenshtein distance detects near-correct guesses
- **Rounds** — 3 rounds × all players rotating as drawer
- **Game Over** — Final leaderboard with medals 🥇🥈🥉
- **Confetti** — Triggers on correct guess and game end!

---

## 🔧 Configuration

Edit `server.js` to adjust:
```js
const ROUND_DURATION = 80;   // seconds per round
const ROUNDS_PER_GAME = 3;   // rounds before game ends
```

Add more words to the `WORDS` array in `server.js`.

---

## 🌐 Multiplayer on a LAN

To let others on your network connect:
1. Find your local IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Share `http://YOUR_LOCAL_IP:3000` with players on the same Wi-Fi
