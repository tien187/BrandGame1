import { ITileData } from './ITileData';
import { IBoardConfig } from './IBoardConfig';
import { ITrayConfig } from './ITrayConfig';
import { IOrderConfig } from './IOrderConfig';
import { IOrder } from './IOrder';

/**
 * Interface dữ liệu level - ánh xạ 1:1 với file JSON level.
 * LevelManager load file này và truyền cho BoardManager khởi tạo.
 */
export interface ILevelData {
    /** ID level */
    levelId: number;

    /** Tên hiển thị */
    displayName: string;

    /** Chế độ chơi (TRIPLE_MATCH | ORDER_MATCH) */
    gameMode?: string;

    /** Cấu hình board */
    board: IBoardConfig;

    /** Cấu hình tray */
    tray: ITrayConfig;

    /** Cấu hình order (chỉ dùng khi gameMode = ORDER_MATCH) */
    orderConfig?: IOrderConfig;

    /** Danh sách order (chỉ dùng khi gameMode = ORDER_MATCH) */
    orders?: IOrder[];

    /** Danh sách tile trong level */
    tiles: ITileData[];

    /** Danh sách groupIds theo đúng thứ tự người chơi cần chọn (ORDER_MATCH) */
    solutionOrders?: string[][];

    /** Danh sách tile IDs theo đúng thứ tự người chơi cần tap (ORDER_MATCH) */
    solutionMoveTileIds?: string[];

    /** Số sao yêu cầu để đạt (tùy chọn) */
    starThresholds?: number[];

    /** Thời gian giới hạn (0 = không giới hạn) */
    timeLimit?: number;

    /** Số lượt giới hạn (0 = không giới hạn) */
    moveLimit?: number;

    /** Booster cho sẵn trong level */
    startingBoosters?: Record<string, number>;

    /** Skin mặc định của level (hỗ trợ reskin) */
    defaultSkin?: string;
}
