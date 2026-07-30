import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../constants';

// 游戏结束页面：显示胜利或失败结果，提供重新开始与返回主菜单
export class GameOverScene extends Phaser.Scene {
  private win = false;
  private lastMode = 'standard';

  constructor() {
    super('GameOverScene');
  }

  init(data: { win?: boolean; mode?: string }) {
    this.win = data.win ?? false;
    this.lastMode = data.mode || 'standard';
  }

  create() {
    // 添加全透明纯黑遮罩
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8);
    this.drawGrid();

    const titleColor = this.win ? '#FFFFFF' : '#FF3333';
    const titleText = this.win ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED';
    const subText = this.win ? '敌人已被摧毁' : '你的几何体被粉碎';

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, titleText, {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: titleColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, subText, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#CCCCCC',
      })
      .setOrigin(0.5);

    const restartBtn = this.makeButton(GAME_HEIGHT / 2 + 40, '重 新 开 始', titleColor);
    const menuBtn = this.makeButton(GAME_HEIGHT / 2 + 110, '返 回 主 菜 单', '#CCCCCC');

    restartBtn.on('pointerdown', () => {
      this.scene.start('GameScene', { mode: this.lastMode });
    });

    menuBtn.on('pointerdown', () => {
      this.scene.start('StartScene');
    });
  }

  private makeButton(y: number, label: string, bg: string) {
    const btn = this.add
      .text(GAME_WIDTH / 2, y, label, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#0F0F0F', // 文字底色为黑
        backgroundColor: bg, // 按钮背景色
        padding: { x: 24, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
      
    // 无边框，全角
    btn.setStroke(bg, 0);

    // 悬停反色效果（硬核交互）
    btn.on('pointerover', () => {
      btn.setStyle({ backgroundColor: '#0F0F0F', color: bg });
      // 强行加上边框表示悬停
      const border = this.add.rectangle(btn.x, btn.y, btn.width, btn.height).setStrokeStyle(4, Phaser.Display.Color.HexStringToColor(bg).color);
      btn.setData('border', border);
    });
    btn.on('pointerout', () => {
      btn.setStyle({ backgroundColor: bg, color: '#0F0F0F' });
      const border = btn.getData('border') as Phaser.GameObjects.Rectangle;
      if (border) border.destroy();
    });
    return btn;
  }

  private drawGrid() {
    const g = this.add.graphics();
    const step = 40;
    // 极淡连接线
    g.lineStyle(0.5, 0x101028, 0.4);
    for (let x = 0; x <= GAME_WIDTH; x += step) g.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += step) g.lineBetween(0, y, GAME_WIDTH, y);
    // 交点微光
    g.fillStyle(0x202050, 0.35);
    for (let x = 0; x <= GAME_WIDTH; x += step) {
      for (let y = 0; y <= GAME_HEIGHT; y += step) {
        g.fillCircle(x, y, 1.5);
      }
    }
  }
}