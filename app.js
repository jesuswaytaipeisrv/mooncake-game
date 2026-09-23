import { firebaseConfig, firebaseDataRoot } from "./firebase-config.js?v=20260916-2";
import { retryFirebaseNetwork } from "./src/firebase-retry.js?v=20260916-3";
import { createGameAudio } from "./src/game-audio.js?v=20260923-1";
import {
  TEAM_META,
  STORAGE_PREFIX,
  GAME_VERSION,
  assignTeams,
  catchUpTarget,
  clampNumber,
  createDefaultState,
  normalizeState,
  resetRoundState,
  teamMetrics,
  unitsToWin
} from "./src/game-core.js";

const FINISH_DELAY_MS = 1300;
const BOON_FIRST_DELAY_MS = 9000;
const BOON_INTERVAL_MS = 11000;
const BOON_BANNER_MS = 3200;
const SPRINT_THRESHOLD = 85;
const query = new URLSearchParams(window.location.search);
const isHost = query.get("view") === "host";
const requestedRoomCode = normalizeRoomCode(query.get("room"));
const roomCode = requestedRoomCode || (isHost ? makeRoomCode() : "MOON2026");

if (isHost && !requestedRoomCode) {
  query.set("room", roomCode);
  window.history.replaceState(null, "", `${window.location.pathname}?${query.toString()}${window.location.hash}`);
}

const localKey = `${STORAGE_PREFIX}:${roomCode}`;
const playerKey = `${STORAGE_PREFIX}:${roomCode}:player`;
let game = createDefaultState();
let currentPlayer = readCurrentPlayer();
let backend = { type: "demo", channel: null };
let firebaseApi = null;
let renderedQrUrl = "";
let shareFeedback = "";
let shareFeedbackTimer = null;
let lastPointerTapAt = 0;
let comboCount = 0;
let lastFxTapAt = 0;
let comboResetTimer = null;
let confettiRound = 0;
let soundSnapshot = null;
let fieldSignature = "";
let fieldRef = null;
const laneRefs = {};

const elements = {
  connectionBadge: document.querySelector("#connection-badge"), roomLabel: document.querySelector("#room-label"),
  soundToggle: document.querySelector("#sound-toggle"), soundToggleIcon: document.querySelector("#sound-toggle-icon"), soundToggleLabel: document.querySelector("#sound-toggle-label"),
  hostView: document.querySelector("#host-view"), playerView: document.querySelector("#player-view"),
  hostHeading: document.querySelector("#host-heading"), hostCopy: document.querySelector("#host-copy"),
  startButton: document.querySelector("#start-button"), autoAssignButton: document.querySelector("#auto-assign-button"), resetButton: document.querySelector("#reset-button"),
  playerJoinLink: document.querySelector("#player-join-link"), copyPlayerLinkButton: document.querySelector("#copy-player-link-button"), joinShareNote: document.querySelector("#join-share-note"), joinQrCode: document.querySelector("#join-qr-code"),
  bitesPerCake: document.querySelector("#bites-per-cake"), mooncakeCount: document.querySelector("#mooncake-count"), countdownSeconds: document.querySelector("#countdown-seconds"),
  hostScoreboard: document.querySelector("#host-scoreboard"), playerCount: document.querySelector("#player-count"), playerRoster: document.querySelector("#player-roster"),
  joinPanel: document.querySelector("#join-panel"), tapPanel: document.querySelector("#tap-panel"), joinForm: document.querySelector("#join-form"),
  playerName: document.querySelector("#player-name"), joinError: document.querySelector("#join-error"), yourTeamLabel: document.querySelector("#your-team-label"),
  tapHeading: document.querySelector("#tap-heading"), tapCounter: document.querySelector("#tap-counter"), teamProgressFill: document.querySelector("#team-progress-fill"),
  tapMessage: document.querySelector("#tap-message"), tapButton: document.querySelector("#tap-button"), changeTeamButton: document.querySelector("#change-team-button"),
  tapFx: document.querySelector("#tap-fx"), comboBadge: document.querySelector("#combo-badge"),
  winnerOverlay: document.querySelector("#winner-overlay"), winnerTitle: document.querySelector("#winner-title"), winnerCopy: document.querySelector("#winner-copy"), winnerNextButton: document.querySelector("#winner-next-button"),
  winnerMvp: document.querySelector("#winner-mvp"), confetti: document.querySelector("#confetti")
};
const gameAudio = createGameAudio();

function normalizeRoomCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

function makeRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => characters[value % characters.length]).join("");
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function readCurrentPlayer() { try { const player = JSON.parse(sessionStorage.getItem(playerKey)); return player?.id ? player : null; } catch { return null; } }
function saveCurrentPlayer(player) { currentPlayer = player; sessionStorage.setItem(playerKey, JSON.stringify(player)); }
function gamePath() { return `${firebaseDataRoot}/${roomCode}`; }
function teamPlayers(teamId) { return Object.values(game.players).filter((player) => player.team === teamId); }

function playerJoinUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "play");
  url.searchParams.set("room", roomCode);
  return url.toString();
}

function renderSoundControl() {
  const supported = gameAudio.isSupported();
  const enabled = supported && gameAudio.isEnabled();
  elements.soundToggle.disabled = !supported;
  elements.soundToggle.classList.toggle("is-on", enabled);
  elements.soundToggle.setAttribute("aria-pressed", String(enabled));
  elements.soundToggleIcon.textContent = enabled ? "🔊" : "🔇";
  elements.soundToggleLabel.textContent = supported ? (enabled ? "音效開" : "音效關") : "不支援音效";
  const action = enabled ? "關閉遊戲音效" : "開啟遊戲音效";
  elements.soundToggle.setAttribute("aria-label", supported ? action : "此瀏覽器不支援遊戲音效");
  elements.soundToggle.title = supported ? action : "此瀏覽器不支援遊戲音效";
}

function playSoundCue(cue, count = 1) {
  const played = cue === "chew"
    ? gameAudio.playChew(count)
    : cue === "sprint"
      ? gameAudio.playSprint()
      : cue === "victory"
        ? gameAudio.playVictory()
        : gameAudio.playReady();
  if (played) elements.soundToggle.dataset.lastEffect = cue;
}

async function toggleGameSound() {
  const enabled = await gameAudio.setEnabled(!gameAudio.isEnabled());
  renderSoundControl();
  elements.soundToggle.dataset.lastEffect = enabled ? "ready" : "muted";
  if (enabled) gameAudio.playReady();
}

function currentSoundSnapshot() {
  const totalBites = Object.keys(TEAM_META).reduce((sum, teamId) => sum + Number(game.teams[teamId]?.biteUnits || 0), 0);
  const sprintTeams = Object.keys(TEAM_META).filter((teamId) => {
    const progress = teamMetrics(game, teamId).progress;
    return progress >= SPRINT_THRESHOLD && progress < 100;
  });
  return {
    round: game.round,
    status: game.status,
    totalBites,
    sprintKey: sprintTeams.length ? `${game.round}:${sprintTeams.join(",")}` : "",
    winnerKey: game.status === "finished" && game.winner ? `${game.round}:${game.winner}` : ""
  };
}

/** 播放狀態轉換音效；即使目前靜音仍更新快照，避免之後補播過期事件。 */
function renderGameSounds() {
  const next = currentSoundSnapshot();
  if (!soundSnapshot) { soundSnapshot = next; return; }
  if (isHost && next.round === soundSnapshot.round && next.status === "running" && next.totalBites > soundSnapshot.totalBites) {
    playSoundCue("chew", next.totalBites - soundSnapshot.totalBites);
  }
  if (next.sprintKey && next.sprintKey !== soundSnapshot.sprintKey) playSoundCue("sprint");
  if (next.winnerKey && next.winnerKey !== soundSnapshot.winnerKey) playSoundCue("victory");
  soundSnapshot = next;
}

function shareMessage() {
  const localHost = ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);
  if (localHost) return { text: "本機網址只供目前電腦測試；正式活動請使用部署 HTTPS 網址並完成 Firebase 設定。", warning: true };
  if (backend.type !== "firebase") return { text: "目前是示範模式：QR 可開啟頁面，但多支手機不會即時同步；請先設定 Firebase。", warning: true };
  return { text: "即時多人模式已啟用，掃描後即可加入此房間。", warning: false };
}

function renderJoinQrCode() {
  const joinUrl = playerJoinUrl();
  elements.playerJoinLink.textContent = joinUrl;
  const message = shareFeedback ? { text: shareFeedback, warning: false } : shareMessage();
  elements.joinShareNote.textContent = message.text;
  elements.joinShareNote.className = `share-note${message.warning ? " is-warning" : ""}`;
  if (renderedQrUrl === joinUrl) return;
  if (typeof window.QRCode !== "function") { elements.joinShareNote.textContent = "QR Code 載入中，請稍候。"; return; }
  renderedQrUrl = joinUrl;
  try {
    elements.joinQrCode.replaceChildren();
    new window.QRCode(elements.joinQrCode, { text: joinUrl, width: 160, height: 160, colorDark: "#25174f", colorLight: "#fffaf0", correctLevel: window.QRCode.CorrectLevel.M });
  } catch {
    renderedQrUrl = "";
    elements.joinShareNote.textContent = "QR Code 無法產生，請使用上方連線網址。";
    elements.joinShareNote.className = "share-note is-warning";
  }
}

async function copyPlayerJoinLink() {
  const joinUrl = playerJoinUrl();
  try {
    await navigator.clipboard.writeText(joinUrl);
  } catch {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = joinUrl;
    temporaryInput.setAttribute("readonly", "");
    temporaryInput.style.position = "fixed";
    temporaryInput.style.opacity = "0";
    document.body.append(temporaryInput);
    temporaryInput.select();
    document.execCommand("copy");
    temporaryInput.remove();
  }
  shareFeedback = "玩家連線網址已複製。";
  window.clearTimeout(shareFeedbackTimer);
  shareFeedbackTimer = window.setTimeout(() => { shareFeedback = ""; renderJoinQrCode(); }, 2200);
  renderJoinQrCode();
}

function crowdMarkup(teamId) {
  const members = teamPlayers(teamId);
  const cap = 6;
  const visibleCount = Math.max(3, Math.min(cap, members.length || 3));
  const visible = Array.from({ length: visibleCount }, (_, index) => {
    const player = members[index];
    const name = player?.name || "隊員";
    return `<span class="crowd-member ${player ? "" : "is-support"}" style="--crowd-shift:${(index % 3) * 2}px" title="${escapeHtml(name)}" aria-label="${escapeHtml(name)}"><span class="crowd-hair"></span><span class="crowd-face"><i></i><i></i><b></b></span><span class="crowd-shirt"></span></span>`;
  }).join("");
  return `${visible}${members.length > cap ? `<strong class="crowd-overflow">+${members.length - cap}</strong>` : ""}`;
}

function mooncakesMarkup() {
  return Array.from({ length: game.settings.mooncakeCount }, (_, index) => `
    <span class="mooncake" data-index="${index}" aria-hidden="true">
      <span class="cake-stamp">福</span><i></i><i></i><i></i><i></i>
    </span>`).join("");
}

function laneSkeleton(teamId) {
  const meta = TEAM_META[teamId];
  return `<section class="lane" data-team="${teamId}" style="--team:${meta.color};--team-dark:${meta.dark};--progress:0" aria-label="${meta.name}吃月餅進度">
    <div class="lane-head">
      <span class="lane-name"><span class="lane-emblem" aria-hidden="true">${meta.emblem}</span>${meta.name}</span>
      <span class="lane-meta"></span><span class="lane-pct">0%</span>
    </div>
    <div class="lane-track">
      <div class="lane-fill"></div>
      <span class="table-spark spark-a">✦</span><span class="table-spark spark-b">✧</span>
      <div class="zone start-zone"><div class="crowd">${crowdMarkup(teamId)}</div><span class="zone-tag">隊員席</span></div>
      <div class="eater" aria-hidden="true"><span class="rabbit-ear left"></span><span class="rabbit-ear right"></span><span class="eater-face"><i></i><i></i><b></b></span><span class="eater-body"></span><span class="eater-cake">🥮</span><span class="crumbs">· · ·</span></div>
      <div class="zone feast-zone"><div class="plate"><div class="mooncake-row">${mooncakesMarkup()}</div></div><span class="zone-tag">月餅盤</span></div>
      <div class="lane-boon" aria-hidden="true"><span class="lane-boon-rabbit">🐇</span><span>月兔加油 +<b>0</b> 口</span></div>
    </div>
  </section>`;
}

function buildFieldSkeleton() {
  const scene = `<div class="field-scene" aria-hidden="true"><span class="scene-moon"><i></i></span><span class="scene-cloud cloud-a"></span><span class="scene-cloud cloud-b"></span><span class="lantern lantern-a">福</span><span class="lantern lantern-b">月</span><span class="sky-star star-a">✦</span><span class="sky-star star-b">·</span><span class="sky-star star-c">✧</span></div>`;
  elements.hostScoreboard.innerHTML = `<section class="field" aria-label="三隊中秋月餅賽場">${scene}<header class="field-head"><div><p class="section-label">MID-AUTUMN NIGHT</p><h3>月下完食賽場</h3></div><span class="field-hint">每按一次吃一口；最先清空月餅盤的隊伍獲勝</span></header><div class="lanes">${Object.keys(TEAM_META).map(laneSkeleton).join("")}</div></section>`;
  fieldRef = elements.hostScoreboard.querySelector(".field");
  Object.keys(TEAM_META).forEach((teamId) => {
    const lane = elements.hostScoreboard.querySelector(`.lane[data-team="${teamId}"]`);
    laneRefs[teamId] = {
      lane,
      fill: lane.querySelector(".lane-fill"),
      pct: lane.querySelector(".lane-pct"),
      meta: lane.querySelector(".lane-meta"),
      eater: lane.querySelector(".eater"),
      cakes: [...lane.querySelectorAll(".mooncake")],
      boon: lane.querySelector(".lane-boon"),
      boonAmount: lane.querySelector(".lane-boon b")
    };
  });
}

function renderField() {
  const signature = `${game.settings.mooncakeCount}|${Object.keys(TEAM_META).map((teamId) => `${teamId}:${teamPlayers(teamId).map((player) => player.name).join(",")}`).join("|")}`;
  if (signature !== fieldSignature || !laneRefs.redBean) {
    buildFieldSkeleton();
    fieldSignature = signature;
  }
  const active = game.status === "running" || game.status === "finishing";
  fieldRef.classList.toggle("is-countdown", game.status === "countdown");
  fieldRef.classList.toggle("is-sprint", active && Object.keys(TEAM_META).some((teamId) => {
    const progress = teamMetrics(game, teamId).progress;
    return progress >= SPRINT_THRESHOLD && progress < 100;
  }));
  Object.keys(TEAM_META).forEach((teamId) => {
    const metric = teamMetrics(game, teamId);
    const ref = laneRefs[teamId];
    const hasMembers = teamPlayers(teamId).length > 0;
    ref.lane.style.setProperty("--progress", (metric.progress / 100).toFixed(3));
    ref.fill.style.width = `${metric.progress}%`;
    ref.pct.textContent = `${metric.progress}%`;
    ref.meta.textContent = `${teamPlayers(teamId).length} 位 · 已吃 ${metric.eatenCakes}/${game.settings.mooncakeCount} 個`;
    ref.eater.classList.toggle("is-eating", active && hasMembers && metric.progress < 100);
    ref.lane.classList.toggle("is-near", active && metric.progress >= SPRINT_THRESHOLD && metric.progress < 100);
    ref.cakes.forEach((cake, index) => {
      const eaten = index < metric.eatenCakes;
      const current = index === metric.currentCakeIndex && !eaten;
      const biteStage = current ? Math.min(4, Math.floor(metric.currentCakeProgress * 5)) : 0;
      cake.classList.toggle("is-eaten", eaten);
      cake.classList.toggle("is-current", current);
      cake.dataset.bites = String(biteStage);
      cake.style.setProperty("--cake-progress", metric.currentCakeProgress.toFixed(3));
    });
    const showBoon = Boolean(game.boon && game.boon.team === teamId && game.boon.until > Date.now());
    ref.boon.classList.toggle("show", showBoon);
    if (showBoon) ref.boonAmount.textContent = String(game.boon.amount);
  });
}

function statusCopy() {
  if (game.status === "countdown") return { title: "準備開吃", copy: "倒數結束後，所有隊員一起快速連點。" };
  if (game.status === "running") return { title: "月餅大戰進行中", copy: "每一口都會推進隊伍的月餅盤進度。" };
  if (game.status === "finishing") return { title: "完食成功！", copy: "最後一口吞下，準備公布結果。" };
  if (game.status === "finished") return { title: `${TEAM_META[game.winner]?.name || "本回合"}獲勝`, copy: "最先吃完所有月餅。" };
  return { title: "等待三隊入席", copy: "隊員輪流咬月餅，最先清空整盤月餅的隊伍獲勝。" };
}

function render() {
  const copy = statusCopy();
  const totalPlayers = Object.keys(game.players).length;
  elements.roomLabel.textContent = `房間 ${roomCode}`;
  elements.connectionBadge.textContent = backend.type === "firebase" ? "即時多人模式" : "示範模式";
  elements.connectionBadge.className = `status-badge ${backend.type === "firebase" ? "is-live" : "is-demo"}`;
  elements.hostView.hidden = !isHost;
  elements.playerView.hidden = isHost;
  document.body.dataset.view = isHost ? "host" : "player";
  document.body.classList.toggle("is-player-joined", !isHost && Boolean(currentPlayer && game.players[currentPlayer.id]));

  if (isHost) {
    const locked = game.status !== "lobby";
    const unassignedCount = Object.values(game.players).filter((player) => !player.team).length;
    elements.hostHeading.textContent = copy.title;
    elements.hostCopy.textContent = unassignedCount ? `目前有 ${unassignedCount} 人待分隊，請先按「自動分隊」。` : copy.copy;
    elements.startButton.textContent = game.status === "lobby" ? "開始倒數" : game.status === "finished" ? "下一輪" : game.status === "countdown" ? "倒數中" : game.status === "finishing" ? "結算中" : "進行中";
    elements.startButton.disabled = ["countdown", "running", "finishing"].includes(game.status) || unassignedCount > 0 || totalPlayers === 0;
    elements.autoAssignButton.disabled = locked || totalPlayers === 0;
    if (document.activeElement !== elements.bitesPerCake) elements.bitesPerCake.value = String(game.settings.bitesPerCake);
    if (document.activeElement !== elements.mooncakeCount) elements.mooncakeCount.value = String(game.settings.mooncakeCount);
    if (document.activeElement !== elements.countdownSeconds) elements.countdownSeconds.value = String(game.settings.countdownSeconds);
    [elements.bitesPerCake, elements.mooncakeCount, elements.countdownSeconds].forEach((input) => { input.disabled = locked; });
    renderField();
    elements.playerCount.textContent = `${totalPlayers} 人`;
    const roster = Object.values(game.players).sort((left, right) => left.joinedAt - right.joinedAt);
    elements.playerRoster.innerHTML = roster.length ? roster.map((player) => `<span class="player-pill" style="--team:${TEAM_META[player.team]?.color || "#7b7196"}">${escapeHtml(player.name)}${player.team ? "" : "（待分隊）"}</span>`).join("") : '<span class="empty-roster">尚未有人加入</span>';
    renderJoinQrCode();
  } else {
    const joined = Boolean(currentPlayer && game.players[currentPlayer.id]);
    elements.joinPanel.hidden = joined;
    elements.tapPanel.hidden = !joined;
    if (joined) renderPlayerPanel();
  }
  renderWinner();
  renderSoundControl();
  renderGameSounds();
}

function renderWinner() {
  const showWinner = game.status === "finished" && game.winner;
  elements.winnerOverlay.hidden = !showWinner;
  if (!showWinner) { confettiRound = 0; return; }
  const meta = TEAM_META[game.winner];
  elements.winnerTitle.textContent = `${meta.emblem} ${meta.name}獲勝`;
  elements.winnerCopy.textContent = "最先吃完所有月餅。";
  elements.winnerNextButton.hidden = !isHost;
  const top = teamPlayers(game.winner).filter((player) => player.taps > 0).sort((left, right) => right.taps - left.taps).slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  elements.winnerMvp.innerHTML = top.length ? `<p class="mvp-title">本隊完食貢獻榜</p>${top.map((player, index) => `<div class="mvp-row"><span>${medals[index]} ${escapeHtml(player.name)}</span><strong>${player.taps} 口</strong></div>`).join("")}` : "";
  if (confettiRound !== game.round) { confettiRound = game.round; spawnConfetti(meta.color); }
}

function spawnConfetti(teamColor) {
  elements.confetti.replaceChildren();
  const colors = [teamColor, "#ffd166", "#f7c4d4", "#75c9c8", "#fff4c7", "#fff"];
  const pieces = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 48;
  for (let index = 0; index < pieces; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${(Math.random() * 0.6).toFixed(2)}s`;
    piece.style.animationDuration = `${(1.6 + Math.random() * 1.4).toFixed(2)}s`;
    piece.style.setProperty("--drift", `${(Math.random() * 120 - 60).toFixed(0)}px`);
    piece.style.setProperty("--spin", `${Math.round(Math.random() * 720 - 360)}deg`);
    elements.confetti.append(piece);
  }
  window.setTimeout(() => elements.confetti.replaceChildren(), 3600);
}

function renderPlayerPanel() {
  const player = game.players[currentPlayer.id];
  if (!player?.team) {
    document.body.style.removeProperty("--active-team");
    document.body.style.removeProperty("--active-team-dark");
    elements.yourTeamLabel.textContent = "等待分隊";
    elements.tapCounter.textContent = "0 口";
    elements.tapHeading.textContent = "等待主持人自動分隊";
    elements.tapMessage.textContent = "主持人完成分隊後，這裡會自動顯示你的隊伍。";
    elements.teamProgressFill.style.width = "0%";
    elements.tapButton.disabled = true;
    return;
  }
  const teamId = player.team;
  const metric = teamMetrics(game, teamId);
  document.body.style.setProperty("--active-team", TEAM_META[teamId].color);
  document.body.style.setProperty("--active-team-dark", TEAM_META[teamId].dark);
  elements.teamProgressFill.style.width = `${metric.progress}%`;
  const countdownSeconds = game.countdownEndsAt ? Math.max(0, Math.ceil((game.countdownEndsAt - Date.now()) / 1000)) : 0;
  elements.yourTeamLabel.textContent = TEAM_META[teamId].name;
  elements.tapCounter.textContent = `${Number(player.taps || 0)} 口`;
  elements.tapButton.disabled = game.status !== "running";
  elements.tapHeading.textContent = game.status === "running" ? "快速咬一口" : game.status === "finishing" ? "完食成功！" : game.status === "finished" ? "本回合結束" : game.status === "countdown" ? `${countdownSeconds} 秒後開始` : "準備開吃";
  elements.tapMessage.textContent = game.status === "running" ? `已吃 ${metric.progress}%，還差 ${metric.remainingBites} 口。` : game.status === "finishing" ? "最後一口吞下，請等待結算。" : game.status === "finished" ? `${TEAM_META[game.winner]?.name || "本回合"}最先清空月餅盤。` : game.status === "countdown" ? "倒數中，先把手指放在按鈕上。" : "等待主持人開始。";
}

function writeLocalState(next) {
  game = normalizeState(next);
  localStorage.setItem(localKey, JSON.stringify(game));
  backend.channel?.postMessage(game);
  render();
}

async function mutateGame(mutator) {
  if (backend.type === "firebase") {
    await firebaseApi.runTransaction(firebaseApi.roomRef, (current) => {
      const next = normalizeState(current);
      mutator(next);
      return next;
    });
    return;
  }
  const next = clone(game);
  mutator(next);
  writeLocalState(next);
}

async function joinGame(event) {
  event.preventDefault();
  const name = elements.playerName.value.trim().replace(/\s+/g, " ").slice(0, 16);
  elements.joinError.textContent = "";
  if (!name) { elements.playerName.focus(); return; }
  const player = { id: `p_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`, name, team: null };
  try {
    await mutateGame((state) => { state.players[player.id] = { name, team: null, taps: 0, joinedAt: Date.now() }; });
    saveCurrentPlayer(player);
    render();
  } catch (error) { showConnectionProblem(error); }
}

async function sendTap() {
  if (!currentPlayer || game.status !== "running") return;
  try {
    const player = game.players[currentPlayer.id];
    if (!player?.team) return;
    if (backend.type === "firebase") {
      await firebaseApi.update(firebaseApi.roomRef, {
        [`teams/${player.team}/biteUnits`]: firebaseApi.increment(1),
        [`players/${currentPlayer.id}/taps`]: firebaseApi.increment(1)
      });
      return;
    }
    await mutateGame((state) => {
      const current = state.players[currentPlayer.id];
      if (state.status !== "running" || !current?.team) return;
      state.teams[current.team].biteUnits += 1;
      current.taps += 1;
    });
  } catch (error) { showConnectionProblem(error); }
}

function sendTapFromPointer(event) {
  if (!event.isPrimary) return;
  lastPointerTapAt = Date.now();
  event.preventDefault();
  triggerTapFeedback();
  sendTap();
}

function sendTapFromClick(event) {
  if (event.detail === 0 || Date.now() - lastPointerTapAt > 500) { triggerTapFeedback(); sendTap(); }
}

function triggerTapFeedback() {
  if (game.status !== "running") return;
  const now = Date.now();
  comboCount = now - lastFxTapAt < 650 ? comboCount + 1 : 1;
  lastFxTapAt = now;
  try { navigator.vibrate?.(comboCount >= 10 ? 24 : 12); } catch { /* iOS browsers do not support vibration. */ }
  playSoundCue("chew");
  spawnTapBurst();
  elements.tapButton.classList.remove("tap-pop");
  void elements.tapButton.offsetWidth;
  elements.tapButton.classList.add("tap-pop");
  updateComboBadge();
  window.clearTimeout(comboResetTimer);
  comboResetTimer = window.setTimeout(() => { comboCount = 0; updateComboBadge(); }, 900);
}

function spawnTapBurst() {
  const hot = comboCount >= 8;
  const ring = document.createElement("span");
  ring.className = "tap-ring";
  elements.tapFx.append(ring);
  window.setTimeout(() => ring.remove(), 520);
  const label = document.createElement("span");
  label.className = `tap-fx-label${hot ? " is-hot" : ""}`;
  label.textContent = comboCount >= 4 ? "🥮 +1 🔥" : "🥮 +1";
  label.style.left = `${50 + (Math.random() * 30 - 15)}%`;
  label.style.setProperty("--drift", `${(Math.random() * 40 - 20).toFixed(0)}px`);
  elements.tapFx.append(label);
  window.setTimeout(() => label.remove(), 720);
  const specks = hot ? 7 : 5;
  for (let index = 0; index < specks; index += 1) {
    const speck = document.createElement("span");
    speck.className = "tap-speck";
    const angle = (Math.PI * 2 * index) / specks + Math.random() * 0.5;
    const distance = 44 + Math.random() * 34;
    speck.style.setProperty("--sx", `${(Math.cos(angle) * distance).toFixed(0)}px`);
    speck.style.setProperty("--sy", `${(Math.sin(angle) * distance).toFixed(0)}px`);
    elements.tapFx.append(speck);
    window.setTimeout(() => speck.remove(), 500);
  }
}

function updateComboBadge() {
  if (comboCount >= 4) {
    elements.comboBadge.hidden = false;
    elements.comboBadge.textContent = `🔥 連吃 ×${comboCount}`;
    elements.comboBadge.classList.remove("bump");
    void elements.comboBadge.offsetWidth;
    elements.comboBadge.classList.add("bump");
  } else {
    elements.comboBadge.hidden = true;
  }
}

async function startOrResetRound() {
  try {
    if (game.status === "lobby") {
      await mutateGame((state) => {
        if (state.status === "lobby") {
          state.status = "countdown";
          state.countdownEndsAt = Date.now() + state.settings.countdownSeconds * 1000;
        }
      });
      return;
    }
    if (game.status === "finished") await mutateGame(resetRoundState);
  } catch (error) { showConnectionProblem(error); }
}

async function updateSetting(event) {
  if (game.status !== "lobby") return;
  const input = event.currentTarget;
  const setting = input.id === "bites-per-cake" ? "bitesPerCake" : input.id === "mooncake-count" ? "mooncakeCount" : "countdownSeconds";
  const value = clampNumber(input.value, game.settings[setting], Number(input.min), Number(input.max));
  input.value = String(value);
  try { await mutateGame((state) => { state.settings[setting] = value; }); } catch (error) { showConnectionProblem(error); }
}

function showConnectionProblem(error) {
  console.error("遊戲同步失敗", error);
  elements.connectionBadge.textContent = "同步失敗";
  elements.connectionBadge.className = "status-badge is-demo";
}

async function reconcileGameClock() {
  if (!isHost) { render(); return; }
  if (game.status === "countdown" && Date.now() >= game.countdownEndsAt) {
    await mutateGame((state) => {
      if (state.status === "countdown" && Date.now() >= state.countdownEndsAt) {
        state.status = "running";
        state.startedAt = Date.now();
        state.nextBoonAt = Date.now() + BOON_FIRST_DELAY_MS;
      }
    });
  }
  if (game.status === "running" && game.nextBoonAt && Date.now() >= game.nextBoonAt) {
    await mutateGame((state) => {
      if (state.status !== "running" || !state.nextBoonAt || Date.now() < state.nextBoonAt) return;
      state.nextBoonAt = Date.now() + BOON_INTERVAL_MS;
      const target = catchUpTarget(state);
      if (!target) return;
      const amount = Math.max(1, Math.round(state.settings.bitesPerCake * 0.5));
      state.teams[target].biteUnits += amount;
      state.boon = { team: target, amount, until: Date.now() + BOON_BANNER_MS };
    });
  }
  if (game.status === "running" && Object.keys(TEAM_META).some((teamId) => game.teams[teamId].biteUnits >= unitsToWin(game))) {
    await mutateGame((state) => {
      if (state.status !== "running") return;
      const threshold = unitsToWin(state);
      const winners = Object.keys(TEAM_META).filter((teamId) => state.teams[teamId].biteUnits >= threshold);
      winners.sort((left, right) => state.teams[right].biteUnits - state.teams[left].biteUnits || left.localeCompare(right));
      if (winners.length) {
        state.status = "finishing";
        state.winner = winners[0];
        state.finishAnimationEndsAt = Date.now() + FINISH_DELAY_MS;
      }
    });
  }
  if (game.status === "finishing" && Date.now() >= game.finishAnimationEndsAt) {
    await mutateGame((state) => {
      if (state.status === "finishing" && Date.now() >= state.finishAnimationEndsAt) {
        state.status = "finished";
        state.finishedAt = Date.now();
        state.finishAnimationEndsAt = null;
      }
    });
  }
  render();
}

function bindEvents() {
  elements.soundToggle.addEventListener("click", () => toggleGameSound().catch(() => {
    renderSoundControl();
  }));
  document.addEventListener("pointerdown", () => { gameAudio.unlock().catch(() => {}); }, { capture: true, once: true });
  elements.joinForm.addEventListener("submit", joinGame);
  elements.tapButton.addEventListener("pointerdown", sendTapFromPointer);
  elements.tapButton.addEventListener("click", sendTapFromClick);
  elements.changeTeamButton.addEventListener("click", async () => {
    if (!currentPlayer) return;
    const id = currentPlayer.id;
    try {
      await mutateGame((state) => { delete state.players[id]; });
      sessionStorage.removeItem(playerKey);
      currentPlayer = null;
      render();
    } catch (error) { showConnectionProblem(error); }
  });
  elements.startButton.addEventListener("click", startOrResetRound);
  elements.autoAssignButton.addEventListener("click", () => mutateGame((state) => { if (state.status === "lobby") assignTeams(state); }).catch(showConnectionProblem));
  elements.winnerNextButton.addEventListener("click", () => { if (isHost && game.status === "finished") mutateGame(resetRoundState).catch(showConnectionProblem); });
  elements.copyPlayerLinkButton.addEventListener("click", () => copyPlayerJoinLink().catch(showConnectionProblem));
  elements.resetButton.addEventListener("click", () => {
    if (window.confirm("要重設本回合的吃月餅進度嗎？已加入的玩家會保留。")) mutateGame(resetRoundState).catch(showConnectionProblem);
  });
  [elements.bitesPerCake, elements.mooncakeCount, elements.countdownSeconds].forEach((input) => input.addEventListener("input", updateSetting));
}

function connectDemo() {
  try {
    const stored = localStorage.getItem(localKey);
    game = stored ? normalizeState(JSON.parse(stored)) : createDefaultState();
    localStorage.setItem(localKey, JSON.stringify(game));
  } catch { game = createDefaultState(); }
  if ("BroadcastChannel" in window) {
    backend.channel = new BroadcastChannel(localKey);
    backend.channel.addEventListener("message", (event) => { game = normalizeState(event.data); render(); });
  }
  window.addEventListener("storage", (event) => {
    if (event.key === localKey && event.newValue) { game = normalizeState(JSON.parse(event.newValue)); render(); }
  });
}

async function connectFirebase() {
  if (!firebaseConfig?.apiKey || !firebaseConfig?.databaseURL || !firebaseDataRoot || firebaseConfig.apiKey === "YOUR_API_KEY") return false;
  try {
    const [{ initializeApp, getApps }, { getAuth, signInAnonymously }, { getDatabase, ref, onValue, runTransaction, update, increment }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js")
    ]);
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    await retryFirebaseNetwork(() => signInAnonymously(getAuth(app)));
    const roomRef = ref(getDatabase(app), gamePath());
    firebaseApi = { roomRef, runTransaction, update, increment };
    await runTransaction(roomRef, (current) => current?.version === GAME_VERSION ? normalizeState(current) : createDefaultState());
    onValue(roomRef, (snapshot) => { game = normalizeState(snapshot.val()); render(); }, showConnectionProblem);
    backend = { type: "firebase", channel: null };
    return true;
  } catch (error) {
    console.warn("Firebase 無法使用，切換為示範模式。", error);
    return false;
  }
}

async function initialise() {
  if (!await connectFirebase()) connectDemo();
  bindEvents();
  render();
  window.setInterval(() => { reconcileGameClock().catch(showConnectionProblem); }, 250);
}

initialise();
