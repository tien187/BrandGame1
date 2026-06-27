 import { IBoosterConfig } from './IBoosterConfig';
import { IAudioConfig } from './IAudioConfig';

/**
 * Interface cấu hình toàn game - ánh xạ với game_config.json.
 * ConfigManager load file này khi khởi động.
 */
export interface IGameConfig {
    /** Phiên bản config */
    version: string;

    /** Cấu hình mặc định */
    defaults: {
        skinId: string;
        musicVolume: number;
        sfxVolume: number;
        language: string;
    };

    /** Danh sách booster */
    boosters: IBoosterConfig[];

    /** Danh sách audio clips */
    audio: IAudioConfig[];

    /** Cấu hình gameplay */
    gameplay: {
        tileMoveDuration: number;
        matchDelay: number;
        shuffleCooldown: number;
        hintCooldown: number;
        trayShakeIntensity: number;
    };
}
