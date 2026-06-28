const fs = require('fs');
const path = require('path');

const DIR = path.join('assets', 'resources', 'data', 'levels');
const START = 101;
const TILE_W = 120;
const TILE_H = 144;
const JITTER_X = 0.5;
const JITTER_Y = 0.6;
const SAFE = { minX: -500, maxX: 500, minY: -500, maxY: 500 };
const GROUPS = Array.from({ length: 18 }, (_, i) => String(i));

const SHAPES = [
  ['diamond_seed', ['.##.', '####', '#.##']],
  ['cross_gate', ['####', '.##.', '####']],
  ['mirror_frame', ['####', '#..#', '####']],
  ['x_knot', ['#..#', '####', '.##.', '####']],
  ['hourglass_path', ['####', '.##.', '####', '.##.']],
  ['chevron_shield', ['.##.', '####', '.###', '..#.']],
  ['crown_step', ['#..#', '####', '####', '.##.']],
  ['lantern_core', ['.##.', '####', '#..#', '####']],
  ['woven_star', ['.#.#.', '#####', '.###.', '#####']],
  ['totem_gate', ['#####', '..#..', '#.#.#', '#####']],
  ['double_wave', ['##..#', '.####', '####.', '#..##']],
  ['bowtie_gem', ['##.##', '.###.', '..#..', '.###.', '##.##']],
  ['arrow_gem', ['..#..', '.###.', '#####', '.##..', '.##..']],
  ['side_gate', ['###.#', '#.#.#', '###.#', '..###']],
  ['oval_seal', ['..#..', '.###.', '#####', '.###.', '..##.']],
  ['rune_bridge', ['#####', '.#.#.', '.###.', '.#.#.', '#####']],
  ['lotus_mark', ['.#.#.', '#####', '.###.', '##.##', '.###.']],
  ['spire_ring', ['..#..', '.###.', '##.##', '.###.', '##.##']],
  ['split_crown', ['#.#.#', '#####', '.###.', '##.##', '#####']],
  ['solar_cross', ['.###.', '##..#', '#...#', '#..##', '#####']],
  ['moon_gate', ['.####', '##..#', '#...#', '##..#', '.####']],
  ['twin_arrow', ['#...#', '##.##', '.###.', '##.##', '#...#']],
  ['crystal_fan', ['..#..', '.###.', '#####', '##.##', '#...#']],
  ['helm_shape', ['#####', '#.#.#', '.###.', '#####', '##.##']],
  ['temple_eye', ['#####', '#...#', '##.##', '#...#', '#####']],
  ['spiral_step', ['####.', '#..#.', '#.###', '#...#', '#####']],
  ['anchor_mark', ['..#..', '#####', '..#..', '#####', '.###.']],
  ['comet_lane', ['###..', '.####', '..###', '####.', '##.##']],
  ['butterfly', ['##.##', '#####', '.###.', '#####', '##.##']],
  ['stacked_vase', ['.###.', '#####', '.#.#.', '.###.', '#####']],
  ['orbit_frame', ['.####.', '######', '#.##.#', '######', '.####.']],
  ['mask_shape', ['##.##.', '######', '#.##.#', '.####.', '##..##']],
  ['trident_core', ['#.#.#.', '######', '..##..', '.####.', '######']],
  ['leaf_diamond', ['..##..', '.####.', '######', '.####.', '##..##']],
  ['trophy_gate', ['.####.', '######', '..##..', '.####.', '##..##']],
  ['hourglass_crown', ['######', '.####.', '..##..', '.####.', '######']],
  ['broken_ring', ['#####.', '#...#.', '#.###.', '#..##.', '.####.']],
  ['wave_totem', ['##..##', '.####.', '####.#', '#..###', '.####.']],
  ['star_forge', ['.#.##.', '######', '.####.', '######', '##.#..']],
  ['shield_rune', ['.####.', '######', '#.##.#', '.####.', '..##..']],
  ['circuit_gem', ['###.##', '#.##.#', '######', '#.##.#', '##.###']],
  ['royal_gate', ['#.##.#', '######', '.####.', '#.##.#', '######']],
  ['double_spire', ['#..#.#', '######', '..##..', '.####.', '##..##']],
  ['lotus_shield', ['.####.', '######', '##.###', '.####.', '######']],
  ['zigzag_crown', ['##..##', '.#####', '###.##', '#.####', '##..##']],
  ['sunken_cross', ['######', '..##..', '######', '..##..', '######']],
  ['compass_mark', ['..##..', '#.##.#', '######', '#.##.#', '..##..']],
  ['mirror_lantern', ['.####.', '##..##', '######', '##..##', '.####.']],
  ['master_emblem', ['#.##.#', '######', '.####.', '######', '#.##.#']],
  ['final_totem', ['.####.', '######', '##.###', '.####.', '..##..']],
];

function pad(n) { return String(n).padStart(3, '0'); }
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function round(n) { return Math.round(n * 100) / 100; }
function key(c) { return `${c.x},${c.y}`; }

function cellsFromRows(rows) {
  const cells = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] === '#') cells.push({ x, y });
    }
  }
  return cells;
}

function cellsFromPattern(pattern) {
  const cells = [];
  for (let y = 0; y < pattern.length; y++) {
    for (let x = 0; x < pattern[y].length; x++) {
      if (pattern[y][x]) cells.push({ x, y });
    }
  }
  return cells;
}

function patternFromCells(cells) {
  const rows = Math.max(...cells.map(c => c.y)) + 1;
  const cols = Math.max(...cells.map(c => c.x)) + 1;
  const p = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const c of cells) p[c.y][c.x] = 1;
  return p;
}

function componentCount(cells) {
  const set = new Set(cells.map(key));
  const seen = new Set();
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let count = 0;

  for (const start of set) {
    if (seen.has(start)) continue;
    count++;
    const q = [start];
    seen.add(start);
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i].split(',').map(Number);
      for (const [dx, dy] of dirs) {
        const nk = `${x + dx},${y + dy}`;
        if (set.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          q.push(nk);
        }
      }
    }
  }
  return count;
}

function targetTiles(idx) { return 15 + 3 * Math.floor(idx / 4); }
function maxLayersFor(idx) { return idx < 8 ? 2 : idx < 18 ? 3 : idx < 32 ? 4 : 5; }

function layerJitter(layer, axis, config) {
  const seed = Math.abs(layer * 15485863 + axis * 32452843);
  const mult = axis === 0 ? (config.jitterX ?? JITTER_X) : (config.jitterY ?? JITTER_Y);
  const size = axis === 0 ? (config.tileWidth ?? TILE_W) : (config.tileHeight ?? TILE_H);
  return ((seed % 100) / 100 - 0.5) * size * mult;
}

function center(tile, config) {
  return {
    x: config.centerOffset.x + tile.gridX * (config.tileSpacingX ?? config.tileSpacing) + layerJitter(tile.layer, 0, config),
    y: config.centerOffset.y - tile.gridY * (config.tileSpacingY ?? config.tileSpacing) + layerJitter(tile.layer, 1, config),
  };
}

function bounds(tiles, config) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of tiles) {
    const p = center(t, config);
    minX = Math.min(minX, p.x - config.tileWidth / 2);
    maxX = Math.max(maxX, p.x + config.tileWidth / 2);
    minY = Math.min(minY, p.y - config.tileHeight / 2);
    maxY = Math.max(maxY, p.y + config.tileHeight / 2);
  }
  return { minX: round(minX), maxX: round(maxX), minY: round(minY), maxY: round(maxY) };
}

function fits(b) {
  return b.minX >= SAFE.minX && b.maxX <= SAFE.maxX && b.minY >= SAFE.minY && b.maxY <= SAFE.maxY;
}

function dist(c, cx, cy) {
  return Math.abs(c.x - cx) + Math.abs(c.y - cy);
}

function buildDepths(cells, target, maxLayers, idx) {
  const depths = new Map(cells.map(c => [key(c), 1]));
  let total = cells.length;
  const cx = (Math.min(...cells.map(c => c.x)) + Math.max(...cells.map(c => c.x))) / 2;
  const cy = (Math.min(...cells.map(c => c.y)) + Math.max(...cells.map(c => c.y))) / 2;
  const core = [...cells].sort((a, b) => dist(a, cx, cy) - dist(b, cx, cy) || a.y - b.y || a.x - b.x);

  const deepStacks = Math.max(1, Math.min(core.length, Math.floor((idx + 4) / 8)));
  for (let i = 0; i < deepStacks && total < target; i++) {
    const k = key(core[i]);
    while (depths.get(k) < maxLayers && total < target) {
      depths.set(k, depths.get(k) + 1);
      total++;
    }
  }

  let cursor = idx % core.length;
  while (total < target) {
    let added = false;
    for (let tries = 0; tries < core.length && total < target; tries++) {
      const c = core[(cursor + tries) % core.length];
      const k = key(c);
      if (depths.get(k) < maxLayers) {
        depths.set(k, depths.get(k) + 1);
        total++;
        added = true;
      }
    }
    cursor = (cursor + 3) % core.length;
    if (!added) break;
  }
  return depths;
}

function recenter(config, tiles) {
  const minX = Math.min(...tiles.map(t => t.gridX));
  const maxX = Math.max(...tiles.map(t => t.gridX));
  const minY = Math.min(...tiles.map(t => t.gridY));
  const maxY = Math.max(...tiles.map(t => t.gridY));
  const layers = [...new Set(tiles.map(t => t.layer))];
  const avgJx = layers.reduce((s, l) => s + layerJitter(l, 0, config), 0) / layers.length;
  const avgJy = layers.reduce((s, l) => s + layerJitter(l, 1, config), 0) / layers.length;
  config.centerOffset = {
    x: round(-((minX + maxX) / 2) * (config.tileSpacingX ?? config.tileSpacing) - avgJx),
    y: round(((minY + maxY) / 2) * (config.tileSpacingY ?? config.tileSpacing) - avgJy),
  };
}

function solutionOrder(tiles) {
  return [...tiles].sort((a, b) => {
    if (a.layer !== b.layer) return b.layer - a.layer;
    if (a.gridY !== b.gridY) return a.gridY - b.gridY;
    return a.gridY % 2 === 0 ? a.gridX - b.gridX : b.gridX - a.gridX;
  });
}

function overlapArea(a, b, config) {
  const ca = center(a, config);
  const cb = center(b, config);
  return Math.max(0, config.tileWidth - Math.abs(ca.x - cb.x)) *
    Math.max(0, config.tileHeight - Math.abs(ca.y - cb.y));
}

function computeBlockStatus(tiles, config) {
  const minOverlap = Math.max(config.minBlockOverlapPixels ?? 1, config.tileWidth * config.tileHeight * (config.coverThreshold ?? 0.01));
  for (const t of tiles) {
    if (!t.active) {
      t.selectable = false;
      t.isBlocked = true;
      continue;
    }
    let blocked = false;
    for (const o of tiles) {
      if (o.id === t.id || !o.active || o.layer <= t.layer) continue;
      if (overlapArea(t, o, config) > minOverlap) {
        blocked = true;
        break;
      }
    }
    t.isBlocked = blocked;
    t.selectable = !blocked;
  }
}

function selectable(activeTiles, config = null) {
  if (config) {
    computeBlockStatus(activeTiles, config);
    return activeTiles.filter(t => t.active && t.selectable);
  }
  return activeTiles.filter(t => !activeTiles.some(o => o.id !== t.id && o.active && o.gridX === t.gridX && o.gridY === t.gridY && o.layer > t.layer));
}

function isSelectableAfterRemoving(activeIds, removeId, targetId, byId, config) {
  const activeTiles = [...activeIds]
    .filter(id => id !== removeId)
    .map(id => byId.get(id))
    .filter(Boolean);
  return selectable(activeTiles, config).some(t => t.id === targetId);
}

function wouldCreateBadOrder(sequence, rank, tile, newGroupId) {
  const orderIndex = Math.floor(rank.get(tile.id) / 3);
  const orderStart = orderIndex * 3;
  const items = sequence.slice(orderStart, orderStart + 3).map(t => t.id === tile.id ? newGroupId : t.groupId);
  if (items.length === 3 && new Set(items).size === 1) return true;

  const prev = orderIndex > 0 ? sequence.slice(orderStart - 3, orderStart).map(t => t.groupId).join(',') : '';
  const next = sequence.slice(orderStart + 3, orderStart + 6).map(t => t.groupId).join(',');
  const current = items.join(',');
  return current === prev || (next.length > 0 && current === next);
}

function addDecoys(tiles, sequence, idx, board) {
  const byId = new Map(tiles.map(t => [t.id, t]));
  const rank = new Map(sequence.map((t, i) => [t.id, i]));
  const active = new Set(tiles.map(t => t.id));
  const limit = Math.min(sequence.length - 5, idx < 6 ? 4 : 7 + Math.floor(idx * 0.7));
  const totalCap = Math.min(
    sequence.length - 3,
    idx < 6 ? 0 :
      idx < 12 ? Math.max(2, Math.floor(sequence.length * 0.12)) :
        idx < 22 ? Math.max(7, Math.floor(sequence.length * 0.34)) :
          idx < 34 ? Math.max(11, Math.floor(sequence.length * 0.42)) :
            Math.max(15, Math.floor(sequence.length * 0.5))
  );
  const perFutureOrderTargetCap = idx < 12 ? 1 : idx < 22 ? 2 : idx < 38 ? 3 : 4;
  const futureOrderTargetCounts = new Map();
  let decoyCount = 0;

  const desiredChoiceCount = (step) => {
    if (idx < 6) return 1;
    if (idx < 12) return 1 + (step >= 6 && step % 4 === 0 ? 1 : 0);
    if (idx < 22) return 2 + (step % 3 === 0 ? 1 : 0);
    if (idx < 34) return 3 + (step % 2 === 0 ? 1 : 0);
    return 4 + (step % 3 === 0 ? 1 : 0);
  };

  for (let step = 0; step < limit; step++) {
    if (decoyCount >= totalCap) break;
    const chosen = sequence[step];
    const currentSelectable = selectable([...active].map(id => byId.get(id)), board);
    const currentChoices = currentSelectable.filter(t => t.groupId === chosen.groupId).length;
    const needed = Math.max(0, desiredChoiceCount(step) - currentChoices);
    if (needed <= 0) {
      active.delete(chosen.id);
      continue;
    }

    const criticalWindow = sequence.slice(step + 1, Math.min(sequence.length, step + 6));
    const candidates = selectable([...active].map(id => byId.get(id)), board)
      .filter(t => {
        if (t.id === chosen.id) return false;
        if (rank.get(t.id) <= step + 3) return false;
        if (t.strategyRole) return false;
        const futureOrder = Math.floor(rank.get(t.id) / 3);
        const k = `${futureOrder}:${chosen.groupId}`;
        return (futureOrderTargetCounts.get(k) || 0) < perFutureOrderTargetCap;
      })
      .map(t => ({
        tile: t,
        immediateTrap: criticalWindow.some(target =>
          target.id !== t.id &&
          isSelectableAfterRemoving(active, chosen.id, target.id, byId, board) &&
          !isSelectableAfterRemoving(active, t.id, target.id, byId, board)
        ),
      }));
    if (candidates.length) {
      candidates.sort((a, b) =>
        Number(b.immediateTrap) - Number(a.immediateTrap) ||
        rank.get(b.tile.id) - rank.get(a.tile.id) ||
        a.tile.layer - b.tile.layer
      );
      const take = Math.min(needed, candidates.length, totalCap - decoyCount);
      const used = new Set();
      for (let i = 0; i < take; i++) {
        const picked = candidates[i] || candidates[(step + idx + i) % candidates.length];
        const decoy = picked.tile;
        if (used.has(decoy.id)) continue;
        used.add(decoy.id);
        if (decoy.id === chosen.id) continue;
        if (wouldCreateBadOrder(sequence, rank, decoy, chosen.groupId)) continue;
        decoy.groupId = chosen.groupId;
        decoy.strategyRole = picked.immediateTrap ? 'critical_path_decoy' : 'same_item_path_decoy';
        decoy.decoyForStep = step + 1;
        decoy.decoyAgainstKeyTile = chosen.id;
        const futureOrder = Math.floor(rank.get(decoy.id) / 3);
        const k = `${futureOrder}:${chosen.groupId}`;
        futureOrderTargetCounts.set(k, (futureOrderTargetCounts.get(k) || 0) + 1);
        decoyCount++;
      }
    }
    active.delete(chosen.id);
  }
}

function addOpeningAmbiguity(tiles, sequence, idx, board) {
  const rank = new Map(sequence.map((t, i) => [t.id, i]));
  const openingTiles = selectable(tiles, board).filter(t => rank.get(t.id) > 2);
  const used = new Set(tiles.filter(t => t.strategyRole).map(t => t.id));
  const totalCap = idx < 6 ? 0 : idx < 12 ? 2 : idx < 22 ? 6 : idx < 34 ? 9 : 12;
  const desired = idx < 6 ? 1 : idx < 12 ? 2 : idx < 22 ? 3 : idx < 34 ? 4 : 5;
  let changes = 0;

  for (let step = 0; step < Math.min(10, sequence.length - 3) && changes < totalCap; step++) {
    const chosen = sequence[step];
    const currentChoices = openingTiles.filter(t => t.groupId === chosen.groupId).length;
    let needed = Math.max(0, desired - currentChoices);
    if (needed === 0) continue;

    const candidates = openingTiles
      .filter(t => t.id !== chosen.id && !used.has(t.id) && rank.get(t.id) > step + 3)
      .sort((a, b) => rank.get(b.id) - rank.get(a.id) || a.layer - b.layer);

    for (const decoy of candidates) {
      if (needed <= 0 || changes >= totalCap) break;
      if (wouldCreateBadOrder(sequence, rank, decoy, chosen.groupId)) continue;
      decoy.groupId = chosen.groupId;
      decoy.strategyRole = 'opening_same_item_decoy';
      decoy.decoyForStep = step + 1;
      decoy.decoyAgainstKeyTile = chosen.id;
      used.add(decoy.id);
      changes++;
      needed--;
    }
  }
}

function layerVisibilityMetrics(maxLayers, config) {
  const area = config.tileWidth * config.tileHeight;
  const pairs = [];
  for (let layer = 0; layer < maxLayers - 1; layer++) {
    const a = { gridX: 0, gridY: 0, layer };
    const b = { gridX: 0, gridY: 0, layer: layer + 1 };
    const visibleRatio = 1 - overlapArea(a, b, config) / area;
    pairs.push({ lowerLayer: layer, upperLayer: layer + 1, visibleRatio: round(visibleRatio) });
  }
  return pairs;
}

function validate(level) {
  const errors = [];
  const b = bounds(level.tiles, level.board);
  if (!fits(b)) errors.push(`bounds overflow ${JSON.stringify(b)}`);
  if (level.tiles.length !== level.solutionMoveTileIds.length) errors.push('solution count mismatch');
  if (level.tiles.length !== level.orders.reduce((s, o) => s + o.items.length, 0)) errors.push('order count mismatch');
  if (componentCount(cellsFromPattern(level.board.shapePattern)) !== 1) errors.push('shape disconnected');
  for (let i = 0; i < level.orders.length; i++) {
    const items = level.orders[i].items;
    if (new Set(items).size === 1) errors.push(`monotone order ${i + 1}: ${items.join('-')}`);
    if (i > 0 && items.join(',') === level.orders[i - 1].items.join(',')) {
      errors.push(`repeated adjacent order ${i + 1}: ${items.join('-')}`);
    }
  }

  for (const pair of layerVisibilityMetrics(level.board.maxLayers, level.board)) {
    if (pair.visibleRatio < 0.33 || pair.visibleRatio > 0.5) {
      errors.push(`layer visibility out of range ${JSON.stringify(pair)}`);
    }
  }

  const sim = level.tiles.map(t => ({ ...t, active: true }));
  const byId = new Map(sim.map(t => [t.id, t]));
  computeBlockStatus(sim, level.board);
  let oi = 0, ii = 0;
  for (let i = 0; i < level.solutionMoveTileIds.length; i++) {
    const t = byId.get(level.solutionMoveTileIds[i]);
    if (!t) { errors.push(`missing move ${i + 1}`); continue; }
    if (!t.selectable) errors.push(`blocked move ${i + 1} ${t.id}`);
    const expected = level.orders[oi]?.items[ii];
    if (t.groupId !== expected) errors.push(`wrong order move ${i + 1}: ${t.groupId} expected ${expected}`);
    t.active = false;
    ii++;
    if (ii >= 3) { oi++; ii = 0; }
    computeBlockStatus(sim, level.board);
  }
  if (sim.some(t => t.active)) errors.push('board not cleared');
  return { errors, bounds: b };
}

function choiceMetrics(level) {
  const sim = level.tiles.map(t => ({ ...t, active: true }));
  const byId = new Map(sim.map(t => [t.id, t]));
  let sumSelectable = 0;
  let sumSameItemChoices = 0;
  let maxSameItemChoices = 0;
  let firstTenSameItemChoices = [];

  for (let step = 0; step < level.solutionMoveTileIds.length; step++) {
    computeBlockStatus(sim, level.board);
    const selectableTiles = sim.filter(t => t.active && t.selectable);
    const expected = level.orders[Math.floor(step / 3)]?.items[step % 3];
    const sameItemChoices = selectableTiles.filter(t => t.groupId === expected).length;
    sumSelectable += selectableTiles.length;
    sumSameItemChoices += sameItemChoices;
    maxSameItemChoices = Math.max(maxSameItemChoices, sameItemChoices);
    if (firstTenSameItemChoices.length < 10) {
      firstTenSameItemChoices.push(sameItemChoices);
    }

    const move = byId.get(level.solutionMoveTileIds[step]);
    if (move) move.active = false;
  }

  const steps = Math.max(1, level.solutionMoveTileIds.length);
  return {
    averageSelectableTilesDuringSolution: round(sumSelectable / steps),
    averageSameItemChoicesDuringSolution: round(sumSameItemChoices / steps),
    maxSameItemChoicesDuringSolution: maxSameItemChoices,
    firstTenSameItemChoices,
  };
}

function branchDifficultyMetrics(level) {
  const tiles = level.tiles;
  const byId = new Map(tiles.map(t => [t.id, t]));
  const orderItems = level.orders.flatMap(o => o.items);
  const memo = new Map();

  const activeKey = (activeIds, step) => `${step}|${[...activeIds].sort().join(',')}`;
  const correctChoices = (activeIds, step) => {
    const activeTiles = [...activeIds].map(id => byId.get(id)).filter(Boolean);
    const expected = orderItems[step];
    return selectable(activeTiles, level.board).filter(t => t.groupId === expected).map(t => t.id);
  };

  const canWin = (activeIds, step) => {
    if (step >= orderItems.length) return activeIds.size === 0;
    const k = activeKey(activeIds, step);
    if (memo.has(k)) return memo.get(k);
    const choices = correctChoices(activeIds, step);
    let ok = false;
    for (const id of choices) {
      const next = new Set(activeIds);
      next.delete(id);
      if (canWin(next, step + 1)) {
        ok = true;
        break;
      }
    }
    memo.set(k, ok);
    return ok;
  };

  let active = new Set(tiles.map(t => t.id));
  let forcedSteps = 0;
  let realTrapSteps = 0;
  let harmlessAmbiguousSteps = 0;
  let totalCorrectChoices = 0;
  let totalWinningChoices = 0;
  const firstTenBranching = [];

  for (let step = 0; step < orderItems.length; step++) {
    const choices = correctChoices(active, step);
    const winning = [];
    for (const id of choices) {
      const next = new Set(active);
      next.delete(id);
      if (canWin(next, step + 1)) winning.push(id);
    }

    totalCorrectChoices += choices.length;
    totalWinningChoices += winning.length;
    if (choices.length <= 1) forcedSteps++;
    else if (winning.length < choices.length) realTrapSteps++;
    else harmlessAmbiguousSteps++;
    if (firstTenBranching.length < 10) {
      firstTenBranching.push({ choices: choices.length, winning: winning.length });
    }

    active.delete(level.solutionMoveTileIds[step]);
  }

  const steps = Math.max(1, orderItems.length);
  return {
    forcedSteps,
    realTrapSteps,
    harmlessAmbiguousSteps,
    averageCorrectChoices: round(totalCorrectChoices / steps),
    averageWinningChoices: round(totalWinningChoices / steps),
    firstTenBranching,
  };
}

function makeLevel(idx) {
  const levelId = START + idx;
  const [shapeName, shapeRows] = SHAPES[idx];
  const cells = cellsFromRows(shapeRows);
  const target = targetTiles(idx);
  const maxLayers = maxLayersFor(idx);
  const depths = buildDepths(cells, target, maxLayers, idx);
  const tiles = [];
  let id = 0;

  for (const c of cells) {
    const depth = depths.get(key(c));
    for (let layer = 0; layer < depth; layer++) {
      tiles.push({
        id: `L${levelId}_T${pad(id++)}`,
        groupId: '0',
        tileType: 0,
        gridX: c.x,
        gridY: c.y,
        layer,
        active: true,
        selectable: true,
        isBlocked: false,
        clusteredLayout: false,
        clusterCount: 1,
        sameLayerOverlapForbidden: true,
        designRole: layer === 0 ? 'bottom' : layer === depth - 1 ? 'top' : 'middle',
      });
    }
  }

  const cols = shapeRows[0].length;
  const rows = shapeRows.length;
  const board = {
    rows,
    cols,
    maxLayers: Math.max(...tiles.map(t => t.layer)) + 1,
    tileSpacing: cols >= 6 ? 136 : cols === 5 ? 146 : 154,
    tileSpacingY: rows >= 5 ? 154 : 168,
    centerOffset: { x: 0, y: 0 },
    tileWidth: TILE_W,
    tileHeight: TILE_H,
    jitterX: JITTER_X,
    jitterY: JITTER_Y,
    jitterMode: 'layer_visible_mixed_shape',
    blockMode: 'overlap',
    minBlockOverlapPixels: Math.ceil(TILE_W * TILE_H * 0.01),
    coverThreshold: 0.01,
    shapePattern: patternFromCells(cells),
    shapeName,
  };
  recenter(board, tiles);

  const sequence = solutionOrder(tiles);
  const groupSpan = idx < 10 ? 12 : idx < 24 ? 14 : idx < 38 ? 16 : 18;
  const assignedGroups = [];
  for (let s = 0; s < sequence.length; s++) {
    const orderIndex = Math.floor(s / 3);
    const itemIndex = s % 3;
    const tile = sequence[s];
    let gid = (
      idx * 11 +
      orderIndex * 7 +
      itemIndex * 5 +
      ((orderIndex + 3) * (orderIndex + idx + 5)) +
      tile.gridX * 3 +
      tile.gridY * 5 +
      tile.layer * 7
    ) % groupSpan;

    // Avoid low-effort orders like A-A-B or repeating the exact previous order.
    while (itemIndex > 0 && gid === assignedGroups[s - 1]) gid = (gid + 1) % groupSpan;
    if (itemIndex === 2 && gid === assignedGroups[s - 2]) gid = (gid + 2) % groupSpan;
    if (orderIndex > 0 && itemIndex === 2) {
      const prev = assignedGroups.slice(s - 5, s - 2).join(',');
      let current = [assignedGroups[s - 2], assignedGroups[s - 1], gid].join(',');
      while (current === prev) {
        gid = (gid + 3) % groupSpan;
        current = [assignedGroups[s - 2], assignedGroups[s - 1], gid].join(',');
      }
    }

    assignedGroups[s] = gid;
    sequence[s].groupId = GROUPS[gid];
  }
  addDecoys(tiles, sequence, idx, board);
  addOpeningAmbiguity(tiles, sequence, idx, board);

  const solutionMoveTileIds = sequence.map(t => t.id);
  const orders = [];
  const solutionOrders = [];
  for (let i = 0; i < sequence.length; i += 3) {
    const items = sequence.slice(i, i + 3).map(t => t.groupId);
    orders.push({ id: `order_${pad(i / 3 + 1)}`, items });
    solutionOrders.push(items);
  }
  computeBlockStatus(tiles, board);

  const level = {
    levelId,
    displayName: `Level ${pad(levelId)} - ${shapeName}`,
    defaultSkin: 'uma',
    gameMode: 'ORDER_MATCH',
    board,
    tray: { maxSlots: 7, matchCount: 3, screenPosition: { x: 540, y: 200 }, slotSpacing: 110 },
    orderConfig: { orderSize: 3, orderMode: 'EXACT_ORDER', wrongTrayMaxSlots: 1, consumeWrongTile: true },
    orders,
    solutionOrders,
    solutionMoveTileIds,
    tiles,
    starThresholds: [0, 500, 1000],
    difficultyMetrics: {},
  };

  const result = validate(level);
  if (result.errors.length) throw new Error(`level ${levelId} invalid:\n${result.errors.join('\n')}`);
  const choices = choiceMetrics(level);
  const branch = branchDifficultyMetrics(level);

  const layerCounts = {};
  for (const t of tiles) layerCounts[`layer_${t.layer}`] = (layerCounts[`layer_${t.layer}`] || 0) + 1;

  level.difficultyMetrics = {
    designType: 'handcrafted_progressive_order_match_120x144_v5_visible_layers',
    difficultyBand: idx < 10 ? 'tutorial_plus' : idx < 22 ? 'easy_mid' : idx < 34 ? 'advanced' : idx < 44 ? 'expert' : 'master',
    difficultyIndex: idx + 1,
    shapeName,
    totalTiles: tiles.length,
    orderCount: orders.length,
    maxLayers: board.maxLayers,
    startingSelectableTiles: selectable(tiles).length,
    sameItemPathDecoyCount: tiles.filter(t => t.strategyRole === 'same_item_path_decoy').length,
    criticalPathDecoyCount: tiles.filter(t => t.strategyRole === 'critical_path_decoy').length,
    openingSameItemDecoyCount: tiles.filter(t => t.strategyRole === 'opening_same_item_decoy').length,
    totalStrategicDecoyCount: tiles.filter(t => !!t.strategyRole).length,
    averageSelectableTilesDuringSolution: choices.averageSelectableTilesDuringSolution,
    averageSameItemChoicesDuringSolution: choices.averageSameItemChoicesDuringSolution,
    maxSameItemChoicesDuringSolution: choices.maxSameItemChoicesDuringSolution,
    firstTenSameItemChoices: choices.firstTenSameItemChoices,
    forcedSteps: branch.forcedSteps,
    realTrapSteps: branch.realTrapSteps,
    harmlessAmbiguousSteps: branch.harmlessAmbiguousSteps,
    averageCorrectChoices: branch.averageCorrectChoices,
    averageWinningChoices: branch.averageWinningChoices,
    firstTenBranching: branch.firstTenBranching,
    topLayerTileCount: tiles.filter(t => t.layer === board.maxLayers - 1).length,
    bottomLayerTileCount: tiles.filter(t => t.layer === 0).length,
    phaseCountsTopToBottom: Object.keys(layerCounts).sort((a, b) => Number(b.split('_')[1]) - Number(a.split('_')[1])).map(k => layerCounts[k]),
    sameLayerOverlapByLayer: layerCounts,
    sameLayerOverlapValidated: true,
    shapeConnectedValidated: true,
    layerVisibilityPairs: layerVisibilityMetrics(board.maxLayers, board),
    lowerLayerVisibleTarget: { min: 0.33, max: 0.5 },
    tileSize: { width: TILE_W, height: TILE_H },
    spacing: { x: board.tileSpacing, y: board.tileSpacingY },
    screenBounds: result.bounds,
    screenSafeBounds: clone(SAFE),
    screenFitValidated: true,
    solutionValidated: true,
    strategicGoal: 'Progressive ORDER_MATCH puzzle with unique balanced silhouettes, deeper core stacks, exact solution path, same-item decoys, and lower layers visibly offset by about 1/3-1/2 tile area.',
  };
  return level;
}

function progressiveScore(level) {
  const m = level.difficultyMetrics;
  return round(
    level.tiles.length * 1.2 +
    level.board.maxLayers * 5 +
    m.averageSameItemChoicesDuringSolution * 6 +
    m.totalStrategicDecoyCount * 1.5 +
    (m.criticalPathDecoyCount || 0) * 1.5 +
    (m.realTrapSteps || 0) * 18 +
    m.maxSameItemChoicesDuringSolution * 2 -
    (m.harmlessAmbiguousSteps || 0) * 1.2
  );
}

function difficultyBandForIndex(idx) {
  return idx < 10 ? 'tutorial_plus' : idx < 22 ? 'easy_mid' : idx < 34 ? 'advanced' : idx < 44 ? 'expert' : 'master';
}

function renumberLevel(level, idx) {
  const newLevelId = START + idx;
  const idMap = new Map();
  for (let i = 0; i < level.tiles.length; i++) {
    idMap.set(level.tiles[i].id, `L${newLevelId}_T${pad(i)}`);
  }

  level.levelId = newLevelId;
  level.displayName = `Level ${pad(newLevelId)} - ${level.board.shapeName}`;
  for (let i = 0; i < level.tiles.length; i++) {
    const tile = level.tiles[i];
    tile.id = idMap.get(tile.id);
    if (tile.decoyAgainstKeyTile && idMap.has(tile.decoyAgainstKeyTile)) {
      tile.decoyAgainstKeyTile = idMap.get(tile.decoyAgainstKeyTile);
    }
  }
  level.solutionMoveTileIds = level.solutionMoveTileIds.map(id => idMap.get(id) ?? id);
  level.difficultyMetrics.difficultyIndex = idx + 1;
  level.difficultyMetrics.difficultyBand = difficultyBandForIndex(idx);
  level.difficultyMetrics.progressiveDifficultyScore = progressiveScore(level);

  const result = validate(level);
  if (result.errors.length) throw new Error(`renumbered level ${newLevelId} invalid:\n${result.errors.join('\n')}`);
  level.difficultyMetrics.screenBounds = result.bounds;
}

const signatures = new Set();
const summary = [];
const levels = [];

for (let idx = 0; idx < SHAPES.length; idx++) {
  const level = makeLevel(idx);
  const sig = level.board.shapePattern.map(r => r.join('')).join('/');
  if (signatures.has(sig)) throw new Error(`duplicate shape at ${level.levelId}`);
  signatures.add(sig);
  level.difficultyMetrics.progressiveDifficultyScore = progressiveScore(level);
  levels.push(level);
}

levels.sort((a, b) => {
  const ta = a.difficultyMetrics.realTrapSteps || 0;
  const tb = b.difficultyMetrics.realTrapSteps || 0;
  if (ta !== tb) return ta - tb;
  const sa = a.difficultyMetrics.progressiveDifficultyScore;
  const sb = b.difficultyMetrics.progressiveDifficultyScore;
  if (sa !== sb) return sa - sb;
  if (a.tiles.length !== b.tiles.length) return a.tiles.length - b.tiles.length;
  return a.board.maxLayers - b.board.maxLayers;
});

for (let idx = 0; idx < levels.length; idx++) {
  const level = levels[idx];
  renumberLevel(level, idx);
  fs.writeFileSync(path.join(DIR, `level_${pad(level.levelId)}.json`), JSON.stringify(level, null, 2) + '\n', 'utf8');
  summary.push({
    id: level.levelId,
    shape: level.board.shapeName,
    tiles: level.tiles.length,
    cells: level.board.shapePattern.flat().filter(Boolean).length,
    layers: level.board.maxLayers,
    decoys: level.difficultyMetrics.sameItemPathDecoyCount,
    totalDecoys: level.difficultyMetrics.totalStrategicDecoyCount,
    score: level.difficultyMetrics.progressiveDifficultyScore,
    visible: level.difficultyMetrics.layerVisibilityPairs,
    bounds: level.difficultyMetrics.screenBounds,
  });
}

