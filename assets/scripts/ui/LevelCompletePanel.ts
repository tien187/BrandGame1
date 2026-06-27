import { _decorator, Component, Label, Button } from 'cc';
import { BasePanel } from './BasePanel';
import { GameManager } from '../managers/GameManager';

const { ccclass, property } = _decorator;

/**
 * LevelCompletePanel - Hiển thị khi hoàn thành level.
 * Gồm score, stars, nút next/retry/menu.
 */
@ccclass('LevelCompletePanel')
export class LevelCompletePanel extends BasePanel {
    @property(Label)
    public scoreLabel: Label | null = null;

    @property(Label)
    public starsLabel: Label | null = null;

    @property(Label)
    public levelLabel: Label | null = null;

    private _data: any = null;

    protected onShow(data?: any): void {
        super.onShow(data);
        this._data = data || {};
        this.updateUI();
    }

    private updateUI(): void {
        const { levelId, score, stars } = this._data;
        if (this.levelLabel) this.levelLabel.string = `Level ${levelId} Complete!`;
        if (this.scoreLabel) this.scoreLabel.string = `Score: ${score}`;
        if (this.starsLabel) this.starsLabel.string = `Stars: ${stars}`;
    }

    /** Callback nút Next Level */
    public onNextLevelClicked(): void {
        const nextLevel = (this._data?.levelId || 1) + 1;
        GameManager.Instance?.startLevel(nextLevel);
    }

    /** Callback nút Retry */
    public onRetryClicked(): void {
        const levelId = this._data?.levelId || 1;
        GameManager.Instance?.startLevel(levelId);
    }

    /** Callback nút Return to Menu */
    public onMenuClicked(): void {
        GameManager.Instance?.returnToMenu();
    }
}
