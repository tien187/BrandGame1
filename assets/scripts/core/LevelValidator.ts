import { ILevelOutput } from '../interfaces/ILevelOutput';
import { ITileData } from '../interfaces/ITileData';
import { LevelSolver } from './LevelSolver';

export interface IValidationStep {
    stepIndex: number;
    groupId: string;
    pickedTileIds: string[];
    trayState: string[];
}

export interface ILevelValidationResult {
    valid: boolean;
    cleared: boolean;
    stuckStepIndex: number;
    stuckGroupId: string;
    stuckReason: string;
    steps: IValidationStep[];
    remainingTiles: ITileData[];
}

/**
 * LevelValidator - Kiểm tra level có clear được theo solutionSteps không.
 * Đi theo từng bước solution, tìm tile selectable, mô phỏng pick vào tray.
 */
export class LevelValidator {

    public static validate(level: ILevelOutput): ILevelValidationResult {
        const steps: IValidationStep[] = [];
        let tiles = level.tiles.map(t => ({ ...t }));
        let tray: string[] = [];
        const config = level.board;
        const matchCount = level.tray.matchCount;

        for (let stepIdx = 0; stepIdx < level.solutionSteps.length; stepIdx++) {
            const groupId = level.solutionSteps[stepIdx][0];
            const pickedIds: string[] = [];

            // Pick 3 tiles one by one, recalculating block status after each pick
            for (let pick = 0; pick < 3; pick++) {
                LevelSolver.computeBlockStatus(tiles, config);
                const candidates = tiles.filter(t => t.active && t.selectable && t.groupId === groupId);

                if (candidates.length === 0) {
                    return {
                        valid: false,
                        cleared: false,
                        stuckStepIndex: stepIdx,
                        stuckGroupId: groupId,
                        stuckReason: `Pick ${pick + 1}/3: no selectable tile for group ${groupId}`,
                        steps,
                        remainingTiles: tiles,
                    };
                }

                const picked = candidates[0];
                pickedIds.push(picked.id);
                tiles = tiles.filter(t => t.id !== picked.id);
                tray.push(picked.groupId);

                // Check for consecutive match after each pick
                let matchFound = false;
                do {
                    matchFound = false;
                    for (let i = 0; i <= tray.length - matchCount; i++) {
                        let same = true;
                        for (let j = 1; j < matchCount; j++) {
                            if (tray[i + j] !== tray[i]) { same = false; break; }
                        }
                        if (same) {
                            tray = tray.slice(0, i).concat(tray.slice(i + matchCount));
                            matchFound = true;
                            break;
                        }
                    }
                } while (matchFound);
            }

            steps.push({
                stepIndex: stepIdx,
                groupId,
                pickedTileIds: pickedIds,
                trayState: [...tray],
            });
        }

        const cleared = tiles.length === 0 && tray.length === 0;
        return {
            valid: cleared,
            cleared,
            stuckStepIndex: -1,
            stuckGroupId: '',
            stuckReason: cleared ? '' : `Board not fully cleared: ${tiles.length} tiles + ${tray.length} tray items remaining`,
            steps,
            remainingTiles: tiles,
        };
    }
}
