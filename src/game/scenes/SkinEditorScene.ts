import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { uiClick } from '../sfx';
import { SKIN_GRID, SKIN_PALETTE, SKIN_TRANSPARENT, loadSkin, saveSkin, SkinData } from '../skinConfig';

const NEON_BLUE = 0x00e5ff;
const NEON_BLUE_STR = '#00e5ff';
const FONT_IMPACT = '"Impact", "Arial Black", sans-serif';
const FONT_MONO = 'monospace';

export class SkinEditorScene extends Phaser.Scene {
  private skin!: SkinData;
  // 像素格子显示对象（Rectangle 数组）
  private cells: Phaser.GameObjects.Rectangle[] = [];
  // 画板左上角
  private boardX = 0;
  private boardY = 0;
  // 每格像素大小
  private cellPx = 0;
  // 当前选中颜色索引（1-based，0=透明橡皮擦）
  private currentColor = 1;
  // 颜色按钮
  private colorBtns: Phaser.GameObjects.Rectangle[] = [];

  private isDrawing = false;
  private drawColor = 1;

  constructor() {
    super('SkinEditorScene');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);
    this.skin = loadSkin();

    this.drawBackground();
    this.drawBoard();
    this.drawPalette();
    this.drawTopBar();
    this.drawBottomBar();

    // 全局绘制：按住拖动即可涂色
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.handleDraw(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.handleDraw(p);
    });

    // 按钮点击音（画笔涂色区 useHandCursor=false，不会误响）
    this.input.on('gameobjectdown', (obj: Phaser.GameObjects.GameObject) => {
      if ((obj as { input?: { useHandCursor?: boolean } }).input?.useHandCursor) uiClick(this);
    });

    this.input.keyboard?.on('keydown-ESC', () => this.backToStart());
  }

  private drawBackground() {
    const g = this.add.graphics().setDepth(0);
    g.lineStyle(1, 0x001122, 1);
    const step = 40;
    for (let x = 0; x <= GAME_WIDTH; x += step) g.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += step) g.lineBetween(0, y, GAME_WIDTH, y);
  }

  // ===== 方形画板 =====
  private drawBoard() {
    // 画板大小：屏幕高度的 70%，居中偏左
    const boardSize = Math.min(GAME_HEIGHT * 0.72, GAME_WIDTH * 0.5);
    this.cellPx = Math.floor(boardSize / SKIN_GRID);
    const actualSize = this.cellPx * SKIN_GRID;
    this.boardX = Math.floor((GAME_WIDTH * 0.38) - actualSize / 2);
    this.boardY = Math.floor((GAME_HEIGHT - actualSize) / 2);

    // 棋盘格背景（方便看透明区域）
    const bg = this.add.graphics().setDepth(1);
    for (let r = 0; r < SKIN_GRID; r++) {
      for (let c = 0; c < SKIN_GRID; c++) {
        const cx = this.boardX + c * this.cellPx;
        const cy = this.boardY + r * this.cellPx;
        bg.fillStyle((r + c) % 2 === 0 ? 0x222222 : 0x2a2a2a, 1);
        bg.fillRect(cx, cy, this.cellPx, this.cellPx);
      }
    }

    // 蓝色发光边框
    const frame = this.add.graphics().setDepth(2);
    frame.lineStyle(3, NEON_BLUE, 1);
    frame.strokeRect(this.boardX - 2, this.boardY - 2, actualSize + 4, actualSize + 4);
    if ((frame as any).postFX) (frame as any).postFX.addGlow(NEON_BLUE, 2, 0, false, 0.1, 8);

    // 像素格子（Rectangle 数组），按 skin 数据着色
    const N = SKIN_GRID;
    this.cells = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        const colorIdx = this.skin.grid[idx];
        const cell = this.add.rectangle(
          this.boardX + c * this.cellPx + this.cellPx / 2,
          this.boardY + r * this.cellPx + this.cellPx / 2,
          this.cellPx - 1, this.cellPx - 1,
          this.colorIdxToHex(colorIdx), colorIdx === SKIN_TRANSPARENT ? 0 : 1
        ).setDepth(3);
        this.cells.push(cell);
      }
    }

    // 画板交互区（覆盖整个画板，用于绘制）
    const drawZone = this.add.zone(
      this.boardX + actualSize / 2, this.boardY + actualSize / 2,
      actualSize, actualSize
    ).setInteractive().setDepth(10);
    drawZone.on('pointerdown', (p: Phaser.Input.Pointer) => this.paintAt(p));
    drawZone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.paintAt(p);
    });
  }

  // ===== 调色板 =====
  private drawPalette() {
    const pal = SKIN_PALETTE;
    const swatch = 30;
    const gap = 8;
    const cols = 4;
    const rows = Math.ceil(pal.length / cols);
    const panelW = cols * swatch + (cols - 1) * gap + 20;
    const panelH = rows * swatch + (rows - 1) * gap + 20;
    const px = GAME_WIDTH - panelW - 30;
    const py = 100;

    const title = this.add.text(px + panelW / 2, py - 20, '调 色 板', {
      fontFamily: FONT_IMPACT, fontSize: '20px', color: NEON_BLUE_STR, fontStyle: 'italic bold'
    }).setOrigin(0.5).setDepth(5);
    title.setShadow(0, 0, NEON_BLUE_STR, 8, true, true);

    this.colorBtns = [];
    for (let i = 0; i < pal.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const sx = px + 10 + c * (swatch + gap);
      const sy = py + 10 + r * (swatch + gap);
      const sw = this.add.rectangle(sx + swatch / 2, sy + swatch / 2, swatch, swatch, pal[i], 1)
        .setStrokeStyle(2, i + 1 === this.currentColor ? 0x00ff88 : 0x555555).setDepth(5)
        .setInteractive({ useHandCursor: true });
      sw.on('pointerdown', () => {
        this.currentColor = i + 1;
        this.updateColorBtnHighlights();
      });
      this.colorBtns.push(sw);
    }

    // 橡皮擦
    const eraserY = py + 10 + rows * (swatch + gap) + 8;
    const eraser = this.add.text(px + panelW / 2, eraserY, '[ 橡皮擦 ]', {
      fontFamily: FONT_IMPACT, fontSize: '18px', color: '#ff6666', fontStyle: 'italic bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(5);
    eraser.setShadow(0, 0, '#ff6666', 6, true, true);
    eraser.on('pointerdown', () => {
      this.currentColor = SKIN_TRANSPARENT;
      this.updateColorBtnHighlights();
      eraser.setScale(1.1);
      this.time.delayedCall(120, () => eraser.setScale(1));
    });
  }

  private updateColorBtnHighlights() {
    this.colorBtns.forEach((sw, i) => {
      sw.setStrokeStyle(2, i + 1 === this.currentColor ? 0x00ff88 : 0x555555);
    });
  }

  // ===== 顶部栏：标题 + 右上角保存按钮 =====
  private drawTopBar() {
    const title = this.add.text(GAME_WIDTH / 2 - 80, 30, '皮 肤 编 辑', {
      fontFamily: FONT_IMPACT, fontSize: '28px', color: NEON_BLUE_STR, fontStyle: 'italic bold'
    }).setOrigin(0.5).setDepth(20);
    title.setShadow(0, 0, NEON_BLUE_STR, 10, true, true);

    const tip = this.add.text(GAME_WIDTH / 2 - 80, 58, '点击/拖动涂色  ·  保存后在游戏中生效', {
      fontFamily: FONT_MONO, fontSize: '13px', color: '#888888'
    }).setOrigin(0.5).setDepth(20);

    // 右上角保存按钮
    const saveBtn = this.add.text(GAME_WIDTH - 30, 35, '[ 保存 ]', {
      fontFamily: FONT_IMPACT, fontSize: '24px', color: '#00ff88', fontStyle: 'italic bold'
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setDepth(20);
    saveBtn.setShadow(0, 0, '#00ff88', 10, true, true);
    saveBtn.on('pointerover', () => { saveBtn.setScale(1.1); saveBtn.setShadow(0, 0, '#00ff88', 20, true, true); });
    saveBtn.on('pointerout', () => { saveBtn.setScale(1); saveBtn.setShadow(0, 0, '#00ff88', 10, true, true); });
    saveBtn.on('pointerdown', () => this.saveAndExit());

    // 保存提示文字（初始隐藏）
    this.toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '保存成功！', {
      fontFamily: FONT_IMPACT, fontSize: '32px', color: '#00ff88', fontStyle: 'italic bold'
    }).setOrigin(0.5).setDepth(50).setAlpha(0);
    this.toast.setShadow(0, 0, '#00ff88', 16, true, true);
  }

  private toast!: Phaser.GameObjects.Text;

  // ===== 底部栏：清空、恢复默认、返回 =====
  private drawBottomBar() {
    const y = GAME_HEIGHT - 28;
    const makeBtn = (x: number, label: string, color: string, onClick: () => void) => {
      const btn = this.add.text(x, y, label, {
        fontFamily: FONT_IMPACT, fontSize: '20px', color, fontStyle: 'italic bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(20);
      btn.setShadow(0, 0, color, 8, true, true);
      btn.on('pointerover', () => btn.setScale(1.1));
      btn.on('pointerout', () => btn.setScale(1));
      btn.on('pointerdown', onClick);
      return btn;
    };
    makeBtn(GAME_WIDTH * 0.3, '[ 清空 ]', '#ff6666', () => this.clearBoard());
    makeBtn(GAME_WIDTH * 0.5, '[ 恢复默认 ]', NEON_BLUE_STR, () => this.resetDefault());
    makeBtn(GAME_WIDTH * 0.7, '[ 返回 ]', NEON_BLUE_STR, () => this.backToStart());
  }

  // ===== 绘制逻辑 =====
  private handleDraw(p: Phaser.Input.Pointer) {
    // 仅在画板区域内绘制
    const N = SKIN_GRID;
    const actualSize = this.cellPx * N;
    const lx = p.x - this.boardX;
    const ly = p.y - this.boardY;
    if (lx < 0 || ly < 0 || lx >= actualSize || ly >= actualSize) return;
    const c = Math.floor(lx / this.cellPx);
    const r = Math.floor(ly / this.cellPx);
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    const idx = r * N + c;
    if (this.skin.grid[idx] === this.currentColor) return;
    this.skin.grid[idx] = this.currentColor;
    this.cells[idx].setFillStyle(this.colorIdxToHex(this.currentColor));
    this.cells[idx].setAlpha(this.currentColor === SKIN_TRANSPARENT ? 0 : 1);
  }

  private paintAt(p: Phaser.Input.Pointer) {
    this.handleDraw(p);
  }

  private colorIdxToHex(idx: number): number {
    if (idx === SKIN_TRANSPARENT) return 0x000000;
    return SKIN_PALETTE[idx - 1] ?? 0x000000;
  }

  private clearBoard() {
    this.skin.grid.fill(SKIN_TRANSPARENT);
    this.refreshAllCells();
  }

  private resetDefault() {
    import('../skinConfig').then(({ defaultSkin }) => {
      const def = defaultSkin();
      this.skin.grid = [...def.grid];
      this.skin.bgColor = def.bgColor;
      this.skin.trailColor = def.trailColor;
      this.refreshAllCells();
      // 这里可以考虑发出一个事件或调用重新渲染全局颜色的方法
      // 但因为界面上只绘制了一次全局颜色，我们可以选择直接刷新场景或者重新绘制背景按钮
      this.scene.restart(); 
    });
  }

  private refreshAllCells() {
    const N = SKIN_GRID;
    for (let i = 0; i < N * N; i++) {
      const c = this.skin.grid[i];
      this.cells[i].setFillStyle(this.colorIdxToHex(c));
      this.cells[i].setAlpha(c === SKIN_TRANSPARENT ? 0 : 1);
    }
  }

  private saveAndExit() {
    saveSkin(this.skin);
    // 显示保存成功提示
    if (this.toast) {
      this.toast.setText('保存成功！');
      this.toast.setAlpha(1);
      this.tweens.add({ targets: this.toast, alpha: 0, duration: 1200, ease: 'Power2', delay: 600 });
    }
    // 延迟返回，让用户看到提示
    this.time.delayedCall(800, () => this.backToStart());
  }

  private showMiniToast(msg: string) {
    if (this.toast) {
      this.toast.setText(msg);
      this.toast.setAlpha(1);
      this.tweens.add({ targets: this.toast, alpha: 0, duration: 800, ease: 'Power2', delay: 400 });
    }
  }

  private backToStart() {
    this.scene.stop('SkinEditorScene');
    this.scene.start('StartScene');
  }
}
