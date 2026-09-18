const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const GROUND_Y = 560;
const NET_X = 400;
const NET_TOP = 420;
const BALL_R = 13;
const WIN_SCORE = 15;

const GRAVITY = 1200;

const POSITIONS = {
  spiker: {
    name: "主攻手",
    icon: "⚡",
    color: "#fbbf24",
    desc: "跳得高、扣得猛",
    skillName: "重錘扣殺",
    skillDesc: "下一次扣殺威力大增",
    move: 345,
    jump: 640,
    spike: 1.35,
    set: 0.92,
    minCd: 0.26,
    grace: false,
    block: 0.6,
    skillCd: 8
  },
  setter: {
    name: "舉球員",
    icon: "🎯",
    color: "#34d399",
    desc: "托球精準、節奏穩定",
    skillName: "精準托球",
    skillDesc: "將球高高托起，躍起就能扣",
    move: 332,
    jump: 585,
    spike: 0.8,
    set: 1.22,
    minCd: 0.15,
    grace: true,
    block: 0.55,
    skillCd: 6
  },
  blocker: {
    name: "副攻手",
    icon: "🛡️",
    color: "#a78bfa",
    desc: "攔網專家、網前核心",
    skillName: "銅牆鐵壁",
    skillDesc: "張開巨型攔網，彈回扣殺",
    move: 322,
    jump: 615,
    spike: 1.0,
    set: 0.95,
    minCd: 0.3,
    grace: false,
    block: 0.95,
    skillCd: 7
  },
  libero: {
    name: "自由球員",
    icon: "💠",
    color: "#38bdf8",
    desc: "速度之王、救球專家",
    skillName: "魚躍救球",
    skillDesc: "俯身魚躍，救起遠方的球",
    move: 410,
    jump: 545,
    spike: 0.5,
    set: 1.15,
    minCd: 0.24,
    grace: true,
    block: 0.7,
    skillCd: 6
  }
};
const POS_IDS = Object.keys(POSITIONS);

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const posGrid = document.getElementById("pos-grid");
const posCards = POS_IDS.map((id) => document.getElementById("pos-" + id));
const soundBtn = document.getElementById("sound-toggle");
const yourScoreEl = document.getElementById("your-score");
const cpuScoreEl = document.getElementById("cpu-score");
const serveInfoEl = document.getElementById("serve-indicator");
const yourPosEl = document.getElementById("your-pos");
const cpuPosEl = document.getElementById("cpu-pos");
const yourSkillIcon = document.getElementById("your-skill-icon");
const yourSkillName = document.getElementById("your-skill-name");
const yourCdFill = document.getElementById("your-cd-fill");
const cpuSkillIcon = document.getElementById("cpu-skill-icon");
const cpuSkillName = document.getElementById("cpu-skill-name");
const statusEl = document.getElementById("status");

const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");
const btnJump = document.getElementById("btn-jump");
const btnSkill = document.getElementById("btn-skill");

const keys = { left: false, right: false, jump: false };

let playerPosId = "spiker";
let cpuPosId = "spiker";

let playerScore = 0;
let cpuScore = 0;
let server = "player";
let state = "menu";
let stateTimer = 0;
let overMsg = "";
let resultSide = null;

let soundOn = true;
let audioCtx = null;

function rnd(a, b) { return a + Math.random() * (b - a); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function makeChar(x, posId) {
  const pos = POSITIONS[posId];
  return {
    x, y: GROUND_Y, vx: 0, vy: 0, onGround: true, posId, pos,
    skillCd: 0,
    powerMode: false, powerTimer: 0, powerFlash: 0,
    wallOn: false, wallTimer: 0, wallPop: 0,
    dive: 0, diveDir: 1,
    jumpCd: 0
  };
}

let player = makeChar(300, playerPosId);
let cpu = makeChar(560, cpuPosId);

const ball = {
  x: 0, y: 0, vx: 0, vy: 0, r: BALL_R, hitCd: 0, lastTouch: "player"
};

let particles = [];
let scoredMsg = null;

function initBall() {
  ball.x = 0;
  ball.y = 0;
  ball.vx = 0;
  ball.vy = 0;
  ball.hitCd = 0.3;
}

function setState(s) {
  state = s;
  stateTimer = 0;
}

function resetMatch() {
  playerScore = 0;
  cpuScore = 0;
  server = "player";
  resultSide = null;
  player = makeChar(300, playerPosId);
  cpu = makeChar(560, cpuPosId);
  particles = [];
  scoredMsg = null;
  initBall();
  updateHud();
  syncSkillBar();
}

function startGame() {
  cpuPosId = POS_IDS[(Math.random() * POS_IDS.length) | 0];
  if (cpuPosId === playerPosId) {
    cpuPosId = POS_IDS[(Math.random() * POS_IDS.length) | 0];
  }
  resetMatch();
  posGrid.classList.add("hidden");
  overlay.classList.add("hidden");
  setState("serve");
  stateTimer = server === "player" ? 6 : 1.2;
  updateServeStatus();
  initAudio();
}

function updateServeStatus() {
  if (server === "player") {
    statusEl.textContent = `你發球 · 按 空白/↑ · Shift 技能【${POSITIONS[playerPosId].skillName}】`;
  } else {
    statusEl.textContent = "電腦發球…";
  }
}

function jumpReturned(ch) {
  if (ch.onGround) {
    ch.vy = -ch.pos.jump;
    ch.onGround = false;
  }
}

function startDive(ch) {
  ch.dive = 0.5;
  ch.diveDir = ball.x > ch.x ? 1 : -1;
  ch.vy = -140;
  ch.onGround = false;
}

function useSkill(ch, isPlayer) {
  if (state !== "rally") return;
  if (ch.skillCd > 0) return;
  const pos = ch.pos;
  const dir = isPlayer ? 1 : -1;
  const id = ch.posId;

  if (id === "spiker") {
    ch.powerMode = true;
    ch.powerTimer = 2.5;
    ch.skillCd = pos.skillCd;
    spawnHitParticles(ch.x, ch.y - 80, pos.color, 18);
    playSkill();
    return;
  }

  if (id === "setter") {
    const onSide = isPlayer ? ball.x < NET_X : ball.x > NET_X;
    if (onSide && Math.abs(ball.x - ch.x) < 130 && ball.y < GROUND_Y - 100) {
      ball.vx = dir * 40;
      ball.vy = -(pos.set * 880);
      ball.hitCd = 0.35;
      ball.lastTouch = isPlayer ? "player" : "cpu";
      ch.skillCd = pos.skillCd;
      spawnHitParticles(ball.x, ball.y, pos.color, 24);
      playSkill();
    }
    return;
  }

  if (id === "blocker") {
    ch.wallOn = true;
    ch.wallTimer = 1.1;
    ch.skillCd = pos.skillCd;
    spawnHitParticles(ch.x + dir * 24, ch.y - 100, pos.color, 14);
    playSkill();
    return;
  }

  if (id === "libero") {
    startDive(ch);
    ch.skillCd = pos.skillCd;
    playSkill();
  }
}

function smash(ch, dir) {
  if (ball.hitCd > 0) return false;
  const pos = ch.pos;
  const diving = ch.dive > 0;
  const wall = ch.wallOn;
  const boxW = wall ? 34 : (diving ? 54 : 22);
  const top = wall ? ch.y - 132 : (diving ? ch.y - 34 : ch.y - 78);

  if (!(ball.x > ch.x - boxW && ball.x < ch.x + boxW &&
        ball.y > top && ball.y < ch.y)) return false;

  const quality = clamp((top + 20 - ball.y) / 50, -1, 1);
  const ratio = (quality + 1) / 2;

  if (wall) {
    ch.wallOn = false;
    ch.wallTimer = 0;
    ch.wallPop = 0.4;
    const reflected = Math.max(Math.hypot(ball.vx, ball.vy) * pos.block, 430);
    ball.vx = dir * reflected * (0.55 + ratio * 0.5);
    ball.vy = -reflected * (0.7 + (1 - ratio) * 0.4);
    playBlock();
  } else {
    let power = 360 + 260 * ratio;
    const incoming = Math.hypot(ball.vx, ball.vy);
    if (incoming > 560) power = Math.max(power, incoming * pos.block * 0.72);
    if (ch.powerMode) {
      power *= 2;
      ch.powerMode = false;
      ch.powerTimer = 0;
      ch.powerFlash = 0.4;
    }
    let vx = dir * (150 + 160 * ratio + rnd(0, 80));
    if (diving) vx = dir * (110 + rnd(0, 50));
    if (!pos.grace && quality < -0.4) vx *= 0.7;
    let vy = -power * pos.set;
    if (quality < 0) vy *= 1 + quality * 0.3;
    vy += ch.vy * 0.25;
    vx += ch.vx * 0.35;
    if (diving) vy *= 1.15;
    ball.vx = vx;
    ball.vy = vy;
  }

  ball.hitCd = Math.max(pos.minCd, ball.hitCd);
  ball.lastTouch = dir === 1 ? "player" : "cpu";
  spawnHitParticles(ball.x, ball.y, dir === 1 ? "#bfdbfe" : "#fecaca");
  playHit();
  return true;
}

function doServe() {
  const isPlayer = server === "player";
  const s = isPlayer ? player : cpu;
  const dir = isPlayer ? 1 : -1;
  const bx = clamp(s.x, isPlayer ? 300 : 420, isPlayer ? 380 : 500);
  ball.x = bx;
  ball.y = 390;
  const pVary = s.pos.spike * 0.6 + 0.7;
  ball.vx = dir * (230 + rnd(0, 70)) * pVary;
  ball.vy = -(400 + rnd(0, 80));
  ball.hitCd = 0.25;
  ball.lastTouch = server;
  playServe();
  setState("rally");
  statusEl.textContent = "比賽中";
}

function updateServe(dt) {
  statusEl.textContent = server === "player"
    ? `你發球 · 按 空白/↑ · Shift 技能【${POSITIONS[playerPosId].skillName}】`
    : "電腦發球…";
  stateTimer -= dt;
  if (stateTimer <= 0) doServe();
}

function updateRally(dt) {
  stepBall(dt);
}

function updateScored(dt) {
  stateTimer -= dt;
  if (scoredMsg) scoredMsg.t += dt;
  if (stateTimer <= 0) {
    if (overMsg) {
      setState("over");
      overlayTitle.textContent = overMsg;
      overlayText.textContent = `比數　你 ${playerScore} : ${cpuScore} 電腦`;
      startBtn.textContent = "再玩一次（抽新電腦位置）";
      overlay.classList.remove("hidden");
    } else {
      setState("serve");
      stateTimer = server === "player" ? 6 : 1.2;
      updateServeStatus();
    }
  }
}

function stepBall(dt) {
  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.hitCd > 0) ball.hitCd -= dt;

  if (ball.y + ball.r >= GROUND_Y) {
    const scorer = ball.x < NET_X ? "cpu" : "player";
    awardScore(scorer);
    return;
  }

  if (ball.x < BALL_R || ball.x > W - BALL_R) {
    const scorer = ball.lastTouch === "player" ? "cpu" : "player";
    spawnHitParticles(ball.x, GROUND_Y - 20, "#fff");
    awardScore(scorer);
    return;
  }

  if (ball.x - ball.r < NET_X && ball.x + ball.r > NET_X && ball.y > NET_TOP) {
    if (ball.vx > 0) {
      ball.x = NET_X - ball.r;
      ball.vx = -Math.abs(ball.vx) * 0.55;
    } else {
      ball.x = NET_X + ball.r;
      ball.vx = Math.abs(ball.vx) * 0.55;
    }
    ball.hitCd = Math.max(ball.hitCd, 0.15);
    playNet();
  }

  if (smash(player, 1)) return;
  if (smash(cpu, -1)) return;
}

function awardScore(scorer) {
  resultSide = scorer;
  if (scorer === "player") {
    playerScore++;
    scoredMsg = { text: "你得一分！", color: "#60a5fa", t: 0 };
    playScore(true);
  } else {
    cpuScore++;
    scoredMsg = { text: "電腦得分", color: "#f87171", t: 0 };
    playScore(false);
  }
  server = scorer;
  updateHud();
  spawnHitParticles(W / 2, H / 2 - 80, "#fde68a", 26);
  initBall();

  const myWin = playerScore >= WIN_SCORE && playerScore >= cpuScore + 2;
  const cpuWin = cpuScore >= WIN_SCORE && cpuScore >= playerScore + 2;
  if (myWin) {
    overMsg = "🎉 你贏了！";
    playFanfare();
  } else if (cpuWin) {
    overMsg = "😅 電腦贏了";
    playFanfare();
  } else {
    overMsg = "";
  }
  setState("scored");
}

function updateHud() {
  yourScoreEl.textContent = playerScore;
  cpuScoreEl.textContent = cpuScore;
  yourPosEl.textContent = POSITIONS[playerPosId].name;
  cpuPosEl.textContent = POSITIONS[cpuPosId].name;
  if (overMsg) {
    serveInfoEl.textContent = "比賽結束";
  } else if (state === "serve") {
    serveInfoEl.textContent = server === "player" ? "⬇️ 你發球" : "⬆️ 電腦發球";
  } else if (state === "rally") {
    serveInfoEl.textContent = "進行中";
  } else if (state === "scored") {
    serveInfoEl.textContent = resultSide === "player" ? "✅ 你得1分" : "🟥 電腦得1分";
  }
  updateSkillBar();
}

function syncSkillBar() {
  const p = POSITIONS[playerPosId];
  yourSkillIcon.textContent = p.icon;
  yourSkillName.textContent = p.skillName;
  yourCdFill.style.width = "100%";
  yourCdFill.classList.add("ready");
  statusEl.textContent = `← → 移動 · ↑/Space 跳躍 · Shift【${p.skillName}】`;
}

function updateSkillBar() {
  const a = POSITIONS[playerPosId];
  const b = POSITIONS[cpuPosId];
  const fill = Math.max(0, Math.min(1, (a.skillCd - player.skillCd) / a.skillCd));
  yourCdFill.style.width = (fill * 100).toFixed(1) + "%";
  if (fill >= 1) yourCdFill.classList.add("ready");
  else yourCdFill.classList.remove("ready");
  cpuSkillIcon.textContent = b.icon;
  cpuSkillName.textContent = b.skillName;
}

function updateCharTimers(ch, dt) {
  if (ch.powerTimer > 0) {
    ch.powerTimer -= dt;
    if (ch.powerTimer <= 0) ch.powerMode = false;
  }
  if (ch.powerFlash > 0) ch.powerFlash -= dt;
  if (ch.wallTimer > 0) {
    ch.wallTimer -= dt;
    if (ch.wallTimer <= 0) ch.wallOn = false;
  }
  if (ch.wallPop > 0) ch.wallPop -= dt;
  if (ch.dive > 0) ch.dive -= dt;
  if (ch.skillCd > 0) ch.skillCd -= dt;
}

function updatePlayer(dt) {
  player.vx = 0;
  if (player.dive > 0) {
    player.vx = player.diveDir * player.pos.move * 1.6;
  } else {
    if (keys.left) player.vx = -player.pos.move;
    if (keys.right) player.vx = player.pos.move;
  }
  player.x = clamp(player.x + player.vx * dt, 70, NET_X - 26);
  applyPhysics(player, dt);

  if (state === "serve" && server === "player" && keys.jump) {
    doServe();
  }
}

function updateCpu(dt) {
  let target = 620;
  if (ball.vx > 0 || ball.x > NET_X) {
    const t = ball.vy > 0 ? clamp((GROUND_Y - 20 - ball.y) / ball.vy, 0, 1.5) : 0;
    const px = ball.x + ball.vx * t;
    target = clamp(px, 440, 710);
  } else {
    target = 590;
  }

  if (cpu.dive > 0) {
    cpu.vx = cpu.diveDir * cpu.pos.move * 1.6;
  } else {
    cpu.vx = clamp((target - cpu.x) * 4, -cpu.pos.move, cpu.pos.move);
  }
  cpu.x = clamp(cpu.x + cpu.vx * dt, NET_X + 26, 720);
  applyPhysics(cpu, dt);

  cpu.jumpCd -= dt;
  if (cpu.onGround && state === "rally" && ball.x > NET_X && ball.vy > 0 && cpu.jumpCd <= 0) {
    const dx = Math.abs(ball.x - cpu.x);
    if (dx < 100 && ball.y < GROUND_Y - 40) {
      jumpReturned(cpu);
      cpu.jumpCd = 0.35 + rnd(0, 0.2);
    }
  }

  updateCpuSkill();
}

function updateCpuSkill() {
  if (cpu.skillCd > 0) return;
  if (state !== "rally") return;
  const id = cpu.posId;
  if (id === "spiker") {
    if (ball.x > NET_X && ball.vy > 0 && ball.y < GROUND_Y - 110 &&
        Math.abs(ball.x - cpu.x) < 100 && Math.random() < 0.45) {
      useSkill(cpu, false);
    }
  } else if (id === "setter") {
    if (ball.x > NET_X && ball.vy > 0 && ball.y < GROUND_Y - 150 &&
        Math.abs(ball.x - cpu.x) < 130) {
      useSkill(cpu, false);
    }
  } else if (id === "blocker") {
    if (ball.x < NET_X && ball.x > NET_X - 120 && ball.vy < -260 &&
        Math.abs(cpu.x - NET_X) < 80 && Math.random() < 0.6) {
      useSkill(cpu, false);
    }
  } else if (id === "libero") {
    if (ball.x > NET_X && ball.vy > 0 && ball.y > GROUND_Y - 250 &&
        Math.abs(ball.x - cpu.x) > 60 && Math.random() < 0.5) {
      useSkill(cpu, false);
    }
  }
}

function applyPhysics(ch, dt) {
  if (!ch.onGround) {
    ch.vy += GRAVITY * dt;
    ch.y += ch.vy * dt;
    if (ch.y >= GROUND_Y) {
      ch.y = GROUND_Y;
      ch.vy = 0;
      ch.onGround = true;
    }
  }
}

function spawnHitParticles(x, y, color, n = 12) {
  for (let i = 0; i < n; i++) {
    const ang = rnd(0, Math.PI * 2);
    const sp = rnd(60, 240);
    particles.push({
      x, y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 60,
      life: rnd(0.4, 0.9),
      t: 0,
      size: rnd(2, 5),
      color
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    if (p.t >= p.life) particles.splice(i, 1);
  }
}

function update(dt) {
  if (state === "serve") updateServe(dt);
  if (state === "rally") updateRally(dt);
  if (state === "scored") updateScored(dt);

  updateCharTimers(player, dt);
  updateCharTimers(cpu, dt);
  updatePlayer(dt);
  updateCpu(dt);
  updateParticles(dt);
  updateHud();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#2563eb");
  sky.addColorStop(0.55, "#60a5fa");
  sky.addColorStop(1, "#bfdbfe");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  ctx.fillStyle = "#c9a56a";
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, GROUND_Y + 6, W, 3);

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();
}

function drawNet() {
  const cx = NET_X;
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, NET_TOP);
  ctx.lineTo(cx, GROUND_Y);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  for (let y = NET_TOP + 8; y < GROUND_Y; y += 10) {
    ctx.beginPath();
    ctx.moveTo(cx - 16, y);
    ctx.lineTo(cx + 16, y);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 16 + i * 10, NET_TOP);
    ctx.lineTo(cx - 16 + i * 10, GROUND_Y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(0, NET_TOP);
  ctx.lineTo(W, NET_TOP);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, NET_TOP);
  ctx.lineTo(W, NET_TOP);
  ctx.stroke();
}

function drawPlayer(ch, isPlayer) {
  const pos = ch.pos;
  const base = isPlayer ? "#3b82f6" : "#ef4444";
  const dark = isPlayer ? "#1d4ed8" : "#b91c1c";
  const face = isPlayer ? "#bfdbfe" : "#fecaca";
  const dir = isPlayer ? 1 : -1;
  const diving = Math.min(Math.max(ch.dive, 0) * 6, 1);

  const cx = ch.x;
  const bodyY = ch.y - 34 + diving * 24;

  ctx.save();
  ctx.translate(cx, bodyY);
  ctx.rotate(diving * 0.4 * dir);
  ctx.translate(-cx, -bodyY);

  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(cx, bodyY, 22 * (1 + diving * 0.8), 22 * (1 - diving * 0.35), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, bodyY - 26 * (1 - diving * 0.5), 13 * (1 + diving * 0.4), 13 * (1 - diving * 0.2), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(cx + dir * 8, bodyY - 2, 16, 16 * (1 - diving * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(cx + dir * 10, bodyY - 28, 8 * (1 - diving * 0.3), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0b1020";
  ctx.beginPath();
  ctx.arc(cx + dir * 14, bodyY - 30, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx + dir * 3, ch.y, 8 * (1 - diving * 0.5), 0, Math.PI * 2);
  ctx.arc(cx - dir * 6, ch.y, 8 * (1 - diving * 0.5), 0, Math.PI);
  ctx.fill();

  ctx.strokeStyle = pos.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, bodyY, 26 * (1 + diving * 0.8), 26 * (1 - diving * 0.4), 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  ctx.font = "bold 16px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = pos.color;
  ctx.fillText(pos.icon, cx, ch.y - 104);
}

function drawSkillFx(ch, isPlayer) {
  const pos = ch.pos;
  const now = animTime;

  if (ch.powerMode) {
    ctx.strokeStyle = pos.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6 + Math.sin(now / 80) * 0.3;
    ctx.beginPath();
    ctx.arc(ch.x, ch.y - 64, 36 + Math.sin(now / 130) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = "bold 11px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fde68a";
    ctx.fillText("重錘待發", ch.x, ch.y - 122);
  }

  if (ch.wallOn) {
    const dir = isPlayer ? 1 : -1;
    const wx = ch.x + dir * 22;
    ctx.fillStyle = "rgba(167,139,250,0.22)";
    ctx.fillRect(wx - 20, ch.y - 152, 40, 154);
    ctx.strokeStyle = "#c4b5fd";
    ctx.lineWidth = 2;
    ctx.strokeRect(wx - 20, ch.y - 152, 40, 154);
  }

  if (ch.powerFlash > 0) {
    const t = 1 - ch.powerFlash / 0.4;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4;
    ctx.globalAlpha = ch.powerFlash / 0.4;
    ctx.beginPath();
    ctx.arc(ch.x, ch.y - 70, 30 + t * 90, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (ch.wallPop > 0) {
    const t = 1 - ch.wallPop / 0.4;
    ctx.strokeStyle = "rgba(196,181,253,0.9)";
    ctx.lineWidth = 5;
    ctx.globalAlpha = ch.wallPop / 0.4;
    ctx.beginPath();
    ctx.arc(ch.x, ch.y - 130, 20 + t * 100, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawBall() {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, clamp(ball.y, -60, 800), ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#93a0bd";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r * 0.85, -1.2, 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r * 0.7, 0.9, 2.4);
  ctx.stroke();
}

function drawParticles() {
  for (const p of particles) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawScoredMsg() {
  if (!scoredMsg) return;
  const a = Math.max(0, 1 - scoredMsg.t / 1.2);
  ctx.globalAlpha = a;
  ctx.font = "bold 46px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = scoredMsg.color;
  ctx.fillText(scoredMsg.text, W / 2, H / 2 - 130);
  ctx.globalAlpha = 1;
}

function drawServeBall() {
  if (state !== "serve") return;
  const s = server === "player" ? player : cpu;
  const cy = 410 + Math.sin(stateTimer * Math.PI * 2) * 3;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(s.x, cy, ball.r, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawNet();
  drawPlayer(player, true);
  drawPlayer(cpu, false);
  drawSkillFx(player, true);
  drawSkillFx(cpu, false);
  if (state === "serve") drawServeBall();
  else drawBall();
  drawParticles();
  drawScoredMsg();
}

let lastTime = performance.now();
let animTime = 0;

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  animTime += dt * 1000;
  if (state !== "menu" && state !== "over") {
    update(dt);
  }
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = true;
  if (k === "ArrowRight" || k === "d" || k === "D") keys.right = true;
  if (k === "ArrowUp" || k === " " || k === "w" || k === "W") {
    keys.jump = true;
    if (state === "rally" || state === "serve") jumpReturned(player);
    if (e.preventDefault) e.preventDefault();
  }
  if (k === "Shift" || k === "e" || k === "E") {
    useSkill(player, true);
  }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(k)) {
    if (e.preventDefault) e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  const k = e.key;
  if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = false;
  if (k === "ArrowRight" || k === "d" || k === "D") keys.right = false;
  if (k === "ArrowUp" || k === " " || k === "w" || k === "W") keys.jump = false;
});

function bindHold(btn, key) {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    keys[key] = true;
    if (key === "jump") {
      if (state === "serve" && server === "player") doServe();
      else jumpReturned(player);
    }
  });
  btn.addEventListener("pointerup", () => { keys[key] = false; });
  btn.addEventListener("pointerleave", () => { keys[key] = false; });
  btn.addEventListener("pointercancel", () => { keys[key] = false; });
}

bindHold(btnLeft, "left");
bindHold(btnRight, "right");
bindHold(btnJump, "jump");

btnSkill.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  useSkill(player, true);
});

posCards.forEach((card, idx) => {
  card.addEventListener("click", () => {
    const posId = POS_IDS[idx];
    playerPosId = posId;
    posCards.forEach((el) => {
      if (el === card) el.classList.add("selected");
      else el.classList.remove("selected");
    });
    player = makeChar(player.x, posId);
    syncSkillBar();
    updateHud();
  });
});

startBtn.addEventListener("click", () => {
  if (state === "over" || state === "menu") startGame();
  overlay.classList.add("hidden");
});

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function tone(freq, dur, type = "sine", vol = 0.3, freqEnd) {
  if (!soundOn || !audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function playHit() {
  tone(300, 0.08, "triangle", 0.35, 480);
  tone(150, 0.05, "sine", 0.12, 90);
}

function playNet() {
  tone(110, 0.12, "square", 0.2, 70);
}

function playServe() {
  tone(240, 0.12, "sine", 0.25, 360);
}

function playSkill() {
  tone(320, 0.12, "sine", 0.26, 760);
}

function playBlock() {
  tone(160, 0.1, "square", 0.24, 80);
  tone(80, 0.08, "sine", 0.14, 50);
}

function playScore(isPlayer) {
  if (isPlayer) {
    tone(523, 0.12, "sine", 0.3);
    tone(784, 0.18, "sine", 0.3, 0);
  } else {
    tone(220, 0.22, "sawtooth", 0.22, 110);
  }
}

function playFanfare() {
  tone(523, 0.14, "sine", 0.3);
  setTimeout(() => tone(659, 0.14, "sine", 0.3), 140);
  setTimeout(() => tone(784, 0.24, "sine", 0.3), 280);
}

soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? "🔊" : "🔇";
  initAudio();
});

resetMatch();
posGrid.classList.remove("hidden");
overlay.classList.remove("hidden");
overlayTitle.textContent = "🏐 沙灘排球";
overlayText.textContent = "選擇你要站的位置";
startBtn.textContent = "開始遊戲";
syncSkillBar();
requestAnimationFrame(loop);