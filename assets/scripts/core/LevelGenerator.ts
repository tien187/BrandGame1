import { ITileData } from '../interfaces/ITileData';

/**
 * LevelGenerator - Sinh tile data cho các shapes và layer progression.
 * Hỗ trợ shapes: Rectangle, Diamond, Pyramid, U, Heart, House, Leaf, Bowl, Hourglass, Stair.
 */
export class LevelGenerator {

    /** Shape definitions: 2D array 0/1 cho biết cell nào có tile */
    public static readonly SHAPES: Record<string, number[][]> = {
        rectangle: [
            [1,1,1,1,1,1],
            [1,1,1,1,1,1],
            [1,1,1,1,1,1],
            [1,1,1,1,1,1],
            [1,1,1,1,1,1],
            [1,1,1,1,1,1],
        ],
        diamond: [
            [0,0,0,1,0,0,0],
            [0,0,1,1,1,0,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
            [0,1,1,1,1,1,0],
            [0,0,1,1,1,0,0],
            [0,0,0,1,0,0,0],
        ],
        pyramid: [
            [0,0,0,1,0,0,0],
            [0,0,1,1,1,0,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
        ],
        ushape: [
            [1,0,0,0,0,1],
            [1,0,0,0,0,1],
            [1,0,0,0,0,1],
            [1,1,1,1,1,1],
            [1,1,1,1,1,1],
        ],
        heart: [
            [0,1,1,0,1,1,0],
            [1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1],
            [0,1,1,1,1,1,0],
            [0,0,1,1,1,0,0],
            [0,0,0,1,0,0,0],
        ],
        house: [
            [0,0,0,1,0,0,0],
            [0,0,1,1,1,0,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1],
            [1,1,1,0,1,1,1],
        ],
        leaf: [
            [0,0,0,1,0,0,0],
            [0,0,1,1,1,0,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
            [0,1,1,1,1,1,0],
            [0,0,1,1,1,0,0],
            [0,0,0,1,0,0,0],
        ],
        bowl: [
            [0,0,1,1,1,0,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1],
            [0,1,1,1,1,1,0],
            [0,0,1,1,1,0,0],
        ],
        hourglass: [
            [1,1,1,1,1,1,1],
            [0,1,1,1,1,1,0],
            [0,0,1,1,1,0,0],
            [0,0,0,1,0,0,0],
            [0,0,1,1,1,0,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
        ],
        stair: [
            [1,0,0,0,0,0],
            [1,1,0,0,0,0],
            [1,1,1,0,0,0],
            [1,1,1,1,0,0],
            [1,1,1,1,1,0],
            [1,1,1,1,1,1],
        ],
    };

    /**
     * Sinh tiles cho một level.
     * @param levelId ID level
     * @param shapeName Tên shape từ SHAPES
     * @param layers Số layer
     * @param groupIds Danh sách groupId có thể dùng
     * @returns Danh sách ITileData
     */
    public static generateTiles(levelId: number, shapeName: string, layers: number, groupIds: string[]): ITileData[] {
        if (!groupIds || groupIds.length === 0) {
            throw new Error('LevelGenerator: groupIds must not be empty');
        }
        if (layers <= 0) layers = 1;
        if (layers > 20) layers = 20; // Hard cap để tránh quá nhiều tiles

        const shape = this.SHAPES[shapeName] || this.SHAPES.rectangle;
        const rows = shape.length;
        const cols = shape[0]?.length || 0;
        const tiles: ITileData[] = [];
        let idCounter = 0;

        // Tạo base tiles từ shape (layer 0)
        const baseTiles: { gridX: number; gridY: number }[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (shape[r][c] === 1) {
                    baseTiles.push({ gridX: c, gridY: r });
                }
            }
        }

        if (baseTiles.length === 0) {
            throw new Error('LevelGenerator: shape has no tiles');
        }

        // Số tile phải chia hết cho 3 (solvable)
        const totalTiles = baseTiles.length * layers;
        const adjustedTotal = Math.floor(totalTiles / 3) * 3;

        // Tạo assignedGroups sao cho mỗi group xuất hiện đúng bội số 3.
        // Mỗi vòng lặp thêm 3 tile cho một group, đảm bảo tổng luôn chia hết cho 3
        // và mỗi group có số lượng là bội số của 3 (tránh unsolvable level).
        const assignedGroups: string[] = [];
        let groupIndex = 0;
        while (assignedGroups.length < adjustedTotal) {
            const gid = groupIds[groupIndex % groupIds.length];
            assignedGroups.push(gid, gid, gid);
            groupIndex++;
        }
        // Shuffle group assignments để ngẫu nhiên hóa vị trí
        for (let i = assignedGroups.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = assignedGroups[i];
            assignedGroups[i] = assignedGroups[j];
            assignedGroups[j] = tmp;
        }

        // Tạo tiles cho mỗi layer
        for (let layer = 0; layer < layers; layer++) {
            for (let i = 0; i < baseTiles.length; i++) {
                if (idCounter >= assignedGroups.length) break;
                const pos = baseTiles[i];

                tiles.push({
                    id: `L${levelId}_T${idCounter}`,
                    groupId: assignedGroups[idCounter],
                    tileType: 0,
                    gridX: pos.gridX,
                    gridY: pos.gridY,
                    layer: layer,
                    active: true,
                    selectable: true,
                    isBlocked: false,
                });

                idCounter++;
                if (tiles.length >= adjustedTotal) break;
            }
            if (tiles.length >= adjustedTotal) break;
        }

        // Gán lại ID liên tục
        return this.balanceGroups(tiles, groupIds, levelId);
    }

    /** Gán lại ID liên tục cho tiles */
    private static balanceGroups(tiles: ITileData[], groupIds: string[], levelId: number): ITileData[] {
        // Gán lại ID liên tục giữ prefix levelId để debug dễ dàng
        for (let i = 0; i < tiles.length; i++) {
            const padded = i < 10 ? `00${i}` : i < 100 ? `0${i}` : `${i}`;
            tiles[i].id = `L${levelId}_T${padded}`;
        }
        return tiles;
    }

    /** Lấy số layer theo level progression (deterministic) */
    public static getLayerForLevel(levelId: number): number {
        if (levelId <= 10) return 2;
        if (levelId <= 30) return 3;
        if (levelId <= 60) return 4;
        if (levelId <= 100) return 5;
        // Deterministic pseudo-random dựa trên levelId để replay/test ổn định
        const pseudoRand = ((levelId * 16807) % 2147483647) % 3; // 0-2
        return 4 + pseudoRand; // 4-6
    }

    /** Lấy shape name theo level (lặp lại) */
    public static getShapeForLevel(levelId: number): string {
        const shapeNames = Object.keys(this.SHAPES);
        return shapeNames[(levelId - 1) % shapeNames.length];
    }
}
