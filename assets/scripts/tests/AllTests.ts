import { runBoardManagerTests } from './BoardManager.test';
import { runTrayManagerTests } from './TrayManager.test';
import { runMatchManagerTests } from './MatchManager.test';
import { runBoosterManagerTests } from './BoosterManager.test';
import { runLevelGeneratorTests } from './LevelGenerator.test';
import { runSmartLevelGeneratorTests } from './SmartLevelGenerator.test';
import { runTileManagerTests } from './TileManager.test';

/**
 * Chạy toàn bộ unit test cho gameplay core.
 * Gọi hàm này từ một component trong scene (ví dụ một node test harness)
 * hoặc từ DevTools console.
 */
export function runAllTests(): void {
    console.log('>>> Starting All Tests...\n');

    const runners = [
        runBoardManagerTests(),
        runTrayManagerTests(),
        runMatchManagerTests(),
        runBoosterManagerTests(),
        runLevelGeneratorTests(),
        runSmartLevelGeneratorTests(),
        runTileManagerTests(),
    ];

    let totalPassed = 0;
    let totalFailed = 0;
    for (const runner of runners) {
        const results = runner.getResults();
        totalPassed += results.filter(r => r.passed).length;
        totalFailed += results.filter(r => !r.passed).length;
    }

    console.log(`\n>>> ALL TESTS COMPLETE: ${totalPassed} passed, ${totalFailed} failed`);
}

// Optional: auto-run khi import trong dev environment
// if (typeof CC_DEV !== 'undefined' && CC_DEV) { runAllTests(); }
