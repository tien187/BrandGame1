import { _decorator, Component, Label, Node } from 'cc';
import { BoardManager } from '../managers/BoardManager';
import { ITileData } from '../interfaces/ITileData';
import { IBoardConfig } from '../interfaces/IBoardConfig';

const { ccclass, property } = _decorator;

/**
 * BoardBlockingTest - Unit test cho board blocking logic.
 * Test overlap blocking với blockMode = "overlap".
 */
@ccclass('BoardBlockingTest')
export class BoardBlockingTest extends Component {
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

        this.testOverlapBlocking();
        this.testLayerUnblock();
        this.testSameCellBlocking();

        const summary = `\n=== BoardBlocking Test Results ===\nPASS: ${this._passCount}\nFAIL: ${this._failCount}\nTotal: ${this._passCount + this._failCount}`;
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

    private getBoardManager(): BoardManager {
        if (!BoardManager.Instance) {
            const node = new Node('TestBoard');
            node.addComponent(BoardManager);
        }
        return BoardManager.getInstance();
    }

    private testOverlapBlocking(): void {
        const bm = this.getBoardManager();
        bm.clearBoard();

        const config: IBoardConfig = {
            rows: 2, cols: 2, maxLayers: 3,
            tileSpacing: 130, tileSpacingY: 160,
            centerOffset: { x: 0, y: 0 },
            tileWidth: 100, tileHeight: 120,
            jitterX: 0, jitterY: 0, jitterMode: 'layer',
            blockMode: 'overlap', minBlockOverlapPixels: 1,
            coverThreshold: 0.3,
        };
        bm.buildBoard(config);

        // Tile A at (0,0) layer 0
        const tileA: ITileData = {
            id: 'A', groupId: 'x', tileType: 0,
            gridX: 0, gridY: 0, layer: 0,
            active: true, selectable: false, isBlocked: true,
        };
        // Tile B at (0,0) layer 1 (same cell, above)
        const tileB: ITileData = {
            id: 'B', groupId: 'x', tileType: 0,
            gridX: 0, gridY: 0, layer: 1,
            active: true, selectable: false, isBlocked: true,
        };

        bm.registerTile(tileA);
        bm.registerTile(tileB);

        // Tile B (layer 1) should NOT be blocked by A (layer 0)
        const bBlocked = bm.isTileBlocked(tileB);
        this.assert('overlapBlocking: top layer B not blocked', !bBlocked, `B blocked=${bBlocked}`);

        // Tile A (layer 0) SHOULD be blocked by B (layer 1, same cell)
        const aBlocked = bm.isTileBlocked(tileA);
        this.assert('overlapBlocking: bottom layer A blocked by B', aBlocked, `A blocked=${aBlocked}`);

        bm.clearBoard();
    }

    private testLayerUnblock(): void {
        const bm = this.getBoardManager();
        bm.clearBoard();

        const config: IBoardConfig = {
            rows: 2, cols: 2, maxLayers: 3,
            tileSpacing: 130, tileSpacingY: 160,
            centerOffset: { x: 0, y: 0 },
            tileWidth: 100, tileHeight: 120,
            jitterX: 0, jitterY: 0, jitterMode: 'layer',
            blockMode: 'overlap', minBlockOverlapPixels: 1,
            coverThreshold: 0.3,
        };
        bm.buildBoard(config);

        const tileBottom: ITileData = {
            id: 'B', groupId: 'x', tileType: 0,
            gridX: 0, gridY: 0, layer: 0,
            active: true, selectable: false, isBlocked: true,
        };
        const tileTop: ITileData = {
            id: 'T', groupId: 'x', tileType: 0,
            gridX: 0, gridY: 0, layer: 1,
            active: true, selectable: false, isBlocked: true,
        };

        bm.registerTile(tileBottom);
        bm.registerTile(tileTop);

        // Bottom is blocked by top
        this.assert('layerUnblock: bottom blocked initially', bm.isTileBlocked(tileBottom));

        // Remove top tile
        bm.unregisterTile(tileTop);

        // Bottom should now be unblocked
        this.assert('layerUnblock: bottom unblocked after top removed', !bm.isTileBlocked(tileBottom));

        bm.clearBoard();
    }

    private testSameCellBlocking(): void {
        const bm = this.getBoardManager();
        bm.clearBoard();

        const config: IBoardConfig = {
            rows: 2, cols: 2, maxLayers: 3,
            tileSpacing: 130, tileSpacingY: 160,
            centerOffset: { x: 0, y: 0 },
            tileWidth: 100, tileHeight: 120,
            jitterX: 0, jitterY: 0, jitterMode: 'layer',
            blockMode: 'overlap', minBlockOverlapPixels: 1,
            coverThreshold: 0.3,
        };
        bm.buildBoard(config);

        // Three tiles in same cell, different layers
        const t0: ITileData = { id: 't0', groupId: 'x', tileType: 0, gridX: 1, gridY: 1, layer: 0, active: true, selectable: false, isBlocked: true };
        const t1: ITileData = { id: 't1', groupId: 'x', tileType: 0, gridX: 1, gridY: 1, layer: 1, active: true, selectable: false, isBlocked: true };
        const t2: ITileData = { id: 't2', groupId: 'x', tileType: 0, gridX: 1, gridY: 1, layer: 2, active: true, selectable: false, isBlocked: true };

        bm.registerTile(t0);
        bm.registerTile(t1);
        bm.registerTile(t2);

        // t2 (top) should be selectable
        this.assert('sameCell: t2 (layer 2) not blocked', !bm.isTileBlocked(t2));
        // t1 blocked by t2
        this.assert('sameCell: t1 (layer 1) blocked by t2', bm.isTileBlocked(t1));
        // t0 blocked by t1 (and t2)
        this.assert('sameCell: t0 (layer 0) blocked', bm.isTileBlocked(t0));

        bm.clearBoard();
    }
}
