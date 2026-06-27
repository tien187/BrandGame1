import { resources, JsonAsset } from 'cc';

/**
 * DataLoader - Chịu trách nhiệm load JSON asset từ thư mục resources.
 * Tách biệt việc I/O để dễ mock/test và hỗ trợ caching.
 */
export class DataLoader {
    private static _cache: Map<string, any> = new Map();

    private static cloneJson<T>(data: T): T {
        return JSON.parse(JSON.stringify(data)) as T;
    }

    /** Load JSON asset bất đồng bộ, có cache */
    public static async loadJson<T>(path: string): Promise<T> {
        if (this._cache.has(path)) {
            return this.cloneJson(this._cache.get(path) as T);
        }

        return new Promise((resolve, reject) => {
            resources.load(path, JsonAsset, (err, asset) => {
                if (err) {
                    reject(err);
                    return;
                }
                const data = this.cloneJson(asset.json as T);
                this._cache.set(path, data);
                resolve(this.cloneJson(data));
            });
        });
    }

    /** Load nhiều JSON song song */
    public static async loadMultiple<T>(paths: string[]): Promise<T[]> {
        const promises = paths.map(p => this.loadJson<T>(p));
        return Promise.all(promises);
    }

    /** Xóa cache */
    public static clearCache(): void {
        this._cache.clear();
    }

    /** Xóa cache theo path */
    public static removeFromCache(path: string): void {
        this._cache.delete(path);
    }
}
