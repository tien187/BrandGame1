#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PACK_DIR = path.join(ROOT, process.env.PACK_NAME ?? 'generated_levels_full_pack');
const LEVELS_DIR = path.join(PACK_DIR, 'levels');
const OUT_PATH = path.join(PACK_DIR, 'LEVEL_SOLUTION_GUIDE.md');

function padId(id) {
  return String(id).padStart(3, '0');
}

function formatTile(tile) {
  if (!tile) return 'missing tile';
  const role = tile.strategyRole ? `, role=${tile.strategyRole}` : '';
  const decoy = tile.decoyForStep ? `, decoyForStep=${tile.decoyForStep}` : '';
  return `${tile.id} | ${tile.groupId} | layer=${tile.layer} | grid=(${tile.gridX},${tile.gridY})${role}${decoy}`;
}

function getOrderItem(level, orderIndex, itemIndex) {
  return {
    orderIndex,
    itemIndex,
    orderId: level.orders?.[orderIndex]?.id ?? `order_${padId(orderIndex + 1)}`,
    item: level.orders?.[orderIndex]?.items?.[itemIndex] ?? '',
  };
}

function buildLevelGuide(level) {
  const tileById = new Map(level.tiles.map(tile => [tile.id, tile]));
  const metrics = level.difficultyMetrics ?? {};
  const lines = [];
  lines.push(`## Level ${padId(level.levelId)} - ${level.board?.shapeName ?? metrics.shapeName ?? 'unknown'}`);
  lines.push('');
  lines.push(`- Shape: ${level.board?.shapeName ?? metrics.shapeName ?? 'unknown'}`);
  lines.push(`- Layers: ${metrics.maxLayers ?? level.board?.maxLayers ?? ''}`);
  lines.push(`- Tiles: ${level.tiles.length}`);
  lines.push(`- Orders: ${level.orders.length}`);
  lines.push(`- Early traps: first10TrapSteps=${metrics.first10TrapSteps ?? ''}, first3OrdersForcedUnlockSteps=${metrics.first3OrdersForcedUnlockSteps ?? ''}`);
  lines.push('');
  lines.push('| Step | Order | Slot | Need | Tile | Layer | Grid | Notes |');
  lines.push('|---:|---|---:|---|---|---:|---|---|');

  let orderIndex = 0;
  let itemIndex = 0;
  for (let i = 0; i < level.solutionMoveTileIds.length; i++) {
    const tileId = level.solutionMoveTileIds[i];
    const tile = tileById.get(tileId);
    const { orderId, item } = getOrderItem(level, orderIndex, itemIndex);
    const group = tile?.groupId ?? '';
    const mismatch = item && group && item !== group ? `expected ${item}, tile group ${group}` : '';
    const role = tile?.strategyRole ? tile.strategyRole : '';
    const note = [role, mismatch].filter(Boolean).join('; ');
    lines.push([
      i + 1,
      orderId,
      itemIndex + 1,
      item,
      tileId,
      tile?.layer ?? '',
      tile ? `(${tile.gridX},${tile.gridY})` : '',
      note,
    ].join(' | '));

    if (item && group === item) {
      itemIndex++;
    }

    if (itemIndex >= (level.orders?.[orderIndex]?.items?.length ?? 3)) {
      lines.push(`|  |  |  |  |  |  |  | Complete order ${orderIndex + 1} |`);
      orderIndex++;
      itemIndex = 0;
    }
  }

  const decoys = metrics.forcedPathDecoyChanges ?? [];
  if (decoys.length > 0) {
    lines.push('');
    lines.push('Forced-path decoys:');
    for (const decoy of decoys) {
      lines.push(`- Step ${decoy.step}: correct ${decoy.keyTile} opens ${decoy.nextTileUnlockedByKey}; decoy ${decoy.decoyTile} (${decoy.group}) => ${decoy.consequence}`);
    }
  }

  lines.push('');
  lines.push('Tile quick reference:');
  for (const tileId of level.solutionMoveTileIds) {
    lines.push(`- ${formatTile(tileById.get(tileId))}`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const chunks = [];
  chunks.push('# Level Solution Guide');
  chunks.push('');
  chunks.push('Generated from `solutionMoveTileIds`, `orders`, and `tiles` in `generated_levels_full_pack/levels`.');
  chunks.push('Follow the steps top-to-bottom; some steps may be required unlockers that do not advance the current order.');
  chunks.push('');

  for (let id = 1; id <= 50; id++) {
    const filePath = path.join(LEVELS_DIR, `level_${padId(id)}.json`);
    const level = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    chunks.push(buildLevelGuide(level));
  }

  fs.writeFileSync(OUT_PATH, chunks.join('\n'), 'utf8');
  }

main();
