// 玩家皮肤配置：像素画板数据存取
// 皮肤为一个 GRID x GRID 的像素网格，每格存颜色索引（0=透明，其余为调色板颜色）

export const SKIN_GRID = 16; // 16x16 像素网格
export const SKIN_PALETTE: number[] = [
  0x000000, 0xffffff, 0xff3333, 0xff8800,
  0xffdd00, 0x33ff33, 0x33ddff, 0x3366ff,
  0xaa33ff, 0xff33aa, 0x888888, 0x444444,
  0x00ff88, 0xff00ff, 0x884400, 0x224488,
];
// 0 表示透明（空格）
export const SKIN_TRANSPARENT = 0;

export interface SkinData {
  grid: number[]; // 长度 SKIN_GRID*SKIN_GRID，值为调色板索引+1（0=透明）
  bgColor?: number;    // 可选：游戏背景颜色（如 0x1a1a1a）
  trailColor?: number; // 可选：玩家大招拖尾颜色（如 0xffffff）
  bulletColor?: number; // 可选：玩家普通子弹颜色（如 0x00ff88）
  trailAlpha?: number; // 可选：大招特效透明度 (默认 1.0)
  trailLifespan?: number; // 可选：大招特效持续时间/毫秒 (默认 1200)
}

const STORAGE_KEY = 'gdp_player_skin_v1';

export function defaultSkin(): SkinData {
  // 默认空心黑色三角形（PLAYER_SIZE=28 时的近似形状）
  const g = new Array(SKIN_GRID * SKIN_GRID).fill(0);
  const N = SKIN_GRID;
  
  // 画一个等腰空心三角形，尖端朝右 (或根据原始逻辑尖端朝下？)
  // 原逻辑: y=0 时 dx=0, y=1 时 dx=0,-1, y=2 时 dx=-1,0,1 等等
  // 这里改为边缘填色：当 y 是最后一行，或者 dx 达到 -half 或 half 时填色。
  for (let y = 0; y < N; y++) {
    const half = Math.floor((y + 1) / 2);
    for (let dx = -half; dx <= half; dx++) {
      const x = Math.floor(N / 2) + dx;
      if (x >= 0 && x < N) {
        // 空心判断：底部边缘，或者是两边的斜边边缘
        if (y === N - 1 || dx === -half || dx === half) {
          g[y * N + x] = 1; // 1 = 调色板索引 0 的黑色
        }
      }
    }
  }
  return { 
    grid: g,
    bgColor: 0x1a1a1a,
    trailColor: 0xffffff,
    bulletColor: 0x00ff88,
    trailAlpha: 1.0,
    trailLifespan: 1200
  };
}

export function loadSkin(): SkinData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.grid) && parsed.grid.length === SKIN_GRID * SKIN_GRID) {
        return { 
          grid: parsed.grid,
          bgColor: parsed.bgColor !== undefined ? parsed.bgColor : 0x1a1a1a,
          trailColor: parsed.trailColor !== undefined ? parsed.trailColor : 0xffffff,
          bulletColor: parsed.bulletColor !== undefined ? parsed.bulletColor : 0x00ff88,
          trailAlpha: parsed.trailAlpha !== undefined ? parsed.trailAlpha : 1.0,
          trailLifespan: parsed.trailLifespan !== undefined ? parsed.trailLifespan : 1200
        };
      }
    }
  } catch { /* ignore */ }
  return defaultSkin();
}

export function saveSkin(skin: SkinData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(skin));
  } catch { /* ignore */ }
}

// 从自定义皮肤像素数据重新生成 player 纹理，完全替换默认三角形。
// 可在任意场景调用（BootScene 首次生成 + GameScene 每局开始前刷新）。
export function regeneratePlayerSkinTexture(
  scene: Phaser.Scene,
  textureKey: string,
  playerSize: number
): void {
  const skin = loadSkin();
  const N = SKIN_GRID;
  const cellSize = playerSize / N;

  // 先移除已存在的同名纹理，否则 Phaser 不会替换
  if (scene.textures.exists(textureKey)) {
    scene.textures.remove(textureKey);
  }

  const g = scene.add.graphics();
  g.clear();
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const colorIdx = skin.grid[r * N + c];
      if (colorIdx === SKIN_TRANSPARENT) continue;
      const color = SKIN_PALETTE[colorIdx - 1] ?? 0x000000;
      g.fillStyle(color, 1);
      g.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
    }
  }
  g.generateTexture(textureKey, playerSize, playerSize);
  g.destroy();
}
