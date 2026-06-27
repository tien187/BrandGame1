import { _decorator, Component, tween, Vec3, Tween } from 'cc';
import { ITileData } from '../interfaces/ITileData';
import { MatchResult } from '../enums/MatchResult';
import { GameEvent } from '../enums/GameEvent';
import { EventBus } from '../core/EventBus';
import { TrayManager } from './TrayManager';
import { TileManager } from './TileManager';
import { LevelManager } from './LevelManager';
import { AudioManager } from './AudioManager';
import { ConfigManager } from '../core/ConfigManager';
import { BoosterManager } from './BoosterManager';
import { GameManager } from './GameManager';
import { OrderManager } from './OrderManager';

const { ccclass } = _decorator;

/**
 * MatchManager - Xử lý Triple Match trong tray.
 * Flow: glow -> particle -> sound -> remove -> rearrange -> check win/lose.
 */
@ccclass('MatchManager')
export class MatchManager extends Component {
    public static Instance: MatchManager;
    public static getInstance(): MatchManager { return MatchManager.Instance; }

    private _isProcessing: boolean = false;
    private _isRestarting: boolean = false;

    protected onLoad(): void {
        if (MatchManager.Instance) { this.destroy(); return; }
        MatchManager.Instance = this;

        EventBus.getInstance().on(GameEvent.TILE_ADDED_TO_TRAY, this.onTrayChanged, this);
    }

    /** Khi tray thay đổi, kiểm tra match hoặc tray full */
    private onTrayChanged(): void {
        if (this._isProcessing || this._isRestarting) return;

        if (OrderManager.getInstance().isActive()) {
            // ORDER_MATCH: win/lose do LevelManager + OrderManager điều khiển
            // (ALL_ORDERS_COMPLETED = win, board empty + orders not done = lose)
            return;
        }

        // TRIPLE_MATCH: kiểm tra match như cũ
        const trayManager = TrayManager.getInstance();
        if (!trayManager) return;

        this.unschedule(this._checkMatchCallback);
        this.scheduleOnce(this._checkMatchCallback, 0.05);
    }

    /** Callback kiểm tra match sau khi tile bay xong */
    private _checkMatchCallback = (): void => {
        if (this._isRestarting) return;
        const lifecycleId = TileManager.getInstance().getLifecycleId();

        // Đợi nếu còn tile đang bay vào tray
        const flyCount = TrayManager.getInstance().getFlyCount();
        if (flyCount > 0) {
            console.log(`[MatchManager] Waiting for ${flyCount} tiles to land, rescheduling check...`);
            this.unschedule(this._checkMatchCallback);
            this.scheduleOnce(this._checkMatchCallback, 0.1);
            return;
        }

        const result = this.checkMatch();
        if (lifecycleId !== TileManager.getInstance().getLifecycleId()) return;
        if (result === MatchResult.GAME_OVER || result === MatchResult.TRAY_FULL) {
            console.log(`[MatchManager] onTrayChanged: result=${result}, calling restartCurrentLevel`);
            this.restartCurrentLevel();
        } else if (result === MatchResult.NO_MATCH) {
            // Board không còn tile nào chơi được và tray không match được → thua
            if (!this.hasValidMoves() && !this.hasPendingMatch()) {
                console.log('[MatchManager] onTrayChanged: no valid moves left, restarting');
                this.restartCurrentLevel();
            }
        }
    };

    /** Restart level hiện tại (dùng khi dead end hoặc tray full) */
    private async restartCurrentLevel(): Promise<void> {
        if (this._isRestarting) return;
        this._isRestarting = true;
        this.unscheduleAllCallbacks();

        const levelId = LevelManager.getInstance().getCurrentLevelId();
        console.log(`[MatchManager] restartCurrentLevel: levelId=${levelId}`);
        if (levelId > 0 && GameManager.Instance) {
            await GameManager.Instance.startLevel(levelId);
        }

        this._isRestarting = false;
    }

    /** Kiểm tra và xử lý match trong tray */
    public checkMatch(): MatchResult {
        const trayTiles = TrayManager.getInstance().getTrayTiles();
        const matchCount = TrayManager.getInstance().getMatchCount();

        const matchTiles = this.findConsecutiveMatch(trayTiles, matchCount);
        if (matchTiles) {
            this.processMatch(matchTiles);
            return MatchResult.MATCHED;
        }

        if (TrayManager.getInstance().isDeadEnd()) {
            return MatchResult.GAME_OVER;
        }

        if (TrayManager.getInstance().isFull()) {
            return MatchResult.TRAY_FULL;
        }

        return MatchResult.NO_MATCH;
    }

    /**
     * Tìm dãy liên tiếp cùng groupId đầu tiên trong tray.
     * 3 tile phải nằm liền kề trong tray mới tính là match.
     */
    private findConsecutiveMatch(tiles: ITileData[], matchCount: number): ITileData[] | null {
        for (let i = 0; i <= tiles.length - matchCount; i++) {
            const groupId = tiles[i].groupId;
            let allSame = true;
            for (let j = 1; j < matchCount; j++) {
                if (tiles[i + j].groupId !== groupId) {
                    allSame = false;
                    break;
                }
            }
            if (allSame) {
                return tiles.slice(i, i + matchCount);
            }
        }
        return null;
    }

    /** Kiểm tra có match nào trong tray không (không trigger xử lý) */
    public hasPendingMatch(): boolean {
        const trayTiles = TrayManager.getInstance().getTrayTiles();
        const matchCount = TrayManager.getInstance().getMatchCount();
        return this.findConsecutiveMatch(trayTiles, matchCount) !== null;
    }

    /** Xử lý match đầy đủ: glow + particle + sound + remove */
    private processMatch(tiles: ITileData[]): void {
        if (!tiles || tiles.length === 0) return;
        this._isProcessing = true;
        const lifecycleId = TileManager.getInstance().getLifecycleId();

        const matchDelay = ConfigManager.getInstance().getGameplayValue('matchDelay') || 0.5;

        // Phase 1: Glow effect
        this.playMatchGlow(tiles);

        // Phase 2: Delay rồi particle + sound + remove
        this.scheduleOnce(() => {
            if (lifecycleId !== TileManager.getInstance().getLifecycleId()) {
                this._isProcessing = false;
                return;
            }
            this.playMatchEffects(tiles);

            this.scheduleOnce(() => {
                if (lifecycleId !== TileManager.getInstance().getLifecycleId()) {
                    this._isProcessing = false;
                    return;
                }
                for (const tile of tiles) {
                    TrayManager.getInstance().removeTile(tile.id);
                    TileManager.getInstance().removeTile(tile.id);
                    LevelManager.getInstance().addScore(100); // Base score per match
                }

                EventBus.getInstance().emit(GameEvent.TILES_MATCHED, tiles);
                LevelManager.getInstance().checkLevelComplete();

                // Chain check for additional matches before unlocking input
                // Reset _isProcessing so nested checkMatch can trigger processMatch if needed
                this._isProcessing = false;
                const result = this.checkMatch();
                if (result !== MatchResult.MATCHED) {
                    TileManager.getInstance().setInputLocked(false);
                    // Board không còn tile nào chơi được và tray không match được → thua
                    if (LevelManager.getInstance().isLevelActive() && !this.hasValidMoves() && !this.hasPendingMatch()) {
                        this.restartCurrentLevel();
                    }
                }
            }, matchDelay * 0.5);
        }, matchDelay * 0.3);
    }

    /** Glow effect trước khi match */
    private playMatchGlow(tiles: ITileData[]): void {
        for (const tile of tiles) {
            const node = TileManager.getInstance().getTileNode(tile.id);
            if (!node) continue;
            const tileComp = node.getComponent('Tile') as any;
            if (tileComp && tileComp.setGlow) {
                tileComp.setGlow(true);
            }
        }
    }

    /** Particle + Sound khi match */
    private playMatchEffects(tiles: ITileData[]): void {
        AudioManager.getInstance().playSfx('sfx_match');

        for (const tile of tiles) {
            const node = TileManager.getInstance().getTileNode(tile.id);
            if (!node || !node.isValid) continue;
            // Scale pop effect
            Tween.stopAllByTarget(node);
            tween(node)
                .to(0.15, { scale: new Vec3(1.3, 1.3, 1) })
                .to(0.15, { scale: new Vec3(0, 0, 1) })
                .start();
        }
    }

    /** Kiểm tra điều kiện thua (đã được xử lý bởi onTrayChanged auto-restart) */
    private checkLoseCondition(): void {
        // Đã chuyển sang auto-shuffle + auto-restart trong onTrayChanged
    }

    /** Kiểm tra có đang xử lý match không */
    public isProcessing(): boolean {
        return this._isProcessing;
    }

    /** Kiểm tra còn nước đi hợp lệ không */
    public hasValidMoves(): boolean {
        const allTiles = TileManager.getInstance().getAllTileData();
        const selectable = allTiles.filter(t => t.active && t.selectable);
        return selectable.length > 0;
    }

    protected onDestroy(): void {
        if (MatchManager.Instance === this) {
            MatchManager.Instance = null;
            EventBus.getInstance().off(GameEvent.TILE_ADDED_TO_TRAY, this.onTrayChanged, this);
            this.unscheduleAllCallbacks();
        }
    }
}
