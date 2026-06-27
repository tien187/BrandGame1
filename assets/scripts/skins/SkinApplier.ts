import { _decorator, Component, Node, Sprite, SpriteFrame, Label, Font } from 'cc';
import { SkinManager } from '../managers/SkinManager';
import { SkinCategory } from '../enums/SkinCategory';

const { ccclass, property } = _decorator;

/**
 * SkinApplier - Component gắn vào node cần đổi skin.
 * Tự động apply sprite/font mới khi skin thay đổi.
 * Dùng trong editor để đánh dấu node cần reskin.
 */
@ccclass('SkinApplier')
export class SkinApplier extends Component {
    @property(String)
    public category: SkinCategory = SkinCategory.TILES;

    @property
    public assetKey: string = '';

    protected onLoad(): void {
        this.applySkin();
    }

    /** Apply asset hiện tại của skin */
    public async applySkin(): Promise<void> {
        if (!this.assetKey) return;

        const sprite = this.getComponent(Sprite);
        if (sprite) {
            const frame = await SkinManager.getInstance().getSprite(this.assetKey, this.category);
            if (frame) {
                sprite.spriteFrame = frame;
            }
        }

        const label = this.getComponent(Label);
        if (label) {
            const fontName = SkinManager.getInstance().getDefaultFont();
            // TODO: Load và apply font
        }
    }
}
