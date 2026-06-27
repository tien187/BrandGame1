/**
 * Interface cấu hình độ khó cho Smart Level Generator.
 */
export interface IDifficultyConfig {
    /** Mức độ khó (1-N) */
    difficulty: number;

    /** Số layer trên board */
    layerCount: number;

    /** Số loại tile (groupId) khác nhau có thể xuất hiện trong level */
    tileTypeCount: number;

    /** Tổng số bộ 3 tile trong level */
    totalTriplets: number;

    /** Số bộ 3 đầu tiên được đảm bảo an toàn (không trap) */
    safeMoveWindow: number;

    /** Tỷ lệ tile gây nhiễu / trap (0-1) */
    trapRate: number;

    /** Giới hạn số bộ 3 có ít nhất 1 tile selectable từ đầu */
    visibleTripletLimit: number;

    /** Ngưỡng che phủ để tile bị block (0-1) */
    coverThreshold: number;
}
