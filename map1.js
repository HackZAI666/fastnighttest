(() => {
  const TILE = 40;
  const WORLD_WIDTH = 74 * TILE;
  const GROUND_ROWS = 3;

  const UPPER_PLATFORM = {
    x: 12 * TILE,
    w: 50 * TILE,
    h: TILE,
    yOffsetTiles: 6
  };

  const LADDER = {
    x: 36 * TILE,
    w: TILE
  };

  const BOMBSITE_A = {
    x: 18 * TILE,
    yOffsetTiles: 1
  };

  const BOMBSITE_B = {
    x: 55 * TILE,
    yOffsetTiles: 1
  };

  const COLORS = {
    sky: "#bfe9ff",
    ground: "#d8c07a",
    groundAlt: "#b89d57",
    upper: "#cfc3a0",
    upperAlt: "#b8ab86",
    ladder: "#8a6b3f",
    ladderRung: "#5b4526",
    line: "#000000",
    siteA: "rgba(255, 180, 80, 0.95)",
    siteB: "rgba(90, 170, 255, 0.95)"
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function getGroundY(canvasHeight) {
    return canvasHeight - GROUND_ROWS * TILE;
  }

  function buildGeometry(canvasHeight) {
    const groundY = getGroundY(canvasHeight);
    const upperY = groundY - UPPER_PLATFORM.yOffsetTiles * TILE;

    const groundRect = {
      x: 0,
      y: groundY,
      w: WORLD_WIDTH,
      h: GROUND_ROWS * TILE,
      type: "ground"
    };

    const upperRect = {
      x: UPPER_PLATFORM.x,
      y: upperY,
      w: UPPER_PLATFORM.w,
      h: UPPER_PLATFORM.h,
      type: "upper"
    };

    const ladderRect = {
      x: LADDER.x,
      y: upperY,
      w: LADDER.w,
      h: groundY - upperY
    };

    return {
      groundY,
      upperY,
      groundRect,
      upperRect,
      ladderRect
    };
  }

  function getEntityLayer(entity, canvasHeight) {
    const geom = buildGeometry(canvasHeight);
    const bodyBottom = entity.y + entity.h;
    if (bodyBottom <= geom.upperY + 10) return "upper";
    return "lower";
  }

  function isNearLadder(entity, canvasHeight, padding = 20) {
    const geom = buildGeometry(canvasHeight);
    const r = geom.ladderRect;
    return rectsOverlap(
      entity.x,
      entity.y,
      entity.w,
      entity.h,
      r.x - padding,
      r.y,
      r.w + padding * 2,
      r.h
    );
  }

  function getLadderCenterX(canvasHeight) {
    const geom = buildGeometry(canvasHeight);
    return geom.ladderRect.x + geom.ladderRect.w / 2;
  }

  function useLadder(entity, canvasHeight) {
    if (!isNearLadder(entity, canvasHeight, 18)) return false;

    const geom = buildGeometry(canvasHeight);
    const ladderCenterX = geom.ladderRect.x + geom.ladderRect.w / 2;

    const upperLeft = UPPER_PLATFORM.x + 4;
    const upperRight = UPPER_PLATFORM.x + UPPER_PLATFORM.w - entity.w - 4;
    const ladderAlignedX = clamp(ladderCenterX - entity.w / 2, upperLeft, upperRight);

    const currentLayer = getEntityLayer(entity, canvasHeight);

    if (currentLayer === "lower") {
      entity.x = ladderAlignedX;
      entity.y = geom.upperY - entity.h;
      entity.vx = 0;
      entity.vy = 0;
      entity.onGround = true;
      return true;
    }

    entity.x = ladderAlignedX;
    entity.y = geom.groundY - entity.h;
    entity.vx = 0;
    entity.vy = 0;
    entity.onGround = true;
    return true;
  }

  function getSpawnPoint(team, canvasHeight, elevated = false, slot = 0) {
    const geom = buildGeometry(canvasHeight);

    if (elevated) {
      const upperTop = geom.upperY - 102;
      const spacing = 130;
      const maxSlots = Math.max(1, Math.floor((UPPER_PLATFORM.w - 220) / spacing));
      const safeSlot = clamp(slot, 0, maxSlots);

      if (team === "ally") {
        const x = clamp(
          UPPER_PLATFORM.x + 90 + safeSlot * spacing,
          UPPER_PLATFORM.x + 12,
          UPPER_PLATFORM.x + UPPER_PLATFORM.w - 68 - 12
        );
        return { x, y: upperTop };
      }

      const x = clamp(
        UPPER_PLATFORM.x + UPPER_PLATFORM.w - 90 - 68 - safeSlot * spacing,
        UPPER_PLATFORM.x + 12,
        UPPER_PLATFORM.x + UPPER_PLATFORM.w - 68 - 12
      );
      return { x, y: upperTop };
    }

    const groundTop = geom.groundY - 102;
    const spacing = 120;

    if (team === "ally") {
      const x = clamp(120 + slot * spacing, 40, WORLD_WIDTH - 68 - 40);
      return { x, y: groundTop };
    }

    const x = clamp(WORLD_WIDTH - 120 - 68 - slot * spacing, 40, WORLD_WIDTH - 68 - 40);
    return { x, y: groundTop };
  }

  function resolveEntity(entity, oldX, oldY, canvasHeight) {
    const geom = buildGeometry(canvasHeight);
    const solids = [geom.groundRect, geom.upperRect];

    entity.onGround = false;
    entity.x = clamp(entity.x, 0, WORLD_WIDTH - entity.w);

    for (const s of solids) {
      if (!rectsOverlap(entity.x, entity.y, entity.w, entity.h, s.x, s.y, s.w, s.h)) continue;

      if (entity.x > oldX) {
        entity.x = s.x - entity.w;
        entity.vx = 0;
      } else if (entity.x < oldX) {
        entity.x = s.x + s.w;
        entity.vx = 0;
      }
    }

    for (const s of solids) {
      if (!rectsOverlap(entity.x, entity.y, entity.w, entity.h, s.x, s.y, s.w, s.h)) continue;

      if (entity.y > oldY) {
        entity.y = s.y - entity.h;
        entity.vy = 0;
        entity.onGround = true;
      } else if (entity.y < oldY) {
        entity.y = s.y + s.h;
        entity.vy = 0;
      }
    }

    if (entity.y + entity.h >= geom.groundY) {
      entity.y = geom.groundY - entity.h;
      entity.vy = 0;
      entity.onGround = true;
    }
  }

  function drawLabel(ctx, x, y, text, color) {
    ctx.save();
    ctx.font = "bold 18px Arial";
    const w = Math.max(54, ctx.measureText(text).width + 22);
    const h = 28;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 11, y + h / 2 + 1);
    ctx.restore();
  }

  function drawMap1(ctx, canvas, cameraX) {
    const w = canvas.width;
    const h = canvas.height;
    const t = TILE;
    const geom = buildGeometry(h);

    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, w, h);

    const startCol = Math.floor(cameraX / t) - 2;
    const endCol = Math.ceil((cameraX + w) / t) + 2;

    for (let col = startCol; col <= endCol; col++) {
      for (let row = 0; row < GROUND_ROWS; row++) {
        const x = col * t - cameraX;
        const y = geom.groundY + row * t;

        if (x + t < 0 || x > w) continue;

        ctx.fillStyle = ((col + row) % 4 === 0) ? COLORS.groundAlt : COLORS.ground;
        ctx.fillRect(x, y, t, t);
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, t, t);
      }
    }

    const upperStartCol = Math.floor(UPPER_PLATFORM.x / t) - 1;
    const upperEndCol = Math.ceil((UPPER_PLATFORM.x + UPPER_PLATFORM.w) / t) + 1;
    const upperRows = Math.floor(UPPER_PLATFORM.h / t);

    for (let col = upperStartCol; col <= upperEndCol; col++) {
      for (let row = 0; row < upperRows; row++) {
        const x = col * t - cameraX;
        const y = geom.upperY + row * t;

        if (x + t < 0 || x > w) continue;
        if (x + t <= UPPER_PLATFORM.x - cameraX || x >= UPPER_PLATFORM.x + UPPER_PLATFORM.w - cameraX) continue;

        ctx.fillStyle = ((col + row) % 3 === 0) ? COLORS.upperAlt : COLORS.upper;
        ctx.fillRect(x, y, t, t);
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, t, t);
      }
    }

    const ladderX = geom.ladderRect.x - cameraX;
    const ladderY = geom.ladderRect.y;
    const ladderW = geom.ladderRect.w;
    const ladderH = geom.ladderRect.h;

    ctx.save();
    ctx.fillStyle = COLORS.ladder;
    ctx.fillRect(ladderX, ladderY, ladderW, ladderH);

    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(ladderX, ladderY, ladderW, ladderH);

    ctx.fillStyle = COLORS.ladderRung;
    for (let y = ladderY + 8; y < ladderY + ladderH - 8; y += 18) {
      ctx.fillRect(ladderX - 6, y, ladderW + 12, 4);
    }
    ctx.restore();

    const siteA = {
      x: BOMBSITE_A.x - cameraX,
      y: geom.groundY - BOMBSITE_A.yOffsetTiles * TILE - 8
    };
    const siteB = {
      x: BOMBSITE_B.x - cameraX,
      y: geom.groundY - BOMBSITE_B.yOffsetTiles * TILE - 8
    };

    drawLabel(ctx, siteA.x, siteA.y, "A 点", COLORS.siteA);
    drawLabel(ctx, siteB.x, siteB.y, "B 点", COLORS.siteB);

    drawLabel(ctx, 18, 18, "爆破地图原型", "rgba(0,0,0,0.72)");

    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, geom.groundY);
    ctx.lineTo(w, geom.groundY);
    ctx.stroke();

    const leftEdgeX = 0 - cameraX;
    const rightEdgeX = WORLD_WIDTH - cameraX;

    if (leftEdgeX >= 0 && leftEdgeX <= w) {
      ctx.beginPath();
      ctx.moveTo(leftEdgeX, geom.groundY);
      ctx.lineTo(leftEdgeX, h);
      ctx.stroke();
    }

    if (rightEdgeX >= 0 && rightEdgeX <= w) {
      ctx.beginPath();
      ctx.moveTo(rightEdgeX, geom.groundY);
      ctx.lineTo(rightEdgeX, h);
      ctx.stroke();
    }
  }

  window.Map1 = {
    tileSize: TILE,
    width: WORLD_WIDTH,
    height: 18 * TILE,
    getGroundY,
    buildGeometry,
    resolveEntity,
    drawMap1,
    getSpawnPoint,
    useLadder,
    isNearLadder,
    getEntityLayer,
    getLadderCenterX
  };
})();