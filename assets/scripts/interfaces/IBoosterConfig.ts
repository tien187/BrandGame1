import { BoosterType } from '../enums/BoosterType';

/**
 * Interface cấu hình booster - dùng cho game config JSON.
 */
export interface IBoosterConfig {
    /** Loại booster */
    type: BoosterType;

    /** ID string để lookup */
    id: string;

    /** Tên hiển thị */
    displayName: string;

    /** Mô tả */
    description: string;

    /** Giá mua bằng coin (hoặc hard currency) */
    coinCost: number;

    /** Giá mua bằng gem (soft/hard currency) */
    gemCost: number;

    /** Số lượng tối đa người chơi có thể giữ */
    maxStack: number;

    /** Icon asset key (qua SkinManager) */
    iconKey: string;

    /** Effect prefab key (qua SkinManager) */
    effectKey?: string;
}
