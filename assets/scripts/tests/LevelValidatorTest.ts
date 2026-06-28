import { _decorator, Component, Label } from 'cc';
import { LevelValidator } from './LevelValidator';
import { DataLoader } from '../core/DataLoader';

const { ccclass, property } = _decorator;

/**
 * LevelValidatorTest - Component test chạy LevelValidator.
 * Attach vào scene, set levelId, và chạy validate khi start.
 */
@ccclass('LevelValidatorTest')
export class LevelValidatorTest extends Component {
    @property
    public levelId: number = 22;

    @property(Label)
    public resultLabel: Label | null = null;

    protected async start(): Promise<void> {
        await this.runValidation();
    }

    public async runValidation(): Promise<void> {
        const paddedId = this.levelId < 10 ? `00${this.levelId}` : this.levelId < 100 ? `0${this.levelId}` : `${this.levelId}`;
        const path = `data/levels/level_${paddedId}`;
        const levelData = await DataLoader.loadJson<any>(path);

        if (!levelData) {
            this.showResult(false, [`Failed to load level ${this.levelId}`]);
            return;
        }

        const result = LevelValidator.validate(levelData);
        this.showResult(result.valid, result.errors);
    }

    private showResult(valid: boolean, errors: string[]): void {
        const header = valid ? `[PASS] Level ${this.levelId} is valid` : `[FAIL] Level ${this.levelId} has ${errors.length} error(s)`;
        const detail = errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
        const output = detail ? `${header}\n${detail}` : header;

                if (this.resultLabel) {
            this.resultLabel.string = output;
        }
    }
}
