class AWBullet {
  constructor(x, y, vx, vy, team, ownerRef = null) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.team = team;
    this.ownerRef = ownerRef;
    this.ownerName = ownerRef && ownerRef.name ? ownerRef.name : (team === "ally" ? "CT" : "T");

    this.radius = 3.3;
    this.traveled = 0;
    this.maxDistance = WORLD.tileSize * 10;
    this.alive = true;

    this.trail = [];
    this.maxTrailLength = 7;
  }

  update(dt, canvasHeight = window.innerHeight) {
    if (!this.alive) return;

    const oldX = this.x;
    const oldY = this.y;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.traveled += Math.hypot(this.x - oldX, this.y - oldY);

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }

    if (this.traveled >= this.maxDistance) {
      this.alive = false;
      return;
    }

    const activeWorldWidth = typeof getCurrentWorldWidth === "function" ? getCurrentWorldWidth() : WORLD.width;

    if (this.x < -200 || this.x > activeWorldWidth + 200) {
      this.alive = false;
      return;
    }

    if (this.y < -200 || this.y > 5000) {
      this.alive = false;
      return;
    }
  }

  draw(ctx, cameraX) {
    if (!this.alive) return;

    const sx = this.x - cameraX;
    const headColor = this.team === "enemy" ? "#ffb07a" : "#a9d2ff";
    const trailColor = this.team === "enemy" ? "rgba(255, 170, 120, " : "rgba(120, 190, 255, ";

    if (this.trail.length > 1) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = this.team === "enemy" ? "rgba(255, 140, 80, 0.35)" : "rgba(120, 190, 255, 0.35)";
      ctx.lineWidth = 2;

      ctx.beginPath();
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        const px = p.x - cameraX;
        const py = p.y;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const alpha = ((i + 1) / this.trail.length) * 0.18;

      ctx.save();
      ctx.fillStyle = `${trailColor}${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x - cameraX, p.y, this.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.team === "enemy" ? "#ffb07a" : "#7cc1ff";
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.arc(sx, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}