import { _decorator, Component, Node, EventTouch, Vec3, tween, Sprite, Color, Tween, UIOpacity, UITransform } from 'cc';
import { ITileData } from '../interfaces/ITileData';
import { TileManager } from '../managers/TileManager';

const { ccclass, property } = _decorator;
const BOARD_BLOCKED_COLOR = new Color(129, 129, 129, 255);

/**
 * Tile - Component gắn vào node tile trong scene.
 * Xử lý input, animation, visual feedback.
 * Debug view:
 *   - selectable: màu bình thường, độ opacity 1.0
 *   - blocked: làm tối màu (dim), độ opacity giảm
 *   - selected: highlight màu sáng hơn
 */
@ccclass('Tile')
export class Tile extends Component {
    @property(Node)
    public visualNode: Node | null = null;

    @property
    public selectableColor: Color = Color.WHITE;

    @property
    public blockedColor: Color = BOARD_BLOCKED_COLOR.clone();

    @property
    public dimmedColor: Color = BOARD_BLOCKED_COLOR.clone();

    @property
    public selectedColor: Color = new Color(255, 220, 100, 255);

    private _data: ITileData | null = null;
    private _isAnimating: boolean = false;
    private _originalScale: Vec3 = new Vec3(1, 1, 1);
    private _originalVisualScale: Vec3 = new Vec3(1, 1, 1);
    private _originalContentSize: { width: number; height: number } | null = null;
    private _originalVisualContentSize: { width: number; height: number } | null = null;
    private _isSelected: boolean = false;
    private _isGlowing: boolean = false;
    private _glowTween: any = null;
    private _moveTween: any = null;
    private _clearTween: any = null;
    private _unlockTween: any = null;
    private _lastVisualState: string | null = null;
    private _moveTarget: Vec3 | null = null;
    private _onMoveComplete?: () => void;
    private _isInTrayVisual: boolean = false;

    @property
    public glowColor: Color = new Color(255, 200, 50, 255);

    @property
    public unlockFadeDuration: number = 0.3;

    protected onLoad(): void {
        this.normalizeBoardColors();
        this._originalScale = this.node.scale.clone();
        if (this.visualNode) {
            this._originalVisualScale = this.visualNode.scale.clone();
        }
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            this._originalContentSize = { width: uiTransform.width, height: uiTransform.height };
        }
        const visualTransform = this.visualNode?.getComponent(UITransform);
        if (visualTransform) {
            this._originalVisualContentSize = { width: visualTransform.width, height: visualTransform.height };
        }
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    /** Khởi tạo tile với data */
    public initialize(data: ITileData): void {
        this.normalizeBoardColors();
        if (!this.visualNode) {
            this.visualNode = this.node.getChildByName('visual');
        }
        this._originalScale = this.node.scale.clone();
        if (this.visualNode) {
            this._originalVisualScale = this.visualNode.scale.clone();
        }
        this._isInTrayVisual = false;
        this._data = data;
        this._isSelected = false;
        this._lastVisualState = null;
        this.updateVisualState();
    }

    private normalizeBoardColors(): void {
        this.blockedColor = BOARD_BLOCKED_COLOR.clone();
        this.dimmedColor = BOARD_BLOCKED_COLOR.clone();
    }

    /** Cập nhật trạng thái visual theo data (selectable / blocked / selected) */
    public updateVisualState(): void {
        if (!this._data) return;

        const sprite = this.visualNode?.getComponent(Sprite) || this.getComponent(Sprite);
        if (!sprite) return;

        if (this._isInTrayVisual) {
            if (this._unlockTween) {
                this._unlockTween.stop();
                this._unlockTween = null;
            }
            sprite.color = this.selectableColor;
            sprite.node.setScale(this._originalVisualScale.x, this._originalVisualScale.y, this._originalVisualScale.z);
            this.node.setScale(this._originalScale.x, this._originalScale.y, 1);
            this._lastVisualState = 'tray';
            this.node.active = true;
            return;
        }

        let newState: string;
        let targetColor: Color;
        let targetVisualScaleX: number;
        let targetVisualScaleY: number;
        if (this._isSelected) {
            newState = 'selected';
            targetColor = this.selectedColor;
            targetVisualScaleX = this._originalVisualScale.x * 1.1;
            targetVisualScaleY = this._originalVisualScale.y * 1.1;
        } else if (this._data.isBlocked) {
            newState = 'blocked';
            targetColor = this.blockedColor;
            targetVisualScaleX = this._originalVisualScale.x;
            targetVisualScaleY = this._originalVisualScale.y;
        } else if (this._data.selectable) {
            newState = 'selectable';
            targetColor = this.selectableColor;
            targetVisualScaleX = this._originalVisualScale.x;
            targetVisualScaleY = this._originalVisualScale.y;
        } else {
            newState = 'dimmed';
            targetColor = this.dimmedColor;
            targetVisualScaleX = this._originalVisualScale.x;
            targetVisualScaleY = this._originalVisualScale.y;
        }

        const wasBlockedOrDimmed = this._lastVisualState === 'blocked' || this._lastVisualState === 'dimmed';
        const isTransitioningToSelectable = newState === 'selectable' && wasBlockedOrDimmed;

        if (isTransitioningToSelectable) {
            if (this._unlockTween) {
                this._unlockTween.stop();
                this._unlockTween = null;
            }
            const startColor = sprite.color.clone();
            const proxy = { r: startColor.r, g: startColor.g, b: startColor.b, a: startColor.a };
            const tweenOpts: any = {
                easing: 'sineOut',
                onUpdate: (target: any) => {
                    if (!sprite || !sprite.node || !sprite.node.isValid || !target) return;
                    sprite.color = new Color(target.r, target.g, target.b, target.a);
                },
            };
            this._unlockTween = tween(proxy)
                .to(this.unlockFadeDuration, { r: targetColor.r, g: targetColor.g, b: targetColor.b, a: targetColor.a }, tweenOpts)
                .call(() => {
                    this._unlockTween = null;
                })
                .start();
            sprite.node.setScale(targetVisualScaleX, targetVisualScaleY, this._originalVisualScale.z);
        } else if (newState !== this._lastVisualState || newState === 'blocked' || newState === 'dimmed') {
            if (this._unlockTween) {
                this._unlockTween.stop();
                this._unlockTween = null;
            }
            this.applySpriteVisual(sprite, targetColor, targetVisualScaleX, targetVisualScaleY, this._originalVisualScale.z);
        }

        this._lastVisualState = newState;
        this.node.active = true;
    }

    private applySpriteVisual(sprite: Sprite, color: Color, scaleX: number, scaleY: number, scaleZ: number): void {
        Tween.stopAllByTarget(sprite.node);
        sprite.color = new Color(color.r, color.g, color.b, color.a);
        sprite.node.setScale(scaleX, scaleY, scaleZ);
        sprite.node.angle = 0;
        sprite.node.setRotationFromEuler(0, 0, 0);
        const opacity = sprite.node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;
    }

    /** Đặt trạng thái selected và cập nhật visual */
    public forceUpdateVisualState(): void {
        if (this._glowTween) { this._glowTween.stop(); this._glowTween = null; }
        if (this._unlockTween) { this._unlockTween.stop(); this._unlockTween = null; }
        this._isGlowing = false;
        this._lastVisualState = null;
        this.updateVisualState();
    }

    public forceUpdateBoardVisualState(): void {
        this._isInTrayVisual = false;
        this._isSelected = false;
        Tween.stopAllByTarget(this.node);
        if (this.visualNode) Tween.stopAllByTarget(this.visualNode);
        const opacity = this.node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;
        this.node.angle = 0;
        this.node.setRotationFromEuler(0, 0, 0);
        this.forceUpdateVisualState();
    }

    public setSelected(selected: boolean): void {
        this._isSelected = selected;
        this.updateVisualState();
    }

    /** Đặt visual về màu bình thường khi tile xuống tray (không phụ thuộc data) */
    public setTrayVisual(): void {
        Tween.stopAllByTarget(this.node);
        if (this.visualNode) Tween.stopAllByTarget(this.visualNode);
        if (this._glowTween) { this._glowTween.stop(); this._glowTween = null; }
        if (this._unlockTween) { this._unlockTween.stop(); this._unlockTween = null; }
        this._isInTrayVisual = true;
        this._isSelected = false;
        this._lastVisualState = null;
        this._originalScale = new Vec3(1, 1, 1);
        this._originalVisualScale = new Vec3(1, 1, 1);
        const opacity = this.node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;
        this.node.angle = 0;
        const sprite = this.visualNode?.getComponent(Sprite) || this.getComponent(Sprite);
        if (sprite) {
            sprite.color = this.selectableColor;
            sprite.node.setScale(1, 1, 1);
        }
        this.node.setScale(1, 1, 1);
    }

    /** Glow effect: tile sáng nhấp nháy khi sắp match */
    public setGlow(active: boolean): void {
        if (this._isGlowing === active) return;
        this._isGlowing = active;

        if (this._glowTween) {
            this._glowTween.stop();
            this._glowTween = null;
        }

        const sprite = this.visualNode?.getComponent(Sprite) || this.getComponent(Sprite);
        if (!sprite) return;

        if (active) {
            // Pulse glow tween via proxy object (Cocos 3.x cannot tween Color directly)
            const originalColor = this._isInTrayVisual || (this._data?.selectable && !this._data?.isBlocked)
                ? this.selectableColor
                : this.blockedColor;
            const proxy = { r: originalColor.r, g: originalColor.g, b: originalColor.b };
            const updateColor = () => {
                if (!sprite || !sprite.node || !sprite.node.isValid) return;
                sprite.color = new Color(proxy.r, proxy.g, proxy.b, 255);
            };
            this._glowTween = tween(proxy)
                .to(0.4, { r: this.glowColor.r, g: this.glowColor.g, b: this.glowColor.b }, {
                    easing: 'sineInOut',
                    onUpdate: updateColor,
                })
                .to(0.4, { r: originalColor.r, g: originalColor.g, b: originalColor.b }, {
                    easing: 'sineInOut',
                    onUpdate: updateColor,
                })
                .union()
                .repeatForever()
                .start();
        } else {
            this.updateVisualState();
        }
    }

    /** Dừng mọi tween đang chạy (dùng khi recycle từ pool) */
    public stopAllTweens(): void {
        if (this._glowTween) { this._glowTween.stop(); this._glowTween = null; }
        if (this._moveTween) { this._moveTween.stop(); this._moveTween = null; }
        if (this._clearTween) { this._clearTween.stop(); this._clearTween = null; }
        if (this._unlockTween) { this._unlockTween.stop(); this._unlockTween = null; }
        this._moveTarget = null;
        Tween.stopAllByTarget(this.node);
    }

    /** Xử lý click */
    private onTouchEnd(event: EventTouch): void {
        event.propagationStopped = true;
        if (!this.node.active || this.node.scale.x < 0.01) return;
        if (!this._data || this._isAnimating) return;
        if (!this._data.selectable) return;

        TileManager.getInstance().onTileClicked(this._data.id);
    }

    /** Animation khi được chọn */
    public playSelectAnimation(): void {
        if (this._isAnimating || !this.node || !this.node.isValid) return;
        this._isAnimating = true;
        Tween.stopAllByTarget(this.node);
        if (this._unlockTween) { this._unlockTween.stop(); this._unlockTween = null; }

        tween(this.node)
            .to(0.1, { scale: new Vec3(this._originalScale.x * 1.1, this._originalScale.y * 1.1, 1) })
            .to(0.1, { scale: new Vec3(this._originalScale.x, this._originalScale.y, this._originalScale.z) })
            .call(() => { this._isAnimating = false; })
            .start();
    }

    /** Animation di chuyển đến tray */
    public moveToTray(targetPos: Vec3, duration: number, callback?: () => void, impactCallback?: () => void): void {
        if (!this.node || !this.node.isValid) {
            callback?.();
            return;
        }
        this._isAnimating = true;
        this._onMoveComplete = callback;
        if (this._moveTween) { this._moveTween.stop(); }
        if (this._unlockTween) { this._unlockTween.stop(); this._unlockTween = null; }

        const startPos = this.node.position.clone();
        this._moveTarget = targetPos.clone();

        const totalDuration = Math.max(duration, 0.65);
        const hopDuration = totalDuration * 0.15;
        const fallDuration = totalDuration * 0.55;
        const bounceDuration = totalDuration * 0.30;
        const distance = Vec3.distance(startPos, targetPos);
        const hopHeight = Math.min(140, Math.max(42, distance * 0.22));
        const bounceHeight = Math.min(28, Math.max(12, distance * 0.045));
        const hopPos = new Vec3(
            startPos.x + (targetPos.x - startPos.x) * 0.16,
            startPos.y + hopHeight,
            startPos.z
        );
        const controlPos = new Vec3(
            startPos.x + (targetPos.x - startPos.x) * 0.55,
            Math.max(startPos.y, targetPos.y) + hopHeight * 1.05,
            startPos.z
        );
        const proxy = { t: 0, sx: this._originalScale.x, sy: this._originalScale.y };
        const setScaleFromProxy = () => {
            if (!this.node || !this.node.isValid) return;
            this.node.setScale(proxy.sx, proxy.sy, 1);
        };
        const setLinearPosition = (from: Vec3, to: Vec3) => {
            if (!this.node || !this.node.isValid) return;
            this.node.setPosition(
                from.x + (to.x - from.x) * proxy.t,
                from.y + (to.y - from.y) * proxy.t,
                from.z + (to.z - from.z) * proxy.t
            );
            setScaleFromProxy();
        };
        const setArcPosition = () => {
            if (!this.node || !this.node.isValid || !this._moveTarget) return;
            const t = proxy.t;
            const inv = 1 - t;
            const endPos = this._moveTarget;
            this.node.setPosition(
                inv * inv * hopPos.x + 2 * inv * t * controlPos.x + t * t * endPos.x,
                inv * inv * hopPos.y + 2 * inv * t * controlPos.y + t * t * endPos.y,
                inv * inv * hopPos.z + 2 * inv * t * controlPos.z + t * t * endPos.z
            );
            setScaleFromProxy();
        };
        const getTargetWithOffset = (yOffset: number = 0): Vec3 => {
            const target = this._moveTarget ?? targetPos;
            return new Vec3(target.x, target.y + yOffset, target.z);
        };
        const finishMove = () => {
            this._isAnimating = false;
            this._moveTween = null;
            this._moveTarget = null;
            this._onMoveComplete?.();
            this._onMoveComplete = undefined;
        };
        let didImpact = false;
        const notifyImpact = () => {
            if (didImpact) return;
            didImpact = true;
            impactCallback?.();
        };

        this._moveTween = tween(proxy)
            .to(hopDuration, { t: 1, sx: this._originalScale.x * 1.06, sy: this._originalScale.y * 1.06 }, {
                easing: 'sineOut',
                onUpdate: () => setLinearPosition(startPos, hopPos),
            })
            .call(() => {
                proxy.t = 0;
            })
            .to(fallDuration, { t: 1 }, {
                easing: 'quadIn',
                onUpdate: setArcPosition,
            })
            .call(() => {
                if (this._moveTarget) {
                    this.node.setPosition(this._moveTarget);
                }
                proxy.t = 0;
                notifyImpact();
            })
            .to(bounceDuration * 0.20, { sx: this._originalScale.x * 1.1, sy: this._originalScale.y * 0.9 }, {
                easing: 'quadOut',
                onUpdate: () => {
                    this.node.setPosition(getTargetWithOffset(0));
                    setScaleFromProxy();
                },
            })
            .call(() => { proxy.t = 0; })
            .to(bounceDuration * 0.28, { t: 1, sx: this._originalScale.x * 0.96, sy: this._originalScale.y * 1.06 }, {
                easing: 'sineOut',
                onUpdate: () => setLinearPosition(getTargetWithOffset(0), getTargetWithOffset(bounceHeight)),
            })
            .call(() => { proxy.t = 0; })
            .to(bounceDuration * 0.20, { t: 1, sx: this._originalScale.x * 1.04, sy: this._originalScale.y * 0.96 }, {
                easing: 'sineIn',
                onUpdate: () => setLinearPosition(getTargetWithOffset(bounceHeight), getTargetWithOffset(0)),
            })
            .call(() => { proxy.t = 0; })
            .to(bounceDuration * 0.18, { t: 1, sx: this._originalScale.x * 0.99, sy: this._originalScale.y * 1.02 }, {
                easing: 'sineOut',
                onUpdate: () => setLinearPosition(getTargetWithOffset(0), getTargetWithOffset(bounceHeight * 0.35)),
            })
            .call(() => { proxy.t = 0; })
            .to(bounceDuration * 0.14, { t: 1, sx: this._originalScale.x, sy: this._originalScale.y }, {
                easing: 'sineInOut',
                onUpdate: () => setLinearPosition(getTargetWithOffset(bounceHeight * 0.35), getTargetWithOffset(0)),
            })
            .call(finishMove)
            .start();
    }

    /** Cập nhật vị trí đích khi tile đang bay (dùng khi tray compact/sort giữa chừng) */
    public updateMoveTarget(targetPos: Vec3, duration: number): void {
        if (!this.node || !this.node.isValid) return;
        if (!this._isAnimating || !this._moveTween) return;

        this._moveTween.stop();
        this._moveTarget = targetPos.clone();
        this._moveTween = tween(this.node)
            .to(duration, { position: targetPos, scale: new Vec3(this._originalScale.x, this._originalScale.y, this._originalScale.z) }, { easing: 'sineOut' })
            .call(() => {
                this._isAnimating = false;
                this._moveTween = null;
                this._moveTarget = null;
                this._onMoveComplete?.();
                this._onMoveComplete = undefined;
            })
            .start();
    }

    /** Animation rơi từ trên xuống vị trí đích (dùng khi load level) */
    public playDropAnimation(startPos: Vec3, endPos: Vec3, duration: number, delay: number = 0, easing: string = 'backOut', callback?: () => void): void {
        if (!this.node || !this.node.isValid) {
            callback?.();
            return;
        }
        this._isAnimating = true;
        if (this._moveTween) { this._moveTween.stop(); }

        this.node.setPosition(startPos);
        this.node.setScale(0, 0, 1);

        this._moveTween = tween(this.node)
            .delay(delay)
            .parallel(
                tween(this.node).to(duration, { position: endPos }, { easing: easing as any }),
                tween(this.node).to(duration * 0.3, { scale: new Vec3(this._originalScale.x, this._originalScale.y, this._originalScale.z) }, { easing: 'backOut' })
            )
            .call(() => {
                this._isAnimating = false;
                this._moveTween = null;
                callback?.();
            })
            .start();
    }

    /** Animation khi match clear */
    public playClearAnimation(duration: number, callback?: () => void): void {
        if (!this.node || !this.node.isValid) {
            callback?.();
            return;
        }
        this._isAnimating = true;
        if (this._clearTween) { this._clearTween.stop(); }
        if (this._unlockTween) { this._unlockTween.stop(); this._unlockTween = null; }

        this._clearTween = tween(this.node)
            .to(duration * 0.5, { scale: new Vec3(0, 0, 1) })
            .call(() => {
                this._isAnimating = false;
                this._clearTween = null;
                callback?.();
            })
            .start();
    }

    /** Animation tile bay từ tray vào order slot: bay lên, zoom nhẹ, nghiêng random, bay đến target, nhỏ và mất */
    public animateMatchToOrder(targetWorldPos: Vec3, duration: number = 0.8, callback?: () => void): void {
        if (!this.node || !this.node.isValid) {
            callback?.();
            return;
        }
        this._isAnimating = true;
        Tween.stopAllByTarget(this.node);
        if (this._moveTween) { this._moveTween.stop(); this._moveTween = null; }
        if (this._unlockTween) { this._unlockTween.stop(); this._unlockTween = null; }
        if (this._clearTween) { this._clearTween.stop(); this._clearTween = null; }

        const startWorldPos = this.node.getWorldPosition();
        const midWorldPos = new Vec3(
            (startWorldPos.x + targetWorldPos.x) * 0.5,
            Math.max(startWorldPos.y, targetWorldPos.y) + 80,
            startWorldPos.z
        );
        const proxy = {
            wx: startWorldPos.x, wy: startWorldPos.y, wz: startWorldPos.z,
            scaleX: this.node.scale.x, scaleY: this.node.scale.y, angle: 0
        };

        this._moveTween = tween(proxy)
            .to(duration * 0.35, {
                wx: midWorldPos.x, wy: midWorldPos.y,
                scaleX: this._originalScale.x * 1.15, scaleY: this._originalScale.y * 1.15, angle: 0
            }, {
                easing: 'sineOut',
                onUpdate: () => {
                    if (!this.node || !this.node.isValid) return;
                    this.node.setWorldPosition(proxy.wx, proxy.wy, proxy.wz);
                    this.node.setScale(proxy.scaleX, proxy.scaleY, 1);
                    this.node.setRotationFromEuler(0, 0, 0);
                }
            })
            .to(duration * 0.45, {
                wx: targetWorldPos.x, wy: targetWorldPos.y,
                scaleX: this._originalScale.x * 0.9, scaleY: this._originalScale.y * 0.9, angle: 0
            }, {
                easing: 'quadIn',
                onUpdate: () => {
                    if (!this.node || !this.node.isValid) return;
                    this.node.setWorldPosition(proxy.wx, proxy.wy, proxy.wz);
                    this.node.setScale(proxy.scaleX, proxy.scaleY, 1);
                    this.node.setRotationFromEuler(0, 0, 0);
                }
            })
            .to(duration * 0.2, { scaleX: 0, scaleY: 0 }, {
                easing: 'quadIn',
                onUpdate: () => {
                    if (!this.node || !this.node.isValid) return;
                    this.node.setScale(proxy.scaleX, proxy.scaleY, 1);
                }
            })
            .call(() => {
                this._isAnimating = false;
                this._moveTween = null;
                callback?.();
            })
            .start();
    }

    /** Lấy tile data */
    public getData(): ITileData | null {
        return this._data;
    }

    /** Reset state để recycle qua pool */
    public reset(): void {
        this.stopAllTweens();
        this._originalScale = this.node.scale.clone();
        if (this.visualNode) {
            this._originalVisualScale = this.visualNode.scale.clone();
        }
        (this.node as any).__skinApplyId = ((this.node as any).__skinApplyId || 0) + 1;
        this._data = null;
        this._isAnimating = false;
        this._isSelected = false;
        this._isGlowing = false;
        this._isInTrayVisual = false;
        this._lastVisualState = null;
        this.node.active = true;
        this.node.setScale(this._originalScale.x, this._originalScale.y, this._originalScale.z);
        this.node.setPosition(Vec3.ZERO);
        this.node.angle = 0;
        this.node.setRotationFromEuler(0, 0, 0);

        // Reset visual node scale
        if (this.visualNode) {
            this.visualNode.setScale(this._originalVisualScale.x, this._originalVisualScale.y, this._originalVisualScale.z);
        }

        // Reset content size
        if (this._originalContentSize) {
            const uiTransform = this.node.getComponent(UITransform);
            if (uiTransform) {
                uiTransform.setContentSize(this._originalContentSize.width, this._originalContentSize.height);
            }
        }
        if (this.visualNode && this._originalVisualContentSize) {
            const visualTransform = this.visualNode.getComponent(UITransform);
            if (visualTransform) {
                visualTransform.setContentSize(this._originalVisualContentSize.width, this._originalVisualContentSize.height);
            }
        }

        // Reset sprite
        const sprite = this.visualNode?.getComponent(Sprite) || this.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = null;
            sprite.color = Color.WHITE;
        }

        const opacity = this.node.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;
    }

    protected onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }
}
