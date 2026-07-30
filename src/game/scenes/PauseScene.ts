import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../constants';

// 暂停场景：覆盖层，提供继续游戏与返回主菜单
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  create() {
    // 半透明黑色遮罩
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, '游 戏 暂 停', {
        fontFamily: 'monospace',
        fontSize: '44px',
        color: '#FFFFFF',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const resumeBtn = this.makeButton(GAME_HEIGHT / 2 - 10, '继 续 游 戏', '#FFFFFF');
    const menuBtn = this.makeButton(GAME_HEIGHT / 2 + 60, '返 回 主 菜 单', '#FF3333');

    resumeBtn.on('pointerdown', () => {
      this.scene.resume('GameScene');
      this.scene.stop();
    });

    menuBtn.on('pointerdown', () => {
      this.scene.stop('GameScene');
      this.scene.start('StartScene');
    });
  }

  private makeButton(y: number, label: string, bg: string) {
    const btn = this.add
      .text(GAME_WIDTH / 2, y, label, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#0F0F0F',
        backgroundColor: bg,
        padding: { x: 24, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#0F0F0F', color: bg }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: bg, color: '#0F0F0F' }));
    return btn;
  }
}