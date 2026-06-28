import { _decorator, Component, Label } from 'cc';
import { OrderManager } from '../managers/OrderManager';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../enums/GameEvent';

const { ccclass, property } = _decorator;

interface ITestOrder {
    id: string;
    items: string[];
}

interface ITestOrderConfig {
    orderSize: number;
    orderMode: 'EXACT_ORDER' | 'ANY_ORDER';
    wrongTrayMaxSlots: number;
    consumeWrongTile: boolean;
}

interface ITestTileData {
    id: string;
    groupId: string;
    active: boolean;
    selectable: boolean;
}

/**
 * OrderManagerTest - Unit test cho OrderManager.
 * Chạy tất cả test cases và log kết quả.
 */
@ccclass('OrderManagerTest')
export class OrderManagerTest extends Component {
    @property(Label)
    public resultLabel: Label | null = null;

    private _results: string[] = [];
    private _passCount: number = 0;
    private _failCount: number = 0;

    protected start(): void {
        this.runAllTests();
    }

    private runAllTests(): void {
        this._results = [];
        this._passCount = 0;
        this._failCount = 0;

        this.testLoadOrders();
        this.testGetCurrentOrder();
        this.testGetExpectedItem();
        this.testExactOrderCorrect();
        this.testExactOrderNonConsecutiveTrayMatch();
        this.testExactOrderWrong();
        this.testAnyOrderCorrect();
        this.testCompleteOrderAdvances();
        this.testAllOrdersCompleted();
        this.testConsumeWrongTileFalse();

        const summary = `\n=== OrderManager Test Results ===\nPASS: ${this._passCount}\nFAIL: ${this._failCount}\nTotal: ${this._passCount + this._failCount}`;
        this._results.push(summary);

        const output = this._results.join('\n');
                if (this.resultLabel) {
            this.resultLabel.string = output;
        }
    }

    private assert(name: string, condition: boolean, msg?: string): void {
        if (condition) {
            this._passCount++;
            this._results.push(`[PASS] ${name}`);
        } else {
            this._failCount++;
            this._results.push(`[FAIL] ${name}${msg ? ': ' + msg : ''}`);
        }
    }

    private setupExactOrder(): void {
        OrderManager.reset();
        const orders: ITestOrder[] = [
            { id: 'order_001', items: ['lamp', 'vase', 'plant'] },
            { id: 'order_002', items: ['clock', 'basket', 'cushion'] },
        ];
        const config: ITestOrderConfig = {
            orderSize: 3,
            orderMode: 'EXACT_ORDER',
            wrongTrayMaxSlots: 2,
            consumeWrongTile: true,
        };
        OrderManager.getInstance().initialize(orders as any, config as any);
    }

    private setupAnyOrder(): void {
        OrderManager.reset();
        const orders: ITestOrder[] = [
            { id: 'order_001', items: ['lamp', 'vase', 'plant'] },
        ];
        const config: ITestOrderConfig = {
            orderSize: 3,
            orderMode: 'ANY_ORDER',
            wrongTrayMaxSlots: 2,
            consumeWrongTile: true,
        };
        OrderManager.getInstance().initialize(orders as any, config as any);
    }

    // ===== TESTS =====

    private testLoadOrders(): void {
        this.setupExactOrder();
        const mgr = OrderManager.getInstance();
        this.assert('loadOrders: total orders = 2', mgr.getTotalOrders() === 2);
        this.assert('loadOrders: isActive = true', mgr.isActive());
        mgr.clear();
    }

    private testGetCurrentOrder(): void {
        this.setupExactOrder();
        const mgr = OrderManager.getInstance();
        const order = mgr.getCurrentOrder();
        this.assert('getCurrentOrder: id = order_001', order?.id === 'order_001');
        this.assert('getCurrentOrder: items[0] = lamp', order?.items[0] === 'lamp');
        mgr.clear();
    }

    private testGetExpectedItem(): void {
        this.setupExactOrder();
        const mgr = OrderManager.getInstance();
        this.assert('getExpectedItem: lamp', mgr.getExpectedItem() === 'lamp');
        mgr.clear();
    }

    private testExactOrderCorrect(): void {
        this.setupExactOrder();
        const mgr = OrderManager.getInstance();

        // lamp -> vase -> plant = complete order
        const tileLamp: ITestTileData = { id: 'T1', groupId: 'lamp', active: true, selectable: true };
        const tileVase: ITestTileData = { id: 'T2', groupId: 'vase', active: true, selectable: true };
        const tilePlant: ITestTileData = { id: 'T3', groupId: 'plant', active: true, selectable: true };

        const r1 = mgr.submitTile(tileLamp as any);
        this.assert('exactOrder: lamp correct', r1.correct && !r1.orderComplete);
        this.assert('exactOrder: index = 1 after lamp', mgr.getCurrentItemIndex() === 1);
        this.assert('exactOrder: expected = vase', mgr.getExpectedItem() === 'vase');

        const r2 = mgr.submitTile(tileVase as any);
        this.assert('exactOrder: vase correct', r2.correct && !r2.orderComplete);
        this.assert('exactOrder: index = 2 after vase', mgr.getCurrentItemIndex() === 2);

        const r3 = mgr.submitTile(tilePlant as any);
        this.assert('exactOrder: plant correct + orderComplete', r3.correct && r3.orderComplete);
        this.assert('exactOrder: next order = order_002', mgr.getCurrentOrder()?.id === 'order_002');

        mgr.clear();
    }

    private testExactOrderNonConsecutiveTrayMatch(): void {
        this.setupExactOrder();
        const mgr = OrderManager.getInstance();
        const trayTiles: ITestTileData[] = [
            { id: 'T1', groupId: 'lamp', active: true, selectable: true },
            { id: 'T_X1', groupId: 'clock', active: true, selectable: true },
            { id: 'T2', groupId: 'vase', active: true, selectable: true },
            { id: 'T_X2', groupId: 'basket', active: true, selectable: true },
            { id: 'T3', groupId: 'plant', active: true, selectable: true },
        ];

        const matched = mgr.findOrderMatchInTray(mgr.getCurrentOrder() as any, trayTiles as any);
        this.assert(
            'exactOrderNonConsecutiveTrayMatch: lamp/vase/plant matched across gaps',
            !!matched && matched.map(t => t.id).join(',') === 'T1,T2,T3'
        );

        mgr.clear();
    }

    private testExactOrderWrong(): void {
        this.setupExactOrder();
        const mgr = OrderManager.getInstance();

        // lamp -> plant = wrong
        const tileLamp: ITestTileData = { id: 'T1', groupId: 'lamp', active: true, selectable: true };
        const tilePlant: ITestTileData = { id: 'T3', groupId: 'plant', active: true, selectable: true };

        mgr.submitTile(tileLamp as any);
        const r2 = mgr.submitTile(tilePlant as any);
        this.assert('exactOrderWrong: plant is wrong after lamp', !r2.correct);
        this.assert('exactOrderWrong: index stays 1', mgr.getCurrentItemIndex() === 1);
        this.assert('exactOrderWrong: expected still vase', mgr.getExpectedItem() === 'vase');

        mgr.clear();
    }

    private testAnyOrderCorrect(): void {
        this.setupAnyOrder();
        const mgr = OrderManager.getInstance();

        const tileLamp: ITestTileData = { id: 'T1', groupId: 'lamp', active: true, selectable: true };
        const tileVase: ITestTileData = { id: 'T2', groupId: 'vase', active: true, selectable: true };
        const tilePlant: ITestTileData = { id: 'T3', groupId: 'plant', active: true, selectable: true };

        // plant -> lamp -> vase
        const r1 = mgr.submitTile(tilePlant as any);
        this.assert('anyOrder: plant correct', r1.correct && !r1.orderComplete);

        const r2 = mgr.submitTile(tileLamp as any);
        this.assert('anyOrder: lamp correct', r2.correct && !r2.orderComplete);

        const r3 = mgr.submitTile(tileVase as any);
        this.assert('anyOrder: vase correct + orderComplete', r3.correct && r3.orderComplete);

        mgr.clear();
    }

    private testCompleteOrderAdvances(): void {
        this.setupExactOrder();
        const mgr = OrderManager.getInstance();

        // Complete order 1
        mgr.submitTile({ id: 'T1', groupId: 'lamp', active: true, selectable: true } as any);
        mgr.submitTile({ id: 'T2', groupId: 'vase', active: true, selectable: true } as any);
        mgr.submitTile({ id: 'T3', groupId: 'plant', active: true, selectable: true } as any);

        this.assert('completeOrderAdvances: currentOrderIndex = 1', mgr.getCurrentOrderIndex() === 1);
        this.assert('completeOrderAdvances: currentOrder id = order_002', mgr.getCurrentOrder()?.id === 'order_002');

        mgr.clear();
    }

    private testAllOrdersCompleted(): void {
        this.setupExactOrder();
        const mgr = OrderManager.getInstance();

        // Complete all orders
        const items1 = ['lamp', 'vase', 'plant'];
        const items2 = ['clock', 'basket', 'cushion'];
        for (const gid of items1) {
            mgr.submitTile({ id: `T_${gid}`, groupId: gid, active: true, selectable: true } as any);
        }
        for (const gid of items2) {
            mgr.submitTile({ id: `T_${gid}`, groupId: gid, active: true, selectable: true } as any);
        }

        this.assert('allOrdersCompleted: isAllOrdersCompleted = true', mgr.isAllOrdersCompleted());
        this.assert('allOrdersCompleted: getCurrentOrder = null', mgr.getCurrentOrder() === null);

        mgr.clear();
    }

    private testConsumeWrongTileFalse(): void {
        OrderManager.reset();
        const orders: ITestOrder[] = [
            { id: 'order_001', items: ['lamp', 'vase', 'plant'] },
        ];
        const config: ITestOrderConfig = {
            orderSize: 3,
            orderMode: 'EXACT_ORDER',
            wrongTrayMaxSlots: 2,
            consumeWrongTile: false,
        };
        OrderManager.getInstance().initialize(orders as any, config as any);
        const mgr = OrderManager.getInstance();

        const tileWrong: ITestTileData = { id: 'T_WRONG', groupId: 'clock', active: true, selectable: true };
        const r = mgr.submitTile(tileWrong as any);
        this.assert('consumeWrongTileFalse: wrong tile rejected', !r.correct);
        // Tile should NOT be consumed from board (tested via onTileClicked logic)
        this.assert('consumeWrongTileFalse: config consumeWrongTile = false', mgr.getOrderConfig()?.consumeWrongTile === false);

        mgr.clear();
    }
}
