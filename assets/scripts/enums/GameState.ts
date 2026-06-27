/**
 * Enum định nghĩa các trạng thái của game.
 * Dùng cho state machine của GameManager.
 */
export enum GameState {
    NONE = 0,
    LOADING = 1,
    MAIN_MENU = 2,
    LEVEL_SELECT = 3,
    GAMEPLAY = 4,
    PAUSED = 5,
    LEVEL_COMPLETE = 6,
    LEVEL_FAILED = 7,
    BOOSTER_ACTIVE = 8,
}
