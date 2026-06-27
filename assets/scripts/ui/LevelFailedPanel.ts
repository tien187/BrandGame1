import { _decorator, Component, Label, Button } from 'cc';
import { BasePanel } from './BasePanel';
import { GameManager } from '../managers/GameManager';

const { ccclass, property } = _decorator;

/**
 * LevelFailedPanel - Hiển thị khi thua level (tray đầy hoặc hết thời gian).
 * Gồm nút retry và return to menu.
 */
@ccclass('LevelFailedPanel')
export class LevelFailedPanel extends BasePanel {
    @property(Label)
    public levelLabel: Label | null = null;

    private _data: any = null;

    protected onShow(data?: any): void {
        super.onShow(data);
        this._data = data || {};
        this.updateUI();
    }

    private updateUI(): void {
        const { levelId } = this._data;
        if (this.levelLabel) this.levelLabel.string = `Level ${levelId} Failed`;
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
