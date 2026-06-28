import { _decorator, Component, Button } from 'cc';
import { LevelManager } from '../managers/LevelManager';

const { ccclass, property } = _decorator;

/**
 * ResetButton - Attach vào một Button node trong scene.
 * Khi nhấn sẽ trigger level failed (restart màn hiện tại).
 */
@ccclass('ResetButton')
export class ResetButton extends Component {
    protected onLoad(): void {
        const button = this.getComponent(Button);
        if (button) {
            button.node.on('click', this.onResetClicked, this);
        } else {
                    }
    }

    private onResetClicked(): void {
                LevelManager.getInstance().onLevelFailed();
    }

    protected onDestroy(): void {
        const button = this.getComponent(Button);
        if (button) {
            button.node.off('click', this.onResetClicked, this);
        }
    }
}
