import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/**
 * AudioManager - Tạm thời vô hiệu hóa toàn bộ âm thanh
 * để tránh lỗi decodeAudioData trên web preview.
 * Giữ interface để không break các caller.
 */
@ccclass('AudioManager')
export class AudioManager extends Component {
    public static Instance: AudioManager;
    public static getInstance(): AudioManager { return AudioManager.Instance; }

    protected onLoad(): void {
        if (AudioManager.Instance) { this.destroy(); return; }
        AudioManager.Instance = this;
    }

    public async initialize(): Promise<void> { /* no-op */ }
    public async playSfx(_key: string): Promise<void> { /* no-op */ }
    public async playUi(_key: string): Promise<void> { /* no-op */ }
    public async playMusic(_key: string): Promise<void> { /* no-op */ }
    public stopMusic(): void { /* no-op */ }
    public pauseMusic(): void { /* no-op */ }
    public resumeMusic(): void { /* no-op */ }
    public setMusicVolume(_volume: number): void { /* no-op */ }
    public setSfxVolume(_volume: number): void { /* no-op */ }
    public toggleMusicMute(): void { /* no-op */ }
    public toggleSfxMute(): void { /* no-op */ }

    protected onDestroy(): void {
        if (AudioManager.Instance === this) {
            AudioManager.Instance = null;
        }
    }
}
