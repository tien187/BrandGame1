/**
 * Enum định nghĩa các loại booster hỗ trợ người chơi.
 * Dữ liệu chi tiết (cost, effect) lưu trong JSON config.
 */
export enum BoosterType {
    NONE = 0,
    UNDO = 1,         // Hoàn tác nước đi cuối
    SHUFFLE = 2,      // Xáo trộn các tile trên board
    HINT = 3,         // Gợi ý tile có thể match
    REMOVE = 4,       // Bỏ 3 tile khỏi tray
    MAGNET = 5,       // Hút các tile cùng loại vào tray
    SKIP = 6,         // Skip current level
}
