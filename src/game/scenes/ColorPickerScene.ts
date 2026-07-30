import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { SKIN_PALETTE, loadSkin, saveSkin, SkinData } from '../skinConfig';

const NEON_BLUE = 0x00e5ff;
const NEON_BLUE_STR = '#00e5ff';
const FONT_IMPACT = '"Impact", "Arial Black", sans-serif';

export class ColorPickerScene extends Phaser.Scene {
  private skin!: SkinData;
  private mode!: 'bg' | 'trail' | 'bullet';
  private currentColor!: number;
  private colorBtns: Phaser.GameObjects.Rectangle[] = [];
  private toast!: Phaser.GameObjects.Text;

  constructor() {
    super('ColorPickerScene');
  }

  init(data: { mode: 'bg' | 'trail' | 'bullet' }) {
    this.mode = data.mode;
  }

  create() {
    this.skin = loadSkin();
    this.currentColor = this.mode === 'bg' 
      ? (this.skin.bgColor ?? 0x1a1a1a) 
      : this.mode === 'trail' 
        ? (this.skin.trailColor ?? 0xffffff)
        : (this.skin.bulletColor ?? 0x00ff88);

    this.cameras.main.setBackgroundColor(0x000000);
    this.drawBackground();

    const titleText = this.mode === 'bg' ? '背 景 颜 色' : this.mode === 'trail' ? '攻 击 特 效' : '子 弹 颜 色';
    this.add.text(GAME_WIDTH / 2, 80, titleText, {
      fontFamily: FONT_IMPACT, fontSize: '48px', color: NEON_BLUE_STR, fontStyle: 'italic bold'
    }).setOrigin(0.5).setShadow(0, 0, NEON_BLUE_STR, 10, true, true);

    this.drawPalette();

    const btnY = GAME_HEIGHT - 80;

    if (this.mode === 'trail') {
      this.drawTrailSettings();
    }

    const saveBtn = this.add.text(GAME_WIDTH / 2 - 100, btnY, '[ 保存并返回 ]', {
      fontFamily: FONT_IMPACT, fontSize: '28px', color: '#00ff88', fontStyle: 'italic bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    saveBtn.setShadow(0, 0, '#00ff88', 8, true, true);
    saveBtn.on('pointerdown', () => this.saveAndExit());

    const cancelBtn = this.add.text(GAME_WIDTH / 2 + 100, btnY, '[ 取消 ]', {
      fontFamily: FONT_IMPACT, fontSize: '28px', color: '#ff6666', fontStyle: 'italic bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cancelBtn.setShadow(0, 0, '#ff6666', 8, true, true);
    cancelBtn.on('pointerdown', () => this.backToSettings());

    this.toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '保存成功！', {
      fontFamily: FONT_IMPACT, fontSize: '32px', color: '#00ff88', fontStyle: 'italic bold'
    }).setOrigin(0.5).setDepth(50).setAlpha(0);
    this.toast.setShadow(0, 0, '#00ff88', 16, true, true);
  }

  private drawPalette() {
    // 基础颜色 + 调色板颜色
    const colors = [
      0x000000, 0x1a1a1a, 0x112233, 0x331122, 0x223311, 0xffffff,
      ...SKIN_PALETTE
    ];
    
    // 去重
    const uniqueColors = Array.from(new Set(colors));

    const swatch = 40;
    const gap = 15;
    const cols = 8;
    const rows = Math.ceil(uniqueColors.length / cols);
    const panelW = cols * swatch + (cols - 1) * gap;
    const panelH = rows * swatch + (rows - 1) * gap;
    
    const startX = GAME_WIDTH / 2 - panelW / 2 + swatch / 2;
    const startY = GAME_HEIGHT / 2 - panelH / 2 + swatch / 2;

    this.colorBtns = [];

    uniqueColors.forEach((color, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const sx = startX + c * (swatch + gap);
      const sy = startY + r * (swatch + gap);

      const sw = this.add.rectangle(sx, sy, swatch, swatch, color, 1)
        .setStrokeStyle(3, color === this.currentColor ? 0x00ff88 : 0x555555)
        .setInteractive({ useHandCursor: true });
      
      sw.on('pointerdown', () => {
        this.currentColor = color;
        this.updateHighlights(uniqueColors);
      });
      
      this.colorBtns.push(sw);
    });
  }

  private updateHighlights(colors: number[]) {
    this.colorBtns.forEach((sw, i) => {
      sw.setStrokeStyle(3, colors[i] === this.currentColor ? 0x00ff88 : 0x555555);
    });
  }
  private drawTrailSettings() {
    // 将原有的调色板稍微上移一点让出空间
    const y2 = GAME_HEIGHT / 2 + 80;
    const y3 = GAME_HEIGHT / 2 + 130;

    // 持续时间
    this.add.text(GAME_WIDTH / 2 - 120, y2, '拖尾长度：', { fontFamily: FONT_IMPACT, fontSize: '20px', color: '#aaaaaa' }).setOrigin(1, 0.5);
    const lifeVal = this.add.text(GAME_WIDTH / 2 + 60, y2, `${this.skin.trailLifespan ?? 1200}`, { fontFamily: FONT_IMPACT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5, 0.5);
    
    const lifeMinus = this.add.text(GAME_WIDTH / 2 - 20, y2, '[-]', { fontFamily: FONT_IMPACT, fontSize: '24px', color: '#ff6666' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    lifeMinus.on('pointerdown', () => {
      let l = this.skin.trailLifespan ?? 1200;
      l = Math.max(100, l - 100);
      this.skin.trailLifespan = l;
      lifeVal.setText(`${l}`);
    });
    
    const lifePlus = this.add.text(GAME_WIDTH / 2 + 140, y2, '[+]', { fontFamily: FONT_IMPACT, fontSize: '24px', color: '#00ff88' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    lifePlus.on('pointerdown', () => {
      let l = this.skin.trailLifespan ?? 1200;
      l = Math.min(3000, l + 100);
      this.skin.trailLifespan = l;
      lifeVal.setText(`${l}`);
    });

    // 特效样式 - 现只有一种固定样式，仅做展示
    this.add.text(GAME_WIDTH / 2 - 120, y3, '拖尾样式：', { fontFamily: FONT_IMPACT, fontSize: '20px', color: '#aaaaaa' }).setOrigin(1, 0.5);
    
    this.add.text(GAME_WIDTH / 2 + 60, y3, `[ 冲击波 ]`, { 
      fontFamily: FONT_IMPACT, fontSize: '24px', color: '#33ddff' 
    }).setOrigin(0.5, 0.5);
  }


  private saveAndExit() {
    if (this.mode === 'bg') {
      this.skin.bgColor = this.currentColor;
    } else if (this.mode === 'trail') {
      this.skin.trailColor = this.currentColor;
    } else {
      this.skin.bulletColor = this.currentColor;
    }
    saveSkin(this.skin);
    
    if (this.toast) {
      this.toast.setAlpha(1);
      this.tweens.add({ targets: this.toast, alpha: 0, duration: 800, ease: 'Power2', delay: 400 });
    }
    this.time.delayedCall(600, () => this.backToSettings());
  }

  private backToSettings() {
    this.scene.stop('ColorPickerScene');
    this.scene.start('StartScene'); // ColorPicker返回时不自动拉起侧边栏比较稳妥，让它回到StartScene即可，或者可以利用Event在StartScene直接打开面板
  }

  private drawBackground() {
    const g = this.add.graphics().setDepth(0);
    g.lineStyle(1, 0x001122, 1);
    const step = 40;
    for (let x = 0; x <= GAME_WIDTH; x += step) g.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += step) g.lineBetween(0, y, GAME_WIDTH, y);
  }
}
