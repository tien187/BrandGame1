import { _decorator, Component, Label, Button, tween, Tween, Vec3 } from 'cc';
import { BasePanel } from './BasePanel';
import { GameEvent } from '../enums/GameEvent';
import { EventBus } from '../core/EventBus';
import { LevelManager } from '../managers/LevelManager';
import { OrderManager } from '../managers/OrderManager';
import { BoosterManager } from '../managers/BoosterManager';
import { BoosterType } from '../enums/BoosterType';

const { ccclass, property } = _decorator;

/**
 * GameplayPanel - HUD trong màn chơi.
 * Hiển thị score, level, stars, booster buttons, và order info.
 * Không chứa logic gameplay, chỉ binding data và handle input.
 */
@ccclass('GameplayPanel')
export class GameplayPanel extends BasePanel {
    @property(Label)
    public levelLabel: Label | null = null;

    @property(Label)
    public scoreLabel: Label | null = null;

    @property(Label)
    public starLabel: Label | null = null;

    @property(Label)
    public orderLabel: Label | null = null;

    @property(Button)
    public undoButton: Button | null = null;

    @property(Button)
    public hintButton: Button | null = null;

    @property(Button)
    public skipButton: Button | null = null;

    @property(Label)
    public undoCountLabel: Label | null = null;

    @property(Label)
    public hintCountLabel: Label | null = null;

    @property(Label)
    public skipCountLabel: Label | null = null;

    @property(Label)
    public timeLabel: Label | null = null;

    private _undoButtonOriginalPos: Vec3 | null = null;
    private _elapsedSeconds: number = 0;

    protected onShow(data?: any): void {
        super.onShow(data);
        if (!this.timeLabel) {
            this.timeLabel = this.node.getChildByName('TimeLabel')?.getComponent(Label) || null;
        }
        this.updateUI();
        if (this.undoButton && this.undoButton.node.isValid) {
            this._undoButtonOriginalPos = this.undoButton.node.position.clone();
        }
        EventBus.getInstance().on(GameEvent.SCORE_CHANGED, this.onScoreChanged, this);
        EventBus.getInstance().on(GameEvent.LEVEL_COMPLETED, this.onLevelCompleted, this);
        EventBus.getInstance().on(GameEvent.ORDER_CHANGED, this.onOrderChanged, this);
        EventBus.getInstance().on(GameEvent.BOOSTER_USED, this.onBoosterChanged, this);
        EventBus.getInstance().on(GameEvent.LEVEL_STARTED, this.onLevelStarted, this);
        EventBus.getInstance().on(GameEvent.LEVEL_FAILED, this.onLevelEnded, this);
        EventBus.getInstance().on(GameEvent.HINT_FAILED, this.onHintFailed, this);
        EventBus.getInstance().on(GameEvent.LEVEL_TIME_UPDATED, this.onLevelTimeUpdated, this);
        this.bindBoosterButtons();
        this.updateBoosterUI();
    }

    protected onHide(): void {
        EventBus.getInstance().off(GameEvent.SCORE_CHANGED, this.onScoreChanged, this);
        EventBus.getInstance().off(GameEvent.LEVEL_COMPLETED, this.onLevelCompleted, this);
        EventBus.getInstance().off(GameEvent.ORDER_CHANGED, this.onOrderChanged, this);
        EventBus.getInstance().off(GameEvent.BOOSTER_USED, this.onBoosterChanged, this);
        EventBus.getInstance().off(GameEvent.LEVEL_STARTED, this.onLevelStarted, this);
        EventBus.getInstance().off(GameEvent.LEVEL_FAILED, this.onLevelEnded, this);
        EventBus.getInstance().off(GameEvent.HINT_FAILED, this.onHintFailed, this);
        EventBus.getInstance().off(GameEvent.LEVEL_TIME_UPDATED, this.onLevelTimeUpdated, this);
        this.unbindBoosterButtons();
    }

    private updateUI(): void {
        const levelId = LevelManager.getInstance().getCurrentLevelId();
        const score = LevelManager.getInstance().getScore();
        const stars = LevelManager.getInstance().getStars();

        if (this.levelLabel) this.levelLabel.string = `Level ${levelId}`;
        if (this.scoreLabel) this.scoreLabel.string = `${score}`;
        if (this.starLabel) this.starLabel.string = `Stars: ${stars}`;
        if (this.timeLabel) this.timeLabel.string = this.formatTime(this._elapsedSeconds);
        this.updateOrderLabel();
        this.updateBoosterUI();
    }

    private onScoreChanged(score: number, delta: number): void {
        if (this.scoreLabel) this.scoreLabel.string = `${score}`;
    }

    private onLevelCompleted(levelId: number, score: number, stars: number): void {
        if (this.starLabel) this.starLabel.string = `Stars: ${stars}`;
    }

    private onOrderChanged(order: any, orderIndex: number): void {
        this.updateOrderLabel();
    }

    private onBoosterChanged(): void {
        this.updateBoosterUI();
    }

    private onLevelStarted(): void {
        this.updateBoosterUI();
    }

    private onLevelEnded(): void {
        this.updateBoosterUI();
    }

    private onLevelTimeUpdated(seconds: number): void {
        this._elapsedSeconds = seconds;
        if (this.timeLabel) this.timeLabel.string = this.formatTime(seconds);
    }

    private formatTime(totalSeconds: number): string {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const mm = minutes < 10 ? '0' + minutes : minutes;
        const ss = seconds < 10 ? '0' + seconds : seconds;
        return `${mm}:${ss}`;
    }

    private onHintFailed(): void {
        if (BoosterManager.getInstance()?.getBoosterCount(BoosterType.UNDO) > 0) {
            this.shakeUndoButton();
        }
    }

    private shakeUndoButton(): void {
        if (!this.undoButton || !this.undoButton.node.isValid) return;
        const node = this.undoButton.node;
        Tween.stopAllByTarget(node);
        if (!this._undoButtonOriginalPos) {
            this._undoButtonOriginalPos = node.position.clone();
        }
        const originalPos = this._undoButtonOriginalPos;
        node.setPosition(originalPos);
        tween(node)
            .to(0.05, { position: new Vec3(originalPos.x - 8, originalPos.y, originalPos.z) })
            .to(0.05, { position: new Vec3(originalPos.x + 8, originalPos.y, originalPos.z) })
            .to(0.05, { position: new Vec3(originalPos.x - 8, originalPos.y, originalPos.z) })
            .to(0.05, { position: new Vec3(originalPos.x + 8, originalPos.y, originalPos.z) })
            .to(0.05, { position: originalPos })
            .start();
    }

    private bindBoosterButtons(): void {
        this.unbindBoosterButtons();
        this.undoButton?.node.on(Button.EventType.CLICK, this.onUndoClicked, this);
        this.hintButton?.node.on(Button.EventType.CLICK, this.onHintClicked, this);
        this.skipButton?.node.on(Button.EventType.CLICK, this.onSkipClicked, this);
    }

    private unbindBoosterButtons(): void {
        this.undoButton?.node.off(Button.EventType.CLICK, this.onUndoClicked, this);
        this.hintButton?.node.off(Button.EventType.CLICK, this.onHintClicked, this);
        this.skipButton?.node.off(Button.EventType.CLICK, this.onSkipClicked, this);
    }

    private onUndoClicked(): void {
        BoosterManager.getInstance()?.UseUndo();
        this.updateBoosterUI();
    }

    private onHintClicked(): void {
        BoosterManager.getInstance()?.UseHint();
        this.updateBoosterUI();
    }

    private onSkipClicked(): void {
        BoosterManager.getInstance()?.UseSkipLevel();
        this.updateBoosterUI();
    }

    private updateBoosterUI(): void {
        const booster = BoosterManager.getInstance();
        if (!booster) return;
        const undoCount = booster.getBoosterCount(BoosterType.UNDO);
        const hintCount = booster.getBoosterCount(BoosterType.HINT);
        const skipCount = booster.getBoosterCount(BoosterType.SKIP);

        if (this.undoCountLabel) this.undoCountLabel.string = `${undoCount}`;
        if (this.hintCountLabel) this.hintCountLabel.string = `${hintCount}`;
        if (this.skipCountLabel) this.skipCountLabel.string = `${skipCount}`;

        if (this.undoButton) this.undoButton.interactable = booster.canUseUndo();
        if (this.hintButton) this.hintButton.interactable = booster.canUseHint();
        if (this.skipButton) this.skipButton.interactable = booster.canUseSkip();
    }

    private updateOrderLabel(): void {
        if (!this.orderLabel) return;
        const orderMgr = OrderManager.getInstance();
        if (!orderMgr.isActive()) {
            this.orderLabel.string = '';
            return;
        }
        const currentOrder = orderMgr.getCurrentOrder();
        if (!currentOrder) {
            this.orderLabel.string = 'All orders complete!';
            return;
        }
        const expected = orderMgr.getExpectedItem();
        const progress = orderMgr.getCurrentItemIndex();
        const total = currentOrder.items.length;
        this.orderLabel.string = `Order ${orderMgr.getCurrentOrderIndex() + 1}/${orderMgr.getTotalOrders()}: Need [${currentOrder.items.join(' > ')}] | Next: ${expected || '?'}`;
    }
}
