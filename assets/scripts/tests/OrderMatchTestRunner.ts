import { _decorator, Component, Label, Node } from 'cc';
import { OrderManager } from '../managers/OrderManager';
import { WrongTrayManager } from '../managers/WrongTrayManager';
import { BoardManager } from '../managers/BoardManager';
import { LevelValidator } from './LevelValidator';
import { DataLoader } from '../core/DataLoader';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../enums/GameEvent';
import { ITileData } from '../interfaces/ITileData';
import { IBoardConfig } from '../interfaces/IBoardConfig';

const { ccclass, property } = _decorator;

interface ITestResult {
    name: string;
    pass: boolean;
    msg?: string;
}

/**
 * OrderMatchTestRunner - Gộp tất cả test cases vào 1 component.
 * Attach vào 1 node duy nhất, chạy tất cả test khi start.
 */
@ccclass('OrderMatchTestRunner')
export class OrderMatchTestRunner extends Component {
    @property(Label)
    public resultLabel: Label | null = null;

    @property
    public levelId: number = 22;

    @property
    public runOrderManagerTests: boolean = true;

    @property
    public runWrongTrayTests: boolean = true;

    @property
    public runBoardBlockingTests: boolean = true;

    @property
    public runValidatorTests: boolean = true;

    private _results: ITestResult[] = [];

    protected async start(): Promise<void> {
        await this.runAllTests();
    }

    private async runAllTests(): Promise<void> {
        this._results = [];

        if (this.runOrderManagerTests) this.runOrderManagerTests_();
        if (this.runWrongTrayTests) this.runWrongTrayTests_();
        if (this.runBoardBlockingTests) this.runBoardBlockingTests_();
        if (this.runValidatorTests) await this.runValidatorTests_();

        this.printResults();
    }

    private addResult(name: string, pass: boolean, msg?: string): void {
        this._results.push({ name, pass, msg });
    }

    private printResults(): void {
        const passCount = this._results.filter(r => r.pass).length;
        const failCount = this._results.filter(r => !r.pass).length;

        const lines: string[] = [];
        lines.push('=== ORDER_MATCH TEST RESULTS ===');

        for (const r of this._results) {
            const status = r.pass ? '[PASS]' : '[FAIL]';
            lines.push(`${status} ${r.name}${r.msg ? ': ' + r.msg : ''}`);
        }

        lines.push(`\nTotal: ${this._results.length} | Pass: ${passCount} | Fail: ${failCount}`);

        const output = lines.join('\n');
        console.log(output);

        if (this.resultLabel) {
            this.resultLabel.string = output;
        }
    }

    // ===== ORDER MANAGER TESTS =====

    private runOrderManagerTests_(): void {
        this.testLoadOrders();
        this.testExactOrderCorrect();
        this.testExactOrderNonConsecutiveTrayMatch();
        this.testExactOrderWrong();
        this.testAnyOrderCorrect();
        this.testCompleteOrderAdvances();
        this.testAllOrdersCompleted();
        this.testConsumeWrongTileFalse();
    }

    private setupExactOrder(): OrderManager {
        OrderManager.reset();
        const mgr = OrderManager.getInstance();
        mgr.initialize([
            { id: 'order_001', items: ['lamp', 'vase', 'plant'] },
            { id: 'order_002', items: ['clock', 'basket', 'cushion'] },
        ] as any, {
            orderSize: 3, orderMode: 'EXACT_ORDER', wrongTrayMaxSlots: 2, consumeWrongTile: true,
        } as any);
        return mgr;
    }

    private setupAnyOrder(): OrderManager {
        OrderManager.reset();
        const mgr = OrderManager.getInstance();
        mgr.initialize([
            { id: 'order_001', items: ['lamp', 'vase', 'plant'] },
        ] as any, {
            orderSize: 3, orderMode: 'ANY_ORDER', wrongTrayMaxSlots: 2, consumeWrongTile: true,
        } as any);
        return mgr;
    }

    private testLoadOrders(): void {
        const mgr = this.setupExactOrder();
        this.addResult('OrderManager.loadOrders', mgr.getTotalOrders() === 2 && mgr.isActive());
        mgr.clear();
    }

    private testExactOrderCorrect(): void {
        const mgr = this.setupExactOrder();
        const t = (gid: string) => ({ id: `T_${gid}`, groupId: gid, active: true, selectable: true });

        const r1 = mgr.submitTile(t('lamp') as any);
        const r2 = mgr.submitTile(t('vase') as any);
        const r3 = mgr.submitTile(t('plant') as any);

        const pass = r1.correct && !r1.orderComplete
            && r2.correct && !r2.orderComplete
            && r3.correct && r3.orderComplete
            && mgr.getCurrentOrder()?.id === 'order_002';

        this.addResult('OrderManager.exactOrderCorrect', pass);
        mgr.clear();
    }

    private testExactOrderNonConsecutiveTrayMatch(): void {
        const mgr = this.setupExactOrder();
        const trayTiles = [
            { id: 'T1', groupId: 'lamp', active: true, selectable: true },
            { id: 'T_X1', groupId: 'clock', active: true, selectable: true },
            { id: 'T2', groupId: 'vase', active: true, selectable: true },
            { id: 'T_X2', groupId: 'basket', active: true, selectable: true },
            { id: 'T3', groupId: 'plant', active: true, selectable: true },
        ];

        const matched = mgr.findOrderMatchInTray(mgr.getCurrentOrder() as any, trayTiles as any);
        this.addResult(
            'OrderManager.exactOrderNonConsecutiveTrayMatch',
            !!matched && matched.map(t => t.id).join(',') === 'T1,T2,T3'
        );
        mgr.clear();
    }

    private testExactOrderWrong(): void {
        const mgr = this.setupExactOrder();
        const t = (gid: string) => ({ id: `T_${gid}`, groupId: gid, active: true, selectable: true });

        mgr.submitTile(t('lamp') as any);
        const r2 = mgr.submitTile(t('plant') as any);

        const pass = !r2.correct
            && mgr.getCurrentItemIndex() === 1
            && mgr.getExpectedItem() === 'vase';

        this.addResult('OrderManager.exactOrderWrong', pass);
        mgr.clear();
    }

    private testAnyOrderCorrect(): void {
        const mgr = this.setupAnyOrder();
        const t = (gid: string) => ({ id: `T_${gid}`, groupId: gid, active: true, selectable: true });

        const r1 = mgr.submitTile(t('plant') as any);
        const r2 = mgr.submitTile(t('lamp') as any);
        const r3 = mgr.submitTile(t('vase') as any);

        this.addResult('OrderManager.anyOrderCorrect',
            r1.correct && r2.correct && r3.correct && r3.orderComplete && mgr.isAllOrdersCompleted());
        mgr.clear();
    }

    private testCompleteOrderAdvances(): void {
        const mgr = this.setupExactOrder();
        const t = (gid: string) => ({ id: `T_${gid}`, groupId: gid, active: true, selectable: true });

        mgr.submitTile(t('lamp') as any);
        mgr.submitTile(t('vase') as any);
        mgr.submitTile(t('plant') as any);

        this.addResult('OrderManager.completeOrderAdvances',
            mgr.getCurrentOrderIndex() === 1 && mgr.getCurrentOrder()?.id === 'order_002');
        mgr.clear();
    }

    private testAllOrdersCompleted(): void {
        const mgr = this.setupExactOrder();
        const t = (gid: string) => ({ id: `T_${gid}`, groupId: gid, active: true, selectable: true });

        ['lamp', 'vase', 'plant'].forEach(g => mgr.submitTile(t(g) as any));
        ['clock', 'basket', 'cushion'].forEach(g => mgr.submitTile(t(g) as any));

        this.addResult('OrderManager.allOrdersCompleted',
            mgr.isAllOrdersCompleted() && mgr.getCurrentOrder() === null);
        mgr.clear();
    }

    private testConsumeWrongTileFalse(): void {
        OrderManager.reset();
        const mgr = OrderManager.getInstance();
        mgr.initialize([
            { id: 'order_001', items: ['lamp', 'vase', 'plant'] },
        ] as any, {
            orderSize: 3, orderMode: 'EXACT_ORDER', wrongTrayMaxSlots: 2, consumeWrongTile: false,
        } as any);

        const r = mgr.submitTile({ id: 'T1', groupId: 'clock', active: true, selectable: true } as any);
        this.addResult('OrderManager.consumeWrongTileFalse', !r.correct && mgr.getOrderConfig()?.consumeWrongTile === false);
        mgr.clear();
    }

    // ===== WRONG TRAY TESTS =====

    private runWrongTrayTests_(): void {
        this.testWrongTrayAdd();
        this.testWrongTrayFull();
        this.testWrongTrayReset();
    }

    private getWrongTrayMgr(): WrongTrayManager {
        if (!WrongTrayManager.Instance) {
            const node = new Node('TestWrongTray');
            node.addComponent(WrongTrayManager);
        }
        return WrongTrayManager.getInstance();
    }

    private testWrongTrayAdd(): void {
        const mgr = this.getWrongTrayMgr();
        mgr.clearTray();
        mgr.initialize(2);
        this.addResult('WrongTray.add', mgr.getFilledCount() === 0 && !mgr.isFull());
        mgr.clearTray();
    }

    private testWrongTrayFull(): void {
        const mgr = this.getWrongTrayMgr();
        mgr.clearTray();
        mgr.initialize(2);
        (mgr as any)._filledCount = 2;
        (mgr as any)._isFull = true;
        this.addResult('WrongTray.full', mgr.isFull() && mgr.getFilledCount() === 2);
        mgr.clearTray();
    }

    private testWrongTrayReset(): void {
        const mgr = this.getWrongTrayMgr();
        mgr.clearTray();
        mgr.initialize(2);
        (mgr as any)._filledCount = 1;
        mgr.clearTray();
        this.addResult('WrongTray.reset', mgr.getFilledCount() === 0 && !mgr.isFull());
    }

    // ===== BOARD BLOCKING TESTS =====

    private runBoardBlockingTests_(): void {
        this.testOverlapBlocking();
        this.testLayerUnblock();
        this.testSameCellBlocking();
    }

    private getBoardMgr(): BoardManager {
        if (!BoardManager.Instance) {
            const node = new Node('TestBoard');
            node.addComponent(BoardManager);
        }
        return BoardManager.getInstance();
    }

    private testOverlapBlocking(): void {
        const bm = this.getBoardMgr();
        bm.clearBoard();
        const config: IBoardConfig = {
            rows: 2, cols: 2, maxLayers: 3,
            tileSpacing: 130, tileSpacingY: 160,
            centerOffset: { x: 0, y: 0 },
            tileWidth: 100, tileHeight: 120,
            jitterX: 0, jitterY: 0, jitterMode: 'layer',
            blockMode: 'overlap', minBlockOverlapPixels: 1, coverThreshold: 0.3,
        };
        bm.buildBoard(config);

        const tileA: ITileData = { id: 'A', groupId: 'x', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: false, isBlocked: true };
        const tileB: ITileData = { id: 'B', groupId: 'x', tileType: 0, gridX: 0, gridY: 0, layer: 1, active: true, selectable: false, isBlocked: true };
        bm.registerTile(tileA);
        bm.registerTile(tileB);

        this.addResult('Board.overlapBlocking',
            !bm.isTileBlocked(tileB) && bm.isTileBlocked(tileA));
        bm.clearBoard();
    }

    private testLayerUnblock(): void {
        const bm = this.getBoardMgr();
        bm.clearBoard();
        const config: IBoardConfig = {
            rows: 2, cols: 2, maxLayers: 3,
            tileSpacing: 130, tileSpacingY: 160,
            centerOffset: { x: 0, y: 0 },
            tileWidth: 100, tileHeight: 120,
            jitterX: 0, jitterY: 0, jitterMode: 'layer',
            blockMode: 'overlap', minBlockOverlapPixels: 1, coverThreshold: 0.3,
        };
        bm.buildBoard(config);

        const bottom: ITileData = { id: 'B', groupId: 'x', tileType: 0, gridX: 0, gridY: 0, layer: 0, active: true, selectable: false, isBlocked: true };
        const top: ITileData = { id: 'T', groupId: 'x', tileType: 0, gridX: 0, gridY: 0, layer: 1, active: true, selectable: false, isBlocked: true };
        bm.registerTile(bottom);
        bm.registerTile(top);

        const before = bm.isTileBlocked(bottom);
        bm.unregisterTile(top);
        const after = !bm.isTileBlocked(bottom);

        this.addResult('Board.layerUnblock', before && after);
        bm.clearBoard();
    }

    private testSameCellBlocking(): void {
        const bm = this.getBoardMgr();
        bm.clearBoard();
        const config: IBoardConfig = {
            rows: 2, cols: 2, maxLayers: 3,
            tileSpacing: 130, tileSpacingY: 160,
            centerOffset: { x: 0, y: 0 },
            tileWidth: 100, tileHeight: 120,
            jitterX: 0, jitterY: 0, jitterMode: 'layer',
            blockMode: 'overlap', minBlockOverlapPixels: 1, coverThreshold: 0.3,
        };
        bm.buildBoard(config);

        const t0: ITileData = { id: 't0', groupId: 'x', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: false, isBlocked: true };
        const t1: ITileData = { id: 't1', groupId: 'x', tileType: 0, gridX: 1, gridY: 1, layer: 1, active: true, selectable: false, isBlocked: true };
        const t2: ITileData = { id: 't2', groupId: 'x', tileType: 0, gridX: 1, gridY: 1, layer: 2, active: true, selectable: false, isBlocked: true };
        bm.registerTile(t0);
        bm.registerTile(t1);
        bm.registerTile(t2);

        this.addResult('Board.sameCellBlocking',
            !bm.isTileBlocked(t2) && bm.isTileBlocked(t1) && bm.isTileBlocked(t0));
        bm.clearBoard();
    }

    // ===== LEVEL VALIDATOR TESTS =====

    private async runValidatorTests_(): Promise<void> {
        const paddedId = this.levelId < 10 ? `00${this.levelId}` : this.levelId < 100 ? `0${this.levelId}` : `${this.levelId}`;
        const path = `data/levels/level_${paddedId}`;
        const levelData = await DataLoader.loadJson<any>(path);

        if (!levelData) {
            this.addResult('Validator.load', false, `Failed to load level ${this.levelId}`);
            return;
        }

        const result = LevelValidator.validate(levelData);
        this.addResult('Validator.level', result.valid, result.errors.join('; '));
    }
}
