(function () {
  "use strict";

  var DT = 1 / 60;
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var W = canvas.width;
  var H = canvas.height;
  var GROUND_Y = H - 60;
  var NET_X = W / 2;
  var WIN_SCORE = 15;
  var BALL_R = 16;
  var GRAVITY = 2000;

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

  function makeChar(x, posId) {
    return {
      x: x, y: GROUND_Y, vx: 0, vy: 0, onGround: true, posId: posId
    };
  }

  var your = makeChar(300, yourPosId);
  var yourMate = makeChar(170, yourMatePosId);
  var cpu = makeChar(W - 300, cpuPosId);
  var cpuMate = makeChar(W - 170, cpuMatePosId);

  var ball = {
    x: 0, y: 0, vx: 0, vy: 0, state: "ground", side: null, lastHitter: null, hitCd: 0
  };

  var state = "overlay";
  var server = "player";
  var yourScore = 0;
  var cpuScore = 0;
  var rallyTouchesPlayer = 0;
  var rallyTouchesCpu = 0;
  var serveTimer = 0;

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

  function doPlayerServe() {
    ball.x = your.x;
    ball.y = GROUND_Y - 120;
    if (ball.x >= NET_X) { ball.x = NET_X - 60; }
    ball.vx = rnd(80, 160);
    ball.vy = -(820 + rnd(0, 60));
    ball.side = "cpu";
    ball.lastHitter = null;
    state = "rally";
    if (el("status")) el("status").textContent = "電腦接發球…";
  }

  function doCpuServe() {
    ball.x = cpu.x;
    ball.y = GROUND_Y - 120;
    if (ball.x <= NET_X) { ball.x = NET_X + 60; }
    ball.vx = -rnd(80, 180);
    ball.vy = -(860 + rnd(0, 80));
    ball.side = "player";
    ball.lastHitter = null;
    state = "rally";
    if (el("status")) el("status").textContent = "快按 Q 接一傳！";
  }

  function receiveBall(byPlayer) {
    var vx;
    if (byPlayer) {
      vx = -rnd(50, 120);
    } else {
      vx = rnd(20, 80);
    }
    ball.vy = -(900 + rnd(0, 60));
    ball.vx = vx;
    ball.hitCd = 0.4;
    if (byPlayer) {
      rallyTouchesPlayer++;
      if (el("status")) el("status").textContent = "接一傳！接著等舉球/扣球";
    } else {
      rallyTouchesCpu++;
    }
  }

  function setBall(byPlayer) {
    var c = byPlayer ? yourMate : cpuMate;
    ball.x = c.x;
    ball.y = GROUND_Y - 420;
    ball.vy = -(1200 + rnd(0, 100));
    ball.vx = byPlayer ? rnd(-40, 40) : rnd(-20, 40);
    ball.hitCd = 0.45;
    if (byPlayer) rallyTouchesPlayer++;
    else rallyTouchesCpu++;
  }

  function spikeBall(byPlayer) {
    var attacker = byPlayer ? your : cpu;
    var dir = byPlayer ? 1 : -1;
    if (byPlayer) {
      attacker.x = clamp(attacker.x, 30, NET_X - 60);
    } else {
      attacker.x = clamp(attacker.x, NET_X + 40, NET_X + 70);
    }
    if (attacker.x >= NET_X) dir = -1;
    ball.x = attacker.x;
    ball.y = attacker.y - 140;
    ball.vy = byPlayer ? -(950 + rnd(0, 80)) : -(620 + rnd(0, 120));
    ball.vx = dir * (byPlayer ? rnd(360, 560) : rnd(480, 680));
    ball.hitCd = 0.5;
    if (byPlayer) rallyTouchesPlayer++;
    else rallyTouchesCpu++;
  }

  function near(a, b) {
    var dx = Math.abs(a.x - b.x);
    var dy = Math.abs(a.y - b.y);
    return dx < 150 && dy < 300;
  }

  function tryPlayerAction() {
    if (state !== "rally") return;
    var jumpKey = keys[" "] || keys["ArrowUp"] || keys["w"] || keys["W"] || touchDown["btn-jump"];
    var hitKey = keys["e"] || keys["E"] || touchDown["btn-hit"];
    var recvKey = keys["q"] || keys["Q"] || touchDown["btn-receive"];

    if (jumpKey && your.onGround) {
      your.vy = -900;
      your.onGround = false;
    }

    if (recvKey && rallyTouchesPlayer === 0 && near(your, ball)) {
      receiveBall(true);
    } else if (hitKey && rallyTouchesPlayer === 1 && yourPosId === "setter" && near(yourMate, ball)) {
      setBall(true);
    } else if (hitKey && rallyTouchesPlayer === 2 && yourPosId !== "setter" && near(your, ball)) {
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
    return dx < 200 && dy < 400;
  }

  function stepPhysics() {
    if (state !== "rally") return;
    ball.x += ball.vx * DT;
    ball.vy += GRAVITY * DT;
    ball.y += ball.vy * DT;

    if (ball.y < 40) { ball.y = 40; ball.vy = Math.abs(ball.vy) * 0.6; }

    ball.side = ball.x < NET_X ? "player" : "cpu";

    if (ball.y > GROUND_Y - 6) {
      ball.y = GROUND_Y;
      ball.vy = 0;
      groundDecision();
    }
  }

  function stepMates() {
    yourMate.x = your.x - 140;
    yourMate.x = clamp(yourMate.x, 30, NET_X - 40);
    cpuMate.x = cpu.x + 100;
    cpuMate.x = clamp(cpuMate.x, NET_X + 40, W - 30);
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
    if (el("status")) el("status").textContent = server === "player" ? "你發球 · 按 空白" : "電腦發球…";
    if (server === "cpu") doCpuServe();
  }

  function drawCourt() {
    ctx.fillStyle = "#dfc893";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#10233f";
    ctx.fillRect(0, 0, W, GROUND_Y);
  }

  function drawNet() {
    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(NET_X - 8, 0, 16, GROUND_Y);
  }

  function drawChar(c, color) {
    ctx.fillStyle = color;
    ctx.fillRect(c.x - 16, c.y - 64, 32, 64);
    ctx.fillStyle = "#ffe8c2";
    ctx.beginPath();
    ctx.arc(c.x, c.y - 70, 15, 0, 7);
    ctx.fill();
  }

  function drawBall() {
    ctx.fillStyle = "#f9b234";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, 7);
    ctx.fill();
  }

  function draw() {
    if (!ctx) return;
    drawCourt();
    drawNet();
    drawChar(your, "#3b82f6");
    drawChar(yourMate, "#10b981");
    drawChar(cpu, "#ef4444");
    drawChar(cpuMate, "#f97316");
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
      if (server === "player" && (keys[" "] || touchDown["btn-jump"])) {
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
    showOverlay("沙灘排球 2v2", "選主攻/副攻→搭檔固定舉球；選舉球→搭檔由你選。空白=跳、E=扣/托、Q=接一傳、ESC=菜單", false);
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
    var btnList = [jump, hit, recv, left, right];
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
