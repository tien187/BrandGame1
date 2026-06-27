import { AudioType } from '../enums/AudioType';

/**
 * Interface cấu hình audio clip - dùng trong game config JSON.
 */
export interface IAudioConfig {
    /** Key logic để phát nhạc */
    key: string;

    /** Đường dẫn file audio trong resources */
    path: string;

    /** Loại audio: SFX, Music, UI */
    type: AudioType;

    /** Lặp lại (chỉ áp dụng cho music) */
    loop: boolean;

    /** Âm lượng mặc định (0-1) */
    volume: number;
}
