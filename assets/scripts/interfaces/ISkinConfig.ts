import { SkinCategory } from '../enums/SkinCategory';

/**
 * Interface cấu hình skin - định nghĩa một bộ skin có thể reskin.
 * SkinManager load file này và thay thế asset theo mapping.
 */
export interface ISkinConfig {
    /** ID duy nhất của skin */
    skinId: string;

    /** Tên hiển thị */
    displayName: string;

    /** Mapping category -> danh sách asset replacement */
    assets: Record<SkinCategory, ISkinAsset[]>;

    /** Màu chủ đạo của skin (dùng cho UI tint) */
    themeColors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
    };

    /** Font mặc định của skin */
    defaultFont: string;

    /** Danh sách groupId có sẵn trong skin (dùng cho LevelGenerator) */
    itemGroups?: string[];
}

/** Một asset replacement trong skin */
export interface ISkinAsset {
    /** Key logic (dùng trong code) */
    key: string;

    /** Đường dẫn asset thực tế trong resources */
    path: string;

    /** Loại asset: sprite, prefab, audio, font */
    assetType: 'sprite' | 'prefab' | 'audio' | 'font' | 'particle';
}
