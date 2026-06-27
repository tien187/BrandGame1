import { _decorator, Component, Node, Vec3, tween, Sprite, Color, UITransform, Tween } from 'cc';
import { ITileData } from '../interfaces/ITileData';
import { GameEvent } from '../enums/GameEvent';
import { EventBus } from '../core/EventBus';
import { SkinManager } from './SkinManager';

const { ccclass, property } = _decorator;

interface IWrongSlot {
    index: number;
    position: Vec3;
    filledNode: Node | null;
}

/**
 * WrongTrayManager - Hiển thị các item chọn sai.
 * Khi đầy thì rung + đỏ và emit WRONG_TRAY_FULL.
 */
@ccclass('WrongTrayManager')
export class WrongTrayManager extends Component {
    public static Instance: WrongTrayManager;
    public static getInstance(): WrongTrayManager { return WrongTrayManager.Instance; }

    @property(Node)
    public trayContainer: Node | null = null;

    @property
    public slotSpacing: number = 110;

    @property
    public flyDuration: number = 0.3;

    @property
    public slotScale: number = 0.75;

    @property(Color)
    public normalBgColor: Color = new Color(100, 100, 100, 200);

    @property(Color)
    public fullColor: Color = new Color(255, 50, 50, 255);

    private _slots: IWrongSlot[] = [];
    private _maxSlots: number = 2;
    private _filledCount: number = 0;
    private _isFull: boolean = false;

    protected onLoad(): void {
        if (WrongTrayManager.Instance) { this.destroy(); return; }
        WrongTrayManager.Instance = this;

        EventBus.getInstance().on(GameEvent.ORDER_ITEM_WRONG, this.onOrderItemWrong, this);
        EventBus.getInstance().on(GameEvent.LEVEL_LOADED, this.onLevelLoaded, this);
    }

    private onLevelLoaded(): void {
        this.clearTray();
    }

    public initialize(maxSlots: number): void {
        this._maxSlots = maxSlots;
        this._filledCount = 0;
        this._isFull = false;
        this.buildSlots();
    }

    private onOrderItemWrong(tileData: ITileData): void {
        this.addTile(tileData);
    }

    /** Thêm tile sai vào wrong tray (clone icon, không bắt node thật) */
    public addTile(tileData: ITileData): boolean {
        if (this._isFull) return false;
        if (this._filledCount >= this._maxSlots) return false;

        const slot = this._slots[this._filledCount];
        if (!slot) return false;

        this._filledCount++;

        const container = this.trayContainer!;

        // Clone icon từ skin thay vì lấy node thật
        const iconNode = new Node(`WrongIcon_${tileData.id}`);
        iconNode.layer = container.layer;
        iconNode.addComponent(UITransform);
        iconNode.addComponent(Sprite);
        iconNode.setParent(container);
        iconNode.setPosition(slot.position.clone());
        iconNode.setScale(0, 0, 1);

        const skinId = SkinManager.getInstance().getCurrentSkin()?.skinId || 'uma';
        SkinManager.getInstance().applyTileSkin(iconNode, `${skinId}/${tileData.groupId}`);

        // Bay vào slot
        const targetPos = slot.position.clone();
        tween(iconNode)
            .to(this.flyDuration, { position: targetPos, scale: new Vec3(this.slotScale, this.slotScale, 1) })
            .call(() => {
                slot.filledNode = iconNode;
                if (this._filledCount >= this._maxSlots) {
                    this._isFull = true;
                    this.playFullAnimation();
                }
            })
            .start();

        return true;
    }

    /** Animation khi wrong tray đầy: rung + đỏ */
    private playFullAnimation(): void {
        if (!this.trayContainer || !this.trayContainer.isValid) return;

        // Tween màu đỏ cho background slots
        for (const slot of this._slots) {
            if (!slot.filledNode || !slot.filledNode.isValid) continue;
            const sprite = slot.filledNode.getComponentInChildren(Sprite);
            if (sprite) {
                tween(sprite)
                    .to(0.2, { color: this.fullColor })
                    .start();
            }
        }

        // Shake container
        const originalPos = this.trayContainer.position.clone();
        tween(this.trayContainer)
            .to(0.05, { position: new Vec3(originalPos.x - 10, originalPos.y, originalPos.z) })
            .to(0.05, { position: new Vec3(originalPos.x + 10, originalPos.y, originalPos.z) })
            .to(0.05, { position: new Vec3(originalPos.x - 10, originalPos.y, originalPos.z) })
            .to(0.05, { position: new Vec3(originalPos.x + 10, originalPos.y, originalPos.z) })
            .to(0.05, { position: originalPos })
            .call(() => {
                EventBus.getInstance().emit(GameEvent.WRONG_TRAY_FULL);
            })
            .start();
    }

    /** Xây dựng slot positions */
    private buildSlots(): void {
        this.clearVisuals();
        this._slots = [];

        if (this._maxSlots <= 0) return;

        this.ensureContainer();
        const container = this.trayContainer!;
        const startX = -(this._maxSlots - 1) * this.slotSpacing / 2;

        for (let i = 0; i < this._maxSlots; i++) {
            const pos = new Vec3(startX + i * this.slotSpacing, 0, 0);

            // Background node
            const bgNode = new Node(`WrongSlotBg_${i}`);
            bgNode.layer = container.layer;
            bgNode.addComponent(UITransform);
            const bgSprite = bgNode.addComponent(Sprite);
            bgSprite.color = this.normalBgColor;
            bgNode.setParent(container);
            bgNode.setPosition(pos);
            bgNode.setScale(this.slotScale, this.slotScale, 1);

            this._slots.push({ index: i, position: pos.clone(), filledNode: null });
        }
    }

    private ensureContainer(): void {
        if (this.trayContainer) return;

        this.trayContainer = new Node('WrongTrayContainer');
        this.trayContainer.layer = this.node.layer;
        this.trayContainer.addComponent(UITransform);
        this.trayContainer.setParent(this.node);
        this.trayContainer.setPosition(0, 0, 0);
    }

    private clearVisuals(): void {
        if (!this.trayContainer || !this.trayContainer.isValid) return;

        const children = [...this.trayContainer.children];
        for (const child of children) {
            Tween.stopAllByTarget(child);
            child.destroy();
        }
    }

    public clearTray(): void {
        this.unscheduleAllCallbacks();
        this.clearVisuals();
        this._slots = [];
        this._filledCount = 0;
        this._isFull = false;
    }

    public isFull(): boolean {
        return this._isFull;
    }

    public getFilledCount(): number {
        return this._filledCount;
    }

    public captureSnapshot(): { filledCount: number; isFull: boolean } {
        return { filledCount: this._filledCount, isFull: this._isFull };
    }

    public restoreSnapshot(snapshot: { filledCount: number; isFull: boolean }): void {
        this.clearTray();
        this._filledCount = snapshot.filledCount;
        this._isFull = snapshot.isFull;
        this.buildSlots();
    }

    protected onDestroy(): void {
        if (WrongTrayManager.Instance === this) {
            WrongTrayManager.Instance = null;
            EventBus.getInstance().off(GameEvent.ORDER_ITEM_WRONG, this.onOrderItemWrong, this);
            EventBus.getInstance().off(GameEvent.LEVEL_LOADED, this.onLevelLoaded, this);
        }
    }
}
