import { Node, instantiate, Prefab } from 'cc';

/**
 * PoolManager - Quản lý object pool cho tile, effect, UI element.
 * Giảm instantiate/destroy runtime để tối ưu performance.
 */
export class PoolManager {
    private static _instance: PoolManager;
    private _pools: Map<string, Node[]> = new Map();
    private _prefabs: Map<string, Prefab> = new Map();

    private constructor() {}

    public static getInstance(): PoolManager {
        if (!PoolManager._instance) {
            PoolManager._instance = new PoolManager();
        }
        return PoolManager._instance;
    }

    /** Đăng ký prefab cho một pool */
    public registerPrefab(key: string, prefab: Prefab): void {
        this._prefabs.set(key, prefab);
        if (!this._pools.has(key)) {
            this._pools.set(key, []);
        }
    }

    /** Lấy node từ pool, nếu hết thì instantiate mới */
    public get(key: string): Node | null {
        const pool = this._pools.get(key);
        if (pool && pool.length > 0) {
            const node = pool.pop()!;
            node.active = true;
            return node;
        }

        const prefab = this._prefabs.get(key);
        if (prefab) {
            return instantiate(prefab);
        }
        return null;
    }

    /** Trả node về pool */
    public put(key: string, node: Node): void {
        if (!key || !node) return;
        node.active = false;
        node.removeFromParent();
        const pool = this._pools.get(key);
        if (pool) {
            // Tránh duplicate reference gây memory leak và lỗi logic
            if (pool.indexOf(node) === -1) {
                pool.push(node);
            }
        } else {
            this._pools.set(key, [node]);
        }
    }

    /** Khởi tạo trước một số lượng node cho pool */
    public prewarm(key: string, count: number): void {
        const prefab = this._prefabs.get(key);
        if (!prefab) return;

        const pool = this._pools.get(key) || [];
        for (let i = 0; i < count; i++) {
            const node = instantiate(prefab);
            node.active = false;
            pool.push(node);
        }
        this._pools.set(key, pool);
    }

    /** Đảm bảo pool có ít nhất count node, nếu thiếu thì prewarm thêm */
    public ensureCapacity(key: string, count: number): void {
        const pool = this._pools.get(key);
        const currentSize = pool ? pool.length : 0;
        if (currentSize < count) {
            this.prewarm(key, count - currentSize);
        }
    }

    /** Lấy số lượng node hiện có trong pool */
    public getPoolSize(key: string): number {
        const pool = this._pools.get(key);
        return pool ? pool.length : 0;
    }

    /** Clear một pool */
    public clearPool(key: string): void {
        const pool = this._pools.get(key);
        if (pool) {
            pool.forEach(n => n.destroy());
            this._pools.delete(key);
        }
    }

    /** Clear tất cả pool */
    public clearAll(): void {
        this._pools.forEach((pool, key) => {
            pool.forEach(n => n.destroy());
        });
        this._pools.clear();
        this._prefabs.clear();
    }
}
