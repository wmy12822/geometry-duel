// 资源加载：本游戏使用 Phaser graphics.generateTexture 生成纯色像素几何图形，
// 无需外部贴图文件。所有纹理在 BootScene 中生成。

export const ASSET_KEYS = {
  player: 'player_triangle',
  enemy: 'enemy_diamond',
  bullet: 'bullet_square',
  ultimate: 'ultimate_square',
  enemy_bullet: 'enemy_bullet_square',
  pixel: 'pixel_block',
} as const;