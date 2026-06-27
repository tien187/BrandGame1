import { _decorator, Component, Node, Vec3, tween, Label, Tween, UIOpacity } from 'cc';
import { ITileData } from '../interfaces/ITileData';
import { ITrayConfig } from '../interfaces/ITrayConfig';
import { IOrder } from '../interfaces/IOrder';
import { GameEvent } from '../enums/GameEvent';
import { EventBus } from '../core/EventBus';
import { TileManager } from './TileManager';
import { AudioManager } from './AudioManager';
import { OrderManager } from './OrderManager';
import { OrderTrayManager } from './OrderTrayManager';
import { BoosterManager } from './BoosterManager';
import { PoolManager } from '../core/PoolManager';
import { SkinManager } from './SkinManager';

const { ccclass, property } = _decorator;

/**
 * TrayHistory - Lưu trữ trạng thái của một tile trước khi vào tray (dùng cho Undo).
 */
export interface ITrayHistory {
    tileId: string;
    gridX: number;
    gridY: number;
    layer: number;
}

export interface ITraySnapshot {
    tileIds: string[];
    history: ITrayHistory[];
    settledTileIds: string[];
}

/**
 * TrayManager - Quản lý thanh tray 8 slot.
 * - Tile bay vào tray với tween animation
 - Tự động sắp xếp theo groupId để dễ nhìn match
 * - Lưu history để Undo
 * - Glow khi có 3 tile cùng loại
 */
@ccclass('TrayManager')
export class TrayManager extends Component {
    public static Instance: TrayManager;
    public static getInstance(): TrayManager { return TrayManager.Instance; }

    @property(Node)
    public trayContainer: Node | null = null;

    @property(Label)
    public slotLabel: Label | null = null;

    @property
    public flyDuration: number = 0.45;

    @property
    public rearrangeDuration: number = 0.15;

    /** Khoảng cách giữa các slot trong tray (override giá trị từ config, để 0 để dùng config) */
    @property
    public slotSpacing: number = 0;

    private _config: ITrayConfig | null = null;
    private _trayTiles: ITileData[] = [];
    private _history: ITrayHistory[] = [];
    private _flyCount: number = 0;
    private _pendingOrderClearEffects: number = 0;
    private _settledTileIds: Set<string> = new Set();
    private _lifecycleId: number = 0;

    protected onLoad(): void {
        if (TrayManager.Instance) { this.destroy(); return; }
        TrayManager.Instance = this;
        EventBus.getInstance().on(GameEvent.TILE_CLICKED, this.onTileClicked, this);
        EventBus.getInstance().on(GameEvent.ORDER_COMPLETED, this.onOrderCompletedWithEffect, this);
    }

    private onTileClicked(data: ITileData): void {
        this.addTile(data.id);
    }

    /** Khi order hoàn thành: xóa đúng các tile ID được truyền vào khỏi tray */
    private onOrderCompleted(order: IOrder | null, orderIndex: number, tileIds?: string[]): void {
        if (!tileIds || tileIds.length === 0) return;
        const lifecycleId = this._lifecycleId;

        // Remove from _trayTiles and _history first
        for (const tileId of tileIds) {
            const index = this._trayTiles.findIndex(t => t.id === tileId);
            if (index !== -1) this._trayTiles.splice(index, 1);
            const histIndex = this._history.findIndex(h => h.tileId === tileId);
            if (histIndex !== -1) this._history.splice(histIndex, 1);
            this._settledTileIds.delete(tileId);
        }

        // Animate all nodes scale to 0
        for (const tileId of tileIds) {
            const node = TileManager.getInstance().getTileNode(tileId);
            if (node && node.isValid) {
                tween(node).to(0.2, { scale: new Vec3(0, 0, 1) }).start();
            }
        }

        // Delay then remove from TileManager, compact tray, check full
        this.scheduleOnce(() => {
            if (lifecycleId !== this._lifecycleId) return;
            for (const tileId of tileIds) {
                TileManager.getInstance().removeTile(tileId);
            }
            this.compactTray();
            this.updateSlotLabel();
            // Sau khi remove, nếu tray vẫn đầy → emit TRAY_FULL
            if (this.isFull()) {
                EventBus.getInstance().emit(GameEvent.TRAY_FULL);
            }
        }, 0.25);
    }

    /** Animate matched order tiles out of tray, then consume them into the current order UI. */
    private onOrderCompletedWithEffect(order: IOrder | null, orderIndex: number, tileIds?: string[]): void {
        if (!tileIds || tileIds.length === 0) return;
        const lifecycleId = this._lifecycleId;
        console.log(`[TM_DEBUG] onOrderCompletedWithEffect orderIndex=${orderIndex} orderId=${order?.id || '?'} tileIds=${tileIds.join(',')} trayBefore=${this._trayTiles.length} fly=${this._flyCount}`);

        const orderTargetWorldPos = OrderTrayManager.getInstance()?.getCurrentOrderEffectWorldPosition() ?? null;
        const matchedNodes: Map<string, Node> = new Map();

        // Remove from tray state immediately so the player can keep choosing tiles while the effect plays.
        for (const tileId of tileIds) {
            const index = this._trayTiles.findIndex(t => t.id === tileId);
            if (index !== -1) this._trayTiles.splice(index, 1);
            const histIndex = this._history.findIndex(h => h.tileId === tileId);
            if (histIndex !== -1) this._history.splice(histIndex, 1);
            this._settledTileIds.delete(tileId);

            const node = TileManager.getInstance().getTileNode(tileId);
            if (node && node.isValid) {
                matchedNodes.set(tileId, node);
            }
        }

        this.compactTray();
        this.updateSlotLabel();

        this._pendingOrderClearEffects = tileIds.length;
        console.log(`[TM_DEBUG] order clear effects started pending=${this._pendingOrderClearEffects} trayAfterRemove=${this._trayTiles.length}`);
        const onEffectComplete = () => {
            if (lifecycleId !== this._lifecycleId) return;
            this._pendingOrderClearEffects--;
            console.log(`[TM_DEBUG] order clear effect complete pending=${this._pendingOrderClearEffects}`);
            if (this._pendingOrderClearEffects <= 0) {
                this._pendingOrderClearEffects = 0;
                console.log('[TM_DEBUG] emitting ORDER_TILES_CLEARED');
                EventBus.getInstance().emit(GameEvent.ORDER_TILES_CLEARED);
            }
        };

        for (let i = 0; i < tileIds.length; i++) {
            this.playOrderConsumeTileEffect(tileIds[i], matchedNodes.get(tileIds[i]), orderTargetWorldPos, i, tileIds.length, lifecycleId, onEffectComplete);
        }

        if (this.isFull()) {
            console.warn(`[TM_DEBUG] emitting TRAY_FULL after order complete effect tray=${this._trayTiles.length} max=${this.getMaxSlots()} pending=${this._pendingOrderClearEffects}`);
            EventBus.getInstance().emit(GameEvent.TRAY_FULL);
        }
    }

    private playOrderConsumeTileEffect(
        tileId: string,
        node: Node | undefined,
        targetWorldPos: Vec3 | null,
        index: number,
        total: number,
        lifecycleId: number,
        onEffectComplete: () => void
    ): void {
        if (lifecycleId !== this._lifecycleId) return;
        if (!node || !node.isValid) {
            TileManager.getInstance().removeTile(tileId);
            if (index === total - 1) {
                OrderTrayManager.getInstance()?.hideCurrentOrderConsumeEffect();
            }
            onEffectComplete();
            return;
        }

        Tween.stopAllByTarget(node);
        const tileComp = node.getComponent('Tile') as any;
        if (tileComp && tileComp.stopAllTweens) {
            tileComp.stopAllTweens();
        }

        const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        opacity.opacity = 255;

        const startWorld = node.getWorldPosition();
        const direction = index - (total - 1) / 2;
        const side = direction === 0 ? 0 : direction > 0 ? 1 : -1;
        const peakOffsetX = side * 46;
        const fallOffsetX = side * 190;
        const jumpHeight = 170;
        const fallDistance = 860;
        const startScale = node.scale.clone();
        node.angle = 0;
        node.setScale(startScale.x, startScale.y, startScale.z);
        const proxy = {
            t: 0,
        };
        const smoothStep = (t: number): number => t * t * (3 - 2 * t);
        const applyJump = () => {
            if (lifecycleId !== this._lifecycleId) return;
            if (!node || !node.isValid) return;
            const t = Math.max(0, Math.min(1, proxy.t));
            const jumpPortion = 0.25;
            const hangPortion = 0.04;
            const peakX = startWorld.x + peakOffsetX;
            const peakY = startWorld.y + jumpHeight;
            const endX = startWorld.x + fallOffsetX;
            let x: number;
            let y: number;
            let scale = 1;

            if (t <= jumpPortion) {
                const jumpT = smoothStep(t / jumpPortion);
                x = startWorld.x + (peakX - startWorld.x) * jumpT;
                y = startWorld.y + jumpHeight * jumpT;
                scale = 1 + 0.144 * jumpT;
            } else if (t <= jumpPortion + hangPortion) {
                const hangT = (t - jumpPortion) / hangPortion;
                x = peakX + side * 4 * hangT;
                y = peakY - 4 * smoothStep(hangT);
                scale = 1.144 - 0.018 * smoothStep(hangT);
            } else {
                const fallT = (t - jumpPortion - hangPortion) / (1 - jumpPortion - hangPortion);
                const fallEase = fallT * fallT;
                x = peakX + (endX - peakX) * smoothStep(fallT);
                y = peakY - 10 - fallDistance * fallEase;
                scale = 1.126 - 0.126 * smoothStep(fallT);
            }

            node.setWorldPosition(
                x,
                y,
                startWorld.z
            );
            node.setScale(startScale.x * scale, startScale.y * scale, startScale.z);
            node.angle = 0;
            opacity.opacity = 255;
        };

        tween(proxy)
            .to(0.56, {
                t: 1,
            }, {
                easing: 'linear',
                onUpdate: applyJump,
            })
            .call(() => {
                if (lifecycleId !== this._lifecycleId) return;
                TileManager.getInstance().removeTile(tileId);
                if (index === total - 1) {
                    OrderTrayManager.getInstance()?.hideCurrentOrderConsumeEffect();
                }
                onEffectComplete();
            })
            .start();
    }

    public initialize(config: ITrayConfig): void {
        this._lifecycleId++;
        this.unscheduleAllCallbacks();
        this._config = config || { maxSlots: 7, matchCount: 3, screenPosition: { x: 0, y: -400 }, slotSpacing: 80 };
        this._trayTiles = [];
        this._history = [];
        this._flyCount = 0;
        this._pendingOrderClearEffects = 0;
        this._settledTileIds.clear();
        this.updateSlotLabel();
    }

    /**
     * Thêm tile vào tray khi người chơi click.
     * Tile bay xuống tray, remove khỏi board state, lưu history.
     */
    public addTile(tileId: string): boolean {
        if (this.isFull()) return false;
        const lifecycleId = this._lifecycleId;

        const data = TileManager.getInstance().getTileData(tileId);
        const node = TileManager.getInstance().getTileNode(tileId);
        if (!data || !node || !data.active || !data.selectable) return false;

        // Prevent duplicate tiles in tray
        if (this._trayTiles.some(t => t.id === tileId)) return false;
        BoosterManager.getInstance()?.pushUndoSnapshot();

        // Lưu history cho Undo
        this._history.push({
            tileId: data.id,
            gridX: data.gridX,
            gridY: data.gridY,
            layer: data.layer,
        });

        this._trayTiles.push(data);
        this._flyCount++;

        // Xóa khỏi board state (nhưng giữ node alive để bay)
        // Phải push vào tray trước để refreshBlockStatus tính đúng tile trong tray
        TileManager.getInstance().removeFromBoard(data.id);

        // Bay vào slot cuối trước, sau khi complete thì sort lại
        const slotIndex = this._trayTiles.length - 1;
        const targetPos = this.getSlotPosition(slotIndex);

        let didSettle = false;
        const onComplete = () => {
            if (lifecycleId !== this._lifecycleId) return;
            if (didSettle) return;
            didSettle = true;
            this._flyCount--;
            if (this._flyCount < 0) this._flyCount = 0;
            this._settledTileIds.add(data.id);
            // Emit event ngay khi tile này bay xong
            EventBus.getInstance().emit(GameEvent.TILE_ADDED_TO_TRAY, data);
            // Chỉ tính order khi tất cả tile đã đáp xuống hẳn
            if (this._flyCount === 0) {
                EventBus.getInstance().emit(GameEvent.TRAY_SETTLED);
            }
            // Sau khi OrderManager xử lý xong (cùng frame), check tray full
            if (this.isFull()) {
                EventBus.getInstance().emit(GameEvent.TRAY_FULL);
            }
        };

        if (node && this.trayContainer) {
            // Save current world position so the tile stays visually in place
            // before reparenting into the tray container.
            const worldPos = node.getWorldPosition();
            node.setParent(this.trayContainer);
            node.setWorldPosition(worldPos);

            const tileComp = node.getComponent('Tile') as any;
            if (tileComp && tileComp.setTrayVisual) {
                tileComp.setTrayVisual();
            }
            if (tileComp && tileComp.moveToTray) {
                tileComp.moveToTray(targetPos, this.flyDuration, onComplete, onComplete);
            } else if (node.isValid) {
                tween(node).to(this.flyDuration, { position: targetPos }).call(onComplete).start();
            } else {
                onComplete();
            }
        } else {
            onComplete();
        }

        this.updateSlotLabel();
        AudioManager.getInstance().playSfx('sfx_click');
        return true;
    }

    /**
     * Sắp xếp tray: tile cùng groupId nằm cạnh nhau.
     */
    private sortTrayByGroup(): void {
        // Stable sort theo groupId - không dùng comparator phụ thuộc newTile
        // vì vi phạm tính bắc cầu của Array.sort và gây sắp xếp không xác định
        this._trayTiles.sort((a, b) => a.groupId.localeCompare(b.groupId));
    }

    /** Sắp xếp lại toàn bộ tile trong tray với animation */
    public sortTray(): void {
        this.sortTrayByGroup();
        for (let i = 0; i < this._trayTiles.length; i++) {
            const data = this._trayTiles[i];
            const node = TileManager.getInstance().getTileNode(data.id);
            if (!node || !node.isValid || !node.active) continue;

            const targetPos = this.getSlotPosition(i);
            const tileComp = node.getComponent('Tile') as any;
            if (tileComp && tileComp._isAnimating && tileComp._moveTween) {
                tileComp.updateMoveTarget(targetPos, this.rearrangeDuration);
            } else {
                tween(node).to(this.rearrangeDuration, { position: targetPos }).start();
            }
        }

        // Check glow cho các group sắp đủ 3
        this.updateGlowEffects();
    }

    /** Compact lại vị trí tile trong tray (không sort, chỉ lấp chỗ trống) */
    private compactTray(): void {
        for (let i = 0; i < this._trayTiles.length; i++) {
            const data = this._trayTiles[i];
            const node = TileManager.getInstance().getTileNode(data.id);
            if (!node || !node.isValid || !node.active) continue;

            const targetPos = this.getSlotPosition(i);
            const tileComp = node.getComponent('Tile') as any;
            if (tileComp && tileComp._isAnimating && tileComp._moveTween) {
                tileComp.updateMoveTarget(targetPos, this.rearrangeDuration);
            } else {
                tween(node).to(this.rearrangeDuration, { position: targetPos }).start();
            }
        }
        this.updateGlowEffects();
    }

    /** Bật/tắt glow cho tile sắp match (chỉ khi có đủ matchCount tile cùng groupId liên tiếp) */
    private updateGlowEffects(): void {
        const glowIndices = new Set<number>();
        const matchCount = this._config?.matchCount || 3;
        let i = 0;
        while (i < this._trayTiles.length) {
            let j = i + 1;
            while (j < this._trayTiles.length && this._trayTiles[j].groupId === this._trayTiles[i].groupId) {
                j++;
            }
            const runLength = j - i;
            if (runLength >= matchCount) {
                for (let k = i; k < j; k++) {
                    glowIndices.add(k);
                }
            }
            i = j;
        }

        for (let i = 0; i < this._trayTiles.length; i++) {
            const data = this._trayTiles[i];
            const node = TileManager.getInstance().getTileNode(data.id);
            if (!node) continue;
            const tileComp = node.getComponent('Tile') as any;
            if (!tileComp) continue;

            if (glowIndices.has(i)) {
                tileComp.setGlow(true);
            } else {
                tileComp.setGlow(false);
            }
        }
    }

    /** Xóa tile khỏi tray (khi đã match hoặc order correct), animate ra rồi destroy */
    public removeTile(tileId: string): void {
        const index = this._trayTiles.findIndex(t => t.id === tileId);
        if (index === -1) return;

        this._trayTiles.splice(index, 1);
        this._settledTileIds.delete(tileId);

        // Sync history để tránh Undo restore tile đã bị match xóa
        const histIndex = this._history.findIndex(h => h.tileId === tileId);
        if (histIndex !== -1) {
            this._history.splice(histIndex, 1);
        }

        // Animate node ra khỏi tray rồi remove khỏi TileManager
        const node = TileManager.getInstance().getTileNode(tileId);
        if (node && node.isValid) {
            const lifecycleId = this._lifecycleId;
            tween(node)
                .to(0.2, { scale: new Vec3(0, 0, 1) })
                .call(() => {
                    if (lifecycleId !== this._lifecycleId) return;
                    TileManager.getInstance().removeTile(tileId);
                    this.compactTray();
                    this.updateSlotLabel();
                })
                .start();
        } else {
            TileManager.getInstance().removeTile(tileId);
            this.compactTray();
            this.updateSlotLabel();
        }
    }

    /** Pop tile cuối cùng khỏi tray (cho Undo) */
    public popLastTile(): ITileData | null {
        if (this._trayTiles.length === 0 || this._history.length === 0) return null;
        const lastHistory = this._history[this._history.length - 1];

        // Tìm và xóa tile tương ứng với history cuối
        const index = this._trayTiles.findIndex(t => t.id === lastHistory.tileId);
        if (index !== -1) {
            const data = this._trayTiles[index];
            this._trayTiles.splice(index, 1);
            this._settledTileIds.delete(data.id);
            this._history.pop();
            this.compactTray();
            this.updateSlotLabel();
            return data;
        }
        this._history.pop();
        this.compactTray();
        this.updateSlotLabel();
        return null;
    }

    /** Lấy history cho Undo */
    public getLastHistory(): ITrayHistory | null {
        if (this._history.length === 0) return null;
        return this._history[this._history.length - 1];
    }

    public removeLastHistory(): void {
        this._history.pop();
    }

    /** Lấy vị trí slot trong tray */
    public getSlotPosition(index: number): Vec3 {
        if (!this._config) return Vec3.ZERO;
        const spacing = this.slotSpacing > 0 ? this.slotSpacing : this._config.slotSpacing;
        const centerOffset = -(this._config.maxSlots - 1) * spacing / 2;
        const x = centerOffset + index * spacing;
        return new Vec3(x, 0, 0);
    }

    /** Kiểm tra tray đã đầy chưa */
    public isFull(): boolean {
        if (!this._config) return true;
        return this._trayTiles.length >= this._config.maxSlots;
    }

    /** Kiểm tra tray đã đầy VÀ không thể match nào */
    public isDeadEnd(): boolean {
        if (!this.isFull()) return false;
        const matchCount = this._config?.matchCount || 3;
        // Tìm dãy liên tiếp cùng groupId với độ dài >= matchCount
        for (let i = 0; i <= this._trayTiles.length - matchCount; i++) {
            const groupId = this._trayTiles[i].groupId;
            let allSame = true;
            for (let j = 1; j < matchCount; j++) {
                if (this._trayTiles[i + j].groupId !== groupId) {
                    allSame = false;
                    break;
                }
            }
            if (allSame) return false; // Có thể match
        }
        return true;
    }

    public getMaxSlots(): number { return this._config?.maxSlots || 7; }
    public getMatchCount(): number { return this._config?.matchCount || 3; }
    public getTrayTiles(): ITileData[] { return [...this._trayTiles]; }
    public getSettledTrayTiles(): ITileData[] { return this._trayTiles.filter(t => this._settledTileIds.has(t.id)); }
    public getFlyCount(): number { return this._flyCount; }
    public isClearingOrderTiles(): boolean { return this._pendingOrderClearEffects > 0; }

    public captureSnapshot(): ITraySnapshot {
        return {
            tileIds: this._trayTiles.map(t => t.id),
            history: this._history.map(h => ({ ...h })),
            settledTileIds: Array.from(this._settledTileIds),
        };
    }

    public restoreSnapshot(snapshot: ITraySnapshot): void {
        this._lifecycleId++;
        this.unscheduleAllCallbacks();
        this._trayTiles = [];
        this._history = snapshot.history.map(h => ({ ...h }));
        this._settledTileIds = new Set(snapshot.settledTileIds);
        this._flyCount = 0;
        this._pendingOrderClearEffects = 0;

        for (let i = 0; i < snapshot.tileIds.length; i++) {
            const tileId = snapshot.tileIds[i];
            let data = TileManager.getInstance().getTileData(tileId);
            let node = TileManager.getInstance().getTileNode(tileId);
            if (!data) continue;

            // Nếu node chưa có (tile đang ở tray trong snapshot), tạo từ pool
            if (!node || !node.isValid) {
                const prefabKey = SkinManager.getInstance().getTilePrefabKey(data.groupId);
                node = PoolManager.getInstance().get(prefabKey);
                if (!node) continue;

                const tileComponent = node.getComponent('Tile') || node.addComponent('Tile');
                if (tileComponent) {
                    const tileComp = tileComponent as any;
                    if (tileComp.reset) tileComp.reset();
                    tileComp.initialize(data);
                }

                const skinOverride = data.skinOverride || `${SkinManager.getInstance().getCurrentSkin()?.skinId || 'uma'}/${data.groupId}`;
                SkinManager.getInstance().applyTileSkin(node, skinOverride);
                TileManager.getInstance().registerTileNode(tileId, node);
            }

            data.active = false;
            data.selectable = false;
            this._trayTiles.push(data);

            if (this.trayContainer) {
                node.setParent(this.trayContainer);
                node.setPosition(this.getSlotPosition(i));
            }
            const tileComp = node.getComponent('Tile') as any;
            if (tileComp && tileComp.setTrayVisual) tileComp.setTrayVisual();
        }

        this.compactTray();
        this.updateSlotLabel();
    }

    /** Cập nhật label hiển thị số slot đã dùng / tổng số slot */
    public updateSlotLabel(): void {
        if (!this.slotLabel) return;
        const curr = this._trayTiles.length;
        const max = this.getMaxSlots();
        this.slotLabel.string = `${curr} / ${max}`;
    }

    /** Clear tray */
    public clearTray(): void {
        this._lifecycleId++;
        this.unscheduleAllCallbacks();
        this._trayTiles = [];
        this._history = [];
        this._flyCount = 0;
        this._pendingOrderClearEffects = 0;
        this._settledTileIds.clear();
        this._config = null;
        this.updateSlotLabel();
    }

    protected onDestroy(): void {
        if (TrayManager.Instance === this) {
            this._lifecycleId++;
            this.unscheduleAllCallbacks();
            TrayManager.Instance = null;
            EventBus.getInstance().off(GameEvent.TILE_CLICKED, this.onTileClicked, this);
            EventBus.getInstance().off(GameEvent.ORDER_COMPLETED, this.onOrderCompletedWithEffect, this);
        }
    }
}
