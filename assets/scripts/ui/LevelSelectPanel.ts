import { _decorator, Component, Node, ScrollView } from 'cc';
import { BasePanel } from './BasePanel';
import { GameManager } from '../managers/GameManager';

const { ccclass, property } = _decorator;

/**
 * LevelSelectPanel - Màn hình chọn level.
 * Hiển thị danh sách level, scroll, lock/unlock status.
 * Khi click level -> gọi GameManager.startLevel().
 */
@ccclass('LevelSelectPanel')
export class LevelSelectPanel extends BasePanel {
    @property(ScrollView)
    public levelScrollView: ScrollView | null = null;

    @property(Node)
    public levelItemPrefab: Node | null = null;

    protected onShow(data?: any): void {
        super.onShow(data);
        this.refreshLevelList();
    }

    /** Tạo danh sách level items */
    private refreshLevelList(): void {
        // TODO: Load level metadata và instantiate levelItemPrefab
    }

    /** Callback khi click một level (được gọi từ Button click event hoặc code) */
    public async onLevelClicked(event?: any, customEventData?: string): Promise<void> {
        let levelId = 1;
        if (customEventData) {
            levelId = parseInt(customEventData, 10);
        } else if (typeof event === 'number') {
            levelId = event;
        }

        try {
            await GameManager.Instance?.startLevel(levelId);
        } catch (err) {
            console.error(`[LevelSelectPanel] Failed to start level ${levelId}:`, err);
        }
    }
}
