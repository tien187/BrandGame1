import { _decorator, Component } from 'cc';
import { runAllTests } from './AllTests';
import { SkinManager } from '../managers/SkinManager';
import { TileManager } from '../managers/TileManager';
import { BoardManager } from '../managers/BoardManager';
import { TrayManager } from '../managers/TrayManager';
import { MatchManager } from '../managers/MatchManager';
import { BoosterManager } from '../managers/BoosterManager';
import { PoolManager } from '../core/PoolManager';

const { ccclass } = _decorator;

/**
 * TestRunnerComponent - Gắn vào một node trong scene để chạy unit test trong Editor Play Mode.
 * Chạy trong start() để đảm bảo tất cả manager nodes đã onLoad() xong.
 * Lưu và restore singleton instances để test không làm hỏng scene managers.
 */
@ccclass('TestRunnerComponent')
export class TestRunnerComponent extends Component {
    protected start(): void {
        // Delay test execution so GameManager.start() finishes initializing singletons first.
        // Without this delay, TestRunnerComponent.start() runs BEFORE GameManager.start()
        // and saves null values, causing all scene managers to fail after restore.
        this.scheduleOnce(() => {
            this.runTestsSafely();
        }, 0.5);
    }

    private runTestsSafely(): void {
        // Verify managers are initialized before saving
        const skinMgr = (SkinManager as any).Instance;
        const tileMgr = (TileManager as any).Instance;

        if (!skinMgr || !tileMgr) {
            console.warn('[TestRunner] Scene managers not yet initialized. Skipping tests. Make sure GameManager node is active and has GameManager.ts attached.');
            return;
        }

        // Save original singleton instances before tests overwrite them
        const poolInstance = (PoolManager as any)._instance;
        const originals = {
            skin: skinMgr,
            tile: tileMgr,
            board: (BoardManager as any).Instance,
            tray: (TrayManager as any).Instance,
            match: (MatchManager as any).Instance,
            booster: (BoosterManager as any).Instance,
            pool: poolInstance,
        };

        console.log('[TestRunner] Saved originals:', {
            skin: !!originals.skin,
            tile: !!originals.tile,
            board: !!originals.board,
            tray: !!originals.tray,
            match: !!originals.match,
            booster: !!originals.booster,
            pool: !!originals.pool,
        });

        console.log('=== RUNNING ALL TESTS ===');
        runAllTests();
        console.log('=== ALL TESTS COMPLETE ===');

        // Restore original instances so scene managers continue working
        if (originals.skin) (SkinManager as any).Instance = originals.skin;
        if (originals.tile) (TileManager as any).Instance = originals.tile;
        if (originals.board) (BoardManager as any).Instance = originals.board;
        if (originals.tray) (TrayManager as any).Instance = originals.tray;
        if (originals.match) (MatchManager as any).Instance = originals.match;
        if (originals.booster) (BoosterManager as any).Instance = originals.booster;
        if (originals.pool) (PoolManager as any)._instance = originals.pool;

        console.log('[TestRunner] Restored singleton instances.');
    }
}
