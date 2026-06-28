/**
 * Enum định nghĩa các sự kiện toàn cục trong game.
 * Dùng với EventBus để giải coupling giữa các module.
 */
export enum GameEvent {
    STATE_CHANGED = 'state_changed',
    LEVEL_LOADED = 'level_loaded',
    LEVEL_STARTED = 'level_started',
    LEVEL_COMPLETED = 'level_completed',
    LEVEL_FAILED = 'level_failed',
    TILE_CLICKED = 'tile_clicked',
    TILE_ADDED_TO_TRAY = 'tile_added_to_tray',
    TILES_MATCHED = 'tiles_matched',
    TRAY_FULL = 'tray_full',
    SCORE_CHANGED = 'score_changed',
    BOOSTER_USED = 'booster_used',
    SKIN_CHANGED = 'skin_changed',
    AUDIO_TOGGLE = 'audio_toggle',
    PAUSE_GAME = 'pause_game',
    RESUME_GAME = 'resume_game',
    ORDER_CHANGED = 'order_changed',
    ORDER_COMPLETED = 'order_completed',
    ALL_ORDERS_COMPLETED = 'all_orders_completed',
    WRONG_TRAY_FULL = 'wrong_tray_full',
    ORDER_ITEM_CORRECT = 'order_item_correct',
    ORDER_ITEM_WRONG = 'order_item_wrong',
    TRAY_SETTLED = 'tray_settled',
    ORDER_TILES_CLEARED = 'order_tiles_cleared',
    HINT_FAILED = 'hint_failed',
    LEVEL_TIME_UPDATED = 'level_time_updated',
}
