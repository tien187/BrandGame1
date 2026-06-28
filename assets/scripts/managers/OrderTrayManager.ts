import { _decorator, Component, Node, Vec3, tween, Sprite, Color, UITransform, Tween, Graphics, UIOpacity, instantiate } from 'cc';
import { IOrder } from '../interfaces/IOrder';
import { IOrderConfig } from '../interfaces/IOrderConfig';
import { ITileData } from '../interfaces/ITileData';
import { GameEvent } from '../enums/GameEvent';
import { EventBus } from '../core/EventBus';
import { SkinManager } from './SkinManager';
import { ConfigManager } from '../core/ConfigManager';
import { PoolManager } from '../core/PoolManager';
import { OrderManager } from './OrderManager';

const { ccclass, property } = _decorator;

interface IOrderSlot {
    index: number;
    orderIndex: number;
    itemIndex: number;
    position: Vec3;
    expectedItem: string;
    filledNode: Node | null;
    previewNode: Node | null;
    bgNode: Node | null;
}

/**
 * OrderTrayManager - Hiển thị tray cho current order.
 * Mỗi slot hiển thị item icon và highlight slot tiếp theo.
 */
@ccclass('OrderTrayManager')
export class OrderTrayManager extends Component {
    public static Instance: OrderTrayManager;
    public static getInstance(): OrderTrayManager | null {
        if (OrderTrayManager.Instance && OrderTrayManager.Instance.node && OrderTrayManager.Instance.node.isValid) {
            return OrderTrayManager.Instance;
        }
        return null;
    }

    @property(Node)
    public trayContainer: Node | null = null;

    @property
    public slotSpacing: number = 120;

    @property
    public flyDuration: number = 0.3;

    @property
    public slotScale: number = 0.8;

    @property
    public orderSpacingY: number = 40;

    @property(Color)
    public highlightColor: Color = new Color(255, 220, 50, 255);

    @property(Color)
    public emptySlotColor: Color = new Color(200, 200, 200, 180);

    @property(Color)
    public dimmedColor: Color = new Color(200, 200, 200, 80);

    @property(Node)
    public orderPanelTemplate: Node | null = null;

    @property
    public currentOrderPanelScale: number = 1;

    @property
    public lowerOrderPanelScale: number = 0.85;

    @property(Color)
    public lowerOrderPanelColor: Color = new Color(120, 120, 120, 255);

    @property
    public currentToLowerSpacingY: number = 70;

    @property
    public lowerToLowerSpacingY: number = 40;

    @property(Color)
    public lowerSlotColor: Color = new Color(120, 120, 120, 255);

    private _slots: IOrderSlot[] = [];
    private _orderPanelMap: Map<number, Node> = new Map();
    private _allOrders: IOrder[] = [];
    private _currentOrder: IOrder | null = null;
    private _orderConfig: IOrderConfig | null = null;
    private _filledCount: number = 0;
    private _isClearing: boolean = false;
    private _lastOrderIndex: number = -1; // index trong danh sách hiển thị (sau khi cắt còn lại)
    private _lastGlobalOrderIndex: number = -1; // index toàn cục từ OrderManager để phát hiện chuyển order
    private _orderStartMap: Map<number, number> = new Map();
    private _visibleStartOrder: number = 0;
    private _consumeEffectWorldPos: Vec3 | null = null;
    private _isTransitioning: boolean = false;
    private _pendingTransition: boolean = false;

    protected onLoad(): void {
        if (OrderTrayManager.Instance) { this.destroy(); return; }
        OrderTrayManager.Instance = this;

        EventBus.getInstance().on(GameEvent.ORDER_CHANGED, this.onOrderChanged, this);
        EventBus.getInstance().on(GameEvent.ORDER_ITEM_CORRECT, this.onOrderItemCorrect, this);
        EventBus.getInstance().on(GameEvent.ORDER_COMPLETED, this.onOrderCompleted, this);
        EventBus.getInstance().on(GameEvent.ALL_ORDERS_COMPLETED, this.onAllOrdersCompleted, this);
        EventBus.getInstance().on(GameEvent.LEVEL_LOADED, this.onLevelLoaded, this);
    }

    private onLevelLoaded(): void {
        this.clearTray();
    }

    private onAllOrdersCompleted(): void {
        if (this._consumeEffectWorldPos) return;
        if (this._isClearing) return;
        this.clearTray();
    }

    public initialize(orders: IOrder[], currentOrder: IOrder | null, config: IOrderConfig | null): void {
                this._allOrders = orders && orders.length > 0 ? [...orders] : [];
        this._currentOrder = currentOrder;
        this._orderConfig = config;
        this._filledCount = 0;
        this._isClearing = false;
        this._lastOrderIndex = this._allOrders.length > 0 ? 0 : -1;
        this._orderStartMap.clear();
        this._visibleStartOrder = 0;
        this.buildSlots();
    }

    private onOrderChanged(order: IOrder | null, orderIndex: number): void {
        this._currentOrder = order;

        // Nếu chưa đổi sang order khác (orderIndex toàn cục không đổi) thì chỉ cập nhật scale
        if (orderIndex === this._lastGlobalOrderIndex && this._slots.length > 0) {
            if (!this._isClearing && !this._isTransitioning) {
                this.updateSlotStates();
            }
            return;
        }

        // Ghi nhận orderIndex toàn cục mới
        this._lastGlobalOrderIndex = orderIndex;
        this._filledCount = 0;
        if (this._isClearing || this._isTransitioning) {
            return;
        }

        // Nếu tile đang bay vào order cũ, hoãn transition cho đến khi effect xong
        if (this._consumeEffectWorldPos) {
            this._pendingTransition = true;
            return;
        }

        this.playOrderTransitionAnimation();
    }

    private onOrderItemCorrect(tileData: ITileData, itemIndex: number): void {
        const globalIndex = (this._orderStartMap.get(this._lastOrderIndex) ?? 0) + itemIndex;
        this.fillSlot(globalIndex, tileData);
    }

    private onOrderCompleted(order: IOrder | null, orderIndex: number): void {
        // Xóa order vừa hoàn thành khỏi UI ngay, chỉ giữ lại các order còn lại
        this.playOrderConsumeAnimation();
        
        // Sau complete, OrderManager đã tăng current index
    }

    /** Tính order index đầu tiên trong viewport (tối đa 3 order) */
    private getVisibleStartOrder(): number {
        const total = this._allOrders.length;
        if (total <= 3) return 0;
        return Math.min(this._lastOrderIndex, total - 3);
    }

    /** Xây dựng slot UI cho tối đa 3 order gần nhất, xếp từ trên xuống */
    private buildSlots(): void {
                this.clearVisuals();
        this._slots = [];
        this._orderStartMap.clear();

        if (this._allOrders.length === 0) {
            return;
        }

        this.ensureContainer();
        const visibleStart = this.getVisibleStartOrder();
        this._visibleStartOrder = visibleStart;
        const visibleCount = Math.min(3, this._allOrders.length - visibleStart);

        const spacings: number[] = [];
        for (let i = 0; i < visibleCount - 1; i++) {
            spacings.push(i === 0 ? this.currentToLowerSpacingY : this.lowerToLowerSpacingY);
        }
        const totalSpacing = spacings.reduce((a, b) => a + b, 0);
        const startY = totalSpacing / 2;

        let slotIdx = 0;
        let orderY = startY;
        for (let vi = 0; vi < visibleCount; vi++) {
            const oi = visibleStart + vi;
            const order = this._allOrders[oi];
            this._orderStartMap.set(oi, slotIdx);

            const itemCount = order.items.length;
            const startX = -(itemCount - 1) * this.slotSpacing / 2;
            const centerX = startX + (itemCount - 1) * this.slotSpacing / 2;

            // Tạo panel nền riêng cho order, các slot sẽ là child của panel
            const panel = this.createOrderPanel(oi, centerX, orderY);

            for (let ii = 0; ii < itemCount; ii++) {
                const pos = panel
                    ? new Vec3(startX + ii * this.slotSpacing - centerX, 0, 0)
                    : new Vec3(startX + ii * this.slotSpacing, orderY, 0);
                const slot = this.createSlot(slotIdx, oi, ii, pos, order.items[ii], panel);
                this._slots.push(slot);
                slotIdx++;
            }

            if (vi < visibleCount - 1) {
                orderY -= spacings[vi];
            }
        }

        this.updateSlotStates();
    }

    /** Rebuild UI từ danh sách order còn lại trong OrderManager (bắt đầu từ current index) */
    private rebuildFromManager(): void {
        const mgr = OrderManager.getInstance();
        const all = mgr.getAllOrders();
        const curIdx = mgr.getCurrentOrderIndex();
        this._consumeEffectWorldPos = null;
        this._pendingTransition = false;
        this._isTransitioning = false;
        this._isClearing = false;
        this._allOrders = all.slice(curIdx);
        this._currentOrder = mgr.getCurrentOrder();
        this._orderConfig = mgr.getOrderConfig();
        // Sau khi cắt còn lại, current luôn là index 0 trong UI
        this._lastOrderIndex = 0;
        this._lastGlobalOrderIndex = curIdx;
        this._visibleStartOrder = 0;
        this._orderStartMap.clear();
        this._filledCount = 0;
        this.buildSlots();
    }

    public refreshFromOrderManager(): void {
        this.rebuildFromManager();
    }

    /** Cập nhật scale: order đang focus được zoom lớn hơn, các order khác thu nhỏ */
    private updateSlotStates(): void {
        const currentOrderIdx = this._lastOrderIndex;

        for (const slot of this._slots) {
            if (!slot.bgNode || !slot.bgNode.isValid) continue;

            const isCurrentOrder = slot.orderIndex === currentOrderIdx;
            slot.bgNode.setScale(this.slotScale, this.slotScale, 1);
            this.setPreviewOpacity(slot.previewNode, 255);
            this.setPreviewColor(slot.previewNode, isCurrentOrder ? Color.WHITE : this.lowerSlotColor);

            if (slot.previewNode && slot.previewNode.isValid) {
                slot.previewNode.setScale(0.9, 0.9, 1);
            }
        }

        this.updatePanelStates();
        this.updatePanelDepth();
    }

    private setPreviewOpacity(previewNode: Node | null, opacity: number): void {
        if (!previewNode || !previewNode.isValid) return;

        const uiOpacity = previewNode.getComponent(UIOpacity) || previewNode.addComponent(UIOpacity);
        uiOpacity.opacity = opacity;
    }

    private setPreviewColor(previewNode: Node | null, color: Color): void {
        if (!previewNode || !previewNode.isValid) return;
        const safeColor = this.cloneColorOrWhite(color);

        const sprite = previewNode.getComponent(Sprite);
        if (sprite) {
            sprite.color = safeColor;
            return;
        }

        // Nếu node chính không có Sprite, tìm trong children
        for (const child of previewNode.children) {
            const childSprite = child.getComponent(Sprite);
            if (childSprite) {
                childSprite.color = safeColor;
                return;
            }
        }
    }

    private setPanelOpacity(panel: Node | null, opacity: number): void {
        if (!panel || !panel.isValid) return;

        const uiOpacity = panel.getComponent(UIOpacity) || panel.addComponent(UIOpacity);
        uiOpacity.opacity = opacity;
    }

    private updatePanelStates(): void {
        const currentOrderIdx = this._lastOrderIndex;
        for (const [orderIndex, panel] of this._orderPanelMap.entries()) {
            if (!panel || !panel.isValid) continue;

            const isCurrentOrder = orderIndex === currentOrderIdx;
            const scale = isCurrentOrder ? this.currentOrderPanelScale : this.lowerOrderPanelScale;
            const color = isCurrentOrder ? Color.WHITE : this.lowerOrderPanelColor;

            panel.setScale(scale, scale, 1);
            this.setPanelColor(panel, color);
            this.setPanelOpacity(panel, 255);
        }
    }

    private setPanelColor(panel: Node | null, color: Color): void {
        if (!panel || !panel.isValid) return;
        const safeColor = this.cloneColorOrWhite(color);

        const sprite = panel.getComponent(Sprite);
        if (sprite) {
            sprite.color = safeColor;
            return;
        }

        // Nếu panel chính không có Sprite, tìm trong children
        for (const child of panel.children) {
            const childSprite = child.getComponent(Sprite);
            if (childSprite) {
                childSprite.color = safeColor;
                return;
            }
        }
    }

    /** Đưa panel của current order lên trên cùng */
    private updatePanelDepth(): void {
        const panels = Array.from(this._orderPanelMap.entries())
            .filter(([_, panel]) => panel && panel.isValid)
            .sort((a, b) => b[0] - a[0]);

        for (let i = 0; i < panels.length; i++) {
            panels[i][1].setSiblingIndex(i);
        }
    }

    private createSlot(index: number, orderIndex: number, itemIndex: number, position: Vec3, expectedItem: string, parentNode: Node | null): IOrderSlot {
                const container = parentNode || this.trayContainer!;

        // Background node cho slot (không có Graphics, chỉ dùng để định vị/scale)
        const bgNode = new Node(`SlotBg_${index}`);
        bgNode.layer = container.layer;
        const bgUITransform = bgNode.addComponent(UITransform);
        bgUITransform.setContentSize(100, 100);
        bgNode.setParent(container);
        bgNode.setPosition(position);
        bgNode.setScale(this.slotScale, this.slotScale, 1);

        // Preview icon (expected item) — spawn từ prefab tile_default
        const prefabKey = SkinManager.getInstance().getTilePrefabKey('default');
        let previewNode: Node | null = PoolManager.getInstance().get(prefabKey);
        if (previewNode) {
            previewNode.name = `SlotPreview_${index}`;
            previewNode.layer = container.layer;
            previewNode.setParent(bgNode);
            previewNode.setPosition(0, 0, 0);
            previewNode.setScale(0.9, 0.9, 1);

            // Reset sprite cũ để tránh hiển thị icon của lần dùng trước khi applyTileSkin async chạy
            const visualNode = previewNode.getChildByName('visual');
            const sprite = visualNode?.getComponent(Sprite) || previewNode.getComponentInChildren(Sprite);
            if (sprite) {
                sprite.spriteFrame = null;
            }

            // Remove Tile component để không bị click
            const tileComp = previewNode.getComponent('Tile') as Component;
            if (tileComp) tileComp.destroy();

            const skinId = SkinManager.getInstance().getCurrentSkin()?.skinId || 'uma';
            SkinManager.getInstance().applyTileSkin(previewNode, `${skinId}/${expectedItem}`);
        } else {
            // Fallback nếu prefab chưa load
            previewNode = new Node(`SlotPreview_${index}`);
            previewNode.layer = container.layer;
            previewNode.addComponent(UITransform);
            const fallbackSprite = previewNode.addComponent(Sprite);
            fallbackSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            previewNode.setParent(bgNode);
            previewNode.setPosition(0, 0, 0);
            previewNode.setScale(0.9, 0.9, 1);
        }

        return {
            index,
            orderIndex,
            itemIndex,
            position: position.clone(),
            expectedItem,
            filledNode: null,
            previewNode,
            bgNode,
        };
    }

    /** Đảm bảo container tồn tại */
    private ensureContainer(): void {
        if (this.trayContainer) return;

        this.trayContainer = new Node('OrderTrayContainer');
        this.trayContainer.layer = this.node.layer;
        this.trayContainer.addComponent(UITransform);
        this.trayContainer.setParent(this.node);
        this.trayContainer.setPosition(0, 0, 0);
    }

    private createOrderPanel(orderIndex: number, centerX: number, centerY: number): Node | null {
        if (!this.orderPanelTemplate || !this.orderPanelTemplate.isValid) return null;
        if (!this.trayContainer || !this.trayContainer.isValid) return null;

        const panel = instantiate(this.orderPanelTemplate);
        panel.name = `OrderPanel_${orderIndex}`;
        panel.layer = this.trayContainer.layer;
        panel.setParent(this.trayContainer);
        panel.setPosition(centerX, centerY, 0);
        this._orderPanelMap.set(orderIndex, panel);
        return panel;
    }

    /** Fill một slot: chỉ animate UI preview (không bay tile thật) */
    private fillSlot(itemIndex: number, tileData: ITileData): void {
        if (itemIndex < 0 || itemIndex >= this._slots.length) return;
        const slot = this._slots[itemIndex];
        if (!slot || !slot.bgNode) return;

        this._filledCount++;

        // Animate preview icon: scale bounce
        if (slot.previewNode && slot.previewNode.isValid) {
            tween(slot.previewNode)
                .to(0.1, { scale: new Vec3(1.2, 1.2, 1) })
                .to(0.1, { scale: new Vec3(0.9, 0.9, 1) })
                .start();
        }

        slot.filledNode = slot.previewNode; // đánh dấu đã fill
    }

    /** Animation khi order hoàn thành: glow các slot của order vừa xong */
    public getCurrentOrderEffectWorldPosition(): Vec3 | null {
        const currentSlots = this._slots.filter(slot =>
            slot.orderIndex === this._lastOrderIndex &&
            slot.bgNode &&
            slot.bgNode.isValid
        );
        if (currentSlots.length === 0) {
            if (this._consumeEffectWorldPos) {
                return this._consumeEffectWorldPos.clone();
            }
            return this.trayContainer && this.trayContainer.isValid
                ? this.trayContainer.getWorldPosition()
                : null;
        }

        const center = new Vec3();
        for (const slot of currentSlots) {
            const worldPos = slot.bgNode!.getWorldPosition();
            center.x += worldPos.x;
            center.y += worldPos.y;
            center.z += worldPos.z;
        }
        center.x /= currentSlots.length;
        center.y /= currentSlots.length;
        center.z /= currentSlots.length;
        return center;
    }

    private playOrderConsumeAnimation(): void {
        // Order UI đứng yên, chỉ lưu vị trí để tile bay đến
        this._consumeEffectWorldPos = this.getCurrentOrderEffectWorldPosition();
    }

    public hideCurrentOrderConsumeEffect(): void {
        this._consumeEffectWorldPos = null;
        if (OrderManager.getInstance().isAllOrdersCompleted()) {
            this.clearTray();
            return;
        }
        if (this._pendingTransition) {
            this._pendingTransition = false;
            this.playOrderTransitionAnimation();
        }
    }

    public cancelPendingTransitionForRestore(): void {
        this._consumeEffectWorldPos = null;
        this._pendingTransition = false;
        this._isTransitioning = false;
        this._isClearing = false;
    }

    private playOrderTransitionAnimation(): void {
        if (this._isTransitioning) return;
        this._isTransitioning = true;

        const sortedPanels = Array.from(this._orderPanelMap.entries())
            .filter(([_, panel]) => panel && panel.isValid)
            .sort((a, b) => a[0] - b[0]);

        const oldPanel = sortedPanels[0]?.[1] ?? null;

        if (!oldPanel) {
            this._isTransitioning = false;
            this.rebuildFromManager();
            return;
        }

        // Phase 1: panel cũ scale nhanh về 0
        const shrinkDuration = 0.2;
        Tween.stopAllByTarget(oldPanel);
        const uiOpacity = oldPanel.getComponent(UIOpacity) || oldPanel.addComponent(UIOpacity);
        tween(oldPanel)
            .parallel(
                tween(oldPanel).to(shrinkDuration, { scale: new Vec3(0, 0, 1) }),
                tween(uiOpacity).to(shrinkDuration, { opacity: 0 })
            )
            .call(() => {
                if (oldPanel && oldPanel.isValid) oldPanel.active = false;
                this.animatePanelsUp();
            })
            .start();
    }

    private animatePanelsUp(): void {
        const duration = 0.3;
        const sortedPanels = Array.from(this._orderPanelMap.entries())
            .filter(([_, panel]) => panel && panel.isValid)
            .sort((a, b) => a[0] - b[0]);

        const panel1 = sortedPanels[1]?.[1] ?? null;
        const panel2 = sortedPanels[2]?.[1] ?? null;
        const maxKey = sortedPanels.length > 0 ? sortedPanels[sortedPanels.length - 1][0] : -1;
        const nextOrderIndex = maxKey + 1;

        let panel3: Node | null = null;
        if (nextOrderIndex < this._allOrders.length) {
            const order = this._allOrders[nextOrderIndex];
            const itemCount = order.items.length;
            const startX = -(itemCount - 1) * this.slotSpacing / 2;
            const centerX = startX + (itemCount - 1) * this.slotSpacing / 2;
            const panel2Pos = panel2 ? panel2.getPosition() : new Vec3(0, -this.currentToLowerSpacingY - this.lowerToLowerSpacingY, 0);
            const newY = panel2Pos.y - this.lowerToLowerSpacingY;
            panel3 = this.createOrderPanel(nextOrderIndex, centerX, newY);
            if (panel3) {
                panel3.setSiblingIndex(0); // nằm dưới cùng để không đè lên các panel khác
                panel3.setScale(0, 0, 1);
                this.setPanelOpacity(panel3, 0);
                for (let ii = 0; ii < itemCount; ii++) {
                    const pos = new Vec3(startX + ii * this.slotSpacing - centerX, 0, 0);
                    const slot = this.createSlot(this._slots.length, nextOrderIndex, ii, pos, order.items[ii], panel3);
                    this._slots.push(slot);
                }
                const sprite3 = this.getPanelSprite(panel3);
                if (sprite3) sprite3.color = this.lowerOrderPanelColor;
                const slots3 = this._slots.filter(s => s.orderIndex === nextOrderIndex);
                for (const slot of slots3) {
                    this.setPreviewColor(slot.previewNode, this.lowerSlotColor);
                }
            }
        }

        let pendingAnimations = 0;
        const onAnimComplete = () => {
            pendingAnimations--;
            if (pendingAnimations <= 0) {
                this._isTransitioning = false;
                this.rebuildFromManager();
            }
        };

        if (panel1) pendingAnimations++;
        if (panel2) pendingAnimations++;
        if (panel3) pendingAnimations++;

        if (pendingAnimations === 0) {
            this._isTransitioning = false;
            this.rebuildFromManager();
            return;
        }

        // Panel 1 chạy lên + scale to + sáng màu
        if (panel1 && panel1.isValid) {
            Tween.stopAllByTarget(panel1);
            // Đưa panel lên trên cùng trong suốt animation để không bị panel khác che khi scale to
            panel1.setSiblingIndex(this.trayContainer!.children.length - 1);
            const currentPos = panel1.getPosition();
            const targetPos = new Vec3(currentPos.x, currentPos.y + this.currentToLowerSpacingY, currentPos.z);
            const panelSprite = this.getPanelSprite(panel1);
            const panelColor = panelSprite ? panelSprite.color : this.lowerOrderPanelColor;

            tween(panel1)
                .parallel(
                    tween(panel1).to(duration, { position: targetPos }),
                    tween(panel1).to(duration, { scale: new Vec3(this.currentOrderPanelScale, this.currentOrderPanelScale, 1) })
                )
                .call(onAnimComplete)
                .start();

            if (panelSprite) {
                this.tweenColor(panelSprite, panelColor, Color.WHITE, duration);
            }

            const slots1 = this._slots.filter(s => s.orderIndex === sortedPanels[1][0]);
            for (const slot of slots1) {
                const previewSprite = this.getNodeSprite(slot.previewNode);
                if (previewSprite) {
                    this.tweenColor(previewSprite, previewSprite.color, Color.WHITE, duration);
                }
            }
        }

        // Panel 2 chạy lên
        if (panel2 && panel2.isValid) {
            Tween.stopAllByTarget(panel2);
            const currentPos = panel2.getPosition();
            const targetPos = new Vec3(currentPos.x, currentPos.y + this.lowerToLowerSpacingY, currentPos.z);
            tween(panel2)
                .to(duration, { position: targetPos })
                .call(onAnimComplete)
                .start();
        }

        // Panel 3 mới xuất hiện: scale từ 0 + chạy lên
        if (panel3 && panel3.isValid) {
            const currentPos = panel3.getPosition();
            const targetPos = new Vec3(currentPos.x, currentPos.y + this.lowerToLowerSpacingY, currentPos.z);
            const panelSprite = this.getPanelSprite(panel3);
            const panelColor = panelSprite ? panelSprite.color : this.lowerOrderPanelColor;

            tween(panel3)
                .parallel(
                    tween(panel3).to(duration, { position: targetPos }),
                    tween(panel3).to(duration, { scale: new Vec3(this.lowerOrderPanelScale, this.lowerOrderPanelScale, 1) })
                )
                .call(onAnimComplete)
                .start();

            if (panelSprite) {
                this.tweenColor(panelSprite, panelColor, this.lowerOrderPanelColor, duration);
            }

            const uiOpacity = panel3.getComponent(UIOpacity) || panel3.addComponent(UIOpacity);
            tween(uiOpacity).to(duration, { opacity: 255 }).start();
        }
    }

    private getPanelSprite(panel: Node): Sprite | null {
        const sprite = panel.getComponent(Sprite);
        if (sprite) return sprite;
        for (const child of panel.children) {
            const childSprite = child.getComponent(Sprite);
            if (childSprite) return childSprite;
        }
        return null;
    }

    private getNodeSprite(node: Node): Sprite | null {
        const sprite = node.getComponent(Sprite);
        if (sprite) return sprite;
        for (const child of node.children) {
            const childSprite = child.getComponent(Sprite);
            if (childSprite) return childSprite;
        }
        return null;
    }

    private tweenColor(sprite: Sprite, from: Color, to: Color, duration: number): void {
        if (!sprite || !sprite.node || !sprite.node.isValid) return;
        const fromColor = this.cloneColorOrWhite(from);
        const toColor = this.cloneColorOrWhite(to);
        const obj = { t: 0 };
        tween(obj)
            .to(duration, { t: 1 }, {
                onUpdate: (target: { t: number } | null) => {
                    if (!sprite || !sprite.node || !sprite.node.isValid || !target) return;
                    const ratio = Math.max(0, Math.min(1, target.t ?? 1));
                    sprite.color = new Color(
                        Math.round(fromColor.r + (toColor.r - fromColor.r) * ratio),
                        Math.round(fromColor.g + (toColor.g - fromColor.g) * ratio),
                        Math.round(fromColor.b + (toColor.b - fromColor.b) * ratio),
                        Math.round(fromColor.a + (toColor.a - fromColor.a) * ratio)
                    );
                }
            })
            .start();
    }

    private cloneColorOrWhite(color: Color | null | undefined): Color {
        if (!color) return new Color(255, 255, 255, 255);
        return new Color(color.r, color.g, color.b, color.a);
    }

    private playOrderCompleteAnimation(): void {
        if (this._isClearing) return;
        this._isClearing = true;

        const matchDelay = ConfigManager.getInstance().getGameplayValue('matchDelay') || 0.5;
        const completedOrderIdx = this._lastOrderIndex;

        // Phase 1: Glow tất cả slot đã fill của order vừa hoàn thành
        for (const slot of this._slots) {
            if (slot.orderIndex === completedOrderIdx && slot.filledNode && slot.filledNode.isValid) {
                tween(slot.filledNode)
                    .to(0.2, { scale: new Vec3(1.1, 1.1, 1) })
                    .to(0.2, { scale: new Vec3(0.9, 0.9, 1) })
                    .union()
                    .repeat(2)
                    .start();
            }
        }

        // Phase 2: Delay rồi pop animation
        this.scheduleOnce(() => {
            for (const slot of this._slots) {
                if (slot.orderIndex === completedOrderIdx && slot.filledNode && slot.filledNode.isValid) {
                    tween(slot.filledNode)
                        .to(0.15, { scale: new Vec3(0, 0, 1) })
                        .start();
                }
            }

            this.scheduleOnce(() => {
                this._isClearing = false;
                const newVisibleStart = this.getVisibleStartOrder();
                if (newVisibleStart !== this._visibleStartOrder) {
                    this.buildSlots();
                } else {
                    this.updateSlotStates();
                }
            }, matchDelay * 0.5);
        }, matchDelay * 0.3);
    }

    /** Xóa tất cả visual nodes */
    private clearVisuals(): void {
        if (!this.trayContainer || !this.trayContainer.isValid) return;

        const prefabKey = SkinManager.getInstance().getTilePrefabKey('default');

        // Trả preview về pool trước khi destroy panel cha
        for (const slot of this._slots) {
            if (slot.previewNode && slot.previewNode.isValid) {
                Tween.stopAllByTarget(slot.previewNode);
                this.resetPreviewNodeForPool(slot.previewNode);
                slot.previewNode.removeFromParent();
                PoolManager.getInstance().put(prefabKey, slot.previewNode);
            }
        }

        // Destroy tất cả panel (bao gồm cả slot con bên trong)
        const children = [...this.trayContainer.children];
        for (const child of children) {
            Tween.stopAllByTarget(child);
            child.destroy();
        }

        this._orderPanelMap.clear();
    }

    /** Clear toàn bộ tray */
    public clearTray(): void {
        this.unscheduleAllCallbacks();
        this.clearVisuals();
        for (const child of [...this.node.children]) {
            if (child.name.startsWith('OrderConsume_')) {
                Tween.stopAllByTarget(child);
                child.destroy();
            }
        }
        this._slots = [];
        this._orderPanelMap.clear();
        this._allOrders = [];
        this._currentOrder = null;
        this._orderConfig = null;
        this._filledCount = 0;
        this._isClearing = false;
        this._consumeEffectWorldPos = null;
        this._pendingTransition = false;
        this._isTransitioning = false;
        this._lastOrderIndex = -1;
        this._lastGlobalOrderIndex = -1;
        this._orderStartMap.clear();
        this._visibleStartOrder = 0;
    }

    private resetPreviewNodeForPool(node: Node): void {
        if (!node || !node.isValid) return;
        node.active = true;
        node.angle = 0;
        node.setRotationFromEuler(0, 0, 0);
        node.setScale(1, 1, 1);

        const opacity = node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;

        const visualNode = node.getChildByName('visual');
        if (visualNode && visualNode.isValid) {
            Tween.stopAllByTarget(visualNode);
            visualNode.angle = 0;
            visualNode.setRotationFromEuler(0, 0, 0);
            visualNode.setScale(1, 1, 1);
            const visualOpacity = visualNode.getComponent(UIOpacity);
            if (visualOpacity) visualOpacity.opacity = 255;
        }
    }

    protected onDestroy(): void {
        if (OrderTrayManager.Instance === this) {
            OrderTrayManager.Instance = null;
            EventBus.getInstance().off(GameEvent.ORDER_CHANGED, this.onOrderChanged, this);
            EventBus.getInstance().off(GameEvent.ORDER_ITEM_CORRECT, this.onOrderItemCorrect, this);
            EventBus.getInstance().off(GameEvent.ORDER_COMPLETED, this.onOrderCompleted, this);
            EventBus.getInstance().off(GameEvent.ALL_ORDERS_COMPLETED, this.onAllOrdersCompleted, this);
            EventBus.getInstance().off(GameEvent.LEVEL_LOADED, this.onLevelLoaded, this);
        }
    }
}
