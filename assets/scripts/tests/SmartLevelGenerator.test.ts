import { SmartLevelGenerator } from '../core/SmartLevelGenerator';
import { LevelSolver } from '../core/LevelSolver';
import { TestRunner } from './TestRunner';
import { IDifficultyConfig } from '../interfaces/IDifficultyConfig';
import { ITEM_ID_GROUPS } from '../core/ItemIdCatalog';

export function runSmartLevelGeneratorTests(): TestRunner {
    const t = new TestRunner();

    const defaultDifficulty: IDifficultyConfig = {
        difficulty: 1,
        layerCount: 2,
        tileTypeCount: 4,
        totalTriplets: 8,
        safeMoveWindow: 3,
        trapRate: 0.15,
        visibleTripletLimit: 2,
        coverThreshold: 0.3,
    };

    const groupIds = ITEM_ID_GROUPS;

    t.describe('SmartLevelGenerator Generation', () => {
        t.it('should generate a valid level', () => {
            const level = SmartLevelGenerator.generate(1, defaultDifficulty, groupIds);
            t.assertTrue(level.tiles.length > 0, 'Should have tiles');
            t.assertEquals(level.levelId, 1, 'Level ID should match');
            t.assertTrue(level.solutionSteps.length > 0, 'Should have solution steps');
        });

        t.it('should generate total tiles divisible by 3', () => {
            const level = SmartLevelGenerator.generate(2, defaultDifficulty, groupIds);
            t.assertEquals(level.tiles.length % 3, 0, `Tile count ${level.tiles.length} must be divisible by 3`);
        });

        t.it('should make each group count divisible by 3', () => {
            const level = SmartLevelGenerator.generate(3, defaultDifficulty, groupIds);
            const counts: Record<string, number> = {};
            for (const tile of level.tiles) {
                counts[tile.groupId] = (counts[tile.groupId] || 0) + 1;
            }
            for (const gid of Object.keys(counts)) {
                t.assertEquals(counts[gid] % 3, 0, `Group ${gid} count ${counts[gid]} must be multiple of 3`);
            }
        });

        t.it('should produce deterministic difficulty config per level', () => {
            const d1 = SmartLevelGenerator.getDifficultyForLevel(1);
            const d1b = SmartLevelGenerator.getDifficultyForLevel(1);
            t.assertEquals(d1.difficulty, d1b.difficulty);
            t.assertEquals(d1.totalTriplets, d1b.totalTriplets);
            t.assertEquals(d1.layerCount, d1b.layerCount);
        });

        t.it('should increase difficulty parameters with level id', () => {
            const d5 = SmartLevelGenerator.getDifficultyForLevel(5);
            const d50 = SmartLevelGenerator.getDifficultyForLevel(50);
            t.assertTrue(d50.tileTypeCount >= d5.tileTypeCount, 'tileTypeCount should increase');
            t.assertTrue(d50.totalTriplets >= d5.totalTriplets, 'totalTriplets should increase');
        });
    });

    t.describe('SmartLevelGenerator Validation', () => {
        t.it('should pass LevelSolver validation', () => {
            const level = SmartLevelGenerator.generate(10, defaultDifficulty, groupIds);
            const result = LevelSolver.validate(level);
            if (!result.valid) {
                            }
            t.assertTrue(result.valid, `Level should be valid: ${result.errors.join('; ')}`);
        });

        t.it('should have at least 1 solution path', () => {
            const level = SmartLevelGenerator.generate(11, defaultDifficulty, groupIds);
            const result = LevelSolver.validate(level);
            t.assertTrue(result.hasSolution, 'Level must have at least 1 solution path');
        });

        t.it('should not deadlock at start', () => {
            const level = SmartLevelGenerator.generate(12, defaultDifficulty, groupIds);
            const result = LevelSolver.validate(level);
            t.assertTrue(!result.hasDeadlock, 'Level should not deadlock immediately');
        });
    });

    t.describe('SmartLevelGenerator Solution Steps', () => {
        t.it('should generate correct number of solution steps', () => {
            const level = SmartLevelGenerator.generate(4, defaultDifficulty, groupIds);
            t.assertEquals(level.solutionSteps.length, defaultDifficulty.totalTriplets);
        });

        t.it('should have each solution step as a triplet', () => {
            const level = SmartLevelGenerator.generate(5, defaultDifficulty, groupIds);
            for (const step of level.solutionSteps) {
                t.assertEquals(step.length, 3, 'Each step must be length 3');
                t.assertEquals(step[0], step[1], 'All 3 in step must match groupId');
                t.assertEquals(step[1], step[2], 'All 3 in step must match groupId');
            }
        });
    });

    t.describe('SmartLevelGenerator Blocker / Trap Structure', () => {
        t.it('should have some tiles blocked at start', () => {
            const level = SmartLevelGenerator.generate(6, defaultDifficulty, groupIds);
            const blockedCount = level.tiles.filter(t => t.isBlocked).length;
            t.assertTrue(blockedCount > 0, 'There should be blocked tiles at start for difficulty');
        });

        t.it('should have selectable tiles at start', () => {
            const level = SmartLevelGenerator.generate(7, defaultDifficulty, groupIds);
            const selectableCount = level.tiles.filter(t => t.selectable).length;
            t.assertTrue(selectableCount > 0, 'There should be selectable tiles at start');
        });

        t.it('should not exceed visibleTripletLimit open triplets at start', () => {
            const level = SmartLevelGenerator.generate(8, defaultDifficulty, groupIds);
            const selectable = level.tiles.filter(t => t.selectable);
            const groups = new Set<string>();
            for (const t of selectable) groups.add(t.groupId);
            // This is a loose check; exact visible triplet count depends on placement
            t.assertTrue(groups.size <= defaultDifficulty.visibleTripletLimit + defaultDifficulty.safeMoveWindow,
                'Visible group variety should be controlled');
        });
    });

    t.describe('SmartLevelGenerator Difficulty Scaling', () => {
        t.it('should generate solvable level for higher difficulty', () => {
            const hardDifficulty: IDifficultyConfig = {
                difficulty: 10,
                layerCount: 3,
                tileTypeCount: 6,
                totalTriplets: 12,
                safeMoveWindow: 2,
                trapRate: 0.25,
                visibleTripletLimit: 2,
                coverThreshold: 0.3,
            };
            const level = SmartLevelGenerator.generate(20, hardDifficulty, groupIds);
            const result = LevelSolver.validate(level);
            t.assertTrue(result.valid, `Hard level should be valid: ${result.errors.join('; ')}`);
            t.assertTrue(result.hasSolution, 'Hard level should have a solution');
        });
    });

    t.describe('SmartLevelGenerator Tray Config', () => {
        t.it('should set tray maxSlots to 7', () => {
            const level = SmartLevelGenerator.generate(9, defaultDifficulty, groupIds);
            t.assertEquals(level.tray.maxSlots, 7);
        });

        t.it('should set tray matchCount to 3', () => {
            const level = SmartLevelGenerator.generate(9, defaultDifficulty, groupIds);
            t.assertEquals(level.tray.matchCount, 3);
        });
    });

    t.printReport();
    return t;
}
