import { _decorator, Label, Button } from 'cc';
import { BasePanel } from './BasePanel';
import { GameManager } from '../managers/GameManager';

const { ccclass, property } = _decorator;

/**
 * LevelFailedPanel - Popup thua.
 * Su dung prefab co san, gom nut Home va Replay.
 */
@ccclass('LevelFailedPanel')
export class LevelFailedPanel extends BasePanel {
    @property(Label)
    public titleLabel: Label | null = null;

    @property(Button)
    public homeButton: Button | null = null;

    @property(Button)
    public replayButton: Button | null = null;

    private _data: any = null;

    protected onShow(data?: any): void {
        super.onShow(data);
        this._data = data || {};
        this.updateUI();
        this.bindButtons();
    }

    protected onHide(): void {
        this.unbindButtons();
        super.onHide();
    }

    private updateUI(): void {
        const levelId = this._data?.levelId || 1;
        if (this.titleLabel) this.titleLabel.string = `Level ${levelId} Failed`;
    }

    private bindButtons(): void {
        this.homeButton?.node.on(Button.EventType.CLICK, this.onHomeClicked, this);
        this.replayButton?.node.on(Button.EventType.CLICK, this.onReplayClicked, this);
    }

    private unbindButtons(): void {
        this.homeButton?.node.off(Button.EventType.CLICK, this.onHomeClicked, this);
        this.replayButton?.node.off(Button.EventType.CLICK, this.onReplayClicked, this);
    }

    private onHomeClicked(): void {
        this.closePanel();
        GameManager.Instance?.returnToMenu();
    }

    private onReplayClicked(): void {
        const levelId = this._data?.levelId || 1;
        this.closePanel();
        GameManager.Instance?.startLevel(levelId);
    }
}
