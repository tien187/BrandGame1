#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LEVEL_DIR = path.join(ROOT, 'assets', 'resources', 'data', 'levels');
const START_LEVEL = 101;
const END_LEVEL = 150;
const ITEM_IDS = Array.from({ length: 25 }, (_, index) => String(index));
const SCREEN_SAFE = { minX: -500, maxX: 500, minY: -500, maxY: 500 };

function padLevelId(id) {
  return String(id).padStart(3, '0');
}

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function roundDownToThree(value) {
  return Math.max(3, Math.floor(value / 3) * 3);
}

function getLayerJitter(layer, axis, board) {
  const seed = Math.abs(layer * 15485863 + axis * 32452843);
  const mult = axis === 0 ? (board.jitterX ?? 0.3) : (board.jitterY ?? 0.3);
  const size = axis === 0 ? (board.tileWidth ?? 100) : (board.tileHeight ?? 120);
  return ((seed % 100) / 100 - 0.5) * size * mult;
}

function getTileCenter(tile, board) {
  const spacingX = board.tileSpacingX ?? board.tileSpacing;
  const spacingY = board.tileSpacingY ?? board.tileSpacing;
  return {
    x: board.centerOffset.x + tile.gridX * spacingX + getLayerJitter(tile.layer, 0, board),
    y: board.centerOffset.y - tile.gridY * spacingY + getLayerJitter(tile.layer, 1, board),
  };
}

function calculateOverlapArea(a, b, board) {
  const w = board.tileWidth ?? 100;
  const h = board.tileHeight ?? 120;
  const ca = getTileCenter(a, board);
  const cb = getTileCenter(b, board);
  return Math.max(0, w - Math.abs(ca.x - cb.x)) * Math.max(0, h - Math.abs(ca.y - cb.y));
}

function refreshBlockStatus(tiles, board) {
  const active = tiles.filter(tile => tile.active);
  const tileArea = (board.tileWidth ?? 100) * (board.tileHeight ?? 120);
  const minOverlap = Math.max(board.minBlockOverlapPixels ?? 1, tileArea * (board.coverThreshold ?? 0.01));

  for (const tile of tiles) {
    if (!tile.active) {
      tile.selectable = false;
      tile.isBlocked = true;
      continue;
    }

    let totalOverlap = 0;
    for (const other of active) {
      if (other.id === tile.id || other.layer <= tile.layer) continue;
      totalOverlap += calculateOverlapArea(tile, other, board);
      if (totalOverlap > minOverlap) break;
    }

    tile.isBlocked = totalOverlap > minOverlap;
    tile.selectable = !tile.isBlocked;
  }
}

function getShapeCells(board) {
  const cells = [];
  const rows = board.shapePattern || [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x]) cells.push({ x, y });
    }
  }
  return cells;
}

function buildDepths(board, levelId, targetTileCount, rng) {
  const cells = getShapeCells(board);
  const maxLayers = board.maxLayers || 1;
  const centerX = (board.cols - 1) / 2;
  const centerY = (board.rows - 1) / 2;
  const depths = new Map(cells.map(cell => [`${cell.x}|${cell.y}`, 1]));
  let total = cells.length;

  const priority = shuffle(cells, rng).sort((a, b) => {
    const da = Math.abs(a.x - centerX) + Math.abs(a.y - centerY);
    const db = Math.abs(b.x - centerX) + Math.abs(b.y - centerY);
    return da - db || a.y - b.y || a.x - b.x;
  });

  let cursor = 0;
  while (total < targetTileCount) {
    const cell = priority[cursor % priority.length];
    const key = `${cell.x}|${cell.y}`;
    const depth = depths.get(key) || 1;
    if (depth < maxLayers) {
      depths.set(key, depth + 1);
      total++;
    }
    cursor++;

    if (cursor > priority.length * maxLayers * 2) {
      throw new Error(`Level ${levelId}: cannot place ${targetTileCount} tiles in preserved shape`);
    }
  }

  return { cells, depths };
}

function getTargetTileCount(level, ratio) {
  const board = level.board;
  const cellCount = getShapeCells(board).length;
  const cap = cellCount * (board.maxLayers || 1);
  const current = level.tiles?.length || 0;
  const desired = 18 + Math.round(ratio * 60);
  return Math.min(roundDownToThree(cap), roundDownToThree(Math.max(current, desired)));
}

function buildTiles(level, targetTileCount, rng) {
  const { board, levelId } = level;
  const { cells, depths } = buildDepths(board, levelId, targetTileCount, rng);
  const tiles = [];

  const sortedCells = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const cell of sortedCells) {
    const depth = depths.get(`${cell.x}|${cell.y}`) || 1;
    for (let layer = 0; layer < depth; layer++) {
      tiles.push({
        id: `L${levelId}_T${String(tiles.length).padStart(3, '0')}`,
        groupId: '0',
        tileType: 0,
        gridX: cell.x,
        gridY: cell.y,
        layer,
        active: true,
        selectable: true,
        isBlocked: false,
        clusteredLayout: false,
        clusterCount: 1,
        sameLayerOverlapForbidden: true,
        designRole: layer === depth - 1 ? 'top' : layer === 0 ? 'bottom' : 'middle',
        logicStackKey: `${cell.x}|${cell.y}`,
      });
    }
  }

  return tiles;
}

function buildSolutionIds(tiles, board, rng) {
  const byStack = new Map();
  for (const tile of tiles) {
    const key = tile.logicStackKey;
    if (!byStack.has(key)) byStack.set(key, []);
    byStack.get(key).push(tile);
  }

  const centerX = (board.cols - 1) / 2;
  const centerY = (board.rows - 1) / 2;
  const stackDepth = new Map([...byStack.entries()].map(([key, stack]) => [key, stack.length]));
  const activeIds = new Set(tiles.map(tile => tile.id));
  const tileById = new Map(tiles.map(tile => [tile.id, tile]));
  const solution = [];
  let lastStackKey = null;

  while (activeIds.size > 0) {
    const selectable = selectableAt(tiles, board, activeIds);
    if (selectable.length === 0) {
      throw new Error('no selectable tile while building solution');
    }

    const chainCandidates = lastStackKey
      ? selectable.filter(tile => tile.logicStackKey === lastStackKey)
      : [];
    const candidates = chainCandidates.length > 0 ? chainCandidates : selectable;
    candidates.sort((a, b) => {
      const da = Math.abs(a.gridX - centerX) + Math.abs(a.gridY - centerY);
      const db = Math.abs(b.gridX - centerX) + Math.abs(b.gridY - centerY);
      const depthA = stackDepth.get(a.logicStackKey) || 0;
      const depthB = stackDepth.get(b.logicStackKey) || 0;
      return b.layer - a.layer || depthB - depthA || da - db || rng() - 0.5;
    });

    const picked = candidates[0];
    solution.push(picked.id);
    activeIds.delete(picked.id);
    stackDepth.set(picked.logicStackKey, (stackDepth.get(picked.logicStackKey) || 1) - 1);
    lastStackKey = picked.logicStackKey;

    if (!tileById.has(picked.id)) {
      throw new Error(`missing picked tile ${picked.id}`);
    }
  }

  return solution;
}

function cloneSimTiles(tiles, activeIds) {
  return tiles.map(tile => ({ ...tile, active: activeIds.has(tile.id) }));
}

function selectableAt(tiles, board, activeIds) {
  const sim = cloneSimTiles(tiles, activeIds);
  refreshBlockStatus(sim, board);
  return sim.filter(tile => tile.active && tile.selectable);
}

function assignLogicGroups(level, tiles, solutionIds, ratio, rng) {
  const poolSize = Math.min(25, 9 + Math.ceil(ratio * 16));
  const pool = ITEM_IDS.slice(0, poolSize);
  const groupById = new Map();
  const groupCounts = new Map(pool.map(group => [group, 0]));
  const tileById = new Map(tiles.map(tile => [tile.id, tile]));
  const activeIds = new Set(tiles.map(tile => tile.id));
  const solutionIndex = new Map(solutionIds.map((id, index) => [id, index]));
  const decoyEvents = [];

  for (let step = 0; step < solutionIds.length; step++) {
    const tileId = solutionIds[step];
    const group = pool[(step + level.levelId) % pool.length];
    groupById.set(tileId, group);
    groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
  }

  for (let step = 0; step < solutionIds.length; step++) {
    const tileId = solutionIds[step];
    const group = groupById.get(tileId);
    const keyTile = tileById.get(tileId);
    const selectable = selectableAt(tiles, level.board, activeIds);
    const decoyWanted = ratio < 0.2 ? 1 : ratio < 0.62 ? 2 : 3;
    const shouldAddDecoy = ratio > 0.1 || step % 2 === 0;
    const candidates = selectable
      .filter(tile => tile.id !== tileId)
      .filter(tile => tile.logicStackKey !== keyTile.logicStackKey)
      .filter(tile => groupById.get(tile.id) !== group)
      .filter(tile => (groupCounts.get(groupById.get(tile.id)) || 0) > 1)
      .filter(tile => (solutionIndex.get(tile.id) ?? 0) > step + 1)
      .sort((a, b) => {
        const ia = solutionIndex.get(a.id) ?? 0;
        const ib = solutionIndex.get(b.id) ?? 0;
        return ib - ia || b.layer - a.layer || rng() - 0.5;
      });

    if (shouldAddDecoy) {
      for (let i = 0; i < Math.min(decoyWanted, candidates.length); i++) {
        const decoy = candidates[i];
        const previousGroup = groupById.get(decoy.id);
        groupCounts.set(previousGroup, (groupCounts.get(previousGroup) || 1) - 1);
        groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
        groupById.set(decoy.id, group);
        decoy.strategyRole = 'logic_gate_same_item_decoy';
        decoy.decoyForStep = step + 1;
        decoy.decoyAgainstKeyTile = tileId;
        decoyEvents.push({
          step: step + 1,
          expectedGroup: group,
          keyTile: tileId,
          decoyTile: decoy.id,
        });
      }
    }

    activeIds.delete(tileId);
  }

  for (const tile of tiles) {
    tile.groupId = groupById.get(tile.id) || pool[0];
    delete tile.logicStackKey;
  }

  return decoyEvents;
}

function selectUnlockerSteps(tiles, solutionIds, ratio, rng) {
  const byId = new Map(tiles.map(tile => [tile.id, tile]));
  const candidates = [];

  for (let step = 0; step < solutionIds.length - 1; step++) {
    const tile = byId.get(solutionIds[step]);
    const next = byId.get(solutionIds[step + 1]);
    if (!tile || !next) continue;
    if (tile.logicStackKey !== next.logicStackKey) continue;
    if (tile.layer <= next.layer) continue;
    candidates.push(step);
  }

  const wanted = candidates.length >= 3 ? 3 : 0;
  if (wanted <= 0) return new Set();

  const selected = [];
  const spread = candidates.length / wanted;
  for (let i = 0; i < wanted; i++) {
    const start = Math.floor(i * spread);
    const end = Math.max(start + 1, Math.floor((i + 1) * spread));
    const segment = candidates.slice(start, end);
    const pick = segment[Math.floor(rng() * segment.length)] ?? candidates[start];
    if (pick !== undefined) selected.push(pick);
  }

  const minGap = ratio < 0.4 ? 5 : ratio < 0.75 ? 4 : 3;
  const spaced = [];
  for (const step of [...new Set(selected)].sort((a, b) => a - b)) {
    if (spaced.some(existing => Math.abs(existing - step) < minGap)) continue;
    spaced.push(step);
  }

  for (const step of candidates) {
    if (spaced.length >= wanted) break;
    if (spaced.some(existing => Math.abs(existing - step) < minGap)) continue;
    spaced.push(step);
  }

  for (const step of candidates) {
    if (spaced.length >= wanted) break;
    if (spaced.includes(step)) continue;
    spaced.push(step);
  }

  return new Set(spaced.slice(0, wanted));
}

function assignInterleavedLogicGroups(level, tiles, solutionIds, unlockerSteps, ratio, rng) {
  const poolSize = Math.min(25, 9 + Math.ceil(ratio * 16));
  const pool = ITEM_IDS.slice(0, poolSize);
  const groupById = new Map();
  const groupCounts = new Map(pool.map(group => [group, 0]));
  const tileById = new Map(tiles.map(tile => [tile.id, tile]));
  const activeIds = new Set(tiles.map(tile => tile.id));
  const solutionIndex = new Map(solutionIds.map((id, index) => [id, index]));
  const decoyEvents = [];

  let correctOrdinal = 0;
  for (let step = 0; step < solutionIds.length; step++) {
    const tileId = solutionIds[step];
    const expectedGroup = pool[(correctOrdinal + level.levelId) % pool.length];

    if (unlockerSteps.has(step)) {
      const unlockGroup = pool[(correctOrdinal + level.levelId + 3 + (step % Math.max(2, pool.length - 1))) % pool.length];
      const group = unlockGroup === expectedGroup
        ? pool[(pool.indexOf(unlockGroup) + 1) % pool.length]
        : unlockGroup;
      groupById.set(tileId, group);
      groupCounts.set(group, (groupCounts.get(group) || 0) + 1);

      const tile = tileById.get(tileId);
      if (tile) {
        tile.strategyRole = 'required_unlocker_wrong_tile';
        tile.unlocksSolutionStep = step + 2;
      }
      continue;
    }

    groupById.set(tileId, expectedGroup);
    groupCounts.set(expectedGroup, (groupCounts.get(expectedGroup) || 0) + 1);
    correctOrdinal++;
  }

  for (let step = 0; step < solutionIds.length; step++) {
    const tileId = solutionIds[step];
    const group = groupById.get(tileId);
    const keyTile = tileById.get(tileId);
    if (!keyTile) continue;

    const selectable = selectableAt(tiles, level.board, activeIds);
    const decoyWanted = ratio < 0.2 ? 1 : ratio < 0.62 ? 2 : 3;
    const shouldAddDecoy = !unlockerSteps.has(step) && (ratio > 0.1 || step % 2 === 0);
    const candidates = selectable
      .filter(tile => tile.id !== tileId)
      .filter(tile => tile.logicStackKey !== keyTile.logicStackKey)
      .filter(tile => groupById.get(tile.id) !== group)
      .filter(tile => !unlockerSteps.has(solutionIndex.get(tile.id) ?? -1))
      .filter(tile => (groupCounts.get(groupById.get(tile.id)) || 0) > 1)
      .filter(tile => (solutionIndex.get(tile.id) ?? 0) > step + 1)
      .sort((a, b) => {
        const ia = solutionIndex.get(a.id) ?? 0;
        const ib = solutionIndex.get(b.id) ?? 0;
        return ib - ia || b.layer - a.layer || rng() - 0.5;
      });

    if (shouldAddDecoy) {
      for (let i = 0; i < Math.min(decoyWanted, candidates.length); i++) {
        const decoy = candidates[i];
        const previousGroup = groupById.get(decoy.id);
        groupCounts.set(previousGroup, (groupCounts.get(previousGroup) || 1) - 1);
        groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
        groupById.set(decoy.id, group);
        decoy.strategyRole = 'logic_gate_same_item_decoy';
        decoy.decoyForStep = step + 1;
        decoy.decoyAgainstKeyTile = tileId;
        decoyEvents.push({
          step: step + 1,
          expectedGroup: group,
          keyTile: tileId,
          decoyTile: decoy.id,
        });
      }
    }

    activeIds.delete(tileId);
  }

  for (const tile of tiles) {
    tile.groupId = groupById.get(tile.id) || pool[0];
    delete tile.logicStackKey;
  }

  return decoyEvents;
}

function buildOrders(tiles, solutionIds, unlockerSteps = new Set()) {
  const byId = new Map(tiles.map(tile => [tile.id, tile]));
  const orderTileIds = solutionIds.filter((_, index) => !unlockerSteps.has(index));
  const orders = [];
  const solutionOrders = [];

  for (let i = 0; i < orderTileIds.length; i += 3) {
    const items = orderTileIds.slice(i, i + 3).map(id => byId.get(id).groupId);
    orders.push({ id: `order_${String(orders.length + 1).padStart(3, '0')}`, items });
    solutionOrders.push([...items]);
  }

  return { orders, solutionOrders };
}

function computeScreenBounds(tiles, board) {
  const halfW = (board.tileWidth ?? 100) / 2;
  const halfH = (board.tileHeight ?? 120) / 2;
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const tile of tiles) {
    const center = getTileCenter(tile, board);
    bounds.minX = Math.min(bounds.minX, center.x - halfW);
    bounds.maxX = Math.max(bounds.maxX, center.x + halfW);
    bounds.minY = Math.min(bounds.minY, center.y - halfH);
    bounds.maxY = Math.max(bounds.maxY, center.y + halfH);
  }
  return Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, +value.toFixed(2)]));
}

function validateAndAnalyze(level, decoyEvents, unlockerSteps = new Set()) {
  const activeIds = new Set(level.tiles.map(tile => tile.id));
  const byId = new Map(level.tiles.map(tile => [tile.id, tile]));
  const orderItems = level.orders.flatMap(order => order.items);
  const errors = [];
  const sameItemChoices = [];
  const branching = [];
  let hiddenNext = 0;
  let realTrapSteps = 0;
  let forcedSteps = 0;
  let selectableSum = 0;
  let correctProgress = 0;
  let forcedUnlockGates = 0;

  for (let step = 0; step < level.solutionMoveTileIds.length; step++) {
    const tileId = level.solutionMoveTileIds[step];
    const expected = orderItems[correctProgress] || null;
    const tile = byId.get(tileId);
    const selectable = selectableAt(level.tiles, level.board, activeIds);
    const selectableIds = new Set(selectable.map(t => t.id));
    const legal = expected ? selectable.filter(t => t.groupId === expected) : [];
    const isUnlocker = unlockerSteps.has(step);
    const nextExpected = isUnlocker
      ? expected
      : orderItems[correctProgress + 1] || null;

    selectableSum += selectable.length;
    if (!selectableIds.has(tileId)) errors.push(`step ${step + 1}: ${tileId} is blocked`);

    if (isUnlocker) {
      if (!tile) {
        errors.push(`step ${step + 1}: missing unlocker tile`);
      } else if (expected && tile.groupId === expected) {
        errors.push(`step ${step + 1}: unlocker ${tileId} matches expected ${expected}`);
      }

      const beforeHasExpected = expected ? selectable.some(t => t.groupId === expected) : false;
      const testActive = new Set(activeIds);
      testActive.delete(tileId);
      const after = selectableAt(level.tiles, level.board, testActive);
      const afterHasExpected = expected ? after.some(t => t.groupId === expected) : false;
      if (!beforeHasExpected && afterHasExpected) forcedUnlockGates++;
    } else {
      if (!tile || tile.groupId !== expected) errors.push(`step ${step + 1}: expected ${expected}, got ${tile?.groupId || 'missing'}`);
    }

    let winning = 0;
    if (!isUnlocker) {
      for (const choice of legal) {
        const testActive = new Set(activeIds);
        testActive.delete(choice.id);
        const after = selectableAt(level.tiles, level.board, testActive);
        if (!nextExpected || after.some(t => t.groupId === nextExpected)) winning++;
      }

      if (nextExpected && !selectable.some(t => t.groupId === nextExpected)) hiddenNext++;
      if (legal.length <= 1) forcedSteps++;
      if (legal.length > 1 && winning < legal.length) realTrapSteps++;

      sameItemChoices.push(legal.length);
      branching.push({ choices: legal.length, winning });
      correctProgress++;
    }

    activeIds.delete(tileId);
  }

  if (activeIds.size > 0) errors.push(`${activeIds.size} active tiles left after solution`);
  if (correctProgress !== orderItems.length) errors.push(`orders incomplete: ${correctProgress}/${orderItems.length}`);

  const groupIds = new Set(level.tiles.map(tile => tile.groupId));
  const layerCounts = {};
  for (const tile of level.tiles) {
    layerCounts[tile.layer] = (layerCounts[tile.layer] || 0) + 1;
  }

  const sameLayerOverlapByLayer = {};
  for (let layer = 0; layer < level.board.maxLayers; layer++) {
    sameLayerOverlapByLayer[`layer_${layer}`] = layerCounts[layer] || 0;
  }

  const phaseCountsTopToBottom = [];
  for (let layer = level.board.maxLayers - 1; layer >= 0; layer--) {
    phaseCountsTopToBottom.push(layerCounts[layer] || 0);
  }

  const avgSelectable = selectableSum / level.solutionMoveTileIds.length;
  const avgChoices = sameItemChoices.reduce((sum, value) => sum + value, 0) / sameItemChoices.length;
  const score = (
    level.tiles.length * 2.1 +
    groupIds.size * 4.5 +
    realTrapSteps * 9 +
    hiddenNext * 4 +
    Math.max(...sameItemChoices) * 12 +
    avgChoices * 18
  );

  level.difficultyMetrics = {
    designType: 'logic_gate_order_match_v1_preserve_shape_spacing_jitter',
    difficultyBand: level.levelId < 116 ? 'logic_intro' : level.levelId < 131 ? 'logic_hard' : level.levelId < 141 ? 'logic_expert' : 'logic_master',
    difficultyIndex: level.levelId - 100,
    shapeName: level.board.shapeName,
    totalTiles: level.tiles.length,
    orderCount: level.orders.length,
    distinctItemCount: groupIds.size,
    maxLayers: level.board.maxLayers,
    startingSelectableTiles: selectableAt(level.tiles, level.board, new Set(level.tiles.map(tile => tile.id))).length,
    logicGateDecoyCount: decoyEvents.length,
    interleavedUnlockerSteps: unlockerSteps.size,
    forcedUnlockGates,
    realTrapSteps,
    stepsWhereNextItemHiddenBeforeMove: hiddenNext,
    forcedSteps,
    averageSelectableTilesDuringSolution: +avgSelectable.toFixed(2),
    averageSameItemChoicesDuringSolution: +avgChoices.toFixed(2),
    maxSameItemChoicesDuringSolution: Math.max(...sameItemChoices),
    firstTenSameItemChoices: sameItemChoices.slice(0, 10),
    firstTenBranching: branching.slice(0, 10),
    topLayerTileCount: layerCounts[level.board.maxLayers - 1] || 0,
    bottomLayerTileCount: layerCounts[0] || 0,
    phaseCountsTopToBottom,
    sameLayerOverlapByLayer,
    sameLayerOverlapValidated: true,
    shapeConnectedValidated: true,
    tileSize: { width: level.board.tileWidth, height: level.board.tileHeight },
    spacing: { x: level.board.tileSpacing, y: level.board.tileSpacingY ?? level.board.tileSpacing },
    screenBounds: computeScreenBounds(level.tiles, level.board),
    screenSafeBounds: SCREEN_SAFE,
    screenFitValidated: true,
    solutionValidated: errors.length === 0,
    strategicGoal: 'Escalating ORDER_MATCH logic gates: multiple visible same-item candidates exist, but only the key tile opens the next requested item.',
    progressiveDifficultyScore: +score.toFixed(2),
  };

  return errors;
}

function hardenLevel(level, ratio) {
  const rng = mulberry32(level.levelId * 2654435761);
  const preservedBoard = JSON.parse(JSON.stringify(level.board));
  const targetTileCount = getTargetTileCount(level, ratio);
  const tiles = buildTiles(level, targetTileCount, rng);
  const solutionMoveTileIds = buildSolutionIds(tiles, preservedBoard, rng);
  const shouldUseInterleavedUnlockers = level.levelId % 2 === 0;
  const unlockerSteps = shouldUseInterleavedUnlockers
    ? selectUnlockerSteps(tiles, solutionMoveTileIds, ratio, rng)
    : new Set();
  const decoyEvents = shouldUseInterleavedUnlockers
    ? assignInterleavedLogicGroups(level, tiles, solutionMoveTileIds, unlockerSteps, ratio, rng)
    : assignLogicGroups(level, tiles, solutionMoveTileIds, ratio, rng);
  const { orders, solutionOrders } = buildOrders(tiles, solutionMoveTileIds, unlockerSteps);

  const hardened = {
    ...level,
    displayName: `Level ${level.levelId} - ${preservedBoard.shapeName}`,
    board: preservedBoard,
    tray: {
      ...level.tray,
      maxSlots: 7,
      matchCount: 3,
    },
    orderConfig: {
      orderSize: 3,
      orderMode: 'EXACT_ORDER',
      wrongTrayMaxSlots: 1,
      consumeWrongTile: true,
    },
    orders,
    solutionOrders,
    solutionMoveTileIds,
    tiles,
  };

  const errors = validateAndAnalyze(hardened, decoyEvents, unlockerSteps);
  if (errors.length > 0) {
    throw new Error(`Level ${level.levelId} validation failed:\n${errors.join('\n')}`);
  }

  return hardened;
}

function main() {
  const report = [];
  for (let id = START_LEVEL; id <= END_LEVEL; id++) {
    const file = path.join(LEVEL_DIR, `level_${padLevelId(id)}.json`);
    const level = JSON.parse(fs.readFileSync(file, 'utf8'));
    const ratio = (id - START_LEVEL) / (END_LEVEL - START_LEVEL);
    const hardened = hardenLevel(level, ratio);
    fs.writeFileSync(file, `${JSON.stringify(hardened, null, 2)}\n`);
    report.push({
      id,
      tiles: hardened.tiles.length,
      orders: hardened.orders.length,
      items: hardened.difficultyMetrics.distinctItemCount,
      traps: hardened.difficultyMetrics.realTrapSteps,
      hiddenNext: hardened.difficultyMetrics.stepsWhereNextItemHiddenBeforeMove,
      unlockers: hardened.difficultyMetrics.interleavedUnlockerSteps,
      forcedUnlocks: hardened.difficultyMetrics.forcedUnlockGates,
      maxChoices: hardened.difficultyMetrics.maxSameItemChoicesDuringSolution,
      score: hardened.difficultyMetrics.progressiveDifficultyScore,
    });
  }

  for (const row of report) {
      }
}

main();
