import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from '../constants';
import {
  loadKeyLayout, saveKeyLayout, KeyLayoutConfig,
  loadPCBindings, savePCBindings, PCKeyBindings,
  loadControlMode, saveControlMode, ControlMode, KEY_NAME_MAP
} from '../keyConfig';

type ControlKey = 'joystick' | 'z' | 'x' | 'c' | 'v' | 'w';

interface ControlObj {
  key: ControlKey;
  base?: Phaser.GameObjects.Arc;
  thumb?: Phaser.GameObjects.Arc;
  rect?: Phaser.GameObjects.Rectangle;
  text?: Phaser.GameObjects.Text;
  dragHandle: Phaser.GameObjects.Zone;
}

// PC 绑定界面：每个动作对应面板元素
interface PCBindingItem {
  action: keyof PCKeyBindings;
  label: string;
  keyText: Phaser.GameObjects.Text;
  btnBg: Phaser.GameObjects.Rectangle;
  hintText: Phaser.GameObjects.Text;
}

export class KeyConfigScene extends Phaser.Scene {
  private layout!: KeyLayoutConfig;
  private controls: ControlObj[] = [];
  private selectedKey: ControlKey | null = null;

  // PC 模式
  private pcBindings!: PCKeyBindings;
  private pcItems: PCBindingItem[] = [];
  private listeningAction: keyof PCKeyBindings | null = null;
  private listeningTarget: { keyText: Phaser.GameObjects.Text; btnBg: Phaser.GameObjects.Rectangle } | null = null;
  private modeText!: Phaser.GameObjects.Text;
  private mouseWasDown = false;
  private prevLeft = false;
  private prevRight = false;
  private prevMiddle = false;

  // 设置面板元素
  private panelGroup!: Phaser.GameObjects.Group;
  private sizeSlider!: Phaser.GameObjects.Arc;
  private sizeSliderMinX = 0;
  private sizeSliderMaxX = 0;
  private sizeValText!: Phaser.GameObjects.Text;
  private alphaSlider!: Phaser.GameObjects.Arc;
  private alphaSliderMinX = 0;
  private alphaSliderMaxX = 0;
  private alphaValText!: Phaser.GameObjects.Text;

  private dragStartX = 0;
  private dragStartY = 0;
  private didDrag = false;

  // 滑条拖动状态：同一时间只有一个滑条被拖动
  private activeSlider: 'size' | 'alpha' | null = null;

  constructor() {
    super('KeyConfigScene');
  }

  create(data?: any) {
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.cameras.main.setBackgroundColor(0x000000);

    const mode: ControlMode = (data && data.mode) || loadControlMode();

    if (mode === 'pc') {
      this.buildPCBindingUI();
    } else {
      this.layout = loadKeyLayout();
      this.drawBattlePreview();
      this.drawControls();
      this.createTopPanel();
      this.createBottomBar();
      this.setupGlobalSliderInput();
    }

    this.input.keyboard?.on('keydown-ESC', () => this.backToStart());
  }

  // ==================== PC 键盘绑定界面 ====================
  private buildPCBindingUI() {
    this.pcBindings = loadPCBindings();
    this.pcItems = [];
    this.listeningAction = null;

    const neonStr = '#00e5ff';
    const ft = '"Impact", "Arial Black", sans-serif'; // 标题字体
    const fm = 'monospace'; // 正文字体

    // 标题栏
    const title = this.add.text(GAME_WIDTH / 2, 22, '键 盘 绑 定', {
      fontFamily: ft, fontSize: '26px', color: neonStr, fontStyle: 'italic bold'
    }).setOrigin(0.5).setDepth(10);
    title.setShadow(0, 0, neonStr, 10, true, true);

    this.add.text(GAME_WIDTH / 2, 46, '点击按键框 → 按下键盘对应键 → 点保存并返回生效', {
      fontFamily: fm, fontSize: '12px', color: '#888888'
    }).setOrigin(0.5).setDepth(10);

    // 紧凑双列表格
    const actions: { action: keyof PCKeyBindings; label: string }[] = [
      { action: 'moveUp', label: '上移' },
      { action: 'moveDown', label: '下移' },
      { action: 'moveLeft', label: '左移' },
      { action: 'moveRight', label: '右移' },
      { action: 'attack', label: '普攻' },
      { action: 'ultimate', label: '大招' },
      { action: 'dash', label: '冲刺' },
      { action: 'parry', label: '弹反' },
      { action: 'pause', label: '暂停' },
    ];

    const tblY = 70;        // 表格起始 Y
    const rowH = 42;        // 行高
    const col1X = 140;      // 左列：动作名 X
    const key1X = 300;      // 左列：按键框 X
    const col2X = 560;      // 右列：动作名 X
    const key2X = 720;      // 右列：按键框 X
    const btnW = 130;
    const btnH = 36;

    actions.forEach((a, i) => {
      const isLeft = i < 5;
      const labelX = isLeft ? col1X : col2X;
      const kX = isLeft ? key1X : key2X;
      const row = isLeft ? i : i - 5;
      const by = tblY + row * rowH;

      const keyName = this.pcBindings[a.action];
      const displayKey = this.fmtKey(keyName);

      // 阴影
      this.add.rectangle(kX + 2, by + 2, btnW, btnH, 0x000000, 0.4).setDepth(9);

      // 按键框
      const btnBg = this.add.rectangle(kX, by, btnW, btnH, 0x0a0a14)
        .setStrokeStyle(2, 0x00e5ff, 0.7).setDepth(10)
        .setInteractive({ useHandCursor: true });

      // 动作标签
      this.add.text(labelX, by, a.label, {
        fontFamily: ft, fontSize: '18px', color: '#cccccc'
      }).setOrigin(0, 0.5).setDepth(11);

      // 分隔箭头
      this.add.text(kX - btnW / 2 - 14, by, '▸', {
        fontFamily: fm, fontSize: '14px', color: '#333333'
      }).setOrigin(0.5).setDepth(11);

      // 键位文字
      const keyText = this.add.text(kX, by, displayKey, {
        fontFamily: ft, fontSize: '20px', color: neonStr
      }).setOrigin(0.5).setDepth(11);
      keyText.setShadow(0, 0, neonStr, 3, true, true);

      // 绑定逻辑
      btnBg.on('pointerdown', () => {
        // 取消上一个
        if (this.listeningTarget) {
          this.listeningTarget.btnBg.setStrokeStyle(2, 0x00e5ff, 0.7);
          this.teardownListeners();
        }
        this.listeningAction = a.action;
        this.listeningTarget = { keyText, btnBg };
        btnBg.setStrokeStyle(3, 0xff9933, 1);
        this.mouseWasDown = true; // 跳过触发这次绑定的点击

        // 键盘监听
        const keyHandler = (event: KeyboardEvent) => {
          event.preventDefault();
          event.stopPropagation();
          let newKey = event.key.length === 1 ? event.key.toUpperCase() : event.key;
          if (event.code === 'Space') newKey = 'Space';
          if (event.code.startsWith('Shift')) newKey = 'Shift';
          if (event.code.startsWith('Control')) newKey = 'Ctrl';
          if (event.code === 'Escape') newKey = 'ESC';
          if (event.code === 'Tab') newKey = 'Tab';
          if (event.code.startsWith('Arrow')) newKey = event.code;
          this.applyBinding(a.action, newKey, keyText, btnBg);
        };
        this.input.keyboard?.on('keydown', keyHandler);
        (this as any)._keyHandler = keyHandler;
      });

      btnBg.on('pointerover', () => {
        if (this.listeningAction !== a.action) { btnBg.setFillStyle(0x001133); }
      });
      btnBg.on('pointerout', () => {
        if (this.listeningAction !== a.action) { btnBg.setFillStyle(0x0a0a14); }
      });

      this.pcItems.push({ action: a.action, label: a.label, keyText, btnBg, hintText: keyText });
    });

    // 底部栏 —— 紧凑排列
    const footY = GAME_HEIGHT - 50;

    // WASD 小键盘图示（水平排列，节省空间）
    const wasdCx = 200;
    const wasdY = footY + 5;
    const wasdKeys = [
      { k: 'W', x: wasdCx + 36, y: wasdY - 18 },
      { k: 'A', x: wasdCx, y: wasdY + 18 },
      { k: 'S', x: wasdCx + 36, y: wasdY + 18 },
      { k: 'D', x: wasdCx + 72, y: wasdY + 18 },
    ];
    wasdKeys.forEach(wk => {
      this.add.rectangle(wk.x, wk.y, 34, 34, 0x080812)
        .setStrokeStyle(1.5, 0x00e5ff, 0.35).setDepth(10);
      this.add.text(wk.x, wk.y, wk.k, {
        fontFamily: ft, fontSize: '16px', color: '#00e5ff'
      }).setOrigin(0.5).setDepth(11);
    });
    this.add.text(wasdCx + 36, wasdY + 38, 'WASD移动', {
      fontFamily: fm, fontSize: '10px', color: '#444444'
    }).setOrigin(0.5).setDepth(11);

    // 切换手机
    this.add.text(430, footY, '[ 切换到手机模式 ]', {
      fontFamily: ft, fontSize: '16px', color: '#888888'
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        saveControlMode('mobile');
        this.scene.restart({ mode: 'mobile' });
      });

    // 保存并返回
    const backBtn = this.add.text(700, footY, '[ 保存并返回 ]', {
      fontFamily: ft, fontSize: '24px', color: neonStr, fontStyle: 'italic bold'
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });
    backBtn.setShadow(0, 0, neonStr, 8, true, true);
    backBtn.on('pointerover', () => backBtn.setScale(1.08));
    backBtn.on('pointerout', () => backBtn.setScale(1));
    backBtn.on('pointerdown', () => {
      savePCBindings(this.pcBindings);
      this.scene.stop('KeyConfigScene');
      this.scene.bringToTop('StartScene');
    });
  }

  private applyBinding(
    action: keyof PCKeyBindings,
    newKey: string,
    keyText: Phaser.GameObjects.Text,
    btnBg: Phaser.GameObjects.Rectangle,
  ) {
    this.pcBindings[action] = newKey;
    savePCBindings(this.pcBindings);
    keyText.setText(this.fmtKey(newKey));
    btnBg.setStrokeStyle(2, 0x00ff88, 0.9);
    this.listeningAction = null;
    this.listeningTarget = null;
    this.teardownListeners();
    this.time.delayedCall(600, () => btnBg.setStrokeStyle(2, 0x00e5ff, 0.7));
  }

  // 在 update 里轮询鼠标"释放"边沿（可靠的单次触发）
  update() {
    if (!this.listeningTarget || !this.listeningAction) {
      this.prevLeft = this.prevRight = this.prevMiddle = false;
      return;
    }

    const ptr = this.input.activePointer;
    const curLeft = ptr.leftButtonDown();
    const curRight = ptr.rightButtonDown();
    const curMiddle = ptr.middleButtonDown();

    // 检测 按下→释放 的边沿（松开瞬间触发一次）
    let mouseKey = '';
    if (this.prevLeft && !curLeft) mouseKey = 'MouseLeft';
    else if (this.prevRight && !curRight) mouseKey = 'MouseRight';
    else if (this.prevMiddle && !curMiddle) mouseKey = 'MouseMiddle';

    this.prevLeft = curLeft;
    this.prevRight = curRight;
    this.prevMiddle = curMiddle;

    if (mouseKey && this.listeningTarget) {
      this.applyBinding(
        this.listeningAction!,
        mouseKey,
        this.listeningTarget.keyText,
        this.listeningTarget.btnBg,
      );
      this.prevLeft = this.prevRight = this.prevMiddle = false;
    }
  }

  private teardownListeners() {
    const kh = (this as any)._keyHandler;
    if (kh) this.input.keyboard?.off('keydown', kh);
    (this as any)._keyHandler = null;
    this.listeningAction = null;
    this.listeningTarget = null;
  }

  private fmtKey(keyName: string): string {
    if (keyName === 'Space') return '空格';
    if (keyName === 'Shift') return 'Shift';
    if (keyName === 'Ctrl') return 'Ctrl';
    if (keyName === 'ESC') return 'Esc';
    if (keyName === 'Tab') return 'Tab';
    if (keyName === 'MouseLeft') return '鼠标左';
    if (keyName === 'MouseRight') return '鼠标右';
    if (keyName === 'MouseMiddle') return '鼠标中';
    if (keyName.startsWith('Arrow')) {
      const m: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
      return m[keyName] || keyName;
    }
    return keyName;
  }

  private drawKeyboardVisual(cx: number, y: number) {
    // ponytail: unused, kept for reference
  }

  // ===== 战斗场景预览 =====
  private drawBattlePreview() {
    // 网格
    const g = this.add.graphics().setDepth(0);
    g.lineStyle(1, 0x001122, 1);
    const step = 40;
    for (let x = 0; x <= GAME_WIDTH; x += step) g.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += step) g.lineBetween(0, y, GAME_WIDTH, y);

    // 玩家三角
    const px = GAME_WIDTH * 0.32, py = GAME_HEIGHT * 0.5;
    const pg = this.add.graphics().setDepth(1);
    pg.fillStyle(COLORS.player, 1);
    pg.beginPath();
    pg.moveTo(px, py - 16);
    pg.lineTo(px + 22, py);
    pg.lineTo(px, py + 16);
    pg.closePath();
    pg.fillPath();
    pg.lineStyle(2, COLORS.white, 1);
    pg.strokePath();

    // 敌人菱形
    const ex = GAME_WIDTH * 0.68, ey = GAME_HEIGHT * 0.5;
    const eg = this.add.graphics().setDepth(1);
    eg.fillStyle(COLORS.enemy, 1);
    eg.beginPath();
    eg.moveTo(ex, ey - 20);
    eg.lineTo(ex + 20, ey);
    eg.lineTo(ex, ey + 20);
    eg.lineTo(ex - 20, ey);
    eg.closePath();
    eg.fillPath();
    eg.lineStyle(2, COLORS.white, 1);
    eg.strokePath();

    // 说明文字
    const tip = this.add.text(GAME_WIDTH / 2, 24, '键位设置：拖动按键调整位置，点击按键调整大小/透明度', {
      fontFamily: 'monospace', fontSize: '16px', color: '#00e5ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2);
    tip.setShadow(0, 0, '#00e5ff', 6, true, true);
  }

  // ===== 可拖拽控制按键 =====
  private drawControls() {
    this.drawJoystickControl();
    this.drawRectControl('z', 'Z');
    this.drawRectControl('x', 'X');
    this.drawRectControl('c', 'C');
    this.drawRectControl('v', 'V');
    this.drawButtonControl('w', '武器轮盘');
  }

  private drawJoystickControl() {
    const cfg = this.layout.joystick;
    const base = this.add.circle(cfg.x, cfg.y, cfg.size / 2, 0x000000, cfg.alpha).setDepth(10);
    base.setStrokeStyle(3, 0x00e5ff, 0.8);
    const thumb = this.add.circle(cfg.x, cfg.y, cfg.size / 6, 0x00e5ff, Math.min(cfg.alpha + 0.2, 1)).setDepth(11);

    // 透明拖拽区
    const dragHandle = this.add.zone(cfg.x, cfg.y, Math.max(cfg.size, 80), Math.max(cfg.size, 80))
      .setInteractive({ draggable: true }).setDepth(12);

    this.setupDrag(dragHandle, 'joystick', base, thumb);
    this.controls.push({ key: 'joystick', base, thumb, dragHandle });
  }

  private drawRectControl(key: ControlKey, label: string) {
    const cfg = this.layout[key];
    const rect = this.add.rectangle(cfg.x, cfg.y, cfg.size, cfg.size, COLORS.bg, cfg.alpha)
      .setDepth(10).setStrokeStyle(3, 0x00e5ff, 0.8);
    const textLabel = key === 'v' ? '近战\n/弹反' : label;
    const text = this.add.text(cfg.x, cfg.y, textLabel, {
      fontFamily: 'monospace', fontSize: `${Math.max(12, cfg.size / (key === 'v' ? 3.5 : 2))}px`, color: '#000000', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5).setDepth(11);

    const dragHandle = this.add.zone(cfg.x, cfg.y, Math.max(cfg.size, 60), Math.max(cfg.size, 60))
      .setInteractive({ draggable: true }).setDepth(12);

    this.setupDrag(dragHandle, key, rect, undefined, text);
    this.controls.push({ key, rect, text, dragHandle });
  }

  private drawButtonControl(key: ControlKey, label: string) {
    const cfg = this.layout[key];
    const base = this.add.circle(cfg.x, cfg.y, cfg.size / 2, 0x333333, cfg.alpha)
      .setDepth(10).setStrokeStyle(3, 0x00e5ff, 0.8);
    const text = this.add.text(cfg.x, cfg.y + cfg.size / 2 + 14, label, {
      fontFamily: 'monospace', fontSize: '11px', color: '#00e5ff', align: 'center'
    }).setOrigin(0.5).setDepth(11);

    const dragHandle = this.add.zone(cfg.x, cfg.y, Math.max(cfg.size, 60), Math.max(cfg.size + 30, 80))
      .setInteractive({ draggable: true }).setDepth(12);

    this.setupDrag(dragHandle, key, base, undefined, text);
    this.controls.push({ key, base, text, dragHandle });
  }

  private setupDrag(
    handle: Phaser.GameObjects.Zone,
    key: ControlKey,
    rectOrBase: Phaser.GameObjects.Shape,
    thumb?: Phaser.GameObjects.Shape,
    text?: Phaser.GameObjects.Text
  ) {
    handle.on('dragstart', () => {
      this.dragStartX = handle.x;
      this.dragStartY = handle.y;
      this.didDrag = false;
    });
    handle.on('drag', (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      this.didDrag = true;
      const halfW = (handle.input?.hitArea?.width ?? 60) / 2;
      const halfH = (handle.input?.hitArea?.height ?? 60) / 2;
      const nx = Phaser.Math.Clamp(dragX, halfW, GAME_WIDTH - halfW);
      const ny = Phaser.Math.Clamp(dragY, halfH, GAME_HEIGHT - halfH);
      handle.x = nx; handle.y = ny;
      rectOrBase.x = nx; rectOrBase.y = ny;
      if (thumb) { thumb.x = nx; thumb.y = ny; }
      if (text) { text.x = nx; text.y = ny; }
      this.layout[key].x = nx;
      this.layout[key].y = ny;
    });
    handle.on('dragend', () => {
      // 如果几乎没有拖动，视为点击 -> 打开设置面板
      const moved = Phaser.Math.Distance.Between(this.dragStartX, this.dragStartY, handle.x, handle.y);
      if (moved < 6) {
        this.openPanel(key);
      }
    });
  }

  // ===== 顶部居中设置面板 =====
  private createTopPanel() {
    this.panelGroup = this.add.group();

    const neonBlueStr = '#00e5ff';
    const fontFam = '"Impact", "Arial Black", sans-serif';

    // 面板背景框
    const panelW = 460, panelH = 160;
    const px = GAME_WIDTH / 2, py = panelH / 2 + 10;
    const bg = this.add.rectangle(px, py, panelW, panelH, 0x000000, 0.85).setDepth(40).setStrokeStyle(2, 0x00e5ff, 1);
    if ((bg as any).postFX) (bg as any).postFX.addGlow(0x00e5ff, 2, 0, false, 0.1, 8);

    const title = this.add.text(px, py - 65, '按键设置', {
      fontFamily: fontFam, fontSize: '22px', color: neonBlueStr, fontStyle: 'italic bold'
    }).setOrigin(0.5).setDepth(41);
    title.setShadow(0, 0, neonBlueStr, 8, true, true);

    // 大小滑条
    const labelSize = this.add.text(px - 210, py - 25, '大小', {
      fontFamily: 'monospace', fontSize: '16px', color: neonBlueStr
    }).setOrigin(0, 0.5).setDepth(41);
    const trackSize = this.add.rectangle(px + 10, py - 25, 280, 6, 0x003344).setDepth(41);
    this.sizeSliderMinX = px + 10 - 140;
    this.sizeSliderMaxX = px + 10 + 140;
    this.sizeSlider = this.add.circle(this.sizeSliderMinX, py - 25, 12, 0x00e5ff).setDepth(42);
    this.sizeValText = this.add.text(px + 175, py - 25, '60', {
      fontFamily: 'monospace', fontSize: '16px', color: neonBlueStr
    }).setOrigin(0, 0.5).setDepth(41);

    // 大小滑条交互区（大命中区，覆盖轨道+旋钮）
    const sizeHitZone = this.add.zone(px + 10, py - 25, 300, 36).setInteractive({ useHandCursor: true }).setDepth(43);
    this.setupSliderDrag(sizeHitZone, this.sizeSlider, this.sizeSliderMinX, this.sizeSliderMaxX, 'size', () => {});

    // 透明度滑条
    const labelAlpha = this.add.text(px - 210, py + 15, '透明度', {
      fontFamily: 'monospace', fontSize: '16px', color: neonBlueStr
    }).setOrigin(0, 0.5).setDepth(41);
    const trackAlpha = this.add.rectangle(px + 10, py + 15, 280, 6, 0x003344).setDepth(41);
    this.alphaSliderMinX = px + 10 - 140;
    this.alphaSliderMaxX = px + 10 + 140;
    this.alphaSlider = this.add.circle(this.alphaSliderMinX, py + 15, 12, 0x00e5ff).setDepth(42);
    this.alphaValText = this.add.text(px + 175, py + 15, '1.0', {
      fontFamily: 'monospace', fontSize: '16px', color: neonBlueStr
    }).setOrigin(0, 0.5).setDepth(41);

    // 透明度滑条交互区
    const alphaHitZone = this.add.zone(px + 10, py + 15, 300, 36).setInteractive({ useHandCursor: true }).setDepth(43);
    this.setupSliderDrag(alphaHitZone, this.alphaSlider, this.alphaSliderMinX, this.alphaSliderMaxX, 'alpha', () => {});

    // 保存按钮
    const saveBtn = this.add.text(px, py + 55, '[ 保存 ]', {
      fontFamily: fontFam, fontSize: '22px', color: neonBlueStr, fontStyle: 'italic bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(41);
    saveBtn.setShadow(0, 0, neonBlueStr, 8, true, true);
    saveBtn.on('pointerover', () => saveBtn.setScale(1.1));
    saveBtn.on('pointerout', () => saveBtn.setScale(1));
    saveBtn.on('pointerdown', () => {
      saveKeyLayout(this.layout);
      this.closePanel();
    });

    this.panelGroup.addMultiple([bg, title, labelSize, trackSize, this.sizeSlider, this.sizeValText, sizeHitZone,
      labelAlpha, trackAlpha, this.alphaSlider, this.alphaValText, alphaHitZone, saveBtn]);

    this.panelGroup.setVisible(false);
  }

  // 通用滑条拖拽：点击命中区任意位置即可跳转，按住拖动实时跟随
  private setupSliderDrag(
    zone: Phaser.GameObjects.Zone,
    knob: Phaser.GameObjects.Arc,
    minX: number, maxX: number,
    which: 'size' | 'alpha',
    onChange: (t: number) => void
  ) {
    const updateFromPointer = (pointerX: number) => {
      const nx = Phaser.Math.Clamp(pointerX, minX, maxX);
      knob.x = nx;
      const t = (nx - minX) / (maxX - minX);
      onChange(t);
    };
    // 点击命中区：立即跳转并开始拖动
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.activeSlider = which;
      updateFromPointer(pointer.x);
    });
  }

  // 全局拖动处理：在 create 中注册一次，避免重复注册
  private setupGlobalSliderInput() {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.activeSlider || !pointer.isDown) return;
      if (this.activeSlider === 'size') {
        const nx = Phaser.Math.Clamp(pointer.x, this.sizeSliderMinX, this.sizeSliderMaxX);
        this.sizeSlider.x = nx;
        const t = (nx - this.sizeSliderMinX) / (this.sizeSliderMaxX - this.sizeSliderMinX);
        const size = Math.round(40 + t * 120);
        this.sizeValText.setText(String(size));
        if (this.selectedKey) this.applySize(this.selectedKey, size);
      } else if (this.activeSlider === 'alpha') {
        const nx = Phaser.Math.Clamp(pointer.x, this.alphaSliderMinX, this.alphaSliderMaxX);
        this.alphaSlider.x = nx;
        const t = (nx - this.alphaSliderMinX) / (this.alphaSliderMaxX - this.alphaSliderMinX);
        const alpha = Math.round(t * 100) / 100;
        this.alphaValText.setText(alpha.toFixed(1));
        if (this.selectedKey) this.applyAlpha(this.selectedKey, alpha);
      }
    });
    this.input.on('pointerup', () => {
      this.activeSlider = null;
    });
  }

  private openPanel(key: ControlKey) {
    this.selectedKey = key;
    const cfg = this.layout[key];
    // 同步滑条位置
    const sizeT = Phaser.Math.Clamp((cfg.size - 40) / 120, 0, 1);
    this.sizeSlider.x = this.sizeSliderMinX + sizeT * (this.sizeSliderMaxX - this.sizeSliderMinX);
    const alphaT = Phaser.Math.Clamp(cfg.alpha, 0, 1);
    this.alphaSlider.x = this.alphaSliderMinX + alphaT * (this.alphaSliderMaxX - this.alphaSliderMinX);
    this.panelGroup.setVisible(true);
  }

  private closePanel() {
    this.selectedKey = null;
    this.panelGroup.setVisible(false);
  }

  private applySize(key: ControlKey, size: number) {
    this.layout[key].size = size;
    const ctrl = this.controls.find((c) => c.key === key);
    if (!ctrl) return;
    if (ctrl.base && ctrl.thumb) {
      ctrl.base.setRadius(size / 2);
      ctrl.thumb.setRadius(size / 6);
      ctrl.dragHandle.setSize(Math.max(size, 80), Math.max(size, 80));
    } else if (ctrl.base) {
      ctrl.base.setRadius(size / 2);
      ctrl.dragHandle.setSize(Math.max(size, 60), Math.max(size + 30, 80));
    } else if (ctrl.rect && ctrl.text) {
      ctrl.rect.setSize(size, size);
      ctrl.text.setFontSize(`${Math.max(16, size / 2)}px`);
      ctrl.dragHandle.setSize(Math.max(size, 60), Math.max(size, 60));
    }
  }

  private applyAlpha(key: ControlKey, alpha: number) {
    this.layout[key].alpha = alpha;
    const ctrl = this.controls.find((c) => c.key === key);
    if (!ctrl) return;
    if (ctrl.base) ctrl.base.setAlpha(alpha);
    if (ctrl.thumb) ctrl.thumb.setAlpha(Math.min(alpha + 0.2, 1));
    if (ctrl.rect) ctrl.rect.setAlpha(alpha);
  }

  // ===== 底部返回按钮 =====
  private createBottomBar() {
    const neonBlueStr = '#00e5ff';
    const fontFam = '"Impact", "Arial Black", sans-serif';

    // 切换到 PC 模式按钮
    const pcModeBtn = this.add.text(GAME_WIDTH / 2 - 150, GAME_HEIGHT - 28, '[ 切换到电脑模式 ]', {
      fontFamily: fontFam, fontSize: '18px', color: '#888888', fontStyle: 'italic'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(50);
    pcModeBtn.on('pointerover', () => pcModeBtn.setScale(1.05));
    pcModeBtn.on('pointerout', () => pcModeBtn.setScale(1));
    pcModeBtn.on('pointerdown', () => {
      saveKeyLayout(this.layout);
      saveControlMode('pc');
      this.scene.restart({ mode: 'pc' });
    });

    const backBtn = this.add.text(GAME_WIDTH / 2 + 100, GAME_HEIGHT - 28, '[ 返回主菜单 ]', {
      fontFamily: fontFam, fontSize: '24px', color: neonBlueStr, fontStyle: 'italic bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(50);
    backBtn.setShadow(0, 0, neonBlueStr, 10, true, true);
    backBtn.on('pointerover', () => backBtn.setScale(1.1));
    backBtn.on('pointerout', () => backBtn.setScale(1));
    backBtn.on('pointerdown', () => this.backToStart());
  }

  private backToStart() {
    // 返回前保存
    if (this.layout) saveKeyLayout(this.layout);
    this.scene.stop('KeyConfigScene');
    this.scene.bringToTop('StartScene');
  }
}
