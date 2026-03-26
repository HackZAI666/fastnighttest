class Player {
  constructor(x, y) {
    this.spawnX = x;
    this.spawnY = y;

    this.x = x;
    this.y = y;

    this.w = 68;
    this.h = 102;

    this.vx = 0;
    this.vy = 0;
    this.onGround = false;

    this.moveSpeed = 440;
    this.accel = 2700;
    this.friction = 3400;
    this.jumpPower = 840;
    this.gravity = 2120;
    this.fallMultiplier = 1.12;

    this.maxHealth = 100;
    this.health = 100;

    this.dead = false;
    this.deathTimer = 0;
    this.deathDuration = 1.05;
    this.deathDir = 1;

    this.skinColor = "#111111";
    this.team = "ally";
    this.name = "玩家";
    this.kills = 0;

    this.weapon = new Weapon({ autoReload: false });
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

  update(dt, input, canvasHeight) {
    if (this.dead) {
      this.vx = 0;
      this.vy = 0;
      if (this.deathTimer > 0) {
        this.deathTimer -= dt;
        if (this.deathTimer < 0) this.deathTimer = 0;
      }
      return;
    }

    this.weapon.update(dt);

    if (input.left && !input.right) {
      this.vx -= this.accel * dt;
    } else if (input.right && !input.left) {
      this.vx += this.accel * dt;
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

    if (input.jumpPressed && this.onGround) {
      this.vy = -this.jumpPower;
      this.onGround = false;
      input.jumpPressed = false;
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

    if (window.Map1 && typeof window.Map1.resolveEntity === "function") {
      window.Map1.resolveEntity(this, oldX, oldY, canvasHeight);
      return;
    }

    const groundY = getGroundY(canvasHeight);

    if (this.x < 0) this.x = 0;
    if (this.x > WORLD.width - this.w) this.x = WORLD.width - this.w;

    if (this.y + this.h >= groundY) {
      this.y = groundY - this.h;
      this.vy = 0;
      this.onGround = true;
    }
  }

  draw(ctx, cameraX, mouseX, mouseY) {
    const sx = this.x - cameraX;
    const sy = this.y;

    if (this.dead) {
      const progress = Math.max(0, Math.min(1, 1 - (this.deathTimer / this.deathDuration)));
      const angle = this.deathDir * (Math.PI / 2) * progress;

      ctx.save();
      ctx.globalAlpha = Math.max(0.35, this.deathTimer / this.deathDuration);
      ctx.translate(sx + this.w / 2, sy + this.h / 2);
      ctx.rotate(angle);

      ctx.fillStyle = this.skinColor;
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);

      ctx.restore();
      return;
    }

    ctx.fillStyle = this.skinColor;
    ctx.fillRect(sx, sy, this.w, this.h);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, this.w, this.h);

    ctx.fillStyle = "#444444";
    ctx.fillRect(sx + 6, sy + 6, this.w - 12, 14);

    ctx.save();
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#ff9b9b";
    ctx.strokeText(this.name, sx + this.w / 2, sy - 18);
    ctx.fillText(this.name, sx + this.w / 2, sy - 18);
    ctx.restore();

    if (typeof drawHealthBar === "function") {
      drawHealthBar(ctx, sx, sy - 14, this.w, this.health, this.maxHealth);
    }

    this.weapon.drawPlayer(ctx, sx, sy, this.w, this.h, mouseX, mouseY);
  }
}