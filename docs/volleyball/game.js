(function () {
  "use strict";

  var DT = 1 / 60;
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var W = canvas.width;
  var H = canvas.height;
  var GROUND_Y = H - 60;
  var NET_X = W / 2;
  var NET_H = 230;
  var NET_TOP = GROUND_Y - NET_H;
  var WIN_SCORE = 15;
  var BALL_R = 16;
  var GRAVITY = 1300;
  var DRAG = 0.2;
  var MOVE_SPEED = 380;

  var yourPosId = "spiker";
  var yourMatePosId = "setter";
  var cpuPosId = "blocker";
  var cpuMatePosId = "setter";

  var keys = {};
  var touchDown = {};

  var POS_MAP = {
    spiker: { name: "主攻手", icon: "⚡", skillIcon: "⚡", skillName: "加速扣殺" },
    blocker: { name: "副攻手", icon: "🛡️", skillIcon: "🛡️", skillName: "攔網" },
    setter: { name: "舉球員", icon: "🎯", skillIcon: "🎯", skillName: "精準托球" }
  };

  function el(id) { return document.getElementById(id); }

  function makeChar(x, posId, side, label) {
    return {
      x: x, y: GROUND_Y, vx: 0, vy: 0, onGround: true, posId: posId,
      side: side, label: label
    };
  }

  var your = makeChar(300, yourPosId, "player", "你");
  var yourMate = makeChar(NET_X - 150, yourMatePosId, "player", "隊友");
  var cpu = makeChar(W - 300, cpuPosId, "cpu", "敵將");
  var cpuMate = makeChar(NET_X + 150, cpuMatePosId, "cpu", "敵友");

  var ball = {
    x: 0, y: 0, vx: 0, vy: 0, state: "ground", side: null,
    lastHitter: null, hitCd: 0, prevX: 0, spin: 0, rot: 0
  };

  var state = "overlay";
  var server = "player";
  var yourScore = 0;
  var cpuScore = 0;
  var rallyTouchesPlayer = 0;
  var rallyTouchesCpu = 0;
  var serveTimer = 0;
  var servingLock = false;

  var startBtn = el("start-btn");

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function info(id) { return POS_MAP[id]; }

  function updateHud() {
    if (el("your-score")) el("your-score").textContent = String(yourScore);
    if (el("cpu-score")) el("cpu-score").textContent = String(cpuScore);
    if (el("your-pos")) el("your-pos").textContent = info(yourPosId).name;
    if (el("cpu-pos")) el("cpu-pos").textContent = info(cpuPosId).name;
    if (el("your-skill-icon")) el("your-skill-icon").textContent = info(yourPosId).skillIcon;
    if (el("your-skill-name")) el("your-skill-name").textContent = info(yourPosId).skillName;
    if (el("cpu-skill-icon")) el("cpu-skill-icon").textContent = info(cpuPosId).skillIcon;
    if (el("cpu-skill-name")) el("cpu-skill-name").textContent = info(cpuPosId).skillName;
  }

  function setServe() {
    state = "serve";
    serveTimer = 0;
    if (el("serve-indicator")) el("serve-indicator").textContent = server === "player" ? "你發球" : "電腦發球";
  }

  function resetMatch() {
    yourScore = 0;
    cpuScore = 0;
    your = makeChar(300, yourPosId);
    yourMate = makeChar(170, yourMatePosId);
    cpu = makeChar(W - 300, cpuPosId);
    cpuMate = makeChar(W - 170, cpuMatePosId);
    setServe();
    updateHud();
  }

  function pauseOrResume() {
    var p = el("pause-overlay");
    if (!p) return;
    if (state === "paused") {
      state = "rally";
      p.classList.add("hidden");
    } else {
      state = "paused";
      p.classList.remove("hidden");
    }
  }

  function showOverlay(title, text, showStart) {
    if (el("overlay-title")) el("overlay-title").textContent = title;
    if (el("overlay-text")) el("overlay-text").textContent = text;
    if (el("overlay")) el("overlay").classList.remove("hidden");
    if (startBtn) {
      if (showStart) startBtn.classList.remove("hidden");
      else startBtn.classList.add("hidden");
    }
  }

  function hideOverlay() { if (el("overlay")) el("overlay").classList.add("hidden"); }

  function launchTo(tx, ty, t) {
    ball.vx = (tx - ball.x) / t;
    ball.vy = (ty - ball.y - 0.5 * GRAVITY * t * t) / t;
  }

  function doPlayerServe() {
    ball.x = clamp(your.x, 40, NET_X - 260);
    ball.y = GROUND_Y - 150;
    ball.vx = rnd(560, 660);
    ball.vy = -(540 + rnd(0, 80));
    ball.side = "cpu";
    ball.lastHitter = null;
    ball.spin = 5;
    state = "rally";
    if (el("status")) el("status").textContent = "電腦接發球…";
  }

  function doCpuServe() {
    ball.x = clamp(cpu.x, NET_X + 260, W - 40);
    ball.y = GROUND_Y - 150;
    ball.vx = -rnd(560, 660);
    ball.vy = -(540 + rnd(0, 80));
    ball.side = "player";
    ball.lastHitter = null;
    ball.spin = -5;
    state = "rally";
    if (el("status")) el("status").textContent = "快按 Q 接一傳！";
  }

  function receiveBall(byPlayer) {
    var tx = byPlayer ? NET_X + rnd(-260, -160) : NET_X + rnd(160, 260);
    launchTo(tx, GROUND_Y - 460, 1.3);
    ball.spin = byPlayer ? 4 : -4;
    ball.hitCd = 0.4;
    if (byPlayer) {
      rallyTouchesPlayer++;
      if (el("status")) el("status").textContent = "接一傳！接著等舉球/扣球";
    } else {
      rallyTouchesCpu++;
    }
  }

  function setBall(byPlayer) {
    var tx = NET_X + (byPlayer ? -60 : 60);
    launchTo(tx, GROUND_Y - 380, 1.15);
    ball.spin = byPlayer ? 2 : -2;
    ball.hitCd = 0.45;
    if (byPlayer) rallyTouchesPlayer++;
    else rallyTouchesCpu++;
  }

  function spikeBall(byPlayer) {
    var dir = byPlayer ? 1 : -1;
    var base = NET_X + dir * rnd(50, 80);
    launchTo(base + dir * rnd(90, 260), GROUND_Y, 0.85);
    ball.hitCd = 0.5;
    ball.spin = dir * 6;
    if (byPlayer) rallyTouchesPlayer++;
    else rallyTouchesCpu++;
  }

  function near(a, b) {
    var dx = Math.abs(a.x - b.x);
    var dy = Math.abs(a.y - b.y);
    return dx < 160 && dy < 460;
  }

  function tryPlayerAction() {
    if (state !== "rally") return;

    var left = keys["ArrowLeft"] || keys["a"] || keys["A"] || touchDown["btn-left"];
    var right = keys["ArrowRight"] || keys["d"] || keys["D"] || touchDown["btn-right"];
    var jumpKey = keys[" "] || keys["ArrowUp"] || keys["w"] || keys["W"] || touchDown["btn-jump"];
    var hitKey = (keys["e"] || keys["E"] || touchDown["btn-hit"]) && !servingLock;
    var recvKey = (keys["q"] || keys["Q"] || touchDown["btn-receive"]) && !servingLock;

    if (left) your.x -= MOVE_SPEED * DT;
    if (right) your.x += MOVE_SPEED * DT;
    your.x = clamp(your.x, 40, NET_X - 40);

    if (your.onGround && jumpKey) {
      your.vy = -900;
      your.onGround = false;
    }

    if (recvKey && rallyTouchesPlayer === 0 && ball.x < NET_X + 60 && near(your, ball)) {
      receiveBall(true);
    } else if (hitKey && rallyTouchesPlayer === 1 && ball.x < NET_X + 60 && near(your, ball)) {
      setBall(true);
    } else if (hitKey && rallyTouchesPlayer === 2 && ball.x < NET_X + 60 && near(your, ball)) {
      spikeBall(true);
    }
  }

  function moveCpuDefense() {
    cpu.x += (ball.x - cpu.x) * 0.06;
    cpu.x = clamp(cpu.x, NET_X, W - 60);
  }

  function cpuAi() {
    if (state !== "rally") return;
    var onOurSide = ball.x >= NET_X;
    if (!onOurSide) {
      moveCpuDefense();
      return;
    }

    if (rallyTouchesCpu === 0) {
      moveCpuToBall(cpu);
      if (nearCpu(cpu, ball) && ball.vy > 0) {
        receiveBall(false);
      }
    } else if (rallyTouchesCpu === 1) {
      cpuMate.x += (ball.x - cpuMate.x) * 0.1;
      cpuMate.x = clamp(cpuMate.x, NET_X + 40, W - 60);
      if (nearCpu(cpuMate, ball)) {
        setBall(false);
      }
    } else if (rallyTouchesCpu === 2) {
      cpu.x += (ball.x - cpu.x) * 0.1;
      cpu.x = clamp(cpu.x, NET_X + 40, W - 60);
      if (nearCpu(cpu, ball)) {
        spikeBall(false);
      }
    }
  }

  function moveCpuToBall(c) {
    var dx = ball.x - c.x;
    if (Math.abs(dx) > 30) {
      c.x += (dx > 0 ? 1 : -1) * 420 * DT;
    }
    c.x = clamp(c.x, NET_X, W - 60);
  }

  function nearCpu(a, b) {
    var dx = Math.abs(a.x - b.x);
    var dy = Math.abs(a.y - b.y);
    return dx < 210 && dy < 540;
  }

  function stepPhysics() {
    if (state !== "rally") return;
    ball.prevX = ball.x;
    ball.x += ball.vx * DT;
    ball.vx *= Math.max(0, 1 - DRAG * DT);
    ball.vy += GRAVITY * DT;
    ball.y += ball.vy * DT;

    if (ball.y < 40) { ball.y = 40; ball.vy = Math.abs(ball.vy) * 0.6; }

    var crossed = (ball.prevX <= NET_X && ball.x > NET_X) || (ball.prevX >= NET_X && ball.x < NET_X);
    if (crossed && ball.y > NET_TOP - 6) {
      ball.x = NET_X + (ball.x > NET_X ? 1 : -1) * (BALL_R + 4);
      ball.vx = -ball.vx * 0.3;
      ball.vy = -Math.abs(ball.vy) * 0.5;
      ball.side = ball.x < NET_X ? "player" : "cpu";
    } else {
      ball.side = ball.x < NET_X ? "player" : "cpu";
    }

    ball.rot += ball.spin * DT;

    if (ball.y > GROUND_Y - 6) {
      ball.y = GROUND_Y;
      ball.vy = 0;
      ball.vx = 0;
      groundDecision();
    }
  }

  function stepMates() {
    if (yourMate && state === "rally") {
      if (rallyTouchesPlayer === 1) {
        yourMate.x += (ball.x - yourMate.x) * 0.06;
      } else if (rallyTouchesPlayer === 2) {
        yourMate.x += (NET_X - 80 - yourMate.x) * 0.04;
      }
    }
    yourMate.x = clamp(yourMate.x, 60, NET_X - 70);
    cpuMate.x = clamp(cpuMate.x, NET_X + 70, W - 60);
  }

  function stepChar(c) {
    c.y += c.vy * DT;
    c.vy += GRAVITY * DT;
    if (c.y > GROUND_Y) { c.y = GROUND_Y; c.vy = 0; c.onGround = true; }
  }

  function groundDecision() {
    if (ball.side === "player") cpuScore++;
    else yourScore++;
    afterRallyPoint();
    updateHud();
  }

  function afterRallyPoint() {
    var p = yourScore >= WIN_SCORE;
    var c = cpuScore >= WIN_SCORE;
    if (p || c) {
      state = "end";
      showOverlay(p ? "🏆 你贏了！" : "🤖 電腦贏了", p ? "2v2 全場制霸" : "再多練幾場", true);
      return;
    }
    server = server === "player" ? "cpu" : "player";
    setServe();
    if (el("status")) el("status").textContent = server === "player" ? "你發球 · 按 F" : "電腦發球…";
    if (server === "cpu") doCpuServe();
  }

  function drawCourt() {
    ctx.fillStyle = "#f2ddb0";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#123c66";
    ctx.fillRect(0, 0, W, GROUND_Y);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(NET_X, GROUND_Y);
    ctx.lineTo(NET_X, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();
  }

  function drawNet() {
    var y0 = NET_TOP;
    ctx.fillStyle = "#26313f";
    ctx.fillRect(NET_X - 10, y0 - 10, 20, NET_H + 10);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    for (var y = y0; y <= GROUND_Y; y += 14) {
      ctx.beginPath();
      ctx.moveTo(NET_X - 8, y);
      ctx.lineTo(NET_X + 8, y);
      ctx.stroke();
    }
  }

  function teamColor(c) {
    var side = c.side;
    var main, dark, edge;
    if (side === "player") {
      main = c === your ? "#2f7df6" : "#20b2aa";
      dark = c === your ? "#1b4fa8" : "#0f8378";
      edge = "#bfe3ff";
    } else {
      main = c === cpu ? "#f0433a" : "#ff8c1a";
      dark = c === cpu ? "#a51f17" : "#b75e00";
      edge = "#ffd9d0";
    }
    return { main: main, dark: dark, edge: edge };
  }

  function drawChar(c) {
    var t = teamColor(c);
    var headR = 15;
    var hx = c.x;
    var vy = c.y - 68;
    if (t.side === "player") {
      ctx.fillStyle = t.dark;
      ctx.fillRect(hx - 18, vy + 8, 36, 62);
      ctx.fillStyle = t.main;
      ctx.fillRect(hx - 14, vy + 12, 28, 54);
    } else {
      ctx.fillStyle = t.dark;
      ctx.fillRect(hx - 18, vy + 8, 36, 62);
      ctx.fillStyle = t.main;
      ctx.fillRect(hx - 17, vy + 12, 34, 54);
    }
    ctx.fillStyle = "#ffe3c0";
    ctx.beginPath();
    ctx.arc(hx, vy + 10, headR, 0, 7);
    ctx.fill();

    var pos = info(c.posId);
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(pos.icon, hx, vy - 2);

    ctx.font = "bold 13px sans-serif";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeText(c.label, hx, vy - 18);
    ctx.fillStyle = t.edge;
    ctx.fillText(c.label, hx, vy - 18);

    if (c === your) {
      ctx.strokeStyle = "rgba(255,255,60,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hx, c.y - 34, 34, 0, 7);
      ctx.stroke();
      ctx.font = "bold 15px sans-serif";
      ctx.fillStyle = "#fff34f";
      ctx.fillText("▼", hx, c.y - 92);
    }
  }

  function drawBall() {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rot);
    ctx.fillStyle = "#f9b234";
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#d98a1f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(8, 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;
    drawCourt();
    drawNet();
    drawChar(yourMate);
    drawChar(your);
    drawChar(cpuMate);
    drawChar(cpu);
    drawBall();
  }

  function loop() {
    if (state === "rally") {
      tryPlayerAction();
      stepChar(your);
      stepMates();
      cpuAi();
      stepPhysics();
      stepChar(cpu);
    } else if (state === "serve") {
      if (server === "player" && (keys["f"] || keys["F"] || touchDown["btn-serve"])) {
        doPlayerServe();
      } else {
        serveTimer++;
        if (serveTimer > 70) {
          if (server === "cpu") doCpuServe();
          else doPlayerServe();
        }
      }
    }
    if (state !== "paused") {
      draw();
    }
    requestAnimationFrame(loop);
  }

  function init() {
    resetMatch();
    updateHud();
    showOverlay("沙灘排球 2v2", "方向鍵/A·D 移動 · F 發球 · 空白跳 · Q 接一傳 · E 扣/托 · ESC 選單。主攻⚡副攻🛡️舉球🎯", false);
  }

  function tieMate() {
    if (yourPosId === "setter") {
      if (yourMatePosId !== "spiker" && yourMatePosId !== "blocker") yourMatePosId = "spiker";
    } else {
      yourMatePosId = "setter";
    }
    cpuPosId = yourPosId === "setter" ? "blocker" : "setter";
    cpuMatePosId = yourPosId === "setter" ? "spiker" : "setter";
    yourMate = makeChar(170, yourMatePosId);
    cpu = makeChar(W - 300, cpuPosId);
    cpuMate = makeChar(W - 170, cpuMatePosId);
    updateHud();
  }

  function bindPosGrid() {
    var ids = ["spiker", "blocker", "setter"];
    for (var i = 0; i < ids.length; i++) {
      (function (id) {
        var card = el("pos-" + id);
        if (card && card.addEventListener) {
          card.addEventListener("click", function () {
            yourPosId = id;
            var all = ["pos-spiker", "pos-blocker", "pos-setter"];
            for (var j = 0; j < all.length; j++) {
              var c = el(all[j]);
              if (c && c.classList) {
                if (all[j] === "pos-" + id) c.classList.add("selected");
                else c.classList.remove("selected");
              }
            }
            if (id === "setter") {
              if (el("mate-overlay")) el("mate-overlay").classList.remove("hidden");
            } else {
              if (el("mate-overlay")) el("mate-overlay").classList.add("hidden");
            }
          });
        }
      })(ids[i]);
    }
  }

  function bindMateGrid() {
    var ids = ["spiker", "blocker"];
    for (var i = 0; i < ids.length; i++) {
      (function (id) {
        var card = el("mate-" + id);
        if (card && card.addEventListener) {
          card.addEventListener("click", function () {
            yourMatePosId = id;
            if (el("mate-overlay")) el("mate-overlay").classList.add("hidden");
            hideOverlay();
            resetMatch();
            doPlayerServe();
          });
        }
      })(ids[i]);
    }
  }

  function bindButtons() {
    var jump = el("btn-jump");
    var hit = el("btn-hit");
    var recv = el("btn-receive");
    var left = el("btn-left");
    var right = el("btn-right");
    var serve = el("btn-serve");
    var btnList = [jump, hit, recv, left, right, serve];
    for (var i = 0; i < btnList.length; i++) {
      (function (b) {
        if (b && b.addEventListener) {
          b.addEventListener("pointerdown", function (e) {
            if (e && e.preventDefault) e.preventDefault();
            touchDown[b.id] = true;
          });
          b.addEventListener("pointerup", function () { delete touchDown[b.id]; });
          b.addEventListener("pointercancel", function () { delete touchDown[b.id]; });
        }
      })(btnList[i]);
    }
  }

  function bindMenu() {
    var menu = el("menu-btn");
    if (menu && menu.addEventListener) menu.addEventListener("click", pauseOrResume);
    var resume = el("resume-btn");
    if (resume && resume.addEventListener) resume.addEventListener("click", pauseOrResume);
    var restart = el("restart-btn");
    if (restart && restart.addEventListener) {
      restart.addEventListener("click", function () {
        if (el("pause-overlay")) el("pause-overlay").classList.add("hidden");
        resetMatch();
        doPlayerServe();
      });
    }
  }

  function boot() {
    bindPosGrid();
    bindMateGrid();
    bindButtons();
    bindMenu();
    if (startBtn && startBtn.addEventListener) {
      startBtn.addEventListener("click", function () {
        tieMate();
        hideOverlay();
        resetMatch();
        doPlayerServe();
      });
    }
    init();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", function (e) {
    var k = e.key || "";
    if (k === "Escape") pauseOrResume();
    keys[k] = true;
  });
  window.addEventListener("keyup", function (e) {
    var k = e.key || "";
    keys[k] = false;
  });

  boot();
})();
