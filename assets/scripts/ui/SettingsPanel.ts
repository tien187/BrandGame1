import { _decorator, Component, Slider, Toggle } from 'cc';
import { BasePanel } from './BasePanel';
import { AudioManager } from '../managers/AudioManager';

const { ccclass, property } = _decorator;

/**
 * SettingsPanel - Màn hình cài đặt.
 * Âm lượng, ngôn ngữ, thông tin game.
 */
@ccclass('SettingsPanel')
export class SettingsPanel extends BasePanel {
    @property(Slider)
    public musicSlider: Slider | null = null;

    @property(Slider)
    public sfxSlider: Slider | null = null;

    @property(Toggle)
    public musicToggle: Toggle | null = null;

    @property(Toggle)
    public sfxToggle: Toggle | null = null;

    protected onShow(data?: any): void {
        super.onShow(data);
        this.setupListeners();
    }

    protected onHide(): void {
        this.removeListeners();
    }

    private setupListeners(): void {
        if (this.musicSlider) {
            this.musicSlider.node.on('slide', this.onMusicVolumeChanged, this);
        }
        if (this.sfxSlider) {
            this.sfxSlider.node.on('slide', this.onSfxVolumeChanged, this);
        }
        if (this.musicToggle) {
            this.musicToggle.node.on('toggle', this.onMusicToggle, this);
        }
        if (this.sfxToggle) {
            this.sfxToggle.node.on('toggle', this.onSfxToggle, this);
        }
    }

    private removeListeners(): void {
        if (this.musicSlider) {
            this.musicSlider.node.off('slide', this.onMusicVolumeChanged, this);
        }
        if (this.sfxSlider) {
            this.sfxSlider.node.off('slide', this.onSfxVolumeChanged, this);
        }
        if (this.musicToggle) {
            this.musicToggle.node.off('toggle', this.onMusicToggle, this);
        }
        if (this.sfxToggle) {
            this.sfxToggle.node.off('toggle', this.onSfxToggle, this);
        }
    }

    private onMusicVolumeChanged(slider: Slider): void {
        AudioManager.getInstance().setMusicVolume(slider.progress);
    }

    private onSfxVolumeChanged(slider: Slider): void {
        AudioManager.getInstance().setSfxVolume(slider.progress);
    }

    private onMusicToggle(toggle: Toggle): void {
        AudioManager.getInstance().toggleMusicMute();
    }

    private onSfxToggle(toggle: Toggle): void {
        AudioManager.getInstance().toggleSfxMute();
    }
}
