const DIFFICULTIES = {
  beginner: { cols: 9, rows: 9, mines: 10, hints: 1 },
  intermediate: { cols: 16, rows: 16, mines: 40, hints: 2 },
  expert: { cols: 30, rows: 16, mines: 99, hints: 3 }
};

const NUMBER_COLORS = {
  1: "#60a5fa",
  2: "#34d399",
  3: "#f87171",
  4: "#c084fc",
  5: "#fbbf24",
  6: "#2dd4bf",
  7: "#f472b6",
  8: "#cbd5e1"
};

const boardEl = document.getElementById("board");
const mineCountEl = document.getElementById("mine-count");
const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");
const overlayEl = document.getElementById("overlay");
const overlayEmojiEl = document.getElementById("overlay-emoji");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayTextEl = document.getElementById("overlay-text");
const difficultyEl = document.getElementById("difficulty");
const flagModeBtn = document.getElementById("flag-mode");
const hintBtn = document.getElementById("hint");
const hintCountEl = document.getElementById("hint-count");
const soundBtn = document.getElementById("sound-toggle");
const newGameBtn = document.getElementById("new-game");
const playAgainBtn = document.getElementById("play-again");
const fxLayer = document.getElementById("fx");

let grid = [];
let game = null;
let soundOn = true;
let flagMode = false;
let timerId = null;
let audioCtx = null;

function currentConfig() {
  return DIFFICULTIES[difficultyEl.value] || DIFFICULTIES.beginner;
}

function neighbors(r, c, fn) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < game.rows && nc >= 0 && nc < game.cols) fn(nr, nc);
    }
  }
}

function newGame() {
  const { cols, rows, mines, hints } = currentConfig();
  stopTimer();
  game = {
    cols,
    rows,
    mines,
    flags: 0,
    revealed: 0,
    hintsLeft: hints,
    firstMove: true,
    over: false,
    won: false,
    seconds: 0
  };
  overlayEl.classList.add("hidden");
  statusEl.textContent = "按「新遊戲」開始";
  buildBoard();
  updateHud();
}

function buildBoard() {
  boardEl.style.setProperty("--cols", game.cols);
  boardEl.innerHTML = "";
  grid = [];
  const frag = document.createDocumentFragment();
  for (let r = 0; r < game.rows; r++) {
    const row = [];
    for (let c = 0; c < game.cols; c++) {
      const cell = { r, c, mine: false, revealed: false, flagged: false, adj: 0, el: null };
      const el = document.createElement("button");
      el.type = "button";
      el.className = "cell";
      el.dataset.r = r;
      el.dataset.c = c;
      el.setAttribute("aria-label", `第 ${r + 1} 列，第 ${c + 1} 行`);
      frag.appendChild(el);
      cell.el = el;
      row.push(cell);
    }
    grid.push(row);
  }
  boardEl.appendChild(frag);
}

function placeMines(safeR, safeC) {
  const banned = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = safeR + dr;
      const c = safeC + dc;
      if (r >= 0 && r < game.rows && c >= 0 && c < game.cols) banned.add(r * game.cols + c);
    }
  }

  const pool = [];
  for (let i = 0; i < game.rows * game.cols; i++) {
    if (!banned.has(i)) pool.push(i);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const total = Math.min(game.mines, pool.length);
  for (let i = 0; i < total; i++) {
    const idx = pool[i];
    grid[Math.floor(idx / game.cols)][idx % game.cols].mine = true;
  }

  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      if (grid[r][c].mine) continue;
      let count = 0;
      neighbors(r, c, (nr, nc) => {
        if (grid[nr][nc].mine) count++;
      });
      grid[r][c].adj = count;
    }
  }
}

function reveal(r, c) {
  if (!game || game.over || game.won) return;
  const cell = grid[r][c];
  if (cell.flagged || cell.revealed) return;

  if (game.firstMove) {
    placeMines(r, c);
    game.firstMove = false;
    startTimer();
    statusEl.textContent = "小心腳下！";
  }

  if (cell.mine) {
    lose(r, c);
    return;
  }

  floodReveal(r, c);
  updateHud();
  checkWin();
}

function floodReveal(r, c) {
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    const cell = grid[cr][cc];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    game.revealed++;
    cell.el.classList.add("revealed");
    if (cell.adj > 0) {
      cell.el.textContent = cell.adj;
      cell.el.style.color = NUMBER_COLORS[cell.adj] || "#e2e8f0";
      cell.el.classList.add("n" + cell.adj);
    } else {
      neighbors(cr, cc, (nr, nc) => {
        const n = grid[nr][nc];
        if (!n.revealed && !n.flagged && !n.mine) stack.push([nr, nc]);
      });
    }
  }
}

function toggleFlag(r, c) {
  if (!game || game.over || game.won) return;
  const cell = grid[r][c];
  if (cell.revealed) return;

  if (!cell.flagged && game.flags >= game.mines) {
    statusEl.textContent = "旗幟已經用完囉";
    return;
  }

  cell.flagged = !cell.flagged;
  game.flags += cell.flagged ? 1 : -1;
  cell.el.classList.toggle("flagged", cell.flagged);
  cell.el.textContent = cell.flagged ? "🚩" : "";

  const rect = cell.el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  if (cell.flagged) {
    flagBurst(x, y, cell.el);
    if (soundOn) sfxFlag();
  } else {
    puff(x, y);
    if (soundOn) sfxUnflag();
  }
  updateHud();
}

function updateHud() {
  mineCountEl.textContent = String(Math.max(0, game.mines - game.flags)).padStart(2, "0");
  timerEl.textContent = String(Math.min(999, game.seconds)).padStart(3, "0");
  if (hintCountEl) hintCountEl.textContent = String(game.hintsLeft);
  if (hintBtn) hintBtn.disabled = game.hintsLeft <= 0 || game.over || game.won;
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    game.seconds++;
    updateHud();
  }, 1000);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function checkWin() {
  if (game.revealed === game.rows * game.cols - game.mines) win();
}

function win() {
  game.won = true;
  stopTimer();
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = grid[r][c];
      if (cell.mine && !cell.flagged) {
        cell.flagged = true;
        cell.el.classList.add("flagged");
        cell.el.textContent = "🚩";
        game.flags++;
      }
    }
  }
  updateHud();
  fireworks();
  danceDog();
  if (soundOn) sfxWin();
  showOverlay("🎉", "恭喜過關！", `用時 ${game.seconds} 秒`, true);
}

function lose(triggerR, triggerC) {
  game.over = true;
  stopTimer();
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = grid[r][c];
      if (cell.mine && !cell.flagged) {
        cell.revealed = true;
        cell.el.classList.add("revealed", "mine");
        cell.el.textContent = "💣";
      } else if (!cell.mine && cell.flagged) {
        cell.el.classList.add("revealed", "wrong");
        cell.el.textContent = "❌";
      }
    }
  }
  const t = grid[triggerR][triggerC];
  t.el.classList.add("exploded");
  const rect = t.el.getBoundingClientRect();
  explosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
  boardEl.classList.add("shake");
  setTimeout(() => boardEl.classList.remove("shake"), 520);
  if (soundOn) sfxBoom();
  showOverlay("💥", "踩到地雷了！", "再試一次吧", false);
}

function showOverlay(emoji, title, text, good) {
  overlayEmojiEl.textContent = emoji;
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  overlayEmojiEl.style.animation = "none";
  void overlayEmojiEl.offsetWidth;
  overlayEmojiEl.style.animation = good ? "flagPop 0.6s" : "";
  overlayEl.classList.remove("hidden");
}

function spawnParticles(opts) {
  const { x, y, count, colors, spread, size, gravity, duration } = opts;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    const s = size[0] + Math.random() * (size[1] - size[0]);
    p.style.width = s + "px";
    p.style.height = s + "px";
    const color = colors[(Math.random() * colors.length) | 0];
    p.style.background = color;
    p.style.color = color;
    p.style.left = x + "px";
    p.style.top = y + "px";
    fxLayer.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const dist = spread * (0.35 + Math.random() * 0.85);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - spread * 0.25;
    const dur = duration * (0.7 + Math.random() * 0.6);

    p.animate(
      [
        { transform: "translate(-50%, -50%) translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(-50%, -50%) translate(${dx}px, ${dy + gravity}px) scale(0.15)`, opacity: 0 }
      ],
      { duration: dur, easing: "cubic-bezier(0.15, 0.7, 0.3, 1)" }
    ).onfinish = () => p.remove();
  }
}

function spawnRing(x, y, color, delay) {
  const ring = document.createElement("span");
  ring.className = "ring";
  ring.style.left = x + "px";
  ring.style.top = y + "px";
  ring.style.borderColor = color;
  fxLayer.appendChild(ring);
  ring
    .animate(
      [
        { transform: "translate(-50%, -50%) scale(0.25)", opacity: 0.95 },
        { transform: "translate(-50%, -50%) scale(1.9)", opacity: 0 }
      ],
      { duration: 460, delay: delay || 0, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" }
    )
    .onfinish = () => ring.remove();
}

function flagBurst(x, y) {
  spawnParticles({
    x,
    y,
    count: 20,
    colors: ["#ef4444", "#f97316", "#fbbf24", "#fde68a", "#ffffff"],
    spread: 74,
    size: [4, 10],
    gravity: 130,
    duration: 680
  });
  spawnRing(x, y, "#fbbf24", 0);
  spawnRing(x, y, "#ef4444", 80);
}

function puff(x, y) {
  spawnParticles({
    x,
    y,
    count: 9,
    colors: ["#94a3b8", "#cbd5e1", "#64748b"],
    spread: 38,
    size: [3, 6],
    gravity: 60,
    duration: 430
  });
}

function explosion(x, y) {
  spawnParticles({
    x,
    y,
    count: 30,
    colors: ["#ef4444", "#f97316", "#fbbf24", "#7f1d1d", "#fca5a5"],
    spread: 110,
    size: [4, 12],
    gravity: 170,
    duration: 820
  });
  spawnRing(x, y, "#f97316", 0);
  spawnRing(x, y, "#ef4444", 70);
}

const FIREWORK_PALETTES = [
  ["#fbbf24", "#fde68a", "#ffffff"],
  ["#34d399", "#a7f3d0", "#ffffff"],
  ["#60a5fa", "#bfdbfe", "#ffffff"],
  ["#f472b6", "#fbcfe8", "#ffffff"],
  ["#f87171", "#fecaca", "#ffffff"],
  ["#c084fc", "#e9d5ff", "#ffffff"],
  ["#2dd4bf", "#99f6e4", "#ffffff"]
];

function fireworks() {
  const total = 20;
  for (let i = 0; i < total; i++) {
    setTimeout(() => {
      launchRocket(FIREWORK_PALETTES[i % FIREWORK_PALETTES.length]);
      if (i % 4 === 1) launchRocket(FIREWORK_PALETTES[(i + 3) % FIREWORK_PALETTES.length]);
    }, i * 250);
  }
}

function launchRocket(colors) {
  const x = window.innerWidth * (0.08 + Math.random() * 0.84);
  const targetY = window.innerHeight * (0.1 + Math.random() * 0.32);
  const startY = window.innerHeight + 20;
  const rocket = document.createElement("span");
  rocket.className = "rocket";
  rocket.style.left = x + "px";
  rocket.style.top = startY + "px";
  fxLayer.appendChild(rocket);

  const trail = setInterval(() => {
    const r = rocket.getBoundingClientRect();
    spawnTrail(r.left + r.width / 2, r.top);
  }, 42);

  rocket
    .animate(
      [
        { transform: "translate(-50%, -50%) translateY(0) scale(1)", opacity: 1 },
        { transform: `translate(-50%, -50%) translateY(${(targetY - startY) * 0.6}px) scale(1.25)`, opacity: 1, offset: 0.6 },
        { transform: `translate(-50%, -50%) translateY(${targetY - startY}px) scale(0.7)`, opacity: 1 }
      ],
      { duration: 600 + Math.random() * 260, easing: "cubic-bezier(0.3, 0.5, 0.7, 1)" }
    )
    .onfinish = () => {
    clearInterval(trail);
    rocket.remove();
    fireworkBurst(x, targetY, colors);
  };
}

function spawnTrail(x, y) {
  const t = document.createElement("span");
  t.className = "trail";
  t.style.left = x + "px";
  t.style.top = y + "px";
  fxLayer.appendChild(t);
  t.animate(
    [
      { transform: "translate(-50%, -50%) scale(1)", opacity: 0.95 },
      { transform: "translate(-50%, -50%) scale(0.15)", opacity: 0 }
    ],
    { duration: 460, easing: "ease-out" }
  ).onfinish = () => t.remove();
}

function glow(x, y, color) {
  const g = document.createElement("span");
  g.className = "glow";
  g.style.left = x + "px";
  g.style.top = y + "px";
  g.style.background = `radial-gradient(circle, ${color}, transparent 70%)`;
  fxLayer.appendChild(g);
  g.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0.9 },
      { transform: "translate(-50%, -50%) scale(1.7)", opacity: 0 }
    ],
    { duration: 560, easing: "ease-out" }
  ).onfinish = () => g.remove();
}

function burstRadial(x, y, colors, count, spread, gravity, duration) {
  spawnParticles({ x, y, count, colors, spread, size: [3, 9], gravity, duration });
}

function burstRing(x, y, colors, count, radius) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    const s = 4 + Math.random() * 4;
    p.style.width = s + "px";
    p.style.height = s + "px";
    const color = colors[i % colors.length];
    p.style.background = color;
    p.style.color = color;
    p.style.left = x + "px";
    p.style.top = y + "px";
    fxLayer.appendChild(p);
    const ang = (Math.PI * 2 * i) / count;
    const dx = Math.cos(ang) * radius;
    const dy = Math.sin(ang) * radius;
    p.animate(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
        { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0 }
      ],
      { duration: 1050, easing: "cubic-bezier(0.15, 0.7, 0.3, 1)" }
    ).onfinish = () => p.remove();
  }
}

function fireworkBurst(x, y, colors) {
  const type = Math.random();
  if (type < 0.3) {
    burstRadial(x, y, colors, 58, 155, 95, 1100);
    spawnRing(x, y, colors[0], 0);
    spawnRing(x, y, colors[1], 90);
  } else if (type < 0.55) {
    burstRing(x, y, colors, 42, 150);
    spawnRing(x, y, colors[1], 60);
  } else if (type < 0.78) {
    burstRadial(x, y, colors, 50, 105, 210, 1750);
    burstRadial(x, y, ["#ffffff"], 12, 55, 60, 900);
  } else {
    burstRadial(x, y, [colors[0], colors[1]], 32, 95, 85, 950);
    setTimeout(() => burstRadial(x, y, [colors[2], "#ffffff"], 30, 175, 110, 1150), 150);
  }
  spawnParticles({ x, y, count: 22, colors: ["#ffffff", "#fde68a"], spread: 70, size: [2, 5], gravity: 45, duration: 1500 });
  glow(x, y, colors[0]);
  if (soundOn) {
    tone(150 + Math.random() * 130, 0.34, "sine", 0.1, 55);
    setTimeout(() => tone(900 + Math.random() * 500, 0.14, "square", 0.03, 300), 60);
  }
}

function danceDog() {
  const actor = document.createElement("span");
  actor.className = "dog-actor";
  const dog = document.createElement("span");
  dog.className = "dog";
  dog.textContent = "🐕";
  actor.appendChild(dog);
  fxLayer.appendChild(actor);

  const w = window.innerWidth;
  const startX = w + 100;
  const endX = -140;
  const duration = 8200;

  const notes = setInterval(() => {
    const r = actor.getBoundingClientRect();
    if (r.width) spawnNote(r.left + r.width / 2, r.top + r.height * 0.2);
  }, 380);

  actor
    .animate(
      [
        { transform: `translateX(${startX}px)`, opacity: 1, offset: 0 },
        { transform: `translateX(${startX + (endX - startX) * 0.8}px)`, opacity: 1, offset: 0.8 },
        { transform: `translateX(${endX}px)`, opacity: 0 }
      ],
      { duration, easing: "linear", fill: "forwards" }
    )
    .onfinish = () => {
    clearInterval(notes);
    actor.remove();
  };
}

function spawnNote(x, y) {
  const note = document.createElement("span");
  note.className = "note";
  note.textContent = ["♪", "♫", "♩", "✨", "🎵"][(Math.random() * 5) | 0];
  note.style.left = x + "px";
  note.style.top = y + "px";
  fxLayer.appendChild(note);
  const drift = Math.random() * 70 - 35;
  note.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.4) rotate(-12deg)", opacity: 0 },
      { transform: `translate(calc(-50% + ${drift * 0.5}px), -70px) scale(1.2) rotate(10deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${drift}px), -150px) scale(0.8) rotate(-8deg)`, opacity: 0 }
    ],
    { duration: 1150, easing: "ease-out" }
  ).onfinish = () => note.remove();
}

function hint() {
  if (!game || game.over || game.won) return;
  if (game.hintsLeft <= 0) {
    statusEl.textContent = "提示已經用完了";
    return;
  }

  const candidates = [];
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = grid[r][c];
      if (cell.revealed || cell.flagged) continue;
      if (!game.firstMove && cell.mine) continue;
      candidates.push(cell);
    }
  }
  if (!candidates.length) {
    statusEl.textContent = "沒有可提示的格子";
    return;
  }

  let pool = candidates;
  if (!game.firstMove) {
    const frontier = candidates.filter((cell) => {
      let touch = false;
      neighbors(cell.r, cell.c, (nr, nc) => {
        if (grid[nr][nc].revealed) touch = true;
      });
      return touch;
    });
    if (frontier.length) pool = frontier;
  }
  const pick = pool[(Math.random() * pool.length) | 0];

  if (game.firstMove) {
    placeMines(pick.r, pick.c);
    game.firstMove = false;
    startTimer();
  }

  game.hintsLeft--;
  floodReveal(pick.r, pick.c);
  pick.el.classList.add("hint-reveal");
  const rect = pick.el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  spawnRing(x, y, "#fbbf24", 0);
  spawnParticles({
    x,
    y,
    count: 14,
    colors: ["#fbbf24", "#fde68a", "#ffffff"],
    spread: 50,
    size: [3, 7],
    gravity: 15,
    duration: 560
  });
  if (soundOn) tone(880, 0.18, "sine", 0.12, 1320);
  statusEl.textContent = `提示：已翻開一格（剩 ${game.hintsLeft} 次）`;
  updateHud();
  checkWin();
}

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq, dur, type, gain, slideTo) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(gain || 0.14, ctx.currentTime + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.03);
}

function sfxFlag() {
  tone(620, 0.16, "triangle", 0.16, 980);
  setTimeout(() => tone(1180, 0.12, "sine", 0.1), 70);
}

function sfxUnflag() {
  tone(340, 0.12, "sine", 0.1, 220);
}

function sfxBoom() {
  tone(180, 0.5, "sawtooth", 0.2, 40);
}

function sfxWin() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, "triangle", 0.14), i * 120));
}

boardEl.addEventListener("click", (e) => {
  const el = e.target.closest(".cell");
  if (!el) return;
  const r = Number(el.dataset.r);
  const c = Number(el.dataset.c);
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (flagMode) toggleFlag(r, c);
  else reveal(r, c);
});

boardEl.addEventListener("contextmenu", (e) => {
  const el = e.target.closest(".cell");
  if (!el) return;
  e.preventDefault();
  toggleFlag(Number(el.dataset.r), Number(el.dataset.c));
});

let pressTimer = null;
let suppressClick = false;

boardEl.addEventListener("pointerdown", (e) => {
  const el = e.target.closest(".cell");
  if (!el || e.button !== 0) return;
  suppressClick = false;
  pressTimer = setTimeout(() => {
    suppressClick = true;
    toggleFlag(Number(el.dataset.r), Number(el.dataset.c));
    if (navigator.vibrate) navigator.vibrate(18);
  }, 420);
});

["pointerup", "pointerleave", "pointercancel"].forEach((evt) => {
  boardEl.addEventListener(evt, () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  });
});

flagModeBtn.addEventListener("click", () => {
  flagMode = !flagMode;
  flagModeBtn.classList.toggle("active", flagMode);
  statusEl.textContent = flagMode ? "插旗模式：點擊格子即可插旗" : "一般模式：點擊格子翻開";
});

soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? "🔊" : "🔇";
  soundBtn.classList.toggle("off", !soundOn);
  statusEl.textContent = soundOn ? "音效已開啟" : "音效已關閉";
  if (soundOn) tone(880, 0.08, "sine", 0.08);
});

difficultyEl.addEventListener("change", newGame);
if (hintBtn) hintBtn.addEventListener("click", hint);
newGameBtn.addEventListener("click", newGame);
playAgainBtn.addEventListener("click", newGame);

newGame();
