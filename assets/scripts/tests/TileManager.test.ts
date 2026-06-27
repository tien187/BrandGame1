import { TileManager } from '../managers/TileManager';
import { BoardManager } from '../managers/BoardManager';
import { SkinManager } from '../managers/SkinManager';
import { PoolManager } from '../core/PoolManager';
import { ITileData } from '../interfaces/ITileData';
import { TestRunner } from './TestRunner';

export function runTileManagerTests(): TestRunner {
    const t = new TestRunner();
    const tm = new TileManager();
    (TileManager as any).Instance = tm;

    // Mock BoardManager
    const fakeBoard = {
        _grid: new Map<string, ITileData[]>(),
        registerTile(data: ITileData) {
            const key = `${data.gridX}_${data.gridY}`;
            const list = this._grid.get(key) || [];
            list.push(data);
            this._grid.set(key, list);
        },
        unregisterTile(data: ITileData) {
            const key = `${data.gridX}_${data.gridY}`;
            const list = this._grid.get(key) || [];
            const idx = list.findIndex((d: ITileData) => d.id === data.id);
            if (idx !== -1) list.splice(idx, 1);
            if (list.length === 0) this._grid.delete(key);
        },
        isTileBlocked(data: ITileData): boolean { return false; },
        getWorldPosition(x: number, y: number, layer: number) { return { x: 0, y: 0, z: 0 } as any; },
        clearBoard() { this._grid.clear(); },
    };
    (BoardManager as any).Instance = fakeBoard;

    // Mock SkinManager
    const fakeSkin = {
        getTilePrefabKey: (gid: string) => 'prefab_' + gid,
        applyTileSkin: () => {},
    };
    (SkinManager as any).Instance = fakeSkin;

    // Mock PoolManager
    const fakePool = {
        nodes: new Map<string, any[]>(),
        prefabs: new Map<string, any>(),
        get(key: string) {
            const arr = this.nodes.get(key) || [];
            if (arr.length > 0) {
                const n = arr.pop();
                n.active = true;
                return n;
            }
            const prefab = this.prefabs.get(key);
            if (prefab) {
                return {
                    setParent: () => {},
                    setPosition: () => {},
                    getComponent: () => null,
                    addComponent: () => ({ reset: () => {}, initialize: () => {} }),
                    active: true,
                    scale: { x: 1, y: 1, z: 1 },
                    destroy: () => {},
                    removeFromParent: () => {},
                };
            }
            return null;
        },
        put(key: string, node: any) {
            if (!node) return;
            node.active = false;
            if (node.removeFromParent) node.removeFromParent();
            const arr = this.nodes.get(key) || [];
            if (arr.indexOf(node) === -1) arr.push(node);
            this.nodes.set(key, arr);
        },
        registerPrefab(key: string, prefab: any) {
            this.prefabs.set(key, prefab);
        },
    };
    (PoolManager as any)._instance = fakePool;

    t.describe('TileManager Spawn & Clear', () => {
        t.it('should spawn tiles and register to board', () => {
            fakeBoard.clearBoard();
            const tiles: ITileData[] = [
                { id: 'T1', groupId: 'g1', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
                { id: 'T2', groupId: 'g1', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: true, isBlocked: false },
            ];
            tm.spawnTiles(tiles);
            t.assertEquals(tm.getAllTileData().length, 2);
            t.assertEquals(fakeBoard._grid.size, 2);
            tm.clearTiles();
        });

        t.it('should clear board state on clearTiles', () => {
            tm.spawnTiles([
                { id: 'T1', groupId: 'g1', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ]);
            tm.clearTiles();
            t.assertEquals(fakeBoard._grid.size, 0, 'Board grid should be cleared');
        });
    });

    t.describe('TileManager Click & Remove', () => {
        t.it('should reject click when input locked', () => {
            tm.spawnTiles([
                { id: 'T1', groupId: 'g1', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ]);
            tm.setInputLocked(true);
            let crashed = false;
            try {
                tm.onTileClicked('T1');
            } catch (e) {
                crashed = true;
            }
            t.assertFalse(crashed, 'No crash when locked');
            tm.setInputLocked(false);
            tm.clearTiles();
        });

        t.it('should remove tile from board without destroying node', () => {
            tm.spawnTiles([
                { id: 'T1', groupId: 'g1', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: true, isBlocked: false },
            ]);
            tm.removeFromBoard('T1');
            const data = tm.getTileData('T1');
            t.assertTrue(data !== undefined && !data.active, 'Tile should be inactive after removeFromBoard');
            tm.clearTiles();
        });
    });

    t.describe('TileManager Restore', () => {
        t.it('should restore tile data and set active on undo', () => {
            const data: ITileData = { id: 'T1', groupId: 'g1', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: false, selectable: false, isBlocked: false };
            const node = {
                setParent: () => {},
                setPosition: () => {},
                removeFromParent: () => {},
                getComponent: () => null,
                isValid: true,
                active: true,
                destroy: () => {},
            };
            (tm as any)._tileDataMap.set('T1', data);
            (tm as any)._tileNodeMap.set('T1', node as any);
            tm.restoreToBoard(data, node as any);
            t.assertTrue(data.active, 'Restored tile should be active');
            tm.clearTiles();
        });
    });

    t.printReport();
    return t;
}
