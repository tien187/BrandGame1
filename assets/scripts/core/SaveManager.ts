import { sys } from 'cc';

/**
 * SaveManager - Lưu/đọc tiến trình chơi trên thiết bị.
 * Pure singleton, dùng localStorage.
 */
export class SaveManager {
    private static _instance: SaveManager;
    private static readonly KEY = 'MiniGame1_currentLevel';

    private constructor() {}

    public static getInstance(): SaveManager {
        if (!SaveManager._instance) {
            SaveManager._instance = new SaveManager();
        }
        return SaveManager._instance;
    }

    public saveCurrentLevel(levelId: number): void {
        try {
            sys.localStorage.setItem(SaveManager.KEY, `${levelId}`);
        } catch (err) {
            console.warn('[SaveManager] Failed to save current level:', err);
        }
    }

    public getCurrentLevel(): number {
        try {
            const value = sys.localStorage.getItem(SaveManager.KEY);
            if (value === null || value === '') return 0;
            const num = parseInt(value, 10);
            return isNaN(num) ? 0 : num;
        } catch (err) {
            console.warn('[SaveManager] Failed to load current level:', err);
            return 0;
        }
    }

    public clear(): void {
        try {
            sys.localStorage.removeItem(SaveManager.KEY);
        } catch (err) {
            console.warn('[SaveManager] Failed to clear save:', err);
        }
    }

    public static reset(): void {
        SaveManager._instance = null;
    }
}
