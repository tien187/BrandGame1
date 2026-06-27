/**
 * Interface cấu hình board - định nghĩa kích thước và cấu trúc board.
 */
export interface IBoardConfig {
    /** Số hàng của board */
    rows: number;

    /** Số cột của board */
    cols: number;

    /** Số layer tối đa */
    maxLayers: number;

    /** Khoảng cách giữa các tile (world units) - dùng cho cả X và Y nếu không có tileSpacingX/Y */
    tileSpacing: number;

    /** Khoảng cách giữa các tile theo trục X (ưu tiên hơn tileSpacing) */
    tileSpacingX?: number;

    /** Khoảng cách giữa các tile theo trục Y (ưu tiên hơn tileSpacing) */
    tileSpacingY?: number;

    /** Offset tâm board */
    centerOffset: { x: number; y: number };

    /** Kích thước tile theo trục X (world units) */
    tileWidth?: number;

    /** Kích thước tile theo trục Y (world units) */
    tileHeight?: number;

    /** Độ lệch jitter theo trục X (tỷ lệ, ví dụ 0.5 = ±50% tileWidth) */
    jitterX?: number;

    /** Độ lệch jitter theo trục Y (tỷ lệ, ví dụ 0.5 = ±50% tileHeight) */
    jitterY?: number;

    /** Chế độ jitter ('layer' | 'random') */
    jitterMode?: string;

    /** Chế độ block ('overlap' | 'sameCell') */
    blockMode?: string;

    /** Ngưỡng diện tích overlap tối thiểu (pixel) để tile bị block */
    minBlockOverlapPixels?: number;

    /** Ngưỡng che phủ để tile bị block (0-1, legacy) */
    coverThreshold: number;

    /** Pattern tạo hình dạng board (nếu board không phải hình chữ nhật) */
    shapePattern?: number[][];
}
