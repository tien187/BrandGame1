import { BoosterManager } from '../managers/BoosterManager';
import { TileManager } from '../managers/TileManager';
import { TrayManager } from '../managers/TrayManager';
import { MatchManager } from '../managers/MatchManager';
import { BoosterType } from '../enums/BoosterType';
import { ITileData } from '../interfaces/ITileData';
import { TestRunner } from './TestRunner';

export function runBoosterManagerTests(): TestRunner {
    const t = new TestRunner();
    const bm = new BoosterManager();
    (BoosterManager as any).Instance = bm;

    t.describe('BoosterManager Inventory', () => {
        t.it('should add and consume booster', () => {
            bm.addBooster(BoosterType.UNDO, 5);
            t.assertEquals(bm.getBoosterCount(BoosterType.UNDO), 5);
            t.assertTrue(bm.hasBooster(BoosterType.UNDO));

            bm.consumeBooster(BoosterType.UNDO);
            t.assertEquals(bm.getBoosterCount(BoosterType.UNDO), 4);
        });

        t.it('should return 0 for missing booster', () => {
            t.assertEquals(bm.getBoosterCount(BoosterType.MAGNET), 0);
            t.assertFalse(bm.hasBooster(BoosterType.MAGNET));
        });

        t.it('should not consume below zero', () => {
            bm.consumeBooster(BoosterType.SHUFFLE);
            t.assertEquals(bm.getBoosterCount(BoosterType.SHUFFLE), 0);
        });

        t.it('should cap at maxStack', () => {
            // Assuming default maxStack = 99
            bm.addBooster(BoosterType.UNDO, 200);
            t.assertTrue(bm.getBoosterCount(BoosterType.UNDO) <= 99);
        });

        t.it('should reject NONE booster usage', () => {
            const result = bm.useBooster(BoosterType.NONE);
            t.assertFalse(result, 'NONE booster should always fail');
        });
    });

    t.describe('BoosterManager Undo Logic', () => {
        t.it('should fail undo without history', () => {
            const result = (bm as any).executeUndo();
            t.assertFalse(result, 'Undo without history should fail');
        });

        t.it('should restore correct position from history', () => {
            const fakeData: ITileData = { id: 'T0', groupId: 'g1', tileType: 0, gridX: 5, gridY: 5, layer: 2, active: false, selectable: false, isBlocked: false };
            const fakeNode = { setPosition: () => {}, setParent: () => {} };

            // Inject mock
            const fakeTM = {
                getTileData: () => fakeData,
                getTileNode: () => fakeNode,
                restoreToBoard: (d: ITileData, n: any) => { d.active = true; }
            };
            const fakeTray = {
                getLastHistory: () => ({ tileId: 'T0', gridX: 1, gridY: 2, layer: 0 }),
                popLastTile: () => fakeData,
            };

            (TileManager as any).Instance = fakeTM;
            (TrayManager as any).Instance = fakeTray;

            const result = (bm as any).executeUndo();
            t.assertTrue(result, 'Undo should succeed with valid history');
            t.assertEquals(fakeData.gridX, 1);
            t.assertEquals(fakeData.gridY, 2);
            t.assertEquals(fakeData.layer, 0);
        });
    });

    t.describe('BoosterManager Shuffle Solvability', () => {
        t.it('should preserve group counts after shuffle', () => {
            const tiles: ITileData[] = [];
            // Create 3 apples, 3 bananas, 3 cherries
            for (let i = 0; i < 3; i++) {
                tiles.push({ id: `A${i}`, groupId: 'apple', tileType: 0, gridX: i, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false });
                tiles.push({ id: `B${i}`, groupId: 'banana', tileType: 0, gridX: i, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false });
                tiles.push({ id: `C${i}`, groupId: 'cherry', tileType: 0, gridX: i, gridY: 2, layer: 0, active: true, selectable: true, isBlocked: false });
            }

            // Mock TileManager
            const fakeTM = {
                getAllTileData: () => tiles,
                getTileNode: () => null,
            };
            (TileManager as any).Instance = fakeTM;

            const beforeCounts: Record<string, number> = {};
            for (const tile of tiles) {
                beforeCounts[tile.groupId] = (beforeCounts[tile.groupId] || 0) + 1;
            }

            (bm as any).executeShuffle();

            const afterCounts: Record<string, number> = {};
            for (const tile of tiles) {
                afterCounts[tile.groupId] = (afterCounts[tile.groupId] || 0) + 1;
            }

            t.assertEquals(afterCounts['apple'], beforeCounts['apple'], 'Apple count should be preserved');
            t.assertEquals(afterCounts['banana'], beforeCounts['banana'], 'Banana count should be preserved');
            t.assertEquals(afterCounts['cherry'], beforeCounts['cherry'], 'Cherry count should be preserved');
        });
    });

    t.describe('BoosterManager Magnet Logic', () => {
        t.it('should find missing tiles for group in tray', () => {
            const trayTiles: ITileData[] = [
                { id: 'A1', groupId: 'apple', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'A2', groupId: 'apple', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ];
            const boardTiles: ITileData[] = [
                { id: 'A3', groupId: 'apple', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'B1', groupId: 'banana', tileType: 0, gridX: 2, gridY: 2, layer: 0, active: true, selectable: true, isBlocked: false },
            ];

            const addedIds: string[] = [];
            const fakeTM = {
                getAllTileData: () => boardTiles,
            };
            const fakeTray = {
                getTrayTiles: () => trayTiles,
                getMatchCount: () => 3,
                addTile: (id: string) => { addedIds.push(id); return true; },
                isFull: () => false,
            };

            (TileManager as any).Instance = fakeTM;
            (TrayManager as any).Instance = fakeTray;

            const result = (bm as any).executeMagnet();
            t.assertTrue(result, 'Magnet should find missing apple tile');
            t.assertTrue(addedIds.indexOf('A3') !== -1, 'Should add the missing apple tile to tray');
        });

        t.it('should respect custom matchCount in magnet', () => {
            const trayTiles: ITileData[] = [
                { id: 'A1', groupId: 'apple', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ];
            const boardTiles: ITileData[] = [
                { id: 'A2', groupId: 'apple', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'A3', groupId: 'apple', tileType: 0, gridX: 2, gridY: 2, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'A4', groupId: 'apple', tileType: 0, gridX: 3, gridY: 3, layer: 0, active: true, selectable: true, isBlocked: false },
            ];

            const addedIds: string[] = [];
            const fakeTM = {
                getAllTileData: () => boardTiles,
            };
            const fakeTray = {
                getTrayTiles: () => trayTiles,
                getMatchCount: () => 4,
                addTile: (id: string) => { addedIds.push(id); return true; },
                isFull: () => false,
            };

            (TileManager as any).Instance = fakeTM;
            (TrayManager as any).Instance = fakeTray;

            const result = (bm as any).executeMagnet();
            t.assertTrue(result, 'Magnet should pull 3 tiles for matchCount=4');
            t.assertEquals(addedIds.length, 3);
        });
    });

    t.describe('BoosterManager Magnet Tray Full', () => {
        t.it('should fail magnet when tray has no room', () => {
            const trayTiles: ITileData[] = [
                { id: 'A1', groupId: 'apple', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'A2', groupId: 'apple', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ];
            const boardTiles: ITileData[] = [
                { id: 'A3', groupId: 'apple', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'A4', groupId: 'apple', tileType: 0, gridX: 2, gridY: 2, layer: 0, active: true, selectable: true, isBlocked: false },
            ];

            const fakeTM = { getAllTileData: () => boardTiles };
            const fakeTray = {
                getTrayTiles: () => trayTiles,
                getMatchCount: () => 3,
                addTile: (id: string) => false, // tray is full
                isFull: () => true,
            };

            (TileManager as any).Instance = fakeTM;
            (TrayManager as any).Instance = fakeTray;

            const result = (bm as any).executeMagnet();
            t.assertFalse(result, 'Magnet should fail when tray cannot accept tiles');
        });
    });

    t.describe('BoosterManager Remove Logic', () => {
        t.it('should remove a matchable group from tray', () => {
            const trayTiles: ITileData[] = [
                { id: 'A1', groupId: 'apple', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'A2', groupId: 'apple', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'A3', groupId: 'apple', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ];
            let removedFromTray: string[] = [];
            let removedFromTileMgr: string[] = [];
            let inputLocked = false;
            const fakeTray = {
                getTrayTiles: () => trayTiles,
                getMatchCount: () => 3,
                removeTile: (id: string) => { removedFromTray.push(id); },
            };
            const fakeTM = {
                removeTile: (id: string) => { removedFromTileMgr.push(id); },
                setInputLocked: (v: boolean) => { inputLocked = v; },
            };
            const fakeMatch = { checkMatch: () => {}, isProcessing: () => false };
            (TrayManager as any).Instance = fakeTray;
            (TileManager as any).Instance = fakeTM;
            (MatchManager as any).Instance = fakeMatch;

            const result = (bm as any).executeRemove();
            t.assertTrue(result);
            t.assertEquals(removedFromTray.length, 3);
            t.assertEquals(removedFromTileMgr.length, 3);
            t.assertFalse(inputLocked, 'Input should be unlocked after remove');
        });

        t.it('should fail remove if no matchable group', () => {
            const trayTiles: ITileData[] = [
                { id: 'A1', groupId: 'apple', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'B1', groupId: 'banana', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ];
            const fakeTray = { getTrayTiles: () => trayTiles, getMatchCount: () => 3 };
            (TrayManager as any).Instance = fakeTray;
            const result = (bm as any).executeRemove();
            t.assertFalse(result);
        });
    });

    t.describe('BoosterManager Load Inventory', () => {
        t.it('should parse numeric string keys', () => {
            bm.loadInventory({ '1': 5, '2': 10 });
            t.assertEquals(bm.getBoosterCount(BoosterType.UNDO), 5);
            t.assertEquals(bm.getBoosterCount(BoosterType.SHUFFLE), 10);
        });

        t.it('should parse named enum keys', () => {
            bm.loadInventory({ 'UNDO': 3, 'MAGNET': 7 });
            t.assertEquals(bm.getBoosterCount(BoosterType.UNDO), 3);
            t.assertEquals(bm.getBoosterCount(BoosterType.MAGNET), 7);
        });

        t.it('should clamp negative values to zero', () => {
            bm.loadInventory({ 'UNDO': -5 });
            t.assertEquals(bm.getBoosterCount(BoosterType.UNDO), 0);
        });
    });

    t.printReport();
    return t;
}

