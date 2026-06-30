import { _decorator, Component, Node, Vec3, tween, Tween, UITransform, UIOpacity } from 'cc';
import { ITileData } from '../interfaces/ITileData';
import { GameEvent } from '../enums/GameEvent';
import { EventBus } from '../core/EventBus';
import { PoolManager } from '../core/PoolManager';
import { BoardManager } from './BoardManager';
import { TrayManager } from './TrayManager';
import { SkinManager } from './SkinManager';
import { OrderManager } from './OrderManager';
import { BoardPositionHelper } from '../core/BoardPositionHelper';

const { ccclass, property } = _decorator;

/**
 * TileManager - Quản lý lifecycle của tile: spawn, click, move, match, despawn.
 * Mỗi tile là một Node trong scene, được tạo từ prefab qua PoolManager.
 * Tile data được lưu trong map, không hardcode trong prefab.
 */
@ccclass('TileManager')
export class TileManager extends Component {
    public static Instance: TileManager;

    @property(Node)
    public tileContainer: Node | null = null;

    /** Độ cao tile xuất hiện trước khi rơi xuống (pixel) */
    @property
    public dropHeight: number = 600;

    /** Thời gian rơi xuống của mỗi tile (giây) */
    @property
    public dropDuration: number = 0.6;

    /** Delay lần lượt giữa các tile (giây) */
    @property
    public staggerDelay: number = 0.05;

    /** Easing khi rơi: 'sineOut', 'backOut', 'bounceOut', 'quadOut', ... */
    @property
    public dropEasing: string = 'backOut';

    private _tileDataMap: Map<string, ITileData> = new Map();
    private _tileNodeMap: Map<string, Node> = new Map();
    private _clickableTiles: Set<string> = new Set();
    private _isInputLocked: boolean = false;
    private _enforceGroupMatchBlock: boolean = true;
    private _lifecycleId: number = 0;
    private _tileContainerOriginalPos: Vec3 | null = null;

    public static getInstance(): TileManager {
        return TileManager.Instance;
    }

    protected onLoad(): void {
        if (TileManager.Instance) {
            this.destroy();
            return;
        }
        TileManager.Instance = this;
        if (this.tileContainer && this.tileContainer.isValid) {
            this._tileContainerOriginalPos = this.tileContainer.position.clone();
        }
    }

    /** Spawn tiles từ level data. animateDrop=true sẽ chơi animation rơi từ trên xuống theo thứ tự layer dưới trước. */
    public spawnTiles(tileDataList: ITileData[], animateDrop: boolean = false, enforceGroupMatchBlock: boolean = true): void {
        this.clearTiles();
        this._enforceGroupMatchBlock = enforceGroupMatchBlock;
        this._lifecycleId++;
        const lifecycleId = this._lifecycleId;

        // Phase 1: Register all tiles to board grid trước để occlusion check có dữ liệu đầy đủ
        for (const data of tileDataList) {
            data.active = true;
            this._tileDataMap.set(data.id, data);
            BoardManager.getInstance().registerTile(data);
        }

        // Phase 2: Tính block status với grid đã đầy đủ
        this.updateBlockStatus(tileDataList);

        // Phase 3: Tạo visual nodes
        if (animateDrop) {
            this.spawnTilesWithDrop(tileDataList, lifecycleId);
        } else {
            for (const data of tileDataList) {
                this.createTileNode(data);
            }
        }

        // Phase 3.5: Sắp xếp lại sibling index theo layer để đảm bảo render đúng thứ tự
        this._sortTileNodesByLayer();

        // Phase 4: Áp dụng group count block logic (TRIPLE_MATCH) sau khi có nodes
        this.refreshBlockStatus();
    }

    /** Prewarm pool để tránh instantiate runtime gây giật khi load level */
    public prewarmPool(count: number): void {
        const prefabKey = SkinManager.getInstance().getTilePrefabKey('default');
        PoolManager.getInstance().ensureCapacity(prefabKey, count);
    }

    /** Spawn tile với animation rơi từ trên xuống lần lượt từng tile:
     *  - Layer dưới trước, layer trên sau
     *  - Trong cùng layer: từ dưới lên trên (gridY cao trước), từ trái sang phải (gridX tăng)
     */
    private spawnTilesWithDrop(tileDataList: ITileData[], lifecycleId: number): void {
        this.setInputLocked(true);

        const sorted = [...tileDataList].sort((a, b) => {
            if (a.layer !== b.layer) return a.layer - b.layer;
            if (a.gridY !== b.gridY) return b.gridY - a.gridY;
            return a.gridX - b.gridX;
        });

        let completedCount = 0;
        const totalCount = sorted.length;

        for (let i = 0; i < sorted.length; i++) {
            const delay = i * this.staggerDelay;
            this.createTileNodeWithDrop(sorted[i], delay, () => {
                if (lifecycleId !== this._lifecycleId) return;
                completedCount++;
                if (completedCount >= totalCount) {
                    this.refreshBlockStatus();
                    this.setInputLocked(false);
                }
            });
        }
    }

    /** Tạo visual node cho tile đã được đăng ký */
    private createTileNode(data: ITileData, forceCreate: boolean = false): void {
        if ((!data.active && !forceCreate) || !this.tileContainer) return;

        // Lấy prefab từ SkinManager theo groupId
        const prefabKey = SkinManager.getInstance().getTilePrefabKey(data.groupId);
        const node = PoolManager.getInstance().get(prefabKey);

        if (!node) return;
        this.prepareTileNodeForGameplay(node);

        node.setParent(this.tileContainer);
        this._tileNodeMap.set(data.id, node);

        const uiTransform = node.getComponent(UITransform);
        const visualNode = node.getChildByName('visual');
        const visualTransform = visualNode?.getComponent(UITransform);
        
        // Reset và khởi tạo lại component Tile từ pool TRƯỚC khi set vị trí / skin
        const tileComponent = node.getComponent('Tile') || node.addComponent('Tile');
        if (tileComponent) {
            const tileComp = tileComponent as any;
            if (tileComp.reset) tileComp.reset();
            tileComp.initialize(data);
        }

        // Đặt vị trí world từ gridX, gridY, layer (SAU reset để không bị ghi đè)
        const bm = BoardManager.getInstance();
        const worldPos = bm.getWorldPosition(data.gridX, data.gridY, data.layer);

        // BoardManager.getWorldPosition() giờ trả về pixel coordinates trong Canvas space
        // (đã cộng screenCenterX/Y). setPosition dùng local position trong parent (Canvas).
        // Đảm bảo tileContainer ở (0,0,0) trong Editor.
        node.setPosition(worldPos.x, worldPos.y, worldPos.z);

        // Cập nhật trạng thái selectable
        if (data.selectable && !data.isBlocked) {
            this._clickableTiles.add(data.id);
        }

        this.applyTileSkin(node, data);
    }

    /** Tạo visual node với animation rơi từ trên xuống */
    private createTileNodeWithDrop(
        data: ITileData,
        delay: number,
        onComplete?: () => void
    ): void {
        if (!data.active || !this.tileContainer) return;

        const prefabKey = SkinManager.getInstance().getTilePrefabKey(data.groupId);
        const node = PoolManager.getInstance().get(prefabKey);
        if (!node) return;
        this.prepareTileNodeForGameplay(node);

        node.setParent(this.tileContainer);
        this._tileNodeMap.set(data.id, node);

        const tileComponent = node.getComponent('Tile') || node.addComponent('Tile');
        if (tileComponent) {
            const tileComp = tileComponent as any;
            if (tileComp.reset) tileComp.reset();
            tileComp.initialize(data);
        }

        const bm = BoardManager.getInstance();
        const endPos = bm.getWorldPosition(data.gridX, data.gridY, data.layer);
        const startPos = new Vec3(endPos.x, endPos.y + this.dropHeight, endPos.z);

        if (data.selectable && !data.isBlocked) {
            this._clickableTiles.add(data.id);
        }

        this.applyTileSkin(node, data);

        const tileComp = node.getComponent('Tile') as any;
        if (tileComp && tileComp.playDropAnimation) {
            tileComp.playDropAnimation(startPos, endPos, this.dropDuration, delay, this.dropEasing, onComplete);
        } else {
            tween(node)
                .delay(delay)
                .to(this.dropDuration, { position: endPos })
                .call(() => onComplete?.())
                .start();
        }
    }

    /** Áp dụng skin cho tile node */
    private applyTileSkin(node: Node, data: ITileData): void {
        const skinMgr = SkinManager.getInstance();
        let skinOverride = data.skinOverride;
        if (!skinOverride) {
            const currentSkin = skinMgr.getCurrentSkin();
            const skinId = currentSkin?.skinId || 'default';
            if (typeof data.groupId !== 'string') {
                                return;
            }
            skinOverride = `${skinId}/${data.groupId}`;
        }
        skinMgr.applyTileSkin(node, skinOverride);
    }

    private prepareTileNodeForGameplay(node: Node): void {
        Tween.stopAllByTarget(node);
        node.active = true;
        node.angle = 0;
        node.setRotationFromEuler(0, 0, 0);
        node.setScale(1, 1, 1);

        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;

        const visualNode = node.getChildByName('visual');
        if (visualNode && visualNode.isValid) {
            Tween.stopAllByTarget(visualNode);
            visualNode.angle = 0;
            visualNode.setRotationFromEuler(0, 0, 0);
            visualNode.setScale(1, 1, 1);
            const visualOpacity = visualNode.getComponent(UIOpacity);
            if (visualOpacity) visualOpacity.opacity = 255;
        }
    }

    /** Xử lý khi người chơi click tile */
    public onTileClicked(tileId: string): void {
        this.tryClickTile(tileId);
    }

    public tryClickTile(tileId: string, ignoreInputLock: boolean = false): boolean {
        if (this._isInputLocked && !ignoreInputLock) return false;
        if (!this._clickableTiles.has(tileId)) return false;

        const data = this._tileDataMap.get(tileId);
        if (!data || !data.active || !data.selectable) return false;
        // Update visual selected state
        const node = this._tileNodeMap.get(tileId);
        if (node) {
            const tileComp = node.getComponent('Tile') as any;
            if (tileComp) tileComp.setSelected(true);
        }

        EventBus.getInstance().emit(GameEvent.TILE_CLICKED, data);
        return true;
    }

    /** Mở/khóa input toàn cục */
    public setInputLocked(locked: boolean): void {
        this._isInputLocked = locked;
    }

    public isInputLocked(): boolean {
        return this._isInputLocked;
    }

    public getLifecycleId(): number {
        return this._lifecycleId;
    }

    /**
     * Xóa tile khỏi board state (grid, clickable) nhưng giữ node alive.
     * Dùng khi tile bay vào tray.
     */
    public removeFromBoard(tileId: string): void {
        const data = this._tileDataMap.get(tileId);
        if (!data) return;

        data.active = false;
        data.selectable = false;
        this._clickableTiles.delete(tileId);
        BoardManager.getInstance().unregisterTile(data);

        // Refresh block status cho các tile còn lại
        this.refreshBlockStatus();
    }

    /**
     * Khôi phục tile về board (cho Undo).
     */
    public restoreToBoard(data: ITileData, node: Node): void {
        data.active = true;
        this._tileDataMap.set(data.id, data);
        this._tileNodeMap.set(data.id, node);

        // Đặt lại parent và vị trí
        if (this.tileContainer) {
            node.setParent(this.tileContainer);
        }
        const worldPos = BoardManager.getInstance().getWorldPosition(data.gridX, data.gridY, data.layer);
        node.setPosition(worldPos);

        BoardManager.getInstance().registerTile(data);

        // Sắp xếp lại sibling index theo layer để tile layer cao render phía trên
        this._sortTileNodesByLayer();

        // Refresh block status
        this.refreshBlockStatus();
    }

    /** Sắp xếp các tile node trong tileContainer theo layer tăng dần */
    private _sortTileNodesByLayer(): void {
        if (!this.tileContainer) return;
        const entries: { data: ITileData; node: Node }[] = [];
        this._tileDataMap.forEach((data, id) => {
            const node = this._tileNodeMap.get(id);
            if (node && node.isValid && node.parent === this.tileContainer) {
                entries.push({ data, node });
            }
        });
        entries.sort((a, b) => a.data.layer - b.data.layer);
        for (let i = 0; i < entries.length; i++) {
            entries[i].node.setSiblingIndex(i);
        }
    }

    public sortTileNodesByLayer(): void {
        this._sortTileNodesByLayer();
    }

    /** Xóa tile khỏi board (khi đã match) */
    public removeTile(tileId: string): void {
        const data = this._tileDataMap.get(tileId);
        const node = this._tileNodeMap.get(tileId);

        if (data && node) {
            data.active = false;
            BoardManager.getInstance().unregisterTile(data);

            // Stop tween và reset trước khi put về pool
            const tileComp = node.getComponent('Tile') as any;
            if (tileComp) {
                if (tileComp.stopAllTweens) tileComp.stopAllTweens();
                if (tileComp.reset) tileComp.reset();
            }

            if (node.parent) {
                node.removeFromParent();
            }
            const prefabKey = SkinManager.getInstance().getTilePrefabKey(data.groupId);
            if (prefabKey) {
                PoolManager.getInstance().put(prefabKey, node);
            } else {
                node.destroy();
            }
        }

        this._tileDataMap.delete(tileId);
        this._tileNodeMap.delete(tileId);
        this._clickableTiles.delete(tileId);

        // Cập nhật block status cho các tile còn lại
        this.refreshBlockStatus();
    }

    /** Cập nhật trạng thái block/selectable cho tất cả tile */
    private updateBlockStatus(tileDataList: ITileData[]): void {
        const activeTiles = tileDataList.filter(data => data.active);
        for (const data of tileDataList) {
            data.isBlocked = this.computeTileBlocked(data, activeTiles);
            data.selectable = data.active && !data.isBlocked;
        }
    }

    /** Refresh block status sau khi tile bị xóa */
    public refreshBlockStatus(forceVisual: boolean = false): void {
        const allData = Array.from(this._tileDataMap.values());
        const matchCount = TrayManager.getInstance().getMatchCount();
        const trayTiles = TrayManager.getInstance().getTrayTiles();

        this._clickableTiles.clear();
        let activeCount = 0;
        let selectableCount = 0;
        let blockedCount = 0;
        for (const data of allData) {
            if (!data.active) continue;
            activeCount++;

            data.isBlocked = this.computeTileBlocked(data, allData);
            data.selectable = !data.isBlocked;

            // Nếu không bị che, kiểm tra xem tile có thể tạo match không
            // (chỉ áp dụng cho TRIPLE_MATCH; ORDER_MATCH không block theo group count)
            if (data.selectable && this._enforceGroupMatchBlock && !OrderManager.getInstance().isActive()) {
                const sameGroupOnBoard = allData.filter(
                    d => d.active && d.groupId === data.groupId
                ).length;
                const sameGroupInTray = trayTiles.filter(
                    t => t.groupId === data.groupId
                ).length;
                const totalSameGroup = sameGroupOnBoard + sameGroupInTray;

                // Block nếu không đủ tile cùng group để tạo ít nhất 1 match
                if (totalSameGroup < matchCount) {
                    data.selectable = false;
                    data.isBlocked = true;
                }
            }

            if (data.isBlocked) blockedCount++;
            if (data.selectable) selectableCount++;

            // Update visual state
            const node = this._tileNodeMap.get(data.id);
            if (node) {
                const tileComp = node.getComponent('Tile') as any;
                if (tileComp) {
                    const isInTray = trayTiles.some(t => t.id === data.id);
                    if (isInTray && tileComp.setTrayVisual) {
                        tileComp.setTrayVisual();
                    } else if (forceVisual && tileComp.forceUpdateBoardVisualState) {
                        tileComp.forceUpdateBoardVisualState();
                    } else if (forceVisual && tileComp.forceUpdateVisualState) {
                        tileComp.forceUpdateVisualState();
                    } else {
                        tileComp.updateVisualState();
                    }
                }
            }

            if (data.selectable) {
                this._clickableTiles.add(data.id);
            }
        }

    }

    /** Lấy tile data theo ID */
    private computeTileBlocked(tile: ITileData, allData: ITileData[]): boolean {
        if (!tile.active) return true;
        const boardConfig = BoardManager.getInstance().getConfig();
        if (!boardConfig) return true;
        return BoardPositionHelper.isTileBlocked(tile, allData, boardConfig);
    }

    public getTileData(tileId: string): ITileData | undefined {
        return this._tileDataMap.get(tileId);
    }

    /** Lấy tile node theo ID */
    public getTileNode(tileId: string): Node | undefined {
        return this._tileNodeMap.get(tileId);
    }

    public registerTileNode(tileId: string, node: Node): void {
        this._tileNodeMap.set(tileId, node);
    }

    /** Đếm số tile còn active */
    public getRemainingTileCount(): number {
        let count = 0;
        for (const data of this._tileDataMap.values()) {
            if (data.active) count++;
        }
        return count;
    }

    /** Lấy danh sách tile còn lại */
    public getAllTileData(): ITileData[] {
        return Array.from(this._tileDataMap.values());
    }

    public restoreTilesFromSnapshot(tileDataList: ITileData[]): void {
        const enforceGroupMatchBlock = this._enforceGroupMatchBlock;
        this.clearTiles();
        this._enforceGroupMatchBlock = enforceGroupMatchBlock;
        const tiles = tileDataList.map(t => ({ ...t }));
        for (const data of tiles) {
            this._tileDataMap.set(data.id, data);
            if (data.active) BoardManager.getInstance().registerTile(data);
        }
        this.updateBlockStatus(tiles);
        for (const data of tiles) {
            if (data.active) {
                this.createTileNode(data, true);
            }
        }
        this._sortTileNodesByLayer();
        this.refreshBlockStatus(true);
    }

    /** Clear tất cả tiles */
    public clearTiles(): void {
        this._lifecycleId++;
        this._tileNodeMap.forEach((node, id) => {
            const data = this._tileDataMap.get(id);
            const tileComp = node.getComponent('Tile') as any;
            if (tileComp) {
                if (tileComp.stopAllTweens) tileComp.stopAllTweens();
                if (tileComp.reset) tileComp.reset();
            }
            // Ensure node is removed from parent before pool/destroy
            if (node.parent) {
                node.removeFromParent();
            }
            if (data) {
                const prefabKey = SkinManager.getInstance().getTilePrefabKey(data.groupId);
                if (prefabKey) {
                    PoolManager.getInstance().put(prefabKey, node);
                } else {
                    node.destroy();
                }
            } else {
                node.destroy();
            }
        });
        this._tileDataMap.clear();
        this._tileNodeMap.clear();
        this._clickableTiles.clear();
        this._isInputLocked = false;
        this._enforceGroupMatchBlock = true;
        BoardManager.getInstance().clearBoard();
    }

    /** Rung toàn bộ tile container (feedback khi không tìm được hint) */
    public shakeAllTiles(): void {
        if (!this.tileContainer || !this.tileContainer.isValid) return;
        const node = this.tileContainer;
        Tween.stopAllByTarget(node);
        if (!this._tileContainerOriginalPos) {
            this._tileContainerOriginalPos = node.position.clone();
        }
        const originalPos = this._tileContainerOriginalPos;
        node.setPosition(originalPos);
        tween(node)
            .to(0.05, { position: new Vec3(originalPos.x - 8, originalPos.y, originalPos.z) })
            .to(0.05, { position: new Vec3(originalPos.x + 8, originalPos.y, originalPos.z) })
            .to(0.05, { position: new Vec3(originalPos.x - 8, originalPos.y, originalPos.z) })
            .to(0.05, { position: new Vec3(originalPos.x + 8, originalPos.y, originalPos.z) })
            .to(0.05, { position: originalPos })
            .start();
    }

    protected onDestroy(): void {
        if (TileManager.Instance === this) {
            TileManager.Instance = null;
        }
    }
}
