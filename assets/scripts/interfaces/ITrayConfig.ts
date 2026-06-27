/**
 * Interface cấu hình tray (thanh chứa tile người chơi chọn).
 */
export interface ITrayConfig {
    /** Số slot tối đa trong tray (thường là 7) */
    maxSlots: number;

    /** Số tile cần match để clear (thường là 3) */
    matchCount: number;

    /** Vị trí hiển thị tray trên màn hình */
    screenPosition: { x: number; y: number };

    /** Khoảng cách giữa các slot */
    slotSpacing: number;
}
