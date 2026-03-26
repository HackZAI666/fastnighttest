class Bot {
  constructor(x, y, team, name = "") {
    this.x = x;
    this.y = y;
    this.team = team;

    this.w = 68;
    this.h = 102;

    this.spawnX = x;
    this.spawnY = y;

    this.vx = 0;
    this.vy = 0;
    this.onGround = false;

    this.moveSpeed = 380;
    this.accel = 2400;
    this.friction = 3000;
    this.jumpPower = 820;
    this.gravity = 2120;
    this.fallMultiplier = 1.12;

    this.maxHealth = 100;
    this.health = 100;

    this.dead = false;
    this.deathTimer = 0;
    this.deathDuration = 1.0;
    this.deathDir = 1;

    this.name = name || (team === "ally" ? "CT" : "T");
    this.kills = 0;

    this.color = team === "ally" ? "#1f4fd1" : "#d16a1f";
    this.weapon = new Weapon({ autoReload: true, fireInterval: 0.2, reloadDuration: 4 });

    this.facingRight = team === "ally";

    this.brainType = ["aggressive", "steady", "erratic", "cautious"][Math.floor(Math.random() * 4)];
    this.behaviorTimer = 0.3 + Math.random() * 1.8;
    this.behavior = "hold";
    this.wanderDir = Math.random() < 0.5 ? -1 : 1;
    this.jumpTimer = 0.6 + Math.random() * 2.2;

    this.engageRangeTiles = 7 + Math.floor(Math.random() * 2);
  }

  takeDamage(amount, impactDir) {
    if (this.dead) return false;

    this.health -= amount;

    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.deathTimer = this.deathDuration;
      this.deathDir = impactDir >= 0 ? 1 : -1;
      this.vx = 0;
      this.vy = 0;
      return true;
    }

    return false;
  }

  _chooseBehavior() {
    const r = Math.random();

    if (this.brainType === "aggressive") {
      if (r < 0.50) this.behavior = "advance";
      else if (r < 0.68) this.behavior = "hold";
      else if (r < 0.82) this.behavior = "retreat";
      else this.behavior = "wander";
    } else if (this.brainType === "cautious") {
      if (r < 0.22) this.behavior = "advance";
      else if (r < 0.52) this.behavior = "hold";
      else if (r < 0.78) this.behavior = "retreat";
      else this.behavior = "wander";
    } else if (this.brainType === "erratic") {
      if (r < 0.35) this.behavior = "wander";
      else if (r < 0.60) this.behavior = "advance";
      else if (r < 0.80) this.behavior = "hold";
      else this.behavior = "retreat";
    } else {
      if (r < 0.34) this.behavior = "advance";
      else if (r < 0.60) this.behavior = "hold";
      else if (r < 0.82) this.behavior = "wander";
      else this.behavior = "retreat";
    }

    this.behaviorTimer = 0.7 + Math.random() * 2.5;
    this.wanderDir = Math.random() < 0.5 ? -1 : 1;
  }

  _aliveEnemies(player, bots) {
    const out = [];

    if (this.team === "ally") {
      for (const bot of bots) {
        if (bot.team === "enemy" && !bot.dead) out.push(bot);
      }
    } else {
      if (player && !player.dead) out.push(player);
      for (const bot of bots) {
        if (bot.team === "ally" && !bot.dead) out.push(bot);
      }
    }

    return out;
  }

  _pickTarget(player, bots) {
    const list = this._aliveEnemies(player, bots);
    if (list.length === 0) return null;

    const centerX = this.x + this.w / 2;

    const nearest = () => {
      let best = list[0];
      let bestDist = Math.abs((best.x + best.w / 2) - centerX);

      for (const e of list) {
        const d = Math.abs((e.x + e.w / 2) - centerX);
        if (d < bestDist) {
          best = e;
          bestDist = d;
        }
      }
      return best;
    };

    const farthest = () => {
      let best = list[0];
      let bestDist = Math.abs((best.x + best.w / 2) - centerX);

      for (const e of list) {
        const d = Math.abs((e.x + e.w / 2) - centerX);
        if (d > bestDist) {
          best = e;
          bestDist = d;
        }
      }
      return best;
    };

    const roll = Math.random();
    if (roll < 0.65) return nearest();
    if (roll < 0.85) return list[Math.floor(Math.random() * list.length)];
    return farthest();
  }

  update(dt, canvasHeight, player, bots, bullets) {
    if (this.dead) {
      if (this.deathTimer > 0) {
        this.deathTimer -= dt;
        if (this.deathTimer < 0) this.deathTimer = 0;
      }
      return false;
    }

    this.weapon.update(dt);

    const groundY = getGroundY(canvasHeight);
    const mapApi = typeof window !== "undefined" ? window.Map1 : null;

    this.behaviorTimer -= dt;
    if (this.behaviorTimer <= 0) {
      this._chooseBehavior();
    }

    const target = this._pickTarget(player, bots);
    const teamDir = this.team === "ally" ? 1 : -1;

    let moveDir = 0;
    if (this.behavior === "advance") moveDir = teamDir;
    else if (this.behavior === "retreat") moveDir = -teamDir;
    else if (this.behavior === "wander") moveDir = this.wanderDir;
    else moveDir = 0;

    const leftBattleEdge = WORLD.width * 0.08;
    const rightBattleEdge = WORLD.width * 0.92;

    if (this.team === "ally" && this.x < leftBattleEdge) {
      moveDir = Math.max(moveDir, 1);
    }
    if (this.team === "enemy" && this.x > rightBattleEdge) {
      moveDir = Math.min(moveDir, -1);
    }

    const myLayer = mapApi && typeof mapApi.getEntityLayer === "function"
      ? mapApi.getEntityLayer(this, canvasHeight)
      : "lower";

    const targetLayer = mapApi && target && typeof mapApi.getEntityLayer === "function"
      ? mapApi.getEntityLayer(target, canvasHeight)
      : "lower";

    if (mapApi && target && myLayer !== targetLayer && typeof mapApi.getLadderCenterX === "function") {
      const ladderCenterX = mapApi.getLadderCenterX(canvasHeight);
      const centerX = this.x + this.w / 2;

      if (Math.abs(centerX - ladderCenterX) < 34 && typeof mapApi.useLadder === "function") {
        mapApi.useLadder(this, canvasHeight);
      } else {
        moveDir = ladderCenterX >= centerX ? 1 : -1;
      }
    }

    const ignoreEnemy = Math.random() < 0.20 && this.behavior !== "hold";

    if (moveDir !== 0) {
      this.vx += moveDir * this.accel * dt;
    } else {
      if (this.vx > 0) {
        this.vx -= this.friction * dt;
        if (this.vx < 0) this.vx = 0;
      } else if (this.vx < 0) {
        this.vx += this.friction * dt;
        if (this.vx > 0) this.vx = 0;
      }
    }

    if (this.vx > this.moveSpeed) this.vx = this.moveSpeed;
    if (this.vx < -this.moveSpeed) this.vx = -this.moveSpeed;

    this.jumpTimer -= dt;
    if (this.onGround && this.jumpTimer <= 0) {
      if (Math.random() < 0.45 && (moveDir !== 0 || this.behavior === "advance")) {
        this.vy = -this.jumpPower;
        this.onGround = false;
      }
      this.jumpTimer = 1.0 + Math.random() * 2.8;
    }

    if (target && !ignoreEnemy) {
      const centerX = this.x + this.w / 2;
      const targetCenterX = target.x + target.w / 2;
      const targetCenterY = target.y + target.h / 2;
      const dist = Math.abs(targetCenterX - centerX);

      const engageRange = WORLD.tileSize * this.engageRangeTiles;

      if (dist <= engageRange && this.weapon.canShoot()) {
        this.facingRight = targetCenterX >= centerX;

        const aimError = (Math.random() - 0.5) * 18;
        this.weapon.shootFromWorld(
          this.x,
          this.y,
          this.w,
          this.h,
          targetCenterX + aimError,
          targetCenterY + aimError,
          bullets,
          this.team,
          this
        );
      } else if (moveDir !== 0) {
        this.facingRight = moveDir > 0;
      } else {
        this.facingRight = targetCenterX >= centerX;
      }
    } else if (moveDir !== 0) {
      this.facingRight = moveDir > 0;
    }

    if (this.vy > 0) {
      this.vy += this.gravity * this.fallMultiplier * dt;
    } else {
      this.vy += this.gravity * dt;
    }

    const oldX = this.x;
    const oldY = this.y;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (mapApi && typeof mapApi.resolveEntity === "function") {
      mapApi.resolveEntity(this, oldX, oldY, canvasHeight);
      return true;
    }

    if (this.x < 0) this.x = 0;
    if (this.x > WORLD.width - this.w) this.x = WORLD.width - this.w;

    if (this.y + this.h >= groundY) {
      this.y = groundY - this.h;
      this.vy = 0;
      this.onGround = true;
    }

    return true;
  }

  draw(ctx, cameraX) {
    const sx = this.x - cameraX;
    const sy = this.y;

    if (this.dead) {
      const progress = Math.max(0, Math.min(1, 1 - (this.deathTimer / this.deathDuration)));
      const angle = this.deathDir * (Math.PI / 2) * progress;

      ctx.save();
      ctx.globalAlpha = Math.max(0.35, this.deathTimer / this.deathDuration);
      ctx.translate(sx + this.w / 2, sy + this.h / 2);
      ctx.rotate(angle);

      ctx.fillStyle = this.color;
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);

      ctx.restore();
      return;
    }

    ctx.fillStyle = this.color;
    ctx.fillRect(sx, sy, this.w, this.h);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, this.w, this.h);

    ctx.fillStyle = "#666666";
    ctx.fillRect(sx + 6, sy + 6, this.w - 12, 14);

    ctx.save();
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = this.team === "ally" ? "#8ab8ff" : "#ffb07a";
    ctx.strokeText(this.name, sx + this.w / 2, sy - 18);
    ctx.fillText(this.name, sx + this.w / 2, sy - 18);
    ctx.restore();

    if (typeof drawHealthBar === "function") {
      drawHealthBar(ctx, sx, sy - 14, this.w, this.health, this.maxHealth);
    }

    this.weapon.drawFacing(ctx, sx, sy, this.w, this.h, this.facingRight);
  }
}