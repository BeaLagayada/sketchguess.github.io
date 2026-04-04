const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── CURATED WORD LIST (200 easy-to-draw, well-known words) ─────────────────
const EASY_WORDS = [
  "apple", "banana", "cherry", "grape", "orange", "lemon", "strawberry", "watermelon",
  "pizza", "burger", "fries", "taco", "sushi", "cake", "cookie", "ice cream",
  "cat", "dog", "bird", "fish", "lion", "elephant", "giraffe", "zebra", "monkey",
  "frog", "rabbit", "mouse", "snake", "butterfly", "bee", "spider", "dinosaur",
  "car", "bus", "train", "airplane", "helicopter", "bicycle", "motorcycle", "boat",
  "house", "school", "castle", "tent", "igloo", "skyscraper", "bridge", "lighthouse",
  "sun", "moon", "star", "cloud", "rainbow", "thunderstorm", "snowflake", "tornado",
  "tree", "flower", "grass", "mountain", "river", "ocean", "desert", "volcano",
  "heart", "smiley", "ghost", "robot", "alien", "dragon", "unicorn", "fairy",
  "ball", "kite", "balloon", "gift", "clock", "book", "pen", "scissors",
  "computer", "phone", "camera", "television", "lamp", "chair", "table", "bed",
  "cup", "plate", "fork", "knife", "spoon", "bowl", "bottle", "glass",
  "shoe", "shirt", "hat", "pants", "dress", "glasses", "watch", "backpack",
  "key", "lock", "umbrella", "candle", "flashlight", "hammer", "screwdriver", "paintbrush",
  "sword", "shield", "crown", "treasure", "map", "compass", "binoculars", "telescope",
  "rocket", "spaceship", "astronaut", "satellite", "planet", "comet", "alien", "UFO",
  "snowman", "santa", "pumpkin", "witch", "bat", "spiderweb", "candy", "lollipop",
  "milk", "cheese", "bread", "egg", "bacon", "salad", "soup", "sandwich",
  "toothbrush", "soap", "towel", "mirror", "comb", "shampoo", "razor", "toothpaste",
  "football", "baseball", "basketball", "soccer", "tennis", "golf", "hockey", "skateboard",
  "dolphin", "whale", "shark", "octopus", "crab", "jellyfish", "starfish", "seahorse",
  "cactus", "palm tree", "sunflower", "rose", "tulip", "daisy", "mushroom", "bamboo",
  "penguin", "polar bear", "koala", "kangaroo", "panda", "sloth", "otter", "hedgehog",
  "donut", "croissant", "bagel", "muffin", "pie", "brownie", "pancake", "waffle",
  "fire", "water", "earth", "wind", "rain", "snow", "ice", "steam"
];

// Ensure we have exactly 200 (or close). The list above is ~200 items.
console.log(`[WordList] Loaded ${EASY_WORDS.length} easy-to-draw words.`);

// Simple in-memory word pool (we'll just use a copy and shuffle occasionally)
let wordPool = [...EASY_WORDS];

// Shuffle function
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Refill pool if it gets low (just reshuffle the original list)
function ensureWordPool() {
  if (wordPool.length < 20) {
    wordPool = shuffleArray([...EASY_WORDS]);
    console.log(`[WordPool] Refilled with ${wordPool.length} words.`);
  }
}

// Get a random word (removes it from pool to reduce repeats, but refills when low)
function getRandomWord() {
  ensureWordPool();
  if (wordPool.length === 0) {
    // fallback: return any from master list
    return EASY_WORDS[Math.floor(Math.random() * EASY_WORDS.length)];
  }
  const index = Math.floor(Math.random() * wordPool.length);
  const word = wordPool[index];
  wordPool.splice(index, 1); // remove to avoid immediate repeat
  return word;
}

// Optional: pre-shuffle at start
wordPool = shuffleArray([...EASY_WORDS]);

// ─── Game constants ───────────────────────────────────────────────────────────
const ROUND_DURATION = 50; // seconds
const ROUNDS_PER_GAME = 3;

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function maskWord(word) {
  return word.split('').map(c => c === ' ' ? ' ' : '_').join(' ');
}

function revealLetter(word, masked, percent) {
  const letters = word.split('');
  const maskedArr = masked.split(' ');
  const hidden = letters.map((c, i) => maskedArr[i] === '_' ? i : -1).filter(i => i >= 0);
  const toReveal = Math.floor(hidden.length * percent);
  for (let i = 0; i < toReveal; i++) {
    const ri = Math.floor(Math.random() * hidden.length);
    const idx = hidden.splice(ri, 1)[0];
    maskedArr[idx] = letters[idx];
  }
  return maskedArr.join(' ');
}

function createRoom(hostId, hostName, hostAvatar = '🐼') {
  const code = generateRoomCode();
  rooms[code] = {
    code,
    host: hostId,
    players: {},
    state: 'lobby',
    round: 0,
    currentDrawer: null,
    currentWord: null,
    maskedWord: null,
    drawHistory: [],
    timer: null,
    timeLeft: 0,
    correctGuessers: new Set(),
    chat: []
  };
  return code;
}

function getRoomPublic(room) {
  return {
    code: room.code,
    state: room.state,
    round: room.round,
    players: Object.values(room.players).map(p => ({
      id: p.id, name: p.name, score: p.score, isDrawing: p.isDrawing, avatar: p.avatar
    })),
    currentDrawer: room.currentDrawer,
    maskedWord: room.maskedWord,
    timeLeft: room.timeLeft,
    currentWord: room.currentWord
  };
}

async function startRound(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  room.round++;
  if (room.round > ROUNDS_PER_GAME * Object.keys(room.players).length) {
    endGame(roomCode);
    return;
  }

  // Rotate drawer
  const playerIds = Object.keys(room.players);
  const drawerIdx = (room.round - 1) % playerIds.length;
  const drawerId = playerIds[drawerIdx];

  Object.values(room.players).forEach(p => p.isDrawing = false);
  room.players[drawerId].isDrawing = true;
  room.currentDrawer = drawerId;

  // Get a random word from our curated list (sync, no promise needed)
  const word = getRandomWord();
  room.currentWord = word;
  room.maskedWord = maskWord(word);
  room.drawHistory = [];
  room.correctGuessers = new Set();
  room.state = 'drawing';
  room.timeLeft = ROUND_DURATION;

  // Send word to drawer privately
  io.to(drawerId).emit('your-word', { word });

  // Send masked word to others
  io.to(roomCode).emit('round-start', getRoomPublic(room));

  // Broadcast draw history clear
  io.to(roomCode).emit('clear-canvas');

  // Start countdown
  clearInterval(room.timer);
  room.timer = setInterval(() => {
    room.timeLeft--;

    // Reveal hint at 50% time gone
    if (room.timeLeft === Math.floor(ROUND_DURATION * 0.5)) {
      room.maskedWord = revealLetter(room.currentWord, room.maskedWord, 0.3);
      io.to(roomCode).emit('word-hint', { maskedWord: room.maskedWord });
    }

    io.to(roomCode).emit('timer', { timeLeft: room.timeLeft });

    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      endRound(roomCode);
    }
  }, 1000);
}

function endRound(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  clearInterval(room.timer);
  room.state = 'between';

  io.to(roomCode).emit('round-end', {
    word: room.currentWord,
    players: getRoomPublic(room).players
  });

  setTimeout(() => {
    if (rooms[roomCode]) startRound(roomCode);
  }, 5000);
}

function endGame(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  clearInterval(room.timer);
  room.state = 'gameover';

  const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
  io.to(roomCode).emit('game-over', { players: sorted.map(p => ({ name: p.name, score: p.score, avatar: p.avatar })) });
}

function resetGame(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  clearInterval(room.timer);
  Object.values(room.players).forEach(p => { p.score = 0; p.isDrawing = false; });
  room.round = 0;
  room.state = 'lobby';
  room.currentDrawer = null;
  room.currentWord = null;
  room.maskedWord = null;
  room.drawHistory = [];
  room.correctGuessers.clear();
  room.timeLeft = 0;
  io.to(roomCode).emit('game-reset', { room: getRoomPublic(room) });
}

// ─── In-memory rooms ──────────────────────────────────────────────────────────
const rooms = {};

// ─── Socket.io events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  socket.on('create-room', ({ name, avatar }) => {
    const code = createRoom(socket.id, name, avatar || '🐼');
    const room = rooms[code];
    room.players[socket.id] = { id: socket.id, name, score: 0, isDrawing: false, avatar: avatar || '🐼' };
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.name = name;
    socket.emit('room-joined', { code, playerId: socket.id, room: getRoomPublic(room) });
    console.log(`[Room] ${name} created room ${code}`);
  });

  socket.on('join-room', ({ code, name, avatar }) => {
    const room = rooms[code.toUpperCase()];
    if (!room) { socket.emit('error', { message: 'Room not found!' }); return; }
    if (Object.keys(room.players).length >= 10) { socket.emit('error', { message: 'Room is full (max 10)!' }); return; }

    room.players[socket.id] = { id: socket.id, name, score: 0, isDrawing: false, avatar: avatar || '🐼' };
    socket.join(code.toUpperCase());
    socket.data.roomCode = code.toUpperCase();
    socket.data.name = name;

    socket.emit('room-joined', { code: code.toUpperCase(), playerId: socket.id, room: getRoomPublic(room) });
    socket.emit('draw-history', { history: room.drawHistory });
    if (room.state === 'drawing') {
      socket.emit('round-start', getRoomPublic(room));
      socket.emit('timer', { timeLeft: room.timeLeft });
      if (room.maskedWord) socket.emit('word-hint', { maskedWord: room.maskedWord });
    } else if (room.state === 'between') {
      socket.emit('round-end', { word: room.currentWord, players: getRoomPublic(room).players });
    } else if (room.state === 'gameover') {
      const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
      socket.emit('game-over', { players: sorted.map(p => ({ name: p.name, score: p.score, avatar: p.avatar })) });
    }

    socket.to(code.toUpperCase()).emit('player-joined', { player: { id: socket.id, name, score: 0, avatar: avatar || '🐼' }, room: getRoomPublic(room) });
    console.log(`[Room] ${name} joined room ${code.toUpperCase()} (state: ${room.state})`);
  });

  socket.on('start-game', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    if (Object.keys(room.players).length < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start!' });
      return;
    }
    if (room.state !== 'lobby' && room.state !== 'gameover') {
      socket.emit('error', { message: 'Game already in progress!' });
      return;
    }
    if (room.state === 'gameover') resetGame(code);
    room.round = 0;
    startRound(code);
  });

  socket.on('new-game', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    resetGame(code);
  });

  socket.on('draw', (data) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.currentDrawer !== socket.id) return;
    room.drawHistory.push(data);
    socket.to(code).emit('draw', data);
  });

  socket.on('clear-canvas', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.currentDrawer !== socket.id) return;
    room.drawHistory = [];
    socket.to(code).emit('clear-canvas');
  });

  socket.on('request-history', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return;
    socket.emit('draw-history', { history: room.drawHistory });
  });

  socket.on('guess', ({ message }) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.state !== 'drawing') return;
    const player = room.players[socket.id];
    if (!player || room.currentDrawer === socket.id) return;
    if (room.correctGuessers.has(socket.id)) {
      io.to(code).emit('chat', { name: player.name, message, correct: false, isSystem: false });
      return;
    }

    const isCorrect = message.trim().toLowerCase() === room.currentWord.toLowerCase();
    if (isCorrect) {
      room.correctGuessers.add(socket.id);
      const bonus = Math.ceil((room.timeLeft / ROUND_DURATION) * 150);
      const base = 100;
      player.score += base + bonus;
      room.players[room.currentDrawer].score += 30;

      io.to(code).emit('correct-guess', {
        playerId: socket.id,
        name: player.name,
        players: getRoomPublic(room).players
      });

      const nonDrawers = Object.keys(room.players).filter(id => id !== room.currentDrawer);
      if (room.correctGuessers.size >= nonDrawers.length) {
        clearInterval(room.timer);
        endRound(code);
      }
    } else {
      const close = levenshtein(message.toLowerCase(), room.currentWord.toLowerCase()) <= 2;
      io.to(code).emit('chat', { name: player.name, message, correct: false, isClose: close, isSystem: false });
    }
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code || !rooms[code]) return;
    const room = rooms[code];
    const name = socket.data.name || 'Someone';
    delete room.players[socket.id];

    io.to(code).emit('player-left', { playerId: socket.id, name, room: getRoomPublic(room) });

    if (Object.keys(room.players).length === 0) {
      clearInterval(room.timer);
      delete rooms[code];
      console.log(`[Room] ${code} deleted (empty)`);
    } else if (room.host === socket.id) {
      room.host = Object.keys(room.players)[0];
      io.to(code).emit('new-host', { playerId: room.host });
    }

    if (room.state === 'drawing' && room.currentDrawer === socket.id) {
      clearInterval(room.timer);
      endRound(code);
    }
  });
});

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎨 SketchGuess running at http://localhost:${PORT} | Word list size: ${EASY_WORDS.length}`));