import { ILevelData } from '../interfaces/ILevelData';
import { ITileData } from '../interfaces/ITileData';
import { GameEvent } from '../enums/GameEvent';
import { GameMode } from '../enums/GameMode';
import { EventBus } from '../core/EventBus';
import { DataLoader } from '../core/DataLoader';
import { ITEM_ID_GROUPS, normalizeItemId } from '../core/ItemIdCatalog';
import { LevelGenerator } from '../core/LevelGenerator';
import { SaveManager } from '../core/SaveManager';
import { BoardManager } from './BoardManager';
import { TileManager } from './TileManager';
import { TrayManager } from './TrayManager';
import { SkinManager } from './SkinManager';
import { OrderManager } from './OrderManager';
import { OrderTrayManager } from './OrderTrayManager';
import { WrongTrayManager } from './WrongTrayManager';
import { BoosterManager } from './BoosterManager';

/**
 * LevelManager - Quản lý vòng đời level: load, start, progress, complete, fail.
 * Load dữ liệu từ JSON và phân phát cho các gameplay manager.
 */
export class LevelManager {
    private static _instance: LevelManager;
    private _currentLevel: ILevelData | null = null;
    private _currentLevelId: number = 0;
    private _score: number = 0;
    private _stars: number = 0;
    private _isLevelActive: boolean = false;
    private _isResolvingLevelEnd: boolean = false;
    private _levelRunId: number = 0;
    private _loadToken: number = 0;
    private _pendingOrderTilesClearedHandler: (() => void) | null = null;

    private constructor() {
        EventBus.getInstance().on(GameEvent.ALL_ORDERS_COMPLETED, this.onAllOrdersCompleted, this);
        EventBus.getInstance().on(GameEvent.WRONG_TRAY_FULL, this.onWrongTrayFull, this);
        EventBus.getInstance().on(GameEvent.TILE_ADDED_TO_TRAY, this.onTileAddedToTray, this);
        EventBus.getInstance().on(GameEvent.TRAY_FULL, this.onTrayFull, this);
    }

    public static getInstance(): LevelManager {
        if (!LevelManager._instance) {
            LevelManager._instance = new LevelManager();
        }
        return LevelManager._instance;
    }

    /** Khởi tạo hệ thống level */
    public async initialize(): Promise<void> {
        // Có thể load danh sách level metadata ở đây
    }

    /** Load level từ JSON theo ID */
    public async loadLevel(levelId: number): Promise<void> {
                this.unloadCurrentLevel();
        const loadToken = ++this._loadToken;
        this._levelRunId++;
        
        const paddedId = levelId < 10 ? `00${levelId}` : levelId < 100 ? `0${levelId}` : `${levelId}`;
        const path = `data/levels/level_${paddedId}`;
        const loadedLevel = await DataLoader.loadJson<ILevelData>(path);
        if (loadToken !== this._loadToken) return;
        this._currentLevel = this.cloneLevelData(loadedLevel);
        this.normalizeLevelItemIds(this._currentLevel);
                
        // Load skin của level trước khi spawn tiles
        const skinId = this._currentLevel.defaultSkin || 'default';
                await SkinManager.getInstance().loadSkin(skinId);
        if (loadToken !== this._loadToken) return;
                
        this._currentLevelId = levelId;
        this._score = 0;
        this._stars = 0;
        this._isResolvingLevelEnd = false;
        
        SaveManager.getInstance().saveCurrentLevel(levelId);

        EventBus.getInstance().emit(GameEvent.LEVEL_LOADED, this._currentLevel);

        await this.startLevel(loadToken);
    }

    /** Bắt đầu gameplay sau khi load xong */
    private async startLevel(loadToken: number = this._loadToken): Promise<void> {
        if (!this._currentLevel) {
                        return;
        }

        const gameMode = this._currentLevel.gameMode || GameMode.TRIPLE_MATCH;
        
                const boardMgr = BoardManager.getInstance();
                boardMgr.buildBoard(this._currentLevel.board);

        // Validate predefined tiles; if unsolvable, regenerate automatically
        let tiles = this._currentLevel.tiles;
        if (!tiles || tiles.length === 0 || !this.areTilesSolvable(tiles)) {
            if (tiles && tiles.length > 0) {
                            }
            tiles = this.generateLevelTiles();
            this._currentLevel.tiles = tiles;
        }

        // Clone tiles to avoid mutating cached level data on restart
        const tilesToSpawn = tiles.map(t => ({ ...t }));
        
        // Always init TrayManager (tiles fly into tray regardless of mode)
        TrayManager.getInstance().initialize(this._currentLevel.tray);

        // Init ORDER_MATCH managers BEFORE spawnTiles so TileManager block check is correct
        if (gameMode === GameMode.ORDER_MATCH) {
            const orders = this._currentLevel.orders || [];
            const orderConfig = this._currentLevel.orderConfig || { orderSize: 3, orderMode: 'EXACT_ORDER' as const, wrongTrayMaxSlots: 2, consumeWrongTile: false };
            OrderManager.getInstance().initialize(orders, orderConfig);
            OrderTrayManager.getInstance()?.initialize(orders, OrderManager.getInstance().getCurrentOrder(), orderConfig);
            WrongTrayManager.getInstance()?.initialize(orderConfig.wrongTrayMaxSlots);
        }

        // Prewarm pool và preload sprite để tránh giật khi instantiate/runtime load
        TileManager.getInstance().prewarmPool(tilesToSpawn.length);
        await SkinManager.getInstance().prewarmSkinSprites();
        if (loadToken !== this._loadToken) return;

        // Spawn với animation rơi từ trên xuống theo thứ tự layer dưới trước
        TileManager.getInstance().spawnTiles(tilesToSpawn, true, gameMode !== GameMode.ORDER_MATCH);

        this._isLevelActive = true;
        BoosterManager.getInstance()?.resetForLevel();
        EventBus.getInstance().emit(GameEvent.LEVEL_STARTED, this._currentLevelId);
    }

    /** Kiểm tra tiles có thể clear hoàn toàn không */
    private areTilesSolvable(tiles: ITileData[]): boolean {
        if (!tiles || tiles.length === 0) return false;
        const gameMode = this._currentLevel?.gameMode || GameMode.TRIPLE_MATCH;
        if (gameMode === GameMode.ORDER_MATCH) {
            return this.areTilesSolvableForOrderMatch(tiles);
        }
        if (tiles.length % 3 !== 0) return false;
        const counts: Record<string, number> = {};
        for (const t of tiles) {
            counts[t.groupId] = (counts[t.groupId] || 0) + 1;
        }
        for (const gid in counts) {
            if (counts[gid] % 3 !== 0) return false;
        }
        return true;
    }

    /** Kiểm tra tiles có đủ để hoàn thành tất cả orders không */
    private areTilesSolvableForOrderMatch(tiles: ITileData[]): boolean {
        if (!this._currentLevel?.orders || this._currentLevel.orders.length === 0) {
                        return false;
        }
        const required: Record<string, number> = {};
        for (const order of this._currentLevel.orders) {
            for (const item of order.items) {
                required[item] = (required[item] || 0) + 1;
            }
        }
        const available: Record<string, number> = {};
        for (const t of tiles) {
            available[t.groupId] = (available[t.groupId] || 0) + 1;
        }
        for (const gid in required) {
            if ((available[gid] || 0) < required[gid]) {
                                return false;
            }
        }
        return true;
    }

    /** Sinh tiles tự động qua LevelGenerator */
    private generateLevelTiles(): any[] {
        const board = this._currentLevel!.board;
        const shape = board.shapePattern ? this.inferShapeName(board.shapePattern) : 'rectangle';
        const layers = board.maxLayers || LevelGenerator.getLayerForLevel(this._currentLevelId);
        const groupIds = this.getSkinGroupIds();
        return LevelGenerator.generateTiles(this._currentLevelId, shape, layers, groupIds);
    }

    private normalizeLevelItemIds(level: ILevelData | null): void {
        if (!level) return;

        if (level.tiles) {
            for (const tile of level.tiles) {
                tile.groupId = normalizeItemId(tile.groupId);
                if (tile.skinOverride) {
                    const [skinId, itemId] = tile.skinOverride.split('/');
                    if (skinId && itemId) {
                        tile.skinOverride = `${skinId}/${normalizeItemId(itemId)}`;
                    }
                }
            }
        }

        if (level.orders) {
            for (const order of level.orders) {
                order.items = order.items.map(normalizeItemId);
            }
        }

        if (level.solutionOrders) {
            level.solutionOrders = level.solutionOrders.map(order => order.map(normalizeItemId));
        }
    }

    private cloneLevelData(level: ILevelData): ILevelData {
        return JSON.parse(JSON.stringify(level)) as ILevelData;
    }

    /** Infer shape name từ shapePattern (nếu có) */
    private inferShapeName(pattern: number[][]): string {
        // Default to rectangle if custom pattern provided
        return 'rectangle';
    }

    /** Lấy danh sách groupId từ skin config */
    private getSkinGroupIds(): string[] {
        const skinData = SkinManager.getInstance().getCurrentSkin();
        if (skinData && skinData.itemGroups && Array.isArray(skinData.itemGroups)) {
            return skinData.itemGroups.map(normalizeItemId);
        }
        return ITEM_ID_GROUPS;
    }

    /** Dọn dẹp level hiện tại */
    public unloadCurrentLevel(): void {
                this._loadToken++;
        this.clearPendingOrderTilesClearedHandler();
        BoardManager.getInstance().clearBoard();
        TileManager.getInstance().clearTiles();
        TrayManager.getInstance().clearTray();
        OrderManager.getInstance().clear();
        OrderTrayManager.getInstance()?.clearTray();
        WrongTrayManager.getInstance()?.clearTray();

        this._currentLevel = null;
        this._isLevelActive = false;
        this._isResolvingLevelEnd = false;
        this._levelRunId++;
            }

    /** Khi tile được thêm vào tray: kiểm tra board empty → win/lose */
    private onTileAddedToTray(): void {
        const runId = this._levelRunId;
        const gameMode = this._currentLevel?.gameMode || GameMode.TRIPLE_MATCH;
                if (gameMode === GameMode.TRIPLE_MATCH) {
            this.checkLevelComplete();
            return;
        }

        // ORDER_MATCH: delay check board empty để OrderManager kịp xử lý order completion trước
        setTimeout(() => {
            if (runId !== this._levelRunId) return;
            if (!this._isLevelActive) return;
            const checkFail = () => {
                if (runId !== this._levelRunId) return;
                if (!this._isLevelActive) return;
                if (OrderManager.getInstance().isPendingTrayCheck()) {
                                        setTimeout(checkFail, 100);
                    return;
                }
                const flyCount = TrayManager.getInstance().getFlyCount();
                if (flyCount > 0) {
                                        setTimeout(checkFail, 100);
                    return;
                }
                if (OrderManager.getInstance().isAllOrdersCompleted() || TrayManager.getInstance().isClearingOrderTiles()) {
                                        return;
                }
                const remainingTiles = TileManager.getInstance().getRemainingTileCount();
                if (remainingTiles === 0 && !OrderManager.getInstance().isAllOrdersCompleted()) {
                                        this.onLevelFailed('board_empty_orders_not_completed');
                }
            };
            checkFail();
        }, 0);
    }

    /** Kiểm tra và xử lý level hoàn thành (TRIPLE_MATCH only) */
    public checkLevelComplete(): void {
        if (!this._isLevelActive) return;

        const remainingTiles = TileManager.getInstance().getRemainingTileCount();
        if (remainingTiles === 0) {
            const gameMode = this._currentLevel?.gameMode || GameMode.TRIPLE_MATCH;
            if (gameMode === GameMode.ORDER_MATCH) {
                return; // ORDER_MATCH win handled by onAllOrdersCompleted
            }
            // TRIPLE_MATCH: board clear = win
            this._isLevelActive = false;
            this.calculateStars();
            EventBus.getInstance().emit(GameEvent.LEVEL_COMPLETED, this._currentLevelId, this._score, this._stars);
        }
    }

    public completeLevel(skipped: boolean = false): void {
        if (!this._isLevelActive) return;
        this._isLevelActive = false;
        if (!skipped) this.calculateStars();
                EventBus.getInstance().emit(GameEvent.LEVEL_COMPLETED, this._currentLevelId, this._score, this._stars, skipped);
    }

    /** Xử lý khi tất cả orders hoàn thành */
    private onAllOrdersCompleted(): void {
        if (!this._isLevelActive) return;
        const runId = this._levelRunId;
                if (this._isResolvingLevelEnd) return;
        this._isResolvingLevelEnd = true;
        this.waitForOrderTilesCleared(runId);
        // Đợi TrayManager xóa tile và animation xong mới kiểm tra win
    }

    /** Xử lý khi tray chính đầy (ORDER_MATCH only) */
    private waitForOrderTilesCleared(runId: number): void {
        this.clearPendingOrderTilesClearedHandler();
        this._pendingOrderTilesClearedHandler = () => {
            this.clearPendingOrderTilesClearedHandler();
            this.finalizeOrderMatchCompletion(runId);
        };
        EventBus.getInstance().on(GameEvent.ORDER_TILES_CLEARED, this._pendingOrderTilesClearedHandler, this);
        if (!TrayManager.getInstance().isClearingOrderTiles()) {
            setTimeout(() => {
                if (!this._pendingOrderTilesClearedHandler) return;
                this.clearPendingOrderTilesClearedHandler();
                this.finalizeOrderMatchCompletion(runId);
            }, 0);
        }
    }

    private clearPendingOrderTilesClearedHandler(): void {
        if (!this._pendingOrderTilesClearedHandler) return;
        EventBus.getInstance().off(GameEvent.ORDER_TILES_CLEARED, this._pendingOrderTilesClearedHandler, this);
        this._pendingOrderTilesClearedHandler = null;
    }

    private finalizeOrderMatchCompletion(runId: number = this._levelRunId): void {
        if (runId !== this._levelRunId) {
                        return;
        }
        if (!this._isLevelActive) {
                        return;
        }

        const remainingTiles = TileManager.getInstance().getRemainingTileCount();
        const trayTiles = TrayManager.getInstance().getTrayTiles().length;
        const flyCount = TrayManager.getInstance().getFlyCount();
        const clearingOrderTiles = TrayManager.getInstance().isClearingOrderTiles();
        
        if (clearingOrderTiles) {
                        this.waitForOrderTilesCleared(runId);
            return;
        }

        if (flyCount > 0) {
                        setTimeout(() => this.finalizeOrderMatchCompletion(runId), 100);
            return;
        }

        if (OrderManager.getInstance().isAllOrdersCompleted()) {
            this._isLevelActive = false;
            this.calculateStars();
                        EventBus.getInstance().emit(GameEvent.LEVEL_COMPLETED, this._currentLevelId, this._score, this._stars);
        } else {
                        this._isLevelActive = false;
            EventBus.getInstance().emit(GameEvent.LEVEL_FAILED, this._currentLevelId);
        }
    }

    private onTrayFull(): void {
        if (!this._isLevelActive) return;
        const runId = this._levelRunId;
        const gameMode = this._currentLevel?.gameMode || GameMode.TRIPLE_MATCH;
        if (gameMode !== GameMode.ORDER_MATCH) return;
        
        // Delay để onOrderCompleted kịp remove tile nếu vừa hoàn thành order
        setTimeout(() => {
            if (runId !== this._levelRunId) return;
            if (!this._isLevelActive) return;
            if (
                TrayManager.getInstance().isFull() &&
                !OrderManager.getInstance().isAllOrdersCompleted() &&
                !TrayManager.getInstance().isClearingOrderTiles() &&
                TrayManager.getInstance().getFlyCount() === 0 &&
                !OrderManager.getInstance().isPendingTrayCheck()
            ) {
                                this.onLevelFailed('tray_full_order_match');
            }
        }, 0);
    }

    /** Xử lý khi wrong tray đầy (chỉ thua trong TRIPLE_MATCH) */
    private onWrongTrayFull(): void {
        if (!this._isLevelActive) return;
        const gameMode = this._currentLevel?.gameMode || GameMode.TRIPLE_MATCH;
        if (gameMode === GameMode.ORDER_MATCH) {
            // ORDER_MATCH: chỉ tray chính đầy mới thua, wrong tray không gây thua
            return;
        }
                this.onLevelFailed('wrong_tray_full');
    }

    /** Xử lý level thất bại */
    public onLevelFailed(reason: string = 'unknown'): void {
        if (!this._isLevelActive) return;
        if (this._isResolvingLevelEnd || OrderManager.getInstance().isAllOrdersCompleted()) {
            return;
        }
        this._isLevelActive = false;
        EventBus.getInstance().emit(GameEvent.LEVEL_FAILED, this._currentLevelId);
    }

    /** Cộng điểm */
    public addScore(points: number): void {
        this._score += points;
        EventBus.getInstance().emit(GameEvent.SCORE_CHANGED, this._score, points);
    }

    /** Tính số sao */
    private calculateStars(): void {
        const thresholds = this._currentLevel?.starThresholds || [];
        let stars = 0;
        for (let i = 0; i < thresholds.length; i++) {
            if (this._score >= thresholds[i]) stars = i + 1;
        }
        this._stars = stars;
    }

    /** Getters */
    public getCurrentLevel(): ILevelData | null { return this._currentLevel; }
    public getCurrentLevelId(): number { return this._currentLevelId; }
    public getScore(): number { return this._score; }
    public getStars(): number { return this._stars; }
    public isLevelActive(): boolean { return this._isLevelActive; }
}
