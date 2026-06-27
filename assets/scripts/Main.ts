import { _decorator, Component, Node, Prefab, instantiate } from 'cc';
import { GameManager } from './managers/GameManager';

const { ccclass, property } = _decorator;

/**
 * Main - Entry point scene component.
 * Khởi tạo GameManager và các root nodes cần thiết.
 * Scene phải có node gắn Main component, dưới đó có các container nodes.
 */
@ccclass('Main')
export class Main extends Component {
    @property(Node)
    public uiRoot: Node | null = null;

    @property(Node)
    public gameplayRoot: Node | null = null;

    @property(Prefab)
    public managerPrefab: Prefab | null = null;

    protected onLoad(): void {
        this.ensureGameManager();
    }

    /** Đảm bảo GameManager singleton được mount */
    private ensureGameManager(): void {
        if (GameManager.Instance) return;

        if (this.managerPrefab) {
            const managerNode = instantiate(this.managerPrefab);
            managerNode.setParent(this.node);
        }
    }
}


