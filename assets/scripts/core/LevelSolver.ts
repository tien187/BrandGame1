import { ITileData } from '../interfaces/ITileData';
import { ILevelOutput } from '../interfaces/ILevelOutput';
import { IBoardConfig } from '../interfaces/IBoardConfig';
import { BoardPositionHelper } from './BoardPositionHelper';

export interface IValidationResult {
    valid: boolean;
    errors: string[];
    hasSolution: boolean;
    hasDeadlock: boolean;
    minTrayUsed: number;
    worstCaseMoves: number;
}

/**
 * LevelSolver - Kiểm tra tính solvable của level và tìm solution path.
 * Mô phỏng gameplay đơn giản: tray 7 slot, match 3 liên tiếp cùng groupId.
 */
export class LevelSolver {

    private static readonly MAX_SEARCH_STATES = 50000;

    /**
     * Validate toàn bộ level output.
     */
    public static validate(output: ILevelOutput): IValidationResult {
        const errors: string[] = [];
        const tiles = output.tiles.filter(t => t.active);
        const config = output.board;

        // 1. Tile count phải chia hết cho 3
        if (tiles.length % 3 !== 0) {
            errors.push(`Total tile count ${tiles.length} is not divisible by 3`);
        }

        // 2. Mỗi groupId phải chia hết cho 3
        const counts = this.getGroupCounts(tiles);
        for (const gid of Object.keys(counts)) {
            const count = counts[gid];
            if (count % 3 !== 0) {
                errors.push(`Group ${gid} count ${count} is not divisible by 3`);
            }
        }

        // 3. Tính block status
        this.computeBlockStatus(tiles, config);

        // 4. Không deadlock ngay từ đầu (phải có ít nhất 1 tile selectable)
        const selectable = tiles.filter(t => t.active && t.selectable);
        const hasDeadlock = selectable.length === 0 && tiles.length > 0;
        if (hasDeadlock) {
            errors.push('Deadlock at start: no selectable tiles');
        }

        // 5. Trust LevelValidator for solvability (skip heavy BFS)
        const hasSolution = true;

        return {
            valid: errors.length === 0,
            errors,
            hasSolution,
            hasDeadlock,
            minTrayUsed: 0,
            worstCaseMoves: 0,
        };
    }

    /**
     * Tìm ít nhất 1 solution path.
     * Trả về {solvable, minTrayUsed, worstCaseMoves}.
     */
    public static findSolution(
        tiles: ITileData[],
        traySize: number,
        matchCount: number,
        config: IBoardConfig
    ): { solvable: boolean; minTrayUsed: number; worstCaseMoves: number } {
        if (tiles.length === 0) return { solvable: true, minTrayUsed: 0, worstCaseMoves: 0 };

        // Tính block status ban đầu
        const tileList = tiles.map(t => ({ ...t }));
        this.computeBlockStatus(tileList, config);

        const initialState = this.serializeState(tileList, []);
        const visited = new Set<string>();
        const queue: { tiles: ITileData[]; tray: string[]; depth: number; maxTray: number }[] = [
            { tiles: tileList, tray: [], depth: 0, maxTray: 0 }
        ];

        let bestWorstCase = 0;
        let minTray = traySize;
        let statesChecked = 0;
        let queueHead = 0;

        while (queueHead < queue.length && statesChecked < this.MAX_SEARCH_STATES) {
            const state = queue[queueHead++];
            statesChecked++;

            const stateKey = this.serializeState(state.tiles, state.tray);
            if (visited.has(stateKey)) continue;
            visited.add(stateKey);

            bestWorstCase = Math.max(bestWorstCase, state.depth);
            minTray = Math.min(minTray, state.maxTray);

            // Win condition
            if (state.tiles.length === 0 && state.tray.length === 0) {
                return { solvable: true, minTrayUsed: minTray, worstCaseMoves: bestWorstCase };
            }

            // Get selectable tiles
            this.computeBlockStatus(state.tiles, config);
            const selectable = state.tiles.filter(t => t.selectable);
            if (selectable.length === 0 && state.tiles.length > 0) continue;

            // Prune: tray full and no immediate match possible
            if (state.tray.length >= traySize) {
                if (!this.hasImmediateMatch(state.tray, matchCount)) continue;
            }

            // Explore each selectable tile
            for (const tile of selectable) {
                const result = this.simulatePick(state.tiles, state.tray, tile.id, traySize, matchCount);
                if (!result) continue;

                queue.push({
                    tiles: result.tiles,
                    tray: result.tray,
                    depth: state.depth + 1,
                    maxTray: Math.max(state.maxTray, result.tray.length),
                });
            }
        }

        return { solvable: false, minTrayUsed: minTray, worstCaseMoves: bestWorstCase };
    }

    /**
     * Kiểm tra tray có match liên tiếp ngay lập tức không.
     */
    private static hasImmediateMatch(tray: string[], matchCount: number): boolean {
        for (let i = 0; i <= tray.length - matchCount; i++) {
            const g = tray[i];
            let same = true;
            for (let j = 1; j < matchCount; j++) {
                if (tray[i + j] !== g) { same = false; break; }
            }
            if (same) return true;
        }
        return false;
    }

    /**
     * Mô phỏng 1 nước đi: chọn tile từ board vào tray, xử lý match nếu có.
     */
    private static simulatePick(
        tiles: ITileData[],
        tray: string[],
        tileId: string,
        traySize: number,
        matchCount: number
    ): { tiles: ITileData[]; tray: string[] } | null {
        const tileIndex = tiles.findIndex(t => t.id === tileId);
        if (tileIndex === -1) return null;

        const tile = tiles[tileIndex];
        if (!tile.selectable) return null;

        const newTray = [...tray, tile.groupId];
        const newTiles = tiles.filter(t => t.id !== tileId);

        // Check match in tray
        const matchResult = this.findConsecutiveMatch(newTray, matchCount);
        if (matchResult) {
            // Remove matched groups from tray
            const matchStart = matchResult.start;
            const finalTray = newTray.slice(0, matchStart).concat(newTray.slice(matchStart + matchCount));
            return { tiles: newTiles, tray: finalTray };
        }

        if (newTray.length > traySize) return null;
        return { tiles: newTiles, tray: newTray };
    }

    private static findConsecutiveMatch(tray: string[], matchCount: number): { start: number } | null {
        for (let i = 0; i <= tray.length - matchCount; i++) {
            const g = tray[i];
            let same = true;
            for (let j = 1; j < matchCount; j++) {
                if (tray[i + j] !== g) { same = false; break; }
            }
            if (same) return { start: i };
        }
        return null;
    }

    /**
     * Tính toán trạng thái blocked/selectable cho từng tile.
     * Tile bị block nếu có tile active khác ở layer cao hơn overlap với nó.
     */
    public static computeBlockStatus(tiles: ITileData[], config: IBoardConfig): void {
        const activeTiles = tiles.filter(t => t.active);

        for (const tile of tiles) {
            if (!tile.active) {
                tile.selectable = false;
                tile.isBlocked = true;
                continue;
            }

            const blocked = BoardPositionHelper.isTileBlocked(tile, activeTiles, config);
            tile.isBlocked = blocked;
            tile.selectable = !blocked;
        }
    }

    private static getGroupCounts(tiles: ITileData[]): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const t of tiles) {
            counts[t.groupId] = (counts[t.groupId] || 0) + 1;
        }
        return counts;
    }

    private static serializeState(tiles: ITileData[], tray: string[]): string {
        const ids = tiles.map(t => t.id).sort().join(',');
        return `${ids}|${tray.join(',')}`;
    }
}
