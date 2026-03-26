const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hudEl = document.getElementById("hud");
const killFeedEl = document.getElementById("killFeed");
const scoreboardEl = document.getElementById("scoreboard");
const ammoHudEl = document.getElementById("ammoHud");
const playerKillToastEl = document.getElementById("playerKillToast");

const gearBtn = document.getElementById("gearBtn");
const settingsPanel = document.getElementById("settingsPanel");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const mobileModeCheckbox = document.getElementById("mobileModeCheckbox");

const lobbyOverlay = document.getElementById("lobbyOverlay");
const battleEnterBtn = document.getElementById("battleEnterBtn");

const resultOverlay = document.getElementById("resultOverlay");
const resultTitleEl = document.getElementById("resultTitle");
const resultSubtitleEl = document.getElementById("resultSubtitle");
const returnLobbyBtn = document.getElementById("returnLobbyBtn");

const mobileControls = document.getElementById("mobileControls");
const joystick = document.getElementById("joystick");
const joystickStick = document.getElementById("joystickStick");
const fireBtn = document.getElementById("fireBtn");
const reloadBtn = document.getElementById("reloadBtn");
const jumpBtn = document.getElementById("jumpBtn");
const useBtn = document.getElementById("useBtn");

const MATCH_KILL_TARGET = 30;

let player = null;
let cameraX = 0;
let lastTime = 0;

let gameState = "lobby";
let resultReturnTimer = 0;

const input = {
  left: false,
  right: false,
  jumpPressed: false,
  mouseDown: false
};

let mouseX = window.innerWidth * 0.65;
let mouseY = window.innerHeight * 0.45;

let bots = [];
let bullets = [];

let ctKills = 0;
let tKills = 0;
let killFeed = [];
let scoreboardVisible = false;

let settingsOpen = false;
let mobileModeEnabled = false;

const MOBILE_MODE_STORAGE_KEY = "battleSE_mobileMode";

let joystickActive = false;
let joystickPointerId = null;
let joystickCenterX = 0;
let joystickCenterY = 0;
const joystickRadius = 62;

let mobileAimVecX = 1;
let mobileAimVecY = 0;

let playerKillToastTimer = 0;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = "block";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function teamName(team) {
  return team === "ally" ? "CT" : "T";
}

function teamColor(team) {
  return team === "ally" ? "#6bb0ff" : "#ff8a3d";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hideAllLayers() {
  lobbyOverlay.style.display = "none";
  resultOverlay.style.display = "none";
}

function hideScoreboardAndToast() {
  scoreboardVisible = false;
  scoreboardEl.style.display = "none";
  playerKillToastEl.style.display = "none";
  playerKillToastTimer = 0;
}

function resetMatchState() {
  player = null;
  bots = [];
  bullets = [];
  killFeed = [];
  ctKills = 0;
  tKills = 0;
  scoreboardVisible = false;
  playerKillToastTimer = 0;
  playerKillToastEl.style.display = "none";
  updateHUD();
}

function syncUi() {
  hudEl.style.display = gameState === "playing" ? "block" : "none";
  mobileControls.style.display = (mobileModeEnabled && gameState === "playing") ? "block" : "none";

  const showGear = gameState === "playing" || gameState === "lobby";
  gearBtn.style.display = showGear ? "block" : "none";

  if (!showGear) {
    settingsOpen = false;
    settingsPanel.style.display = "none";
  }

  if (gameState !== "playing") {
    input.left = false;
    input.right = false;
    input.jumpPressed = false;
    input.mouseDown = false;
    resetJoystick();
  }
}

function showLobby() {
  hideAllLayers();
  lobbyOverlay.style.display = "flex";
  gameState = "lobby";
  hideScoreboardAndToast();
  settingsOpen = false;
  settingsPanel.style.display = "none";
  resetMatchState();
  syncUi();
  drawEmptyFrame();
}

function showResult(title, subtitle) {
  hideAllLayers();
  resultOverlay.style.display = "flex";
  resultTitleEl.textContent = title;
  resultSubtitleEl.textContent = subtitle;
  gameState = "result";
  hideScoreboardAndToast();
  settingsOpen = false;
  settingsPanel.style.display = "none";
  syncUi();
}

function drawEmptyFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp(e.clientX - rect.left, 0, canvas.width),
    y: clamp(e.clientY - rect.top, 0, canvas.height)
  };
}

function updateCamera() {
  if (!player) return;

  cameraX = player.x + player.w / 2 - canvas.width / 2;
  cameraX = clamp(cameraX, 0, Math.max(0, WORLD.width - canvas.width));
}

function getLeaderboardEntries() {
  return [player, ...bots]
    .filter(Boolean)
    .sort((a, b) => {
      if ((b.kills || 0) !== (a.kills || 0)) {
        return (b.kills || 0) - (a.kills || 0);
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

function renderKillFeedEntry(item) {
  if (item.isPlayerKill) {
    return `
      <div style="padding:4px 8px; border-radius:10px; background:rgba(255,245,140,0.95); color:#111; box-shadow:0 0 14px rgba(255,240,120,0.45); font-weight:700;">
        你击杀了 <span style="color:#000;">${escapeHtml(item.victimName)}</span>
      </div>
    `;
  }

  return `
    <span style="color:${teamColor(item.killerTeam)}">${escapeHtml(item.killerName)}</span>
    击杀
    <span style="color:${teamColor(item.victimTeam)}">${escapeHtml(item.victimName)}</span>
  `;
}

function updateHUD() {
  if (gameState !== "playing") {
    hudEl.style.display = "none";
    scoreboardEl.style.display = "none";
    return;
  }

  hudEl.style.display = "block";

  if (killFeed.length > 0) {
    const latest = killFeed[0];
    killFeedEl.innerHTML = renderKillFeedEntry(latest);

    if (latest.isPlayerKill) {
      killFeedEl.style.background = "transparent";
      killFeedEl.style.color = "#111";
      killFeedEl.style.border = "1px solid rgba(255,245,140,0.8)";
      killFeedEl.style.boxShadow = "0 0 16px rgba(255,240,120,0.30)";
    } else {
      killFeedEl.style.background = "rgba(0, 0, 0, 0.55)";
      killFeedEl.style.color = "#fff";
      killFeedEl.style.border = "none";
      killFeedEl.style.boxShadow = "none";
    }
  } else {
    killFeedEl.textContent = "击杀提示（点击查看排行榜）";
    killFeedEl.style.background = "rgba(0, 0, 0, 0.55)";
    killFeedEl.style.color = "#fff";
    killFeedEl.style.border = "none";
    killFeedEl.style.boxShadow = "none";
  }

  if (player) {
    ammoHudEl.textContent =
      player.weapon.ammo > 0
        ? `${player.weapon.ammo}/${player.weapon.magSize}`
        : "无子弹";
  } else {
    ammoHudEl.textContent = "30/30";
  }

  if (!scoreboardVisible) {
    scoreboardEl.style.display = "none";
    return;
  }

  const leaderboard = getLeaderboardEntries()
    .slice(0, 10)
    .map((entity, index) => {
      return `
        <div style="display:flex; justify-content:space-between; margin:2px 0; color:${teamColor(entity.team)};">
          <span>${index + 1}. ${escapeHtml(entity.name || teamName(entity.team))}</span>
          <span>${entity.kills || 0} 杀</span>
        </div>
      `;
    })
    .join("");

  const recentKills = killFeed
    .map((item) => {
      return `
        <div style="margin:2px 0;">
          <span style="color:${teamColor(item.killerTeam)}">${escapeHtml(item.killerName)}</span>
          击杀
          <span style="color:${teamColor(item.victimTeam)}">${escapeHtml(item.victimName)}</span>
        </div>
      `;
    })
    .join("");

  scoreboardEl.style.display = "block";
  scoreboardEl.innerHTML = `
    <div style="font-size:20px; margin-bottom:8px;">排行榜</div>
    <div style="display:flex; gap:10px; margin-bottom:12px;">
      <div style="flex:1; padding:6px 8px; border:1px solid rgba(107,176,255,0.35); color:#6bb0ff;">
        CT击杀数：${ctKills}
      </div>
      <div style="flex:1; padding:6px 8px; border:1px solid rgba(255,138,61,0.35); color:#ff8a3d;">
        T击杀数：${tKills}
      </div>
    </div>

    <div style="margin-bottom:6px; font-size:16px;">个人击杀榜</div>
    <div style="line-height:1.5; margin-bottom:12px;">
      ${leaderboard || "<div>暂无排行</div>"}
    </div>

    <div style="margin-bottom:6px; font-size:16px;">最近击杀</div>
    <div style="line-height:1.5;">
      ${recentKills || "<div>暂无击杀</div>"}
    </div>
  `;
}

function toggleScoreboard() {
  if (gameState !== "playing") return;
  scoreboardVisible = !scoreboardVisible;
  updateHUD();
}

killFeedEl.addEventListener("click", toggleScoreboard);

function showPlayerKillToast(victimName) {
  playerKillToastEl.textContent = `你击杀了 ${victimName}`;
  playerKillToastEl.style.display = "block";
  playerKillToastTimer = 1.6;
}

function clearInputs() {
  input.left = false;
  input.right = false;
  input.jumpPressed = false;
  input.mouseDown = false;
  resetJoystick();
}

function endBattle(isCtWin) {
  if (gameState !== "playing") return;

  gameState = "result";
  settingsOpen = false;
  settingsPanel.style.display = "none";
  scoreboardVisible = false;
  updateHUD();

  showResult(
    isCtWin ? "CT胜利" : "T胜利",
    isCtWin
      ? "CT 先消灭全部 T，对局结束。"
      : "T 先消灭全部 CT，对局结束。"
  );

  resultReturnTimer = 2.2;
  clearInputs();
}

function countAliveTeam(team) {
  let alive = 0;

  if (player && player.team === team && !player.dead) {
    alive += 1;
  }

  for (const bot of bots) {
    if (bot.team === team && !bot.dead) alive += 1;
  }

  return alive;
}

function checkRoundEnd() {
  if (gameState !== "playing") return;

  const ctAlive = countAliveTeam("ally");
  const tAlive = countAliveTeam("enemy");

  if (ctAlive <= 0) {
    endBattle(false);
  } else if (tAlive <= 0) {
    endBattle(true);
  }
}

function registerKill(killer, victim) {
  if (!killer || !victim) return;

  killer.kills = (killer.kills || 0) + 1;

  if (killer.team === "ally") ctKills += 1;
  if (killer.team === "enemy") tKills += 1;

  const isPlayerKill = killer === player;

  killFeed.unshift({
    killerName: killer.name || teamName(killer.team),
    killerTeam: killer.team,
    victimName: victim.name || teamName(victim.team),
    victimTeam: victim.team,
    isPlayerKill
  });

  if (killFeed.length > 6) killFeed.pop();

  if (isPlayerKill) {
    showPlayerKillToast(victim.name || teamName(victim.team));
  }

  updateHUD();
  checkRoundEnd();
}

function drawHealthBar(ctx, x, y, w, health, maxHealth) {
  const barW = w;
  const barH = 7;
  const pct = Math.max(0, Math.min(1, health / maxHealth));

  ctx.save();
  ctx.fillStyle = "#4b0000";
  ctx.fillRect(x, y, barW, barH);

  ctx.fillStyle = "#39d353";
  ctx.fillRect(x, y, barW * pct, barH);

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barW, barH);
  ctx.restore();
}

function pointInRect(px, py, x, y, w, h, pad = 0) {
  return px >= x - pad && px <= x + w + pad && py >= y - pad && py <= y + h + pad;
}

function getDamageByHit(entity, bulletY) {
  const relY = bulletY - entity.y;

  if (relY <= entity.h * 0.18) return 45;
  if (relY <= entity.h * 0.80) return 32;
  return 18;
}

function buildBotName(team, index) {
  const n = String(index).padStart(2, "0");
  return team === "ally" ? `CT-${n}` : `T-${n}`;
}

function createBots() {
  bots = [];

  const h = canvas.height;
  const allyGround = [0, 1].map((i) => Map1.getSpawnPoint("ally", h, false, i));
  const allyUpper = [0, 1].map((i) => Map1.getSpawnPoint("ally", h, true, i));
  const enemyGround = [0, 1, 2].map((i) => Map1.getSpawnPoint("enemy", h, false, i));
  const enemyUpper = [0, 1].map((i) => Map1.getSpawnPoint("enemy", h, true, i));

  const allySpawns = [...allyGround, ...allyUpper];
  const enemySpawns = [...enemyGround, ...enemyUpper];

  for (let i = 0; i < 4; i++) {
    const spawn = allySpawns[i];
    const bot = new Bot(spawn.x, spawn.y, "ally", buildBotName("ally", i + 1));
    bot.onGround = true;
    bots.push(bot);
  }

  for (let i = 0; i < 5; i++) {
    const spawn = enemySpawns[i];
    const bot = new Bot(spawn.x, spawn.y, "enemy", buildBotName("enemy", i + 1));
    bot.onGround = true;
    bots.push(bot);
  }
}

function spawnPlayer() {
  const spawn = Map1.getSpawnPoint("ally", canvas.height, false, 0);
  player = new Player(spawn.x, spawn.y);
  player.onGround = true;
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update(dt, canvas.height);
    if (!bullets[i].alive) bullets.splice(i, 1);
  }
}

function handleBulletHits() {
  if (!player) return;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (!bullet.alive) continue;

    let hitTarget = null;

    if (bullet.team !== player.team && !player.dead) {
      if (pointInRect(bullet.x, bullet.y, player.x, player.y, player.w, player.h, 4)) {
        hitTarget = player;
      }
    }

    if (!hitTarget) {
      for (const bot of bots) {
        if (bot.dead) continue;
        if (bullet.team === bot.team) continue;

        if (pointInRect(bullet.x, bullet.y, bot.x, bot.y, bot.w, bot.h, 4)) {
          hitTarget = bot;
          break;
        }
      }
    }

    if (hitTarget) {
      const damage = getDamageByHit(hitTarget, bullet.y);
      const impactDir = bullet.vx >= 0 ? 1 : -1;
      const died = hitTarget.takeDamage(damage, impactDir);

      bullet.alive = false;

      if (died) {
        registerKill(
          bullet.ownerRef || { team: bullet.team, name: teamName(bullet.team), kills: 0 },
          hitTarget
        );
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    if (!bullets[i].alive) bullets.splice(i, 1);
  }
}

function updatePlayerKillToast(dt) {
  if (playerKillToastTimer > 0) {
    playerKillToastTimer -= dt;
    if (playerKillToastTimer <= 0) {
      playerKillToastTimer = 0;
      playerKillToastEl.style.display = "none";
    }
  }
}

function syncMobileAimToPlayer() {
  if (!player) return;

  const aimDistance = 190;
  const playerScreenX = player.x - cameraX + player.w / 2;
  const playerScreenY = player.y + player.h / 2;

  mouseX = clamp(playerScreenX + mobileAimVecX * aimDistance, 0, canvas.width);
  mouseY = clamp(playerScreenY + mobileAimVecY * aimDistance, 0, canvas.height);
}

function updatePlaying(dt) {
  if (!player) return;

  player.update(dt, input, canvas.height);
  updateCamera();

  if (mobileModeEnabled) {
    syncMobileAimToPlayer();
  }

  if (input.mouseDown && !player.dead) {
    const aimWorldX = mouseX + cameraX;
    const aimWorldY = mouseY;

    player.weapon.shootFromWorld(
      player.x,
      player.y,
      player.w,
      player.h,
      aimWorldX,
      aimWorldY,
      bullets,
      player.team,
      player
    );
  }

  for (let i = 0; i < bots.length; i++) {
    bots[i].update(dt, canvas.height, player, bots, bullets);
  }

  updateBullets(dt);
  handleBulletHits();
  updateHUD();
  updatePlayerKillToast(dt);
}

function drawCurrentScene() {
  if (!player) return;

  Map1.drawMap1(ctx, canvas, cameraX);

  for (const bot of bots) {
    bot.draw(ctx, cameraX);
  }

  player.draw(ctx, cameraX, mouseX, mouseY);

  for (const bullet of bullets) {
    bullet.draw(ctx, cameraX);
  }
}

function saveMobileMode(enabled) {
  try {
    localStorage.setItem(MOBILE_MODE_STORAGE_KEY, enabled ? "1" : "0");
  } catch (e) {
  }
}

function loadMobileMode() {
  try {
    const saved = localStorage.getItem(MOBILE_MODE_STORAGE_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch (e) {
  }

  const touchDevice =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0;

  return touchDevice;
}

function setSettingsOpen(open) {
  settingsOpen = open;
  settingsPanel.style.display = settingsOpen ? "block" : "none";
}

function updateMobileControlsVisibility() {
  mobileControls.style.display = (mobileModeEnabled && gameState === "playing") ? "block" : "none";
}

function applyMobileMode(enabled) {
  mobileModeEnabled = !!enabled;
  mobileModeCheckbox.checked = mobileModeEnabled;
  updateMobileControlsVisibility();
  saveMobileMode(mobileModeEnabled);

  if (!mobileModeEnabled) {
    resetJoystick();
    input.mouseDown = false;
    input.jumpPressed = false;
  }

  requestAnimationFrame(updateJoystickCenter);
}

function updateJoystickCenter() {
  const rect = joystick.getBoundingClientRect();
  joystickCenterX = rect.left + rect.width / 2;
  joystickCenterY = rect.top + rect.height / 2;
}

function setJoystickVisual(dx, dy) {
  joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
}

function resetJoystick() {
  joystickActive = false;
  joystickPointerId = null;
  input.left = false;
  input.right = false;
  setJoystickVisual(0, 0);
}

function updateJoystickFromPoint(clientX, clientY) {
  const dx = clientX - joystickCenterX;
  const dy = clientY - joystickCenterY;
  const dist = Math.hypot(dx, dy);

  let useX = dx;
  let useY = dy;

  if (dist > joystickRadius) {
    const k = joystickRadius / dist;
    useX *= k;
    useY *= k;
  }

  setJoystickVisual(useX, useY);

  const deadZone = 12;
  input.left = useX < -deadZone;
  input.right = useX > deadZone;

  const mag = Math.hypot(useX, useY);
  if (mag > 4) {
    mobileAimVecX = useX / mag;
    mobileAimVecY = useY / mag;
  }
}

function tryUseLadderByPlayer() {
  if (!player || !Map1 || typeof Map1.useLadder !== "function") return false;
  return Map1.useLadder(player, canvas.height);
}

function startBattle() {
  if (gameState !== "lobby") return;

  resetMatchState();
  resizeCanvas();

  spawnPlayer();
  createBots();
  updateCamera();

  hideAllLayers();
  gameState = "playing";
  settingsOpen = false;
  settingsPanel.style.display = "none";
  syncUi();
  updateHUD();
  lastTime = 0;
  drawCurrentScene();
}

battleEnterBtn.addEventListener("click", startBattle);

gearBtn.addEventListener("click", () => {
  if (gameState === "playing" || gameState === "lobby") {
    setSettingsOpen(!settingsOpen);
  }
});

closeSettingsBtn.addEventListener("click", () => {
  setSettingsOpen(false);
});

returnLobbyBtn.addEventListener("click", showLobby);

mobileModeCheckbox.addEventListener("change", () => {
  applyMobileMode(mobileModeCheckbox.checked);
  setSettingsOpen(false);
});

joystick.addEventListener("pointerdown", (e) => {
  if (!mobileModeEnabled || gameState !== "playing") return;

  e.preventDefault();
  joystickActive = true;
  joystickPointerId = e.pointerId;

  if (joystick.setPointerCapture) {
    joystick.setPointerCapture(e.pointerId);
  }

  updateJoystickCenter();
  updateJoystickFromPoint(e.clientX, e.clientY);
});

window.addEventListener("pointermove", (e) => {
  if (!joystickActive) return;
  if (e.pointerId !== joystickPointerId) return;

  e.preventDefault();
  updateJoystickFromPoint(e.clientX, e.clientY);
});

window.addEventListener("pointerup", (e) => {
  if (e.pointerId !== joystickPointerId) return;
  resetJoystick();
});

window.addEventListener("pointercancel", (e) => {
  if (e.pointerId !== joystickPointerId) return;
  resetJoystick();
});

fireBtn.addEventListener("pointerdown", (e) => {
  if (!mobileModeEnabled || gameState !== "playing") return;
  e.preventDefault();
  input.mouseDown = true;

  if (fireBtn.setPointerCapture) {
    fireBtn.setPointerCapture(e.pointerId);
  }
});

fireBtn.addEventListener("pointerup", () => {
  input.mouseDown = false;
});

fireBtn.addEventListener("pointercancel", () => {
  input.mouseDown = false;
});

fireBtn.addEventListener("lostpointercapture", () => {
  input.mouseDown = false;
});

reloadBtn.addEventListener("pointerdown", (e) => {
  if (!mobileModeEnabled || gameState !== "playing") return;
  e.preventDefault();

  if (player) {
    player.weapon.startReload();
  }

  if (reloadBtn.setPointerCapture) {
    reloadBtn.setPointerCapture(e.pointerId);
  }
});

jumpBtn.addEventListener("pointerdown", (e) => {
  if (!mobileModeEnabled || gameState !== "playing") return;
  e.preventDefault();
  input.jumpPressed = true;

  if (jumpBtn.setPointerCapture) {
    jumpBtn.setPointerCapture(e.pointerId);
  }
});

useBtn.addEventListener("pointerdown", (e) => {
  if (!mobileModeEnabled || gameState !== "playing") return;
  e.preventDefault();
  tryUseLadderByPlayer();

  if (useBtn.setPointerCapture) {
    useBtn.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener("pointerdown", (e) => {
  if (gameState !== "playing" || mobileModeEnabled) return;
  const p = getCanvasPoint(e);
  mouseX = p.x;
  mouseY = p.y;
});

canvas.addEventListener("pointermove", (e) => {
  if (gameState !== "playing" || mobileModeEnabled) return;
  const p = getCanvasPoint(e);
  mouseX = p.x;
  mouseY = p.y;
});

window.addEventListener("resize", () => {
  resizeCanvas();
  updateJoystickCenter();

  if (gameState === "playing") {
    if (player) {
      const spawn = Map1.getSpawnPoint("ally", canvas.height, false, 0);
      player.spawnY = spawn.y;
      if (player.onGround) {
        player.y = spawn.y;
      }
    }

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      const elevated = i >= 2 && bot.team === "ally" ? true : i >= 3 && bot.team === "enemy" ? true : false;
      const spawn = Map1.getSpawnPoint(bot.team, canvas.height, elevated, i);
      bot.spawnY = spawn.y;
      if (bot.onGround) {
        bot.y = spawn.y;
      }
    }

    updateCamera();
    if (mobileModeEnabled) syncMobileAimToPlayer();
    drawCurrentScene();
    updateHUD();
  }

  if (gameState === "lobby") {
    hideScoreboardAndToast();
  }
});

window.addEventListener("mousemove", (e) => {
  if (!mobileModeEnabled) {
    const p = getCanvasPoint(e);
    mouseX = p.x;
    mouseY = p.y;
  }
});

window.addEventListener("mousedown", (e) => {
  if (e.button === 0 && gameState === "playing") {
    input.mouseDown = true;
  }
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 0) {
    input.mouseDown = false;
  }
});

window.addEventListener("keydown", (e) => {
  if (gameState !== "playing") return;

  if (e.key === "a" || e.key === "A") input.left = true;
  if (e.key === "d" || e.key === "D") input.right = true;

  if ((e.key === "w" || e.key === "W") && !e.repeat) {
    input.jumpPressed = true;
  }

  if (e.key === "e" || e.key === "E") {
    if (!tryUseLadderByPlayer() && player) {
      player.weapon.startReload();
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "a" || e.key === "A") input.left = false;
  if (e.key === "d" || e.key === "D") input.right = false;
});

window.addEventListener("blur", clearInputs);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInputs();
});

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

function loop(time) {
  if (!lastTime) lastTime = time;
  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;

  if (gameState === "playing") {
    updatePlaying(dt);
    drawCurrentScene();
  } else if (gameState === "result") {
    resultReturnTimer -= dt;
    if (resultReturnTimer <= 0) {
      showLobby();
    }
  } else if (gameState === "lobby") {
    drawEmptyFrame();
  }

  requestAnimationFrame(loop);
}

window.addEventListener("load", () => {
  resizeCanvas();
  mobileModeEnabled = loadMobileMode();

  mobileModeCheckbox.checked = mobileModeEnabled;
  updateMobileControlsVisibility();
  updateJoystickCenter();

  showLobby();
  updateHUD();
  requestAnimationFrame(loop);
});