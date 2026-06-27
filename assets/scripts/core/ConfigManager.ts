import { IGameConfig } from '../interfaces/IGameConfig';
import { DataLoader } from './DataLoader';

/**
 * ConfigManager - Quản lý game config toàn cục.
 * Load game_config.json khi khởi động và cung cấp API truy xuất.
 */
export class ConfigManager {
    private static _instance: ConfigManager;
    private _config: IGameConfig | null = null;

    private constructor() {}

    public static getInstance(): ConfigManager {
        if (!ConfigManager._instance) {
            ConfigManager._instance = new ConfigManager();
        }
        return ConfigManager._instance;
    }

    /** Load config khi game start */
    public async loadConfig(): Promise<void> {
        this._config = await DataLoader.loadJson<IGameConfig>('data/config/game_config');
    }

    /** Lấy toàn bộ config */
    public getConfig(): IGameConfig | null {
        return this._config;
    }

    /** Lấy cấu hình booster theo type string */
    public getBoosterConfig(id: string) {
        if (!this._config) return null;
        return this._config.boosters.find(b => b.id === id) || null;
    }

    /** Lấy cấu hình audio theo key */
    public getAudioConfig(key: string) {
        if (!this._config) return null;
        return this._config.audio.find(a => a.key === key) || null;
    }

    /** Lấy giá trị gameplay config */
    public getGameplayValue<K extends keyof IGameConfig['gameplay']>(key: K): IGameConfig['gameplay'][K] | null {
        if (!this._config) return null;
        return this._config.gameplay[key];
    }

    /** Lấy default skin ID */
    public getDefaultSkinId(): string {
        return this._config?.defaults.skinId || 'default';
    }
}
