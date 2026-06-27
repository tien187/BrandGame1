import { _decorator, Component, Node, Sprite, Color } from 'cc';

const { ccclass, property } = _decorator;

/**
 * TraySlot - Component đại diện cho một slot trong tray.
 * Có thể chứa tile hoặc trống. Xử lý visual highlight khi tile vào.
 */
@ccclass('TraySlot')
export class TraySlot extends Component {
    @property(Node)
    public highlightNode: Node | null = null;

    @property(Node)
    public tileAnchor: Node | null = null;

    private _isOccupied: boolean = false;
    private _slotIndex: number = 0;

    public initialize(index: number): void {
        this._slotIndex = index;
        this._isOccupied = false;
        this.setHighlight(false);
    }

    /** Đánh dấu slot đã có tile */
    public occupy(): void {
        this._isOccupied = true;
    }

    /** Đánh dấu slot trống */
    public release(): void {
        this._isOccupied = false;
    }

    /** Kiểm tra slot có trống không */
    public isEmpty(): boolean {
        return !this._isOccupied;
    }

    /** Bật/tắt hiệu ứng highlight */
    public setHighlight(active: boolean): void {
        if (this.highlightNode) {
            this.highlightNode.active = active;
        }
    }

    /** Lấy anchor node để gắn tile vào */
    public getTileAnchor(): Node | null {
        return this.tileAnchor || this.node;
    }

    public getSlotIndex(): number {
        return this._slotIndex;
    }
}
