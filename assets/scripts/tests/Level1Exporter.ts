import { _decorator, Component } from 'cc';
import { SmartLevelGenerator } from '../core/SmartLevelGenerator';
import { LevelSolver } from '../core/LevelSolver';
import { LevelValidator } from '../core/LevelValidator';
import { ITEM_ID_GROUPS } from '../core/ItemIdCatalog';

declare const require: (id: string) => any;

const { ccclass, property } = _decorator;

/**
 * Level1Exporter - Generate level 1 và ghi trực tiếp ra file JSON.
 * Chạy trong Editor (Preview) để ghi file.
 */
@ccclass('Level1Exporter')
export class Level1Exporter extends Component {

    private groupIds = ITEM_ID_GROUPS;

    protected start(): void {
        // Custom difficulty for a complex puzzle level
        const difficulty = {
            difficulty: 1,
            layerCount: 3,
            tileTypeCount: this.groupIds.length,
            totalTriplets: 18,        // 54 tiles total
            safeMoveWindow: 3,
            trapRate: 0.2,
            visibleTripletLimit: 2,
            coverThreshold: 0.3,
        };
        
        try {
            const level = SmartLevelGenerator.generate(1, difficulty, this.groupIds, 'heart');
            const validator = LevelValidator.validate(level);

            
            if (validator.valid) {
                const exportData = {
                    levelId: level.levelId,
                    displayName: level.displayName || `Level ${level.levelId}`,
                    defaultSkin: level.defaultSkin || 'uma',
                    board: level.board,
                    tray: level.tray,
                    tiles: level.tiles.map(t => ({
                        id: t.id,
                        groupId: t.groupId,
                        tileType: t.tileType,
                        gridX: t.gridX,
                        gridY: t.gridY,
                        layer: t.layer,
                        active: t.active,
                        selectable: t.selectable,
                        isBlocked: t.isBlocked
                    })),
                    solutionSteps: level.solutionSteps
                };
                const json = JSON.stringify(exportData, null, 2);

                // Ghi file trực tiếp bằng Node.js fs
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const projectPath = 'D:/CocosProject/MiniGame1';
                    const filePath = path.join(projectPath, 'assets/resources/data/levels/level_001.json');
                    fs.mkdirSync(path.dirname(filePath), { recursive: true });
                    fs.writeFileSync(filePath, json, 'utf8');
                                    } catch (fsErr) {
                                                                                                }
            } else {
                            }
        } catch (e) {
                    }
    }
}
