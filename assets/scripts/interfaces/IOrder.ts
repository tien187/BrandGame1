/**
 * Interface định nghĩa một order trong Order Match.
 */
export interface IOrder {
    /** ID duy nhất của order */
    id: string;

    /** Danh sách item cần thu thập theo đúng thứ tự */
    items: string[];
}
