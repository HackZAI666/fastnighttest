class Weapon {
  constructor(options = {}) {
    this.width = 142;
    this.height = 85;

    this.magSize = 30;
    this.ammo = this.magSize;

    this.fireInterval = options.fireInterval ?? 0.2;
    this.cooldown = 0;

    this.reloadDuration = options.reloadDuration ?? 4;
    this.reloadTimer = 0;
    this.isReloading = false;

    this.autoReload = options.autoReload ?? false;
    this.bulletSpeed = options.bulletSpeed ?? 1600;
    this.muzzleDistance = 84;

    this.recoilAngle = 0;
    this.recoilMaxAngle = 75 * Math.PI / 180;
    this.recoilPerShot = this.recoilMaxAngle / 21;
    this.recoilRecoverDelay = 0.08;
    this.recoilRecoverTime = 0.7;
    this.timeSinceShot = 999;

    this.recoilBulletInfluence = options.recoilBulletInfluence ?? 0.82;
    this.recoilRandomSpread = options.recoilRandomSpread ?? 0.06;

    this.muzzleFlashTime = 0;
    this.muzzleFlashDuration = 0.06;

    this.imageRight = new Image();
    this.imageLeft = new Image();

    this.loadedRight = false;
    this.loadedLeft = false;
    this.loaded = false;

    this.spriteRight = null;
    this.spriteLeft = null;

    this.imageRight.src = "assets/weapon-right.png";
    this.imageLeft.src = "assets/weapon-left.png";

    this.imageRight.onload = () => {
      this.spriteRight = this._buildSprite(this.imageRight);
      this.loadedRight = true;
      this.loaded = this.loadedRight && this.loadedLeft;
    };

    this.imageLeft.onload = () => {
      this.spriteLeft = this._buildSprite(this.imageLeft);
      this.loadedLeft = true;
      this.loaded = this.loadedRight && this.loadedLeft;
    };
  }

  _buildSprite(image) {
    const c = document.createElement("canvas");
    c.width = this.width;
    c.height = this.height;

    const ctx = c.getContext("2d");
    ctx.drawImage(image, 0, 0, this.width, this.height);

    return c;
  }

  update(dt) {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (this.cooldown < 0) this.cooldown = 0;
    }

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.reloadTimer = 0;
        this.ammo = this.magSize;
      }
    }

    this.timeSinceShot += dt;

    if (this.timeSinceShot > this.recoilRecoverDelay && this.recoilAngle > 0) {
      const recoverStep = (this.recoilMaxAngle / this.recoilRecoverTime) * dt;
      this.recoilAngle -= recoverStep;
      if (this.recoilAngle < 0) this.recoilAngle = 0;
    }

    if (this.muzzleFlashTime > 0) {
      this.muzzleFlashTime -= dt;
      if (this.muzzleFlashTime < 0) this.muzzleFlashTime = 0;
    }
  }

  startReload() {
    if (this.isReloading) return false;
    if (this.ammo === this.magSize) return false;

    this.isReloading = true;
    this.reloadTimer = this.reloadDuration;
    return true;
  }

  canShoot() {
    return !this.isReloading && this.cooldown <= 0 && this.ammo > 0;
  }

  shootFromWorld(playerX, playerY, playerW, playerH, targetX, targetY, bullets, team, ownerRef = null) {
    if (!this.canShoot()) {
      if (this.autoReload && this.ammo === 0 && !this.isReloading) {
        this.startReload();
      }
      return false;
    }

    const centerX = playerX + playerW / 2;
    const facingRight = targetX >= centerX;

    const gripX = facingRight ? playerX + playerW * 0.64 : playerX + playerW * 0.36;
    const gripY = playerY + playerH * 0.34;

    const dx = targetX - gripX;
    const dy = targetY - gripY;

    const aimAngle = Math.atan2(dy, dx);

    const recoilDirection = facingRight ? -1 : 1;
    const recoilDrivenKick = this.recoilAngle * this.recoilBulletInfluence;
    const randomSpread = (Math.random() - 0.5) * this.recoilRandomSpread * (1 + this.recoilAngle / this.recoilMaxAngle);

    const shotAngle = aimAngle + (recoilDirection * recoilDrivenKick) + randomSpread;

    const muzzleX = gripX + Math.cos(shotAngle) * this.muzzleDistance;
    const muzzleY = gripY + Math.sin(shotAngle) * this.muzzleDistance;

    const vx = Math.cos(shotAngle) * this.bulletSpeed;
    const vy = Math.sin(shotAngle) * this.bulletSpeed;

    bullets.push(new AWBullet(muzzleX, muzzleY, vx, vy, team, ownerRef));

    this.ammo -= 1;
    this.cooldown = this.fireInterval;
    this.muzzleFlashTime = this.muzzleFlashDuration;
    this.timeSinceShot = 0;

    this.recoilAngle += this.recoilPerShot;
    if (this.recoilAngle > this.recoilMaxAngle) {
      this.recoilAngle = this.recoilMaxAngle;
    }

    if (this.ammo <= 0) {
      this.ammo = 0;
      if (this.autoReload) {
        this.startReload();
      }
    }

    return true;
  }

  _drawReloadRing(ctx, x, y, progress) {
    const clamped = Math.max(0, Math.min(1, progress));

    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamped);
    ctx.stroke();

    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000000";
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawWeapon(ctx, gripX, gripY, rotation, facingRight = true) {
    const sprite = facingRight ? this.spriteRight : this.spriteLeft;
    const drawRotation = facingRight ? rotation : rotation + Math.PI;
    const drawX = facingRight ? -22 : -(this.width - 22);

    ctx.save();
    ctx.translate(gripX, gripY);
    ctx.rotate(drawRotation);

    if (sprite) {
      ctx.drawImage(sprite, drawX, -this.height / 2, this.width, this.height);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(drawX, -this.height / 2, this.width, this.height);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX, -this.height / 2, this.width, this.height);
    }

    ctx.restore();
  }

  _drawMuzzleFlash(ctx, gripX, gripY, rotation) {
    if (this.muzzleFlashTime <= 0) return;

    const t = this.muzzleFlashTime / this.muzzleFlashDuration;
    const alpha = Math.max(0, Math.min(1, t));

    const mx = gripX + Math.cos(rotation) * this.muzzleDistance;
    const my = gripY + Math.sin(rotation) * this.muzzleDistance;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(mx, my);
    ctx.rotate(rotation);

    ctx.fillStyle = "rgba(255, 220, 120, 0.95)";
    ctx.beginPath();
    ctx.arc(0, 0, 6 + 4 * alpha, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 140, 40, 0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, 3 + 2 * alpha, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 240, 180, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(8 + 6 * alpha, 0);
    ctx.lineTo(0, 3);
    ctx.lineTo(-8 - 6 * alpha, 0);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  drawPlayer(ctx, playerX, playerY, playerW, playerH, mouseX, mouseY) {
    const centerX = playerX + playerW / 2;
    const facingRight = mouseX >= centerX;

    const gripX = facingRight ? playerX + playerW * 0.64 : playerX + playerW * 0.36;
    const gripY = playerY + playerH * 0.34;

    if (this.isReloading) {
      const reloadRotation = Math.PI / 2;
      this._drawWeapon(ctx, gripX, gripY, reloadRotation, facingRight);
      this._drawReloadRing(
        ctx,
        gripX + 12,
        gripY - 12,
        1 - (this.reloadTimer / this.reloadDuration)
      );
      return;
    }

    const dx = mouseX - gripX;
    const dy = mouseY - gripY;
    const aimAngle = Math.atan2(dy, dx);

    const displayAngle = facingRight
      ? aimAngle - this.recoilAngle * this.recoilBulletInfluence
      : aimAngle + this.recoilAngle * this.recoilBulletInfluence;

    this._drawWeapon(ctx, gripX, gripY, displayAngle, facingRight);
    this._drawMuzzleFlash(ctx, gripX, gripY, displayAngle);
  }

  drawFacing(ctx, playerX, playerY, playerW, playerH, facingRight) {
    const gripX = facingRight ? playerX + playerW * 0.64 : playerX + playerW * 0.36;
    const gripY = playerY + playerH * 0.34;

    if (this.isReloading) {
      const reloadRotation = Math.PI / 2;
      this._drawWeapon(ctx, gripX, gripY, reloadRotation, facingRight);
      this._drawReloadRing(
        ctx,
        gripX + 12,
        gripY - 12,
        1 - (this.reloadTimer / this.reloadDuration)
      );
      return;
    }

    const baseAngle = facingRight ? 0 : Math.PI;
    const displayAngle = facingRight
      ? baseAngle - this.recoilAngle * this.recoilBulletInfluence
      : baseAngle + this.recoilAngle * this.recoilBulletInfluence;

    this._drawWeapon(ctx, gripX, gripY, displayAngle, facingRight);
    this._drawMuzzleFlash(ctx, gripX, gripY, displayAngle);
  }
}