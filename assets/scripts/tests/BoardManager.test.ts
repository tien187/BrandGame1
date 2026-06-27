import { Vec3 } from 'cc';
import { BoardManager } from '../managers/BoardManager';
import { ITileData } from '../interfaces/ITileData';
import { IBoardConfig } from '../interfaces/IBoardConfig';
import { TestRunner } from './TestRunner';

/**
 * Unit Tests for BoardManager
 * Run: attach to any node in scene and call runTests() from onLoad
 */
export function runBoardManagerTests(): TestRunner {
    const t = new TestRunner();
    const board = new BoardManager();
    (BoardManager as any).Instance = board;

    const config: IBoardConfig = {
        rows: 4, cols: 4, maxLayers: 3,
        tileSpacing: 80, centerOffset: { x: 0, y: 0 },
        coverThreshold: 0.3
    };

    t.describe('BoardManager Grid & Register', () => {
        t.it('should build board and clear grid', () => {
            board.buildBoard(config);
            t.assertEquals(board.getTilesAtCell(0, 0).length, 0);
        });

        t.it('should register tile and sort by layer', () => {
            board.buildBoard(config);
            const tile1: ITileData = { id: 'A', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 1, active: true, selectable: true, isBlocked: false };
            const tile2: ITileData = { id: 'B', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false };
            board.registerTile(tile1);
            board.registerTile(tile2);
            const cell = board.getTilesAtCell(1, 1);
            t.assertEquals(cell.length, 2);
            t.assertEquals(cell[0].layer, 0);
            t.assertEquals(cell[1].layer, 1);
        });

        t.it('should unregister tile correctly', () => {
            board.buildBoard(config);
            const tile: ITileData = { id: 'C', groupId: 'g1', tileType: 0, gridX: 2, gridY: 2, layer: 0, active: true, selectable: true, isBlocked: false };
            board.registerTile(tile);
            board.unregisterTile(tile);
            t.assertEquals(board.getTilesAtCell(2, 2).length, 0);
        });
    });

    t.describe('BoardManager Occlusion', () => {
        t.it('should not block top layer tile', () => {
            board.buildBoard(config);
            const bottom: ITileData = { id: 'B1', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false };
            const top: ITileData = { id: 'T1', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 1, active: true, selectable: true, isBlocked: false };
            board.registerTile(bottom);
            board.registerTile(top);
            t.assertFalse(board.isTileBlocked(top), 'Top layer should not be blocked');
        });

        t.it('should block bottom tile if coverage exceeds threshold', () => {
            const lowThresholdConfig = { ...config, coverThreshold: 0.2 };
            board.buildBoard(lowThresholdConfig);
            const bottom: ITileData = { id: 'B2', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false };
            const top: ITileData = { id: 'T2', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 1, active: true, selectable: true, isBlocked: false };
            board.registerTile(bottom);
            board.registerTile(top);
            const isBlocked = board.isTileBlocked(bottom);
            // With default tileOverlapRatio 0.35 and threshold 0.2, coverage should exceed threshold
            t.assertTrue(isBlocked, 'Bottom tile should be blocked by top tile');
        });

        t.it('should return 0 coverage for tile with no coverers', () => {
            board.buildBoard(config);
            const tile: ITileData = { id: 'S1', groupId: 'g1', tileType: 0, gridX: 3, gridY: 3, layer: 0, active: true, selectable: true, isBlocked: false };
            board.registerTile(tile);
            t.assertEquals(board.calculateCoverage(tile), 0);
        });

        t.it('should block inactive tile', () => {
            board.buildBoard(config);
            const tile: ITileData = { id: 'I1', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: false, selectable: true, isBlocked: false };
            t.assertTrue(board.isTileBlocked(tile), 'Inactive tile should be blocked');
        });
    });

    t.describe('BoardManager World Position', () => {
        t.it('should return ZERO when no config', () => {
            (board as any)._config = null;
            const pos = board.getWorldPosition(0, 0, 0);
            t.assertEquals(pos.x, 0);
            t.assertEquals(pos.y, 0);
        });

        t.it('should calculate consistent jitter for same layer', () => {
            board.buildBoard(config);
            const pos1 = board.getWorldPosition(1, 1, 2);
            const pos2 = board.getWorldPosition(1, 1, 2);
            t.assertEquals(pos1.x, pos2.x);
            t.assertEquals(pos1.y, pos2.y);
        });

        t.it('should have higher Z for higher layer', () => {
            board.buildBoard(config);
            const pos0 = board.getWorldPosition(0, 0, 0);
            const pos1 = board.getWorldPosition(0, 0, 1);
            t.assertTrue(pos1.z > pos0.z);
        });
    });

    t.describe('BoardManager Edge Cases', () => {
        t.it('should handle negative layer jitter safely', () => {
            board.buildBoard(config);
            const pos = board.getWorldPosition(0, 0, -1);
            // Should not throw and should return valid Vec3
            t.assertTrue(pos instanceof Vec3);
        });

        t.it('should handle multiple tiles same cell different layers', () => {
            board.buildBoard(config);
            for (let i = 0; i < 5; i++) {
                const tile: ITileData = { id: `M${i}`, groupId: 'g1', tileType: 0, gridX: 2, gridY: 2, layer: i, active: true, selectable: true, isBlocked: false };
                board.registerTile(tile);
            }
            const cell = board.getTilesAtCell(2, 2);
            t.assertEquals(cell.length, 5);
            // Verify sorted by layer
            for (let i = 1; i < cell.length; i++) {
                t.assertTrue(cell[i].layer >= cell[i - 1].layer, 'Layers should be sorted ascending');
            }
        });

        t.it('should return 0 coverage when config is null', () => {
            (board as any)._config = null;
            const tile: ITileData = { id: 'N1', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false };
            t.assertEquals(board.calculateCoverage(tile), 0);
        });

        t.it('should return ZERO for non-finite coordinates', () => {
            board.buildBoard(config);
            const pos = board.getWorldPosition(NaN, Infinity, 0);
            t.assertEquals(pos.x, 0);
            t.assertEquals(pos.y, 0);
            t.assertEquals(pos.z, 0);
        });

        t.it('should cleanup empty cell key after unregister', () => {
            board.buildBoard(config);
            const tile: ITileData = { id: 'C1', groupId: 'g1', tileType: 0, gridX: 3, gridY: 3, layer: 0, active: true, selectable: true, isBlocked: false };
            board.registerTile(tile);
            board.unregisterTile(tile);
            t.assertFalse(board.hasTilesAtCell(3, 3));
        });

        t.it('should block tile when board config is null', () => {
            (board as any)._config = null;
            const tile: ITileData = { id: 'N2', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false };
            t.assertTrue(board.isTileBlocked(tile), 'Tile should be blocked when config is missing');
        });

        t.it('should block tile from adjacent cell overlap', () => {
            board.buildBoard(config);
            // tileSpacing=80, tileSize=100 => adjacent tiles can overlap by 20 units
            const bottom: ITileData = { id: 'B4', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false };
            const top: ITileData = { id: 'T5', groupId: 'g1', tileType: 0, gridX: 2, gridY: 1, layer: 1, active: true, selectable: true, isBlocked: false };
            board.registerTile(bottom);
            board.registerTile(top);
            t.assertTrue(board.isTileBlocked(bottom), 'Bottom tile should be blocked by adjacent top tile overlapping it');
            t.assertFalse(board.isTileBlocked(top), 'Top tile should not be blocked');
        });

        t.it('should not block tile when adjacent tile does not overlap', () => {
            board.buildBoard(config);
            const bottom: ITileData = { id: 'B5', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false };
            const top: ITileData = { id: 'T6', groupId: 'g1', tileType: 0, gridX: 3, gridY: 1, layer: 1, active: true, selectable: true, isBlocked: false };
            board.registerTile(bottom);
            board.registerTile(top);
            t.assertFalse(board.isTileBlocked(bottom), 'Bottom tile should not be blocked by far adjacent tile');
        });

        t.it('should accumulate coverage from multiple coverers', () => {
            board.buildBoard(config);
            const bottom: ITileData = { id: 'B3', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false };
            const top1: ITileData = { id: 'T3', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 1, active: true, selectable: true, isBlocked: false };
            const top2: ITileData = { id: 'T4', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 2, active: true, selectable: true, isBlocked: false };
            board.registerTile(bottom);
            board.registerTile(top1);
            board.registerTile(top2);
            const coverage = board.calculateCoverage(bottom);
            t.assertTrue(coverage >= board.calculateCoverage(top1), 'Multiple coverers should increase or maintain coverage');
        });

        t.it('should return 0 coverage when tileSize is 0', () => {
            board.buildBoard(config);
            board.tileSize = 0;
            const bottom: ITileData = { id: 'B0', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false };
            const top: ITileData = { id: 'T0', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 1, active: true, selectable: true, isBlocked: false };
            board.registerTile(bottom);
            board.registerTile(top);
            t.assertEquals(board.calculateCoverage(bottom), 0, 'Zero tileSize should yield 0 coverage');
            board.tileSize = 100; // restore
        });
    });

    t.printReport();
    return t;
}
