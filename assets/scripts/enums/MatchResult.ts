/**
 * Enum kết quả của một lần kiểm tra match.
 * MatchManager trả về kết quả này sau khi xử lý.
 */
export enum MatchResult {
    NONE = 0,
    MATCHED = 1,
    NO_MATCH = 2,
    TRAY_FULL = 3,
    GAME_OVER = 4,
    LEVEL_COMPLETE = 5,
}
