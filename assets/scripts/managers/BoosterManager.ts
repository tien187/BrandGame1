import { _decorator, Component } from 'cc';
import { BoosterType } from '../enums/BoosterType';
import { GameEvent } from '../enums/GameEvent';
import { EventBus } from '../core/EventBus';
import { ITileData } from '../interfaces/ITileData';
import { ITraySnapshot } from './TrayManager';
import { IOrderManagerSnapshot, OrderManager } from './OrderManager';
import { TileManager } from './TileManager';
import { TrayManager } from './TrayManager';
import { LevelManager } from './LevelManager';
import { WrongTrayManager } from './WrongTrayManager';
import { OrderTrayManager } from './OrderTrayManager';

const { ccclass } = _decorator;

interface IGameStateSnapshot {
    tiles: ITileData[];
    tray: ITraySnapshot;
    order: IOrderManagerSnapshot;
    wrongTray: { filledCount: number; isFull: boolean } | null;
}

@ccclass('BoosterManager')
export class BoosterManager extends Component {
    public static Instance: BoosterManager;
    public static getInstance(): BoosterManager { return BoosterManager.Instance; }

    private readonly _defaultHintCount = 50;
    private readonly _defaultUndoCount = 50;
    private readonly _defaultSkipCount = 1;

    private _hintCount: number = 50;
    private _undoCount: number = 50;
    private _skipCount: number = 1;

    private _undoStack: IGameStateSnapshot[] = [];
    private _isRestoring: boolean = false;
    private _highlightedTileId: string | null = null;
    private _activeBooster: BoosterType = BoosterType.NONE;
    private _isHintPicking: boolean = false;
    private _queuedHintCount: number = 0;
    private _isHintQueueScheduled: boolean = false;
    private _hintQueueVersion: number = 0;

    protected onLoad(): void {
        if (BoosterManager.Instance) { this.destroy(); return; }
        BoosterManager.Instance = this;
    }

    public resetForLevel(): void {
        this._hintCount = this._defaultHintCount;
        this._undoCount = this._defaultUndoCount;
        this._skipCount = this._defaultSkipCount;
        this._isHintPicking = false;
        this._queuedHintCount = 0;
        this._isHintQueueScheduled = false;
        this._hintQueueVersion++;
        this.clearUndoStack();
        this.clearHighlight();
        this.emitChanged();
    }

    public pushUndoSnapshot(): void {
        if (this._isRestoring) return;
        if (!this.canUseBoosters()) return;
        this._undoStack.push(this.captureSnapshot());
        this.emitChanged();
    }

    public UseHint(): boolean {
        if (this._hintCount <= 0 || !LevelManager.getInstance().isLevelActive()) return false;
        // Nếu không có tile nào để hint và board đã settle, không trừ item, rung nhẹ
        if (this._queuedHintCount === 0 && !this.isHintWaitingForBoardSettle()) {
            const tile = this.GetBestHintTile();
            if (!tile) {
                TileManager.getInstance().shakeAllTiles();
                EventBus.getInstance().emit(GameEvent.HINT_FAILED);
                return false;
            }
        }
        this._hintCount--;
        this._queuedHintCount++;
        this.emitChanged();
        this.processHintQueue();
        return true;
    }

    private processHintQueue(): void {
        if (this._queuedHintCount <= 0) return;
        if (this._isHintPicking) return;
        if (!LevelManager.getInstance().isLevelActive()) {
            this._queuedHintCount = 0;
            this.emitChanged();
            return;
        }
        if (this.isHintWaitingForBoardSettle()) {
            this.scheduleHintQueue();
            return;
        }

        const tile = this.GetBestHintTile();
        if (!tile) {
            this.refundQueuedHint();
            TileManager.getInstance().shakeAllTiles();
            EventBus.getInstance().emit(GameEvent.HINT_FAILED);
            this.scheduleHintQueue();
            return;
        }

        this.clearHighlight();
        let picked = TileManager.getInstance().tryClickTile(tile.id);
        if (!picked) {
            TileManager.getInstance().refreshBlockStatus();
            picked = TileManager.getInstance().tryClickTile(tile.id);
        }
        if (!picked) {
            this.refundQueuedHint();
            TileManager.getInstance().shakeAllTiles();
            EventBus.getInstance().emit(GameEvent.HINT_FAILED);
            this.scheduleHintQueue();
            return;
        }

        this._queuedHintCount--;
        this._isHintPicking = true;
        this.emitUsed(BoosterType.HINT);
        this.releaseHintPickingWhenSettled();
    }

    private scheduleHintQueue(): void {
        if (this._isHintQueueScheduled) return;
        this._isHintQueueScheduled = true;
        const version = this._hintQueueVersion;
        this.scheduleOnce(() => {
            if (version !== this._hintQueueVersion || !LevelManager.getInstance().isLevelActive()) {
                this._isHintQueueScheduled = false;
                this._queuedHintCount = 0;
                this.emitChanged();
                return;
            }
            this._isHintQueueScheduled = false;
            this.processHintQueue();
        }, 0.1);
    }

    private refundQueuedHint(): void {
        if (this._queuedHintCount <= 0) return;
        this._queuedHintCount--;
        this._hintCount++;
        this.emitChanged();
    }

    private isHintWaitingForBoardSettle(): boolean {
        return TileManager.getInstance().isInputLocked() ||
            TrayManager.getInstance().getFlyCount() > 0 ||
            TrayManager.getInstance().isClearingOrderTiles();
    }

    private releaseHintPickingWhenSettled(): void {
        const version = this._hintQueueVersion;
        this.scheduleOnce(() => {
            if (version !== this._hintQueueVersion || !LevelManager.getInstance().isLevelActive()) {
                this._isHintPicking = false;
                this.emitChanged();
                return;
            }
            if (this.isHintWaitingForBoardSettle()) {
                this.releaseHintPickingWhenSettled();
                return;
            }
            this._isHintPicking = false;
            this.emitChanged();
            this.processHintQueue();
        }, 0.08);
    }

    public GetBestHintTile(): ITileData | null {
        const level = LevelManager.getInstance().getCurrentLevel();
        const expected = OrderManager.getInstance().getExpectedItem();
        const allTiles = TileManager.getInstance().getAllTileData();
        const selectable = allTiles.filter(t => t.active && t.selectable);
        if (selectable.length === 0) return null;

        const solution = level?.solutionMoveTileIds || [];
        const solutionIndex = new Map<string, number>();
        for (let i = 0; i < solution.length; i++) solutionIndex.set(solution[i], i);

        const rankCandidates = (candidates: ITileData[]): ITileData | null => {
            if (candidates.length === 0) return null;
            candidates.sort((a, b) => {
                const ai = solutionIndex.has(a.id) ? solutionIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
                const bi = solutionIndex.has(b.id) ? solutionIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
                if (ai !== bi) return ai - bi;
                if (a.layer !== b.layer) return b.layer - a.layer;
                if (a.gridY !== b.gridY) return b.gridY - a.gridY;
                return a.gridX - b.gridX;
            });
            return candidates[0];
        };

        const trayTiles = TrayManager.getInstance().getTrayTiles();
        const freeSlots = TrayManager.getInstance().getMaxSlots() - trayTiles.length;

        if (OrderManager.getInstance().isActive()) {
            if (solution.length > 0) {
                for (const tileId of solution) {
                    const tile = allTiles.find(t => t.id === tileId);
                    if (!tile || !tile.active) continue;
                    if (!tile.selectable) return null;
                    if (tile.groupId === expected || (tile as any).strategyRole === 'required_unlocker_wrong_tile') {
                        return tile;
                    }
                    break;
                }
            }

            if (expected) {
                const expectedTile = rankCandidates(selectable.filter(t => t.groupId === expected));
                if (expectedTile) return expectedTile;
            }

            // Never suggest an off-order tile in ORDER_MATCH.
            return null;
        } else {
            const matchCount = TrayManager.getInstance().getMatchCount();
            const trayCounts: Record<string, number> = {};
            for (const tile of trayTiles) {
                trayCounts[tile.groupId] = (trayCounts[tile.groupId] || 0) + 1;
            }
            const nearMatchGroups = Object.keys(trayCounts)
                .filter(groupId => trayCounts[groupId] >= matchCount - 1);
            const completingTile = rankCandidates(
                selectable.filter(t => nearMatchGroups.indexOf(t.groupId) !== -1)
            );
            if (completingTile) return completingTile;

            if (freeSlots <= 1) return null;
        }

        if (solution.length > 0) {
            const activeSelectableById = new Map(selectable.map(t => [t.id, t]));
            const remainingBoardIds = new Set(allTiles.filter(t => t.active).map(t => t.id));

            for (const tileId of solution) {
                if (!remainingBoardIds.has(tileId)) continue;
                const tile = activeSelectableById.get(tileId);
                if (!tile) continue;
                if (!expected || tile.groupId === expected) return tile;
                break;
            }

            for (const tileId of solution) {
                const tile = activeSelectableById.get(tileId);
                if (tile) return tile;
            }
        }

        const expectedSelectable = expected
            ? selectable.filter(t => t.groupId === expected)
            : selectable;
        const candidates = expectedSelectable.length > 0 ? expectedSelectable : selectable;
        return rankCandidates(candidates);
    }

    public HighlightTile(tileId: string): void {
        this.clearHighlight();
        const node = TileManager.getInstance().getTileNode(tileId);
        const tileComp = node?.getComponent('Tile') as any;
        if (!tileComp || !tileComp.setGlow) return;

        this._highlightedTileId = tileId;
        tileComp.setGlow(true);
        this.scheduleOnce(() => {
            if (this._highlightedTileId !== tileId) return;
            this.clearHighlight();
        }, 2);
    }

    public UseUndo(): boolean {
        if (this._undoCount <= 0 || !this.canUseBoosters()) return false;
        const tray = TrayManager.getInstance();
        const snapshot = this._undoStack.pop();
        if (!snapshot) return false;

        this._isRestoring = true;
        this.clearHighlight();
        tray.cancelPendingOrderClearEffects();
        TileManager.getInstance().restoreTilesFromSnapshot(snapshot.tiles);
        tray.restoreSnapshot(snapshot.tray);
        OrderManager.getInstance().restoreSnapshot(snapshot.order);
        OrderTrayManager.getInstance()?.refreshFromOrderManager();
        if (snapshot.wrongTray) WrongTrayManager.getInstance()?.restoreSnapshot(snapshot.wrongTray);
        TileManager.getInstance().refreshBlockStatus(true);
        this._isRestoring = false;

        this._undoCount--;
        this.emitUsed(BoosterType.UNDO);
        return true;
    }

    public UseSkipLevel(): boolean {
        if (this._skipCount <= 0 || !LevelManager.getInstance().isLevelActive()) return false;
        const confirmFn = (globalThis as any).confirm;
        if (typeof confirmFn === 'function' && !confirmFn('Skip this level?')) {
            return false;
        }

        this._skipCount--;
        this.clearUndoStack();
        this.clearHighlight();
        this.emitUsed(BoosterType.SKIP);
        LevelManager.getInstance().completeLevel(true);
        return true;
    }

    public useBooster(type: BoosterType): boolean {
        switch (type) {
            case BoosterType.HINT: return this.UseHint();
            case BoosterType.UNDO: return this.UseUndo();
            case BoosterType.SKIP: return this.UseSkipLevel();
            default: return false;
        }
    }

    public addBooster(type: BoosterType, amount: number): void {
        if (type === BoosterType.HINT) this._hintCount = Math.max(0, this._hintCount + amount);
        if (type === BoosterType.UNDO) this._undoCount = Math.max(0, this._undoCount + amount);
        if (type === BoosterType.SKIP) this._skipCount = Math.max(0, this._skipCount + amount);
        this.emitChanged();
    }

    public loadInventory(data: Record<string, number>): void {
        this._hintCount = Math.max(0, Math.floor(data.HINT ?? data['3'] ?? this._hintCount));
        this._undoCount = Math.max(0, Math.floor(data.UNDO ?? data['1'] ?? this._undoCount));
        this._skipCount = Math.max(0, Math.floor(data.SKIP ?? data['6'] ?? this._skipCount));
        this.emitChanged();
    }

    public forceShuffle(): boolean {
        return false;
    }

    public clearUndoStack(): void {
        this._undoStack = [];
    }

    public getBoosterCount(type: BoosterType): number {
        switch (type) {
            case BoosterType.HINT: return this._hintCount;
            case BoosterType.UNDO: return this._undoCount;
            case BoosterType.SKIP: return this._skipCount;
            default: return 0;
        }
    }

    public hasBooster(type: BoosterType): boolean {
        return this.getBoosterCount(type) > 0;
    }

    public consumeBooster(type: BoosterType): void {
        if (type === BoosterType.HINT && this._hintCount > 0) this._hintCount--;
        if (type === BoosterType.UNDO && this._undoCount > 0) this._undoCount--;
        if (type === BoosterType.SKIP && this._skipCount > 0) this._skipCount--;
        this.emitChanged();
    }

    public setActiveBooster(type: BoosterType): void {
        this._activeBooster = type;
    }

    public getActiveBooster(): BoosterType {
        return this._activeBooster;
    }

    public hasUndoSnapshot(): boolean {
        return this._undoStack.length > 0;
    }

    public canUseBoosters(): boolean {
        return LevelManager.getInstance().isLevelActive() && !TileManager.getInstance().isInputLocked();
    }

    public canUseHint(): boolean {
        return LevelManager.getInstance().isLevelActive() && this._hintCount > 0;
    }

    public canUseUndo(): boolean {
        return LevelManager.getInstance().isLevelActive() &&
            !TileManager.getInstance().isInputLocked() &&
            this._undoCount > 0 &&
            this.hasUndoSnapshot();
    }

    public canUseSkip(): boolean {
        return LevelManager.getInstance().isLevelActive() && this._skipCount > 0;
    }

    private captureSnapshot(): IGameStateSnapshot {
        return {
            tiles: TileManager.getInstance().getAllTileData().map(t => ({ ...t })),
            tray: TrayManager.getInstance().captureSnapshot(),
            order: OrderManager.getInstance().captureSnapshot(),
            wrongTray: WrongTrayManager.getInstance()?.captureSnapshot() || null,
        };
    }

    private clearHighlight(): void {
        if (!this._highlightedTileId) return;
        const node = TileManager.getInstance().getTileNode(this._highlightedTileId);
        const tileComp = node?.getComponent('Tile') as any;
        if (tileComp && tileComp.setGlow) tileComp.setGlow(false);
        this._highlightedTileId = null;
    }

    private emitUsed(type: BoosterType): void {
        EventBus.getInstance().emit(GameEvent.BOOSTER_USED, type);
        this.emitChanged();
    }

    private emitChanged(): void {
        EventBus.getInstance().emit(GameEvent.BOOSTER_USED, BoosterType.NONE);
    }

    protected onDestroy(): void {
        if (BoosterManager.Instance === this) {
            BoosterManager.Instance = null;
        }
    }
}
