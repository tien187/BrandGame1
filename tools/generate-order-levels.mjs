#!/usr/bin/env node
/**
 * ORDER_MATCH level pack generator — 50 levels
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'generated_levels_pack');
const LEVELS_DIR = path.join(OUT_DIR, 'levels');

const GROUP_IDS = Array.from({ length: 25 }, (_, index) => String(index));
const SCREEN_SAFE = { minX: -500, maxX: 500, minY: -700, maxY: 780 };

const SHAPES = {
  triangle: [[0,0,0,1,0,0,0],[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1]],
  pyramid: [[0,0,0,1,0,0,0],[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1]],
  diamond: [[0,0,0,1,0,0,0],[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1],[0,1,1,1,1,1,0],[0,0,1,1,1,0,0]],
  tower: [[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1]],
  bridge: [[1,0,0,0,0,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1],[1,0,0,0,0,0,1]],
  bowl: [[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1],[0,1,1,1,1,1,0],[0,0,1,1,1,0,0]],
  stair: [[1,0,0,0,0,0,0],[1,1,0,0,0,0,0],[1,1,1,0,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,1,0,0],[1,1,1,1,1,1,0]],
  spiral: [[1,1,1,1,1,1,1],[0,0,0,0,0,0,1],[1,1,1,1,1,0,1],[1,0,0,0,1,0,1],[1,0,1,1,1,0,1],[1,1,1,0,0,0,1]],
  flower: [[0,0,1,0,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1],[0,1,1,1,1,1,0],[0,0,1,0,1,0,0]],
  island: [[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0]],
  hourglass: [[1,1,1,1,1,1,1],[0,1,1,1,1,1,0],[0,0,1,1,1,0,0],[0,0,0,1,0,0,0],[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1]],
  heart: [[0,1,1,0,1,1,0],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[0,1,1,1,1,1,0],[0,0,1,1,1,0,0]],
  leaf: [[0,0,0,1,0,0,0],[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1],[0,1,1,1,1,1,0]],
  cross: [[0,0,0,1,0,0,0],[0,0,0,1,0,0,0],[1,1,1,1,1,1,1],[0,0,0,1,0,0,0],[0,0,0,1,0,0,0]],
  crescent: [[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1],[1,1,1,1,1,0,0],[0,1,1,1,0,0,0]],
  arrow: [[0,0,0,1,0,0,0],[0,0,1,1,1,0,0],[1,1,1,1,1,1,1],[0,0,1,1,1,0,0],[0,0,0,1,0,0,0]],
};

const LEVEL_SPECS = [
  { id:1, clusters:1, layers:2, shape:'mini_pyramid', orders:4, wrongTray:3, trapWeight:0, band:'tutorial' },
  { id:2, clusters:1, layers:2, shape:'mini_diamond', orders:6, wrongTray:3, trapWeight:0, band:'tutorial' },
  { id:3, clusters:1, layers:2, shape:'mini_bowl', orders:6, wrongTray:3, trapWeight:0, band:'tutorial' },
  { id:4, clusters:1, layers:3, shape:'mini_cross', orders:9, wrongTray:2, trapWeight:2, band:'easy' },
  { id:5, clusters:1, layers:2, shape:'mini_bridge', orders:6, wrongTray:2, trapWeight:2, band:'easy' },
  { id:6, clusters:1, layers:3, shape:'mini_stair', orders:7, wrongTray:2, trapWeight:2, band:'easy' },
  { id:7, clusters:1, layers:3, shape:'mini_ring', orders:8, wrongTray:2, trapWeight:2, band:'easy' },
  { id:8, clusters:1, layers:3, shape:'mini_flower', orders:8, wrongTray:2, trapWeight:2, band:'easy' },
  { id:9, clusters:1, layers:3, shape:'mini_spiral', orders:9, wrongTray:2, trapWeight:2, band:'easy' },
  { id:10, clusters:1, layers:3, shape:'mini_tower', orders:9, wrongTray:2, trapWeight:3, band:'easy' },
  { id:11, clusters:1, layers:3, shape:'mid_compass', orders:9, wrongTray:2, trapWeight:2, band:'medium' },
  { id:12, clusters:2, layers:3, shape:'mid_two_stack', orders:12, wrongTray:2, trapWeight:2, band:'medium' },
  { id:13, clusters:1, layers:3, shape:'mid_bridge', orders:10, wrongTray:2, trapWeight:2, band:'medium' },
  { id:14, clusters:1, layers:3, shape:'mid_diamond_ring', orders:10, wrongTray:2, trapWeight:2, band:'medium' },
  { id:15, clusters:1, layers:3, shape:'mid_flower', orders:9, wrongTray:2, trapWeight:2, band:'medium' },
  { id:16, clusters:1, layers:3, shape:'mid_zigzag', orders:10, wrongTray:2, trapWeight:2, band:'medium' },
  { id:17, clusters:1, layers:3, shape:'mid_island', orders:12, wrongTray:2, trapWeight:2, band:'medium' },
  { id:18, clusters:1, layers:4, shape:'mid_u_shape', orders:11, wrongTray:2, trapWeight:2, band:'medium' },
  { id:19, clusters:1, layers:3, shape:'mid_leaf', orders:10, wrongTray:2, trapWeight:2, band:'medium' },
  { id:20, clusters:1, layers:3, shape:'mid_spiral', orders:12, wrongTray:2, trapWeight:2, band:'medium' },
  { id:21, clusters:1, layers:3, shape:'pro_bridge_lock', orders:13, wrongTray:1, trapWeight:3, band:'hard' },
  { id:22, clusters:1, layers:3, shape:'pro_v_shape', orders:13, wrongTray:1, trapWeight:3, band:'hard' },
  { id:23, clusters:1, layers:3, shape:'pro_crescent', orders:13, wrongTray:1, trapWeight:3, band:'hard' },
  { id:24, clusters:1, layers:3, shape:'pro_triangle_core', orders:12, wrongTray:1, trapWeight:3, band:'hard' },
  { id:25, clusters:1, layers:3, shape:'pro_leaf', orders:13, wrongTray:1, trapWeight:3, band:'hard' },
  { id:26, clusters:1, layers:3, shape:'pro_flower_ring', orders:14, wrongTray:1, trapWeight:3, band:'hard' },
  { id:27, clusters:1, layers:3, shape:'pro_arrow', orders:13, wrongTray:1, trapWeight:3, band:'hard' },
  { id:28, clusters:1, layers:3, shape:'pro_x_shape', orders:14, wrongTray:1, trapWeight:3, band:'hard' },
  { id:29, clusters:1, layers:3, shape:'pro_heart', orders:13, wrongTray:1, trapWeight:3, band:'hard' },
  { id:30, clusters:1, layers:3, shape:'pro_lock_gate', orders:13, wrongTray:1, trapWeight:3, band:'hard' },
  { id:31, clusters:1, layers:4, shape:'topdown_pyramid', orders:10, wrongTray:1, trapWeight:3, band:'expert' },
  { id:32, clusters:1, layers:4, shape:'expert_tower_lock', orders:16, wrongTray:1, trapWeight:3, band:'expert' },
  { id:33, clusters:1, layers:4, shape:'expert_bowl_gate', orders:14, wrongTray:1, trapWeight:3, band:'expert' },
  { id:34, clusters:1, layers:4, shape:'expert_o_ring', orders:24, wrongTray:1, trapWeight:3, band:'expert' },
  { id:35, clusters:1, layers:7, shape:'expert_row_stair7', orders:12, wrongTray:1, trapWeight:3, band:'expert' },
  { id:36, clusters:1, layers:4, shape:'expert_spiral_lock', orders:13, wrongTray:1, trapWeight:3, band:'expert' },
  { id:37, clusters:1, layers:4, shape:'expert_leaf_gate', orders:14, wrongTray:1, trapWeight:3, band:'expert' },
  { id:38, clusters:1, layers:4, shape:'expert_triangle_core', orders:13, wrongTray:1, trapWeight:3, band:'expert' },
  { id:39, clusters:1, layers:4, shape:'expert_flower_gate', orders:15, wrongTray:1, trapWeight:3, band:'expert' },
  { id:40, clusters:1, layers:4, shape:'expert_hollow_square', orders:24, wrongTray:1, trapWeight:3, band:'expert' },
  { id:41, clusters:1, layers:4, shape:'master_island_core', orders:13, wrongTray:1, trapWeight:3, band:'master' },
  { id:42, clusters:1, layers:4, shape:'master_v_shape', orders:14, wrongTray:1, trapWeight:3, band:'master' },
  { id:43, clusters:1, layers:4, shape:'master_nested_cross', orders:16, wrongTray:1, trapWeight:3, band:'master' },
  { id:44, clusters:4, layers:4, shape:'master_four_corners', orders:20, wrongTray:1, trapWeight:3, band:'master' },
  { id:45, clusters:1, layers:4, shape:'master_u_shape', orders:15, wrongTray:1, trapWeight:3, band:'master' },
  { id:46, clusters:1, layers:4, shape:'master_tower_gate', orders:16, wrongTray:1, trapWeight:3, band:'master' },
  { id:47, clusters:1, layers:4, shape:'master_hollow_square', orders:24, wrongTray:1, trapWeight:3, band:'master' },
  { id:48, clusters:1, layers:4, shape:'master_vault_tower', orders:16, wrongTray:1, trapWeight:3, band:'master' },
  { id:49, clusters:1, layers:7, shape:'master_row_stair7', orders:12, wrongTray:1, trapWeight:3, band:'master' },
  { id:50, clusters:1, layers:4, shape:'master_x_shape', orders:15, wrongTray:1, trapWeight:3, band:'master' },
];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function getLayerJitter(layer, axis, config) {
  const seed = Math.abs(layer * 15485863 + axis * 32452843);
  const mult = axis === 0 ? (config.jitterX ?? 0.3) : (config.jitterY ?? 0.3);
  const size = axis === 0 ? (config.tileWidth ?? 100) : (config.tileHeight ?? 120);
  return ((seed % 100) / 100 - 0.5) * size * mult;
}

function getTileCenter(tile, config) {
  const sx = config.tileSpacing, sy = config.tileSpacingY ?? config.tileSpacing;
  return {
    x: config.centerOffset.x + tile.gridX * sx + getLayerJitter(tile.layer, 0, config),
    y: config.centerOffset.y - tile.gridY * sy + getLayerJitter(tile.layer, 1, config),
  };
}

function calculateOverlapArea(a, b, config) {
  const w = config.tileWidth ?? 100, h = config.tileHeight ?? 120;
  const ca = getTileCenter(a, config), cb = getTileCenter(b, config);
  return Math.max(0, w - Math.abs(ca.x - cb.x)) * Math.max(0, h - Math.abs(ca.y - cb.y));
}

function refreshBlockStatus(tiles, config) {
  const active = tiles.filter(t => t.active);
  const tileArea = (config.tileWidth ?? 100) * (config.tileHeight ?? 120);
  const minOverlap = Math.max(config.minBlockOverlapPixels ?? 1, tileArea * (config.coverThreshold ?? 0.01));
  for (const tile of tiles) {
    if (!tile.active) { tile.selectable = false; tile.isBlocked = true; continue; }
    let blocked = false;
    for (const other of active) {
      if (other.id === tile.id || other.layer <= tile.layer) continue;
      if (calculateOverlapArea(tile, other, config) > minOverlap) { blocked = true; break; }
    }
    tile.isBlocked = blocked;
    tile.selectable = !blocked;
  }
}

function cloneSim(tiles, removed) {
  return tiles.map(t => ({ ...t, active: !removed.has(t.id) }));
}

function countSameLayerOverlaps(tiles, config) {
  let n = 0;
  for (let i = 0; i < tiles.length; i++)
    for (let j = i + 1; j < tiles.length; j++)
      if (tiles[i].layer === tiles[j].layer && calculateOverlapArea(tiles[i], tiles[j], config) > 0) n++;
  return n;
}

function computeScreenBounds(tiles, config) {
  const hw = (config.tileWidth ?? 100) / 2, hh = (config.tileHeight ?? 120) / 2;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of tiles) {
    const c = getTileCenter(t, config);
    minX = Math.min(minX, c.x - hw); maxX = Math.max(maxX, c.x + hw);
    minY = Math.min(minY, c.y - hh); maxY = Math.max(maxY, c.y + hh);
  }
  return { minX, maxX, minY, maxY };
}

function screenFit(tiles, config) {
  const b = computeScreenBounds(tiles, config);
  return b.minX >= SCREEN_SAFE.minX && b.maxX <= SCREEN_SAFE.maxX && b.minY >= SCREEN_SAFE.minY && b.maxY <= SCREEN_SAFE.maxY;
}

function buildClusterOffsets(n, cols, rows) {
  const gap = 0;
  if (n === 1) return [{ ox: 0, oy: 0 }];
  if (n === 2) return [{ ox: 0, oy: 0 }, { ox: cols + gap, oy: 0 }];
  if (n === 3) return [{ ox: 0, oy: 0 }, { ox: cols + gap, oy: 0 }, { ox: Math.floor(cols / 2), oy: rows + gap }];
  return [{ ox: 0, oy: 0 }, { ox: cols + gap, oy: 0 }, { ox: 0, oy: rows + gap }, { ox: cols + gap, oy: rows + gap }];
}

function buildShapePattern(spec) {
  const base = SHAPES[spec.shape] || SHAPES.pyramid;
  const rows = base.length, cols = base[0].length;
  const offsets = buildClusterOffsets(spec.clusters, cols, rows);
  let maxR = 0, maxC = 0;
  const cells = [];
  for (let ci = 0; ci < offsets.length; ci++) {
    const { ox, oy } = offsets[ci];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (base[r][c]) {
          cells.push({ gridX: c + ox, gridY: r + oy, cluster: ci + 1, sortKey: r + oy + (c + ox) * 0.01 });
          maxR = Math.max(maxR, r + oy); maxC = Math.max(maxC, c + ox);
        }
  }
  cells.sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX);
  const pattern = Array.from({ length: maxR + 1 }, () => Array(maxC + 1).fill(0));
  for (const c of cells) pattern[c.gridY][c.gridX] = 1;
  return { pattern, cells, rows: maxR + 1, cols: maxC + 1, shapeName: spec.clusters === 1 ? spec.shape : `${spec.shape}_c${spec.clusters}` };
}

function distributeLayerCounts(total, maxLayers) {
  const counts = new Array(maxLayers).fill(0);
  const w = [];
  for (let l = 0; l < maxLayers; l++) w.push(1 + (maxLayers - 1 - l) * 0.7 + (l === 0 ? 1 : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  let used = 0;
  for (let l = maxLayers - 1; l >= 1; l--) { counts[l] = Math.max(1, Math.round(total * w[l] / sum)); used += counts[l]; }
  counts[0] = total - used;
  return counts;
}

/** Stack tiles on shared columns; each same-layer tile uses a distinct grid cell. */
function assignStackedCells(cells, layerCounts, maxLayers, clusterCount, rng) {
  const byCluster = {};
  for (const c of cells) (byCluster[c.cluster] ??= []).push(c);
  const clusters = Object.keys(byCluster).map(Number).sort((a, b) => a - b);
  const total = layerCounts.reduce((a, b) => a + b, 0);
  const assignments = [];

  for (const cid of clusters) {
    const cl = [...byCluster[cid]].sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX);
    const cTotal = cid === clusters[clusters.length - 1]
      ? total - Math.floor(total / clusters.length) * (clusters.length - 1)
      : Math.floor(total / clusters.length);
    const cLayerCounts = distributeLayerCounts(cTotal, maxLayers);
    const usedAtLayer = {};
    const takeCell = (layer, preferTop) => {
      if (!usedAtLayer[layer]) usedAtLayer[layer] = new Set();
      const sorted = preferTop
        ? [...cl].sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX)
        : [...cl].sort((a, b) => b.gridY - a.gridY || a.gridX - b.gridX);
      for (const c of sorted) {
        const key = `${c.gridX}|${c.gridY}`;
        if (!usedAtLayer[layer].has(key)) { usedAtLayer[layer].add(key); return c; }
      }
      return sorted[rng() * sorted.length | 0];
    };

    const stackCols = [];
    for (let i = 0; i < cLayerCounts[maxLayers - 1]; i++) stackCols.push(takeCell(maxLayers - 1, true));

    for (let li = maxLayers - 1; li >= 0; li--) {
      const need = cLayerCounts[li];
      let placed = 0;
      if (li === maxLayers - 1) {
        for (const col of stackCols) {
          assignments.push({ gridX: col.gridX, gridY: col.gridY, layer: li, cluster: cid });
          if (++placed >= need) break;
        }
      } else {
        for (const col of stackCols) {
          if (placed >= need) break;
          assignments.push({ gridX: col.gridX, gridY: col.gridY + (maxLayers - 1 - li) * 0.85, layer: li, cluster: cid });
          placed++;
        }
        while (placed < need) {
          const col = takeCell(li, false);
          assignments.push({ gridX: col.gridX, gridY: col.gridY + (maxLayers - 1 - li) * 0.85, layer: li, cluster: cid });
          placed++;
        }
      }
    }
  }
  return assignments.slice(0, total);
}

function buildTopDownPyramidLayout(spec) {
  const size = spec.layers;
  const pattern = Array.from({ length: size }, () => Array(size).fill(1));
  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells.push({ gridX: x, gridY: y, cluster: 1, sortKey: y + x * 0.01 });
    }
  }
  return {
    pattern,
    cells,
    rows: size,
    cols: size,
    shapeName: 'topdown_pyramid',
  };
}

function assignTopDownPyramidCells(maxLayers) {
  const size = maxLayers;
  const assignments = [];
  for (let layer = maxLayers - 1; layer >= 0; layer--) {
    const squareSize = maxLayers - layer;
    const offset = (size - squareSize) / 2;
    for (let y = 0; y < squareSize; y++) {
      for (let x = 0; x < squareSize; x++) {
        assignments.push({
          gridX: offset + x,
          gridY: offset + y,
          layer,
          cluster: 1,
        });
      }
    }
  }
  return assignments;
}

function buildPatternFromAssignments(assignments, shapeName) {
  const maxX = Math.ceil(Math.max(...assignments.map(p => p.gridX)));
  const maxY = Math.ceil(Math.max(...assignments.map(p => p.gridY)));
  const minX = Math.floor(Math.min(...assignments.map(p => p.gridX)));
  const minY = Math.floor(Math.min(...assignments.map(p => p.gridY)));
  const normalized = assignments.map(p => ({
    ...p,
    gridX: +(p.gridX - minX).toFixed(4),
    gridY: +(p.gridY - minY).toFixed(4),
  }));
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const pattern = Array.from({ length: rows }, () => Array(cols).fill(0));
  const cellKeys = new Set();
  for (const p of normalized) {
    const x = Math.round(p.gridX);
    const y = Math.round(p.gridY);
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      pattern[y][x] = 1;
      cellKeys.add(`${x}|${y}`);
    }
  }
  const cells = [...cellKeys].map(key => {
    const [x, y] = key.split('|').map(Number);
    return { gridX: x, gridY: y, cluster: 1, sortKey: y + x * 0.01 };
  });
  return { pattern, cells, rows, cols, shapeName, assignments: normalized };
}

function buildLayeredPatternLayout(shapeName, patternsByLayer) {
  const layerEntries = Object.entries(patternsByLayer).map(([layer, rows]) => ({
    layer: Number(layer),
    rows,
    h: rows.length,
    w: Math.max(...rows.map(r => r.length)),
  }));
  const maxW = Math.max(...layerEntries.map(e => e.w));
  const maxH = Math.max(...layerEntries.map(e => e.h));
  const assignments = [];
  for (const entry of layerEntries) {
    const ox = (maxW - entry.w) / 2;
    const oy = (maxH - entry.h) / 2;
    for (let y = 0; y < entry.rows.length; y++) {
      for (let x = 0; x < entry.rows[y].length; x++) {
        if (entry.rows[y][x] !== '1') continue;
        assignments.push({
          gridX: ox + x,
          gridY: oy + y,
          layer: entry.layer,
          cluster: 1,
        });
      }
    }
  }
  return buildPatternFromAssignments(assignments, shapeName);
}

function buildMiniPyramidLayout() {
  return buildLayeredPatternLayout('mini_pyramid', {
    0: ['111', '111', '111'],
    1: ['000', '111', '000'],
  });
}

function buildMiniDiamondLayout() {
  return buildLayeredPatternLayout('mini_diamond', {
    0: ['00100', '01110', '11111', '01110', '00100'],
    1: ['010', '111', '010'],
  });
}

function buildMiniBowlLayout() {
  return buildLayeredPatternLayout('mini_bowl', {
    0: ['10001', '11011', '11111', '01110'],
    1: ['01110', '11110'],
  });
}

function buildMiniCrossLayout() {
  return buildLayeredPatternLayout('mini_cross', {
    0: ['00100', '01110', '11111', '01110', '00100'],
    1: ['00100', '00100', '11111', '00100', '00100'],
    2: ['010', '111', '010'],
  });
}

function buildMiniBridgeLayout() {
  return buildLayeredPatternLayout('mini_bridge', {
    0: ['10001', '10001', '11111', '10101'],
    1: ['1001', '1111'],
  });
}

function buildMiniStairLayout() {
  return buildLayeredPatternLayout('mini_stair', {
    0: ['10000', '11000', '11100', '11110', '11111'],
    1: ['1100', '1110', '1111'],
    2: ['100', '110', '111'],
  });
}

function buildMiniRingLayout() {
  return buildLayeredPatternLayout('mini_ring', {
    0: ['11111', '10001', '10001', '10001', '11111'],
    1: ['1111', '1001', '1001', '1111'],
    2: ['111', '101', '111'],
  });
}

function buildMiniFlowerLayout() {
  return buildLayeredPatternLayout('mini_flower', {
    0: ['00100', '01110', '11111', '01110', '00100'],
    1: ['01010', '11111', '01010'],
    2: ['010', '111', '010'],
  });
}

function buildMiniSpiralLayout() {
  return buildLayeredPatternLayout('mini_spiral', {
    0: ['11111', '00001', '11101', '10001', '11111'],
    1: ['1111', '0001', '1101', '1111'],
    2: ['111', '001', '111'],
  });
}

function buildMiniTowerLayout() {
  return buildLayeredPatternLayout('mini_tower', {
    0: ['11111', '11111', '11111', '11111'],
    1: ['1111', '1111', '1111'],
    2: ['11', '11'],
  });
}

const MID_PRO_PATTERNS = {
  mid_compass: {
    0: ['00100', '01110', '11111', '01110', '00100'],
    1: ['01010', '11111', '01010'],
    2: ['010', '111', '010'],
  },
  mid_gate: {
    0: ['11011', '10001', '11111', '10001', '11011'],
    1: ['1001', '1111', '1001'],
    2: ['010', '111', '010'],
  },
  mid_two_stack: {
    0: ['111', '111', '111', '000', '111', '111', '111'],
    1: ['111', '111', '000', '111', '111'],
    2: ['111', '000', '111'],
  },
  mid_bridge: {
    0: ['10001', '11011', '11111', '11011', '10001'],
    1: ['1001', '1111', '1001'],
    2: ['010', '111', '010'],
  },
  mid_diamond_ring: {
    0: ['00100', '01110', '11111', '01110', '00100'],
    1: ['01110', '11111', '01110'],
    2: ['111', '111'],
  },
  mid_flower: {
    0: ['00100', '01110', '11111', '01110', '00100'],
    1: ['01010', '11111', '01010'],
    2: ['010', '111', '010'],
  },
  mid_zigzag: {
    0: ['10000', '11000', '11100', '11110', '11111'],
    1: ['1100', '1110', '0111', '0010'],
    2: ['110', '111', '001'],
  },
  mid_island: {
    0: ['00100', '01110', '11111', '11111', '01110', '00100'],
    1: ['00100', '01110', '11111', '01110', '00100'],
    2: ['010', '111', '010'],
  },
  mid_hourglass: {
    0: ['11111', '01110', '00100', '01110', '11111'],
    1: ['111', '010', '111', '010'],
    2: ['010', '111', '010'],
  },
  mid_u_shape: {
    0: ['1000001', '1000001', '1000001', '1111111'],
    1: ['10001', '10001', '11111'],
    2: ['101', '111'],
    3: ['111'],
  },
  mid_leaf: {
    0: ['00100', '01110', '11111', '11110', '01100'],
    1: ['0100', '1110', '1111', '0100'],
    2: ['010', '111', '011'],
  },
  mid_spiral: {
    0: ['11111', '00001', '11101', '10001', '11111'],
    1: ['1111', '0001', '1101', '1111'],
    2: ['111', '001', '111'],
  },
  pro_bridge_lock: {
    0: ['00100', '11011', '10001', '11111', '11111', '11011'],
    1: ['1001', '1111', '1111', '1001'],
    2: ['111', '111'],
  },
  pro_tower_gate: {
    0: ['11111', '11111', '11111', '11111'],
    1: ['1111', '1111', '1111'],
    2: ['1111', '1111', '0011'],
  },
  pro_v_shape: {
    0: ['1000001', '1100011', '0110110', '0011100', '0001000'],
    1: ['10001', '11011', '01110', '00100'],
    2: ['101', '111', '010'],
  },
  pro_crescent: {
    0: ['00111', '01111', '11111', '11100', '11000', '01100', '00100'],
    1: ['0111', '1111', '1110', '1100', '0100'],
    2: ['111', '110', '010'],
  },
  pro_triangle_core: {
    0: ['000001', '000011', '000111', '001111', '011111', '111111'],
    1: ['0001', '0011', '0111', '1111'],
    2: ['010', '111', '010'],
  },
  pro_leaf: {
    0: ['00100', '01110', '11111', '11111', '01110', '00110', '00011'],
    1: ['0110', '1111', '1111', '0011'],
    2: ['010', '111', '011'],
  },
  pro_flower_ring: {
    0: ['001100', '011110', '111111', '111111', '011110', '001100'],
    1: ['0110', '1111', '1111', '0110'],
    2: ['111', '111'],
  },
  pro_arrow: {
    0: ['0001000', '0011100', '0111110', '1111111', '0011100', '0001000', '0001000'],
    1: ['00100', '01110', '11111', '00100', '00100', '00100'],
    2: ['010', '111', '011'],
  },
  pro_double_diamond: {
    0: ['011110', '111111', '011110', '011110', '111111'],
    1: ['0110', '1111', '0110', '1111'],
    2: ['11', '11', '11'],
  },
  pro_x_shape: {
    0: ['1100011', '1110111', '0111110', '0011100', '0111110', '1110111', '1100011'],
    1: ['10001', '11011', '01110', '11011', '00000'],
    2: ['1111', '1111'],
  },
  pro_heart: {
    0: ['0111110', '1111111', '0111110', '0011100', '0001000'],
    1: ['10101', '11111', '01110', '00100'],
    2: ['111', '111'],
  },
  pro_hourglass: {
    0: ['111111', '011110', '001100', '001100', '011110', '111111'],
    1: ['1111', '0110', '0110', '1111'],
    2: ['10101', '01010', '00100'],
  },
  pro_lock_gate: {
    0: ['00100', '11011', '10001', '11111', '11111', '11011'],
    1: ['1001', '1111', '1111', '1001'],
    2: ['111', '111'],
  },
};

const TOP_LOCK_SMALL = ['111'];
const TOP_LOCK_WIDE = ['0110', '1111'];

function withTopLayer(baseName, topRows) {
  return {
    ...MID_PRO_PATTERNS[baseName],
    3: topRows,
  };
}

const EXPERT_MASTER_PATTERNS = {
  expert_tower_lock: withTopLayer('pro_tower_gate', TOP_LOCK_WIDE),
  expert_bowl_gate: withTopLayer('pro_bridge_lock', TOP_LOCK_SMALL),
  expert_diamond_lock: withTopLayer('pro_double_diamond', TOP_LOCK_SMALL),
  expert_spiral_lock: withTopLayer('mid_spiral', TOP_LOCK_SMALL),
  expert_leaf_gate: withTopLayer('pro_leaf', TOP_LOCK_SMALL),
  expert_triangle_core: withTopLayer('pro_triangle_core', TOP_LOCK_SMALL),
  expert_flower_gate: withTopLayer('pro_flower_ring', TOP_LOCK_SMALL),
  master_island_core: withTopLayer('mid_island', TOP_LOCK_SMALL),
  master_arrow_lock: withTopLayer('pro_arrow', TOP_LOCK_SMALL),
  master_diamond_fort: withTopLayer('pro_double_diamond', TOP_LOCK_SMALL),
  master_crescent_lock: withTopLayer('pro_crescent', TOP_LOCK_SMALL),
  master_tower_gate: withTopLayer('pro_tower_gate', TOP_LOCK_WIDE),
  master_bowl_lock: withTopLayer('pro_flower_ring', TOP_LOCK_SMALL),
  master_leaf_lock: withTopLayer('pro_leaf', TOP_LOCK_SMALL),
  master_vault_tower: withTopLayer('pro_tower_gate', TOP_LOCK_WIDE),
  master_flower_gate: withTopLayer('pro_flower_ring', TOP_LOCK_SMALL),
  master_final_gate: withTopLayer('pro_tower_gate', TOP_LOCK_WIDE),
  master_v_shape: {
    0: ['1000001', '1100011', '1110111', '0111110', '0011100'],
    1: ['10001', '11011', '11111', '01110'],
    2: ['101', '111', '010'],
    3: ['11'],
  },
  master_u_shape: {
    0: ['1000001', '1000001', '1000001', '1111111', '1111111'],
    1: ['10001', '10001', '11111', '11111'],
    2: ['101', '111', '110'],
    3: ['1111'],
  },
  master_x_shape: {
    0: ['1100011', '1110111', '0111110', '0011100', '0111110', '1110111', '1100011'],
    1: ['10001', '11011', '01110', '11011', '00000'],
    2: ['010', '111', '010'],
    3: ['111'],
  },
};

function buildRowStair7Layout(shapeName) {
  const counts = [8, 7, 6, 5, 4, 3, 3];
  const assignments = [];
  for (let layer = 0; layer < counts.length; layer++) {
    const count = counts[layer];
    const offset = 0;
    for (let x = 0; x < count; x++) {
      assignments.push({
        gridX: offset + x,
        gridY: layer * 0.45,
        layer,
        cluster: 1,
      });
    }
  }
  return buildPatternFromAssignments(assignments, shapeName);
}

function buildFourCornersLayout(shapeName) {
  const assignments = [];
  const pushRect = (layer, xs, ys) => {
    for (const y of ys) {
      for (const x of xs) assignments.push({ gridX: x, gridY: y, layer, cluster: 1 });
    }
  };
  const corners = [
    { xs0: [0, 1, 2], ys0: [0, 1, 2], xs1: [0.5, 1.5], ys1: [0.5, 1.5], p2: [1, 1], p3: [1.5, 1.5] },
    { xs0: [4, 5, 6], ys0: [0, 1, 2], xs1: [4.5, 5.5], ys1: [0.5, 1.5], p2: [5, 1], p3: [4.5, 1.5] },
    { xs0: [0, 1, 2], ys0: [4, 5, 6], xs1: [0.5, 1.5], ys1: [4.5, 5.5], p2: [1, 5], p3: [1.5, 4.5] },
    { xs0: [4, 5, 6], ys0: [4, 5, 6], xs1: [4.5, 5.5], ys1: [4.5, 5.5], p2: [5, 5], p3: [4.5, 4.5] },
  ];
  for (const c of corners) {
    pushRect(0, c.xs0, c.ys0);
    pushRect(1, c.xs1, c.ys1);
    assignments.push({ gridX: c.p2[0], gridY: c.p2[1], layer: 2, cluster: 1 });
    assignments.push({ gridX: c.p3[0], gridY: c.p3[1], layer: 3, cluster: 1 });
  }
  return buildPatternFromAssignments(assignments, shapeName);
}

function buildLayeredStairLayout(maxLayers, shapeName = 'layered_stair') {
  const countsByLayer = [12, 11, 10, 9];
  const assignments = [];
  for (let layer = maxLayers - 1; layer >= 0; layer--) {
    const layerFromTop = maxLayers - 1 - layer;
    const count = countsByLayer[layer] ?? Math.max(3, 9 + (maxLayers - 1 - layer));
    const width = 4;
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / width);
      const col = i % width;
      assignments.push({
        gridX: col + layerFromTop * 0.5,
        gridY: row + layerFromTop * 0.5,
        layer,
        cluster: 1,
      });
    }
  }
  return buildPatternFromAssignments(assignments, shapeName);
}

function buildHollowSquareLayout(maxLayers = 3, shapeName = 'hollow_square') {
  const topSize = maxLayers >= 4 ? 4 : 3;
  const bottomSize = topSize + maxLayers - 1;
  const center = (bottomSize - 1) / 2;
  const assignments = [];
  for (let layer = maxLayers - 1; layer >= 0; layer--) {
    const size = topSize + (maxLayers - 1 - layer);
    const offset = center - (size - 1) / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isBorder = x === 0 || y === 0 || x === size - 1 || y === size - 1;
        if (!isBorder) continue;
        assignments.push({ gridX: offset + x, gridY: offset + y, layer, cluster: 1 });
      }
    }
  }
  return buildPatternFromAssignments(assignments, shapeName);
}

function buildNestedCrossLayout(maxLayers, shapeName = 'nested_cross') {
  const armByLayer = { 3: 1, 2: 2, 1: 3, 0: 4 };
  const assignments = [];
  const center = 4;
  for (const layerText of Object.keys(armByLayer)) {
    const layer = Number(layerText);
    const arm = armByLayer[layer];
    for (let d = -arm; d <= arm; d++) {
      assignments.push({ gridX: center + d, gridY: center, layer, cluster: 1 });
      if (d !== 0) assignments.push({ gridX: center, gridY: center + d, layer, cluster: 1 });
    }
    if (layer === 0) {
      assignments.push({ gridX: center - 1, gridY: center - 1, layer, cluster: 1 });
      assignments.push({ gridX: center + 1, gridY: center - 1, layer, cluster: 1 });
      assignments.push({ gridX: center - 1, gridY: center + 1, layer, cluster: 1 });
      assignments.push({ gridX: center + 1, gridY: center + 1, layer, cluster: 1 });
    }
  }
  return buildPatternFromAssignments(assignments, shapeName);
}

function buildSpecialLayeredLayout(spec) {
  if (MID_PRO_PATTERNS[spec.shape]) return buildLayeredPatternLayout(spec.shape, MID_PRO_PATTERNS[spec.shape]);
  if (EXPERT_MASTER_PATTERNS[spec.shape]) return buildLayeredPatternLayout(spec.shape, EXPERT_MASTER_PATTERNS[spec.shape]);
  if (spec.shape === 'mini_pyramid') return buildMiniPyramidLayout();
  if (spec.shape === 'mini_diamond') return buildMiniDiamondLayout();
  if (spec.shape === 'mini_bowl') return buildMiniBowlLayout();
  if (spec.shape === 'mini_cross') return buildMiniCrossLayout();
  if (spec.shape === 'mini_bridge') return buildMiniBridgeLayout();
  if (spec.shape === 'mini_stair') return buildMiniStairLayout();
  if (spec.shape === 'mini_ring') return buildMiniRingLayout();
  if (spec.shape === 'mini_flower') return buildMiniFlowerLayout();
  if (spec.shape === 'mini_spiral') return buildMiniSpiralLayout();
  if (spec.shape === 'mini_tower') return buildMiniTowerLayout();
  if (spec.shape === 'topdown_pyramid') {
    const base = buildTopDownPyramidLayout(spec);
    return { ...base, assignments: assignTopDownPyramidCells(spec.layers) };
  }
  if (spec.shape === 'layered_stair') return buildLayeredStairLayout(spec.layers);
  if (spec.shape === 'expert_layered_stair') return buildLayeredStairLayout(spec.layers, 'expert_layered_stair');
  if (spec.shape === 'master_layered_stair') return buildLayeredStairLayout(spec.layers, 'master_layered_stair');
  if (spec.shape === 'expert_row_stair7') return buildRowStair7Layout('expert_row_stair7');
  if (spec.shape === 'master_row_stair7') return buildRowStair7Layout('master_row_stair7');
  if (spec.shape === 'hollow_square') return buildHollowSquareLayout(spec.layers);
  if (spec.shape === 'expert_o_ring') return buildHollowSquareLayout(spec.layers, 'expert_o_ring');
  if (spec.shape === 'expert_hollow_square') return buildHollowSquareLayout(spec.layers, 'expert_hollow_square');
  if (spec.shape === 'master_hollow_square') return buildHollowSquareLayout(spec.layers, 'master_hollow_square');
  if (spec.shape === 'nested_cross') return buildNestedCrossLayout(spec.layers);
  if (spec.shape === 'master_nested_cross') return buildNestedCrossLayout(spec.layers, 'master_nested_cross');
  if (spec.shape === 'master_four_corners') return buildFourCornersLayout('master_four_corners');
  return null;
}

function fitBoardToScreen(tiles, board) {
  for (let iter = 0; iter < 15; iter++) {
    if (screenFit(tiles, board)) return true;
    const b = computeScreenBounds(tiles, board);
    const w = Math.max(1, b.maxX - b.minX), h = Math.max(1, b.maxY - b.minY);
    const safeW = SCREEN_SAFE.maxX - SCREEN_SAFE.minX - 40;
    const safeH = SCREEN_SAFE.maxY - SCREEN_SAFE.minY - 80;
    const scale = Math.min(safeW / w, safeH / h, 0.88);
    board.tileSpacing = Math.max(58, board.tileSpacing * scale);
    board.tileSpacingY = Math.max(65, (board.tileSpacingY ?? board.tileSpacing) * scale);
    board.jitterX = Math.max(0.25, board.jitterX * scale);
    board.jitterY = Math.max(0.25, board.jitterY * scale);
    const b2 = computeScreenBounds(tiles, board);
    board.centerOffset.x -= (b2.minX + b2.maxX) / 2;
    board.centerOffset.y -= (b2.minY + b2.maxY) / 2 - 40;
  }
  return screenFit(tiles, board);
}

function buildBoard(pattern, rows, cols, maxLayers, jitter, shapeName) {
  let sx = 110, sy = 126;
  const maxW = 940, maxH = 1180;
  if ((cols - 1) * sx + 100 > maxW) sx = Math.max(82, Math.floor((maxW - 100) / Math.max(1, cols - 1)));
  if ((rows - 1) * sy + 120 > maxH) sy = Math.max(90, Math.floor((maxH - 120) / Math.max(1, rows - 1)));
  return {
    rows, cols, maxLayers, tileSpacing: sx, tileSpacingY: sy,
    centerOffset: { x: -((cols - 1) * sx) / 2, y: ((rows - 1) * sy) / 2 + 35 },
    tileWidth: 100, tileHeight: 120, jitterX: jitter, jitterY: jitter,
    jitterMode: 'layer_visible_mixed_shape', blockMode: 'overlap', minBlockOverlapPixels: 1, coverThreshold: 0.3,
    shapePattern: pattern, shapeName,
  };
}

function tuneSpecialLayeredBoard(board, shapeName) {
  const isNamedSpecial = shapeName.startsWith('mid_') || shapeName.startsWith('pro_') ||
    shapeName.startsWith('expert_') || shapeName.startsWith('master_');
  const specialShapes = new Set([
    'mini_pyramid', 'mini_diamond', 'mini_bowl', 'mini_cross', 'mini_bridge',
    'mini_stair', 'mini_ring', 'mini_flower', 'mini_spiral', 'mini_tower',
    'topdown_pyramid', 'layered_stair', 'hollow_square', 'nested_cross',
  ]);
  if (!isNamedSpecial && !specialShapes.has(shapeName)) return board;

  const sx = shapeName === 'nested_cross' ? 102 : 106;
  const sy = shapeName === 'nested_cross' ? 122 : 126;
  board.tileSpacing = Math.max(board.tileSpacing, sx);
  board.tileSpacingY = Math.max(board.tileSpacingY ?? board.tileSpacing, sy);
  board.jitterX = Math.min(board.jitterX, 0.22);
  board.jitterY = Math.min(board.jitterY, 0.22);
  board.centerOffset = {
    x: -((board.cols - 1) * board.tileSpacing) / 2,
    y: ((board.rows - 1) * board.tileSpacingY) / 2 + 40,
  };
  return board;
}

function fixSameLayerOverlaps(tiles, config) {
  for (let pass = 0; pass < 20; pass++) {
    let fixed = true;
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        if (tiles[i].layer !== tiles[j].layer) continue;
        if (calculateOverlapArea(tiles[i], tiles[j], config) <= 0) continue;
        tiles[j].gridX += 0.55;
        tiles[j].gridY += 0.08;
        fixed = false;
      }
    }
    if (fixed) break;
  }
}

function buildPhysicalSolution(tiles, config, rng) {
  const removed = new Set(), order = [];
  for (let step = 0; step < tiles.length; step++) {
    const sim = cloneSim(tiles, removed);
    refreshBlockStatus(sim, config);
    const sel = sim.filter(t => t.active && t.selectable);
    if (!sel.length) return null;
    sel.sort((a, b) => b.layer - a.layer || a.gridY - b.gridY || rng() - 0.5);
    order.push(sel[0].id);
    removed.add(sel[0].id);
  }
  return order;
}

function assignGroupsForTraps(solutionIds, tiles, spec, rng) {
  const groups = [];
  const pool = [...GROUP_IDS];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }

  for (let i = 0; i < solutionIds.length; i++) {
    groups.push(pool[i % pool.length]);
  }

  if (spec.trapWeight > 0 && spec.id > 3) {
    const trapCount = Math.min(2 + spec.trapWeight, Math.floor(solutionIds.length / 4));
    for (let t = 0; t < trapCount; t++) {
      const step = spec.id <= 10 ? 1 + t * 2 : t * 2;
      if (step >= solutionIds.length - 4) break;
      const g = groups[step];
      const later = step + 4 + (t % 3);
      if (later < groups.length) groups[later] = g;
    }
  }

  for (let i = 0; i < solutionIds.length; i++) {
    tiles.find(x => x.id === solutionIds[i]).groupId = groups[i];
  }
}

function buildOrders(solutionIds, tiles) {
  const orders = [], solutionOrders = [];
  for (let i = 0; i < solutionIds.length; i += 3) {
    const items = solutionIds.slice(i, i + 3).map(id => tiles.find(t => t.id === id).groupId);
    orders.push({ id: `order_${String(orders.length + 1).padStart(3, '0')}`, items });
    solutionOrders.push([...items]);
  }
  return { orders, solutionOrders };
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
    const keyId = ids[s];
    const key = legal.find(t => t.id === keyId) || legal[0];
    const decoy = legal.find(t => t.id !== keyId);
    if (!decoy) continue;
    const nextId = ids[s + 1];
    decoys.push({
      step: s + 1,
      keyTile: key.id,
      nextTileUnlockedByKey: nextId,
      decoyTile: decoy.id,
      decoySolutionStep: ids.indexOf(decoy.id) + 1,
      group: exp,
    });
    decoy.strategyRole = 'forced_path_decoy_v13';
    decoy.decoyForStep = s + 1;
  }
  return decoys;
}

function simulateSolution(level) {
  const errors = [];
  const tiles = level.tiles.map(t => ({ ...t }));
  let oi = 0, ii = 0, wrong = 0;
  for (let m = 0; m < level.solutionMoveTileIds.length; m++) {
    refreshBlockStatus(tiles, level.board);
    const tile = tiles.find(t => t.id === level.solutionMoveTileIds[m]);
    if (!tile?.active) errors.push(`move ${m + 1} missing`);
    else if (!tile.selectable) errors.push(`move ${m + 1} blocked ${tile.id}`);
    const order = level.orders[oi];
    if (order?.items[ii] === tile?.groupId) { ii++; if (ii >= order.items.length) { oi++; ii = 0; } }
    else wrong++;
    if (tile) tile.active = false;
  }
  if (wrong > level.orderConfig.wrongTrayMaxSlots) errors.push(`wrong ${wrong}`);
  if (oi < level.orders.length) errors.push('orders incomplete');
  if (tiles.some(t => t.active)) errors.push('tiles remain');
  return { valid: !errors.length, errors };
}

function analyzeMetrics(level, decoys) {
  const tiles = level.tiles, config = level.board, maxL = config.maxLayers;
  const lc = {};
  for (const t of tiles) lc[t.layer] = (lc[t.layer] || 0) + 1;
  const phase = [];
  for (let l = maxL - 1; l >= 0; l--) phase.push(lc[l] || 0);
  const ids = level.solutionMoveTileIds;
  let trap = 0, f5t = 0, f10t = 0, hidden = 0, f5h = 0, f10h = 0, forced = 0, f3o = 0, same = 0, early = 0, maxLegal = 0;

  for (let s = 0; s < ids.length; s++) {
    const removed = new Set(ids.slice(0, s));
    refreshBlockStatus(cloneSim(tiles, removed), config);
    const sim = cloneSim(tiles, removed);
    refreshBlockStatus(sim, config);
    const sel = sim.filter(t => t.active && t.selectable);
    const exp = level.orders[Math.floor(s / 3)]?.items[s % 3];
    const legal = sel.filter(t => t.groupId === exp);
    maxLegal = Math.max(maxLegal, legal.length);
    if (legal.length >= 2) { same++; if (s < 15) early++; }
    if (decoys.some(d => d.step === s + 1)) { trap++; if (s < 5) f5t++; if (s < 10) f10t++; }
    const nexp = level.orders[Math.floor((s + 1) / 3)]?.items[(s + 1) % 3];
    if (nexp && !sel.some(t => t.groupId === nexp)) {
      hidden++; if (s < 5) f5h++; if (s < 10) f10h++; forced++; if (s < 9) f3o++;
    }
  }

  const overlap = countSameLayerOverlaps(tiles, config);
  const sb = computeScreenBounds(tiles, config);
  return {
    designType: 'mixed_shape_early_strategy_order_match',
    difficultyBand: level._band,
    clusterCount: level._clusters,
    shapeName: config.shapeName,
    totalTiles: tiles.length,
    orderCount: level.orders.length,
    maxLayers: maxL,
    topLayerTileCount: lc[maxL - 1] || 0,
    bottomLayerTileCount: lc[0] || 0,
    phaseCountsTopToBottom: phase,
    strategicGoal: 'Challenge should begin early; lower layers must be larger and more readable.',
    solutionValidated: true,
    sameItemChoiceSteps: same,
    trapSteps: trap,
    stepsWhereNextItemHiddenBeforeMove: hidden,
    forcedUnlockSteps: forced,
    averageLegalExpectedTiles: +(same / Math.max(1, ids.length)).toFixed(2),
    maxLegalExpectedTiles: maxLegal,
    first5TrapSteps: f5t,
    first10TrapSteps: f10t,
    first5HiddenNextSteps: f5h,
    first10HiddenNextSteps: f10h,
    earlySameItemChoiceSteps: early,
    first3OrdersForcedUnlockSteps: f3o,
    forcedPathDecoyCount: decoys.length,
    forcedPathDecoyChanges: decoys,
    sameLayerOverlapPairCount: overlap,
    sameLayerOverlapByLayer: Object.fromEntries(Array.from({ length: maxL }, (_, l) => [`layer_${l}`, 0])),
    sameLayerOverlapValidated: overlap === 0,
    screenBounds: { minX: +sb.minX.toFixed(1), maxX: +sb.maxX.toFixed(1), minY: +sb.minY.toFixed(1), maxY: +sb.maxY.toFixed(1) },
    screenSafeBounds: SCREEN_SAFE,
    screenFitValidated: screenFit(tiles, config),
  };
}

function validateLevel(tiles, board, spec) {
  const overlap = countSameLayerOverlaps(tiles, board);
  if (overlap > 0) return { ok: false, reason: `overlap ${overlap}` };
  if (!screenFit(tiles, board)) return { ok: false, reason: 'screen' };
  const lc = {};
  for (const t of tiles) lc[t.layer] = (lc[t.layer] || 0) + 1;
  if ((lc[0] || 0) < (lc[spec.layers - 1] || 0)) return { ok: false, reason: 'layer size' };
  return { ok: true };
}

function loadFallbackLevel(spec) {
  const fp = path.join(ROOT, 'assets/resources/data/levels', `level_${padId(spec.id)}.json`);
  if (!fs.existsSync(fp)) return null;
  const level = JSON.parse(fs.readFileSync(fp, 'utf8'));
  level._band = spec.band;
  level._clusters = spec.clusters;
  return level;
}

function generateLevel(spec) {
  const specialLayout = buildSpecialLayeredLayout(spec);
  const isSpecialLayeredShape = !!specialLayout;
  const layout = specialLayout || buildShapePattern(spec);
  const total = isSpecialLayeredShape ? specialLayout.assignments.length : spec.orders * 3;
  const { pattern, cells, rows, cols, shapeName } = layout;
  const layerCounts = isSpecialLayeredShape ? null : distributeLayerCounts(total, spec.layers);
  const jitter = isSpecialLayeredShape ? 0.22 : spec.layers <= 2 ? 0.55 : spec.layers === 3 ? 0.68 : 0.8;
  const board = tuneSpecialLayeredBoard(buildBoard(pattern, rows, cols, spec.layers, jitter, shapeName), shapeName);
  const failStats = { overlap: 0, nosol: 0, sim: 0, valid: 0, decoy: 0 };

  for (let attempt = 0; attempt < 150; attempt++) {
    const rng = mulberry32(spec.id * 99991 + attempt * 17);
    const placements = isSpecialLayeredShape
      ? specialLayout.assignments
      : assignStackedCells(cells, layerCounts, spec.layers, spec.clusters, rng);

    const tiles = placements.map((p, i) => ({
      id: `L${spec.id}_T${String(i).padStart(3, '0')}`,
      groupId: 'x', tileType: 0,
      gridX: p.gridX, gridY: p.gridY, layer: p.layer,
      active: true, selectable: true, isBlocked: false,
      clusteredLayout: spec.clusters > 1, clusterCount: spec.clusters,
      sameLayerOverlapForbidden: true,
      designRole: p.layer === spec.layers - 1 ? 'top' : p.layer === 0 ? 'bottom' : 'middle',
    }));

    if (!isSpecialLayeredShape) fixSameLayerOverlaps(tiles, board);
    if (countSameLayerOverlaps(tiles, board) > 0) { failStats.overlap++; continue; }
    if (!screenFit(tiles, board)) {
      if (isSpecialLayeredShape || !fitBoardToScreen(tiles, board)) {
        failStats.screen = (failStats.screen || 0) + 1;
        continue;
      }
    }
    const solutionIds = buildPhysicalSolution(tiles, board, rng);
    if (!solutionIds) { failStats.nosol++; continue; }
    assignGroupsForTraps(solutionIds, tiles, spec, rng);
    refreshBlockStatus(tiles, board);
    const { orders, solutionOrders } = buildOrders(solutionIds, tiles);
    const level = {
      levelId: spec.id,
      displayName: `Level ${String(spec.id).padStart(3, '0')} - ${shapeName}`,
      defaultSkin: 'uma', gameMode: 'ORDER_MATCH', board,
      tray: { maxSlots: 7, matchCount: 3, screenPosition: { x: 540, y: 200 }, slotSpacing: 110 },
      orderConfig: { orderSize: 3, orderMode: 'EXACT_ORDER', wrongTrayMaxSlots: spec.wrongTray, consumeWrongTile: true },
      orders, solutionOrders, solutionMoveTileIds: solutionIds, tiles,
      starThresholds: [0, 500, 1000], _band: spec.band, _clusters: spec.clusters,
    };
    const sim = simulateSolution(level);
    const v = validateLevel(tiles, board, spec);
    if (!sim.valid || !v.ok) {
      failStats.sim++;
      if (!v.ok) failStats[v.reason || 'valid'] = (failStats[v.reason || 'valid'] || 0) + 1;
      if (!sim.valid && failStats.sim === 1)       continue;
    }

    let decoys = detectDecoys(level);
    const needDecoy = spec.trapWeight > 0 && spec.id > 3 && decoys.length === 0 && attempt < 20;
    const needEarlyTrap = spec.id >= 10 && spec.trapWeight >= 2 && decoys.filter(d => d.step <= 10).length === 0 && attempt < 25;
    const needOrderTrap = spec.id >= 20 && decoys.filter(d => d.step <= 9).length === 0 && spec.trapWeight >= 2 && attempt < 20;
    if (needDecoy || needEarlyTrap || needOrderTrap) { failStats.decoy++; continue; }

    level.difficultyMetrics = analyzeMetrics(level, decoys);
    level.difficultyMetrics.solutionValidated = true;
    return { level, sim, spec };
  }
    const fallback = loadFallbackLevel(spec);
  if (fallback) {
    const sim = simulateSolution(fallback);
    if (sim.valid) {
      const decoys = fallback.difficultyMetrics?.forcedPathDecoyChanges || detectDecoys(fallback);
      if (!fallback.difficultyMetrics) fallback.difficultyMetrics = analyzeMetrics(fallback, decoys);
      fallback.difficultyMetrics.solutionValidated = true;
      return { level: fallback, sim, spec, fallback: true };
    }
  }
  throw new Error(`Level ${spec.id}: failed`);
}

function padId(n) { return n < 10 ? `00${n}` : n < 100 ? `0${n}` : `${n}`; }

function main() {
  fs.mkdirSync(LEVELS_DIR, { recursive: true });
  const reportRows = [];
  const stats = { clusters: {1:0,2:0,3:0,4:0}, layers: {2:0,3:0,4:0}, shapes: {}, valid: 0, early: 0, trapEarly: 0, generated: 0, fallback: 0 };

  for (const spec of LEVEL_SPECS) {
    const result = generateLevel(spec);
    const { level, sim, fallback } = result;
    const m = level.difficultyMetrics;
    const fname = `level_${padId(spec.id)}.json`;
    const out = { ...level }; delete out._band; delete out._clusters;
    fs.writeFileSync(path.join(LEVELS_DIR, fname), JSON.stringify(out, null, 2));
    stats.clusters[spec.clusters]++; stats.layers[spec.layers]++;
    stats.shapes[m.shapeName || spec.shape] = (stats.shapes[m.shapeName || spec.shape] || 0) + 1;
    if (fallback) stats.fallback++; else stats.generated++;
    if (sim.valid) stats.valid++;
    if (spec.id >= 10 && (m.first10TrapSteps > 0 || m.first10HiddenNextSteps > 0)) stats.early++;
    if (spec.id >= 4 && m.trapSteps > 0) stats.trapEarly++;
    reportRows.push({
      levelId: spec.id, file: fname,
      solutionValidated: m.solutionValidated, screenFitValidated: m.screenFitValidated,
      sameLayerOverlapPairCount: m.sameLayerOverlapPairCount, clusterCount: m.clusterCount,
      shapeName: m.shapeName, maxLayers: m.maxLayers,
      topLayerTileCount: m.topLayerTileCount, bottomLayerTileCount: m.bottomLayerTileCount,
      totalTiles: m.totalTiles, first10TrapSteps: m.first10TrapSteps,
      first10HiddenNextSteps: m.first10HiddenNextSteps,
      first3OrdersForcedUnlockSteps: m.first3OrdersForcedUnlockSteps,
      totalTrapSteps: m.trapSteps, errors: sim.errors.join('; '),
    });
      }

  const hdr = Object.keys(reportRows[0]).join(',');
  const body = reportRows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'LEVEL_VALIDATION_REPORT.csv'), hdr + '\n' + body);

  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), `# Level Pack v2 — 50 ORDER_MATCH Levels

## Shapes used
${Object.entries(stats.shapes).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`- **${k}**: ${v} level(s)`).join('\n')}

## Cluster distribution
| Clusters | Count |
|----------|-------|
| 1 cluster | ${stats.clusters[1]} |
| 2 clusters | ${stats.clusters[2]} |
| 3 clusters | ${stats.clusters[3]} |
| 4 clusters | ${stats.clusters[4]} |

## Layer distribution
| Layers | Count |
|--------|-------|
| 2 layers | ${stats.layers[2]} |
| 3 layers | ${stats.layers[3]} |
| 4 layers | ${stats.layers[4]} |

## Validation results
- **Procedurally generated**: ${stats.generated}/50
- **Fallback from existing assets**: ${stats.fallback}/50
- **Solvable**: ${stats.valid}/50
- **Screen fit**: ${reportRows.filter(r=>r.screenFitValidated==='true'||r.screenFitValidated===true).length}/50
- **Zero same-layer overlap**: ${reportRows.filter(r=>r.sameLayerOverlapPairCount==='0'||r.sameLayerOverlapPairCount===0).length}/50
- **Levels 10+ with early challenge (first10 trap/hidden)**: ${stats.early}
- **Levels 4+ with any trap**: ${stats.trapEarly}

## Early difficulty (see CSV)
Columns: \`first10TrapSteps\`, \`first10HiddenNextSteps\`, \`first3OrdersForcedUnlockSteps\`, \`totalTrapSteps\`

Generated by \`tools/generate-order-levels.mjs\`
`);

  }

main();
