/**
 * Enum định nghĩa các loại UI panel trong game.
 * UIManager dùng để mở/đóng panel theo type.
 */
export enum UIPanelType {
    NONE = 0,
    MAIN_MENU = 1,
    LEVEL_SELECT = 2,
    GAMEPLAY_HUD = 3,
    PAUSE = 4,
    LEVEL_COMPLETE = 5,
    LEVEL_FAILED = 6,
    SETTINGS = 7,
    SHOP = 8,
    BOOSTER_CONFIRM = 9,
    TUTORIAL = 10,
}
