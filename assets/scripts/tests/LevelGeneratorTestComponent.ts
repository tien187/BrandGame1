import { _decorator, Component, Node, Label } from 'cc';
import { SmartLevelGenerator } from '../core/SmartLevelGenerator';
import { LevelSolver } from '../core/LevelSolver';
import { LevelValidator } from '../core/LevelValidator';
import { IDifficultyConfig } from '../interfaces/IDifficultyConfig';
import { ITEM_ID_GROUPS } from '../core/ItemIdCatalog';

const { ccclass, property } = _decorator;

/**
 * LevelGeneratorTestComponent - Test SmartLevelGenerator V2 trên node riêng.
 * Gắn component này vào một node trong scene để chạy test.
 */
@ccclass('LevelGeneratorTestComponent')
export class LevelGeneratorTestComponent extends Component {

    @property(Label)
    public statusLabel: Label | null = null;

    @property
    public testLevelCount: number = 5;

    private groupIds = ITEM_ID_GROUPS;

    protected onLoad(): void {
        console.log('[LevelGeneratorTestComponent] Loaded');
    }

    public runTests(): void {
        console.log('[LevelGeneratorTestComponent] === TESTING LEVEL 1 ONLY ===');
        let pass = 0;
        let fail = 0;
        const errors: string[] = [];

        // CHỈ TEST LEVEL 1
        const i = 1;
        const difficulty = SmartLevelGenerator.getDifficultyForLevel(i);
        console.log(`[LevelGeneratorTestComponent] Level ${i} difficulty:`, JSON.stringify(difficulty));
        try {
            const level = SmartLevelGenerator.generate(i, difficulty, this.groupIds);
            console.log(`[LevelGeneratorTestComponent] Level ${i} generated: tiles=${level.tiles.length}`);
            const solverResult = LevelSolver.validate(level);
            console.log(`[LevelGeneratorTestComponent] Solver: valid=${solverResult.valid} errors=${JSON.stringify(solverResult.errors)}`);
            const validatorResult = LevelValidator.validate(level);
            console.log(`[LevelGeneratorTestComponent] Validator: valid=${validatorResult.valid} cleared=${validatorResult.cleared}`);

            if (!validatorResult.valid) {
                fail++;
                errors.push(`Level ${i} - Validator: ${validatorResult.stuckReason}`);
            } else {
                pass++;
                console.log(`[LevelGeneratorTestComponent] Level ${i} OK | tiles=${level.tiles.length} steps=${level.solutionSteps.length}`);
            }
        } catch (e) {
            fail++;
            errors.push(`Level ${i} - Exception: ${e}`);
            console.error(`[LevelGeneratorTestComponent] Exception generating level ${i}:`, e);
        }

        const summary = `Pass: ${pass}/1 | Fail: ${fail}`;
        console.log(`[LevelGeneratorTestComponent] === ${summary} ===`);
        if (errors.length > 0) {
            console.error('[LevelGeneratorTestComponent] Errors:', errors);
        }

        if (this.statusLabel) {
            this.statusLabel.string = summary + (errors.length > 0 ? '\n' + errors.slice(0, 3).join('\n') : '');
        }
    }

    protected start(): void {
        this.runTests();
    }
}
