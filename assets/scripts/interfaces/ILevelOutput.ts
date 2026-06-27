import { IBoardConfig } from './IBoardConfig';
import { ITileData } from './ITileData';
import { ITrayConfig } from './ITrayConfig';
import { IDifficultyConfig } from './IDifficultyConfig';

/**
 * Output JSON của SmartLevelGenerator.
 * Định dạng này thay thế / mở rộng ILevelData để hỗ trợ solution-based generation.
 */
export interface ILevelOutput {
    /** ID level */
    levelId: number;

    /** Tên hiển thị */
    displayName?: string;

    /** Skin mặc định */
    defaultSkin?: string;

    /** Cấu hình board */
    board: IBoardConfig;

    /** Danh sách tile trong level */
    tiles: ITileData[];

    /** Cấu hình tray */
    tray: ITrayConfig;

    /** Cấu hình độ khó đã dùng để generate */
    difficultyConfig: IDifficultyConfig;

    /** Thứ tự giải đúng: mỗi phần tử là 1 bộ 3 groupId */
    solutionSteps: string[][];
}
