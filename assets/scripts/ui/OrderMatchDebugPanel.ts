import { _decorator, Component, Label, Button, Node, EventHandler, tween } from 'cc';
import { OrderManager } from '../managers/OrderManager';
import { WrongTrayManager } from '../managers/WrongTrayManager';
import { GameEvent } from '../enums/GameEvent';
import { EventBus } from '../core/EventBus';
import { LevelManager } from '../managers/LevelManager';
import { TileManager } from '../managers/TileManager';

const { ccclass, property } = _decorator;

/**
 * OrderMatchDebugPanel - Debug UI cho ORDER_MATCH mode.
 * Hiển thị current order, expected item, wrong tray count,
 * và nút auto-play solution moves.
 */
@ccclass('OrderMatchDebugPanel')
export class OrderMatchDebugPanel extends Component {
    @property(Label)
    public orderIdLabel: Label | null = null;

    @property(Label)
    public expectedItemLabel: Label | null = null;

    @property(Label)
    public wrongTrayLabel: Label | null = null;

    @property(Label)
    public progressLabel: Label | null = null;

    @property(Button)
    public autoPlayButton: Button | null = null;

    @property(Button)
    public nextMoveButton: Button | null = null;

    private _solutionIds: string[] = [];
    private _autoPlayIndex: number = 0;
    private _isAutoPlaying: boolean = false;

    protected onLoad(): void {
        EventBus.getInstance().on(GameEvent.ORDER_CHANGED, this.onOrderChanged, this);
        EventBus.getInstance().on(GameEvent.ORDER_COMPLETED, this.onOrderCompleted, this);
        EventBus.getInstance().on(GameEvent.ALL_ORDERS_COMPLETED, this.onAllOrdersCompleted, this);
        EventBus.getInstance().on(GameEvent.ORDER_ITEM_WRONG, this.onOrderItemWrong, this);
        EventBus.getInstance().on(GameEvent.LEVEL_LOADED, this.onLevelLoaded, this);
    }

    private onLevelLoaded(): void {
        this._isAutoPlaying = false;
        this._autoPlayIndex = 0;

        const level = LevelManager.getInstance().getCurrentLevel?.();
        if (level?.solutionMoveTileIds) {
            this._solutionIds = [...level.solutionMoveTileIds];
        } else {
            this._solutionIds = [];
        }

        this.updateUI();
    }

    private onOrderChanged(order: any, orderIndex: number): void {
        this.updateUI();
    }

    private onOrderCompleted(order: any, orderIndex: number): void {
        this.updateUI();
    }

    private onAllOrdersCompleted(): void {
        this.updateUI();
        this.orderIdLabel && (this.orderIdLabel.string = 'ALL ORDERS DONE!');
        this.expectedItemLabel && (this.expectedItemLabel.string = '-');
    }

    private onOrderItemWrong(): void {
        this.updateUI();
    }

    private updateUI(): void {
        const mgr = OrderManager.getInstance();
        if (!mgr.isActive()) {
            if (this.orderIdLabel) this.orderIdLabel.string = 'N/A';
            if (this.expectedItemLabel) this.expectedItemLabel.string = '-';
            if (this.wrongTrayLabel) this.wrongTrayLabel.string = '0/0';
            if (this.progressLabel) this.progressLabel.string = '-';
            return;
        }

        const currentOrder = mgr.getCurrentOrder();
        const orderIdx = mgr.getCurrentOrderIndex();
        const totalOrders = mgr.getTotalOrders();
        const expected = mgr.getExpectedItem();
        const itemIdx = mgr.getCurrentItemIndex();
        const config = mgr.getOrderConfig();

        if (this.orderIdLabel) {
            this.orderIdLabel.string = currentOrder
                ? `${currentOrder.id} (${orderIdx + 1}/${totalOrders})`
                : 'Done';
        }

        if (this.expectedItemLabel) {
            this.expectedItemLabel.string = expected ?? '-';
        }

        if (this.progressLabel) {
            const orderSize = config?.orderSize ?? 3;
            this.progressLabel.string = currentOrder
                ? `Item ${itemIdx + 1}/${orderSize}`
                : '-';
        }

        const wrongMgr = WrongTrayManager.getInstance();
        if (this.wrongTrayLabel && wrongMgr) {
            const filled = wrongMgr.getFilledCount();
            const maxSlots = config?.wrongTrayMaxSlots ?? 2;
            this.wrongTrayLabel.string = `${filled}/${maxSlots}`;
        }
    }

    /** Auto-play từng move theo solutionMoveTileIds */
    public onAutoPlayClicked(): void {
        if (this._isAutoPlaying || this._solutionIds.length === 0) return;
        this._isAutoPlaying = true;
        this._autoPlayIndex = 0;
        this.playNextAutoMove();
    }

    /** Play 1 move tiếp theo trong solution */
    public onNextMoveClicked(): void {
        if (this._autoPlayIndex >= this._solutionIds.length) return;
        this.playSingleMove(this._solutionIds[this._autoPlayIndex]);
        this._autoPlayIndex++;
    }

    private playNextAutoMove(): void {
        if (!this._isAutoPlaying) return;
        if (this._autoPlayIndex >= this._solutionIds.length) {
            this._isAutoPlaying = false;
            console.log('[OrderMatchDebugPanel] Auto-play complete');
            return;
        }

        this.playSingleMove(this._solutionIds[this._autoPlayIndex]);
        this._autoPlayIndex++;

        // Schedule next move
        this.scheduleOnce(() => this.playNextAutoMove(), 0.4);
    }

    private playSingleMove(tileId: string): void {
        const tileData = TileManager.getInstance().getTileData(tileId);
        if (!tileData || !tileData.active || !tileData.selectable) {
            console.warn(`[OrderMatchDebugPanel] Cannot play move: tile ${tileId} not selectable`);
            return;
        }
        EventBus.getInstance().emit(GameEvent.TILE_CLICKED, tileData);
    }

    protected onDestroy(): void {
        EventBus.getInstance().off(GameEvent.ORDER_CHANGED, this.onOrderChanged, this);
        EventBus.getInstance().off(GameEvent.ORDER_COMPLETED, this.onOrderCompleted, this);
        EventBus.getInstance().off(GameEvent.ALL_ORDERS_COMPLETED, this.onAllOrdersCompleted, this);
        EventBus.getInstance().off(GameEvent.ORDER_ITEM_WRONG, this.onOrderItemWrong, this);
        EventBus.getInstance().off(GameEvent.LEVEL_LOADED, this.onLevelLoaded, this);
    }
}
