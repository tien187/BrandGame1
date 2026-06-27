/**
 * Enum phân loại tile theo gameplay.
 * Có thể mở rộng thêm các loại tile đặc biệt (wild, bomb...)
 */
export enum TileType {
    NORMAL = 0,
    WILD = 1,      // Tile đại diện cho mọi loại
    FROZEN = 2,    // Tile cần match trước khi có thể chọn
    LOCKED = 3,    // Tile bị khóa cho đến khi điều kiện đạt
    BOMB = 4,      // Tile nổ xóa xung quanh
}
