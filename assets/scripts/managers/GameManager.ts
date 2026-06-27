import { _decorator, Component, director, Node, Prefab, resources, input, Input, KeyCode, EventKeyboard, UITransform, EditBox, Button } from 'cc';
import { GameState } from '../enums/GameState';
import { GameEvent } from '../enums/GameEvent';
import { EventBus } from '../core/EventBus';
import { ConfigManager } from '../core/ConfigManager';
import { PoolManager } from '../core/PoolManager';
import { LevelManager } from './LevelManager';
import { UIManager } from './UIManager';
import { AudioManager } from './AudioManager';
import { SkinManager } from './SkinManager';
import { TileManager } from './TileManager';
import { SaveManager } from '../core/SaveManager';
import { OrderTrayManager } from './OrderTrayManager';
import { WrongTrayManager } from './WrongTrayManager';
import { BoosterManager } from './BoosterManager';

const { ccclass, property } = _decorator;

/**
 * GameManager - Entry point controller, quản lý vòng đời game.
 * Điều phối các manager khác, giữ state machine tổng thể.
 * Không chứa logic gameplay cụ thể.
 */
@ccclass('GameManager')
export class GameManager extends Component {
    public static Instance: GameManager;

    @property(Node)
    public uiRoot: Node | null = null;

    @property(Node)
    public gameplayRoot: Node | null = null;

    @property(Prefab)
    public tilePrefab: Prefab | null = null;

    private _currentState: GameState = GameState.NONE;
    private _previousState: GameState = GameState.NONE;
    private _startLevelToken: number = 0;
    private _autoAdvanceTimer: any = null;

    @property(EditBox)
    public levelJumpInput: EditBox | null = null;

    @property(Button)
    public levelJumpOk: Button | null = null;

    protected onLoad(): void {
        if (GameManager.Instance) {
            this.destroy();
            return;
        }
        GameManager.Instance = this;
        director.addPersistRootNode(this.node);
    }

    protected async start(): Promise<void> {
        await this.initializeGame();

        // Listen for level end events to switch panels
        EventBus.getInstance().on(GameEvent.LEVEL_COMPLETED, this.onLevelCompleted, this);
        EventBus.getInstance().on(GameEvent.LEVEL_FAILED, this.onLevelFailed, this);

        // Cheat keys: 1-9 change level, R restart, N next level
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        this.bindLevelJumpUI();
    }

    /** Phím cheat: 1-9 đổi level, R restart, N next level */
    private onKeyDown(event: EventKeyboard): void {
        if (this._currentState !== GameState.GAMEPLAY) return;
        const key = event.keyCode;
        if (key >= KeyCode.DIGIT_1 && key <= KeyCode.DIGIT_9) {
            const levelId = key - KeyCode.DIGIT_1 + 1;
            this.startLevel(levelId);
        } else if (key === KeyCode.KEY_R) {
            const currentLevelId = LevelManager.getInstance().getCurrentLevelId();
            if (currentLevelId > 0) {
                this.startLevel(currentLevelId);
            }
        } else if (key === KeyCode.KEY_N) {
            const nextLevelId = LevelManager.getInstance().getCurrentLevelId() + 1;
            this.startLevel(nextLevelId);
        }
    }

    private async onLevelCompleted(levelId: number, score: number, stars: number): Promise<void> {
        try {
            console.log(`[GameManager] onLevelCompleted called: levelId=${levelId}, score=${score}, stars=${stars}`);
            console.log(`[GM_DEBUG] LEVEL_COMPLETED received level=${levelId} currentState=${this._currentState}`);
            UIManager.getInstance().closePanel('GameplayPanel');
            const panel = await UIManager.getInstance().openPanel('LevelCompletePanel', { levelId, score, stars });
            console.log(`[GameManager] LevelCompletePanel result: ${panel ? 'opened' : 'NOT FOUND'}`);

            // Luôn auto-advance sau 1.5s (panel nếu có chỉ là visual)
            if (this._autoAdvanceTimer) {
                clearTimeout(this._autoAdvanceTimer);
                this._autoAdvanceTimer = null;
            }
            this._autoAdvanceTimer = setTimeout(async () => {
                this._autoAdvanceTimer = null;
                UIManager.getInstance().closePanel('LevelCompletePanel');
                const nextLevel = levelId + 1;
                console.log(`[GM_DEBUG] Auto-advancing from level=${levelId} to nextLevel=${nextLevel}`);
                await this.startLevel(nextLevel);
            }, 1500);
        } catch (err) {
            console.error('[GameManager] onLevelCompleted ERROR:', err);
            this.returnToMenu();
        }
    }

    private async onLevelFailed(levelId: number): Promise<void> {
        try {
            console.warn(`[GM_DEBUG] LEVEL_FAILED received level=${levelId} currentState=${this._currentState}`);
            UIManager.getInstance().closePanel('GameplayPanel');
            const panel = await UIManager.getInstance().openPanel('LevelFailedPanel', { levelId });
            if (!panel) {
                console.warn(`[GM_DEBUG] LevelFailedPanel not found, auto-restarting level=${levelId}`);
                await this.startLevel(levelId);
            }
        } catch (err) {
            console.error('[GameManager] onLevelFailed ERROR:', err);
            this.returnToMenu();
        }
    }

    /** Khởi tạo tuần tự các hệ thống */
    private async initializeGame(): Promise<void> {
        this.setState(GameState.LOADING);

        console.log('[GameManager] Initializing...');
        console.log('[GameManager] SkinManager.Instance =', (SkinManager as any).Instance);
        console.log('[GameManager] TileManager.Instance =', (TileManager as any).Instance);
        console.log('[GameManager] AudioManager.Instance =', (AudioManager as any).Instance);
        console.log('[GameManager] UIManager.Instance =', (UIManager as any).Instance);

        await ConfigManager.getInstance().loadConfig();

        const skinMgr = SkinManager.getInstance();
        if (!skinMgr) {
            console.error('[GameManager] SkinManager.getInstance() returned null. Ensure a scene node has SkinManager.ts attached.');
            return;
        }
        if (typeof skinMgr.loadDefaultSkin !== 'function') {
            console.error('[GameManager] SkinManager instance missing loadDefaultSkin. Instance type:', typeof skinMgr, 'Keys:', Object.keys(skinMgr));
            return;
        }
        await skinMgr.loadDefaultSkin();

        const audioMgr = AudioManager.getInstance();
        if (!audioMgr) {
            console.error('[GameManager] AudioManager.getInstance() returned null. Ensure a scene node has AudioManager.ts attached.');
            return;
        }
        await audioMgr.initialize();

        await LevelManager.getInstance().initialize();

        // Register tile prefab for object pooling
        await this.registerTilePrefab();

        UIManager.getInstance().initialize(this.uiRoot);

        this.setState(GameState.MAIN_MENU);

        const savedLevel = SaveManager.getInstance().getCurrentLevel();
        if (savedLevel > 0) {
            console.log(`[GameManager] Resuming saved level ${savedLevel}`);
            await this.startLevel(savedLevel);
        } else {
            UIManager.getInstance().openPanel('LevelSelectPanel');
        }
    }

    /** Đăng ký tile prefab vào PoolManager */
    private registerTilePrefab(): Promise<void> {
        return new Promise((resolve) => {
            if (this.tilePrefab) {
                PoolManager.getInstance().registerPrefab('tile_default', this.tilePrefab);
                console.log('[GameManager] Registered tile_default prefab from Inspector assignment.');
                resolve();
                return;
            }

            // Fallback: load from resources bundle.
            // Prefab must be placed under assets/resources/prefabs/tiles/
            resources.load('prefabs/tiles/tile_default', Prefab, (err, prefab) => {
                if (err) {
                    console.warn('[GameManager] tile_default prefab not found at resources/prefabs/tiles/tile_default. Tile spawning will create new instances instead of pooling.');
                    resolve();
                    return;
                }
                PoolManager.getInstance().registerPrefab('tile_default', prefab);
                console.log('[GameManager] Registered tile_default prefab from resources.');
                resolve();
            });
        });
    }

    /** Chuyển state */
    public setState(newState: GameState): void {
        if (this._currentState === newState) return;

        this._previousState = this._currentState;
        this._currentState = newState;

        EventBus.getInstance().emit(GameEvent.STATE_CHANGED, this._currentState, this._previousState);
    }

    /** Lấy state hiện tại */
    public getState(): GameState {
        return this._currentState;
    }

    /** Quay lại state trước đó */
    public revertState(): void {
        this.setState(this._previousState);
    }

    /** Bắt đầu level mới */
    public async startLevel(levelId: number): Promise<void> {
        const startToken = ++this._startLevelToken;
        if (this._autoAdvanceTimer) {
            clearTimeout(this._autoAdvanceTimer);
            this._autoAdvanceTimer = null;
        }
        console.log(`[GameManager] startLevel(${levelId}) called`);
        this.setState(GameState.GAMEPLAY);

        // Ensure ORDER_MATCH managers exist in scene
        console.log('[GameManager] Calling ensureOrderManagers...');
        this.ensureOrderManagers();

        // Close menu panels and show loading BEFORE loading assets
        UIManager.getInstance().closePanel('LevelSelectPanel');
        UIManager.getInstance().showLoading(`Loading Level ${levelId}...`);

        try {
            // Load all level data, skin assets and spawn tiles first
            console.log(`[GameManager] Calling loadLevel(${levelId})...`);
            await LevelManager.getInstance().loadLevel(levelId);
            if (startToken !== this._startLevelToken) return;
            console.log(`[GameManager] loadLevel(${levelId}) finished`);

            // Only open GameplayPanel AFTER everything is loaded and ready
            console.log('[GameManager] Opening GameplayPanel...');
            const gameplayPanel = await UIManager.getInstance().openPanel('GameplayPanel');
            if (!gameplayPanel) {
                console.warn('[GameManager] GameplayPanel could not be opened');
            } else {
                console.log('[GameManager] GameplayPanel opened');
            }
        } catch (err) {
            console.error(`[GameManager] Failed to load level ${levelId}:`, err);
            this.returnToMenu();
        } finally {
            if (startToken === this._startLevelToken) {
                UIManager.getInstance().hideLoading();
            }
        }
    }

    /** Tạo OrderTrayManager và WrongTrayManager nếu chưa có trong scene */
    private ensureOrderManagers(): void {
        const parent = this.gameplayRoot || this.uiRoot || this.node;
        const scene = director.getScene();
        if (!parent && scene) {
            // Fallback: gắn vào scene root
        }
        const effectiveParent = parent || scene as any;

        // Helper: check if a manager instance is valid (node not destroyed)
        const isManagerValid = (mgr: any) => mgr && mgr.node && mgr.node.isValid;

        if (!isManagerValid(OrderTrayManager.Instance)) {
            if (OrderTrayManager.Instance) (OrderTrayManager as any).Instance = null;
            const orderTrayNode = new Node('OrderTrayManager');
            orderTrayNode.layer = effectiveParent?.layer ?? 0;
            orderTrayNode.addComponent(UITransform);
            orderTrayNode.addComponent(OrderTrayManager);
            orderTrayNode.setParent(effectiveParent);
            orderTrayNode.setPosition(540, 320, 0);
            console.log('[GameManager] Created OrderTrayManager node');
        }

        if (!isManagerValid(WrongTrayManager.Instance)) {
            if (WrongTrayManager.Instance) (WrongTrayManager as any).Instance = null;
            const wrongTrayNode = new Node('WrongTrayManager');
            wrongTrayNode.layer = effectiveParent?.layer ?? 0;
            wrongTrayNode.addComponent(UITransform);
            wrongTrayNode.addComponent(WrongTrayManager);
            wrongTrayNode.setParent(effectiveParent);
            wrongTrayNode.setPosition(850, 320, 0);
            console.log('[GameManager] Created WrongTrayManager node');
        }

        if (!isManagerValid(BoosterManager.Instance)) {
            if (BoosterManager.Instance) (BoosterManager as any).Instance = null;
            const boosterNode = new Node('BoosterManager');
            boosterNode.layer = effectiveParent?.layer ?? 0;
            boosterNode.addComponent(BoosterManager);
            boosterNode.setParent(effectiveParent);
            console.log('[GameManager] Created BoosterManager node');
        }
    }

    /** Tạm dừng game */
    public pauseGame(): void {
        if (this._currentState === GameState.GAMEPLAY) {
            this.setState(GameState.PAUSED);
        }
    }

    /** Tiếp tục game */
    public resumeGame(): void {
        if (this._currentState === GameState.PAUSED) {
            this.setState(GameState.GAMEPLAY);
        }
    }

    /** Thoát về menu */
    public returnToMenu(): void {
        if (this._autoAdvanceTimer) {
            clearTimeout(this._autoAdvanceTimer);
            this._autoAdvanceTimer = null;
        }
        this.setState(GameState.MAIN_MENU);
        LevelManager.getInstance().unloadCurrentLevel();
        UIManager.getInstance().closePanel('GameplayPanel');
        UIManager.getInstance().closePanel('LevelCompletePanel');
        UIManager.getInstance().closePanel('LevelFailedPanel');
        UIManager.getInstance().hideLoading();
        UIManager.getInstance().openPanel('LevelSelectPanel');
    }

    protected onDestroy(): void {
        if (GameManager.Instance === this) {
            GameManager.Instance = null;
            EventBus.getInstance().off(GameEvent.LEVEL_COMPLETED, this.onLevelCompleted, this);
            EventBus.getInstance().off(GameEvent.LEVEL_FAILED, this.onLevelFailed, this);
            if (this._autoAdvanceTimer) {
                clearTimeout(this._autoAdvanceTimer);
                this._autoAdvanceTimer = null;
            }
            input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
            if (this.levelJumpOk) {
                this.levelJumpOk.node.off(Button.EventType.CLICK, this.onClickLevelJump, this);
            }
        }
    }

    private bindLevelJumpUI(): void {
        if (this.levelJumpOk) {
            this.levelJumpOk.node.on(Button.EventType.CLICK, this.onClickLevelJump, this);
        }
    }

    private onClickLevelJump(): void {
        const val = this.levelJumpInput?.string?.trim() || '';
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > 0) {
            this.startLevel(num);
        }
        if (this.levelJumpInput) {
            this.levelJumpInput.string = '';
        }
    }
}
