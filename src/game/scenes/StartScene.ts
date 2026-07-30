import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { loadSkin, regeneratePlayerSkinTexture } from '../skinConfig';
import { loadControlMode, saveControlMode } from '../keyConfig';

const NEON_BLUE = 0x00e5ff;
const NEON_BLUE_STR = '#00e5ff';
const FONT_IMPACT = '"Impact", "Arial Black", sans-serif';
const FONT_MONO = 'monospace';

type PanelType = 'custom' | 'modifier' | 'difficulty' | 'tutorial' | 'graphics' | 'gamemode';

export class StartScene extends Phaser.Scene {
  private difficulties = [
    { name: '新手', val: 'novice', hpMult: 0.4, speedMult: 0.6, fireRateMult: 1.5, enableEnemySkills: false, desc: '敌人血量×0.4 速度×0.6 射速×1.5' },
    { name: '弱化', val: 'easy', hpMult: 0.7, speedMult: 0.8, fireRateMult: 1.2, enableEnemySkills: false, desc: '敌人血量×0.7 速度×0.8 射速×1.2' },
    { name: '标准', val: 'normal', hpMult: 1.0, speedMult: 1.0, fireRateMult: 1.0, enableEnemySkills: false, desc: '敌人血量×1.0 速度×1.0 射速×1.0\n仅基础战斗' },
    { name: '困难', val: 'hard', hpMult: 1.5, speedMult: 1.2, fireRateMult: 0.8, enableEnemySkills: true, desc: '敌人血量×1.5 速度×1.2 射速×0.8\n敌人将使用闪避与弹反技能' },
    { name: '挑战', val: 'challenge', hpMult: 2.5, speedMult: 1.5, fireRateMult: 0.6, enableEnemySkills: true, desc: '敌人血量×2.5 速度×1.5 射速×0.6\n敌人将使用闪避与弹反技能' },
  ];
  private currentDiffIndex = 2; // 默认标准
  private diffText!: Phaser.GameObjects.Text;

  // 统一滑出面板系统
  private panelGroup!: Phaser.GameObjects.Group;
  private panelContentGroup!: Phaser.GameObjects.Group; // 动态内容，随面板类型重建
  private panelOpen = false;
  private panelOffscreen = true; // 面板框当前是否在屏幕外（避免偏移累积）
  private panelTitle!: Phaser.GameObjects.Text;
  private currentPanel: PanelType | null = null;
  // 修改器开关状态
  private modifierStates: Record<string, boolean> = { 连发: false, 自瞄: false, 无限弹反: false, 无限完美弹反: false };
  // 游戏模式
  private gameMode: 'standard' | 'endless' | 'test' = 'standard';
  private modeText!: Phaser.GameObjects.Text;

  constructor() {
    super('StartScene');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);
    this.drawGrid();

    // 收集所有UI元素以便做入场动画
    const uiElements: Phaser.GameObjects.GameObject[] = [];

    // 绘制左右梯形双线框（增强立体感：外层粗线 + 内层细线）
    const gFrames = this.add.graphics();
    // 外层阴影线（深色粗线，3D 阴影）
    gFrames.lineStyle(4, 0x001122, 0.8);
    gFrames.strokePoints([
      { x: 33, y: 33 }, { x: 303, y: 33 }, { x: 383, y: 513 }, { x: 33, y: 513 }
    ], true);
    gFrames.strokePoints([
      { x: 933, y: 33 }, { x: 663, y: 33 }, { x: 583, y: 513 }, { x: 933, y: 513 }
    ], true);
    // 主线条
    gFrames.lineStyle(2, NEON_BLUE, 1);
    gFrames.strokePoints([
      { x: 30, y: 30 }, { x: 300, y: 30 }, { x: 380, y: 510 }, { x: 30, y: 510 }
    ], true);
    gFrames.strokePoints([
      { x: 40, y: 40 }, { x: 290, y: 40 }, { x: 365, y: 500 }, { x: 40, y: 500 }
    ], true);
    gFrames.strokePoints([
      { x: 930, y: 30 }, { x: 660, y: 30 }, { x: 580, y: 510 }, { x: 930, y: 510 }
    ], true);
    gFrames.strokePoints([
      { x: 920, y: 40 }, { x: 670, y: 40 }, { x: 595, y: 500 }, { x: 920, y: 500 }
    ], true);
    if (gFrames.postFX) {
      gFrames.postFX.addGlow(NEON_BLUE, 2, 0, false, 0.1, 15);
    }
    gFrames.setAlpha(0);
    uiElements.push(gFrames);

    // 底部科技风装饰线（明日方舟风格）
    const techLine = this.add.graphics();
    techLine.lineStyle(1, NEON_BLUE, 0.3);
    for (let i = 0; i < 8; i++) {
      const lx = 40 + i * 40;
      techLine.lineBetween(lx, 515, lx + 20, 515);
    }
    for (let i = 0; i < 8; i++) {
      const rx = GAME_WIDTH - 40 - i * 40;
      techLine.lineBetween(rx, 515, rx - 20, 515);
    }
    techLine.setAlpha(0);
    uiElements.push(techLine);

    // 左侧大标题
    const titleText = this.add.text(205, 270, '几 何\n决 斗\nPLUS', {
      fontFamily: FONT_IMPACT, fontSize: '72px', color: NEON_BLUE_STR, fontStyle: 'italic bold',
      align: 'center', lineSpacing: 10
    }).setOrigin(0.5).setAlpha(0);
    titleText.setShadow(0, 0, NEON_BLUE_STR, 15, true, true);
    uiElements.push(titleText);

    const subTitle = this.add.text(205, 80, '创意来源: 几何决斗', {
      fontFamily: FONT_IMPACT, fontSize: '18px', color: NEON_BLUE_STR, fontStyle: 'italic bold'
    }).setOrigin(0.5).setAlpha(0);
    subTitle.setShadow(0, 0, NEON_BLUE_STR, 10, true, true);
    uiElements.push(subTitle);

    const cx = GAME_WIDTH / 2; // 原为480，我们用常量确保准确
    const cy = GAME_HEIGHT / 2; // 原为270
    
    // 中央按钮容器，不再在上方，而在原地只是初始透明（按新需求不再下落）
    const centerBtnContainer = this.add.container(0, 0).setAlpha(0);
    
    // 我们暂时移除旧版 playBtnGraphics 和文本的初始化，由新的 playCenterButtonDrawAnimation 来动态创建它们
    const playZone = this.add.zone(cx, cy, 160, 160); // 暂不设为 interactive
    centerBtnContainer.add(playZone);

    // 右侧按钮菜单（明日方舟风格：交错排列，立体阴影）
    const rightMenuContainer = this.add.container(0, -300).setAlpha(0);
    const btnX = 755;
    // 微微交错 x 偏移，形成层次感
    const offsets = [0, -8, -4, 4, -6];
    rightMenuContainer.add(this.createMenuButtonObj(btnX + offsets[0], 120, '自定义', () => this.openPanel('custom')));
    rightMenuContainer.add(this.createMenuButtonObj(btnX + offsets[1], 210, '修改器', () => this.openPanel('modifier')));
    rightMenuContainer.add(this.createMenuButtonObj(btnX + offsets[2], 300, '难度选择', () => this.openPanel('difficulty')));
    rightMenuContainer.add(this.createMenuButtonObj(btnX + offsets[3], 390, '基础玩法', () => this.openPanel('tutorial')));
    rightMenuContainer.add(this.createMenuButtonObj(btnX + offsets[4], 480, '模式选择', () => this.openPanel('gamemode')));

    this.createSlidePanel();

    // 开始执行竖线开场动画
    this.playIntroAnimation(uiElements, centerBtnContainer, rightMenuContainer, playZone);
  }

  // 辅助方法：创建立体按钮（明日方舟风格：阴影+高光+菱形边框）
  private createMenuButtonObj(x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Container {
    const w = 180, h = 50;
    const container = this.add.container(x, y);

    // 阴影层（3D offset）
    const shadow = this.add.rectangle(4, 4, w, h, 0x000000, 0.5);
    container.add(shadow);

    // 主体背景
    const bg = this.add.rectangle(0, 0, w, h, 0x080812);
    bg.setStrokeStyle(2, NEON_BLUE, 0.8);
    container.add(bg);

    // 顶部高光线（立体凸起感）
    const topHighlight = this.add.rectangle(0, -(h / 2 - 3), w - 8, 2, NEON_BLUE, 0.25);
    container.add(topHighlight);

    // 左侧装饰斜线（明日方舟标志性元素）
    const leftDeco = this.add.rectangle(-(w / 2 - 6), 0, 3, h - 12, NEON_BLUE, 0.4);
    container.add(leftDeco);

    // 文字
    const txt = this.add.text(0, 0, text, {
      fontFamily: FONT_IMPACT, fontSize: '24px', color: NEON_BLUE_STR, fontStyle: 'italic'
    }).setOrigin(0.5);
    txt.setShadow(0, 0, NEON_BLUE_STR, 6, true, true);
    container.add(txt);

    // 交互区
    const zone = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true }).setDepth(1);
    zone.on('pointerdown', onClick);
    zone.on('pointerover', () => {
      bg.setFillStyle(0x002244);
      bg.setScale(1.05);
      shadow.setScale(1.05);
      txt.setScale(1.08);
      txt.setShadow(0, 0, NEON_BLUE_STR, 16, true, true);
      topHighlight.setAlpha(0.6);
      leftDeco.setAlpha(0.8);
    });
    zone.on('pointerout', () => {
      bg.setFillStyle(0x080812);
      bg.setScale(1);
      shadow.setScale(1);
      txt.setScale(1);
      txt.setShadow(0, 0, NEON_BLUE_STR, 6, true, true);
      topHighlight.setAlpha(0.25);
      leftDeco.setAlpha(0.4);
    });
    container.add(zone);
    return container;
  }

  private playIntroAnimation(
    uiElements: Phaser.GameObjects.GameObject[], 
    centerBtnContainer: Phaser.GameObjects.Container, 
    rightMenuContainer: Phaser.GameObjects.Container,
    playZone: Phaser.GameObjects.Zone
  ) {
    const linesCount = 40; // 左右各20条
    const lines: Phaser.GameObjects.Rectangle[] = [];
    const cx = GAME_WIDTH / 2;
    
    // 生成竖线
    for (let i = 0; i < linesCount; i++) {
      const isLeft = i < 20;
      // 粗细不一
      const thickness = Phaser.Math.Between(2, 8);
      const line = this.add.rectangle(cx, GAME_HEIGHT / 2, thickness, GAME_HEIGHT, 0xffffff, 1).setDepth(100);
      
      // 为每条线随机分配目标距离边缘的位置，距离越近速度越慢（即花费时间相同）
      const targetX = isLeft 
        ? Phaser.Math.Between(-20, 200) // 左侧边缘区域
        : Phaser.Math.Between(GAME_WIDTH - 200, GAME_WIDTH + 20); // 右侧边缘区域
      
      // 添加残影滤镜
      if ((line as any).postFX) {
        (line as any).postFX.addBlur(0, 2, 0, 1, 0xffffff); // 水平残影
      }

      this.tweens.add({
        targets: line,
        x: targetX,
        alpha: 0,
        duration: 1500, // 所有线用同样的时间到达各自的终点
        ease: 'Cubic.easeOut', // 先快后慢
        onComplete: () => {
          line.destroy();
        }
      });
    }

    // 在竖线动画结束时（1500ms），触发 UI 渐出和按钮掉落
    this.time.delayedCall(1400, () => {
      // 阶段二：标题等原地渐出
      this.tweens.add({
        targets: uiElements,
        alpha: 1,
        duration: 800,
        ease: 'Power2'
      });

      // 阶段三：仅右侧侧边栏按钮组自上而下渐出滑入
      this.tweens.add({
        targets: [rightMenuContainer],
        y: 0,
        alpha: 1,
        duration: 1000,
        ease: 'Back.easeOut',
      });
      
      // 中央出击按键原地入场，取消下落，而是从透明度0变到1，同时开始它的绘制动画
      this.tweens.add({
        targets: [centerBtnContainer],
        alpha: 1,
        duration: 500,
        onComplete: () => {
          // 这里将执行我们新版的中央按钮动态绘制动画
          this.playCenterButtonDrawAnimation(centerBtnContainer, playZone);
        }
      });
    });
  }

  private playCenterButtonDrawAnimation(container: Phaser.GameObjects.Container, playZone: Phaser.GameObjects.Zone) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const radius = 100;
    
    // 1. 画圆动画
    const circleGraphics = this.add.graphics();
    circleGraphics.lineStyle(4, NEON_BLUE, 1);
    if ((circleGraphics as any).postFX) {
      (circleGraphics as any).postFX.addGlow(NEON_BLUE, 2, 0, false, 0.1, 10);
    }
    container.add(circleGraphics);
    
    let drawObj = { angle: 0 };
    
    // 难度文本可以这里加上并先设为透明
    this.diffText = this.add.text(cx, cy - radius - 40, `难度\n${this.difficulties[this.currentDiffIndex].name}`, {
      fontFamily: FONT_IMPACT, fontSize: '28px', color: NEON_BLUE_STR, fontStyle: 'italic bold', align: 'center'
    }).setOrigin(0.5).setAlpha(0);
    this.diffText.setShadow(0, 0, NEON_BLUE_STR, 12, true, true);
    container.add(this.diffText);

    // 模式指示器
    this.modeText = this.add.text(cx, cy + radius + 25, this.gameMode === 'endless' ? '无尽' : this.gameMode === 'test' ? '测试' : '标准', {
      fontFamily: FONT_IMPACT, fontSize: '22px', color: '#ff9933', fontStyle: 'italic bold', align: 'center'
    }).setOrigin(0.5).setAlpha(0);
    this.modeText.setShadow(0, 0, '#ff9933', 8, true, true);
    container.add(this.modeText);
    
    this.tweens.add({
      targets: drawObj,
      angle: 360,
      duration: 1200,
      ease: 'Cubic.easeInOut',
      onUpdate: () => {
        circleGraphics.clear();
        circleGraphics.lineStyle(4, NEON_BLUE, 1);
        circleGraphics.beginPath();
        circleGraphics.arc(cx, cy, radius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + drawObj.angle), false);
        circleGraphics.strokePath();
      },
      onComplete: () => {
        this.playLineAndMaskAnimation(container, cx, cy, radius, playZone);
      }
    });
  }

  private playLineAndMaskAnimation(container: Phaser.GameObjects.Container, cx: number, cy: number, radius: number, playZone: Phaser.GameObjects.Zone) {
    const lineDuration = 800;
    
    // 1. 斜线，角度为 45 度（在 Phaser 中，y 朝下，因此从中心往左下的角度是 135度，右上是 -45度，连起来就是 45度斜线，或者说 -45度）
    // 根据手绘图，斜线是通过圆心的。
    // 但是直接旋转一个长条矩形会导致它的起始动画从左侧单侧向右侧伸展（如果设置了origin=0），或者从中间两端伸长。
    // 我们将其拆分为两条从圆心向外延伸的线，这样伸展动画才会是从圆心同时向外“生长”的。
    const angle45_1 = Phaser.Math.DegToRad(-45); // 右上
    const angle45_2 = Phaser.Math.DegToRad(135); // 左下
    const length45 = radius + 25; // 单侧长度
    const thick = 4;
    
    // 使用两条线分别向右上和左下伸展
    const line45_part1 = this.add.rectangle(cx, cy, 0, thick, NEON_BLUE, 1).setRotation(angle45_1).setOrigin(0, 0.5);
    if ((line45_part1 as any).postFX) (line45_part1 as any).postFX.addGlow(NEON_BLUE, 2, 0, false, 0.1, 5);
    container.add(line45_part1);

    const line45_part2 = this.add.rectangle(cx, cy, 0, thick, NEON_BLUE, 1).setRotation(angle45_2).setOrigin(0, 0.5);
    if ((line45_part2 as any).postFX) (line45_part2 as any).postFX.addGlow(NEON_BLUE, 2, 0, false, 0.1, 5);
    container.add(line45_part2);

    // 2. 垂直线（只显示圆外的上半部分和全部的下半部分）
    // 起点位于圆心，向下延伸到圆弧外一点
    // 原来设置了 setOrigin(0.5, 0)，这意味着它是竖着向下长的。但是如果旋转角度为0，长宽可能弄混。
    // 为了更直观，我们也用宽度伸展并旋转90度。
    const angleDown = Phaser.Math.DegToRad(90);
    const lineDown = this.add.rectangle(cx, cy, 0, thick, NEON_BLUE, 1).setRotation(angleDown).setOrigin(0, 0.5);
    if ((lineDown as any).postFX) (lineDown as any).postFX.addGlow(NEON_BLUE, 2, 0, false, 0.1, 5);
    container.add(lineDown);
    
    // 另外还需要上半垂直线在圆内的部分“不显示”，但是在圆外的部分“显示”。
    // 这意味着需要画一段线：从 cx, cy-radius 向外延伸
    const angleUp = Phaser.Math.DegToRad(-90);
    const lineUp = this.add.rectangle(cx, cy - radius, 0, thick, NEON_BLUE, 1).setRotation(angleUp).setOrigin(0, 0.5);
    if ((lineUp as any).postFX) (lineUp as any).postFX.addGlow(NEON_BLUE, 2, 0, false, 0.1, 5);
    container.add(lineUp);

    // 上半截隐形辅助线逻辑被移除，不再创建。

    // 展开动画
    this.tweens.add({
      targets: [line45_part1, line45_part2],
      width: length45,
      duration: lineDuration,
      ease: 'Power2'
    });

    this.tweens.add({
      targets: [lineDown],
      width: radius + 25, // 从圆心向下延伸出圆外
      duration: lineDuration,
      ease: 'Power2'
    });
    
    this.tweens.add({
      targets: [lineUp],
      width: 25, // 只在圆外伸出一点
      duration: lineDuration,
      ease: 'Power2',
      onComplete: () => {
        this.tweens.add({
          targets: [line45_part1, line45_part2, lineDown, lineUp],
          alpha: 0.6,
          duration: 400
        });
        
        // 进入遮罩区域构建及图像注入
        this.buildContentMasks(container, cx, cy, radius, playZone);
      }
    });
  }

  private addGradientMasks(container: Phaser.GameObjects.Container, cx: number, cy: number) {
    // 根据用户反馈截图，黑色方块遮住了两侧的 UI 和内容。
    // Phaser 的 fillGradientStyle 在某些环境下会完全填充黑色而不尊重 alpha 渐变。
    // 因此这里我们完全取消这种不稳定的“伪渐变遮盖”方法，改为什么都不画，仅仅保持线条本身的延伸。
    // 这样不会有黑色方块阻挡后面的场景或边框UI。
  }

  private buildContentMasks(container: Phaser.GameObjects.Container, cx: number, cy: number, radius: number, playZone: Phaser.GameObjects.Zone) {
    // WebGL Context lost 问题常由于在某些特殊节点大量创建或重叠过多 GeometryMask 或 PostFX 引发。
    // 在旧设备或某些浏览器环境下，同时使用多个 GeometryMask 和 PostFX 会超出限制。
    // 为确保稳定性，我们将 GeometryMask 绑定到底层的单一 Graphics 对象，并且只添加到场景但不添加到 Container
    // 另外，将 `radius` 稍微缩小一点点，以防超出先前画的圆圈边缘。
    const maskRadius = radius - 2;

    // 创建敌人图像（放入左上大块）
    const enemyIcon = this.add.sprite(cx, cy, 'enemy');
    enemyIcon.setScale(2.5).setAlpha(0);
    container.add(enemyIcon);
    
    // 创建玩家皮肤图像（放入右侧中块）
    // 问题：玩家贴图通过 regeneratePlayerSkinTexture 是直接创建纹理 (texture)，
    // 如果返回或者重新生成不及时可能导致图像渲染为黑色框或透明，并且如果大小超出太多也可能被遮罩掉。
    const playerSkinData = loadSkin();
    let playerKey = 'player';
    if (playerSkinData.grid && playerSkinData.grid.length > 0) {
      regeneratePlayerSkinTexture(this, 'player_skin', 28);
      playerKey = 'player_skin';
    }
    // 添加一点点延时保证纹理注册进 Phaser 缓存中，或者直接使用现有的纹理即可
    const playerIcon = this.add.sprite(cx, cy, playerKey);
    // 强制赋予尺寸避免有些浏览器下初始贴图还没 load 完
    playerIcon.setDisplaySize(100, 100); 
    playerIcon.setAlpha(0);
    container.add(playerIcon);

    // 小区域的"出击"文本
    // 红色、荧光、可以在文字阴影或者 glow 特效上增加艺术效果。
    const strikeText = this.add.text(cx - 35, cy + 35, '出\n击', {
      fontFamily: FONT_IMPACT, fontSize: '30px', color: '#ff0033', fontStyle: 'italic bold'
    }).setOrigin(0.5).setAlpha(0).setRotation(Phaser.Math.DegToRad(30)); // 倾斜放入左下 45度区域 (-135 到 180)
    strikeText.setShadow(0, 0, '#ff0033', 10, true, true);
    if ((strikeText as any).postFX) {
      (strikeText as any).postFX.addGlow(0xff0033, 2, 0, false, 0.1, 10);
    }
    container.add(strikeText);

    // 构建遮罩图形 - 根据新需求：
    // 一条隐藏的水平线，和穿过它的 -45度(即从右下到左上，或者右上到左下，从图中看是 贯穿的)
    // 根据需求图描述：
    // - 整个圆有三个部分：180度, 135度, 45度
    // - 水平线和 -45度 斜线的夹角分别是 45度 和 135度。
    // 如果斜线是 y = -x (-45度，即右上到左下)
    // 那么上半圆(180度) 没有垂直线。下半部分被垂直线分为两个角，但这与用户说的“水平线”有矛盾。
    // 用户原话：“做一条水平线和一条垂直线（水平线不显示），斜线不受影响，垂直线在水平线上半部分的圆内不显示”
    // 所以中心是水平线(180和0) 和 垂直线(90和-90)。
    // 垂直线的上半部分(-90) 在圆内不显示，圆外显示。下半部分(90) 全部正常显示。
    // 这说明圆的内部有两根线参与划分：水平线(隐藏) 和 下半垂直线(90度)。
    // 另外有一条斜线(图中看来是从左下135度到右上-45度)。
    // 水平线和斜线夹角在右上是45度，左下是45度。
    // 于是圆被分割：上半部分(180度)完全是一个整体！下半部分被垂直线(90度)和斜线(135度)划分？
    // 看用户的图纸：
    // 图中有一条水平线(虚线/不显示)，一条垂直线(实线向下)，一条斜线(右上到左下)。
    // 圆的上半部(0~180 或 180~360在Phaser坐标系下)：是一个完整的 180度 半圆。这就是放敌人的地方。
    // 圆的下半部(0~180 在Phaser中)：被下半垂直线(90度) 和 左下斜线(135度 或 225度) 切分。
    // 如果斜线是穿过圆心的 45 度角（即右上 -45度，左下 135度）。
    // 那么下半部分(0 到 180)：
    // 0 到 90度（右下四分之一）是 90度？
    // 用户说：三个部分分别是 180度, 135度, 45度。
    // 这意味着：180+135+45 = 360。
    // 如果上半部分是 180度。
    // 那么下半部剩下的 180度 被分为 135度 和 45度。
    // 这只能是：斜线和垂直线（下半部，即90度）的夹角是 45度。
    // 因此斜线必定是 135度(左下) 或 45度(右下)。从草图看，斜线在左侧，所以斜线部分在第三象限(90~180之间)，即 135度！
    // 这样，右下角从 0度(水平右) 到 90度(垂直下) 是 90度？不对。如果斜线是 135度，那么从 0到90 是 90度，从 90到135是 45度，从 135到180是 45度。这就切成了四个块！
    // 重新理解用户的图：
    // 图中的水平线只是辅助。实际上参与切分圆的只有：
    // 1. 贯穿的斜线 (-45度 和 135度)
    // 2. 向下的半垂直线 (90度)
    // 如果用这两根实线切分圆：
    // 圆被切成了三块：
    // 块A：斜线右上侧（从 135度 绕上边 到 -45度），跨度是 180 度。（最大区域，敌人）
    // 块B：斜线左下侧，从 -45度 绕右边 到 90度(向下垂直线)。这是 135 度区域！（次大区域，友军）
    // 块C：从 90度(向下垂直线) 到 135度(斜线左下侧)。这是 45 度区域！（最小区域，出击）
    // 这个逻辑非常完美严密，完全符合 180+135+45 = 360，也完全符合图纸！

    const maxMaskShape = this.make.graphics({ x: 0, y: 0 }, false);
    maxMaskShape.fillStyle(0xffffff, 1);
    maxMaskShape.beginPath();
    maxMaskShape.moveTo(cx, cy);
    // 从左下角(135度) 绕上方到 右上角(-45度)，必须加 false 或者 true 来控制顺/逆时针，
    // 由于是从 135(第三象限)顺时针转到 -45(第一象限)，所以应该是 135度 到 315度(-45等价)，顺时针
    // Phaser arc: (x, y, radius, startAngle, endAngle, anticlockwise)
    // 设 false (顺时针)，从 135 到 -45，其实等价于从 135 增加到 315(315等同于-45)
    maxMaskShape.arc(cx, cy, maskRadius, Phaser.Math.DegToRad(135), Phaser.Math.DegToRad(315), false);
    maxMaskShape.closePath();
    maxMaskShape.fillPath();
    enemyIcon.setMask(new Phaser.Display.Masks.GeometryMask(this, maxMaskShape));

    const midMaskShape = this.make.graphics({ x: 0, y: 0 }, false);
    midMaskShape.fillStyle(0xffffff, 1);
    midMaskShape.beginPath();
    midMaskShape.moveTo(cx, cy);
    // 从右上角(315度 即 -45度) 绕右侧 到 下方(90度)，顺时针
    // 即从 315度 增加到 360(0) 然后增加到 90度
    midMaskShape.arc(cx, cy, maskRadius, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(90), false);
    midMaskShape.closePath();
    midMaskShape.fillPath();
    playerIcon.setMask(new Phaser.Display.Masks.GeometryMask(this, midMaskShape));

    const minMaskShape = this.make.graphics({ x: 0, y: 0 }, false);
    minMaskShape.fillStyle(0xffffff, 1);
    minMaskShape.beginPath();
    minMaskShape.moveTo(cx, cy);
    // 从下方(90度) 到 左下角(135度)，顺时针
    minMaskShape.arc(cx, cy, maskRadius, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(135), false);
    minMaskShape.closePath();
    minMaskShape.fillPath();
    strikeText.setMask(new Phaser.Display.Masks.GeometryMask(this, minMaskShape));
    
    // 让它们渐出并开始旋转
    this.tweens.add({
      targets: [enemyIcon, playerIcon, strikeText],
      alpha: 1,
      duration: 600,
      ease: 'Power1'
    });

    // 敌人图像：180度区域，按现在效果自转
    this.tweens.add({
      targets: enemyIcon,
      angle: 360,
      duration: 5000,
      repeat: -1
    });

    // 友方图像修改：整个友方图像在这个 135度 范围内旋转，不以圆心为旋转中心。
    // 即自转，而不是绕着中心公转（或者在自己区域内居中自转）
    // midMask 区域 (-45 到 90) 的中心大概在 22.5度。距离圆心一半距离处。
    const midCenterX = cx + (maskRadius * 0.5) * Math.cos(Phaser.Math.DegToRad(22.5));
    const midCenterY = cy + (maskRadius * 0.5) * Math.sin(Phaser.Math.DegToRad(22.5));
    // 把 playerIcon 移到该区域中心
    playerIcon.setPosition(midCenterX, midCenterY);
    playerIcon.setScale(1.8); // 因为不占满全圆，稍微缩小一点以适应局部旋转
    
    this.tweens.add({
      targets: playerIcon,
      angle: 360,
      duration: 5000,
      repeat: -1
    });

    this.tweens.add({
      targets: this.diffText,
      alpha: 1,
      duration: 500
    });
    
    // 保存这两个头像引用，以便开始游戏时做飞出动画
    (this as any).startAnimEnemyIcon = enemyIcon;
    (this as any).startAnimPlayerIcon = playerIcon;
    (this as any).startAnimMasks = [maxMaskShape, midMaskShape, minMaskShape];
    (this as any).startAnimStrikeText = strikeText;

    playZone.setInteractive({ useHandCursor: true });
    playZone.on('pointerdown', () => {
      this.playStartTransitionAndStartGame(cx, cy);
    });
  }

  private playStartTransitionAndStartGame(cx: number, cy: number) {
    const enemyIcon = (this as any).startAnimEnemyIcon as Phaser.GameObjects.Sprite;
    const playerIcon = (this as any).startAnimPlayerIcon as Phaser.GameObjects.Sprite;
    const masks = (this as any).startAnimMasks as Phaser.GameObjects.Graphics[];
    const strikeText = (this as any).startAnimStrikeText as Phaser.GameObjects.Text;
    
    // 如果没有正常初始化（比如被连续点击打断等防御情况），直接进游戏
    if (!enemyIcon || !playerIcon) {
      this.scene.start('GameScene', {
        difficulty: this.difficulties[this.currentDiffIndex],
        modifiers: { ...this.modifierStates },
        mode: this.gameMode,
      });
      return;
    }

    // 清除遮罩，这样头像可以自由飞出不受限
    enemyIcon.clearMask();
    playerIcon.clearMask();
    masks.forEach(m => m.destroy());
    if (strikeText) strikeText.destroy();

    // 暂停原有原地自转 tween（如果需要可以用更细粒度的控制，这里简单停止所有其上的tweens）
    this.tweens.killTweensOf(enemyIcon);
    this.tweens.killTweensOf(playerIcon);

    // 飞出的目标位置（GameScene中敌人初始在右上，玩家在左侧中间偏左）
    const targetEnemyX = GAME_WIDTH * 0.8;
    const targetEnemyY = GAME_HEIGHT * 0.5;
    const targetPlayerX = GAME_WIDTH * 0.2;
    const targetPlayerY = GAME_HEIGHT * 0.5;

    // 添加一点炫酷特效比如全屏泛白或者缩放
    this.cameras.main.flash(300, 255, 255, 255);

    // 敌人飞出动画
    this.tweens.add({
      targets: enemyIcon,
      x: targetEnemyX,
      y: targetEnemyY,
      scale: 1, // 恢复正常比例
      angle: 0, // 可以回到初始角度或保持转动
      duration: 600,
      ease: 'Back.easeIn'
    });

    // 玩家飞出动画
    this.tweens.add({
      targets: playerIcon,
      x: targetPlayerX,
      y: targetPlayerY,
      scale: 1, // 恢复正常比例
      angle: 0,
      duration: 600,
      ease: 'Back.easeIn',
      onComplete: () => {
        // 动画完成后跳转场景
        this.scene.start('GameScene', {
          difficulty: this.difficulties[this.currentDiffIndex],
          modifiers: { ...this.modifierStates },
          mode: this.gameMode,
        });
      }
    });
  }
  
  // ===== 统一渐出蓝色框面板 =====
  private createSlidePanel() {
    this.panelGroup = this.add.group();
    this.panelContentGroup = this.add.group();

    // 遮罩，点击空白处关闭
    const mask = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
      .setInteractive().setDepth(50);
    mask.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      // 仅在点击非内容区域（遮罩本身）时关闭
      event.stopPropagation();
      this.closePanel();
    });

    // 蓝色梯形框（3D 层次：阴影层 + 主体层 + 高光内边）
    const panelShadow = this.add.graphics().setDepth(50);
    panelShadow.lineStyle(4, 0x001122, 0.7);
    panelShadow.strokePoints([
      { x: 933, y: 33 }, { x: 663, y: 33 }, { x: 583, y: 513 }, { x: 933, y: 513 }
    ], true);

    const frame = this.add.graphics().setDepth(51);
    frame.lineStyle(2, NEON_BLUE, 1);
    frame.strokePoints([
      { x: 930, y: 30 }, { x: 660, y: 30 }, { x: 580, y: 510 }, { x: 930, y: 510 }
    ], true);
    frame.strokePoints([
      { x: 920, y: 40 }, { x: 670, y: 40 }, { x: 595, y: 500 }, { x: 920, y: 500 }
    ], true);
    // 内高光边
    frame.lineStyle(1, NEON_BLUE, 0.3);
    frame.strokePoints([
      { x: 910, y: 50 }, { x: 680, y: 50 }, { x: 610, y: 490 }, { x: 910, y: 490 }
    ], true);
    if (frame.postFX) {
      frame.postFX.addGlow(NEON_BLUE, 2, 0, false, 0.1, 15);
    }

    // 面板标题（动态）
    this.panelTitle = this.add.text(755, 80, '', {
      fontFamily: FONT_IMPACT, fontSize: '40px', color: NEON_BLUE_STR, fontStyle: 'italic bold'
    }).setOrigin(0.5).setDepth(52);
    this.panelTitle.setShadow(0, 0, NEON_BLUE_STR, 12, true, true);

    // 返回按钮
    const backBtn = this.add.text(755, 450, '[ 返回 ]', {
      fontFamily: FONT_IMPACT, fontSize: '26px', color: NEON_BLUE_STR, fontStyle: 'italic bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(52);
    backBtn.setShadow(0, 0, NEON_BLUE_STR, 12, true, true);
    backBtn.on('pointerover', () => { backBtn.setScale(1.1); backBtn.setShadow(0, 0, NEON_BLUE_STR, 24, true, true); });
    backBtn.on('pointerout', () => { backBtn.setScale(1); backBtn.setShadow(0, 0, NEON_BLUE_STR, 12, true, true); });
    backBtn.on('pointerdown', () => this.closePanel());

    this.panelGroup.addMultiple([mask, panelShadow, frame, this.panelTitle, backBtn]);
    this.panelGroup.setVisible(false);
    // 内容组单独管理，初始也隐藏并移到屏幕外
    this.panelContentGroup.setVisible(false);
    // 初始位置在屏幕右侧外
    this.setPanelXOffset(GAME_WIDTH);
  }

  private clearPanelContent() {
    const children = this.panelContentGroup.getChildren();
    // 强制清理所有元素（包括事件绑定等），使用 Phaser 的 destroy 清理
    [...children].forEach((c) => c.destroy());
    // 参数 true, true 会从场景中彻底销毁所有成员
    this.panelContentGroup.clear(true, true);
  }

  private openPanel(type: PanelType) {
    if (this.panelOpen && this.currentPanel === type) {
      this.closePanel();
      return;
    }
    const wasOpen = this.panelOpen;
    this.clearPanelContent();
    this.currentPanel = type;
    const titles: Record<PanelType, string> = {
      custom: '自 定 义',
      modifier: '修 改 器',
      difficulty: '难 度 选 择',
      tutorial: '基 础 玩 法',
      graphics: '画 面 设 置',
      gamemode: '模 式 选 择',
    };
    this.panelTitle.setText(titles[type]);

    if (type === 'custom') this.buildCustomContent();
    else if (type === 'modifier') this.buildModifierContent();
    else if (type === 'difficulty') this.buildDifficultyContent();
    else if (type === 'tutorial') this.buildTutorialContent();
    else if (type === 'graphics') this.buildGraphicsContent();
    else if (type === 'gamemode') this.buildGameModeContent();

    if (!wasOpen) {
      // 首次打开：内容新建在正确位置，需先偏移到屏幕外与面板框对齐，再一起从右向左滑入
      this.offsetContentGroup(GAME_WIDTH);
      this.panelGroup.setVisible(true);
      this.panelContentGroup.setVisible(true);
      this.movePanel(-GAME_WIDTH);
      this.panelOffscreen = false;
      this.panelOpen = true;
    } else {
      // 在已经打开的面板中切换内容（如点击"画面设置"）
      // 这里我们在 clearPanelContent 时已经清空了旧内容并生成了新内容。
      // 新生成的内容现在位于原始设计位置 (X=755附近)，但是我们整个 panelContentGroup 本身并没有改变坐标
      // 由于之前是通过 movePanel(也就是调整里面每个元素的 x) 来做滑动的，
      // 新生成的元素 x 是基于原始设计的，它们没有经过 offsetContentGroup(GAME_WIDTH) 也没有被推回，
      // 所以位置天然是对的，但为了安全我们需要确保组可见
      this.panelContentGroup.setVisible(true);
      this.panelOpen = true;
      this.panelOffscreen = false;
    }
  }

  private closePanel() {
    if (!this.panelOpen) return;
    this.movePanel(GAME_WIDTH);
    this.panelOpen = false;
    this.panelOffscreen = true; // 滑出后停在屏幕外
    this.currentPanel = null;
    this.time.delayedCall(300, () => {
      this.panelGroup.setVisible(false);
      this.panelContentGroup.setVisible(false);
      this.clearPanelContent();
    });
  }

  // ----- 自定义面板内容 -----
  private buildCustomContent() {
    const mode = loadControlMode();
    const isPC = mode === 'pc';

    // 手机/电脑 切换
    const modeToggleY = 190;
    const modeLabel = this.add.text(680, modeToggleY, '控制模式:', {
      fontFamily: FONT_MONO, fontSize: '14px', color: '#888888'
    }).setOrigin(0, 0.5).setDepth(52);
    const mobileBtn = this.add.text(730, modeToggleY, isPC ? '手机' : '◀ 手机 ▶', {
      fontFamily: FONT_IMPACT, fontSize: '20px',
      color: isPC ? '#555555' : '#00ff88', fontStyle: 'italic'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(52);
    const pcBtn = this.add.text(810, modeToggleY, isPC ? '◀ 电脑 ▶' : '电脑', {
      fontFamily: FONT_IMPACT, fontSize: '20px',
      color: isPC ? '#00ff88' : '#555555', fontStyle: 'italic'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(52);

    mobileBtn.on('pointerdown', () => {
      saveControlMode('mobile');
      this.clearPanelContent();
      this.buildCustomContent();
    });
    pcBtn.on('pointerdown', () => {
      saveControlMode('pc');
      this.clearPanelContent();
      this.buildCustomContent();
    });

    const keyBtn = this.add.text(755, 250, '[ 键位设置 ]', {
      fontFamily: FONT_IMPACT, fontSize: '30px', color: NEON_BLUE_STR, fontStyle: 'italic bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(52);
    keyBtn.setShadow(0, 0, NEON_BLUE_STR, 12, true, true);
    keyBtn.on('pointerover', () => { keyBtn.setScale(1.1); keyBtn.setShadow(0, 0, NEON_BLUE_STR, 24, true, true); });
    keyBtn.on('pointerout', () => { keyBtn.setScale(1); keyBtn.setShadow(0, 0, NEON_BLUE_STR, 12, true, true); });
    keyBtn.on('pointerdown', () => {
      this.closePanel();
      this.time.delayedCall(300, () => {
        this.scene.launch('KeyConfigScene', { mode: loadControlMode() });
        this.scene.bringToTop('KeyConfigScene');
      });
    });

    const skinBtn = this.add.text(755, 310, '[ 画面设置 ]', {
      fontFamily: FONT_IMPACT, fontSize: '30px', color: NEON_BLUE_STR, fontStyle: 'italic bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(52);
    skinBtn.setShadow(0, 0, NEON_BLUE_STR, 12, true, true);
    skinBtn.on('pointerover', () => { skinBtn.setScale(1.1); skinBtn.setShadow(0, 0, NEON_BLUE_STR, 24, true, true); });
    skinBtn.on('pointerout', () => { skinBtn.setScale(1); skinBtn.setShadow(0, 0, NEON_BLUE_STR, 12, true, true); });
    skinBtn.on('pointerdown', () => {
      // 画面设置在同一个面板内切换，不需要关闭面板滑出再滑入
      this.openPanel('graphics');
    });

    const hint = this.add.text(755, 370, '键位：拖动按键调整位置\n画面：定制外观特效和颜色', {
      fontFamily: FONT_MONO, fontSize: '15px', color: NEON_BLUE_STR, align: 'center'
    }).setOrigin(0.5).setDepth(52);

    this.panelContentGroup.addMultiple([modeLabel, mobileBtn, pcBtn, keyBtn, skinBtn, hint]);
  }

  // ----- 画面设置面板内容 -----
  private buildGraphicsContent() {
    const createGraphicsBtn = (y: number, text: string, onClick: () => void) => {
      const btn = this.add.text(755, y, `[ ${text} ]`, {
        fontFamily: FONT_IMPACT, fontSize: '28px', color: NEON_BLUE_STR, fontStyle: 'italic bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(52);
      btn.setShadow(0, 0, NEON_BLUE_STR, 10, true, true);
      btn.on('pointerover', () => { btn.setScale(1.1); btn.setShadow(0, 0, NEON_BLUE_STR, 20, true, true); });
      btn.on('pointerout', () => { btn.setScale(1); btn.setShadow(0, 0, NEON_BLUE_STR, 10, true, true); });
      btn.on('pointerdown', () => {
        this.closePanel();
        this.time.delayedCall(300, () => {
          onClick();
        });
      });
      return btn;
    };

    const btn1 = createGraphicsBtn(180, '战机皮肤', () => {
      this.scene.launch('SkinEditorScene');
      this.scene.bringToTop('SkinEditorScene');
    });

    const btn2 = createGraphicsBtn(270, '背景颜色', () => {
      this.scene.launch('ColorPickerScene', { mode: 'bg' });
      this.scene.bringToTop('ColorPickerScene');
    });

    const btn3 = createGraphicsBtn(360, '大招特效', () => {
      this.scene.launch('ColorPickerScene', { mode: 'trail' });
      this.scene.bringToTop('ColorPickerScene');
    });

    const btn4 = createGraphicsBtn(450, '子弹颜色', () => {
      this.scene.launch('ColorPickerScene', { mode: 'bullet' });
      this.scene.bringToTop('ColorPickerScene');
    });

    this.panelContentGroup.addMultiple([btn1, btn2, btn3, btn4]);
  }

  // ----- 修改器面板内容 -----
  private buildModifierContent() {
    const items = [
      { key: '连发', label: '无限连发', desc: '取消普攻射击间隔' },
      { key: '自瞄', label: '超级自瞄', desc: '普攻必中敌人' },
      { key: '无限弹反', label: '无限弹反', desc: '取消弹反失误时的冷却惩罚' },
      { key: '无限完美弹反', label: '必定完美弹反', desc: '弹反判定强制走极限弹反分支' },
    ];
    let y = 140;
    items.forEach((item) => {
      this.buildModifierToggle(755, y, item.key, item.label, item.desc);
      y += 75;
    });
    const note = this.add.text(755, 450, '修改器仅影响下一局游戏', {
      fontFamily: FONT_MONO, fontSize: '16px', color: '#666666'
    }).setOrigin(0.5).setDepth(52);
    this.panelContentGroup.add(note);
  }

  private buildModifierToggle(x: number, y: number, key: string, label: string, desc: string) {
    const labelTxt = this.add.text(x - 120, y, label, {
      fontFamily: FONT_IMPACT, fontSize: '24px', color: NEON_BLUE_STR, fontStyle: 'italic bold'
    }).setOrigin(0, 0.5).setDepth(52);
    labelTxt.setShadow(0, 0, NEON_BLUE_STR, 8, true, true);

    const descTxt = this.add.text(x - 120, y + 28, desc, {
      fontFamily: FONT_MONO, fontSize: '14px', color: '#888888'
    }).setOrigin(0, 0.5).setDepth(52);

    const toggleBtn = this.add.text(x + 120, y, this.modifierStates[key] ? '[ 开 ]' : '[ 关 ]', {
      fontFamily: FONT_IMPACT, fontSize: '24px',
      color: this.modifierStates[key] ? '#00ff88' : NEON_BLUE_STR, fontStyle: 'italic bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(52);
    toggleBtn.setShadow(0, 0, this.modifierStates[key] ? '#00ff88' : NEON_BLUE_STR, 8, true, true);
    toggleBtn.on('pointerover', () => toggleBtn.setScale(1.1));
    toggleBtn.on('pointerout', () => toggleBtn.setScale(1));
    toggleBtn.on('pointerdown', () => {
      this.modifierStates[key] = !this.modifierStates[key];
      const on = this.modifierStates[key];
      toggleBtn.setText(on ? '[ 开 ]' : '[ 关 ]');
      toggleBtn.setColor(on ? '#00ff88' : NEON_BLUE_STR);
      toggleTxtShadow(toggleBtn, on ? '#00ff88' : NEON_BLUE_STR);
    });

    this.panelContentGroup.addMultiple([labelTxt, descTxt, toggleBtn]);
  }

  // ----- 难度选择面板内容 -----
  private buildDifficultyContent() {
    let y = 130;
    this.difficulties.forEach((d, i) => {
      const selected = i === this.currentDiffIndex;
      const color = selected ? '#00ff88' : NEON_BLUE_STR;
      const btn = this.add.text(755, y, selected ? `▶ ${d.name} ◀` : `[ ${d.name} ]`, {
        fontFamily: FONT_IMPACT, fontSize: '26px', color, fontStyle: 'italic bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(52);
      btn.setShadow(0, 0, color, 8, true, true);

      const desc = this.add.text(755, y + 24, d.desc, {
        fontFamily: FONT_MONO, fontSize: '13px', color: '#888888'
      }).setOrigin(0.5).setDepth(52);

      btn.on('pointerover', () => btn.setScale(1.1));
      btn.on('pointerout', () => btn.setScale(1));
      btn.on('pointerdown', () => {
        this.currentDiffIndex = i;
        this.diffText.setText(`难度\n${d.name}`);
        this.clearPanelContent();
        this.buildDifficultyContent();
      });

      this.panelContentGroup.addMultiple([btn, desc]);
      y += 60;
    });
  }

  // ----- 基础玩法面板内容（含详细介绍） -----
  private buildTutorialContent() {
    const sections: { title: string; body: string }[] = [
      {
        title: '▸ 普通攻击 (Z / 触屏Z键)',
        body: '按住 Z 键即可持续连发普攻，无需反复点击。普攻具备自瞄吸附，\n大致朝向敌人方向即可自动锁定。子弹可与敌方子弹对撞抵消。',
      },
      {
        title: '▸ 致命大招 (X / 触屏X键)',
        body: '大招需要蓄力：按住 X 键蓄满（约0.5秒）后松开才能释放。\n蓄力期间画面会显示轨迹预测线。命中过敌人的普攻可提升大招精度。',
      },
      {
        title: '▸ 冲刺闪避 (C / 空格)',
        body: '短距离高速冲刺，可穿越子弹。冲刺有冷却时间，\n但普攻命中敌人会重置冷却，允许连续闪避。',
      },
      {
        title: '▸ 完美闪避',
        body: '在子弹即将命中你的瞬间冲刺穿过它，触发完美闪避！\n画面进入慢动作，敌人被标记，此时释放大招必中且伤害大幅提升。',
      },
      {
        title: '▸ 移动与瞄准',
        body: '左手拖动屏幕或 WASD 移动。鼠标/拖动方向决定瞄准方向。\n可在「自定义-键位设置」中调整按键位置、大小与透明度。',
      },
    ];

    let y = 120;
    const titleStyle = { fontFamily: FONT_IMPACT, fontSize: '20px', color: '#00ff88', fontStyle: 'italic bold' };
    const bodyStyle = { fontFamily: FONT_MONO, fontSize: '14px', color: NEON_BLUE_STR, lineSpacing: 4 };

    sections.forEach((s) => {
      const t = this.add.text(615, y, s.title, titleStyle).setOrigin(0, 0.5).setDepth(52);
      t.setShadow(0, 0, '#00ff88', 6, true, true);
      const b = this.add.text(615, y + 22, s.body, bodyStyle).setOrigin(0, 0.5).setDepth(52);
      this.panelContentGroup.addMultiple([t, b]);
      y += 72;
    });
  }

  // 模式选择面板内容
  private buildGameModeContent() {
    const cx = 755;
    const options = [
      { name: '标准模式', val: 'standard' as const, desc: '经典1v1对决，击败敌方几何体即可获胜' },
      { name: '无尽模式', val: 'endless' as const, desc: '一波波小兵+BOSS，打完选技能强化，挑战极限波数' },
      { name: '测试模式', val: 'test' as const, desc: '敌人不攻击不移动，纯打靶练习' },
    ];
    let y = 120;
    options.forEach((opt) => {
      const isActive = this.gameMode === opt.val;
      const activeColor = isActive ? 0x00ff88 : NEON_BLUE;
      const activeStr = isActive ? '#00ff88' : NEON_BLUE_STR;

      // 3D 立体按钮：绘制阴影层 + 主体层 + 高光边
      const shadow = this.add.rectangle(cx + 3, y + 3, 250, 60, 0x000000, 0.6).setDepth(52);
      const bg = this.add.rectangle(cx, y, 250, 60, isActive ? 0x002244 : 0x0a0a14)
        .setStrokeStyle(2, activeColor, 0.9).setDepth(53);
      // 顶部高光线（立体感）
      const highlight = this.add.rectangle(cx, y - 28, 240, 2, activeColor, 0.3).setDepth(54);

      const nameText = this.add.text(cx, y - 14, opt.name, {
        fontFamily: FONT_IMPACT, fontSize: '22px',
        color: activeStr, fontStyle: 'italic'
      }).setOrigin(0.5).setDepth(54);
      nameText.setShadow(0, 0, activeStr, isActive ? 10 : 4, true, true);

      const descText = this.add.text(cx, y + 16, opt.desc, {
        fontFamily: FONT_MONO, fontSize: '11px', color: '#888888',
      }).setOrigin(0.5).setDepth(54);

      const zone = this.add.zone(cx, y, 250, 60).setInteractive({ useHandCursor: true }).setDepth(55);
      zone.on('pointerdown', () => {
        this.gameMode = opt.val;
        if (this.modeText) {
          this.modeText.setText(this.gameMode === 'endless' ? '无尽' : this.gameMode === 'test' ? '测试' : '标准');
        }
        this.clearPanelContent();
        this.buildGameModeContent();
      });
      zone.on('pointerover', () => {
        bg.setFillStyle(isActive ? 0x003366 : 0x111133);
        bg.setScale(1.03);
        shadow.setScale(1.03);
        highlight.setScale(1.03);
        nameText.setScale(1.05);
        descText.setScale(1.05);
      });
      zone.on('pointerout', () => {
        bg.setFillStyle(isActive ? 0x002244 : 0x0a0a14);
        bg.setScale(1);
        shadow.setScale(1);
        highlight.setScale(1);
        nameText.setScale(1);
        descText.setScale(1);
      });

      this.panelContentGroup.addMultiple([shadow, bg, highlight, nameText, descText, zone]);
      y += 75;
    });
  }

  // ===== 面板动画辅助 =====
  private movePanel(dx: number) {
    // 面板框与内容一起平移
    this.panelGroup.getChildren().forEach((c) => {
      const obj = c as unknown as Phaser.GameObjects.Components.Transform;
      this.tweens.add({ targets: obj, x: obj.x + dx, duration: 300, ease: 'Power2' });
    });
    this.panelContentGroup.getChildren().forEach((c) => {
      const obj = c as unknown as Phaser.GameObjects.Components.Transform;
      this.tweens.add({ targets: obj, x: obj.x + dx, duration: 300, ease: 'Power2' });
    });
  }

  // 仅偏移面板框（mask/frame/title/返回按钮），用于初始定位到屏幕外
  private setPanelXOffset(dx: number) {
    this.panelGroup.getChildren().forEach((c) => {
      const obj = c as unknown as Phaser.GameObjects.Components.Transform;
      obj.x += dx;
    });
  }

  // 仅偏移动态内容组，用于首次打开时把新建内容移到屏幕外与面板框对齐
  private offsetContentGroup(dx: number) {
    this.panelContentGroup.getChildren().forEach((c) => {
      const obj = c as unknown as Phaser.GameObjects.Components.Transform;
      obj.x += dx;
    });
  }

  private createMenuButton(x: number, y: number, text: string, onClick: () => void) {
    const btn = this.add.text(x, y, `[ ${text} ]`, {
      fontFamily: FONT_IMPACT, fontSize: '28px', color: NEON_BLUE_STR, fontStyle: 'italic bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.setShadow(0, 0, NEON_BLUE_STR, 12, true, true);
    btn.on('pointerover', () => { btn.setScale(1.1); btn.setShadow(0, 0, NEON_BLUE_STR, 24, true, true); });
    btn.on('pointerout', () => { btn.setScale(1); btn.setShadow(0, 0, NEON_BLUE_STR, 12, true, true); });
    btn.on('pointerdown', onClick);
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
    // 大交点（每 120px）更强光
    g.fillStyle(0x303068, 0.4);
    for (let x = 0; x <= GAME_WIDTH; x += 120) {
      for (let y = 0; y <= GAME_HEIGHT; y += 120) {
        g.fillCircle(x, y, 2.2);
      }
    }
  }
}

function toggleTxtShadow(txt: Phaser.GameObjects.Text, color: string) {
  txt.setShadow(0, 0, color, 8, true, true);
}
