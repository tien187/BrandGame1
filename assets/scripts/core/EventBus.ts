import { EventTarget } from 'cc';

/**
 * EventBus - Hệ thống sự kiện toàn cục singleton.
 * Giải coupling giữa các manager: không cần import trực tiếp nhau.
 * Dùng GameEvent enum làm key.
 */
export class EventBus {
    private static _instance: EventBus;
    private _eventTarget: EventTarget;

    private constructor() {
        this._eventTarget = new EventTarget();
    }

    public static getInstance(): EventBus {
        if (!EventBus._instance) {
            EventBus._instance = new EventBus();
        }
        return EventBus._instance;
    }

    /** Đăng ký lắng nghe sự kiện */
    public on(event: string, callback: (...args: any[]) => void, target?: any): void {
        this._eventTarget.on(event, callback, target);
    }

    /** Hủy đăng ký */
    public off(event: string, callback: (...args: any[]) => void, target?: any): void {
        this._eventTarget.off(event, callback, target);
    }

    /** Phát sự kiện một lần */
    public once(event: string, callback: (...args: any[]) => void, target?: any): void {
        this._eventTarget.once(event, callback, target);
    }

    /** Phát sự kiện kèm dữ liệu */
    public emit(event: string, ...args: any[]): void {
        this._eventTarget.emit(event, ...args);
    }
}
