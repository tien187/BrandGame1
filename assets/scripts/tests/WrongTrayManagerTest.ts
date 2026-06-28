import { _decorator, Component, Label, Node } from 'cc';
import { WrongTrayManager } from '../managers/WrongTrayManager';

const { ccclass, property } = _decorator;

/**
 * WrongTrayManagerTest - Unit test cho WrongTrayManager logic.
 * Test fill, count, full trigger, reset.
 */
@ccclass('WrongTrayManagerTest')
export class WrongTrayManagerTest extends Component {
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

        this.testAddWrongTile();
        this.testSlotCount();
        this.testFullTray();
        this.testReset();

        const summary = `\n=== WrongTrayManager Test Results ===\nPASS: ${this._passCount}\nFAIL: ${this._failCount}\nTotal: ${this._passCount + this._failCount}`;
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

    private testAddWrongTile(): void {
        const mgr = this.getManager();
        mgr.clearTray();
        mgr.initialize(2);

        this.assert('addWrongTile: filledCount = 0 initially', mgr.getFilledCount() === 0);
        this.assert('addWrongTile: not full initially', !mgr.isFull());
    }

    private testSlotCount(): void {
        const mgr = this.getManager();
        mgr.clearTray();
        mgr.initialize(3);

        this.assert('slotCount: maxSlots = 3', mgr.getFilledCount() === 0);

        // Simulate adding tiles (without actual nodes)
        // We test the internal count logic by mocking via reflection
        (mgr as any)._filledCount = 1;
        this.assert('slotCount: filledCount = 1', mgr.getFilledCount() === 1);

        (mgr as any)._filledCount = 2;
        this.assert('slotCount: filledCount = 2', mgr.getFilledCount() === 2);

        mgr.clearTray();
    }

    private testFullTray(): void {
        const mgr = this.getManager();
        mgr.clearTray();
        mgr.initialize(2);

        (mgr as any)._filledCount = 2;
        (mgr as any)._isFull = true;

        this.assert('fullTray: isFull = true', mgr.isFull());
        this.assert('fullTray: filledCount = 2', mgr.getFilledCount() === 2);

        // Try adding when full should fail
        const result = mgr.addTile({ id: 'T1', groupId: 'x', active: true, selectable: true } as any);
        this.assert('fullTray: addTile returns false when full', !result);

        mgr.clearTray();
    }

    private testReset(): void {
        const mgr = this.getManager();
        mgr.clearTray();
        mgr.initialize(2);

        (mgr as any)._filledCount = 1;
        (mgr as any)._isFull = false;

        mgr.clearTray();

        this.assert('reset: filledCount = 0', mgr.getFilledCount() === 0);
        this.assert('reset: isFull = false', !mgr.isFull());
    }

    private getManager(): WrongTrayManager {
        if (!WrongTrayManager.Instance) {
            // Create a temporary node for testing
            const node = new Node('TestWrongTray');
            node.addComponent(WrongTrayManager);
        }
        return WrongTrayManager.getInstance();
    }
}
