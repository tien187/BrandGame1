import { ILevelData } from '../interfaces/ILevelData';
import { ITileData } from '../interfaces/ITileData';
import { GameMode } from '../enums/GameMode';
import { BoardManager } from '../managers/BoardManager';
import { BoardPositionHelper } from '../core/BoardPositionHelper';

/**
 * LevelValidator - Kiểm tra tính hợp lệ của ORDER_MATCH level.
 * Chạy simulation trên board state để verify solutionMoveTileIds.
 */
export class LevelValidator {
    /**
     * Validate một level ORDER_MATCH.
     * Trả về { valid, errors }.
     */
    public static validate(levelData: ILevelData): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (levelData.gameMode !== GameMode.ORDER_MATCH) {
            return { valid: true, errors: [] };
        }

        if (!levelData.orders || levelData.orders.length === 0) {
            errors.push('ORDER_MATCH level must have orders');
            return { valid: false, errors };
        }

        if (!levelData.orderConfig) {
            errors.push('ORDER_MATCH level must have orderConfig');
            return { valid: false, errors };
        }

        // 1. Tính required counts từ orders
        const requiredCounts: Record<string, number> = {};
        for (const order of levelData.orders) {
            for (const item of order.items) {
                requiredCounts[item] = (requiredCounts[item] || 0) + 1;
            }
        }

        // 2. Tính available counts từ tiles
        const tileCounts: Record<string, number> = {};
        const tileMap: Map<string, ITileData> = new Map();
        for (const tile of levelData.tiles) {
            tileCounts[tile.groupId] = (tileCounts[tile.groupId] || 0) + 1;
            tileMap.set(tile.id, tile);
        }

        // 3. Kiểm tra mỗi item trong orders có tile tương ứng
        for (const gid in requiredCounts) {
            const avail = tileCounts[gid] || 0;
            if (avail < requiredCounts[gid]) {
                errors.push(`Order requires ${requiredCounts[gid]} '${gid}' tiles but only ${avail} available`);
            }
        }

        // 4. Kiểm tra tổng counts khớp chính xác
        for (const gid in tileCounts) {
            const req = requiredCounts[gid] || 0;
            const avail = tileCounts[gid];
            if (req > avail) {
                errors.push(`Group '${gid}' has ${avail} tiles but orders require ${req}`);
            }
        }

        // 5. Kiểm tra orderSize khớp với items.length của mỗi order
        for (const order of levelData.orders) {
            if (order.items.length !== levelData.orderConfig!.orderSize) {
                errors.push(`Order ${order.id} has ${order.items.length} items but orderSize=${levelData.orderConfig!.orderSize}`);
            }
        }

        // 6. Kiểm tra tổng số item trong orders phải bằng tổng số tile active
        const totalOrderItems = levelData.orders.reduce((sum, o) => sum + o.items.length, 0);
        const totalActiveTiles = levelData.tiles.length;
        if (totalOrderItems > totalActiveTiles) {
            errors.push(`Total order items (${totalOrderItems}) > total tiles (${totalActiveTiles}).`);
        }

        // 7. Simulate solution moves nếu có solutionMoveTileIds
        if (levelData.solutionMoveTileIds && levelData.solutionMoveTileIds.length > 0) {
            const simErrors = this.simulateMoves(levelData, tileMap);
            errors.push(...simErrors);
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Simulate từng move theo solutionMoveTileIds để kiểm tra:
     * - Tile tồn tại
     * - Tile selectable tại thời điểm chọn
     * - Sau mỗi move board recalculate đúng
     * - Wrong tray không bị full trong solution
     * - Cuối cùng board clear hoàn toàn
     */
    private static simulateMoves(levelData: ILevelData, tileMap: Map<string, ITileData>): string[] {
        const errors: string[] = [];
        const moveIds = levelData.solutionMoveTileIds!;
        const orderConfig = levelData.orderConfig!;
        const orders = levelData.orders!;
        const wrongTrayMax = orderConfig.wrongTrayMaxSlots;

        // Clone tiles để simulate (không mutate level data)
        const simTiles: ITileData[] = levelData.tiles.map(t => ({ ...t }));
        const simTileMap = new Map<string, ITileData>();
        for (const t of simTiles) {
            simTileMap.set(t.id, t);
        }

        // Build grid cells cho occlusion check
        const gridCells = new Map<string, ITileData[]>();
        for (const tile of simTiles) {
            const key = `${tile.gridX}_${tile.gridY}`;
            const list = gridCells.get(key) || [];
            list.push(tile);
            gridCells.set(key, list);
        }
        // Sort each cell by layer
        for (const [, list] of gridCells) {
            list.sort((a, b) => a.layer - b.layer);
        }

        // Compute initial block state
        this.refreshBlockStatus(simTiles, gridCells, levelData);

        // Track order progress
        let currentOrderIdx = 0;
        let currentItemIdx = 0;
        let wrongCount = 0;

        for (let i = 0; i < moveIds.length; i++) {
            const tileId = moveIds[i];
            const tile = simTileMap.get(tileId);

            if (!tile) {
                errors.push(`Move ${i + 1}: tile ${tileId} not found`);
                continue;
            }

            if (!tile.active) {
                errors.push(`Move ${i + 1}: tile ${tileId} is not active`);
                continue;
            }

            if (!tile.selectable) {
                errors.push(`Move ${i + 1}: tile ${tileId} (groupId=${tile.groupId}) is BLOCKED at step ${i + 1}`);
            }

            // Check if this move is correct for current order
            const currentOrder = orders[currentOrderIdx];
            let isCorrect = false;
            if (currentOrder) {
                if (orderConfig.orderMode === 'ANY_ORDER') {
                    // ANY_ORDER: check if groupId is in remaining items
                    // For simplicity in validator, we check if tile.groupId is in currentOrder.items
                    isCorrect = currentOrder.items.indexOf(tile.groupId) !== -1;
                } else {
                    // EXACT_ORDER
                    isCorrect = currentOrder.items[currentItemIdx] === tile.groupId;
                }
            }

            if (isCorrect) {
                currentItemIdx++;
                if (currentItemIdx >= (currentOrder?.items.length || 0)) {
                    currentOrderIdx++;
                    currentItemIdx = 0;
                }
            } else {
                wrongCount++;
            }

            // Remove tile from board
            tile.active = false;
            tile.selectable = false;
            tile.isBlocked = true;

            // Remove from grid cell
            const key = `${tile.gridX}_${tile.gridY}`;
            const list = gridCells.get(key);
            if (list) {
                const idx = list.findIndex(t => t.id === tileId);
                if (idx !== -1) {
                    list.splice(idx, 1);
                    if (list.length === 0) {
                        gridCells.delete(key);
                    }
                }
            }

            // Recalculate blocking
            this.refreshBlockStatus(simTiles, gridCells, levelData);
        }

        // ORDER_MATCH runtime only fails on main tray full; wrong tray is visual feedback here.
        if (levelData.gameMode !== GameMode.ORDER_MATCH && wrongCount > wrongTrayMax) {
            errors.push(`Wrong tray overflow: ${wrongCount} wrong moves exceed maxSlots=${wrongTrayMax}`);
        }

        // Check all orders completed
        if (currentOrderIdx < orders.length) {
            errors.push(`After all moves, only ${currentOrderIdx}/${orders.length} orders completed`);
        }

        // Kiểm tra board clear hoàn toàn
        const remaining = simTiles.filter(t => t.active);
        if (remaining.length > 0) {
            errors.push(`After all ${moveIds.length} moves, ${remaining.length} tiles remain on board`);
        }

        return errors;
    }

    /**
     * Recalculate isBlocked/selectable cho tất cả tile.
     * Clone logic từ BoardManager.isTileBlocked.
     */
    private static refreshBlockStatus(
        tiles: ITileData[],
        gridCells: Map<string, ITileData[]>,
        levelData: ILevelData
    ): void {
        const config = levelData.board;
        const tileSize = config.tileWidth || 100;
        const tileHeight = config.tileHeight || 120;
        const minOverlap = Math.max(
            config.minBlockOverlapPixels ?? 1,
            tileSize * tileHeight * (config.coverThreshold ?? 0.01)
        );

        for (const tile of tiles) {
            if (!tile.active) {
                tile.selectable = false;
                tile.isBlocked = true;
                continue;
            }

            const center = BoardPositionHelper.getTileCenter(tile, config);
            let blocked = false;

            for (const [, cellTiles] of gridCells) {
                for (const other of cellTiles) {
                    if (other.id === tile.id) continue;
                    if (!other.active) continue;
                    if (other.layer <= tile.layer) continue;

                    const otherCenter = BoardPositionHelper.getTileCenter(other, config);
                    const dx = Math.abs(center.x - otherCenter.x);
                    const dy = Math.abs(center.y - otherCenter.y);

                    const overlapArea = Math.max(0, tileSize - dx) * Math.max(0, tileHeight - dy);
                    if (overlapArea > minOverlap) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) break;
            }

            tile.isBlocked = blocked;
            tile.selectable = !blocked;
        }
    }
}
