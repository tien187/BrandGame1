import { TileType } from '../enums/TileType';

/**
 * Interface dữ liệu tile - định nghĩa một tile trong level JSON.
 * Grid-based: vị trí tính từ gridX, gridY, layer.
 * Không chứa logic runtime, chỉ là data thuần túy.
 */
export interface ITileData {
    /** ID duy nhất của tile instance */
    id: string;

    /** ID nhóm tile (dùng để match 3 cùng nhóm) */
    groupId: string;

    /** Loại tile đặc biệt (NORMAL, WILD, FROZEN, LOCKED, BOMB) */
    tileType: TileType;

    /** Vị trí X trên grid */
    gridX: number;

    /** Vị trí Y trên grid */
    gridY: number;

    /** Layer / độ sâu của tile (chỉ dùng cho rendering order và occlusion check) */
    layer: number;

    /** Tile này có đang active không (đã bị xóa = false) */
    active: boolean;

    /** Tile này có thể được chọn không (tính runtime từ occlusion) */
    selectable: boolean;

    /** Tile này có bị che quá mức coverThreshold không */
    isBlocked: boolean;

    /** ID các tile đang che phủ tile này */
    blockedBy?: string[];

    /** Skin override cụ thể cho tile này (tùy chọn) */
    skinOverride?: string;
}

/** Vị trí grid-based của tile trên board */
export interface ITilePosition {
    gridX: number;
    gridY: number;
    layer: number;
}
