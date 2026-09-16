/** Shared game rules kept free of browser APIs so they can be unit tested. */

export const TEAM_META = {
  redBean: { name: "豆沙隊", color: "#d95663", dark: "#94313e", emblem: "🫘" },
  yolk: { name: "蛋黃隊", color: "#f0a62e", dark: "#9a5a0b", emblem: "🌕" },
  matcha: { name: "抹茶隊", color: "#4f9b68", dark: "#27643d", emblem: "🍵" }
};

export const STORAGE_PREFIX = "mooncake-feast-race";
export const GAME_VERSION = 1;

/** Clamp untrusted numeric input to an integer within a known range. */
export function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

/** Create a fresh lobby state. */
export function createDefaultState() {
  return {
    version: GAME_VERSION,
    round: 1,
    status: "lobby",
    countdownEndsAt: null,
    startedAt: null,
    finishedAt: null,
    finishAnimationEndsAt: null,
    winner: null,
    settings: { bitesPerCake: 24, mooncakeCount: 5, countdownSeconds: 5 },
    teams: Object.fromEntries(Object.keys(TEAM_META).map((teamId) => [teamId, { biteUnits: 0 }])),
    players: {},
    boon: null,
    nextBoonAt: null
  };
}

/** Normalize data read from Firebase/localStorage before it reaches the UI. */
export function normalizeState(value) {
  if (!value || value.version !== GAME_VERSION) return createDefaultState();
  const base = createDefaultState();
  const players = Object.fromEntries(
    Object.entries(value.players || {})
      .filter(([, player]) => player && typeof player === "object")
      .map(([id, player]) => [id, {
        name: String(player.name || "隊員").slice(0, 16),
        team: TEAM_META[player.team] ? player.team : null,
        taps: clampNumber(player.taps, 0, 0, 1_000_000),
        joinedAt: clampNumber(player.joinedAt, 0, 0, Number.MAX_SAFE_INTEGER)
      }])
  );
  const boon = value.boon && TEAM_META[value.boon.team] ? {
    team: value.boon.team,
    amount: clampNumber(value.boon.amount, 0, 0, 100_000),
    until: clampNumber(value.boon.until, 0, 0, Number.MAX_SAFE_INTEGER)
  } : null;

  return {
    ...base,
    ...value,
    version: GAME_VERSION,
    round: clampNumber(value.round, 1, 1, 100_000),
    status: ["lobby", "countdown", "running", "finishing", "finished"].includes(value.status) ? value.status : "lobby",
    countdownEndsAt: clampNumber(value.countdownEndsAt, 0, 0, Number.MAX_SAFE_INTEGER) || null,
    startedAt: clampNumber(value.startedAt, 0, 0, Number.MAX_SAFE_INTEGER) || null,
    finishedAt: clampNumber(value.finishedAt, 0, 0, Number.MAX_SAFE_INTEGER) || null,
    finishAnimationEndsAt: clampNumber(value.finishAnimationEndsAt, 0, 0, Number.MAX_SAFE_INTEGER) || null,
    winner: TEAM_META[value.winner] ? value.winner : null,
    settings: {
      bitesPerCake: clampNumber(value.settings?.bitesPerCake, 24, 5, 100),
      mooncakeCount: clampNumber(value.settings?.mooncakeCount, 5, 1, 8),
      countdownSeconds: clampNumber(value.settings?.countdownSeconds, 5, 1, 20)
    },
    teams: Object.fromEntries(Object.keys(TEAM_META).map((teamId) => [teamId, {
      biteUnits: clampNumber(value.teams?.[teamId]?.biteUnits, 0, 0, 100_000_000)
    }])),
    players,
    boon,
    nextBoonAt: clampNumber(value.nextBoonAt, 0, 0, Number.MAX_SAFE_INTEGER) || null
  };
}

/** Derive all presentation values from a team's single bite counter. */
export function teamMetrics(state, teamId) {
  const units = state.teams[teamId]?.biteUnits || 0;
  const { bitesPerCake, mooncakeCount } = state.settings;
  const totalUnits = bitesPerCake * mooncakeCount;
  const cappedUnits = Math.min(units, totalUnits);
  const eatenCakes = Math.min(mooncakeCount, Math.floor(cappedUnits / bitesPerCake));
  const currentCakeProgress = eatenCakes >= mooncakeCount ? 1 : (cappedUnits % bitesPerCake) / bitesPerCake;
  return {
    units,
    totalUnits,
    eatenCakes,
    currentCakeProgress,
    currentCakeIndex: Math.min(eatenCakes, mooncakeCount - 1),
    progress: Math.round((cappedUnits / totalUnits) * 100),
    remainingBites: Math.max(0, totalUnits - cappedUnits)
  };
}

/** Exact bite threshold for winning a round. */
export function unitsToWin(state) {
  return state.settings.bitesPerCake * state.settings.mooncakeCount;
}

/** Reset scores while retaining joined players and their team assignments. */
export function resetRoundState(state) {
  state.round += 1;
  state.status = "lobby";
  state.countdownEndsAt = null;
  state.startedAt = null;
  state.finishedAt = null;
  state.finishAnimationEndsAt = null;
  state.winner = null;
  state.boon = null;
  state.nextBoonAt = null;
  Object.values(state.teams).forEach((team) => { team.biteUnits = 0; });
  Object.values(state.players).forEach((player) => { player.taps = 0; });
}

/** Assign players evenly and deterministically by join time. */
export function assignTeams(state) {
  const teamIds = Object.keys(TEAM_META);
  Object.entries(state.players)
    .sort(([, left], [, right]) => Number(left.joinedAt) - Number(right.joinedAt))
    .forEach(([, player], index) => {
      player.team = teamIds[index % teamIds.length];
      player.taps = 0;
    });
}

/** Return the active trailing team when it is at least one cake behind. */
export function catchUpTarget(state) {
  const activeTeams = Object.keys(TEAM_META).filter((teamId) =>
    Object.values(state.players).some((player) => player.team === teamId)
  );
  if (activeTeams.length < 2) return null;
  const sorted = activeTeams.slice().sort((left, right) =>
    state.teams[left].biteUnits - state.teams[right].biteUnits || left.localeCompare(right)
  );
  const trailing = sorted[0];
  const leading = sorted[sorted.length - 1];
  return state.teams[leading].biteUnits - state.teams[trailing].biteUnits >= state.settings.bitesPerCake
    ? trailing
    : null;
}
