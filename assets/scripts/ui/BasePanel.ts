import { _decorator, Component, Node, tween, Vec3 } from 'cc';
import { UIManager } from '../managers/UIManager';

const { ccclass, property } = _decorator;

/**
 * BasePanel - Lớp cơ sở cho mọi UI panel.
 * Quản lý show/hide, animation, data binding.
 * Các panel cụ thể kế thừa và override.
 */
@ccclass('BasePanel')
export class BasePanel extends Component {
    @property(Node)
    public contentNode: Node | null = null;

    @property(Node)
    public backgroundBlocker: Node | null = null;

    protected _uiManager: UIManager | null = null;
    protected _isVisible: boolean = false;
    protected _panelData: any = null;

    /** Gán UIManager reference */
    public initialize(uiManager: UIManager): void {
        this._uiManager = uiManager;
    }

    /** Hiển thị panel kèm data */
    public show(data?: any): void {
        this._panelData = data;
        this.node.active = true;
        this._isVisible = true;
        this.onShow(data);
    }

    /** Ẩn panel */
    public hide(): void {
        this.onHide();
        this._isVisible = false;
        this.node.active = false;
    }

    /** Trạng thái visible */
    public isVisible(): boolean {
        return this._isVisible;
    }

    /** Callback khi show - override ở lớp con */
    protected onShow(data?: any): void {
        // Override in child
        this.playShowAnimation();
    }

    /** Callback khi hide - override ở lớp con */
    protected onHide(): void {
        // Override in child
        this.playHideAnimation();
    }

    /** Animation khi show - zoom scale nhe tu 0 len 1 */
    protected playShowAnimation(): void {
        if (this.contentNode) {
            this.contentNode.setScale(0, 0, 1);
            tween(this.contentNode)
                .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
        }
    }

    /** Animation khi hide */
    protected playHideAnimation(): void {
        // Override nếu cần animation out
    }

    /** Đóng panel (gọi từ UI Manager) */
    protected closePanel(): void {
        if (this._uiManager) {
            this._uiManager.closePanel(this.node.name);
        }
    }
}
