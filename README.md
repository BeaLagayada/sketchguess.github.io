# 🎨 SketchGuess — Real-Time Multiplayer Drawing & Guessing Game

A full-stack real-time web application built for **CS323 Parallel & Distributed Computing**.  
Players take turns drawing a secret word while others race to guess it in the chat.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+

### Setup

```bash
# 1. Clone the repo and enter the folder
git clone <your-repo-url>
cd sketchguess

# 2. Install dependencies
npm install

# 3. Start the server
npm start
# → http://localhost:3000
```

> **Dev mode** (auto-restarts on file changes):
> ```bash
> npm run dev
> ```

### How to Play
1. Open **http://localhost:3000** in your browser
2. Enter your name, pick an avatar, and click **🎨 Create New Room**
3. Share the 6-character room code with friends
4. Friends enter the code and click **🚪 Join Room**
5. Host clicks **▶ Start Game** (requires at least 2 players)
6. Players rotate as the drawer each round — draw the word, earn points!

---

## 📁 Project Structure

```
sketchguess/
├── package.json
├── .gitignore
│
├── server/
│   ├── index.js          ← Entry point; Socket.io event wiring
│   ├── roomManager.js    ← In-memory Map of all active rooms (shared state)
│   ├── gameState.js      ← Room state model + public state view
│   ├── roundEngine.js    ← Round logic, mutex, synchronization ← CS323 core
│   ├── monitor.js        ← Logs all parallel rooms every 10 seconds
│   └── wordList.js       ← Shared word pool (200 words)
│
└── public/
    ├── index.html        ← Markup only
    ├── style.css         ← All styles (responsive, mobile-friendly)
    └── game.js           ← All client-side logic
```

---

## ⚙️ System Architecture

```
Browsers (multiple clients)
       ↕  WebSocket — Socket.io (async, bidirectional)
┌─────────────────────────────────────┐
│        Node.js + Express Server     │
│                                     │
│  index.js  ←  socket event wiring  │
│      │                              │
│  roomManager.js  ←  shared Map      │
│  roundEngine.js  ←  mutex / lock    │
│  monitor.js      ←  parallel rooms  │
└─────────────────────────────────────┘
```

All clients connect to the same server. No client communicates directly with another — all game state lives on the server and is broadcast via Socket.io events.

---

## 🧵 CS323 — Parallel & Distributed Computing Concepts

This section maps each course requirement to the exact file and mechanism that implements it.

### 1. Multithreading / Concurrency — `server/index.js`
Node.js processes all incoming socket events concurrently via its **non-blocking event loop**. Multiple players sending guess events, draw strokes, and timer ticks simultaneously are all handled without blocking each other.

### 2. Network Communication — `server/index.js` ↔ `public/game.js`
All communication uses **Socket.io WebSockets** (async I/O). Every draw stroke, guess, timer tick, and state update is a message passed between server and clients in real time — no page refreshes.

### 3. Shared State Management — `server/roomManager.js`
All active rooms are stored in a single server-side **`Map`**. Every player in a room reads and writes the same state object — no client has its own copy. This is the central shared data store.

### 4. Synchronization Mechanism (Mutex) — `server/roundEngine.js`

The `state.locked` flag acts as a **mutex** that guards all shared state mutations:

```js
// In handleGuess():
if (room.locked) return;   // reject concurrent events during transitions

room.locked = true;        // acquire lock
player.hasGuessed = true;
player.score += 100 + bonus;
room.locked = false;       // release lock
```

```js
// In resolveRoundEnd():
room.locked = true;        // lock held across entire round transition
room.state = 'between';
// ... set up next round ...
// lock released inside startRound() when ready
```

### 5. Race Condition Prevention — `server/roundEngine.js`

Two players may send the correct guess within milliseconds of each other. The lock + `player.hasGuessed` flag together ensure only the first submission is accepted:

- **Lock** → prevents processing during round transitions
- **`hasGuessed` flag** → prevents a single player from scoring twice even if they spam the event

### 6. Parallel Rooms — `server/monitor.js`

Multiple game rooms run **independently and simultaneously** on the same server process. The monitor logs all active rooms every 10 seconds — during the defense, open 2+ rooms and show this output:

```
────────────────────────────────────────────────────────────
[Monitor] Active rooms: 2 | 10:42:15 AM
────────────────────────────────────────────────────────────
  Room A3FX9K | phase: drawing    | round: 2 | players: 3 | locked: false | word: "volcano"
  Room B7QW2M | phase: between    | round: 1 | players: 4 | locked: true  | word: "penguin"
────────────────────────────────────────────────────────────
```

---

## ✅ Course Requirements Checklist

| Requirement | Where |
|---|---|
| 5–10 concurrent users | Socket.io rooms cap at 10; `roomManager.js` |
| Real-time updates without page refresh | Socket.io WebSocket events; `index.js` ↔ `game.js` |
| Backend with concurrent request handling | Node.js event loop; `server/index.js` |
| Persistent in-memory shared data | `Map` in `roomManager.js` |
| Multithreading / concurrency for game logic | Event loop + concurrent socket handlers; `roundEngine.js` |
| Network communication | Socket.io async I/O; `index.js` ↔ `game.js` |
| Shared state management | Central `rooms` Map; `roomManager.js` + `gameState.js` |
| Synchronization mechanisms | `state.locked` mutex + `hasGuessed` flag; `roundEngine.js` |

---

## 🎮 Game Features

- **Lobby** — Create or join a room with a 6-character shareable code
- **Waiting Room** — See connected players; host controls game start
- **Drawing Phase** — Drawer gets the secret word privately; others guess via chat
- **Live Canvas** — Strokes broadcast in real time to all players in the room
- **Drawing Tools** — 10 colors, 3 brush sizes, eraser, clear canvas
- **Guessing** — Type in chat; correct answers earn points based on speed
- **Scoring** — Base 100 pts + time bonus (up to 150 pts); drawer earns 30 pts per correct guess
- **Hints** — At 50% time remaining, ~30% of letters are revealed
- **Close Guesses** — Levenshtein distance ≤ 2 shows a 🔥 "close!" indicator
- **Round Rotation** — Every player draws once per round; 3 rounds total
- **Disconnect Handling** — If the drawer disconnects, the round ends early; host transfers automatically
- **Game Over** — Final leaderboard with 🥇🥈🥉 medals and confetti
- **Mobile Friendly** — Responsive layout with bottom tab navigation on phones

---

## 🔧 Configuration

In `server/roundEngine.js`:

```js
const ROUND_DURATION = 50;   // seconds per round
const ROUNDS_PER_GAME = 3;   // number of rounds before game ends
```

To add words, edit the `EASY_WORDS` array in `server/wordList.js`.

---

## 🌐 LAN Multiplayer

To let others on the same Wi-Fi connect:

1. Find your local IP:
   - Windows: `ipconfig` → look for **IPv4 Address**
   - Mac/Linux: `ifconfig` or `ip addr`
2. Share `http://YOUR_LOCAL_IP:3000` with players on the same network

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ |
| Web framework | Express |
| Real-time transport | Socket.io (WebSocket) |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Deployment | Render (or any Node.js host) |