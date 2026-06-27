# Cocos Creator Setup Guide - Triple Tile Game

## 1. Project Setup in Cocos Creator

### Open Project
1. Open **Cocos Dashboard** → Click **Open Project**
2. Select folder: `d:\CocosProject\MiniGame1`
3. Cocos Creator version: **3.x** (recommend 3.7+)

### Create Main Scene
1. In **Assets** panel, right-click → **Create** → **Scene**
2. Name it: `MainScene`
3. Double-click to open

---

## 2. Scene Setup & Inspector Wiring

This section explains **exactly** which nodes to create, which scripts to attach, and which `@property` fields to fill in the Inspector. **If any property is left unassigned, the game will silently fail or log warnings.**

### 2.1. Scene Node Hierarchy

Create this exact tree in the **Hierarchy** panel. Empty nodes = create `Node`, no Sprite.

```
Canvas (root, already exists)
├── Camera (already exists)
├── Background (Sprite — assign background image here)
├── GameManager (empty Node)
│   ├── BoardManager (empty Node)
│   │   └── BoardRoot (empty Node)
│   ├── TileManager (empty Node)
│   │   └── TileContainer (empty Node)
│   ├── TrayManager (empty Node)
│   │   └── TrayContainer (empty Node — tiles fly INTO this node)
│   ├── MatchManager (empty Node)
│   ├── AudioManager (empty Node)
│   ├── SkinManager (empty Node)
│   ├── BoosterManager (empty Node)
│   └── UIManager (empty Node)
├── UI (empty Node)
│   ├── PopupLayer (empty Node — panels are parented here)
│   └── OverlayLayer (empty Node — block-input overlay)
```

> **Note**: `LevelManager`, `ConfigManager`, `PoolManager`, `EventBus` are **pure code singletons** — they have NO `@ccclass` and do NOT need scene nodes.

### 2.2. Attach Components (Inspector → Add Component)

Attach the matching script to each node:

| Scene Node | Script to Attach |
|------------|------------------|
| `GameManager` | `GameManager.ts` |
| `BoardManager` | `BoardManager.ts` |
| `TileManager` | `TileManager.ts` |
| `TrayManager` | `TrayManager.ts` |
| `MatchManager` | `MatchManager.ts` |
| `UIManager` | `UIManager.ts` |
| `AudioManager` | `AudioManager.ts` |
| `SkinManager` | `SkinManager.ts` |
| `BoosterManager` | `BoosterManager.ts` |

### 2.3. Wire `@property` References in Inspector

For **each** component above, drag the correct child/sibling node into the matching field:

| Component | Property | Drag This Node Into Field |
|-----------|----------|---------------------------|
| `GameManager` | `uiRoot` | `UI` node (sibling of GameManager) |
| `GameManager` | `gameplayRoot` | Optional — can leave empty |
| `GameManager` | `tilePrefab` | `tile_default.prefab` asset from Assets panel |
| `BoardManager` | `boardRoot` | `BoardRoot` (child of BoardManager) |
| `TileManager` | `tileContainer` | `TileContainer` (child of TileManager) |
| `TrayManager` | `trayContainer` | `TrayContainer` (child of TrayManager) |
| `UIManager` | `uiRoot` | `UI` node (sibling of GameManager) |
| `UIManager` | `popupLayer` | `PopupLayer` (child of UI) |
| `UIManager` | `overlayLayer` | `OverlayLayer` (child of UI) |

> **Critical**: `tilePrefab` can be assigned in Inspector OR placed at `assets/resources/prefabs/tiles/tile_default.prefab`. Inspector assignment takes priority.

### 2.4. How tilePrefab Flows at Runtime

```
Inspector: GameManager.tilePrefab = tile_default.prefab
     |
     v
GameManager.registerTilePrefab()
     |---> PoolManager.registerPrefab('tile_default', prefab)
               |
               v
TileManager.spawnTiles()  <-- LevelManager.startLevel()
     |---> PoolManager.get('tile_default')
               |---> instantiate(prefab)
               |---> node.setParent(TileManager.tileContainer)
               |---> SkinManager.applyTileSkin(node, skinOverride)
```

So: **tile nodes are created dynamically** from the prefab and parented to `TileContainer`. You do NOT place individual tiles in the scene.

### 2.5. How UI Panels Work

UI Panels are **NOT** static nodes in the scene. They are loaded as prefabs dynamically:

```
UIManager.openPanel('LevelSelectPanel')
     |---> SkinManager.getPanelPrefab('LevelSelectPanel')
               |---> lookup key "panel_LevelSelectPanel" in skin JSON
               |---> resources.load(path) → Prefab
     |---> instantiate(prefab)
     |---> node.setParent(UIManager.popupLayer)
     |---> node.getComponent(BasePanel).show()
```

**What you need to create**:
1. UI panel prefabs (e.g. `panel_levelselect.prefab`, `panel_gameplay.prefab`)
2. Each prefab must have a component that **extends `BasePanel`** (e.g. `LevelSelectPanel.ts`, `GameplayPanel.ts`)
3. Register each prefab in the active skin JSON under `assets.ui` with key `panel_<PanelName>`:
   ```json
   { "key": "panel_LevelSelectPanel", "path": "skins/uma/ui/panel_levelselect", "assetType": "prefab" }
   ```

### 2.6. How Tray Works

The Tray is a visual bar at the bottom of the screen. Setup:

1. `TrayManager.trayContainer` is an empty Node positioned at the bottom of the screen (e.g. Y = -400).
2. When a player clicks a tile:
   - `TrayManager.addTile()` is called
   - Tile node is `setParent(trayContainer)`
   - Tile tweens from board position to a slot position inside `trayContainer`
   - Slots are calculated automatically: `centerOffset + index * slotSpacing`

**No slot nodes are needed in the scene** — slots are purely virtual positions calculated by `TrayManager.getSlotPosition()`.

### 2.7. Summary — What Happens on Game Start

```
MainScene loads
     |
     v
GameManager.onLoad() → makes itself persistent
     |
     v
GameManager.start() → initializeGame()
     |---> ConfigManager.loadConfig()
     |---> SkinManager.loadDefaultSkin()
     |---> AudioManager.initialize()
     |---> LevelManager.initialize()
     |---> registerTilePrefab()  (uses Inspector tilePrefab)
     |---> UIManager.initialize(GameManager.uiRoot)
     |---> openPanel('LevelSelectPanel')  → loads prefab into PopupLayer
```

---

## 3. Asset Folder Structure

Create folders in `assets/`:

```
assets/
├── scripts/
│   ├── managers/       (BoardManager, TileManager, etc.)
│   ├── gameplay/       (Tile.ts component)
│   ├── interfaces/     (ITileData.ts, IBoardConfig.ts, etc.)
│   ├── enums/          (GameEvent.ts, MatchResult.ts, etc.)
│   ├── core/           (EventBus.ts, PoolManager.ts, LevelGenerator.ts, ConfigManager.ts)
│   └── tests/          (TestRunner.ts, *.test.ts)
├── resources/
│   ├── data/
│   │   ├── levels/
│   │   │   ├── level_001.json
│   │   │   ├── level_002.json
│   │   │   └── level_011.json
│   │   └── skins/
│   │       ├── uma_skin.json
│   │       ├── saigonfood_skin.json
│   │       └── goc_skin.json
│   ├── prefabs/
│   │   └── tiles/
│   │       └── tile_default.prefab   (base tile prefab)
│   └── audio/
│       ├── bgm_main.mp3
│       ├── sfx_click.mp3
│       ├── sfx_match.mp3
│       └── sfx_error.mp3
├── textures/
│   └── skins/
│       ├── uma/
│       │   ├── tiles/
│       │   │   ├── cushion.png
│       │   │   ├── lamp.png
│       │   │   ├── clock.png
│       │   │   ├── vase.png
│       │   │   ├── plant.png
│       │   │   ├── basket.png
│       │   │   ├── frame.png
│       │   │   └── storagebox.png
│       │   ├── bg/
│       │   │   └── bg_gameplay.png
│       │   ├── board/
│       │   │   └── frame.png
│       │   ├── tray/
│       │   │   └── tray_bg.png
│       │   └── ui/
│       │       ├── panel_mainmenu.png
│       │       └── panel_gameplay.png
│       ├── saigonfood/
│       │   ├── tiles/
│       │   │   ├── springroll.png
│       │   │   ├── sauce.png
│       │   │   ├── mealbox.png
│       │   │   ├── noodlebowl.png
│       │   │   ├── fishball.png
│       │   │   └── spicepack.png
│       │   ├── bg/
│       │   │   └── bg_gameplay.png
│       │   └── ...
│       └── goc/
│           ├── tiles/
│           │   ├── corn.png
│           │   ├── mango.png
│           │   ├── durian.png
│           │   ├── rice.png
│           │   ├── coffee.png
│           │   ├── cashew.png
│           │   ├── pepper.png
│           │   └── honey.png
│           ├── bg/
│           │   └── bg_gameplay.png
│           └── ...
└── particles/
    └── fx_match.prefab
```

---

## 3.5. JSON Config Templates

### `resources/data/config/game_config.json`

```json
{
  "version": "1.0.0",
  "defaults": {
    "skinId": "uma",
    "musicVolume": 1.0,
    "sfxVolume": 1.0,
    "language": "en"
  },
  "gameplay": {
    "tileMoveDuration": 0.3,
    "matchDelay": 0.5,
    "shuffleCooldown": 5.0,
    "hintCooldown": 3.0,
    "trayShakeIntensity": 0.2
  },
  "boosters": [
    { "id": "UNDO", "type": 1, "displayName": "Undo", "description": "Undo last move", "coinCost": 100, "gemCost": 0, "maxStack": 99, "iconKey": "booster_undo" },
    { "id": "SHUFFLE", "type": 2, "displayName": "Shuffle", "description": "Shuffle board tiles", "coinCost": 200, "gemCost": 0, "maxStack": 99, "iconKey": "booster_shuffle" },
    { "id": "HINT", "type": 3, "displayName": "Hint", "description": "Show a hint", "coinCost": 150, "gemCost": 0, "maxStack": 99, "iconKey": "booster_hint" },
    { "id": "REMOVE", "type": 4, "displayName": "Remove", "description": "Remove 3 tiles from tray", "coinCost": 250, "gemCost": 0, "maxStack": 99, "iconKey": "booster_remove" },
    { "id": "MAGNET", "type": 5, "displayName": "Magnet", "description": "Pull matching tiles to tray", "coinCost": 300, "gemCost": 0, "maxStack": 99, "iconKey": "booster_magnet" }
  ],
  "audio": [
    { "key": "sfx_click", "path": "audio/sfx_click", "type": 0, "loop": false, "volume": 1.0 },
    { "key": "sfx_match", "path": "audio/sfx_match", "type": 0, "loop": false, "volume": 1.0 },
    { "key": "sfx_error", "path": "audio/sfx_error", "type": 0, "loop": false, "volume": 1.0 },
    { "key": "bgm_main", "path": "audio/bgm_main", "type": 1, "loop": true, "volume": 0.5 }
  ]
}
```

### `resources/data/levels/level_001.json`

```json
{
  "levelId": 1,
  "displayName": "Level 1",
  "board": {
    "rows": 6,
    "cols": 6,
    "maxLayers": 3,
    "tileSpacing": 80,
    "centerOffset": { "x": 0, "y": 0 },
    "coverThreshold": 0.3
  },
  "tray": {
    "maxSlots": 8,
    "matchCount": 3,
    "screenPosition": { "x": 0, "y": -400 },
    "slotSpacing": 90
  },
  "tiles": [],
  "starThresholds": [300, 600, 900],
  "timeLimit": 0,
  "moveLimit": 0,
  "defaultSkin": "uma"
}
```

> **Note**: If `tiles` is empty, `LevelManager` will auto-generate tiles via `LevelGenerator` using the board shape, layer count, and available `groupId`s from the current skin.

### `resources/data/skins/uma_skin.json`

```json
{
  "skinId": "uma",
  "displayName": "UMA Brand",
  "themeColors": {
    "primary": "#FF6B6B",
    "secondary": "#4ECDC4",
    "accent": "#FFE66D",
    "background": "#F7F7F7"
  },
  "defaultFont": "default_font",
  "itemGroups": ["cushion", "lamp", "clock", "vase", "plant", "basket", "frame", "storagebox"],
  "assets": {
    "tiles": [
      { "key": "tile_cushion", "path": "skins/uma/tiles/cushion", "assetType": "sprite" },
      { "key": "tile_lamp", "path": "skins/uma/tiles/lamp", "assetType": "sprite" },
      { "key": "tile_clock", "path": "skins/uma/tiles/clock", "assetType": "sprite" },
      { "key": "tile_vase", "path": "skins/uma/tiles/vase", "assetType": "sprite" },
      { "key": "tile_plant", "path": "skins/uma/tiles/plant", "assetType": "sprite" },
      { "key": "tile_basket", "path": "skins/uma/tiles/basket", "assetType": "sprite" },
      { "key": "tile_frame", "path": "skins/uma/tiles/frame", "assetType": "sprite" },
      { "key": "tile_storagebox", "path": "skins/uma/tiles/storagebox", "assetType": "sprite" }
    ],
    "ui": [
      { "key": "panel_gameplay", "path": "prefabs/ui/panel_gameplay", "assetType": "prefab" },
      { "key": "panel_LevelSelectPanel", "path": "prefabs/ui/panel_levelselect", "assetType": "prefab" }
    ],
    "bg": [
      { "key": "bg_gameplay", "path": "skins/uma/bg/bg_gameplay", "assetType": "sprite" }
    ]
  }
}
```

---

## 3.6. Prefab Setup

### `tile_default.prefab` — The Tile Prefab

This is the single most important prefab. Every tile in the game is instantiated from it.

**How to create:**
1. In **Hierarchy**, create an empty Node: `Right-click Canvas → Create → Node` → name it `TileTemplate`
2. Add components to `TileTemplate` (Inspector → Add Component):
   - `UITransform` (auto-added for UI nodes, or add manually)
   - `Sprite` — leave `SpriteFrame` empty (it will be assigned at runtime by `SkinManager`)
   - `Tile` (attach `Tile.ts` script)
3. Set `TileTemplate` size to **100 x 120** (or your desired tile size)
4. In **Assets**, create folder `resources/prefabs/tiles/`
5. Drag `TileTemplate` from Hierarchy into `assets/resources/prefabs/tiles/`
6. Rename the created prefab to `tile_default.prefab`
7. Delete `TileTemplate` from Hierarchy (keep only the prefab asset)

**Inspector fields on `Tile` component:**
| Property | What to assign | Required? |
|----------|---------------|-----------|
| `visualNode` | Leave empty (defaults to `this.node`) | No |
| `blockOverlay` | Create a child Sprite node named `BlockOverlay`, tint it dark gray, assign here | Optional |
| `selectableColor` | `Color.WHITE` (default) — tile có thể chọn | No |
| `blockedColor` | `Color(80,80,80,255)` (default) — tile bị block hoàn toàn | No |
| `dimmedColor` | `Color(160,160,160,180)` (default) — tile bị che bởi tile trên | No |
| `selectedColor` | `Color(255,220,100,255)` (default) — tile đang chọn | No |

**Inspector fields on `BoardManager` component:**
| Property | What to assign | Required? |
|----------|---------------|-----------|
| `boardRoot` | Node chứa các tile trong scene | Yes |
| `tileSize` | Kích thước tile (world units), default 100 | No |
| `tileSpacing` | Khoảng cách giữa các tile, để 0 để dùng giá trị từ level config | No |
| `tileOverlapRatio` | Tỷ lệ tile che nhau (0-1), default 0.35 | No |

**Inspector fields on `TrayManager` component:**
| Property | What to assign | Required? |
|----------|---------------|-----------|
| `trayContainer` | Node chứa tile trong tray (đặt ở bottom screen, Y ≈ -400) | Yes |
| `flyDuration` | Thời gian bay tile vào tray (giây), default 0.3 | No |
| `rearrangeDuration` | Thời gian sắp xếp lại tray (giây), default 0.15 | No |
| `slotSpacing` | Khoảng cách giữa các slot, để 0 để dùng giá trị từ level config | No |

**After creating the prefab, assign it to `GameManager`:**
1. Select `GameManager` node in Hierarchy
2. In Inspector, find `GameManager` component
3. Drag `tile_default.prefab` asset into the `tilePrefab` field

### UI Panel Prefabs

Each panel that `UIManager.openPanel()` loads must be a prefab with a component extending `BasePanel`.

**How to create `panel_levelselect.prefab`:**
1. In Hierarchy, create a Node named `LevelSelectPanel`
2. Add `UITransform`, set size to **1080 x 1920** (full screen)
3. Add a child Node named `Background` with `Sprite` (semi-transparent black, e.g. `Color(0,0,0,180)`)
4. Add a child Node named `Content` with a scrollable list of level buttons
5. Add component `LevelSelectPanel.ts` to the root node `LevelSelectPanel`
6. Drag `LevelSelectPanel` from Hierarchy to `assets/resources/prefabs/ui/`
7. Rename the prefab to `panel_levelselect.prefab`
8. Delete the Hierarchy instance

**How to create `panel_mainmenu.prefab`:**
1. In Hierarchy, create a Node named `MainMenuPanel`
2. Add `UITransform`, set size to **1080 x 1920** (full screen)
3. Add a child Node named `Background` with `Sprite` (semi-transparent black, e.g. `Color(0,0,0,180)`)
4. Add a child Node named `TitleLabel` with `Label` component — text "Match 3 Game", font size 72, position (0, 400)
5. Add a child Node named `PlayButton` with `Sprite` (màu xanh lá, size 400x100, position (0, 0))
6. Add a child Node named `PlayText` (child of `PlayButton`) with `Label` — text "PLAY", font size 48
7. Add component `BasePanel.ts` (or a script extending `BasePanel`) to the root node `MainMenuPanel`
8. Drag `MainMenuPanel` from Hierarchy to `assets/resources/prefabs/ui/`
9. Rename the prefab to `panel_mainmenu.prefab`
10. Delete the Hierarchy instance

**How to create `panel_gameplay.prefab`:**
1. In Hierarchy, create a Node named `GameplayPanel`
2. Add `UITransform`, set size to **1080 x 1920** (full screen)
3. Add a child Node named `Background` with `Sprite` (semi-transparent black, e.g. `Color(0,0,0,100)`)
4. Add a child Node named `PauseButton` with `Sprite` (icon pause, position top-right)
5. Add a child Node named `ScoreLabel` with `Label` component (position top-center)
6. Add component `GameplayPanel.ts` to the root node `GameplayPanel`
7. Drag `GameplayPanel` from Hierarchy to `assets/resources/prefabs/ui/`
8. Rename the prefab to `panel_gameplay.prefab`
9. Delete the Hierarchy instance

**Important:** Each panel prefab's root node name should match the string passed to `UIManager.openPanel()` (case-sensitive).

---

## 4. Image Naming & Requirements

### Tile Sprites (square, recommend 128x128 or 256x256)
- Format: PNG with transparency
- Size: 128x128 px (can scale in editor)
- Naming: Use **lowercase_snake_case**, match the `groupId` in JSON config

#### UMA Brand (8 items)
| Item | File Name | groupId in JSON |
|------|-----------|-----------------|
| Cushion | `cushion.png` | `cushion` |
| Lamp | `lamp.png` | `lamp` |
| Clock | `clock.png` | `clock` |
| Vase | `vase.png` | `vase` |
| Plant | `plant.png` | `plant` |
| Basket | `basket.png` | `basket` |
| Frame | `frame.png` | `frame` |
| Storage Box | `storagebox.png` | `storagebox` |

#### SaigonFood Brand (6 items)
| Item | File Name | groupId in JSON |
|------|-----------|-----------------|
| Spring Roll | `springroll.png` | `springroll` |
| Sauce | `sauce.png` | `sauce` |
| Meal Box | `mealbox.png` | `mealbox` |
| Noodle Bowl | `noodlebowl.png` | `noodlebowl` |
| Fish Ball | `fishball.png` | `fishball` |
| Spice Pack | `spicepack.png` | `spicepack` |

#### G.O.C Brand (8 items)
| Item | File Name | groupId in JSON |
|------|-----------|-----------------|
| Corn | `corn.png` | `corn` |
| Mango | `mango.png` | `mango` |
| Durian | `durian.png` | `durian` |
| Rice | `rice.png` | `rice` |
| Coffee | `coffee.png` | `coffee` |
| Cashew | `cashew.png` | `cashew` |
| Pepper | `pepper.png` | `pepper` |
| Honey | `honey.png` | `honey` |

### Background
- File: `bg_gameplay.png`
- Size: 1080x1920 (portrait mobile)
- Place under: `textures/skins/{brand}/bg/`

### Tray Background
- File: `tray_bg.png`
- Size: 800x150 (wide horizontal bar)
- Place under: `textures/skins/{brand}/tray/`

---

## 5. Tile Prefab Setup

1. In **Assets** panel, right-click → **Create** → **Prefab**
2. Name it: `tile_default`
3. Open prefab for editing
4. Add child nodes:
   ```
   tile_default (root Node)
   └── visual (Sprite node - assign to Tile.visualNode)
       └── blockOverlay (Sprite node - assign to Tile.blockOverlay, set active = false)
   ```
5. Add component: `Tile` script to root node
6. In Tile component Inspector:
   - **Visual Node**: drag `visual` child
   - **Block Overlay**: drag `blockOverlay` child
   - **Selectable Color**: `#FFFFFF` (white)
   - **Blocked Color**: `#787878B4` (gray 180 alpha)
   - **Selected Color**: `#FFDC64` (yellow)
   - **Glow Color**: `#FFC832` (gold)
7. Add `Sprite` component to `visual` node and assign a default sprite
8. Save prefab

---

## 6. SkinManager Config

Ensure `SkinManager.ts` maps `groupId` to the correct prefab key and sprite path:

```typescript
public getTilePrefabKey(groupId: string): string {
    return 'tile_default'; // All tiles share same prefab, visual changed by sprite
}
```

For sprite assignment, implement `applyTileSkin`:
```typescript
public applyTileSkin(node: Node, skinOverride: string): void {
    // skinOverride format: "uma/cushion"
    const [brand, item] = skinOverride.split('/');
    const key = `tile_${item}`;
    // Load sprite via SkinManager.getSprite(key, SkinCategory.TILES)
}
```

---

## 7. Audio Setup

Import audio files to `assets/resources/audio/` (must be inside `resources/` for `resources.load`):
- `bgm_main.mp3` - Background music
- `sfx_click.mp3` - Tile click (short, ~0.1s)
- `sfx_match.mp3` - Match success (pleasant chime, ~0.5s)
- `sfx_error.mp3` - Invalid click / game over

In **AudioManager.ts**, ensure AudioSource component is added to the AudioManager node.

---

## 8. Running Tests

Option 1: **Editor Console Test (Recommended)**
1. Create an empty node in scene
2. Attach `TestRunnerComponent.ts` (already available at `assets/scripts/tests/TestRunnerComponent.ts`):
```typescript
import { _decorator, Component } from 'cc';
import { runAllTests } from '../tests/AllTests';

const { ccclass } = _decorator;

@ccclass('TestRunnerComponent')
export class TestRunnerComponent extends Component {
    protected onLoad(): void {
        console.log('=== RUNNING ALL TESTS ===');
        runAllTests();
        console.log('=== ALL TESTS COMPLETE ===');
    }
}
```
3. Enter **Play Mode** in Editor
4. Check **Console** for `[PASS]` / `[FAIL]` results

Option 2: **Build & Device Test**
- Tests are self-contained and can run on device builds
- Check Device Console for output

### Test Coverage
| Module | Test File | Key Cases |
|--------|-----------|-----------|
| BoardManager | `BoardManager.test.ts` | Grid registration, occlusion, world position, edge cases |
| TrayManager | `TrayManager.test.ts` | Add/remove, sorting, dead end, history sync, duplicate prevention |
| MatchManager | `MatchManager.test.ts` | Match detection, input lock, chain match, valid moves |
| BoosterManager | `BoosterManager.test.ts` | Inventory, Undo, Shuffle solvability, Magnet, Remove |
| LevelGenerator | `LevelGenerator.test.ts` | Shapes, layer progression, solvability, group counts |
| TileManager | `TileManager.test.ts` | Spawn/clear, click lock, restore, board sync |

---

## 9. Build Settings

### Android / iOS Build
1. **Project** → **Build** → **Build Panel**
2. Platform: **Android** or **iOS**
3. Set **Bundle Identifier**: `com.yourcompany.tripletile`
4. Check **MD5 Cache** for asset integrity
5. Click **Build**

### Web Mobile Build
1. Platform: **Web Mobile**
2. Resolution: 1080x1920 (Portrait)
3. Click **Build**

---

## 10. Common Issues

| Issue | Fix |
|-------|-----|
| `"Cannot find module"` lint in same folder | Reload Cocos Creator window (**File → Reload Window**) — IDE index stale |
| Tile not showing | Check Z-order (`layer * 10`), ensure Sprite component has texture assigned |
| Click not working | Ensure Node has `UITransform`; `BlockInputEvents` is not blocking the node |
| Pool returns `null` | `tile_default.prefab` must exist at `assets/resources/prefabs/tiles/` (inside `resources/` for `resources.load`) or assigned to `GameManager.tilePrefab` in Inspector |
| Tween flickering / scale jump | Stop all tweens before putting node back to pool (already handled in code) |
| Skin not changing sprite | `skinOverride` format must be `"brand/item"` (e.g. `"uma/cushion"`) and skin JSON key must be `tile_<item>` |
| Audio not playing | Ensure audio files are in `assets/resources/audio/` (required for `resources.load`) and imported into project |
| Level load fails | Check `level_001.json` exists at `resources/data/levels/` with correct `ILevelData` format |
| Undo restores tile at wrong position | Ensure `TileManager.restoreToBoard()` is called; it handles parent reset + world position |
| Input unlocked during match animation | Fixed: input only unlocks when no further match is detected (chain match safety) |

---

## Quick Checklist Before Build

### Scene & Inspector Wiring (Section 2)
- [ ] `MainScene` created and set as Start Scene in **Build Settings**
- [ ] All manager nodes created under `GameManager` (see Section 2.1 hierarchy)
- [ ] All `@ccclass` scripts attached to correct nodes (Section 2.2 table)
- [ ] `GameManager.tilePrefab` assigned in **Inspector** (drag prefab asset) OR placed at `assets/resources/prefabs/tiles/tile_default.prefab`
- [ ] `GameManager.uiRoot` assigned to `UI` node in Inspector
- [ ] `BoardManager.boardRoot` assigned to `BoardRoot` child node
- [ ] `TileManager.tileContainer` assigned to `TileContainer` child node
- [ ] `TrayManager.trayContainer` assigned to `TrayContainer` child node (position at bottom screen, e.g. Y = -400)
- [ ] `UIManager.uiRoot` assigned to `UI` node
- [ ] `UIManager.popupLayer` assigned to `PopupLayer` child of UI
- [ ] `UIManager.overlayLayer` assigned to `OverlayLayer` child of UI

### Assets
- [ ] `tile_default.prefab` created (single Sprite node + `Tile.ts` component + `UITransform` + `Sprite`)
- [ ] Tile images imported to `assets/resources/textures/skins/{brand}/tiles/`
- [ ] UI panel prefabs created (`panel_levelselect.prefab`, `panel_gameplay.prefab`, etc.) with components extending `BasePanel`
- [ ] `game_config.json` placed in `resources/data/config/`
- [ ] `level_001.json` placed in `resources/data/levels/`
- [ ] Skin JSON configs placed in `resources/data/skins/` (must include `itemGroups` array)
- [ ] Audio files imported to `assets/resources/audio/`

### Verification
- [ ] Skin JSON `assets.ui` array contains keys: `panel_mainmenu`, `panel_gameplay`, `panel_LevelSelectPanel`
- [ ] Skin JSON `assets.tiles` keys use format `tile_<itemName>` (e.g. `tile_cushion`)
- [ ] Tests run and all pass in Editor (attach `TestRunnerComponent`, enter Play Mode)
- [ ] Build settings: **Portrait** 1080x1920, Bundle ID set

> **Note on `Main.ts`**: This file (`assets/scripts/Main.ts`) is the default Cocos Creator entry script. You can leave it empty or use it as an alternative bootstrap. The actual game bootstrap is handled by `GameManager.ts` attached to the scene root node.

