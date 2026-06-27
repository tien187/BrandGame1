import { IBoardConfig } from '../interfaces/IBoardConfig';
import { ITileData, ITilePosition } from '../interfaces/ITileData';

/**
 * BoardPositionHelper - Tính toán vị trí, jitter và overlap giữa các tile.
 * Dùng chung cho BoardManager (runtime) và LevelSolver (validation).
 */
export class BoardPositionHelper {

    /** Jitter xác định từ layer seed (không random runtime) */
    public static getLayerJitter(layer: number, axis: number, config: IBoardConfig): number {
        const prime1 = 15485863;
        const prime2 = 32452843;
        const seed = Math.abs(layer * prime1 + axis * prime2);

        const jitterMultiplier = axis === 0
            ? (config.jitterX ?? 0.3)
            : (config.jitterY ?? 0.3);
        const size = axis === 0
            ? (config.tileWidth ?? 100)
            : (config.tileHeight ?? 120);

        return ((seed % 100) / 100 - 0.5) * size * jitterMultiplier;
    }

    /** Tính tâm tile theo công thức mới */
    public static getTileCenter(tile: ITilePosition, config: IBoardConfig): { x: number; y: number } {
        const spacingX = config.tileSpacingX ?? config.tileSpacing;
        const spacingY = config.tileSpacingY ?? config.tileSpacing;
        const jitterX = this.getLayerJitter(tile.layer, 0, config);
        const jitterY = this.getLayerJitter(tile.layer, 1, config);
        const x = config.centerOffset.x + tile.gridX * spacingX + jitterX;
        const y = config.centerOffset.y - tile.gridY * spacingY + jitterY;
        return { x, y };
    }

    /** Tính diện tích overlap (pixel²) giữa 2 tile */
    public static calculateOverlapArea(
        tileA: ITilePosition,
        tileB: ITilePosition,
        config: IBoardConfig
    ): number {
        const tileW = config.tileWidth ?? 100;
        const tileH = config.tileHeight ?? 120;
        if (tileW <= 0 || tileH <= 0) return 0;

        const centerA = this.getTileCenter(tileA, config);
        const centerB = this.getTileCenter(tileB, config);

        const overlapW = Math.max(0, tileW - Math.abs(centerA.x - centerB.x));
        const overlapH = Math.max(0, tileH - Math.abs(centerA.y - centerB.y));

        return overlapW * overlapH;
    }

    /** Kiểm tra tile có bị block không dựa trên overlap với tile ở layer cao hơn */
    public static isTileBlocked(
        tile: ITileData,
        allTiles: ITileData[],
        config: IBoardConfig
    ): boolean {
        if (!tile.active) return true;

        const blockMode = config.blockMode ?? 'overlap';
        if (blockMode === 'sameCell') {
            for (const other of allTiles) {
                if (other.id === tile.id) continue;
                if (!other.active) continue;
                if (other.gridX === tile.gridX && other.gridY === tile.gridY && other.layer > tile.layer) {
                    return true;
                }
            }
            return false;
        }

        const tileArea = (config.tileWidth ?? 100) * (config.tileHeight ?? 120);
        const minOverlap = Math.max(config.minBlockOverlapPixels ?? 1, tileArea * (config.coverThreshold ?? 0.01));
        let totalOverlap = 0;
        for (const other of allTiles) {
            if (other.id === tile.id) continue;
            if (!other.active) continue;
            if (other.layer <= tile.layer) continue;

            const overlap = this.calculateOverlapArea(tile, other, config);
            totalOverlap += overlap;
            // Early exit nếu đã vượt ngưỡng
            if (totalOverlap > minOverlap) return true;
        }
        return false;
    }
}
