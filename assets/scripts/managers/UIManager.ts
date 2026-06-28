import { _decorator, Component, Node, instantiate, Prefab, Label, Color, UITransform } from 'cc';
import { UIPanelType } from '../enums/UIPanelType';
import { SkinManager } from './SkinManager';
import { BasePanel } from '../ui/BasePanel';

const { ccclass, property } = _decorator;

/**
 * UIManager - Quản lý vòng đời UI panels: open, close, stack, overlay.
 * Load prefab panels qua SkinManager để hỗ trợ reskin.
 * Không chứa logic gameplay, chỉ quản lý UI flow.
 */
@ccclass('UIManager')
export class UIManager extends Component {
    public static Instance: UIManager;
    public static getInstance(): UIManager { return UIManager.Instance; }

    @property(Node)
    public uiRoot: Node | null = null;

    @property(Node)
    public popupLayer: Node | null = null;

    @property(Node)
    public overlayLayer: Node | null = null;

    private _panelMap: Map<string, BasePanel> = new Map();
    private _panelStack: string[] = [];
    private _prefabCache: Map<string, Prefab> = new Map();
    private _loadingNode: Node | null = null;

    protected onLoad(): void {
        if (UIManager.Instance) { this.destroy(); return; }
        UIManager.Instance = this;
    }

    /** Khởi tạo với UI root node */
    public initialize(uiRoot: Node | null): void {
        this.uiRoot = uiRoot || this.node;
    }

    /** Mở panel theo tên */
    public async openPanel(panelName: string, data?: any): Promise<BasePanel | null> {
        if (this._panelMap.has(panelName)) {
            const panel = this._panelMap.get(panelName)!;
            panel.show(data);
            if (this._panelStack.indexOf(panelName) === -1) {
                this._panelStack.push(panelName);
            }
            return panel;
        }

        const prefab = await SkinManager.getInstance().getPanelPrefab(panelName);
        if (!prefab) {
            return null;
        }
        if (!this.uiRoot) {
            return null;
        }

        const node = instantiate(prefab);
        node.layer = this.popupLayer?.layer ?? this.uiRoot.layer;
        node.setParent(this.popupLayer || this.uiRoot);
        node.setPosition(0, 0, 0);

        const panel = node.getComponent(BasePanel);
        if (panel) {
            panel.initialize(this);
            panel.show(data);
            this._panelMap.set(panelName, panel);
            this._panelStack.push(panelName);
            return panel;
        }

        return null;
    }

    /** Đóng panel theo tên */
    public closePanel(panelName: string): void {
        const panel = this._panelMap.get(panelName);
        if (panel) {
            panel.hide();
            // Có thể destroy hoặc chỉ hide tùy chiến lược
        }

        const index = this._panelStack.indexOf(panelName);
        if (index !== -1) {
            this._panelStack.splice(index, 1);
        }
    }

    /** Đóng panel hiện tại */
    public closeCurrentPanel(): void {
        const current = this._panelStack.pop();
        if (current) {
            this.closePanel(current);
        }
    }

    /** Đóng tất cả panels */
    public closeAllPanels(): void {
        this._panelMap.forEach(panel => panel.hide());
        this._panelStack = [];
    }

    /** Lấy panel đang mở */
    public getOpenPanel(panelName: string): BasePanel | undefined {
        return this._panelMap.get(panelName);
    }

    /** Kiểm tra panel đang mở */
    public isPanelOpen(panelName: string): boolean {
        return this._panelMap.has(panelName) && this._panelMap.get(panelName)!.isVisible();
    }

    /** Hiển thị loading overlay (tạo programmatically) */
    public showLoading(message: string = 'Loading...'): void {
        if (this._loadingNode) return;

        const overlay = new Node('LoadingOverlay');
        overlay.layer = this.uiRoot?.layer ?? this.node.layer;
        overlay.addComponent(UITransform);

        const labelNode = new Node('LoadingLabel');
        labelNode.layer = overlay.layer;
        labelNode.addComponent(UITransform);
        const label = labelNode.addComponent(Label);
        label.string = message;
        label.fontSize = 72;
        label.color = new Color(255, 220, 50, 255);
        labelNode.setParent(overlay);

        const parent = this.popupLayer || this.uiRoot || this.node;
        overlay.setParent(parent);
        overlay.setPosition(0, 0, 999);

        this._loadingNode = overlay;
    }

    /** Ẩn loading overlay */
    public hideLoading(): void {
        if (this._loadingNode) {
            this._loadingNode.destroy();
            this._loadingNode = null;
        }
    }

    protected onDestroy(): void {
        if (UIManager.Instance === this) {
            UIManager.Instance = null;
        }
    }
}
