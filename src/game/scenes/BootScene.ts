import Phaser from 'phaser';
import { ASSET_KEYS } from '../assets';
import { COLORS, PLAYER_SIZE, ENEMY_SIZE, BULLET_SIZE, ENEMY_BULLET_SIZE, ULTIMATE_SIZE } from '../constants';
import { regeneratePlayerSkinTexture } from '../skinConfig';
import { applyMute, loadAudioFiles } from '../sfx';

// 启动场景：生成所有纯色像素纹理，然后进入开始页面（音效在启动即后台非阻塞加载，越早越好）
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // 尽早开始后台加载音效：菜单出现时音频多半已就绪，首按即有声音
    loadAudioFiles(this);
    // 全面禁用浏览器默认手势：右键菜单、iOS 手势、文本选择、触控滚动
    document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
    if (this.game.canvas) {
      const cv = this.game.canvas as HTMLCanvasElement;
      cv.oncontextmenu = () => false;
      cv.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      cv.addEventListener('gesturestart', (e) => e.preventDefault());
      cv.addEventListener('gesturechange', (e) => e.preventDefault());
      cv.addEventListener('gestureend', (e) => e.preventDefault());
      cv.style.touchAction = 'none';
    }
    // 同步静音状态（移动端解锁由 Phaser Sound Manager 首次手势自动处理）
    applyMute(this);
    this.generateTextures();
    this.scene.start('StartScene');
  }

  private generateTextures() {
    const g = this.add.graphics();

    // 玩家：黑色边框正三角形（默认皮肤）
    g.clear();
    g.lineStyle(4, COLORS.player, 1);
    g.strokeTriangle(2, PLAYER_SIZE - 2, PLAYER_SIZE - 2, PLAYER_SIZE / 2, 2, 2);
    g.generateTexture(ASSET_KEYS.player, PLAYER_SIZE, PLAYER_SIZE);

    // 若有皮肤或需要生成空心三角，用皮肤像素数据完全替换默认三角形纹理
    regeneratePlayerSkinTexture(this, ASSET_KEYS.player, PLAYER_SIZE);

    // 敌人：红色边框正方形
    g.clear();
    g.lineStyle(4, COLORS.enemy, 1);
    g.strokeRect(2, 2, ENEMY_SIZE - 4, ENEMY_SIZE - 4);
    g.generateTexture(ASSET_KEYS.enemy, ENEMY_SIZE, ENEMY_SIZE);

    // 子弹：白色小方块 (由 GameScene 的 setTint 控制颜色)
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, BULLET_SIZE, BULLET_SIZE);
    g.generateTexture(ASSET_KEYS.bullet, BULLET_SIZE, BULLET_SIZE);

    // 必杀技：红色大方块
    g.clear();
    g.fillStyle(COLORS.ultimate, 1);
    g.fillRect(0, 0, ULTIMATE_SIZE, ULTIMATE_SIZE);
    g.generateTexture(ASSET_KEYS.ultimate, ULTIMATE_SIZE, ULTIMATE_SIZE);

    // 敌人子弹：红方块
    g.clear();
    g.fillStyle(COLORS.enemy_bullet, 1);
    g.fillRect(0, 0, ENEMY_BULLET_SIZE, ENEMY_BULLET_SIZE);
    g.generateTexture(ASSET_KEYS.enemy_bullet, ENEMY_BULLET_SIZE, ENEMY_BULLET_SIZE);

    // 通用像素方块（用于敌人死亡和受击特效，白色以支持染色）
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture(ASSET_KEYS.pixel, 4, 4);

    // 必杀技拖尾基础微粒：白点
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture('ult_trail', 16, 16);

    // 空心椭圆粒子（用于垂直冲击波波纹，本身就画成瘦高的垂直椭圆）
    g.clear();
    g.lineStyle(2, 0xffffff, 1);
    g.strokeEllipse(12, 32, 10, 30); // x=12,y=32, 宽半轴10，长半轴30
    g.generateTexture('ult_ring_ellipse', 24, 64);

    // 超长实线粒子（用于无缝拼接中心红线，本身画成扁长的水平矩形）
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 128, 4); // 长128，宽4的细长矩形
    g.generateTexture('ult_line', 128, 4);

    // 网格背景 — 蓝图点阵风格：暗底 + 微光十字交点
    g.clear();
    // 深色底
    g.fillStyle(0x0a0a14, 0.4);
    g.fillRect(0, 0, 40, 40);
    // 极淡的十字准线（短线，不到边界，营造蓝图/雷达屏质感）
    g.lineStyle(0.6, 0x1a1a3e, 0.45);
    g.lineBetween(20, 4, 20, 16);   // 上半竖线
    g.lineBetween(20, 24, 20, 36);  // 下半竖线
    g.lineBetween(4, 20, 16, 20);   // 左半横线
    g.lineBetween(24, 20, 36, 20);  // 右半横线
    // 中心微光点
    g.fillStyle(0x3a3a6e, 0.6);
    g.fillCircle(20, 20, 1.8);
    // 四角极小辅助点
    g.fillStyle(0x1a1a3e, 0.25);
    g.fillCircle(0, 0, 1.0);
    g.fillCircle(40, 0, 1.0);
    g.fillCircle(0, 40, 1.0);
    g.fillCircle(40, 40, 1.0);
    g.generateTexture('grid_tex', 40, 40);

    // 武器轮盘按钮 - 圆形，内部有十字准星图案
    g.clear();
    g.fillStyle(0x333333, 1);
    g.fillCircle(24, 24, 24);
    g.lineStyle(3, 0xffffff, 0.8);
    g.strokeCircle(24, 24, 24);
    // 十字线
    g.lineStyle(2, 0xffffff, 0.6);
    g.lineBetween(24, 8, 24, 40);
    g.lineBetween(8, 24, 40, 24);
    g.generateTexture('wpn_btn', 48, 48);

    // 冲锋套件图标 - SMG冲锋枪像素画 (40x28)
    g.clear();
    const ox = 0, oy = 2;
    // 枪身主体
    g.fillStyle(0x888888, 1);
    g.fillRect(ox + 4, oy + 6, 22, 10);
    // 枪管
    g.fillStyle(0x666666, 1);
    g.fillRect(ox + 26, oy + 8, 14, 5);
    // 握把
    g.fillStyle(0x777777, 1);
    g.fillRect(ox + 8, oy + 16, 8, 10);
    // 弹匣（弧形简化）
    g.fillStyle(0x555555, 1);
    g.fillRect(ox + 10, oy + 2, 6, 5);
    // 枪托
    g.fillStyle(0x666666, 1);
    g.fillRect(ox + 0, oy + 7, 5, 4);
    g.fillRect(ox + 0, oy + 11, 3, 10);
    // 准星
    g.fillStyle(0xaaaaaa, 1);
    g.fillRect(ox + 37, oy + 5, 2, 3);
    // 高光
    g.fillStyle(0xcccccc, 1);
    g.fillRect(ox + 6, oy + 8, 16, 3);
    g.generateTexture('wpn_charge', 40, 28);

    // 狙击套件图标 - 十字准星 (40x40)
    g.clear();
    g.lineStyle(3, 0xff0000, 1);
    g.strokeCircle(20, 20, 16);
    g.lineStyle(1.5, 0xff0000, 0.7);
    g.strokeCircle(20, 20, 10);
    g.strokeCircle(20, 20, 4);
    // 十字线
    g.lineStyle(2, 0xff0000, 0.9);
    g.lineBetween(20, 0, 20, 5);
    g.lineBetween(20, 35, 20, 40);
    g.lineBetween(0, 20, 5, 20);
    g.lineBetween(35, 20, 40, 20);
    // 中心点
    g.fillStyle(0xff3333, 0.9);
    g.fillCircle(20, 20, 2);
    g.generateTexture('wpn_sniper', 40, 40);

    // AX50 狙击步枪手持像素画 (80x28) — 红色主题，枪口朝右
    g.clear();
    // --- 枪托底板 (buttpad) ---
    g.fillStyle(0x661111, 1);
    g.fillRect(0, 8, 3, 14);
    g.fillStyle(0x881111, 0.7);
    g.fillRect(1, 9, 1, 12);
    // --- 枪托主体 (stock, 骨架化) ---
    g.fillStyle(0x771111, 1);
    g.fillRect(3, 10, 11, 8);
    g.fillStyle(0x991111, 0.6);
    g.fillRect(4, 11, 9, 2);
    // 枪托镂空 (骨架窗)
    g.fillStyle(0x220000, 1);
    g.fillRect(6, 12, 6, 4);
    // --- 机匣/枪身 (receiver) ---
    g.fillStyle(0x881818, 1);
    g.fillRect(14, 7, 14, 12);
    g.fillStyle(0xaa2222, 0.5);
    g.fillRect(15, 8, 12, 3);
    // --- 手枪握把 (pistol grip) ---
    g.fillStyle(0x771111, 1);
    g.fillRect(19, 19, 6, 9);
    g.fillStyle(0x991515, 0.5);
    g.fillRect(20, 20, 4, 2);
    // --- 弹匣 (magazine) ---
    g.fillStyle(0x661111, 1);
    g.fillRect(15, 17, 7, 5);
    g.fillStyle(0x881515, 0.6);
    g.fillRect(16, 18, 5, 2);
    // --- 瞄准镜 (scope, 机匣上方) ---
    g.fillStyle(0x440000, 1);
    g.fillRect(17, 2, 10, 6);
    g.fillStyle(0x661111, 0.8);
    g.fillRect(18, 3, 8, 4);
    // 镜筒前端 (物镜)
    g.fillStyle(0x550000, 1);
    g.fillRect(26, 1, 5, 8);
    g.fillStyle(0x771414, 0.7);
    g.fillRect(27, 2, 3, 6);
    // 镜筒后端 (目镜)
    g.fillStyle(0x550000, 1);
    g.fillRect(13, 2, 4, 6);
    g.fillStyle(0x771414, 0.7);
    g.fillRect(14, 3, 2, 4);
    // 镜片反光
    g.fillStyle(0xff4444, 0.5);
    g.fillRect(28, 3, 1, 4);
    g.fillStyle(0xff4444, 0.4);
    g.fillRect(14, 4, 1, 3);
    // --- 枪机拉柄 (bolt handle) ---
    g.fillStyle(0x993333, 1);
    g.fillRect(23, 5, 7, 3);
    g.fillStyle(0xbb4444, 0.6);
    g.fillRect(24, 5, 5, 1);
    // --- 长枪管 (long barrel) ---
    g.fillStyle(0x881414, 1);
    g.fillRect(28, 10, 34, 5);
    // 枪管上缘高光
    g.fillStyle(0xaa3333, 0.5);
    g.fillRect(29, 10, 32, 1);
    // 枪管下缘阴影
    g.fillStyle(0x550000, 0.5);
    g.fillRect(29, 14, 32, 1);
    // --- 制退器/枪口装置 (muzzle brake) ---
    g.fillStyle(0x771111, 1);
    g.fillRect(62, 9, 8, 7);
    // 制退器侧孔
    g.fillStyle(0x440000, 1);
    g.fillRect(63, 10, 2, 2);
    g.fillRect(66, 10, 2, 2);
    g.fillRect(63, 13, 2, 2);
    g.fillRect(66, 13, 2, 2);
    // 制退器高光
    g.fillStyle(0x993333, 0.6);
    g.fillRect(62, 9, 8, 1);
    // 枪口 (muzzle tip)
    g.fillStyle(0x550000, 1);
    g.fillRect(70, 10, 2, 5);
    g.fillStyle(0xaa2222, 0.7);
    g.fillRect(70, 10, 2, 1);
    // --- 双脚架 (bipod, 折叠状态) ---
    g.fillStyle(0x661111, 1);
    g.fillRect(42, 15, 2, 6);  // 左腿
    g.fillRect(48, 15, 2, 6);  // 右腿
    g.fillStyle(0x881515, 0.6);
    g.fillRect(43, 15, 1, 3);
    g.fillRect(49, 15, 1, 3);
    // --- 额外细节: 导轨 (rail) ---
    g.fillStyle(0x550000, 0.5);
    g.fillRect(17, 7, 10, 1);
    g.generateTexture('wpn_ax50', 72, 24);

    // 火焰粒子纹理 (16x16 渐变圆，中心亮边缘暗)
    g.clear();
    for (let r = 8; r > 0; r--) {
      const alpha = Math.pow(r / 8, 0.6);
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(8, 8, r);
    }
    g.generateTexture('fx_flame', 16, 16);

    // 火星粒子纹理 (4x4 亮白方块)
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('fx_spark', 4, 4);

    g.destroy();
  }
}