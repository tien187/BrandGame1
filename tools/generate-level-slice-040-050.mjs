#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const START_LEVEL = Number(process.env.START_LEVEL ?? 40);
const END_LEVEL = Number(process.env.END_LEVEL ?? 50);
const PACK_NAME = process.env.PACK_NAME ?? (START_LEVEL === 1 && END_LEVEL === 50 ? 'generated_levels_full_pack' : 'generated_levels_040_050_pack');
const SOURCE_DIR = path.join(ROOT, 'generated_levels_pack', 'levels');
const RUNTIME_DIR = path.join(ROOT, 'assets', 'resources', 'data', 'levels');
const OUT_DIR = path.join(ROOT, PACK_NAME);
const OUT_LEVELS = path.join(OUT_DIR, 'levels');
const ZIP_PATH = path.join(ROOT, `${PACK_NAME}.zip`);

const GROUP_IDS = Array.from({ length: 25 }, (_, index) => String(index));
const SCREEN_SAFE = { minX: -500, maxX: 500, minY: -700, maxY: 780 };
const TARGET_BOARD_CENTER_Y = 120;

function padId(id) {
  return String(id).padStart(3, '0');
}

function getLayerJitter(layer, axis, config) {
  const seed = Math.abs(layer * 15485863 + axis * 32452843);
  const mult = axis === 0 ? (config.jitterX ?? 0.3) : (config.jitterY ?? 0.3);
  const size = axis === 0 ? (config.tileWidth ?? 100) : (config.tileHeight ?? 120);
  return ((seed % 100) / 100 - 0.5) * size * mult;
}

function getTileCenter(tile, config) {
  const sx = config.tileSpacingX ?? config.tileSpacing;
  const sy = config.tileSpacingY ?? config.tileSpacing;
  return {
    x: config.centerOffset.x + tile.gridX * sx + getLayerJitter(tile.layer, 0, config),
    y: config.centerOffset.y - tile.gridY * sy + getLayerJitter(tile.layer, 1, config),
  };
}

function calculateOverlapArea(a, b, config) {
  const w = config.tileWidth ?? 100;
  const h = config.tileHeight ?? 120;
  const ca = getTileCenter(a, config);
  const cb = getTileCenter(b, config);
  return Math.max(0, w - Math.abs(ca.x - cb.x)) * Math.max(0, h - Math.abs(ca.y - cb.y));
}

function refreshBlockStatus(tiles, config) {
  const active = tiles.filter(t => t.active);
  const tileArea = (config.tileWidth ?? 100) * (config.tileHeight ?? 120);
  const minOverlap = Math.max(config.minBlockOverlapPixels ?? 1, tileArea * (config.coverThreshold ?? 0.01));
  for (const tile of tiles) {
    if (!tile.active) {
      tile.selectable = false;
      tile.isBlocked = true;
      continue;
    }
    let blocked = false;
    for (const other of active) {
      if (other.id === tile.id || other.layer <= tile.layer) continue;
      if (calculateOverlapArea(tile, other, config) > minOverlap) {
        blocked = true;
        break;
      }
    }
    tile.isBlocked = blocked;
    tile.selectable = !blocked;
  }
}

function cloneSim(tiles, removed) {
  return tiles.map(t => ({ ...t, active: !removed.has(t.id) }));
}

function countSameLayerOverlaps(tiles, config) {
  let count = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[i].layer !== tiles[j].layer) continue;
      if (calculateOverlapArea(tiles[i], tiles[j], config) > 0) count++;
    }
  }
  return count;
}

function computeScreenBounds(tiles, config) {
  const hw = (config.tileWidth ?? 100) / 2;
  const hh = (config.tileHeight ?? 120) / 2;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const tile of tiles) {
    const c = getTileCenter(tile, config);
    minX = Math.min(minX, c.x - hw);
    maxX = Math.max(maxX, c.x + hw);
    minY = Math.min(minY, c.y - hh);
    maxY = Math.max(maxY, c.y + hh);
  }
  return { minX, maxX, minY, maxY };
}

function screenFit(tiles, config) {
  const b = computeScreenBounds(tiles, config);
  return b.minX >= SCREEN_SAFE.minX && b.maxX <= SCREEN_SAFE.maxX && b.minY >= SCREEN_SAFE.minY && b.maxY <= SCREEN_SAFE.maxY;
}

function recenterBoard(level) {
  const bounds = computeScreenBounds(level.tiles, level.board);
  const centerY = (bounds.minY + bounds.maxY) / 2;
  level.board.centerOffset.y += TARGET_BOARD_CENTER_Y - centerY;

  const recentered = computeScreenBounds(level.tiles, level.board);
  if (recentered.maxY > SCREEN_SAFE.maxY) {
    level.board.centerOffset.y -= recentered.maxY - SCREEN_SAFE.maxY + 12;
  }
  if (recentered.minY < SCREEN_SAFE.minY) {
    level.board.centerOffset.y += SCREEN_SAFE.minY - recentered.minY + 12;
  }

  level.board.centerOffset.x = +level.board.centerOffset.x.toFixed(2);
  level.board.centerOffset.y = +level.board.centerOffset.y.toFixed(2);
}

function buildDependencySolution(level) {
  const baseTiles = level.tiles.map(t => ({ ...t, active: true }));
  const removed = new Set();
  const sequence = [];
  const forcedPairs = [];
  let forcedNext = null;

  while (sequence.length < baseTiles.length) {
    const sim = cloneSim(baseTiles, removed);
    refreshBlockStatus(sim, level.board);
    const selectable = sim.filter(t => t.active && t.selectable);
    if (selectable.length === 0) throw new Error(`L${level.levelId}: no selectable tile at step ${sequence.length + 1}`);

    if (forcedNext && selectable.some(t => t.id === forcedNext)) {
      sequence.push(forcedNext);
      removed.add(forcedNext);
      forcedNext = null;
      continue;
    }

    const beforeIds = new Set(selectable.map(t => t.id));
    const candidates = [];
    for (const key of selectable) {
      const afterRemoved = new Set([...removed, key.id]);
      const after = cloneSim(baseTiles, afterRemoved);
      refreshBlockStatus(after, level.board);
      const unlocked = after
        .filter(t => t.active && t.selectable && !beforeIds.has(t.id))
        .sort((a, b) => a.layer - b.layer || a.gridY - b.gridY || a.gridX - b.gridX);
      if (unlocked.length > 0) {
        candidates.push({ key, next: unlocked[0] });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const earlyA = sequence.length < 9 ? 1 : 0;
        const earlyB = sequence.length < 9 ? 1 : 0;
        return earlyB - earlyA ||
          b.key.layer - a.key.layer ||
          a.next.layer - b.next.layer ||
          a.key.gridY - b.key.gridY ||
          a.key.gridX - b.key.gridX;
      });
      const chosen = candidates[0];
      forcedPairs.push({ step: sequence.length + 1, keyTile: chosen.key.id, nextTileUnlockedByKey: chosen.next.id });
      sequence.push(chosen.key.id);
      removed.add(chosen.key.id);
      forcedNext = chosen.next.id;
      continue;
    }

    selectable.sort((a, b) => b.layer - a.layer || a.gridY - b.gridY || a.gridX - b.gridX);
    sequence.push(selectable[0].id);
    removed.add(selectable[0].id);
  }

  return { sequence, forcedPairs };
}

function buildOrders(sequence, tiles) {
  const tileById = new Map(tiles.map(t => [t.id, t]));
  const orders = [];
  const solutionOrders = [];
  for (let i = 0; i < sequence.length; i += 3) {
    const items = sequence.slice(i, i + 3).map(id => tileById.get(id).groupId);
    orders.push({ id: `order_${String(orders.length + 1).padStart(3, '0')}`, items });
    solutionOrders.push([...items]);
  }
  return { orders, solutionOrders };
}

function assignStrategicGroups(level, sequence, forcedPairs) {
  const tiles = level.tiles.map(t => ({ ...t, active: true, tileType: 0 }));
  const tileById = new Map(tiles.map(t => [t.id, t]));

  for (let i = 0; i < sequence.length; i++) {
    tileById.get(sequence[i]).groupId = GROUP_IDS[(i + level.levelId) % GROUP_IDS.length];
    delete tileById.get(sequence[i]).strategyRole;
    delete tileById.get(sequence[i]).decoyForStep;
  }

  for (const pair of forcedPairs.filter(p => p.step <= 9)) {
    const stepIndex = pair.step - 1;
    const removed = new Set(sequence.slice(0, stepIndex));
    const sim = cloneSim(tiles, removed);
    refreshBlockStatus(sim, level.board);
    const selectable = sim.filter(t => t.active && t.selectable);
    const visibleGroups = new Set(selectable.map(t => tileById.get(t.id).groupId));
    const key = tileById.get(pair.keyTile);
    const next = tileById.get(pair.nextTileUnlockedByKey);
    const decoy = selectable.find(t => {
      if (t.id === key.id || t.id === next.id) return false;
      const afterDecoy = cloneSim(tiles, new Set([...removed, t.id]));
      refreshBlockStatus(afterDecoy, level.board);
      return !afterDecoy.some(a => a.id === next.id && a.active && a.selectable);
    }) ?? selectable.find(t => t.id !== key.id && t.id !== next.id);

    let hiddenGroup = GROUP_IDS.find(g => !visibleGroups.has(g) && g !== key.groupId);
    if (!hiddenGroup) {
      hiddenGroup = GROUP_IDS.find(g => g !== key.groupId) ?? GROUP_IDS[(stepIndex + 3) % GROUP_IDS.length];
      const replacement = GROUP_IDS.find(g => g !== hiddenGroup && g !== key.groupId) ?? key.groupId;
      for (const visible of selectable) {
        const visibleTile = tileById.get(visible.id);
        if (visibleTile.id !== key.id && visibleTile.groupId === hiddenGroup) visibleTile.groupId = replacement;
      }
    }
    next.groupId = hiddenGroup;

    if (decoy) {
      const keyGroup = GROUP_IDS.find(g => g !== hiddenGroup) ?? key.groupId;
      key.groupId = keyGroup;
      tileById.get(decoy.id).groupId = keyGroup;
      tileById.get(decoy.id).strategyRole = 'forced_path_same_item_decoy';
      tileById.get(decoy.id).decoyForStep = pair.step;
      tileById.get(decoy.id).decoyAgainstKeyTile = key.id;
      tileById.get(decoy.id).decoyBlocksNextTile = next.id;
    }
  }

  refreshBlockStatus(tiles, level.board);
  return tiles;
}

function getEarlyForcedLimit(levelId) {
  if (levelId <= 3) return 1;
  if (levelId <= 10) return 5;
  if (levelId <= 20) return 5;
  if (levelId <= 30) return 6;
  if (levelId <= 35) return 6;
  if (levelId <= 44) return 7;
  return 9;
}

function getRequiredFirst10TrapSteps(levelId) {
  if (levelId <= 3) return 0;
  if (levelId <= 5) return 2;
  if (levelId <= 10) return 3;
  if (levelId <= 20) return 2;
  if (levelId <= 30) return 3;
  if (levelId <= 35) return 1;
  if (levelId <= 44) return 1;
  return 4;
}

function strengthenEarlyForcedPaths(level, forcedPairs) {
  const tileById = new Map(level.tiles.map(t => [t.id, t]));
  const earlyPairs = forcedPairs.filter(pair => pair.step <= 12).slice(0, getEarlyForcedLimit(level.levelId));

  for (let i = 0; i < earlyPairs.length; i++) {
    const pair = earlyPairs[i];
    const stepIndex = pair.step - 1;
    const removed = new Set(level.solutionMoveTileIds.slice(0, stepIndex));
    const sim = cloneSim(level.tiles, removed);
    refreshBlockStatus(sim, level.board);
    const selectable = sim.filter(t => t.active && t.selectable);
    const key = tileById.get(pair.keyTile);
    const next = tileById.get(pair.nextTileUnlockedByKey);
    if (!key || !next) continue;

    const decoy = selectable.find(t => {
      if (t.id === key.id || t.id === next.id || level.solutionMoveTileIds.slice(stepIndex, stepIndex + 2).includes(t.id)) return false;
      const afterDecoy = cloneSim(level.tiles, new Set([...removed, t.id]));
      refreshBlockStatus(afterDecoy, level.board);
      return !afterDecoy.some(a => a.id === next.id && a.active && a.selectable);
    }) ?? selectable.find(t => t.id !== key.id && t.id !== next.id && !level.solutionMoveTileIds.slice(stepIndex, stepIndex + 2).includes(t.id));
    if (!decoy) continue;

    const keyGroup = GROUP_IDS[(level.levelId + i * 2) % GROUP_IDS.length];
    let nextGroup = GROUP_IDS.find(g => g !== keyGroup && !selectable.some(t => t.groupId === g));
    if (!nextGroup) {
      nextGroup = GROUP_IDS.find(g => g !== keyGroup) ?? GROUP_IDS[(level.levelId + i * 2 + 1) % GROUP_IDS.length];
      const replacement = GROUP_IDS.find(g => g !== nextGroup && g !== keyGroup) ?? keyGroup;
      for (const visible of selectable) {
        const visibleTile = tileById.get(visible.id);
        if (visibleTile.id !== key.id && visibleTile.groupId === nextGroup) visibleTile.groupId = replacement;
      }
    }

    key.groupId = keyGroup;
    tileById.get(decoy.id).groupId = keyGroup;
    next.groupId = nextGroup;

    tileById.get(decoy.id).strategyRole = 'forced_path_same_item_decoy';
    tileById.get(decoy.id).decoyForStep = pair.step;
    tileById.get(decoy.id).decoyAgainstKeyTile = key.id;
    tileById.get(decoy.id).decoyBlocksNextTile = next.id;
  }
  refreshBlockStatus(level.tiles, level.board);
}

function detectDecoys(level) {
  const decoys = [];
  const ids = level.solutionMoveTileIds;
  for (let s = 0; s < ids.length; s++) {
    const removed = new Set(ids.slice(0, s));
    const sim = cloneSim(level.tiles, removed);
    refreshBlockStatus(sim, level.board);
    const sel = sim.filter(t => t.active && t.selectable);
    const exp = level.orders[Math.floor(s / 3)]?.items[s % 3];
    const legal = sel.filter(t => t.groupId === exp);
    if (legal.length < 2) continue;
    const key = legal.find(t => t.id === ids[s]);
    const decoy = legal.find(t => t.id !== ids[s]);
    if (!key || !decoy) continue;
    decoys.push({
      step: s + 1,
      keyTile: key.id,
      nextTileUnlockedByKey: ids[s + 1] ?? '',
      decoyTile: decoy.id,
      decoySolutionStep: ids.indexOf(decoy.id) + 1,
      group: exp,
    });
  }
  return decoys;
}

function detectTrueForcedDecoys(level) {
  const decoys = [];
  const ids = level.solutionMoveTileIds;
  for (let s = 0; s < ids.length - 1; s++) {
    const removed = new Set(ids.slice(0, s));
    const sim = cloneSim(level.tiles, removed);
    refreshBlockStatus(sim, level.board);
    const selectable = sim.filter(t => t.active && t.selectable);
    const expected = level.orders[Math.floor(s / 3)]?.items[s % 3];
    const nextExpected = level.orders[Math.floor((s + 1) / 3)]?.items[(s + 1) % 3];
    const legal = selectable.filter(t => t.groupId === expected);
    const key = legal.find(t => t.id === ids[s]);
    if (!key || legal.length < 2 || !nextExpected) continue;

    const afterKey = cloneSim(level.tiles, new Set([...removed, key.id]));
    refreshBlockStatus(afterKey, level.board);
    const keyOpensNext = afterKey.some(t => t.active && t.selectable && t.groupId === nextExpected);
    if (!keyOpensNext) continue;

    for (const decoy of legal.filter(t => t.id !== key.id)) {
      const afterDecoy = cloneSim(level.tiles, new Set([...removed, decoy.id]));
      refreshBlockStatus(afterDecoy, level.board);
      const decoyOpensNext = afterDecoy.some(t => t.active && t.selectable && t.groupId === nextExpected);
      if (!decoyOpensNext) {
        decoys.push({
          step: s + 1,
          keyTile: key.id,
          nextTileUnlockedByKey: ids[s + 1],
          decoyTile: decoy.id,
          decoySolutionStep: ids.indexOf(decoy.id) + 1,
          group: expected,
          consequence: `decoy_does_not_unlock_${nextExpected}`,
        });
        break;
      }
    }
  }
  return decoys;
}

function simulateSolution(level) {
  const tiles = level.tiles.map(t => ({ ...t }));
  let orderIndex = 0;
  let itemIndex = 0;
  const errors = [];
  for (let i = 0; i < level.solutionMoveTileIds.length; i++) {
    refreshBlockStatus(tiles, level.board);
    const tile = tiles.find(t => t.id === level.solutionMoveTileIds[i]);
    if (!tile) {
      errors.push(`move ${i + 1}: missing tile`);
      continue;
    }
    if (!tile.active) errors.push(`move ${i + 1}: inactive ${tile.id}`);
    if (!tile.selectable) errors.push(`move ${i + 1}: blocked ${tile.id}`);
    const expected = level.orders[orderIndex]?.items[itemIndex];
    if (tile.groupId !== expected) errors.push(`move ${i + 1}: expected ${expected}, got ${tile.groupId}`);
    tile.active = false;
    itemIndex++;
    if (itemIndex >= 3) {
      orderIndex++;
      itemIndex = 0;
    }
  }
  if (orderIndex !== level.orders.length) errors.push('orders incomplete');
  if (tiles.some(t => t.active)) errors.push('tiles remain');
  return { valid: errors.length === 0, errors };
}

function analyzeMetrics(level, forcedPairs, decoys) {
  const layerCounts = {};
  for (const tile of level.tiles) layerCounts[tile.layer] = (layerCounts[tile.layer] || 0) + 1;

  let trapSteps = 0;
  let first10TrapSteps = 0;
  let hiddenSteps = 0;
  let first10HiddenNextSteps = 0;
  let first3OrdersForcedUnlockSteps = 0;
  let sameItemChoiceSteps = 0;
  let maxLegalExpectedTiles = 0;

  for (let s = 0; s < level.solutionMoveTileIds.length; s++) {
    const removed = new Set(level.solutionMoveTileIds.slice(0, s));
    const sim = cloneSim(level.tiles, removed);
    refreshBlockStatus(sim, level.board);
    const selectable = sim.filter(t => t.active && t.selectable);
    const expected = level.orders[Math.floor(s / 3)]?.items[s % 3];
    const legal = selectable.filter(t => t.groupId === expected);
    maxLegalExpectedTiles = Math.max(maxLegalExpectedTiles, legal.length);
    if (legal.length >= 2) sameItemChoiceSteps++;
    if (decoys.some(d => d.step === s + 1)) {
      trapSteps++;
      if (s < 10) first10TrapSteps++;
    }
    const nextExpected = level.orders[Math.floor((s + 1) / 3)]?.items[(s + 1) % 3];
    if (nextExpected && !selectable.some(t => t.groupId === nextExpected)) {
      hiddenSteps++;
      if (s < 10) first10HiddenNextSteps++;
      if (s < 9) first3OrdersForcedUnlockSteps++;
    }
  }

  const sameLayerOverlapPairCount = countSameLayerOverlaps(level.tiles, level.board);
  const bounds = computeScreenBounds(level.tiles, level.board);
  const maxLayer = level.board.maxLayers - 1;
  return {
    ...(level.difficultyMetrics ?? {}),
    designType: 'slice_040_050_forced_path_order_match',
    difficultyBand: level.difficultyMetrics?.difficultyBand ?? 'expert',
    clusterCount: level.difficultyMetrics?.clusterCount ?? 1,
    shapeName: level.board.shapeName,
    totalTiles: level.tiles.length,
    orderCount: level.orders.length,
    maxLayers: level.board.maxLayers,
    topLayerTileCount: layerCounts[maxLayer] || 0,
    bottomLayerTileCount: layerCounts[0] || 0,
    phaseCountsTopToBottom: Array.from({ length: level.board.maxLayers }, (_, i) => layerCounts[maxLayer - i] || 0),
    strategicGoal: 'Early forced-path decisions: the correct visible item unlocks the next hidden order item; same-item decoys punish choosing the wrong tile.',
    solutionValidated: true,
    sameItemChoiceSteps,
    trapSteps,
    stepsWhereNextItemHiddenBeforeMove: hiddenSteps,
    forcedUnlockSteps: hiddenSteps,
    averageLegalExpectedTiles: +(sameItemChoiceSteps / Math.max(1, level.solutionMoveTileIds.length)).toFixed(2),
    maxLegalExpectedTiles,
    first10TrapSteps,
    first10HiddenNextSteps,
    first3OrdersForcedUnlockSteps,
    totalTrapSteps: trapSteps,
    forcedPathDecoyCount: decoys.length,
    forcedPathDecoyChanges: decoys,
    trueForcedPathDecoyCount: decoys.length,
    forcedDependencyPairs: forcedPairs,
    sameLayerOverlapPairCount,
    sameLayerOverlapValidated: sameLayerOverlapPairCount === 0,
    screenBounds: {
      minX: +bounds.minX.toFixed(1),
      maxX: +bounds.maxX.toFixed(1),
      minY: +bounds.minY.toFixed(1),
      maxY: +bounds.maxY.toFixed(1),
    },
    screenSafeBounds: SCREEN_SAFE,
    screenFitValidated: screenFit(level.tiles, level.board),
  };
}

function csvEscape(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function writeZip() {
  const script = [
    `$zip = ${JSON.stringify(ZIP_PATH)}`,
    `if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }`,
    `Compress-Archive -Path ${JSON.stringify(path.join(OUT_DIR, '*'))} -DestinationPath $zip -Force`,
  ].join('\n');
  const { spawnSync } = await import('child_process');
  const result = spawnSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Compress-Archive failed');
}

async function main() {
  fs.mkdirSync(OUT_LEVELS, { recursive: true });
  const rows = [];
  const shapeStats = new Map();
  const clusterStats = new Map();
  const layerStats = new Map();

  for (let id = START_LEVEL; id <= END_LEVEL; id++) {
    const fileName = `level_${padId(id)}.json`;
    const level = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, fileName), 'utf8'));
    const { sequence, forcedPairs } = buildDependencySolution(level);
    level.solutionMoveTileIds = sequence;
    level.tiles = assignStrategicGroups(level, sequence, forcedPairs);
    strengthenEarlyForcedPaths(level, forcedPairs);
    const built = buildOrders(sequence, level.tiles);
    level.orders = built.orders;
    level.solutionOrders = built.solutionOrders;
    recenterBoard(level);
    level.orderConfig = {
      ...(level.orderConfig ?? {}),
      orderSize: 3,
      orderMode: 'EXACT_ORDER',
      wrongTrayMaxSlots: 1,
      consumeWrongTile: true,
    };
    const decoys = detectTrueForcedDecoys(level);
    level.difficultyMetrics = analyzeMetrics(level, forcedPairs, decoys);
    const sim = simulateSolution(level);
    if (!sim.valid) throw new Error(`${fileName}: ${sim.errors.join('; ')}`);
    if (!level.difficultyMetrics.screenFitValidated) throw new Error(`${fileName}: screen fit failed`);
    if (level.difficultyMetrics.sameLayerOverlapPairCount !== 0) throw new Error(`${fileName}: same-layer overlap`);
    if (id >= 20 && level.difficultyMetrics.first3OrdersForcedUnlockSteps <= 0) throw new Error(`${fileName}: no first-3-order forced unlock`);
    if (level.difficultyMetrics.first10TrapSteps < getRequiredFirst10TrapSteps(id)) throw new Error(`${fileName}: insufficient true early decoys`);

    fs.writeFileSync(path.join(OUT_LEVELS, fileName), JSON.stringify(level, null, 2));
    fs.writeFileSync(path.join(RUNTIME_DIR, fileName), JSON.stringify(level, null, 2));

    const m = level.difficultyMetrics;
    rows.push({
      levelId: id,
      file: fileName,
      solutionValidated: m.solutionValidated,
      screenFitValidated: m.screenFitValidated,
      sameLayerOverlapPairCount: m.sameLayerOverlapPairCount,
      clusterCount: m.clusterCount,
      shapeName: m.shapeName,
      maxLayers: m.maxLayers,
      topLayerTileCount: m.topLayerTileCount,
      bottomLayerTileCount: m.bottomLayerTileCount,
      totalTiles: m.totalTiles,
      first10TrapSteps: m.first10TrapSteps,
      first10HiddenNextSteps: m.first10HiddenNextSteps,
      first3OrdersForcedUnlockSteps: m.first3OrdersForcedUnlockSteps,
      totalTrapSteps: m.trapSteps,
      trueForcedPathDecoyCount: m.trueForcedPathDecoyCount,
    });
    shapeStats.set(m.shapeName, (shapeStats.get(m.shapeName) || 0) + 1);
    clusterStats.set(m.clusterCount, (clusterStats.get(m.clusterCount) || 0) + 1);
    layerStats.set(m.maxLayers, (layerStats.get(m.maxLayers) || 0) + 1);
    console.log(`${fileName}: shape=${m.shapeName} c=${m.clusterCount} layers=${m.maxLayers} first3Forced=${m.first3OrdersForcedUnlockSteps} f10Trap=${m.first10TrapSteps} overlap=${m.sameLayerOverlapPairCount}`);
  }

  const headers = Object.keys(rows[0]);
  fs.writeFileSync(
    path.join(OUT_DIR, 'LEVEL_VALIDATION_REPORT.csv'),
    `${headers.join(',')}\n${rows.map(row => headers.map(h => csvEscape(row[h])).join(',')).join('\n')}\n`
  );

  const shapeLines = [...shapeStats.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => `- ${name}: ${count} level(s)`);
  const clusterLines = [1, 2, 3, 4].map(c => `| ${c} cluster | ${clusterStats.get(c) || 0} |`);
  const layerLines = [2, 3, 4].map(l => `| ${l} layers | ${layerStats.get(l) || 0} |`);
  const readme = `# Level Pack ${String(START_LEVEL).padStart(3, '0')}-${String(END_LEVEL).padStart(3, '0')}

Generated for gameplay testing and runtime import.

## Shapes used
${shapeLines.join('\n')}

## Cluster distribution
| Clusters | Count |
|---|---:|
${clusterLines.join('\n')}

## Layer distribution
| Layers | Count |
|---|---:|
${layerLines.join('\n')}

## Validation results
- Solvable: ${rows.filter(r => r.solutionValidated).length}/${rows.length}
- Screen fit: ${rows.filter(r => r.screenFitValidated).length}/${rows.length}
- Same-layer overlap zero: ${rows.filter(r => r.sameLayerOverlapPairCount === 0).length}/${rows.length}
- Levels with first10TrapSteps > 0: ${rows.filter(r => r.first10TrapSteps > 0).length}/${rows.length}
- Levels with first3OrdersForcedUnlockSteps > 0: ${rows.filter(r => r.first3OrdersForcedUnlockSteps > 0).length}/${rows.length}

## Notes
- Runtime files level_${padId(START_LEVEL)}.json through level_${padId(END_LEVEL)}.json were copied into assets/resources/data/levels for direct Cocos testing.
- The pack mixes 1, 2, 3, and 4 cluster layouts with stronger early forced-path decisions in later levels.
- Early forced-path decisions are encoded in orders and solutionMoveTileIds: a key tile unlocks the next hidden item, while same-item decoys remain selectable.
`;
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readme);
  await writeZip();
  console.log(`Done: ${OUT_DIR}`);
  console.log(`ZIP: ${ZIP_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
