import { _decorator, Component, director, Node, Prefab, resources, input, Input, KeyCode, EventKeyboard, UITransform, EditBox, Button, view, ResolutionPolicy, tween, UIOpacity } from 'cc';
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
    private _elapsedSeconds: number = 0;
    private _timerRunning: boolean = false;

    @property(EditBox)
    public levelJumpInput: EditBox | null = null;

    @property(Button)
    public levelJumpOk: Button | null = null;

    @property(Node)
    public splashNode: Node | null = null;

    @property(Node)
    public splashLogoNode: Node | null = null;

    @property(Node)
    public gameScreen: Node | null = null;

    protected onLoad(): void {
        if (GameManager.Instance) {
            this.destroy();
            return;
        }
        GameManager.Instance = this;
        director.addPersistRootNode(this.node);

        // Lock web build to 1080x1920 aspect ratio, fit inside browser without stretching.
        view.setDesignResolutionSize(1080, 1920, ResolutionPolicy.SHOW_ALL);
    }

    protected async start(): Promise<void> {
        // SplashScreen active=true, GameScreen active=false at start.
        if (this.splashNode) this.splashNode.active = true;
        if (this.gameScreen) this.gameScreen.active = false;

        // Ensure splash has UIOpacity for fade-out.
        if (this.splashNode && !this.splashNode.getComponent(UIOpacity)) {
            this.splashNode.addComponent(UIOpacity);
        }

        const initPromise = this.initializeGame();
        // Wait at least 2 seconds and for init to finish.
        await Promise.all([
            initPromise,
            new Promise<void>(resolve => setTimeout(resolve, 2000))
        ]);

        // Step 1: Fade out logo first.
        if (this.splashLogoNode) {
            if (!this.splashLogoNode.getComponent(UIOpacity)) {
                this.splashLogoNode.addComponent(UIOpacity);
            }
            const logoOpacity = this.splashLogoNode.getComponent(UIOpacity)!;
            await new Promise<void>(resolve => {
                tween(logoOpacity)
                    .to(0.4, { opacity: 0 })
                    .call(() => resolve())
                    .start();
            });
        }

        // Step 2: Fade out entire splash + fade in game screen simultaneously.
        if (this.gameScreen) {
            this.gameScreen.active = true;
            if (!this.gameScreen.getComponent(UIOpacity)) {
                this.gameScreen.addComponent(UIOpacity);
            }
            const gameOpacity = this.gameScreen.getComponent(UIOpacity)!;
            gameOpacity.opacity = 0;
            tween(gameOpacity).to(0.4, { opacity: 255 }).start();
        }

        if (this.splashNode) {
            const splashOpacity = this.splashNode.getComponent(UIOpacity)!;
            await new Promise<void>(resolve => {
                tween(splashOpacity)
                    .to(0.4, { opacity: 0 })
                    .call(() => {
                        if (this.splashNode) this.splashNode.active = false;
                        resolve();
                    })
                    .start();
            });
        }

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
            this.stopTimer();
            const panel = await UIManager.getInstance().openPanel('LevelCompletePanel', { levelId, score, stars, elapsedSeconds: this._elapsedSeconds });
            if (!panel) {
                this.returnToMenu();
            }
        } catch (err) {
            this.returnToMenu();
        }
    }

    private async onLevelFailed(levelId: number): Promise<void> {
        try {
            this.stopTimer();
            const panel = await UIManager.getInstance().openPanel('LevelFailedPanel', { levelId });
            if (!panel) {
                this.returnToMenu();
            }
        } catch (err) {
            this.returnToMenu();
        }
    }


    /** Khởi tạo tuần tự các hệ thống */
    private async initializeGame(): Promise<void> {
        this.setState(GameState.LOADING);

                                        
        await ConfigManager.getInstance().loadConfig();

        const skinMgr = SkinManager.getInstance();
        if (!skinMgr) {
                        return;
        }
        if (typeof skinMgr.loadDefaultSkin !== 'function') {
                        return;
        }
        await skinMgr.loadDefaultSkin();
        await skinMgr.prewarmSkinSprites();

        const audioMgr = AudioManager.getInstance();
        if (!audioMgr) {
                        return;
        }
        await audioMgr.initialize();

        await LevelManager.getInstance().initialize();

        // Register tile prefab for object pooling
        await this.registerTilePrefab();

        UIManager.getInstance().initialize(this.uiRoot);
        await UIManager.getInstance().preloadPanels([
            'GameplayPanel',
            'LevelCompletePanel',
            'LevelFailedPanel',
            'LevelSelectPanel',
        ]);

        this.setState(GameState.MAIN_MENU);

        const savedLevel = SaveManager.getInstance().getCurrentLevel();
        if (savedLevel > 0) {
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
                                resolve();
                return;
            }

            // Fallback: load from resources bundle.
            // Prefab must be placed under assets/resources/prefabs/tiles/
            resources.load('prefabs/tiles/tile_default', Prefab, (err, prefab) => {
                if (err) {
                                        resolve();
                    return;
                }
                PoolManager.getInstance().registerPrefab('tile_default', prefab);
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
        this.setState(GameState.GAMEPLAY);

        // Ensure ORDER_MATCH managers exist in scene
                this.ensureOrderManagers();

        // Close menu panels and show loading BEFORE loading assets
        UIManager.getInstance().closePanel('LevelSelectPanel');
        UIManager.getInstance().closePanel('LevelCompletePanel');
        UIManager.getInstance().closePanel('LevelFailedPanel');
        UIManager.getInstance().showLoading(`Loading Level ${levelId}...`);

        try {
            // Load all level data, skin assets and spawn tiles first
                        await LevelManager.getInstance().loadLevel(levelId);
            if (startToken !== this._startLevelToken) return;
            
            // Only open GameplayPanel AFTER everything is loaded and ready
                        const gameplayPanel = await UIManager.getInstance().openPanel('GameplayPanel');
            if (!gameplayPanel) {
                            } else {
                            }
            this.stopTimer();
            this._elapsedSeconds = 0;
            this.startTimer();
        } catch (err) {
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
                    }

        if (!isManagerValid(WrongTrayManager.Instance)) {
            if (WrongTrayManager.Instance) (WrongTrayManager as any).Instance = null;
            const wrongTrayNode = new Node('WrongTrayManager');
            wrongTrayNode.layer = effectiveParent?.layer ?? 0;
            wrongTrayNode.addComponent(UITransform);
            wrongTrayNode.addComponent(WrongTrayManager);
            wrongTrayNode.setParent(effectiveParent);
            wrongTrayNode.setPosition(850, 320, 0);
                    }

        if (!isManagerValid(BoosterManager.Instance)) {
            if (BoosterManager.Instance) (BoosterManager as any).Instance = null;
            const boosterNode = new Node('BoosterManager');
            boosterNode.layer = effectiveParent?.layer ?? 0;
            boosterNode.addComponent(BoosterManager);
            boosterNode.setParent(effectiveParent);
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
        this.stopTimer();
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

    private startTimer(): void {
        if (this._timerRunning) return;
        this._timerRunning = true;
        this.schedule(this._timerTick, 1);
    }

    private stopTimer(): void {
        if (!this._timerRunning) return;
        this._timerRunning = false;
        this.unschedule(this._timerTick);
    }

    private _timerTick(): void {
        this._elapsedSeconds++;
        EventBus.getInstance().emit(GameEvent.LEVEL_TIME_UPDATED, this._elapsedSeconds);
    }

    public getElapsedSeconds(): number {
        return this._elapsedSeconds;
    }
}
