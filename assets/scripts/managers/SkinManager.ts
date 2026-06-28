import { _decorator, Component, Prefab, resources, SpriteFrame, Node, Sprite, AudioClip, assetManager, Texture2D, ImageAsset } from 'cc';
import { SkinCategory } from '../enums/SkinCategory';
import { ISkinConfig, ISkinAsset } from '../interfaces/ISkinConfig';
import { DataLoader } from '../core/DataLoader';
import { ConfigManager } from '../core/ConfigManager';
import { ITEM_ID_GROUPS, isCanonicalItemId, normalizeItemId } from '../core/ItemIdCatalog';

const { ccclass } = _decorator;

/**
 * SkinManager - Quản lý reskin toàn game.
 * Load skin config từ JSON, cung cấp API lookup asset theo key.
 * Mọi visual asset đều đi qua SkinManager để hỗ trợ đổi brand.
 */
@ccclass('SkinManager')
export class SkinManager extends Component {
    public static Instance: SkinManager;
    public static getInstance(): SkinManager { return SkinManager.Instance; }

    private _currentSkin: ISkinConfig | null = null;
    private _assetCache: Map<string, any> = new Map();
    private _skinLoadToken: number = 0;

    protected onLoad(): void {
        if (SkinManager.Instance) { this.destroy(); return; }
        SkinManager.Instance = this;
    }

    /** Load skin mặc định khi khởi động */
    public async loadDefaultSkin(): Promise<void> {
        const skinId = ConfigManager.getInstance().getDefaultSkinId();
        await this.loadSkin(skinId);
    }

    /** Load skin theo ID */
    public async loadSkin(skinId: string): Promise<void> {
        const loadToken = ++this._skinLoadToken;
        const path = `data/skins/${skinId}_skin`;
        const skin = await DataLoader.loadJson<ISkinConfig>(path);
        if (loadToken !== this._skinLoadToken) return;
        this._currentSkin = skin;
        this._assetCache.clear();
    }

    /** Lấy prefab key cho tile theo groupId */
    public getTilePrefabKey(groupId: string): string {
        // All tiles share the same prefab; visual is changed via sprite assignment
        return 'tile_default';
    }

    /** Lấy panel prefab theo tên */
    public async getPanelPrefab(panelName: string): Promise<Prefab | null> {
        const key = `panel_${panelName}`;
        return this.getAsset<Prefab>(key, SkinCategory.UI);
    }

    /** Lấy sprite frame theo key */
    public async getSprite(key: string, category: SkinCategory = SkinCategory.TILES): Promise<SpriteFrame | null> {
        return this.getAsset<SpriteFrame>(key, category);
    }

    /** Áp dụng skin cho một tile node */
    public applyTileSkin(node: Node, skinOverride: string): void {
        // skinOverride format: "uma/0"
        const [brand, item] = skinOverride.split('/');
        if (!brand || !item || typeof item !== 'string') {
                        return;
        }
        const itemId = normalizeItemId(item);
        const key = `tile_${itemId}`;
        
        // Tăng applyId để tránh promise cũ gán sprite lên node đã được reuse
        const applyId = ((node as any).__skinApplyId || 0) + 1;
        (node as any).__skinApplyId = applyId;

        this.getTileSprite(itemId).then((spriteFrame) => {
            if (!node || !node.isValid) return;
            if ((node as any).__skinApplyId !== applyId) {
                                return;
            }
            if (!spriteFrame) {
                                return;
            }
            // Gán vào visual child node cụ thể, không phải root node
            const visualNode = node.getChildByName('visual');
            const sprite = visualNode?.getComponent(Sprite) || node.getComponentInChildren(Sprite);
            if (sprite) {
                const oldName = sprite.spriteFrame?.name || 'null';
                sprite.spriteFrame = spriteFrame;
                const tileComp = node.getComponent('Tile') as any;
                if (tileComp && tileComp.forceUpdateVisualState) {
                    tileComp.forceUpdateVisualState();
                } else if (tileComp && tileComp.updateVisualState) {
                    tileComp.updateVisualState();
                }
                            } else {
                            }
        });
    }

    /** Lấy màu chủ đạo của skin */
    public getThemeColor(type: 'primary' | 'secondary' | 'accent' | 'background'): string {
        return this._currentSkin?.themeColors[type] || '#FFFFFF';
    }

    /** Lấy skin config hiện tại */
    public getCurrentSkin(): ISkinConfig | null {
        return this._currentSkin;
    }

    /** Preload sprite cho tất cả groupId để tránh async hitch khi spawn tile */
    public async prewarmSkinSprites(groupIds: string[]): Promise<void> {
        if (!this._currentSkin) return;
        const validIds = (Array.isArray(groupIds) ? groupIds : [])
            .filter(gid => typeof gid === 'string');
        if (validIds.length === 0) {
                        return;
        }
        const promises = validIds.map(gid => this.getTileSprite(normalizeItemId(gid)));
        await Promise.all(promises);
    }

    private async getTileSprite(itemId: string): Promise<SpriteFrame | null> {
        const sprite = await this.getSprite(`tile_${itemId}`, SkinCategory.TILES);
                if (sprite || !isCanonicalItemId(itemId)) {
            return sprite;
        }

        const tileAssets = this._currentSkin?.assets[SkinCategory.TILES] || [];
        const availableIds = ITEM_ID_GROUPS.filter(id =>
            tileAssets.some(asset => asset.key === `tile_${id}`)
        );
        if (availableIds.length === 0) return null;

        const fallbackId = availableIds[Number(itemId) % availableIds.length];
                return this.getSprite(`tile_${fallbackId}`, SkinCategory.TILES);
    }

    /** Lấy font mặc định */
    public getDefaultFont(): string {
        return this._currentSkin?.defaultFont || 'default';
    }

    /** Generic asset lookup */
    private async getAsset<T>(key: string, category: SkinCategory): Promise<T | null> {
        const cacheKey = `${category}_${key}`;
        if (this._assetCache.has(cacheKey)) {
            return this._assetCache.get(cacheKey) as T;
        }

        if (!this._currentSkin) {
                        return null;
        }

        const assets = this._currentSkin.assets[category] || [];
        const assetDef = assets.find(a => a.key === key);
        if (!assetDef) {
                        return null;
        }

        const asset = await this.loadAssetByPath<T>(assetDef.path, assetDef.assetType);
        if (asset) {
            this._assetCache.set(cacheKey, asset);
        }
        return asset;
    }

    /** Load asset từ resources theo type */
    private async loadAssetByPath<T>(path: string, assetType: string): Promise<T | null> {
        return new Promise((resolve) => {
            if (assetType === 'sprite') {
                // Cocos Creator 3.x: load SpriteFrame bằng path/spriteFrame
                const spritePath = `${path}/spriteFrame`;
                resources.load(spritePath, SpriteFrame, (err: any, sf: SpriteFrame) => {
                    if (err) {
                                                // Fallback: load Texture2D rồi wrap
                        resources.load(path, Texture2D, (err2: any, tex: Texture2D) => {
                            if (err2) {
                                                                resolve(null);
                            } else {
                                const frame = new SpriteFrame();
                                frame.texture = tex;
                                resolve(frame as unknown as T);
                            }
                        });
                    } else {
                        resolve(sf as unknown as T);
                    }
                });
            } else if (assetType === 'prefab') {
                resources.load(path, Prefab, (err: any, asset: Prefab) => {
                    if (err) {  resolve(null); }
                    else { resolve(asset as unknown as T); }
                });
            } else if (assetType === 'audio') {
                // Audio temporarily disabled to avoid decodeAudioData errors
                resolve(null as unknown as T);
            } else {
                resources.load(path, (err: any, asset: any) => {
                    if (err) {  resolve(null); }
                    else { resolve(asset as unknown as T); }
                });
            }
        });
    }

    protected onDestroy(): void {
        if (SkinManager.Instance === this) {
            SkinManager.Instance = null;
        }
    }
}
