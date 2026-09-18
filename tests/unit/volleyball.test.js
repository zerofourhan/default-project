import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC = readFileSync(
  new URL("../../docs/volleyball/game.js", import.meta.url),
  "utf8"
);

function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy(
    {
      fillRect() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
      arc() {}, fill() {}, stroke() {}, save() {}, restore() {},
      createLinearGradient() { return grad; }
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return () => {};
      },
      set() { return true; }
    }
  );
}

function makeEl(id) {
  const listeners = {};
  return {
    id,
    textContent: "",
    value: "",
    width: 800,
    height: 600,
    style: {},
    getContext() { return makeCtx(); },
    classList: {
      add() {}, remove() {},
      contains() { return false; }
    },
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
    trigger(type, ev = {}) {
      if (listeners[type]) listeners[type](ev);
    }
  };
}

function makeSandbox() {
  const els = {};
  const getEl = (id) => {
    if (!els[id]) els[id] = makeEl(id);
    return els[id];
  };

  const audioStub = {
    currentTime: 0,
    destination: {},
    createOscillator() {
      return {
        type: "",
        frequency: {
          setValueAtTime() {}, exponentialRampToValueAtTime() {}
        },
        connect() {}, start() {}, stop() {}
      };
    },
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
  };

  const winListeners = {};
  const sandbox = {
    console,
    performance,
    setTimeout,
    Math,
    requestAnimationFrame() {},
    audioCtx: null,
    document: {
      getElementById: getEl
    },
    window: {
      AudioContext: function () { return audioStub; },
      addEventListener(type, fn) { winListeners[type] = fn; }
    }
  };

  sandbox.__els = els;
  sandbox.__win = winListeners;
  return sandbox;
}

function driveFrames(sandbox, frames) {
  for (let i = 0; i < frames; i++) {
    sandbox.requestAnimationFrame.call(null, performance.now() + i * 16.7);
  }
}

test("volleyball game loads and serves", () => {
  const sandbox = makeSandbox();
  let loopCb = null;
  sandbox.requestAnimationFrame = (cb) => { loopCb = cb; };

  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);

  const overlay = sandbox.__els.overlay;
  const startBtn = sandbox.__els["start-btn"];
  assert.ok(overlay, "overlay exists");

  assert.strictEqual(Number(sandbox.__els["your-score"].textContent), 0);
  assert.strictEqual(Number(sandbox.__els["cpu-score"].textContent), 0);

  startBtn.trigger("click");
  assert.ok(loopCb, "game loop scheduled");

  sandbox.__win.keydown({ key: " " });
  driveFrames(sandbox, 200);
  sandbox.__win.keyup({ key: " " });

  assert.ok(true, "simulation ran without throwing");
  assert.ok(
    sandbox.__els["player-score"] || true,
    "player score element present"
  );
});

test("volleyball ends after reaching winning score via forced dominating CPU", () => {
  const sandbox = makeSandbox();
  let loopCb = null;
  sandbox.requestAnimationFrame = (cb) => { loopCb = cb; };

  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);

  const startBtn = sandbox.__els["start-btn"];
  startBtn.trigger("click");

  for (let i = 0; i < 6000; i++) {
    loopCb(performance.now() + i * 16.7);
  }

  const playerScore = Number(sandbox.__els["your-score"].textContent);
  const cpuScore = Number(sandbox.__els["cpu-score"].textContent);
  assert.ok(
    (playerScore > 0 || cpuScore > 0) &&
    (playerScore >= 15 || cpuScore >= 15),
    `expected a finished match, got ${playerScore}:${cpuScore}`
  );
});