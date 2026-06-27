import { ITileData } from '../interfaces/ITileData';
import { IOrder } from '../interfaces/IOrder';
import { IOrderConfig } from '../interfaces/IOrderConfig';
import { GameEvent } from '../enums/GameEvent';
import { EventBus } from '../core/EventBus';
import { TrayManager } from './TrayManager';
import { AudioManager } from './AudioManager';

export interface IOrderManagerSnapshot {
    currentOrderIndex: number;
    currentItemIndex: number;
    currentOrderRemainingItems: string[];
    currentOrderMatchedTileIds: string[];
    submittedTileIds: string[];
}

/**
 * OrderManager - pure singleton for ORDER_MATCH logic.
 */
export class OrderManager {
    private static _instance: OrderManager;
    private _orders: IOrder[] = [];
    private _currentOrderIndex: number = 0;
    private _currentItemIndex: number = 0;
    private _currentOrderRemainingItems: string[] = [];
    private _currentOrderMatchedTileIds: string[] = [];
    private _orderConfig: IOrderConfig | null = null;
    private _isActive: boolean = false;
    private _pendingTrayCheck: any = null;
    private _isPendingTrayCheck: boolean = false;
    private _submittedTileIds: Set<string> = new Set();
    private readonly _trayCheckDelay: number = 0.5;

    private constructor() {}

    public static getInstance(): OrderManager {
        if (!OrderManager._instance) {
            OrderManager._instance = new OrderManager();
        }
        return OrderManager._instance;
    }

    public initialize(orders: IOrder[], config: IOrderConfig): void {
        this._clearPendingTrayCheck();
        EventBus.getInstance().off(GameEvent.TILE_ADDED_TO_TRAY, this.onTileAddedToTray, this);
        EventBus.getInstance().off(GameEvent.TRAY_SETTLED, this.onTraySettled, this);
        this._orders = orders && orders.length > 0 ? [...orders] : [];
        this._orderConfig = config;
        this._currentOrderIndex = 0;
        this._currentItemIndex = 0;
        this._isActive = true;
        this._resetOrderTracking();
        this._submittedTileIds.clear();
        EventBus.getInstance().on(GameEvent.TILE_ADDED_TO_TRAY, this.onTileAddedToTray, this);
        EventBus.getInstance().on(GameEvent.TRAY_SETTLED, this.onTraySettled, this);
        EventBus.getInstance().emit(GameEvent.ORDER_CHANGED, this.getCurrentOrder(), this._currentOrderIndex);
    }

    private _resetOrderTracking(): void {
        this._currentOrderMatchedTileIds = [];
        const order = this.getCurrentOrder();
        if (!order) {
            this._currentItemIndex = 0;
            this._currentOrderRemainingItems = [];
            return;
        }
        if (this._orderConfig?.orderMode === 'ANY_ORDER') {
            this._currentOrderRemainingItems = [...order.items];
        } else {
            this._currentItemIndex = 0;
            this._currentOrderRemainingItems = [];
        }
    }

    private onTraySettled(): void {
        if (!this._isActive) return;
        const order = this.getCurrentOrder();
        if (!order) return;

        const trayTiles = TrayManager.getInstance().getSettledTrayTiles();
        const matchedTiles = this.findOrderMatchInTray(order, trayTiles);
        if (matchedTiles) {
            this.completeOrderFromMatchedTiles(order, matchedTiles);
            return;
        }

        for (const tile of trayTiles) {
            if (this._submittedTileIds.has(tile.id)) continue;
            const result = this.submitTile(tile);
            if (result.orderComplete) return;
        }
    }

    private onTileAddedToTray(tileData: ITileData): void {
        if (!this._isActive) return;
        const order = this.getCurrentOrder();
        this.onTraySettled();
        if (!order) return;
        // Không xử lý order ở đây nữa; chỉ dùng để UI/other listener còn nhận event
    }

    public getCurrentOrder(): IOrder | null {
        if (!this._isActive || this._currentOrderIndex >= this._orders.length) return null;
        return this._orders[this._currentOrderIndex];
    }

    public getExpectedItem(): string | null {
        const order = this.getCurrentOrder();
        if (!order) return null;
        if (this._orderConfig?.orderMode === 'ANY_ORDER') {
            return this._currentOrderRemainingItems[0] || null;
        }
        if (this._currentItemIndex >= order.items.length) return null;
        return order.items[this._currentItemIndex];
    }

    public getCurrentItemIndex(): number {
        return this._currentItemIndex;
    }

    public getOrderConfig(): IOrderConfig | null {
        return this._orderConfig;
    }

    public submitTile(tileData: ITileData): { correct: boolean; orderComplete: boolean } {
        if (this._submittedTileIds.has(tileData.id)) {
            return { correct: false, orderComplete: false };
        }
        const order = this.getCurrentOrder();
        if (!order) return { correct: false, orderComplete: false };
        this._submittedTileIds.add(tileData.id);

        if (this._orderConfig?.orderMode === 'ANY_ORDER') {
            const remIdx = this._currentOrderRemainingItems.indexOf(tileData.groupId);
            if (remIdx !== -1) {
                this._currentOrderRemainingItems.splice(remIdx, 1);
                this._currentOrderMatchedTileIds.push(tileData.id);
                const orderComplete = this._currentOrderRemainingItems.length === 0;

                EventBus.getInstance().emit(GameEvent.ORDER_ITEM_CORRECT, tileData, this._currentOrderMatchedTileIds.length - 1);

                if (orderComplete) {
                    this.completeCurrentOrder(this._currentOrderMatchedTileIds);
                } else {
                    EventBus.getInstance().emit(GameEvent.ORDER_CHANGED, this.getCurrentOrder(), this._currentOrderIndex);
                }

                return { correct: true, orderComplete };
            }
        } else {
            const expected = this.getExpectedItem();
            if (expected && tileData.groupId === expected) {
                this._currentItemIndex++;
                this._currentOrderMatchedTileIds.push(tileData.id);
                const orderComplete = this._currentItemIndex >= order.items.length;

                EventBus.getInstance().emit(GameEvent.ORDER_ITEM_CORRECT, tileData, this._currentItemIndex - 1);

                if (orderComplete) {
                    this.completeCurrentOrder(this._currentOrderMatchedTileIds);
                } else {
                    EventBus.getInstance().emit(GameEvent.ORDER_CHANGED, this.getCurrentOrder(), this._currentOrderIndex);
                }

                return { correct: true, orderComplete };
            }
        }

        EventBus.getInstance().emit(GameEvent.ORDER_ITEM_WRONG, tileData);
        console.log(`[OM_DEBUG] WRONG tile=${tileData.id}:${tileData.groupId} expected=${this.getExpectedItem()}`);
        return { correct: false, orderComplete: false };
    }

    /**
     * Find tiles that complete an order in the tray.
     * EXACT_ORDER requires left-to-right order only; matched tiles do not have to be adjacent.
     * ANY_ORDER takes the earliest tray tiles that satisfy the order item multiset.
     */
    public findOrderMatchInTray(order: IOrder, trayTiles: ITileData[]): ITileData[] | null {
        if (!order || !trayTiles || trayTiles.length < order.items.length) return null;

        if (this._orderConfig?.orderMode === 'ANY_ORDER') {
            const remaining = [...order.items];
            const matched: ITileData[] = [];
            for (const tile of trayTiles) {
                const idx = remaining.indexOf(tile.groupId);
                if (idx === -1) continue;
                remaining.splice(idx, 1);
                matched.push(tile);
                if (remaining.length === 0) return matched;
            }
            return null;
        }

        const matched: ITileData[] = [];
        let itemIndex = 0;
        for (const tile of trayTiles) {
            if (tile.groupId !== order.items[itemIndex]) continue;
            matched.push(tile);
            itemIndex++;
            if (itemIndex >= order.items.length) return matched;
        }
        return null;
    }

    private completeOrderFromMatchedTiles(order: IOrder, matchedTiles: ITileData[]): void {
        const matchedTileIds = matchedTiles.map(t => t.id);
        this._currentOrderMatchedTileIds = matchedTileIds;

        for (let i = 0; i < matchedTiles.length; i++) {
            EventBus.getInstance().emit(GameEvent.ORDER_ITEM_CORRECT, matchedTiles[i], i);
        }

        if (this._orderConfig?.orderMode === 'ANY_ORDER') {
            this._currentOrderRemainingItems = [];
        } else {
            this._currentItemIndex = order.items.length;
        }

        this.completeCurrentOrder(matchedTileIds);
        AudioManager.getInstance().playSfx('sfx_click');
    }

    public completeCurrentOrder(tileIds?: string[]): void {
        const completedOrder = this.getCurrentOrder();
        console.log(`[OM_DEBUG] completeCurrentOrder index=${this._currentOrderIndex}/${this._orders.length} orderId=${completedOrder?.id || '?'} tileIds=${tileIds?.join(',') || 'none'}`);
        EventBus.getInstance().emit(GameEvent.ORDER_COMPLETED, completedOrder, this._currentOrderIndex, tileIds);

        this._currentOrderIndex++;
        this._currentItemIndex = 0;
        this._submittedTileIds.clear();

        if (this._currentOrderIndex >= this._orders.length) {
            console.log(`[OM_DEBUG] emitting ALL_ORDERS_COMPLETED index=${this._currentOrderIndex}/${this._orders.length}`);
            EventBus.getInstance().emit(GameEvent.ALL_ORDERS_COMPLETED);
        } else {
            this._resetOrderTracking();
            EventBus.getInstance().emit(GameEvent.ORDER_CHANGED, this.getCurrentOrder(), this._currentOrderIndex);
            this._clearPendingTrayCheck();
            this._isPendingTrayCheck = true;
            this._pendingTrayCheck = setTimeout(() => {
                this._isPendingTrayCheck = false;
                this._pendingTrayCheck = null;
                this.checkTrayMatchCurrentOrder();
            }, this._trayCheckDelay * 1000);
        }
    }

    private checkTrayMatchCurrentOrder(): void {
        const order = this.getCurrentOrder();
        if (!order) return;

        const trayTiles = TrayManager.getInstance().getSettledTrayTiles();
        const matchedTiles = this.findOrderMatchInTray(order, trayTiles);
        if (matchedTiles) this.completeOrderFromMatchedTiles(order, matchedTiles);
    }

    public isAllOrdersCompleted(): boolean {
        return this._currentOrderIndex >= this._orders.length;
    }

    public getTotalOrders(): number {
        return this._orders.length;
    }

    public getCurrentOrderIndex(): number {
        return this._currentOrderIndex;
    }

    public getAllOrders(): IOrder[] {
        return [...this._orders];
    }

    public isActive(): boolean {
        return this._isActive;
    }

    public clear(): void {
        this._clearPendingTrayCheck();
        EventBus.getInstance().off(GameEvent.TILE_ADDED_TO_TRAY, this.onTileAddedToTray, this);
        EventBus.getInstance().off(GameEvent.TRAY_SETTLED, this.onTraySettled, this);
        this._orders = [];
        this._orderConfig = null;
        this._currentOrderIndex = 0;
        this._currentItemIndex = 0;
        this._currentOrderRemainingItems = [];
        this._currentOrderMatchedTileIds = [];
        this._submittedTileIds.clear();
        this._isActive = false;
    }

    private _clearPendingTrayCheck(): void {
        if (this._pendingTrayCheck) {
            clearTimeout(this._pendingTrayCheck);
            this._pendingTrayCheck = null;
        }
        this._isPendingTrayCheck = false;
    }

    public isPendingTrayCheck(): boolean {
        return this._isPendingTrayCheck;
    }

    public captureSnapshot(): IOrderManagerSnapshot {
        return {
            currentOrderIndex: this._currentOrderIndex,
            currentItemIndex: this._currentItemIndex,
            currentOrderRemainingItems: [...this._currentOrderRemainingItems],
            currentOrderMatchedTileIds: [...this._currentOrderMatchedTileIds],
            submittedTileIds: Array.from(this._submittedTileIds),
        };
    }

    public restoreSnapshot(snapshot: IOrderManagerSnapshot): void {
        this._clearPendingTrayCheck();
        this._currentOrderIndex = snapshot.currentOrderIndex;
        this._currentItemIndex = snapshot.currentItemIndex;
        this._currentOrderRemainingItems = [...snapshot.currentOrderRemainingItems];
        this._currentOrderMatchedTileIds = [...snapshot.currentOrderMatchedTileIds];
        this._submittedTileIds = new Set(snapshot.submittedTileIds);
        EventBus.getInstance().emit(GameEvent.ORDER_CHANGED, this.getCurrentOrder(), this._currentOrderIndex);
    }

    public syncWithSettledTray(): void {
        this.onTraySettled();
    }

    public static reset(): void {
        if (OrderManager._instance) {
            OrderManager._instance.clear();
        }
        OrderManager._instance = null;
    }
}
