import test from "node:test";
import assert from "node:assert/strict";
import {
  assignTeams,
  catchUpTarget,
  createDefaultState,
  normalizeState,
  resetRoundState,
  teamMetrics,
  unitsToWin
} from "../src/game-core.js";

test("default game has three teams and a five-cake target", () => {
  const state = createDefaultState();
  assert.equal(Object.keys(state.teams).length, 3);
  assert.equal(state.settings.mooncakeCount, 5);
  assert.equal(unitsToWin(state), 120);
});

test("team metrics follow exact cake boundaries", () => {
  const state = createDefaultState();
  state.teams.redBean.biteUnits = 24;
  assert.deepEqual(teamMetrics(state, "redBean"), {
    units: 24,
    totalUnits: 120,
    eatenCakes: 1,
    currentCakeProgress: 0,
    currentCakeIndex: 1,
    progress: 20,
    remainingBites: 96
  });
  state.teams.redBean.biteUnits = 120;
  const finished = teamMetrics(state, "redBean");
  assert.equal(finished.eatenCakes, 5);
  assert.equal(finished.currentCakeProgress, 1);
  assert.equal(finished.progress, 100);
  assert.equal(finished.remainingBites, 0);
});

test("normalization rejects unknown versions and clamps untrusted fields", () => {
  assert.equal(normalizeState({ version: 999 }).round, 1);
  const source = createDefaultState();
  source.settings.bitesPerCake = -4;
  source.settings.mooncakeCount = 99;
  source.players.bad = { name: "12345678901234567890", team: "unknown", taps: -1, joinedAt: -2 };
  const normalized = normalizeState(source);
  assert.equal(normalized.settings.bitesPerCake, 5);
  assert.equal(normalized.settings.mooncakeCount, 8);
  assert.equal(normalized.players.bad.name.length, 16);
  assert.equal(normalized.players.bad.team, null);
  assert.equal(normalized.players.bad.taps, 0);
});

test("players are assigned evenly in join order", () => {
  const state = createDefaultState();
  state.players = {
    later: { name: "乙", team: null, taps: 9, joinedAt: 20 },
    first: { name: "甲", team: null, taps: 4, joinedAt: 10 },
    third: { name: "丙", team: null, taps: 2, joinedAt: 30 },
    fourth: { name: "丁", team: null, taps: 1, joinedAt: 40 }
  };
  assignTeams(state);
  assert.equal(state.players.first.team, "redBean");
  assert.equal(state.players.later.team, "yolk");
  assert.equal(state.players.third.team, "matcha");
  assert.equal(state.players.fourth.team, "redBean");
  assert.ok(Object.values(state.players).every((player) => player.taps === 0));
});

test("catch-up bonus requires two active teams and a full-cake gap", () => {
  const state = createDefaultState();
  state.players = {
    a: { name: "甲", team: "redBean", taps: 0, joinedAt: 1 },
    b: { name: "乙", team: "yolk", taps: 0, joinedAt: 2 }
  };
  state.teams.yolk.biteUnits = 23;
  assert.equal(catchUpTarget(state), null);
  state.teams.yolk.biteUnits = 24;
  assert.equal(catchUpTarget(state), "redBean");
});

test("next round keeps players and teams but clears scores", () => {
  const state = createDefaultState();
  state.status = "finished";
  state.winner = "redBean";
  state.teams.redBean.biteUnits = 120;
  state.players.a = { name: "甲", team: "redBean", taps: 120, joinedAt: 1 };
  resetRoundState(state);
  assert.equal(state.round, 2);
  assert.equal(state.status, "lobby");
  assert.equal(state.winner, null);
  assert.equal(state.teams.redBean.biteUnits, 0);
  assert.equal(state.players.a.team, "redBean");
  assert.equal(state.players.a.taps, 0);
});
