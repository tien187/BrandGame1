/**
 * Interface cấu hình Order Match.
 */
export interface IOrderConfig {
    /** Số item trong mỗi order (thường là 3) */
    orderSize: number;

    /** Chế độ order */
    orderMode: 'EXACT_ORDER' | 'ANY_ORDER';

    /** Số slot tối đa trong wrong tray */
    wrongTrayMaxSlots: number;

    /**
     * true: chọn sai vẫn lấy tile khỏi board và đưa vào wrong tray.
     * false: chọn sai không lấy tile khỏi board, chỉ báo lỗi/rung tile.
     */
    consumeWrongTile: boolean;
}
