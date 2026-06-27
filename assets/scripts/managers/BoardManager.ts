import { _decorator, Component, Node, Vec3 } from 'cc';
import { IBoardConfig } from '../interfaces/IBoardConfig';
import { ITileData } from '../interfaces/ITileData';
import { BoardPositionHelper } from '../core/BoardPositionHelper';

const { ccclass, property } = _decorator;

/**
 * BoardManager - Quản lý grid, layer, occlusion check và world position.
 * Grid-based: mỗi cell (gridX, gridY) có thể chứa nhiều tile ở các layer khác nhau.
 * Layer chỉ dùng cho rendering order và occlusion, KHÔNG phải tiến trình chơi.
 * Tile ở layer thấp bị block nếu có bất kỳ tile ở layer cao hơn nào đè lên nó,
 * dù chỉ một phần nhỏ (bao gồm cả tile từ cell lân cận).
 */
@ccclass('BoardManager')
export class BoardManager extends Component {
    public static Instance: BoardManager;
    public static getInstance(): BoardManager { return BoardManager.Instance; }

    @property(Node)
    public boardRoot: Node | null = null;

    /** Kích thước tile world units width (dùng cho tính % che phủ) */
    @property
    public tileSize: number = 100;

    /** Kích thước tile world units height (dùng cho tính % che phủ) */
    @property
    public tileHeight: number = 120;

    /** Khoảng cách giữa các tile (override giá trị từ level config, để 0 để dùng config) */
    @property
    public tileSpacing: number = 0;

    /** Khoảng cách giữa các tile theo trục X (ưu tiên hơn tileSpacing, để 0 để dùng config) */
    @property
    public tileSpacingX: number = 0;

    /** Khoảng cách giữa các tile theo trục Y (ưu tiên hơn tileSpacing, để 0 để dùng config) */
    @property
    public tileSpacingY: number = 0;

    /** Độ lệch layer theo trục X (tỷ lệ tileSize, ví dụ 0.3 = lệch ±30% tileSize) */
    @property
    public layerJitterX: number = 0.3;

    /** Độ lệch layer theo trục Y (tỷ lệ tileSize, ví dụ 0.3 = lệch ±30% tileSize) */
    @property
    public layerJitterY: number = 0.3;

    /** Tỷ lệ tile che nhau khi cùng grid cell (0-1) */
    @property
    public tileOverlapRatio: number = 0.35;

    /** Offset pixel để board nằm giữa màn hình (Canvas center, ví dụ 1080x1920 → 540,960) */
    @property
    public screenCenterX: number = 540;

    @property
    public screenCenterY: number = 960;

    private _config: IBoardConfig | null = null;
    /** Map grid cell -> danh sách tile ở cell đó, sắp xếp theo layer */
    private _gridCells: Map<string, ITileData[]> = new Map();

    protected onLoad(): void {
        console.log(`[BoardManager] onLoad called, existingInstance=${BoardManager.Instance ? 'YES' : 'NULL'}, this.node=${this.node?.name || 'NO_NODE'}`);
        if (BoardManager.Instance) {
            console.warn(`[BoardManager] DESTROYING duplicate instance on node ${this.node?.name}`);
            this.destroy();
            return;
        }
        BoardManager.Instance = this;
        console.log(`[BoardManager] Instance set to node ${this.node?.name}`);
    }

    /** Xây dựng board theo config */
    public buildBoard(config: IBoardConfig): void {
        console.log(`[BoardManager] buildBoard called, rows=${config.rows}, cols=${config.cols}, spacing=${config.tileSpacing}`);
        this._config = config;
        this._gridCells.clear();
    }

    /** Tính world position từ gridX, gridY, layer */
    public getWorldPosition(gridX: number, gridY: number, layer: number): Vec3 {
        if (!this._config) {
            console.warn(`[BoardManager] getWorldPosition: _config is null! grid=(${gridX},${gridY})`);
            return Vec3.ZERO;
        }
        if (!Number.isFinite(gridX) || !Number.isFinite(gridY) || !Number.isFinite(layer)) {
            console.warn(`[BoardManager] getWorldPosition: non-finite values! gridX=${gridX}, gridY=${gridY}, layer=${layer}`);
            return Vec3.ZERO;
        }

        const center = BoardPositionHelper.getTileCenter({ gridX, gridY, layer }, this._config);
        return new Vec3(center.x, center.y, layer * 10);
    }


    /** Tính bounds (min/max gridX, gridY) từ tiles đã đăng ký */
    public getTileBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        let first = true;
        for (const list of this._gridCells.values()) {
            for (const tile of list) {
                if (first) {
                    minX = maxX = tile.gridX;
                    minY = maxY = tile.gridY;
                    first = false;
                } else {
                    minX = Math.min(minX, tile.gridX);
                    maxX = Math.max(maxX, tile.gridX);
                    minY = Math.min(minY, tile.gridY);
                    maxY = Math.max(maxY, tile.gridY);
                }
            }
        }
        if (first) {
            // Fallback: dùng config nếu chưa có tile nào
            const cols = this._config?.cols ?? 1;
            const rows = this._config?.rows ?? 1;
            return { minX: 0, maxX: cols - 1, minY: 0, maxY: rows - 1 };
        }
        return { minX, maxX, minY, maxY };
    }

    /** Đăng ký tile vào grid cell */
    public registerTile(tile: ITileData): void {
        const key = this.getGridKey(tile.gridX, tile.gridY);
        const list = this._gridCells.get(key) || [];
        // Binary insertion sort by layer to avoid O(n log n) full sort
        const insertIndex = this._findInsertIndex(list, tile.layer);
        list.splice(insertIndex, 0, tile);
        this._gridCells.set(key, list);
    }

    /** Tìm vị trí chèn binary search theo layer */
    private _findInsertIndex(list: ITileData[], layer: number): number {
        let left = 0;
        let right = list.length;
        while (left < right) {
            const mid = (left + right) >> 1;
            if (list[mid].layer < layer) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }
        return left;
    }

    /** Xóa tile khỏi grid cell */
    public unregisterTile(tile: ITileData): void {
        const key = this.getGridKey(tile.gridX, tile.gridY);
        const list = this._gridCells.get(key);
        if (!list) return;
        const idx = list.findIndex(t => t.id === tile.id);
        if (idx !== -1) {
            list.splice(idx, 1);
            if (list.length === 0) {
                this._gridCells.delete(key);
            } else {
                this._gridCells.set(key, list);
            }
        }
    }

    /**
     * Kiểm tra tile có bị block không.
     * Tile bị block nếu có bất kỳ tile active nào ở layer cao hơn đè lên nó
     * (dù chỉ 1 phần nhỏ, bao gồm cả tile ở cell lân cận).
     */
    public isTileBlocked(tile: ITileData): boolean {
        if (!tile.active) return true;
        if (!this._config) return true;
        const allTiles: ITileData[] = [];
        for (const list of this._gridCells.values()) {
            for (const t of list) allTiles.push(t);
        }
        return BoardPositionHelper.isTileBlocked(tile, allTiles, this._config);
    }

    /** Tính toán tâm tile dựa trên grid và layer, không log */
    private getTileCenter(tile: ITileData): Vec3 {
        if (!this._config) return Vec3.ZERO;
        const center = BoardPositionHelper.getTileCenter(tile, this._config);
        return new Vec3(center.x, center.y, 0);
    }

    /**
     * Tính tổng diện tích overlap (pixel²) từ các tile ở layer cao hơn.
     */
    public calculateTotalOverlapArea(tile: ITileData): number {
        if (!this._config) return 0;
        const coverers = this.getCoveringTiles(tile);
        if (coverers.length === 0) return 0;

        let totalArea = 0;
        for (const coverer of coverers) {
            totalArea += BoardPositionHelper.calculateOverlapArea(tile, coverer, this._config);
        }
        return totalArea;
    }

    /** Lấy danh sách tile ở layer cao hơn đang che tile này (dù chỉ 1 phần nhỏ) */
    public getCoveringTiles(tile: ITileData): ITileData[] {
        const result: ITileData[] = [];
        const tileCenter = this.getTileCenter(tile);
        if (tileCenter.equals(Vec3.ZERO) && !this._config) return [];

        for (const [, cellTiles] of this._gridCells) {
            for (const other of cellTiles) {
                if (other.id === tile.id) continue;
                if (!other.active) continue;
                if (other.layer <= tile.layer) continue;

                const otherCenter = this.getTileCenter(other);
                const dx = Math.abs(tileCenter.x - otherCenter.x);
                const dy = Math.abs(tileCenter.y - otherCenter.y);

                // Overlap nếu khoảng cách giữa 2 tâm nhỏ hơn kích thước tile (width x height)
                if (dx < this.tileSize && dy < this.tileHeight) {
                    result.push(other);
                }
            }
        }

        return result;
    }

    /**
     * Tính diện tích overlap (pixel²) giữa 2 tile.
     */
    private calculateOverlapArea(bottomTile: ITileData, topTile: ITileData): number {
        if (!this._config) return 0;
        return BoardPositionHelper.calculateOverlapArea(bottomTile, topTile, this._config);
    }

    /** Lấy danh sách tile trong cùng grid cell */
    public getTilesAtCell(gridX: number, gridY: number): ITileData[] {
        const key = this.getGridKey(gridX, gridY);
        return this._gridCells.get(key) || [];
    }

    /** Kiểm tra có tile ở grid cell này không */
    public hasTilesAtCell(gridX: number, gridY: number): boolean {
        return this.getTilesAtCell(gridX, gridY).length > 0;
    }

    /** Lấy key cho grid map */
    private getGridKey(gridX: number, gridY: number): string {
        return `${gridX}_${gridY}`;
    }

    /** Clear board grid (KHÔNG xóa _config — buildBoard sẽ overwrite) */
    public clearBoard(): void {
        this._gridCells.clear();
    }

    /** Lấy config hiện tại */
    public getConfig(): IBoardConfig | null {
        return this._config;
    }

    protected onDestroy(): void {
        if (BoardManager.Instance === this) {
            BoardManager.Instance = null;
        }
    }
}
