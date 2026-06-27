import { LevelGenerator } from '../core/LevelGenerator';
import { TestRunner } from './TestRunner';

export function runLevelGeneratorTests(): TestRunner {
    const t = new TestRunner();

    t.describe('LevelGenerator Shapes', () => {
        t.it('should contain 10 predefined shapes', () => {
            const shapes = Object.keys(LevelGenerator.SHAPES);
            t.assertEquals(shapes.length, 10);
        });

        t.it('should have valid rectangle shape', () => {
            const rect = LevelGenerator.SHAPES.rectangle;
            t.assertTrue(rect.length > 0);
            t.assertTrue(rect[0].length > 0);
            for (const row of rect) {
                for (const cell of row) {
                    t.assertEquals(cell, 1);
                }
            }
        });

        t.it('should have symmetric diamond shape', () => {
            const diamond = LevelGenerator.SHAPES.diamond;
            const rows = diamond.length;
            const cols = diamond[0].length;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < Math.floor(cols / 2); c++) {
                    t.assertEquals(diamond[r][c], diamond[r][cols - 1 - c]);
                }
            }
        });
    });

    t.describe('LevelGenerator Layer Progression', () => {
        t.it('should return 2 layers for levels 1-10', () => {
            t.assertEquals(LevelGenerator.getLayerForLevel(1), 2);
            t.assertEquals(LevelGenerator.getLayerForLevel(10), 2);
        });

        t.it('should return 3 layers for level 11', () => {
            t.assertEquals(LevelGenerator.getLayerForLevel(11), 3);
        });

        t.it('should return 5 layers for level 100', () => {
            t.assertEquals(LevelGenerator.getLayerForLevel(100), 5);
        });

        t.it('should return 4-6 layers for level 101+', () => {
            const layer = LevelGenerator.getLayerForLevel(101);
            t.assertTrue(layer >= 4 && layer <= 6);
        });

        t.it('should be deterministic for same level ID', () => {
            const layer1 = LevelGenerator.getLayerForLevel(150);
            const layer2 = LevelGenerator.getLayerForLevel(150);
            t.assertEquals(layer1, layer2);
        });
    });

    t.describe('LevelGenerator Tile Generation', () => {
        t.it('should generate total tiles divisible by 3', () => {
            const tiles = LevelGenerator.generateTiles(1, 'rectangle', 2, ['a', 'b', 'c', 'd']);
            t.assertEquals(tiles.length % 3, 0);
        });

        t.it('should generate correct layer range', () => {
            const tiles = LevelGenerator.generateTiles(2, 'diamond', 3, ['a', 'b', 'c']);
            const maxLayer = Math.max(...tiles.map(t => t.layer));
            t.assertTrue(maxLayer <= 2);
        });

        t.it('should make each group count divisible by 3', () => {
            const tiles = LevelGenerator.generateTiles(3, 'pyramid', 2, ['x', 'y', 'z', 'w']);
            const counts: Record<string, number> = {};
            for (const tile of tiles) {
                counts[tile.groupId] = (counts[tile.groupId] || 0) + 1;
            }
            for (const gid of Object.keys(counts)) {
                t.assertEquals(counts[gid] % 3, 0);
            }
        });

        t.it('should make each group count divisible by 3 for odd groupIds', () => {
            const tiles = LevelGenerator.generateTiles(5, 'stair', 2, ['a', 'b', 'c', 'd', 'e']);
            const counts: Record<string, number> = {};
            for (const tile of tiles) {
                counts[tile.groupId] = (counts[tile.groupId] || 0) + 1;
            }
            for (const gid of Object.keys(counts)) {
                t.assertEquals(counts[gid] % 3, 0, `Group ${gid} count must be multiple of 3`);
            }
        });

        t.it('should cycle through provided groupIds', () => {
            const groups = ['red', 'green', 'blue'];
            const tiles = LevelGenerator.generateTiles(4, 'rectangle', 2, groups);
            const used = new Set(tiles.map(t => t.groupId));
            for (const g of groups) {
                t.assertTrue(used.has(g), `Group ${g} should be used`);
            }
        });

        t.it('should preserve levelId prefix in tile IDs', () => {
            const tiles = LevelGenerator.generateTiles(42, 'rectangle', 1, ['a', 'b']);
            t.assertTrue(tiles[0].id.startsWith('L42_'), 'Tile ID should contain level prefix');
        });

        t.it('should throw on empty groupIds', () => {
            let threw = false;
            try {
                LevelGenerator.generateTiles(1, 'rectangle', 2, []);
            } catch (e) { threw = true; }
            t.assertTrue(threw, 'Empty groupIds should throw');
        });

        t.it('should cap excessive layers at 20', () => {
            const tiles = LevelGenerator.generateTiles(1, 'rectangle', 100, ['a', 'b']);
            const maxLayer = Math.max(...tiles.map(t => t.layer));
            t.assertTrue(maxLayer <= 19, 'Layers should be capped');
        });

        t.it('should fallback to rectangle for unknown shape', () => {
            const tiles = LevelGenerator.generateTiles(1, 'nonexistent', 2, ['a', 'b']);
            t.assertTrue(tiles.length > 0, 'Should generate tiles even for unknown shape');
        });

        t.it('should not drop tiles below adjustedTotal', () => {
            const tiles = LevelGenerator.generateTiles(5, 'rectangle', 2, ['a', 'b', 'c']);
            const shape = LevelGenerator.SHAPES.rectangle;
            const baseCount = shape.reduce((acc: number[], row: number[]) => acc.concat(row), []).filter(v => v === 1).length;
            const expected = Math.floor(baseCount * 2 / 3) * 3;
            t.assertEquals(tiles.length, expected, 'Tile count should match adjustedTotal without extra drops');
        });
    });

    t.describe('LevelGenerator Shape Rotation', () => {
        t.it('should cycle shapes by level modulo', () => {
            const shape1 = LevelGenerator.getShapeForLevel(1);
            const shape11 = LevelGenerator.getShapeForLevel(11);
            t.assertEquals(shape1, shape11, 'Shape should repeat every 10 levels');
        });
    });

    t.printReport();
    return t;
}
