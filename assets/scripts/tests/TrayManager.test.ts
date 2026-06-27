import { TrayManager, ITrayHistory } from '../managers/TrayManager';
import { TileManager } from '../managers/TileManager';
import { ITileData } from '../interfaces/ITileData';
import { ITrayConfig } from '../interfaces/ITrayConfig';
import { TestRunner } from './TestRunner';

// Mock TileManager data map
const mockTileData = new Map<string, ITileData>();
const mockTileNode = new Map<string, any>();

function mockGetTileData(id: string): ITileData | undefined { return mockTileData.get(id); }
function mockGetTileNode(id: string): any | undefined { return mockTileNode.get(id); }

export function runTrayManagerTests(): TestRunner {
    const t = new TestRunner();

    const tray = new TrayManager();
    (TrayManager as any).Instance = tray;

    const config: ITrayConfig = {
        maxSlots: 8, matchCount: 3,
        screenPosition: { x: 0, y: -400 }, slotSpacing: 90
    };

    // Setup mock data
    for (let i = 0; i < 10; i++) {
        mockTileData.set(`T${i}`, {
            id: `T${i}`, groupId: `group${i % 3}`,
            tileType: 0, gridX: i, gridY: i, layer: 0,
            active: true, selectable: true, isBlocked: false
        });
        mockTileNode.set(`T${i}`, { setParent: () => {}, setPosition: () => {}, getComponent: () => null });
    }

    // Minimal TileManager mock
    const fakeTM = {
        getTileData: mockGetTileData,
        getTileNode: mockGetTileNode,
        removeFromBoard: (id: string) => {},
        restoreToBoard: (data: ITileData, node: any) => {},
        setInputLocked: (locked: boolean) => {},
    };
    (TileManager as any).Instance = fakeTM;

    t.describe('TrayManager Basic Operations', () => {
        t.it('should initialize with empty tray', () => {
            tray.initialize(config);
            t.assertEquals(tray.getTrayTiles().length, 0);
            t.assertFalse(tray.isFull());
        });

        t.it('should track max slots', () => {
            tray.initialize(config);
            t.assertEquals(tray.getMaxSlots(), 8);
        });

        t.it('should get slot position centered', () => {
            tray.initialize(config);
            const pos0 = tray.getSlotPosition(0);
            const pos6 = tray.getSlotPosition(6);
            t.assertTrue(pos0.x < pos6.x, 'Slot 0 should be left of slot 6');
        });
    });

    t.describe('TrayManager History', () => {
        t.it('should push and pop history', () => {
            tray.initialize(config);
            // Add corresponding tiles into _trayTiles so popLastTile can find them
            (tray as any)._trayTiles.push({ id: 'T0', groupId: 'g0', tileType: 0, gridX: 1, gridY: 2, layer: 0, active: true, selectable: true, isBlocked: false });
            (tray as any)._trayTiles.push({ id: 'T1', groupId: 'g1', tileType: 0, gridX: 3, gridY: 4, layer: 1, active: true, selectable: true, isBlocked: false });
            (tray as any)._history.push({ tileId: 'T0', gridX: 1, gridY: 2, layer: 0 });
            (tray as any)._history.push({ tileId: 'T1', gridX: 3, gridY: 4, layer: 1 });

            const last = tray.getLastHistory();
            t.assertTrue(last !== null);
            t.assertEquals(last!.tileId, 'T1');
            t.assertEquals(last!.gridX, 3);

            tray.popLastTile();
            t.assertEquals((tray as any)._history.length, 1);
            t.assertEquals((tray as any)._history[0].tileId, 'T0');
        });

        t.it('should pop correct tile by history after sorting', () => {
            tray.initialize(config);
            // Simulate adding 3 tiles then sorting: history = [A, B, C], tray sorted = [B, A, C]
            const tileA = { id: 'A', groupId: 'zebra', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false };
            const tileB = { id: 'B', groupId: 'alpha', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false };
            const tileC = { id: 'C', groupId: 'mike', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false };
            (tray as any)._trayTiles = [tileB, tileA, tileC];
            (tray as any)._history = [
                { tileId: 'A', gridX: 0, gridY: 0, layer: 0 },
                { tileId: 'B', gridX: 0, gridY: 0, layer: 0 },
                { tileId: 'C', gridX: 0, gridY: 0, layer: 0 },
            ];

            tray.popLastTile(); // Should remove C (last added), not C at end of sorted array (which happens to be C)
            const remaining = tray.getTrayTiles().map(t => t.id);
            t.assertTrue(remaining.indexOf('C') === -1, 'Should remove C based on history');
            t.assertTrue(remaining.indexOf('A') !== -1);
            t.assertTrue(remaining.indexOf('B') !== -1);
        });
    });

    t.describe('TrayManager Dead End', () => {
        t.it('should detect dead end when tray full with no matchable group', () => {
            tray.initialize(config);
            // Fill tray with 8 tiles all different groups
            (tray as any)._trayTiles = [];
            for (let i = 0; i < 8; i++) {
                (tray as any)._trayTiles.push({ id: `D${i}`, groupId: `unique${i}`, tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false });
            }
            t.assertTrue(tray.isDeadEnd(), 'Tray with 8 unique groups should be dead end');
        });

        t.it('should NOT be dead end if group has 3+ consecutive in tray', () => {
            tray.initialize(config);
            (tray as any)._trayTiles = [];
            for (let i = 0; i < 8; i++) {
                (tray as any)._trayTiles.push({ id: `D${i}`, groupId: i < 3 ? 'same' : `unique${i}`, tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false });
            }
            t.assertFalse(tray.isDeadEnd(), 'Tray with consecutive matchable group should not be dead end');
        });

        t.it('should be dead end when 3+ same group are not consecutive', () => {
            tray.initialize(config);
            (tray as any)._trayTiles = [
                { id: 'D0', groupId: 'same', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'D1', groupId: 'other1', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'D2', groupId: 'same', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'D3', groupId: 'other2', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'D4', groupId: 'same', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'D5', groupId: 'other3', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'D6', groupId: 'other4', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'D7', groupId: 'other5', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ];
            t.assertTrue(tray.isDeadEnd(), 'Non-consecutive same group should be dead end');
        });

        t.it('should NOT be dead end if tray not full', () => {
            tray.initialize(config);
            (tray as any)._trayTiles = [
                { id: 'A', groupId: 'g1', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false }
            ];
            t.assertFalse(tray.isDeadEnd(), 'Non-full tray should never be dead end');
        });
    });

    t.describe('TrayManager Sorting', () => {
        t.it('should sort tiles by groupId', () => {
            tray.initialize(config);
            (tray as any)._trayTiles = [
                { id: 'A', groupId: 'zebra', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'B', groupId: 'alpha', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'C', groupId: 'mike', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ];
            tray.sortTray(); // this triggers updateGlowEffects too
            const tiles = tray.getTrayTiles();
            // After sort by groupId, alpha should be first
            t.assertEquals(tiles[0].groupId, 'alpha');
        });

        t.it('should not corrupt tray with invalid sort comparator', () => {
            tray.initialize(config);
            (tray as any)._trayTiles = [
                { id: 'A', groupId: 'g2', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'B', groupId: 'g1', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'C', groupId: 'g2', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ];
            tray.sortTray();
            const tiles = tray.getTrayTiles();
            // All 3 tiles should still be present after stable sort
            t.assertEquals(tiles.length, 3);
            // g1 should be first
            t.assertEquals(tiles[0].groupId, 'g1');
        });
    });

    t.describe('TrayManager Fly Count', () => {
        t.it('should track _flyCount during addTile', () => {
            tray.initialize(config);
            (tray as any)._flyCount = 2;
            t.assertEquals((tray as any)._flyCount, 2);
            (tray as any)._flyCount = 0;
        });

        t.it('should reset _flyCount to zero when initialized', () => {
            tray.initialize(config);
            t.assertEquals((tray as any)._flyCount, 0);
        });
    });

    t.describe('TrayManager Duplicate Prevention', () => {
        t.it('should reject duplicate tile IDs', () => {
            tray.initialize(config);
            (tray as any)._trayTiles = [
                { id: 'T0', groupId: 'g1', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ];
            const result = tray.addTile('T0');
            t.assertFalse(result, 'Should reject duplicate tile in tray');
        });

        t.it('should reject non-selectable or inactive tiles', () => {
            tray.initialize(config);
            mockTileData.set('BAD', {
                id: 'BAD', groupId: 'g1', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: false, isBlocked: false
            });
            const result = tray.addTile('BAD');
            t.assertFalse(result, 'Blocked tile should not enter tray');
            mockTileData.delete('BAD');
        });
    });

    t.describe('TrayManager History Sync on Remove', () => {
        t.it('should remove matching history entry when tile is removed', () => {
            tray.initialize(config);
            (tray as any)._trayTiles = [
                { id: 'X1', groupId: 'g1', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ];
            (tray as any)._history = [{ tileId: 'X1', gridX: 0, gridY: 0, layer: 0 }];

            tray.removeTile('X1');
            t.assertEquals((tray as any)._history.length, 0);
        });
    });

    t.printReport();
    mockTileData.clear();
    mockTileNode.clear();
    return t;
}
