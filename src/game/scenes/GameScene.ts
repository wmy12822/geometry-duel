import Phaser from 'phaser';
import { ASSET_KEYS } from '../assets';
import { regeneratePlayerSkinTexture, loadSkin } from '../skinConfig';
import {
  BULLET_SPEED,
  BULLET_SIZE,
  COLORS,
  ENEMY_DAMAGE,
  ENEMY_HP,
  ENEMY_SIZE,
  ENEMY_SPEED,
  ENEMY_ACCEL,
  ENEMY_DRAG,
  MINION_HP,
  MINION_SPEED,
  MINION_SIZE,
  MINION_DAMAGE,
  MINION_FIRE_RATE,
  MINION_BULLET_SPEED,
  BOSS_BASE_HP,
  BOSS_HP_PER_WAVE,
  BOSS_SPEED_BASE,
  BOSS_SPEED_PER_WAVE,
  MINIONS_PER_WAVE_BASE,
  MINIONS_PER_WAVE_INCREASE,
  FIRE_RATE,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_HITBOX,
  PLAYER_SIZE,
  PLAYER_SPEED,
  PLAYER_ACCEL,
  PLAYER_DRAG,
  DASH_SPEED,
  DASH_DURATION,
  DASH_COOLDOWN,
  ENEMY_FIRE_RATE,
  ENEMY_BULLET_SPEED,
  ENEMY_BULLET_SIZE,
  ENEMY_ULTIMATE_SPEED,
  ENEMY_ULTIMATE_FIRE_RATE,
  ENEMY_ULTIMATE_SIZE,
  ULTIMATE_CHARGE_TIME,
  ULTIMATE_SPEED,
  ULTIMATE_SIZE,
  ULTIMATE_DAMAGE,
  WEAPON_WHEEL_LONG_PRESS,
  WEAPON_WHEEL_RADIUS,
  WEAPON_KIT_DURATION,
  WEAPON_KIT_COOLDOWN,
  CHARGE_KIT_FIRE_RATE,
  CHARGE_KIT_SPREAD,
  SNIPER_KIT_MIN_CHARGE,
  SNIPER_STAGE1_TIME,
  SNIPER_STAGE2_TIME,
  SNIPER_STAGE3_TIME,
  SNIPER_SPEED_MULT_STAGE2,
  SNIPER_SPEED_MULT_STAGE3,
  SNIPER_PREDICT_TIME
} from '../constants';
import { loadKeyLayout, KeyLayoutConfig, loadControlMode, loadPCBindings, PCKeyBindings } from '../keyConfig';

// 游戏主场景：玩家移动、射击、NPC敌人、伤害判定、暂停
export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private enemy!: Phaser.Physics.Arcade.Sprite;
  private bullets!: Phaser.Physics.Arcade.Group;
  private ultimates!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemyUltimates!: Phaser.Physics.Arcade.Group;
  
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private esc!: Phaser.Input.Keyboard.Key;
  private zKey!: Phaser.Input.Keyboard.Key;
  private xKey!: Phaser.Input.Keyboard.Key;
  private cKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  
  private joyStick: any;
  private keyLayout!: KeyLayoutConfig;
  
  // 虚拟按键状态
  private virtualZPointer: Phaser.Input.Pointer | null = null;
  private virtualXPointer: Phaser.Input.Pointer | null = null;
  private virtualCPointer: Phaser.Input.Pointer | null = null;

  private lastFired = 0;
  private lastEnemyFired = 0;
  private lastEnemyUltimateFired = 0;
  private chargeStartTime = 0;
  private isCharging = false;
  private isFiringNormal = false;
  private isDashing = false;
  private lastDashTime = 0;
  private hasPerfectDodged = false;
  private perfectDodgeBuff = false;
  private isCinematicFocus = false;
  private perfectDodgeTimer: Phaser.Time.TimerEvent | null = null;
  private dashTrailTimer: Phaser.Time.TimerEvent | null = null;
  
  // 连续闪避连招机制
  private comboDashCount = 0;
  private comboDashWindowTimer: Phaser.Time.TimerEvent | null = null;
  private comboDashValid = false;

  private startChargingUltimate(time: number) {
    if (this.isCharging) return;
    this.isCharging = true;
    this.chargeStartTime = time;
    this.chargeCompleteSoundPlayed = false;
    this.enemyMarkPendingRemove = false;

    // 狙击套件：消费挂起状态，进入狙击蓄力模式
    if (this.sniperKitPending) {
      this.sniperKitPending = false;
      this.sniperKitActive = true;
      this.sniperKitStage = 0;
      this.sniperSpeedMult = 1.0;
      // 清除待命状态的红色叠加，后续由狙击阶段效果接管
      this.screenOverlayGfx.clear();
    }

    if (this.perfectDodgeBuff && this.enemy && this.enemy.active) {
      this.perfectDodgeBuff = false;
      if (this.perfectDodgeTimer) this.perfectDodgeTimer.remove();
      
      this.isCinematicFocus = true;
      this.time.timeScale = 0.3; // 慢放
      
      // 添加电影级黑边或变焦
      this.tweens.add({
        targets: this.cameras.main,
        zoom: 1.1,
        duration: 300,
        yoyo: true,
        hold: 200,
        ease: 'Cubic.easeOut'
      });

      window.setTimeout(() => {
        if (!this.scene.isActive()) return;
        this.time.timeScale = 1;
        this.isCinematicFocus = false;
      }, 800);
    }
  }
  private chargeUI!: Phaser.GameObjects.Graphics;
  private trajectoryUI!: Phaser.GameObjects.Graphics;
  private enemyTrajectoryUI!: Phaser.GameObjects.Graphics;
  
  private enemyHitEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private playerHitEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private whiteHitEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  
  private hitStopTimer: Phaser.Time.TimerEvent | null = null;
  private lastHitStopTime = 0;

  // 击退状态，防止被 movePlayer/moveEnemy 覆盖加速度
  private isPlayerKnockedBack = false;
  private isEnemyKnockedBack = false;
  
  private enemyHp = ENEMY_HP;
  
  private enemyHpText!: Phaser.GameObjects.Text;
  
  private lastPlayerTrajectoryLength = -999;
  private lastEnemyTrajectoryLength = -999;

  private gameOver = false;
  private isPlayerInvincible = false;
  
  // 击退定时器
  private enemyKnockbackTimer: Phaser.Time.TimerEvent | null = null;
  private playerKnockbackTimer: Phaser.Time.TimerEvent | null = null;

  // 独立瞄准角度（因为玩家需要视觉自转）
  private playerAimAngle = 0;
  
  // 平滑过渡的目标最大速度
  private currentPlayerMaxSpeed = PLAYER_SPEED;

  // 脱战惩罚
  private outOfCombatTimer = 0;
  private isOutOfCombatPenalty = false;
  private lastEnemyDist = 0;
  private lastCameraShakeTime = 0;

  private chargeCompleteSoundPlayed = false;

  // 标记状态
  private isEnemyMarked: boolean = false;
  private enemyHitMarkTimer: Phaser.Time.TimerEvent | null = null;
  private enemyMarkPendingRemove: boolean = false;
  private isPlayerAimLocked: boolean = false;

  private isPlayerMarked: boolean = false;
  private playerHitMarkTimer: Phaser.Time.TimerEvent | null = null;
  private playerMarkPendingRemove: boolean = false;
  private isEnemyAimLocked: boolean = false;

  // 敌人冲刺/闪避状态
  private isEnemyDashing = false;
  private lastEnemyDashTime = 0;
  private hasEnemyPerfectDodged = false;
  private enemyPerfectDodgeBuff = false;
  private enemyPerfectDodgeTimer: Phaser.Time.TimerEvent | null = null;
  private enemyDashTrailTimer: Phaser.Time.TimerEvent | null = null;

  // 敌人蓄力状态
  private isEnemyChargingUltimate = false;
  private enemyChargeStartTime = 0;
  private enemyAimAngle = 0;
  private enemyChargeCompleteSoundPlayed = false;

  // 弹反状态
  private isParrying = false;
  private parryStartTime = 0;
  private parryCooldown = 0;
  private parrySuccess = false;
  private vKey!: Phaser.Input.Keyboard.Key;
  private virtualVPointer: Phaser.Input.Pointer | null = null;
  private isNormalAttackDisabled = false;
  private normalAttackDisableEndTime = 0;
  private parryUI!: Phaser.GameObjects.Graphics;
  
  // 弹反弧线视觉效果
  private parryArcGraphics!: Phaser.GameObjects.Graphics;
  private parryArcState = { startProgress: 0, endProgress: 0, angle: 0, visible: false };

  private bgGrid!: Phaser.GameObjects.TileSprite;
  private minimapGraphics!: Phaser.GameObjects.Graphics;

  // 武器套件系统
  private weaponBtn!: Phaser.GameObjects.Sprite;
  private weaponBtnGfx!: Phaser.GameObjects.Graphics;
  private weaponWheelGfx!: Phaser.GameObjects.Graphics;
  private weaponWheelIcons: Phaser.GameObjects.Sprite[] = [];
  private weaponWheelLabels: Phaser.GameObjects.Text[] = [];
  private weaponWheelVisible = false;
  private weaponBtnPressed = false;
  private weaponBtnPressTime = 0;
  private weaponBtnPointer: Phaser.Input.Pointer | null = null;
  private weaponHoveredSlot = -1;
  private activeKit: string | null = null;
  private kitEffectEndTime = 0;
  private kitCooldownEnd = 0;
  private weaponCdText!: Phaser.GameObjects.Text;
  private smgSprite!: Phaser.GameObjects.Sprite;
  private sniperSprite!: Phaser.GameObjects.Sprite; // AX50 狙击步枪手持
  private screenEdgeGfx!: Phaser.GameObjects.Graphics;
  private screenOverlayGfx!: Phaser.GameObjects.Graphics;
  private flameEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  // 狙击套件状态
  private sniperKitPending = false;
  private sniperKitActive = false;
  private sniperKitStage = 0;
  private sniperSpeedMult = 1.0;
  private sniperPredictGfx!: Phaser.GameObjects.Graphics;
  private sniperEnemyHighlightGfx!: Phaser.GameObjects.Graphics;
  private currentSniperTimeScale = 1.0; // 平滑过渡的当前 timeScale
  private sniperFreezeUntil = 0; // 发射后保持敌人冻结直到此时间戳
  private thermalScopeSprite!: Phaser.GameObjects.Sprite; // 热成像瞄具遮罩
  private enemyGlowSprite!: Phaser.GameObjects.Sprite;   // 敌人热成像高亮光晕
  private sniperStage2Alpha = 0; // 二段暗角过渡 alpha（0→1 tween）
  private sniperStage3Alpha = 0; // 三段热成像过渡 alpha（0→1 tween）

  private readonly WEAPON_KITS = [
    { key: 'charge', name: '冲锋', icon: 'wpn_charge', color: 0xffcc00, desc: '攻速↑移速↑ 散布↑' },
    { key: 'sniper', name: '狙击', icon: 'wpn_sniper', color: 0xff0000, desc: '蓄力→时停→预测锁定' },
  ];

  // 敌人弹反状态
  private isEnemyParrying = false;
  private enemyParryStartTime = 0;
  private enemyParrySuccess = false;
  private enemyParryCooldown = 0;
  private isEnemyNormalAttackDisabled = false;
  private enemyNormalAttackDisableEndTime = 0;
  private enemyParryArcState = { startProgress: 0, endProgress: 0, angle: 0, visible: false };

  // 敌人近战状态
  private isEnemyMeleeAttacking = false;
  private lastEnemyMeleeTime = 0;
  private enemyMeleeCooldown = 3000;
  
  // 拼刀时间戳记录
  private playerMeleeHitTime = 0;
  private enemyMeleeHitTime = 0;
  
  // 拼刀后特殊状态标记
  private playerNextMeleeWillStun = false;
  private enemyNextMeleeWillStun = false;

  private playerBulletColor = 0x00ff88; // 默认与 COLORS.player 一致，在 create() 中初始化

  private diffHpMult = 1.0;
  private diffSpeedMult = 1.0;
  private diffFireRateMult = 1.0;
  private diffEnableEnemySkills = false; // 是否开启敌人AI高级技能
  // 修改器
  private modRapidFire = false; // 连发：取消普攻射击间隔
  private modSuperAim = false; // 超级自瞄：普攻必中
  private modInfiniteParry = false; // 无限弹反：无冷却
  private modPerfectParry = false; // 无限完美弹反：必定触发反弹
  // 模式
  private gameMode: 'standard' | 'endless' | 'test' = 'standard';
  // 操控模式
  private controlMode: string = 'mobile';
  // 无尽模式
  private waveNumber = 0;
  private waveState: 'fighting' | 'skillSelect' = 'fighting';
  private minions!: Phaser.Physics.Arcade.Group;
  private waveHUD!: Phaser.GameObjects.Text;
  private minionHpTexts: Phaser.GameObjects.Text[] = [];
  // 技能选择UI
  private skillPanelObjects: Phaser.GameObjects.GameObject[] = [];
  private chosenSkillKey: string | null = null;
  // 无尽模式技能加成累积
  private skillBuffs: Record<string, number> = { speed: 0, fireRate: 0, dashCd: 0, parryCd: 0 };
  // BOSS 类型轮换
  private bossType: 'dodge' | 'parry' | 'split' = 'dodge';
  private bossTypeIndex = 0;
  private splitBossTimer: Phaser.Time.TimerEvent | null = null;
  private duplicateBosses: Phaser.Physics.Arcade.Sprite[] = [];
  private lastMinionFired = 0;

  constructor() {
    super('GameScene');
  }

  init(data: any) {
    if (data && data.difficulty) {
      this.diffHpMult = data.difficulty.hpMult ?? 1.0;
      this.diffSpeedMult = data.difficulty.speedMult ?? 1.0;
      this.diffFireRateMult = data.difficulty.fireRateMult ?? 1.0;
      this.diffEnableEnemySkills = data.difficulty.enableEnemySkills ?? false;
    } else {
      this.diffHpMult = 1.0;
      this.diffSpeedMult = 1.0;
      this.diffFireRateMult = 1.0;
      this.diffEnableEnemySkills = false;
    }
    // 修改器（来自主界面修改器开关）
    if (data && data.modifiers) {
      this.modRapidFire = !!data.modifiers.连发;
      this.modSuperAim = !!data.modifiers.自瞄;
      this.modInfiniteParry = !!data.modifiers.无限弹反;
      this.modPerfectParry = !!data.modifiers.无限完美弹反;
    } else {
      this.modRapidFire = false;
      this.modSuperAim = false;
      this.modInfiniteParry = false;
      this.modPerfectParry = false;
    }
    // 模式
    this.gameMode = (data && data.mode) || 'standard';
    if (this.gameMode === 'endless') {
      this.waveNumber = 0;
      this.waveState = 'fighting';
      this.skillBuffs = { speed: 0, fireRate: 0, dashCd: 0, parryCd: 0 };
      this.bossTypeIndex = 0;
      this.bossType = 'dodge';
      this.duplicateBosses = [];
      if (this.splitBossTimer) { this.splitBossTimer.remove(); this.splitBossTimer = null; }
      // 彻底重置敌人技能状态，防止跨局残留
      this.isEnemyParrying = false;
      this.isEnemyDashing = false;
      this.isEnemyMeleeAttacking = false;
      this.enemyParryCooldown = 0;
      this.lastEnemyDashTime = 0;
      this.lastEnemyMeleeTime = 0;
      this.diffEnableEnemySkills = false;
    }
  }

  create() {
    // 物理世界边界扩展到极大范围，防止子弹/弹丸飞出屏幕边界后被回收
    this.physics.world.setBounds(-5000, -5000, 11000, 11000);

    // 屏蔽浏览器右键菜单
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // 鼠标状态跟踪（简单可靠）
    const mouseState = { left: false, right: false, _wasLeft: false, _wasRight: false };
    this.game.canvas.addEventListener('mousedown', (e: Event) => {
      const me = e as MouseEvent;
      if (me.button === 0) mouseState.left = true;
      if (me.button === 2) {
        mouseState.right = true;
        e.preventDefault();
      }
    });
    this.game.canvas.addEventListener('mouseup', (e: Event) => {
      const me = e as MouseEvent;
      if (me.button === 0) mouseState.left = false;
      if (me.button === 2) mouseState.right = false;
    });
    // 当鼠标离开画布时，重置所有按键状态，防止卡键
    this.game.canvas.addEventListener('mouseleave', () => {
      mouseState.left = false;
      mouseState.right = false;
    });
    // 阻止浏览器右键拖拽产生的 dragstart / selectstart 事件
    this.game.canvas.addEventListener('dragstart', (e: Event) => e.preventDefault());
    this.game.canvas.addEventListener('selectstart', (e: Event) => e.preventDefault());
    // ponytail: 阻止浏览器触控手势干扰游戏操作
    this.game.canvas.addEventListener('touchstart', (e: Event) => e.preventDefault(), { passive: false });
    this.game.canvas.addEventListener('gesturestart', (e: Event) => e.preventDefault());
    (this as any)._mouseState = mouseState;

    const skinData = loadSkin();
    this.cameras.main.setBackgroundColor(skinData.bgColor ?? 0x1a1a1a);
    this.playerBulletColor = skinData.bulletColor ?? 0x00ff88;
    this.gameOver = false;
    this.isPlayerInvincible = false;
    // 武器套件状态重置
    this.weaponBtnPressed = false;
    this.weaponBtnPointer = null;
    this.weaponWheelVisible = false;
    this.weaponHoveredSlot = -1;
    this.activeKit = null;
    this.kitEffectEndTime = 0;
    this.kitCooldownEnd = 0;
    this.sniperKitPending = false;
    this.sniperKitActive = false;
    this.sniperKitStage = 0;
    this.sniperSpeedMult = 1.0;
    this.currentSniperTimeScale = 1.0;

    // 生成大招拖尾粒子纹理（中心亮，边缘暗且带有透明度过渡，能更好地受 tint 影响）
    const trailGraphics = this.add.graphics();
    // 绘制一个渐变圆球，外圈透明度衰减，留有足够大的实心部分，便于在白色背景下依然可见（若是有色）
    for (let r = 16; r > 0; r--) {
      // 增加中心的不透明度和边缘颜色的厚度
      const alpha = Math.pow(r / 16, 0.5); 
      trailGraphics.fillStyle(0xffffff, alpha);
      trailGraphics.fillCircle(16, 16, r);
    }
    trailGraphics.generateTexture('ult_trail', 32, 32);
    trailGraphics.destroy();

    // 生成热成像瞄具遮罩纹理（黑底+椭圆透明窗+羽化边缘）
    this.createThermalScopeTexture();
    // 生成敌人热成像光晕纹理（白色软圆）
    this.createEnemyGlowTexture();

    // 热成像遮罩精灵（初始隐藏）
    this.thermalScopeSprite = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'thermal_scope_tex')
      .setDepth(199).setScrollFactor(0).setVisible(false);
    // 敌人光晕精灵（初始隐藏，置于敌人下层）
    this.enemyGlowSprite = this.add.sprite(0, 0, 'enemy_glow_tex')
      .setDepth(1.5).setVisible(false).setAlpha(0.8).setScale(2.5);
    this.enemyHp = ENEMY_HP * this.diffHpMult;
    this.lastFired = 0;
    this.lastEnemyFired = 0;
    this.isCharging = false;
    this.isFiringNormal = false;
    this.isDashing = false;
    this.lastDashTime = 0;
    this.chargeStartTime = 0;
    this.virtualZPointer = null;
    this.virtualXPointer = null;
    this.virtualCPointer = null;
    this.playerAimAngle = 0;
    this.currentPlayerMaxSpeed = PLAYER_SPEED;
    this.outOfCombatTimer = 0;
    this.isOutOfCombatPenalty = false;
    this.lastCameraShakeTime = 0;
    this.chargeCompleteSoundPlayed = false;
    this.isEnemyMarked = false;
    this.enemyMarkPendingRemove = false;
    this.isPlayerAimLocked = false;
    
    this.isPlayerMarked = false;
    this.playerMarkPendingRemove = false;
    this.isEnemyAimLocked = false;
    
    this.isEnemyChargingUltimate = false;
    this.enemyChargeStartTime = 0;
    this.enemyAimAngle = 0;
    this.enemyChargeCompleteSoundPlayed = false;

    this.bgGrid = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'grid_tex')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-1);

    // 移除之前的 redGlowEmitter
    // 小地图
    this.minimapGraphics = this.add.graphics().setScrollFactor(0).setDepth(100);

    // 玩家：每局开始前刷新自定义皮肤纹理（覆盖默认三角形），确保编辑保存后立即生效
    regeneratePlayerSkinTexture(this, ASSET_KEYS.player, PLAYER_SIZE);
    this.player = this.physics.add.sprite(160, GAME_HEIGHT / 2, ASSET_KEYS.player);
    this.player.setDepth(2);
    this.player.body!.setSize(PLAYER_HITBOX, PLAYER_HITBOX).setOffset(
      (PLAYER_SIZE - PLAYER_HITBOX) / 2,
      (PLAYER_SIZE - PLAYER_HITBOX) / 2,
    );
    // 配置顺滑移动物理参数
    this.player.setDrag(PLAYER_DRAG, PLAYER_DRAG);
    this.player.setMaxVelocity(PLAYER_SPEED, PLAYER_SPEED);

    // 开局保护：给予玩家 1.5 秒无敌时间，并附带闪烁视觉效果
    this.isPlayerInvincible = true;
    const spawnInvincibleTween = this.tweens.add({
      targets: this.player,
      alpha: 0.2,
      duration: 150,
      yoyo: true,
      repeat: -1
    });
    this.time.delayedCall(1500, () => {
      this.isPlayerInvincible = false;
      spawnInvincibleTween.stop();
      if (this.player && this.player.active) {
        this.player.setAlpha(1);
      }
    });

    // 敌人 NPC / 无尽模式小兵组
    if (this.gameMode === 'endless') {
      this.minions = this.physics.add.group();
      // 波次 HUD
      this.waveHUD = this.add.text(GAME_WIDTH - 10, 50, '', {
        fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '22px', color: '#ff9933', align: 'right'
      }).setOrigin(1, 0.5).setDepth(50).setScrollFactor(0);
      this.updateWaveHUD();
      // 技能面板容器（初始隐藏）
      // 技能面板将直接加到场景（不用容器）
      // BOSS 先创建但隐藏，第一波开始再生成
      this.enemy = this.physics.add.sprite(-200, -200, ASSET_KEYS.enemy);
      this.enemy.setVisible(false).setActive(false);
    } else {
      this.enemy = this.physics.add.sprite(GAME_WIDTH - 200, GAME_HEIGHT / 2, ASSET_KEYS.enemy);
    }
    this.enemy.setDepth(2);
    this.enemy.body!.setSize(ENEMY_SIZE, ENEMY_SIZE).setOffset(0, 0);
    // 配置敌人物理滑行参数
    this.enemy.setDrag(ENEMY_DRAG, ENEMY_DRAG);
    this.enemy.setMaxVelocity(ENEMY_SPEED * this.diffSpeedMult, ENEMY_SPEED * this.diffSpeedMult);
    this.currentEnemyMaxSpeed = ENEMY_SPEED * this.diffSpeedMult;

    this.lastEnemyDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);

    // 子弹池
    this.bullets = this.physics.add.group({
      maxSize: 200,
      runChildUpdate: true,
      defaultKey: ASSET_KEYS.bullet,
    });
    
    // 必杀技池
    this.ultimates = this.physics.add.group({
      maxSize: 20,
      runChildUpdate: true,
      defaultKey: ASSET_KEYS.ultimate,
    });
    
    // 敌方子弹池
    this.enemyBullets = this.physics.add.group({
      maxSize: 200,
      runChildUpdate: true,
      defaultKey: ASSET_KEYS.enemy_bullet,
    });
    
    // 敌方必杀技池
    this.enemyUltimates = this.physics.add.group({
      maxSize: 20,
      runChildUpdate: true,
      defaultKey: ASSET_KEYS.enemy_bullet, // 因为没有提供特定美术资源，直接用enemy_bullet复用放大
    });

    // 碰撞检测 - 标准模式：与单个 enemy；无尽模式：与 minions 组 + boss
    if (this.gameMode === 'endless') {
      this.physics.add.overlap(this.bullets, this.minions, this.onBulletHitMinion, undefined, this);
      this.physics.add.overlap(this.bullets, this.enemy, this.onBulletHitEnemy, undefined, this);
      this.physics.add.overlap(this.ultimates, this.minions, this.onUltimateHitMinion, undefined, this);
      this.physics.add.overlap(this.ultimates, this.enemy, this.onUltimateHitEnemy, undefined, this);
      this.physics.add.overlap(this.enemyBullets, this.player, this.onEnemyBulletHitPlayer, undefined, this);
      this.physics.add.overlap(this.enemyUltimates, this.player, this.onEnemyUltimateHitPlayer, undefined, this);
      this.physics.add.overlap(this.player, this.minions, this.onMinionHitPlayer, undefined, this);
      this.physics.add.overlap(this.player, this.enemy, this.onEnemyHitPlayer, undefined, this);
    } else {
      this.physics.add.overlap(this.bullets, this.enemy, this.onBulletHitEnemy, undefined, this);
      this.physics.add.overlap(this.ultimates, this.enemy, this.onUltimateHitEnemy, undefined, this);
      this.physics.add.overlap(this.enemyBullets, this.player, this.onEnemyBulletHitPlayer, undefined, this);
      this.physics.add.overlap(this.enemyUltimates, this.player, this.onEnemyUltimateHitPlayer, undefined, this);
      this.physics.add.overlap(this.player, this.enemy, this.onEnemyHitPlayer, undefined, this);
    }
    
    // 子弹对撞
    this.physics.add.overlap(this.bullets, this.enemyBullets, this.onBulletClash, undefined, this); // 普攻互相抵消
    this.physics.add.overlap(this.ultimates, this.enemyUltimates, this.onUltimateClash, undefined, this); // 必杀互相抵消
    this.physics.add.overlap(this.ultimates, this.enemyBullets, this.onUltimatePenetrateClash, undefined, this); // 玩家必杀抵消敌人普攻
    this.physics.add.overlap(this.enemyUltimates, this.bullets, this.onEnemyUltimatePenetrateClash, undefined, this); // 敌人必杀抵消玩家普攻

    // 输入
    if (this.input.keyboard) {
      const kb = this.input.keyboard;

      // 检查是否使用 PC 自定义绑定
      this.controlMode = loadControlMode();
      if (this.controlMode === 'pc') {
        const bindings = loadPCBindings();
        const k = (name: string) => this.keyNameToCode(name);
        this.wasd = {
          W: kb.addKey(k(bindings.moveUp)),
          A: kb.addKey(k(bindings.moveLeft)),
          S: kb.addKey(k(bindings.moveDown)),
          D: kb.addKey(k(bindings.moveRight)),
        };
        this.zKey = kb.addKey(k(bindings.attack));
        this.xKey = kb.addKey(k(bindings.ultimate));
        this.cKey = kb.addKey(k(bindings.dash));
        this.vKey = kb.addKey(k(bindings.parry));
        this.spaceKey = kb.addKey(k(bindings.dash)); // dash 也可用 cKey
        this.esc = kb.addKey(k(bindings.pause));
        this.cursors = this.input.keyboard.createCursorKeys(); // 保留备用
      } else {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = {
          W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
          A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
          S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
          D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
        this.esc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.zKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        this.xKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.cKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.C);
        this.vKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.V);
        this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      }
    }

    // 虚拟摇杆 - 使用键位配置的位置与大小
    this.keyLayout = loadKeyLayout();
    const kl = this.keyLayout;
    this.joyStick = (this.plugins.get('rexVirtualJoystick') as any).add(this, {
      x: kl.joystick.x,
      y: kl.joystick.y,
      radius: kl.joystick.size / 2,
      base: this.add.circle(0, 0, kl.joystick.size / 2, 0x000000, kl.joystick.alpha).setDepth(100).setScrollFactor(0),
      thumb: this.add.circle(0, 0, kl.joystick.size / 6, 0x000000, Math.min(kl.joystick.alpha + 0.2, 1)).setDepth(100).setScrollFactor(0),
      dir: '8dir',
      forceMin: 10,
    });
    
    // 右下角虚拟攻击按键 Z、X、C - 使用键位配置
    this.createVirtualButtons(kl);

    // 武器套件按钮
    this.createWeaponButton();
    this.flameEmitters = [];
    this.initFlameParticles();

    // 移除点击空白射击，只保留移动或瞄准。因为移动有摇杆或WASD，空白处可以用来改变玩家朝向。
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // 鼠标移动时如果在按键，不干涉。这里只用于非虚拟按钮的瞄准(PC鼠标)
    });
    
    // 由于我们在 handleGlobalPointerUp 里已经处理了这些逻辑，这里的冗余且不带 setXActive/etc 的处理可以干掉
    // 避免重复监听或者冲突
    // this.input.on('pointerup', ...) 已经被干掉

    // 蓄力 UI 与弹道轨迹
    this.chargeUI = this.add.graphics().setDepth(5);
    this.trajectoryUI = this.add.graphics().setDepth(4);
    this.enemyTrajectoryUI = this.add.graphics().setDepth(4);
    
    // 弹反冷却 UI
    this.parryUI = this.add.graphics().setDepth(6);

    // 狙击套件预测 UI 和敌人高亮
    this.sniperPredictGfx = this.add.graphics().setDepth(5).setScrollFactor(0);
    this.sniperEnemyHighlightGfx = this.add.graphics().setDepth(3);
    
    // 弹反弧线特效绘制层
    this.parryArcGraphics = this.add.graphics().setDepth(3.5);

    // 顶部HUD
    this.createHUD();
    
    // 粒子系统
    this.enemyHitEmitter = this.add.particles(0, 0, ASSET_KEYS.pixel, {
      tint: COLORS.enemy,
      speed: { min: 200, max: 800 },
      scale: { start: 2, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 200,
      emitting: false,
    });
    this.enemyHitEmitter.setDepth(5);

    this.playerHitEmitter = this.add.particles(0, 0, ASSET_KEYS.pixel, {
      tint: COLORS.player,
      speed: { min: 200, max: 800 },
      scale: { start: 2, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 200,
      emitting: false,
    });
    this.playerHitEmitter.setDepth(5);
    
    this.whiteHitEmitter = this.add.particles(0, 0, ASSET_KEYS.pixel, {
      tint: COLORS.white,
      speed: { min: 300, max: 900 },
      scale: { start: 2, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 150,
      emitting: false,
    });
    this.whiteHitEmitter.setDepth(6);

    // 无尽模式：启动第一波
    if (this.gameMode === 'endless') {
      this.startWave();
    }
  }
  
  private createVirtualButtons(kl: ReturnType<typeof loadKeyLayout>) {
    const handleGlobalPointerUp = (pointer: Phaser.Input.Pointer) => {
      // 武器轮盘释放
      if (this.weaponBtnPointer === pointer && this.weaponWheelVisible) {
        if (this.weaponHoveredSlot >= 0) {
          this.activateWeaponKit(this.WEAPON_KITS[this.weaponHoveredSlot].key);
        }
        this.hideWeaponWheel();
        this.weaponBtnPressed = false;
        this.weaponBtnPointer = null;
        return;
      }
      if (this.weaponBtnPointer === pointer) {
        this.weaponBtnPressed = false;
        this.weaponBtnPointer = null;
        return;
      }
      if (this.virtualZPointer === pointer) {
        this.virtualZPointer = null;
        this.isFiringNormal = false;
        setZActive(false);
      }
      if (this.virtualXPointer === pointer) {
        this.virtualXPointer = null;
        if (this.isCharging) {
          const chargeDuration = this.time.now - this.chargeStartTime;
          const canFire = this.sniperKitActive
            ? chargeDuration >= SNIPER_KIT_MIN_CHARGE
            : chargeDuration >= ULTIMATE_CHARGE_TIME;
          // 先解冻再发射，防止 timeScale 跳变导致子弹隧穿
          const savedMult = this.sniperSpeedMult;
          if (this.sniperKitActive && canFire) this.cleanupSniperKit();
          if (canFire) this.fireUltimate(savedMult);
          this.isCharging = false;
          this.chargeUI.clear();
          this.trajectoryUI.clear();
          this.sniperPredictGfx.clear();
          this.sniperEnemyHighlightGfx.clear();
        }
        setXActive(false);
      }
      if (this.virtualCPointer === pointer) {
        this.virtualCPointer = null;
        setCActive(false);
      }
      if (this.virtualVPointer === pointer) {
        this.virtualVPointer = null;
        setVActive(false);
      }
    };
    this.input.on('pointerup', handleGlobalPointerUp);
    this.input.on('pointerupoutside', handleGlobalPointerUp);

    // Z 键
    const zBtn = this.add.rectangle(kl.z.x, kl.z.y, kl.z.size, kl.z.size, COLORS.bg, kl.z.alpha).setDepth(100).setInteractive({ draggable: true }).setScrollFactor(0);
    zBtn.setStrokeStyle(4, COLORS.black);
    const zText = this.add.text(zBtn.x, zBtn.y, 'Z', { fontFamily: 'monospace', fontSize: `${Math.max(16, kl.z.size / 2)}px`, color: '#000000', fontStyle: 'bold' }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
    
    const setZActive = (active: boolean) => {
      if (active) {
        zBtn.setFillStyle(COLORS.black); zText.setColor('#FFFFFF');
      } else {
        zBtn.setFillStyle(COLORS.bg); zText.setColor('#000000');
      }
    };
    
    zBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.virtualZPointer = pointer;
      this.isFiringNormal = true;
      setZActive(true);
    });
    // ponytail: pointerout 不再取消激活 — 拖出按钮区域瞄准时应保持视觉状态
    // 仅在 handleGlobalPointerUp 中真正取消
    zBtn.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        this.virtualZPointer = pointer;
        this.isFiringNormal = true;
        setZActive(true);
      }
    });

    // X 键
    const xBtn = this.add.rectangle(kl.x.x, kl.x.y, kl.x.size, kl.x.size, COLORS.bg, kl.x.alpha).setDepth(100).setInteractive({ draggable: true }).setScrollFactor(0);
    xBtn.setStrokeStyle(4, COLORS.black);
    const xText = this.add.text(xBtn.x, xBtn.y, 'X', { fontFamily: 'monospace', fontSize: `${Math.max(16, kl.x.size / 2)}px`, color: '#000000', fontStyle: 'bold' }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
    
    const setXActive = (active: boolean) => {
      if (active) {
        xBtn.setFillStyle(COLORS.black); xText.setColor('#FFFFFF');
      } else {
        xBtn.setFillStyle(COLORS.bg); xText.setColor('#000000');
      }
    };
    
    xBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.virtualXPointer = pointer;
      this.startChargingUltimate(this.time.now);
      setXActive(true);
    });
    // ponytail: pointerout 不再取消激活 — 拖出按钮区域瞄准时保持蓄力视觉
    xBtn.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        this.virtualXPointer = pointer;
        this.startChargingUltimate(this.time.now);
        setXActive(true);
      }
    });

    // C 键 (闪避) - 放置在 Z 键上方
    const cBtn = this.add.rectangle(kl.c.x, kl.c.y, kl.c.size, kl.c.size, COLORS.bg, kl.c.alpha).setDepth(100).setInteractive({ draggable: true }).setScrollFactor(0);
    cBtn.setStrokeStyle(4, COLORS.black);
    const cText = this.add.text(cBtn.x, cBtn.y, 'C', { fontFamily: 'monospace', fontSize: `${Math.max(16, kl.c.size / 2)}px`, color: '#000000', fontStyle: 'bold' }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
    
    const setCActive = (active: boolean) => {
      if (active) {
        cBtn.setFillStyle(COLORS.black); cText.setColor('#FFFFFF');
      } else {
        cBtn.setFillStyle(COLORS.bg); cText.setColor('#000000');
      }
    };
    
    cBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.virtualCPointer = pointer;
      this.dash();
      setCActive(true);
    });
    // 只在指针移出/抬起且与自己匹配时取消状态
    cBtn.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.virtualCPointer === pointer) {
        this.virtualCPointer = null;
        setCActive(false);
      }
    });
    cBtn.on('pointerout', (pointer: Phaser.Input.Pointer) => {
      if (this.virtualCPointer === pointer) {
        this.virtualCPointer = null;
        setCActive(false);
      }
    });
    cBtn.on('pointerover', (pointer: Phaser.Input.Pointer) => { 
      if (pointer.isDown) {
        this.virtualCPointer = pointer;
        setCActive(true);
      }
    });

    // V 键 (近战/弹反)
    const vBtn = this.add.rectangle(kl.v.x, kl.v.y, kl.v.size, kl.v.size, COLORS.bg, kl.v.alpha).setDepth(100).setInteractive({ draggable: true }).setScrollFactor(0);
    vBtn.setStrokeStyle(4, COLORS.black);
    const vText = this.add.text(vBtn.x, vBtn.y, '近战\n/弹反', { fontFamily: 'monospace', fontSize: `${Math.max(12, kl.v.size / 3.5)}px`, color: '#000000', fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
    
    const setVActive = (active: boolean) => {
      if (active) {
        vBtn.setFillStyle(COLORS.black); vText.setColor('#FFFFFF');
      } else {
        vBtn.setFillStyle(COLORS.bg); vText.setColor('#000000');
      }
    };
    
    vBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.virtualVPointer = pointer;
      this.startParry();
      setVActive(true);
    });
    vBtn.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.virtualVPointer === pointer) {
        this.virtualVPointer = null;
        setVActive(false);
      }
    });
    vBtn.on('pointerout', (pointer: Phaser.Input.Pointer) => {
      if (this.virtualVPointer === pointer) {
        this.virtualVPointer = null;
        setVActive(false);
      }
    });
    vBtn.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        this.virtualVPointer = pointer;
        setVActive(true);
      }
    });
  }

  private get weaponBtnX() { return this.keyLayout.w.x; }
  private get weaponBtnY() { return this.keyLayout.w.y; }

  private createWeaponButton() {
    const bx = this.weaponBtnX, by = this.weaponBtnY;

    // 按钮背景光晕
    this.weaponBtnGfx = this.add.graphics().setDepth(100).setScrollFactor(0);
    this.drawWeaponBtnBg(1);

    // 按钮精灵
    this.weaponBtn = this.add.sprite(bx, by, 'wpn_btn')
      .setDepth(101).setScrollFactor(0).setInteractive({ draggable: true });

    // 轮盘绘制层
    this.weaponWheelGfx = this.add.graphics().setDepth(102).setScrollFactor(0).setVisible(false);

    // 屏幕边缘火焰特效层
    this.screenEdgeGfx = this.add.graphics().setDepth(198).setScrollFactor(0);
    this.screenOverlayGfx = this.add.graphics().setDepth(0.5).setScrollFactor(0);

    // SMG 手持精灵（隐藏）
    this.smgSprite = this.add.sprite(0, 0, 'wpn_charge')
      .setDepth(3).setVisible(false).setScale(1.5);

    // AX50 狙击步枪手持精灵（隐藏）
    this.sniperSprite = this.add.sprite(0, 0, 'wpn_ax50')
      .setDepth(3).setVisible(false).setScale(1.6);

    // 冷却文本
    this.weaponCdText = this.add.text(bx, by + 32, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffcc00', align: 'center'
    }).setOrigin(0.5).setDepth(101).setScrollFactor(0);

    // 长按触发轮盘
    this.weaponBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.weaponBtnPressed = true;
      this.weaponBtnPressTime = this.time.now;
      this.weaponBtnPointer = pointer;
    });

    this.weaponBtn.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && !this.weaponBtnPressed) {
        this.weaponBtnPressed = true;
        this.weaponBtnPressTime = this.time.now;
        this.weaponBtnPointer = pointer;
      }
    });
  }

  private drawWeaponBtnBg(brightness: number) {
    this.weaponBtnGfx.clear();
    const a = Math.round(80 * brightness);
    this.weaponBtnGfx.fillStyle(0x666666, a / 255);
    this.weaponBtnGfx.fillCircle(this.weaponBtnX, this.weaponBtnY, 28);
  }

  private showWeaponWheel() {
    if (this.weaponWheelVisible) return;
    this.weaponWheelVisible = true;
    this.weaponWheelGfx.setVisible(true);
    this.drawWeaponBtnBg(2);

    const cx = this.weaponBtnX, cy = this.weaponBtnY;
    const kitCount = this.WEAPON_KITS.length;

    // 清除旧的轮盘图标和标签
    this.weaponWheelIcons.forEach(s => s.destroy());
    this.weaponWheelLabels.forEach(t => t.destroy());
    this.weaponWheelIcons = [];
    this.weaponWheelLabels = [];

    this.redrawWheelWithHighlight(-1);

    // 放置图标和标签
    const sliceAngle = kitCount === 1 ? Math.PI * 2 : (Math.PI * 2) / kitCount;
    for (let i = 0; i < kitCount; i++) {
      const midAngle = i * sliceAngle - Math.PI / 2 + sliceAngle / 2;
      const kit = this.WEAPON_KITS[i];
      const iconDist = WEAPON_WHEEL_RADIUS * 0.6;
      const ix = cx + Math.cos(midAngle) * iconDist;
      const iy = cy + Math.sin(midAngle) * iconDist;
      const icon = this.add.sprite(ix, iy, kit.icon)
        .setDepth(103).setScrollFactor(0).setScale(1.2);
      this.weaponWheelIcons.push(icon);

      const labelDist = WEAPON_WHEEL_RADIUS * 0.3;
      const lx = cx + Math.cos(midAngle) * labelDist;
      const ly = cy + Math.sin(midAngle) * labelDist - 18;
      const label = this.add.text(lx, ly, kit.name, {
        fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(103).setScrollFactor(0);
      this.weaponWheelLabels.push(label);
    }
  }

  private hideWeaponWheel() {
    this.weaponWheelVisible = false;
    this.weaponWheelGfx.clear();
    this.weaponWheelGfx.setVisible(false);
    this.weaponWheelIcons.forEach(s => s.destroy());
    this.weaponWheelIcons = [];
    this.weaponWheelLabels.forEach(t => t.destroy());
    this.weaponWheelLabels = [];
    this.weaponHoveredSlot = -1;
    this.drawWeaponBtnBg(1);
  }

  private getWheelHoveredSlot(px: number, py: number): number {
    const cx = this.weaponBtnX, cy = this.weaponBtnY;
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // 需要在一定距离外才算选中
    if (dist < 25 || dist > WEAPON_WHEEL_RADIUS + 40) return -1;

    let angle = Math.atan2(dy, dx) + Math.PI / 2; // 从顶部开始
    if (angle < 0) angle += Math.PI * 2;
    const sliceAngle = (Math.PI * 2) / this.WEAPON_KITS.length;
    return Math.floor(angle / sliceAngle);
  }

  private activateWeaponKit(key: string) {
    const kit = this.WEAPON_KITS.find(k => k.key === key);
    if (!kit) return;

    if (this.time.now < this.kitCooldownEnd) return;

    // 狙击套件：挂起，等下次大招蓄力触发
    if (key === 'sniper') {
      this.sniperKitPending = true;
      this.activeKit = 'sniper';
      this.cameras.main.flash(200, 255, 0, 0);
      const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50,
        '【狙击套件】待命中 — 下次大招蓄力触发', {
          fontFamily: 'monospace', fontSize: '18px', color: '#ff0000', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(200).setScrollFactor(0);
      this.tweens.add({
        targets: t, alpha: 0, y: t.y - 40, duration: 2000,
        onComplete: () => t.destroy()
      });
      return;
    }

    // 冲锋等持续型套件
    this.activeKit = key;
    this.kitEffectEndTime = this.time.now + WEAPON_KIT_DURATION;
    this.kitCooldownEnd = this.time.now + WEAPON_KIT_DURATION + WEAPON_KIT_COOLDOWN;

    this.cameras.main.flash(200, 255, 200, 0);

    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50,
      `【${kit.name}套件】已激活！`, {
        fontFamily: 'monospace', fontSize: '20px', color: '#ffcc00', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(200).setScrollFactor(0);

    this.tweens.add({
      targets: t, alpha: 0, y: t.y - 40, duration: 1500,
      onComplete: () => t.destroy()
    });
  }

  private updateWeaponSystem(time: number) {
    // 长按检测
    if (this.weaponBtnPressed && !this.weaponWheelVisible) {
      if (time - this.weaponBtnPressTime >= WEAPON_WHEEL_LONG_PRESS) {
        // 检查冷却
        if (time < this.kitCooldownEnd) {
          // 冷却中，闪烁提示但不打开轮盘
          this.weaponBtnPressed = false;
          this.weaponBtnPointer = null;
          return;
        }
        this.showWeaponWheel();
      }
    }

    // 轮盘可见时追踪指向位置
    if (this.weaponWheelVisible && this.weaponBtnPointer) {
      const slot = this.getWheelHoveredSlot(this.weaponBtnPointer.x, this.weaponBtnPointer.y);
      if (slot !== this.weaponHoveredSlot) {
        this.weaponHoveredSlot = slot;
        // 高亮选中的扇形
        this.redrawWheelWithHighlight(slot);
      }
    }

    // 更新冷却显示
    this.updateWeaponCdDisplay(time);
  }

  private redrawWheelWithHighlight(hoveredSlot: number) {
    const g = this.weaponWheelGfx;
    const cx = this.weaponBtnX, cy = this.weaponBtnY;
    const kitCount = this.WEAPON_KITS.length;
    const sliceAngle = kitCount === 1 ? Math.PI * 2 : (Math.PI * 2) / kitCount;

    g.clear();

    // 背景暗角
    g.fillStyle(0x000000, 0.3);
    g.fillCircle(cx, cy, WEAPON_WHEEL_RADIUS + 60);

    // 中心孔
    g.fillStyle(0x0f0f0f, 1);
    g.fillCircle(cx, cy, 22);

    for (let i = 0; i < kitCount; i++) {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;
      const kit = this.WEAPON_KITS[i];
      const hovered = i === hoveredSlot;

      // 扇形填充 - 高亮时更亮
      g.fillStyle(kit.color, hovered ? 0.8 : 0.4);
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, WEAPON_WHEEL_RADIUS, startAngle, endAngle, false);
      g.closePath();
      g.fillPath();

      // 边框
      g.lineStyle(hovered ? 3 : 1.5, 0xffffff, hovered ? 0.9 : 0.35);
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, WEAPON_WHEEL_RADIUS, startAngle, endAngle, false);
      g.closePath();
      g.strokePath();
    }

    // 外圈边框
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokeCircle(cx, cy, WEAPON_WHEEL_RADIUS);
    // 内圈
    g.lineStyle(2, 0xffffff, 0.3);
    g.strokeCircle(cx, cy, 22);
  }

  private updateWeaponCdDisplay(time: number) {
    if (this.sniperKitPending) {
      this.weaponCdText.setText('待命');
      this.weaponCdText.setColor('#ff0000');
      return;
    }
    if (time < this.kitCooldownEnd) {
      const remaining = Math.ceil((this.kitCooldownEnd - time) / 1000);
      this.weaponCdText.setText(`${remaining}s`);
      this.weaponCdText.setColor('#ff4444');
    } else if (this.activeKit && time < this.kitEffectEndTime) {
      const remaining = Math.ceil((this.kitEffectEndTime - time) / 1000);
      this.weaponCdText.setText(`${remaining}s`);
      this.weaponCdText.setColor('#ffcc00');
    } else {
      this.weaponCdText.setText('');
      if (this.activeKit && time >= this.kitEffectEndTime) {
        this.activeKit = null;
      }
    }
  }

  private updateKitVisuals(time: number, delta: number) {
    const kitActive = this.activeKit === 'charge' && time < this.kitEffectEndTime;
    const sniperShow = (this.activeKit === 'sniper' && this.sniperKitPending && !this.isCharging)
      || (this.sniperKitActive);

    // SMG 手持武器显示
    if (kitActive && this.player && this.player.active) {
      this.smgSprite.setVisible(true);
      const offsetDist = 24;
      const jitterX = (Math.random() - 0.5) * 4;
      const jitterY = (Math.random() - 0.5) * 4;
      const jitterR = (Math.random() - 0.5) * 0.15;
      this.smgSprite.setPosition(
        this.player.x + Math.cos(this.playerAimAngle) * offsetDist + jitterX,
        this.player.y + Math.sin(this.playerAimAngle) * offsetDist + jitterY
      );
      this.smgSprite.setRotation(this.playerAimAngle + jitterR);
      this.smgSprite.setTint(this.isFiringNormal ? 0xffff88 : 0xffffff);
    } else {
      this.smgSprite.setVisible(false);
    }

    // AX50 狙击步枪手持显示
    if (sniperShow && this.player && this.player.active) {
      this.sniperSprite.setVisible(true);
      const offsetDist = 38; // 狙击枪更长，往外多放一点
      const sniperJitter = this.sniperKitActive ? (Math.random() - 0.5) * 1.5 : 0; // 蓄力时微颤
      this.sniperSprite.setPosition(
        this.player.x + Math.cos(this.playerAimAngle) * offsetDist + sniperJitter,
        this.player.y + Math.sin(this.playerAimAngle) * offsetDist + sniperJitter
      );
      this.sniperSprite.setRotation(this.playerAimAngle);
      // 根据蓄力阶段变色：待命暗红 → 一段/二段红 → 三段亮红
      if (!this.sniperKitActive) {
        this.sniperSprite.setTint(0x993333); // 待命暗红
      } else if (this.sniperKitStage >= 3) {
        this.sniperSprite.setTint(0xff2222); // 三段亮红
      } else if (this.sniperKitStage >= 1) {
        this.sniperSprite.setTint(0xdd3333); // 一段/二段红
      } else {
        this.sniperSprite.setTint(0xbb3333);
      }
    } else {
      this.sniperSprite.setVisible(false);
    }

    // 屏幕边缘火焰粒子系统
    this.setFlameParticles(kitActive);

    // 套件屏幕叠加效果
    const sniperPending = this.activeKit === 'sniper' && this.sniperKitPending && !this.isCharging;
    if (kitActive) {
      // 冲锋套件：暖色呼吸脉冲
      const pulse = 0.05 + Math.sin(time * 0.004) * 0.04;
      this.screenOverlayGfx.clear();
      this.screenOverlayGfx.fillStyle(0xff4400, pulse);
      this.screenOverlayGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else if (sniperPending) {
      // 狙击套件：红色呼吸脉冲（类似冲锋套件，无抖动）
      const pulse = 0.04 + Math.sin(time * 0.005) * 0.03;
      this.screenOverlayGfx.clear();
      this.screenOverlayGfx.fillStyle(0xff0000, pulse);
      this.screenOverlayGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // 屏幕震动（仅冲锋套件开火时）
    if (kitActive && this.isFiringNormal) {
      this.cameras.main.shake(30, 0.002);
    }
  }

  private initFlameParticles() {
    const w = GAME_WIDTH, h = GAME_HEIGHT;
    // 火焰粒子纹理需在 BootScene 中生成 fx_flame (16x16渐变圆) 和 fx_spark (4x4亮点)

    // 底边——多个发射器，粒子向上涌入屏幕
    const bottomCount = 7;
    for (let i = 0; i < bottomCount; i++) {
      const x = (w / (bottomCount + 1)) * (i + 1) + (Math.random() - 0.5) * 20;
      const em = this.add.particles(x, h, 'fx_flame', {
        speed: { min: 60, max: 200 },
        angle: { min: 250, max: 290 },
        scale: { start: 1.8, end: 0.1 },
        alpha: { start: 0.7, end: 0 },
        lifespan: { min: 400, max: 1200 },
        frequency: 40 + Math.random() * 30,
        tint: [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xff2200],
        blendMode: 'ADD',
        emitting: false,
      });
      em.setDepth(199).setScrollFactor(0);
      this.flameEmitters.push(em);
    }

    // 顶边——粒子向下飘
    const topCount = 5;
    for (let i = 0; i < topCount; i++) {
      const x = (w / (topCount + 1)) * (i + 1) + (Math.random() - 0.5) * 30;
      const em = this.add.particles(x, 0, 'fx_flame', {
        speed: { min: 50, max: 150 },
        angle: { min: 70, max: 110 },
        scale: { start: 1.4, end: 0.1 },
        alpha: { start: 0.5, end: 0 },
        lifespan: { min: 350, max: 900 },
        frequency: 55 + Math.random() * 35,
        tint: [0xff4400, 0xff6600, 0xff8800],
        blendMode: 'ADD',
        emitting: false,
      });
      em.setDepth(199).setScrollFactor(0);
      this.flameEmitters.push(em);
    }

    // 左边——粒子向右涌入
    const sideCount = 4;
    for (let i = 0; i < sideCount; i++) {
      const y = (h / (sideCount + 1)) * (i + 1) + (Math.random() - 0.5) * 25;
      const em = this.add.particles(0, y, 'fx_flame', {
        speed: { min: 60, max: 180 },
        angle: { min: -20, max: 20 },
        scale: { start: 1.5, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        lifespan: { min: 350, max: 1000 },
        frequency: 50 + Math.random() * 30,
        tint: [0xff5500, 0xff7700, 0xff9900],
        blendMode: 'ADD',
        emitting: false,
      });
      em.setDepth(199).setScrollFactor(0);
      this.flameEmitters.push(em);
    }

    // 右边——粒子向左涌入
    for (let i = 0; i < sideCount; i++) {
      const y = (h / (sideCount + 1)) * (i + 1) + (Math.random() - 0.5) * 25;
      const em = this.add.particles(w, y, 'fx_flame', {
        speed: { min: 60, max: 180 },
        angle: { min: 160, max: 200 },
        scale: { start: 1.5, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        lifespan: { min: 350, max: 1000 },
        frequency: 50 + Math.random() * 30,
        tint: [0xff5500, 0xff7700, 0xff9900],
        blendMode: 'ADD',
        emitting: false,
      });
      em.setDepth(199).setScrollFactor(0);
      this.flameEmitters.push(em);
    }

    // 四角加强
    const corners: [number, number][] = [[0, 0], [w, 0], [0, h], [w, h]];
    corners.forEach(([cx, cy]) => {
      const em = this.add.particles(cx, cy, 'fx_flame', {
        speed: { min: 80, max: 240 },
        angle: { min: 0, max: 360 },
        scale: { start: 2.2, end: 0.1 },
        alpha: { start: 0.8, end: 0 },
        lifespan: { min: 300, max: 900 },
        frequency: 25,
        tint: [0xff3300, 0xff6600, 0xffaa00, 0xffcc00],
        blendMode: 'ADD',
        emitting: false,
      });
      em.setDepth(199).setScrollFactor(0);
      this.flameEmitters.push(em);
    });

    // 火星/余烬发射器——从底边高速上飘，范围更大
    this.sparkEmitter = this.add.particles(w / 2, h, 'fx_spark', {
      speed: { min: 100, max: 400 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: { min: 600, max: 2000 },
      frequency: 60,
      tint: [0xffcc44, 0xffdd66, 0xffff88, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-w / 2 + 20, -10, w - 40, 1) },
    });
    this.sparkEmitter.setDepth(200).setScrollFactor(0);
  }

  private setFlameParticles(active: boolean) {
    if (active) {
      this.flameEmitters.forEach(em => { try { em.start(); } catch {} });
      try { this.sparkEmitter.start(); } catch {}

      if (!this.sniperKitActive) {
        this.screenEdgeGfx.clear();
        const vw = GAME_WIDTH, vh = GAME_HEIGHT;
        for (let i = 0; i < 5; i++) {
          const t = i / 5;
          this.screenEdgeGfx.lineStyle(24 / 5 + 1, 0x1a0000, 0.12 * (1 - t));
          this.screenEdgeGfx.strokeRect(t * 35, t * 35, vw - t * 70, vh - t * 70);
        }
      }
    } else {
      this.flameEmitters.forEach(em => { try { em.stop(); } catch {} });
      try { this.sparkEmitter.stop(); } catch {}
      // 狙击套件（含待命状态）自己管理 screenOverlayGfx / screenEdgeGfx，不要清除
      if (!this.sniperKitActive && !(this.activeKit === 'sniper' && this.sniperKitPending)) {
        this.screenOverlayGfx.clear();
        this.screenEdgeGfx.clear();
      }
    }
  }

  private penaltyText!: Phaser.GameObjects.Text;

  private createHUD() {
    // 敌人分段式血格文字
    this.enemyHpText = this.add
      .text(GAME_WIDTH - 20, 20, `ENEMY HP: ${this.enemyHp}`, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#FF3333', // 警示红
      })
      .setOrigin(1, 0)
      .setDepth(10)
      .setScrollFactor(0);

    // 避战惩罚提示文字
    this.penaltyText = this.add
      .text(GAME_WIDTH / 2, 80, '警告：消极避战惩罚中！', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#FF0000',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0)
      .setVisible(false);

    this.tweens.add({
      targets: this.penaltyText,
      alpha: { from: 1, to: 0.2 },
      duration: 300,
      yoyo: true,
      repeat: -1
    });
  }

  private updateHUD() {
    this.enemyHpText.setText(`ENEMY HP: ${Math.max(0, this.enemyHp)}`);
  }

  private getAimAngle(
    inputAngle: number | null,
    sourceX: number, sourceY: number,
    target: Phaser.Physics.Arcade.Sprite,
    isTargetMarked: boolean,
    currentAngle: number,
    isNormalAttack: boolean = false
  ): { angle: number, locked: boolean } {
    if (inputAngle === null) {
      return { angle: currentAngle, locked: false };
    }
    
    let targetX = target.x;
    let targetY = target.y;

    // 预测落点（仅用于锁定后的射击方向，不参与吸附判定角度的计算）
    let aimX = targetX;
    let aimY = targetY;
    if (isNormalAttack && target.body) {
      const dist = Phaser.Math.Distance.Between(sourceX, sourceY, targetX, targetY);
      const timeToHit = dist / BULLET_SPEED;
      aimX = targetX + target.body.velocity.x * timeToHit;
      aimY = targetY + target.body.velocity.y * timeToHit;
    }

    let locked = false;
    // 吸附判定始终基于敌人【真实位置】，避免高难度下敌人高速移动导致预测点偏离、夹角超阈值而吸附失效
    const angleToTarget = Phaser.Math.Angle.Between(sourceX, sourceY, targetX, targetY);
    const distToTarget = Phaser.Math.Distance.Between(sourceX, sourceY, targetX, targetY);
    const diff = Phaser.Math.Angle.Wrap(inputAngle - angleToTarget);
    
    if (isNormalAttack) {
      // 普攻极强自瞄：距离近时无视角度直接吸附；中距离放宽到约 120 度
      if (distToTarget < 300 || Math.abs(diff) < 2.09 || distToTarget < 700) {
        locked = true;
        // 锁定后朝预测落点射出，保留提前量
        const angleToPredicted = Phaser.Math.Angle.Between(sourceX, sourceY, aimX, aimY);
        return { angle: angleToPredicted, locked };
      }
    } else {
      // PC 模式大招自瞄：360° 无条件锁定敌人
      if (this.controlMode === 'pc') {
        return { angle: angleToTarget, locked: true };
      }
      if (isTargetMarked) {
        // 必杀标记状态：强力辅助瞄准，扩大容错
        if (Math.abs(diff) < 1.57 || distToTarget < 600) { // 约 90度
          locked = true;
          return { angle: angleToTarget, locked };
        }
      } else {
        // 必杀常态：削弱辅助瞄准
        if (Math.abs(diff) < 0.26) { // 约 15度
          locked = true;
          return { angle: angleToTarget, locked };
        }
      }
    }
    
    return { angle: inputAngle, locked };
  }

  private getPlayerInputAngle(pointer: Phaser.Input.Pointer | null, buttonCenter: {x: number, y: number} | null): number | null {
    let inputAngle: number | null = null;
    // 手机虚拟按键：屏幕坐标下从按钮中心到手指的偏移方向（灵敏度高）
    if (pointer && buttonCenter) {
      const dx = pointer.x - buttonCenter.x;
      const dy = pointer.y - buttonCenter.y;
      if (Math.abs(dx) + Math.abs(dy) > 8) {
        inputAngle = Math.atan2(dy, dx);
      }
    }
    // 桌面端：鼠标世界坐标相对玩家位置瞄准
    if (inputAngle === null && this.game.device.os.desktop && this.input.mousePointer) {
      const mouse = this.input.mousePointer;
      const pdx = mouse.worldX - this.player.x;
      const pdy = mouse.worldY - this.player.y;
      if (Math.abs(pdx) + Math.abs(pdy) > 10) {
        inputAngle = Math.atan2(pdy, pdx);
      }
    }
    if (inputAngle === null && this.player.body!.velocity.lengthSq() > 0) {
      inputAngle = Math.atan2(this.player.body!.velocity.y, this.player.body!.velocity.x);
    }
    return inputAngle;
  }

  private frameCount = 0;

  // PC 键位名称 → Phaser KeyCode
  private keyNameToCode(name: string): number {
    const map: Record<string, number> = {
      'A': Phaser.Input.Keyboard.KeyCodes.A, 'B': Phaser.Input.Keyboard.KeyCodes.B,
      'C': Phaser.Input.Keyboard.KeyCodes.C, 'D': Phaser.Input.Keyboard.KeyCodes.D,
      'E': Phaser.Input.Keyboard.KeyCodes.E, 'F': Phaser.Input.Keyboard.KeyCodes.F,
      'G': Phaser.Input.Keyboard.KeyCodes.G, 'H': Phaser.Input.Keyboard.KeyCodes.H,
      'I': Phaser.Input.Keyboard.KeyCodes.I, 'J': Phaser.Input.Keyboard.KeyCodes.J,
      'K': Phaser.Input.Keyboard.KeyCodes.K, 'L': Phaser.Input.Keyboard.KeyCodes.L,
      'M': Phaser.Input.Keyboard.KeyCodes.M, 'N': Phaser.Input.Keyboard.KeyCodes.N,
      'O': Phaser.Input.Keyboard.KeyCodes.O, 'P': Phaser.Input.Keyboard.KeyCodes.P,
      'Q': Phaser.Input.Keyboard.KeyCodes.Q, 'R': Phaser.Input.Keyboard.KeyCodes.R,
      'S': Phaser.Input.Keyboard.KeyCodes.S, 'T': Phaser.Input.Keyboard.KeyCodes.T,
      'U': Phaser.Input.Keyboard.KeyCodes.U, 'V': Phaser.Input.Keyboard.KeyCodes.V,
      'W': Phaser.Input.Keyboard.KeyCodes.W, 'X': Phaser.Input.Keyboard.KeyCodes.X,
      'Y': Phaser.Input.Keyboard.KeyCodes.Y, 'Z': Phaser.Input.Keyboard.KeyCodes.Z,
      '0': Phaser.Input.Keyboard.KeyCodes.ZERO, '1': Phaser.Input.Keyboard.KeyCodes.ONE,
      '2': Phaser.Input.Keyboard.KeyCodes.TWO, '3': Phaser.Input.Keyboard.KeyCodes.THREE,
      '4': Phaser.Input.Keyboard.KeyCodes.FOUR,
      'Space': Phaser.Input.Keyboard.KeyCodes.SPACE,
      'Shift': Phaser.Input.Keyboard.KeyCodes.SHIFT,
      'Ctrl': Phaser.Input.Keyboard.KeyCodes.CTRL,
      'ESC': Phaser.Input.Keyboard.KeyCodes.ESC,
      'Tab': Phaser.Input.Keyboard.KeyCodes.TAB,
      'ArrowUp': Phaser.Input.Keyboard.KeyCodes.UP,
      'ArrowDown': Phaser.Input.Keyboard.KeyCodes.DOWN,
      'ArrowLeft': Phaser.Input.Keyboard.KeyCodes.LEFT,
      'ArrowRight': Phaser.Input.Keyboard.KeyCodes.RIGHT,
    };
    return map[name] ?? Phaser.Input.Keyboard.KeyCodes.Z;
  }

  update(time: number, delta: number) {
    if (this.gameOver) return;

    this.updateWeaponSystem(time);
    this.updateKitVisuals(time, delta);

    this.frameCount++;
    if (this.frameCount % 10 === 0) {
      this.cleanupBullets();
    }
    
    // 每帧检测双方子弹轨迹相交，弥补高速子弹隧道效应导致物理 overlap 漏检
    this.checkBulletClash();

    this.updateCamera();
    this.updateMinimap();
    this.updateOutOfCombatPenalty(time, delta);

    // 更新背景网格
    this.bgGrid.tilePositionX = this.cameras.main.scrollX;
    this.bgGrid.tilePositionY = this.cameras.main.scrollY;

    // 暂停
    if (this.esc && Phaser.Input.Keyboard.JustDown(this.esc)) {
      this.pauseGame();
      return;
    }

    // 视觉上的平滑持续自转
    // 角色自转：狙击套件时随 timeScale 线性减速（delta 本身已受 timeScale 影响）
    const rotScale = this.sniperKitActive ? this.time.timeScale : 1.0;
    if (this.player && this.player.active) {
      this.player.rotation += 0.08 * (delta / 16) * rotScale;
    }
    if (this.enemy && this.enemy.active) {
      this.enemy.rotation -= 0.05 * (delta / 16) * rotScale;
    }

    this.movePlayer(delta);
    
    if (this.enemy.active) {
      this.moveEnemy(delta);
      this.enemyFire(time);
    }

    // 无尽模式：小兵 AI 追击 + 射击 + 复制 BOSS 追击
    if (this.gameMode === 'endless') {
      this.updateMinions(delta, time);
      this.updateDuplicateBosses(delta);
    }
    
    // --- 大招释放 (键盘 X 松开) ---
    if (this.xKey && Phaser.Input.Keyboard.JustUp(this.xKey)) {
      if (this.isCharging) {
        const chargeDuration = time - this.chargeStartTime;
        const canFire = this.sniperKitActive
          ? chargeDuration >= SNIPER_KIT_MIN_CHARGE
          : chargeDuration >= ULTIMATE_CHARGE_TIME;
        const savedMult = this.sniperSpeedMult;
        if (this.sniperKitActive && canFire) this.cleanupSniperKit();
        if (canFire) this.fireUltimate(savedMult);
        this.isCharging = false;
        this.chargeUI.clear();
        this.trajectoryUI.clear();
        this.sniperPredictGfx.clear();
        this.sniperEnemyHighlightGfx.clear();
        this.lastPlayerTrajectoryLength = -999;
        if (this.enemyMarkPendingRemove) { this.isEnemyMarked = false; this.enemyMarkPendingRemove = false; }
      }
    }

    // --- 普攻 (键盘 Z / 鼠标左键) ---
    if (this.zKey && Phaser.Input.Keyboard.JustDown(this.zKey)) this.isFiringNormal = true;
    if (this.zKey && Phaser.Input.Keyboard.JustUp(this.zKey)) this.isFiringNormal = false;
    // 鼠标左键：按住开枪，松开停火
    const ms = (this as any)._mouseState;
    if (ms) {
      if (ms.left && !ms._wasLeft) { this.isFiringNormal = true; ms._wasLeft = true; }
      if (!ms.left && ms._wasLeft) { this.isFiringNormal = false; ms._wasLeft = false; }
      // 右键：按住蓄力，松开释放
      if (ms.right && !ms._wasRight && !this.isCharging) { this.startChargingUltimate(time); ms._wasRight = true; }
      if (!ms.right && ms._wasRight && this.isCharging) {
        const chargeDuration = time - this.chargeStartTime;
        const canFire = this.sniperKitActive
          ? chargeDuration >= SNIPER_KIT_MIN_CHARGE
          : chargeDuration >= ULTIMATE_CHARGE_TIME;
        const savedMult = this.sniperSpeedMult;
        if (this.sniperKitActive && canFire) this.cleanupSniperKit();
        if (canFire) this.fireUltimate(savedMult);
        this.isCharging = false;
        this.chargeUI.clear();
        this.trajectoryUI.clear();
        this.sniperPredictGfx.clear();
        this.sniperEnemyHighlightGfx.clear();
        this.lastPlayerTrajectoryLength = -999;
        ms._wasRight = false;
      }
    }

    const zDown = this.isFiringNormal;
    if (zDown) {
      const zBtnCenter = { x: this.keyLayout.z.x, y: this.keyLayout.z.y };
      const inputAngle = this.getPlayerInputAngle(this.virtualZPointer, this.virtualZPointer ? zBtnCenter : null);
      
      let aimInfo = { angle: inputAngle ?? this.playerAimAngle, locked: false };
      if (this.enemy && this.enemy.active) {
        aimInfo = this.getAimAngle(inputAngle, this.player.x, this.player.y, this.enemy, false, this.playerAimAngle, true);
        // 超级自瞄修改器：强制锁定，普攻必中
        if (this.modSuperAim) {
          const angleToEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
          // 预测落点
          let ax = this.enemy.x, ay = this.enemy.y;
          if (this.enemy.body) {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
            const tth = dist / BULLET_SPEED;
            ax = this.enemy.x + this.enemy.body.velocity.x * tth;
            ay = this.enemy.y + this.enemy.body.velocity.y * tth;
          }
          aimInfo = { angle: Phaser.Math.Angle.Between(this.player.x, this.player.y, ax, ay), locked: true };
          void angleToEnemy;
        }
      }
      
      const diff = Phaser.Math.Angle.ShortestBetween(this.playerAimAngle, aimInfo.angle);
      this.playerAimAngle += diff * (aimInfo.locked ? 0.7 : 0.2);
      
      // 连发修改器 / 冲锋套件 / 连续闪避：缩短射击间隔
      if (!this.isNormalAttackDisabled) {
        const chargeActive = this.activeKit === 'charge' && time < this.kitEffectEndTime;
        const effectiveFireRate = chargeActive ? CHARGE_KIT_FIRE_RATE : FIRE_RATE;
        const canRapidFire = this.modRapidFire || (this.isDashing && this.comboDashCount > 1);
        if (canRapidFire || time - this.lastFired > effectiveFireRate) {
          this.fireNormal();
          this.lastFired = time;
        }
      }
    }
    
    // 闪避冲刺 (键盘 C 键 或 空格键)
    if ((this.cKey && Phaser.Input.Keyboard.JustDown(this.cKey)) || 
        (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey))) {
      this.dash();
    }

    // 弹反判定 (键盘 V 键)
    if (this.vKey && Phaser.Input.Keyboard.JustDown(this.vKey)) {
      this.startParry();
    }

    // 更新弹反盾牌弧线绘制
    this.drawParryArc();

    // 弹反冷却更新与状态重置
    if (this.isParrying && time > this.parryStartTime + 300) {
      this.isParrying = false;
      // 如果弹反状态结束且没有成功弹反，则触发惩罚冷却
      if (!this.parrySuccess && !this.modInfiniteParry) {
        this.parryCooldown = time + this.getParryCd(10000); // 10秒冷却
        this.cameras.main.flash(200, 255, 0, 0); // 红色闪屏警告弹空
      }
    }
    
    // 更新普攻禁用状态
    if (this.isNormalAttackDisabled && time > this.normalAttackDisableEndTime) {
      this.isNormalAttackDisabled = false;
    }
    
    // 必杀蓄力 (键盘 X)
    if (this.xKey && Phaser.Input.Keyboard.JustDown(this.xKey)) {
      this.startChargingUltimate(time);
    }
    
    const xDown = this.isCharging;
    if (xDown) {
      const xBtnCenter = { x: this.keyLayout.x.x, y: this.keyLayout.x.y };
      const inputAngle = this.getPlayerInputAngle(this.virtualXPointer, this.virtualXPointer ? xBtnCenter : null);

      let aimInfo = { angle: inputAngle ?? this.playerAimAngle, locked: false };
      if (this.enemy && this.enemy.active) {
        // 狙击 Stage 2+ 无条件锁定
        const sniperForceLock = this.sniperKitActive && this.sniperKitStage >= 2;
        if (sniperForceLock) {
          const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
          aimInfo = { angle: a, locked: true };
        } else {
          aimInfo = this.getAimAngle(inputAngle, this.player.x, this.player.y, this.enemy, this.isEnemyMarked, this.playerAimAngle, false);
        }
      }

      this.isPlayerAimLocked = aimInfo.locked;

      const diff = Phaser.Math.Angle.ShortestBetween(this.playerAimAngle, aimInfo.angle);
      this.playerAimAngle += diff * (aimInfo.locked ? 0.4 : 0.2);

      const chargeDuration = time - this.chargeStartTime;

      // 狙击套件平滑时停 + 阶段推进
      if (this.sniperKitActive) {
        this.updateSniperTimeScale(chargeDuration);
        if (chargeDuration >= SNIPER_STAGE1_TIME && this.sniperKitStage < 1) this.enterSniperStage1();
        if (chargeDuration >= SNIPER_STAGE2_TIME && this.sniperKitStage < 2) this.enterSniperStage2();
        if (chargeDuration >= SNIPER_STAGE3_TIME && this.sniperKitStage < 3) this.enterSniperStage3();
        if (this.sniperKitStage >= 3) this.updateSniperPrediction();

        // 二段暗角：直角黑边，每帧重绘以响应 alpha 过渡（三段由 scope sprite 接管边框）
        if (this.sniperKitStage === 2 && this.sniperStage2Alpha > 0) {
          this.drawStage2Vignette(this.sniperStage2Alpha);
        }

        // 三段灰色背景 + scope 遮罩：每帧重绘灰底
        if (this.sniperKitStage >= 3 && this.sniperStage3Alpha > 0) {
          this.screenOverlayGfx.clear();
          this.screenOverlayGfx.fillStyle(0x333333, 0.60 * this.sniperStage3Alpha);
          this.screenOverlayGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }

        // 敌人高亮：二段红框，三段热成像白色
        if (this.sniperKitStage >= 2 && this.enemy && this.enemy.active) {
          if (this.sniperKitStage >= 3) {
            // 三段：敌人变白 + 光晕跟随
            this.sniperEnemyHighlightGfx.clear();
            this.enemy.setTintFill(0xffffff);
            this.enemyGlowSprite.setPosition(this.enemy.x, this.enemy.y);
          } else {
            // 二段：红色框高亮
            this.enemy.clearTint();
            this.enemyGlowSprite.setVisible(false);
            this.sniperEnemyHighlightGfx.clear();
            this.sniperEnemyHighlightGfx.lineStyle(3, 0xff4444, 0.8 + Math.sin(time * 0.01) * 0.2);
            this.sniperEnemyHighlightGfx.strokeRect(this.enemy.x - ENEMY_SIZE/2 - 4, this.enemy.y - ENEMY_SIZE/2 - 4, ENEMY_SIZE + 8, ENEMY_SIZE + 8);
          }
        } else {
          this.sniperEnemyHighlightGfx.clear();
          this.enemy.clearTint();
        }
        // 狙击蓄力UI
        const sniperProgress = Math.min(chargeDuration / ULTIMATE_CHARGE_TIME, 1);
        this.drawSniperChargeUI(sniperProgress);
      } else {
        const progress = Math.min(chargeDuration / ULTIMATE_CHARGE_TIME, 1);
        this.drawChargeUI(progress);
      }

      if (chargeDuration >= 400 && !this.chargeCompleteSoundPlayed) {
        this.chargeCompleteSoundPlayed = true;
        this.playChargeCompleteSound();
      }

      const trajProgress = this.sniperKitActive
        ? Math.min(chargeDuration / ULTIMATE_CHARGE_TIME, 1)
        : Math.min(chargeDuration / ULTIMATE_CHARGE_TIME, 1);
      this.drawTrajectory(this.playerAimAngle, trajProgress);
    }
  }

  // 生成热成像瞄具遮罩：黑底 + 椭圆透明窗 + 羽化边缘（shadowBlur 实现软过渡）
  private createThermalScopeTexture() {
    if (this.textures.exists('thermal_scope_tex')) return;
    const w = GAME_WIDTH, h = GAME_HEIGHT;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // 全黑背景
    ctx.fillStyle = '#080812';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const rx = w * 0.35, ry = h * 0.38;

    // destination-out: 用白色椭圆擦出透明窗，shadowBlur 产生羽化边缘
    ctx.globalCompositeOperation = 'destination-out';
    ctx.shadowColor = 'white';
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    // 再画一次无阴影的，确保中心区彻底透明
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.95, ry * 0.95, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();

    this.textures.addCanvas('thermal_scope_tex', canvas);
  }

  // 生成敌人热成像光晕：白色软圆，边缘羽化
  private createEnemyGlowTexture() {
    if (this.textures.exists('enemy_glow_tex')) return;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2, cy = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, size * 0.05, cx, cy, size * 0.48);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.4)');
    grad.addColorStop(0.85, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    this.textures.addCanvas('enemy_glow_tex', canvas);
  }

  // ---- 狙击套件平滑时停 ----
  // 根据蓄力进度计算目标 timeScale（线性插值），每帧平滑逼近
  private updateSniperTimeScale(chargeDuration: number) {
    const minCharge = SNIPER_KIT_MIN_CHARGE;
    const maxCharge = SNIPER_STAGE3_TIME;
    if (chargeDuration < minCharge) {
      // 还没到最低发射时间，保持正常速度
      this.currentSniperTimeScale += (1.0 - this.currentSniperTimeScale) * 0.2;
    } else {
      // 从 minCharge 到 maxCharge，timeScale 从 1.0 平滑降到 0.012（子弹几乎静止）
      const t = Math.min((chargeDuration - minCharge) / (maxCharge - minCharge), 1.0);
      // 使用 easeOutCubic 让中期慢放更果断，末尾极慢
      const eased = 1 - Math.pow(1 - t, 3);
      const target = 1.0 - eased * 0.988; // 最低 ≈ 0.012
      this.currentSniperTimeScale += (target - this.currentSniperTimeScale) * 0.15;
    }
    this.setSniperTimeScale(this.currentSniperTimeScale);
  }

  private setSniperTimeScale(scale: number) {
    this.time.timeScale = scale;
    this.physics.world.timeScale = scale;
  }

  private enterSniperStage1() {
    this.sniperKitStage = 1;
    this.sniperSpeedMult = 1.0;
    if (!this.enemy || !this.enemy.active) return;
    this.isCinematicFocus = true;
    // 镜头贴近（zoom IN），带平滑过渡
    this.tweens.killTweensOf(this.cameras.main);
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 2.0,
      duration: 800,
      ease: 'Cubic.easeInOut'
    });
    // 二段暗角 alpha 从 0 开始（为后续过渡做准备）
    this.sniperStage2Alpha = 0;
  }

  private enterSniperStage2() {
    this.sniperKitStage = 2;
    this.sniperSpeedMult = SNIPER_SPEED_MULT_STAGE2;
    // 暗角平滑淡入
    this.tweens.add({
      targets: this,
      sniperStage2Alpha: 1,
      duration: 500,
      ease: 'Cubic.easeOut'
    });
  }

  // 二段直角暗角：fillRect 从四边向内推进，多层叠加模拟渐进，alpha 控制整体强度
  private drawStage2Vignette(alpha: number) {
    this.screenEdgeGfx.clear();
    if (alpha <= 0) return;
    const w = GAME_WIDTH, h = GAME_HEIGHT;
    const baseMargin = 80;
    const layers = 10;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const layerAlpha = (0.60 + t * 0.40) * alpha;
      const m = baseMargin - i * 6;
      const lm = Math.max(m, 6);
      this.screenEdgeGfx.fillStyle(0x080812, layerAlpha);
      this.screenEdgeGfx.fillRect(0, 0, w, lm);                     // 上
      this.screenEdgeGfx.fillRect(0, h - lm, w, lm);                // 下
      this.screenEdgeGfx.fillRect(0, lm, lm, h - lm * 2);           // 左
      this.screenEdgeGfx.fillRect(w - lm, lm, lm, h - lm * 2);      // 右
    }
  }

  private enterSniperStage3() {
    this.sniperKitStage = 3;
    this.sniperSpeedMult = SNIPER_SPEED_MULT_STAGE3;
    // 直接推到底：子弹、旋转、物理近乎冻结
    this.currentSniperTimeScale = 0.015;
    this.setSniperTimeScale(0.015);
    // 保持二段暗角，热成像遮罩平滑淡入
    this.thermalScopeSprite.setVisible(true).setAlpha(0);
    this.enemyGlowSprite.setVisible(true);
    this.tweens.add({
      targets: this.thermalScopeSprite,
      alpha: 1,
      duration: 500,
      ease: 'Cubic.easeOut'
    });
    // 灰色背景同步淡入
    this.sniperStage3Alpha = 0;
    this.tweens.add({
      targets: this,
      sniperStage3Alpha: 1,
      duration: 400,
      ease: 'Cubic.easeOut'
    });
  }

  private cleanupSniperKit() {
    this.sniperKitActive = false;
    this.sniperKitStage = 0;
    this.sniperSpeedMult = 1.0;
    this.currentSniperTimeScale = 1.0;
    this.sniperStage2Alpha = 0;
    this.sniperStage3Alpha = 0;
    this.setSniperTimeScale(1);
    if (this.isCinematicFocus) {
      this.isCinematicFocus = false;
    }
    // 恢复镜头
    this.tweens.killTweensOf(this.cameras.main);
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 1.0,
      duration: 300,
      ease: 'Cubic.easeOut'
    });
    this.sniperPredictGfx.clear();
    this.sniperEnemyHighlightGfx.clear();
    this.screenEdgeGfx.clear();
    this.screenOverlayGfx.clear();
    this.thermalScopeSprite.setVisible(false);
    this.enemyGlowSprite.setVisible(false);
    this.enemy.clearTint();
    this.kitCooldownEnd = this.time.now + WEAPON_KIT_COOLDOWN;
    this.activeKit = null;
  }

  private updateSniperPrediction() {
    if (!this.enemy || !this.enemy.active || !this.enemy.body) return;
    const g = this.sniperPredictGfx;
    g.clear();

    const ex = this.enemy.x, ey = this.enemy.y;
    const vx = this.enemy.body.velocity.x;
    const vy = this.enemy.body.velocity.y;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, ex, ey);
    const bulletSpeed = ULTIMATE_SPEED * this.sniperSpeedMult;
    const predictTime = Math.max(dist / bulletSpeed, SNIPER_PREDICT_TIME);
    const px = ex + vx * predictTime;
    const py = ey + vy * predictTime;
    const size = ENEMY_SIZE + 12;

    const angleToCur = Phaser.Math.Angle.Between(this.player.x, this.player.y, ex, ey);
    const angleToPred = Phaser.Math.Angle.Between(this.player.x, this.player.y, px, py);
    const diffCur = Math.abs(Phaser.Math.Angle.ShortestBetween(this.playerAimAngle, angleToCur));
    const diffPred = Math.abs(Phaser.Math.Angle.ShortestBetween(this.playerAimAngle, angleToPred));
    const lockPred = diffPred < diffCur;
    (this as any)._sniperLockPred = lockPred;
    (this as any)._sniperPredX = px;
    (this as any)._sniperPredY = py;

    // 虚线连接线
    const dashLen = 8, gapLen = 6;
    const totalDist = Phaser.Math.Distance.Between(ex, ey, px, py);
    const connAngle = Math.atan2(py - ey, px - ex);
    let d = 0;
    g.lineStyle(2, 0x00ff88, 0.7);
    while (d < totalDist) {
      g.beginPath();
      g.moveTo(ex + Math.cos(connAngle) * d, ey + Math.sin(connAngle) * d);
      const end = Math.min(d + dashLen, totalDist);
      g.lineTo(ex + Math.cos(connAngle) * end, ey + Math.sin(connAngle) * end);
      g.strokePath();
      d += dashLen + gapLen;
    }

    const half = size / 2;
    const drawDashedRect = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => {
      const segLen = 7, segGap = 5;
      const drawDashedLine = (sx: number, sy: number, ex2: number, ey2: number) => {
        const lineLen = Phaser.Math.Distance.Between(sx, sy, ex2, ey2);
        const ang = Math.atan2(ey2 - sy, ex2 - sx);
        let pos = 0;
        while (pos < lineLen) {
          g.beginPath();
          g.moveTo(sx + Math.cos(ang) * pos, sy + Math.sin(ang) * pos);
          const e = Math.min(pos + segLen, lineLen);
          g.lineTo(sx + Math.cos(ang) * e, sy + Math.sin(ang) * e);
          g.strokePath();
          pos += segLen + segGap;
        }
      };
      drawDashedLine(x1, y1, x2, y2);
      drawDashedLine(x2, y2, x3, y3);
      drawDashedLine(x3, y3, x4, y4);
      drawDashedLine(x4, y4, x1, y1);
    };
    g.lineStyle(2, lockPred ? 0x00ff44 : 0x00ff88, lockPred ? 0.9 : 0.5);
    drawDashedRect(px - half, py - half, px + half, py - half, px + half, py + half, px - half, py + half);

    g.lineStyle(2, lockPred ? 0x0088ff : 0x00ff88, lockPred ? 0.5 : 0.9);
    drawDashedRect(ex - half, ey - half, ex + half, ey - half, ex + half, ey + half, ex - half, ey + half);
  }

  private drawSniperChargeUI(progress: number) {
    this.chargeUI.clear();
    const px = this.player.x, py = this.player.y;
    const maxLen = 60;
    const len = 20 + progress * maxLen;
    const alpha = 0.5 + progress * 0.5;
    const color = progress >= SNIPER_KIT_MIN_CHARGE / ULTIMATE_CHARGE_TIME ? 0x00ff88 : 0xff4444;

    this.chargeUI.lineStyle(2, color, alpha);
    this.chargeUI.lineBetween(px - len, py, px - 10, py);
    this.chargeUI.lineBetween(px + 10, py, px + len, py);
    this.chargeUI.lineBetween(px, py - len, px, py - 10);
    this.chargeUI.lineBetween(px, py + 10, px, py + len);
    this.chargeUI.strokeCircle(px, py, 12);
  }

  private drawTrajectory(angle: number, progress: number) {
    // 动态长度：至少延伸到敌人位置，确保远距离不消失
    let enemyDist = 600;
    if (this.enemy && this.enemy.active) {
      enemyDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
    }
    const length = Math.max(150 + progress * 850, enemyDist + 120);

    this.trajectoryUI.x = this.player.x;
    this.trajectoryUI.y = this.player.y;
    this.trajectoryUI.rotation = angle;

    if (Math.abs(this.lastPlayerTrajectoryLength - length) > 2) {
      this.lastPlayerTrajectoryLength = length;
      this.trajectoryUI.clear();
      this.trajectoryUI.lineStyle(2, COLORS.ultimate, 0.4 + progress * 0.4);
      this.trajectoryUI.beginPath();

      const dashLength = 15;
      const gapLength = 15;
      let dist = 30;

      while (dist < length) {
        this.trajectoryUI.moveTo(dist, 0);
        dist += dashLength;
        this.trajectoryUI.lineTo(Math.min(dist, length), 0);
        dist += gapLength;
      }
      this.trajectoryUI.strokePath();
    }
  }

  private drawEnemyTrajectory(angle: number, progress: number) {
    if (!this.enemy || !this.enemy.active) return;

    // 动态长度：至少延伸到玩家位置
    const playerDist = Phaser.Math.Distance.Between(this.enemy.x, this.enemy.y, this.player.x, this.player.y);
    const length = Math.max(150 + progress * 850, playerDist + 120);

    this.enemyTrajectoryUI.x = this.enemy.x;
    this.enemyTrajectoryUI.y = this.enemy.y;
    this.enemyTrajectoryUI.rotation = angle;

    if (Math.abs(this.lastEnemyTrajectoryLength - length) > 2) {
      this.lastEnemyTrajectoryLength = length;
      this.enemyTrajectoryUI.clear();
      this.enemyTrajectoryUI.lineStyle(2, COLORS.enemy, 0.4 + progress * 0.4);
      this.enemyTrajectoryUI.beginPath();

      const dashLength = 15;
      const gapLength = 15;
      let dist = 30;

      while (dist < length) {
        this.enemyTrajectoryUI.moveTo(dist, 0);
        dist += dashLength;
        this.enemyTrajectoryUI.lineTo(Math.min(dist, length), 0);
        dist += gapLength;
      }
      this.enemyTrajectoryUI.strokePath();
    }
  }

  private drawChargeUI(progress: number) {
    this.chargeUI.clear();
    const size = PLAYER_SIZE + 20 - progress * 10;
    
    let color = COLORS.ultimate;
    let alpha = progress;
    
    if (progress >= 1) {
      // 蓄力满时颜色改变，并闪烁
      color = COLORS.white;
      alpha = 0.8 + 0.2 * Math.sin(this.time.now * 0.02);
    }
    
    this.chargeUI.lineStyle(3, color, alpha);
    this.chargeUI.strokeRect(this.player.x - size / 2, this.player.y - size / 2, size, size);
  }

  private drawParryArc() {
    this.parryArcGraphics.clear();
    if (!this.parryArcState.visible) return;

    // 半径与角度跨度
    const radius = PLAYER_SIZE + 25;
    const arcSpan = Math.PI / 1.5; // 120度的弧

    // 绘制始终面向目标的弧线
    const startAngle = this.parryArcState.angle - arcSpan / 2;
    const endAngle = this.parryArcState.angle + arcSpan / 2;

    // 根据 startProgress 和 endProgress 动态截取这段弧线
    const currentStart = Phaser.Math.Linear(startAngle, endAngle, this.parryArcState.startProgress);
    const currentEnd = Phaser.Math.Linear(startAngle, endAngle, this.parryArcState.endProgress);

    // 只有当存在有效跨度时才绘制
    if (currentEnd > currentStart) {
      this.parryArcGraphics.lineStyle(4, 0x00ffff, 0.9); // 亮青色的能量盾弧线
      this.parryArcGraphics.beginPath();
      // 在 Phaser 引擎中，arc 方法参数: x, y, radius, startAngle, endAngle, anticlockwise
      this.parryArcGraphics.arc(this.player.x, this.player.y, radius, currentStart, currentEnd, false);
      this.parryArcGraphics.strokePath();
    }
    // 绘制敌人弹反弧线
    if (this.enemyParryArcState.visible && this.enemy && this.enemy.active) {
      const radius = ENEMY_SIZE + 25;
      const arcSpan = Math.PI / 1.5;
      const startAngle = this.enemyParryArcState.angle - arcSpan / 2;
      const endAngle = this.enemyParryArcState.angle + arcSpan / 2;
      const currentStart = Phaser.Math.Linear(startAngle, endAngle, this.enemyParryArcState.startProgress);
      const currentEnd = Phaser.Math.Linear(startAngle, endAngle, this.enemyParryArcState.endProgress);
      if (currentEnd > currentStart) {
        this.parryArcGraphics.lineStyle(4, 0xff5500, 0.9); // 敌人用橙红色盾牌
        this.parryArcGraphics.beginPath();
        this.parryArcGraphics.arc(this.enemy.x, this.enemy.y, radius, currentStart, currentEnd, false);
        this.parryArcGraphics.strokePath();
      }
    }
  }

  private playChargeCompleteSound() {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      // 创建白噪声 buffer 用于模拟摩擦声
      const bufferSize = ctx.sampleRate * 0.2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const playMechanicalClick = (time: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.1, time + duration);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.4, time + duration * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        osc.start(time);
        osc.stop(time + duration);
      };

      const playMetallicSlide = (time: number, startFreq: number, endFreq: number, duration: number) => {
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 20; // 高 Q 值产生金属共鸣感
        filter.frequency.setValueAtTime(startFreq, time);
        filter.frequency.linearRampToValueAtTime(endFreq, time + duration);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.8, time + duration * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        noiseSource.start(time);
        noiseSource.stop(time + duration);
      };
      
      const now = ctx.currentTime;
      // 1. 向后拉栓：金属滑动声 + 轻微的清脆卡扣声
      playMetallicSlide(now, 1200, 2500, 0.05);
      playMechanicalClick(now + 0.03, 1800, 0.04);
      
      // 2. 向前推回并锁定：向下的金属滑动声 + 沉重的机械锁定声
      playMetallicSlide(now + 0.07, 2500, 800, 0.06);
      playMechanicalClick(now + 0.11, 400, 0.08);

    } catch (e) {
      console.warn('AudioContext not supported');
    }
  }

  private movePlayer(delta: number) {
    if (this.isPlayerKnockedBack) return;

    if (this.isDashing) {
      this.createDashTrail();
      return; // 冲刺期间不接受摇杆或键盘对速度的修改，维持当前冲刺速度
    }

    // 蓄力或连发普攻时，目标移动速度减半（冲锋套件激活时除外）
    const chargeKitActive = this.activeKit === 'charge' && this.time.now < this.kitEffectEndTime;
    let targetMaxSpeed = (this.isCharging || this.isFiringNormal) ? (chargeKitActive ? PLAYER_SPEED : PLAYER_SPEED * 0.5) : PLAYER_SPEED;
    
    // 如果处于脱战惩罚且正在远离敌人，则屏幕抖动并平滑减速
    let isMovingAway = false;
    if (this.player.body!.velocity.lengthSq() > 10 && this.enemy.active) {
      const vx = this.player.body!.velocity.x;
      const vy = this.player.body!.velocity.y;
      const dx = this.enemy.x - this.player.x;
      const dy = this.enemy.y - this.player.y;
      const dot = vx * dx + vy * dy;
      if (dot < 0) isMovingAway = true;
    }

    if (this.isOutOfCombatPenalty && isMovingAway) {
      targetMaxSpeed = PLAYER_SPEED * 0.1; // 极强减速，让玩家几乎跑不动
      // 增强抖动频率和幅度
      if (this.time.now > this.lastCameraShakeTime + 50) {
        this.cameras.main.shake(50, 0.02);
        this.lastCameraShakeTime = this.time.now;
      }
      if (this.penaltyText) this.penaltyText.setVisible(true);
    } else {
      if (this.penaltyText) this.penaltyText.setVisible(false);
    }

    // 如果处于标记状态且被敌人必杀瞄准，减速
    if (this.isEnemyChargingUltimate && this.isPlayerMarked && this.isEnemyAimLocked) {
      targetMaxSpeed = Math.min(targetMaxSpeed, PLAYER_SPEED * 0.4);
    }
    
    // 使用 delta 实现帧率无关的平滑插值
    this.currentPlayerMaxSpeed += (targetMaxSpeed - this.currentPlayerMaxSpeed) * 0.008 * delta;
    this.player.setMaxVelocity(this.currentPlayerMaxSpeed, this.currentPlayerMaxSpeed);

    let vx = 0;
    let vy = 0;
    
    // 键盘控制
    if (this.cursors) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
      else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
      if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
      else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
    }

    // 摇杆控制（优先级高于键盘）
    if (this.joyStick && this.joyStick.force > 0) {
      vx = Math.cos(this.joyStick.rotation);
      vy = Math.sin(this.joyStick.rotation);
    } else if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    if (vx !== 0 || vy !== 0) {
      // 当有方向输入时，设置加速度并在一定程度上改变朝向
      this.player.setAcceleration(vx * PLAYER_ACCEL, vy * PLAYER_ACCEL);
      if (!this.input.activePointer.isDown) {
        const moveAngle = Math.atan2(vy, vx);
        this.playerAimAngle = Phaser.Math.Angle.RotateTo(this.playerAimAngle, moveAngle, 0.15);
      }
    } else {
      this.player.setAcceleration(0, 0);
    }
  }

  // 敌人平滑移动速度插值
  private currentEnemyMaxSpeed = ENEMY_SPEED;

  private moveEnemy(delta: number) {
    if (this.isEnemyKnockedBack) return;

    // 测试模式：敌人不移动
    if (this.gameMode === 'test') {
      this.enemy.setAcceleration(0, 0);
      this.enemy.setVelocity(0, 0);
      return;
    }

    // 狙击套件时停：激活期间 + 发射后 300ms 保持冻结，防止敌人闪避无敌
    if (this.sniperKitActive || this.time.now < this.sniperFreezeUntil) {
      this.enemy.setAcceleration(0, 0);
      this.enemy.setVelocity(0, 0);
      return;
    }

    if (!this.player || !this.player.active) {
      this.enemy.setAcceleration(0, 0);
      return;
    }

    if (this.isEnemyDashing) {
      this.createEnemyDashTrail();
      return; // 冲刺期间维持原速度不接受改变
    }
    
    // BOSS 类型特定 AI 行为
    if (this.diffEnableEnemySkills || this.gameMode === 'endless') {
      // 闪避型 BOSS：大幅提高闪避频率
      const dashChance = this.bossType === 'dodge' ? 0.08 : 0.01;
      const dashCd = this.bossType === 'dodge' ? 1500 : 3000;
      if (!this.isEnemyDashing && this.time.now - this.lastEnemyDashTime > dashCd) {
        if (this.isEnemyMarked && Math.random() < dashChance * (delta / 16)) {
          this.enemyDash();
        }
      }

      // 弹反型 BOSS：大幅提高弹反频率
      const parryChance = this.bossType === 'parry' ? 0.1 : 0.02;
      if (this.bossType === 'parry' && !this.isEnemyParrying && this.time.now > this.enemyParryCooldown) {
        if (Math.random() < parryChance * (delta / 16)) {
          this.startEnemyParry();
        }
      }

      // 敌人近战检测
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
      if (dist <= 150 && this.time.now - this.lastEnemyMeleeTime > this.enemyMeleeCooldown && !this.isEnemyMeleeAttacking && !this.isEnemyNormalAttackDisabled) {
        if (Math.random() < 0.02 * (delta / 16)) {
          this.enemyMeleeAttack();
        }
      }
    }
    
    // NPC 默认朝玩家方向移动
    let targetAngle = Phaser.Math.Angle.Between(
      this.enemy.x,
      this.enemy.y,
      this.player.x,
      this.player.y,
    );

    let targetSpeed = ENEMY_SPEED * this.diffSpeedMult;

    // 检查是否被必杀技瞄准并且被标记
    if (this.isCharging) {
      const angleToEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
      const distToEnemy = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
      const diff = Phaser.Math.Angle.Wrap(this.playerAimAngle - angleToEnemy);
      
      const isLocked = Math.abs(diff) < 0.78 || distToEnemy < 300;
      if (isLocked) {
        // 敌人 AI 躲避大招判定：根据 BOSS 类型决定行为
        if (this.diffEnableEnemySkills || this.gameMode === 'endless') {
          if (!this.isEnemyDashing && this.time.now - this.lastEnemyDashTime > DASH_COOLDOWN) {
            // 闪避型/分裂型：可以闪避
            if (this.bossType !== 'parry' && Math.random() < 0.08) {
              this.enemyDash();
            }
            // 弹反型：可以弹反
            if (this.bossType === 'parry' && !this.isEnemyParrying && this.time.now > this.enemyParryCooldown) {
              if (Math.random() < 0.1) {
                this.startEnemyParry();
              }
            }
          }
        }

        // 被必杀瞄准时尝试向两侧规避 (结合位置向更开阔的一侧躲避)
        const dodgeDir = (this.enemy.x > GAME_WIDTH / 2) ? 1 : -1;
        targetAngle += (Math.PI / 2) * dodgeDir;

        // 如果处于普攻刚命中标记状态，平滑减速
        if (this.isEnemyMarked) {
          targetSpeed = ENEMY_SPEED * this.diffSpeedMult * 0.4;
        }
      }
    }

    // 平滑过渡敌人最大速度
    this.currentEnemyMaxSpeed += (targetSpeed - this.currentEnemyMaxSpeed) * 0.01 * delta;
    this.enemy.setMaxVelocity(this.currentEnemyMaxSpeed, this.currentEnemyMaxSpeed);

    this.enemy.setAcceleration(Math.cos(targetAngle) * ENEMY_ACCEL, Math.sin(targetAngle) * ENEMY_ACCEL);
  }

  private createEnemyDashTrail() {
    if (this.enemyDashTrailTimer) return;
    this.enemyDashTrailTimer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (!this.isEnemyDashing) {
          if (this.enemyDashTrailTimer) {
            this.enemyDashTrailTimer.remove();
            this.enemyDashTrailTimer = null;
          }
          return;
        }
        const trail = this.add.sprite(this.enemy.x, this.enemy.y, ASSET_KEYS.enemy);
        trail.setDepth(1);
        trail.setTintFill(0xff0000);
        trail.setAlpha(0.6);
        trail.rotation = this.enemy.rotation;
        trail.setScale(this.enemy.scaleX, this.enemy.scaleY);
        this.tweens.add({
          targets: trail, alpha: 0, scaleX: 1.2, scaleY: 1.2, duration: 300,
          onComplete: () => trail.destroy()
        });
      }
    });
  }

  private enemyDash() {
    if (this.isEnemyDashing || this.time.now - this.lastEnemyDashTime < DASH_COOLDOWN) return;
    
    this.isEnemyDashing = true;
    this.lastEnemyDashTime = this.time.now;
    this.hasEnemyPerfectDodged = false;
    
    const angle = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, this.player.x, this.player.y);
    const dodgeDir = Math.random() > 0.5 ? 1 : -1;
    const dashAngle = angle + (Math.PI / 2) * dodgeDir;
    
    this.enemy.setMaxVelocity(DASH_SPEED, DASH_SPEED);
    this.enemy.setVelocity(Math.cos(dashAngle) * DASH_SPEED, Math.sin(dashAngle) * DASH_SPEED);
    this.currentEnemyMaxSpeed = DASH_SPEED;
    
    this.enemyDashTrailTimer = null;
    
    this.time.delayedCall(DASH_DURATION, () => {
      this.isEnemyDashing = false;
      this.enemy.setMaxVelocity(ENEMY_SPEED * this.diffSpeedMult, ENEMY_SPEED * this.diffSpeedMult);
    });
  }

  private startEnemyParry() {
    if (this.time.now < this.enemyParryCooldown || this.isEnemyParrying || this.isEnemyDashing) return;
    
    this.isEnemyParrying = true;
    this.enemyParryStartTime = this.time.now;
    this.enemyParrySuccess = false;
    
    // 弹反动作视觉提示：弧线特效
    if (this.player && this.player.active) {
      const angleToPlayer = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, this.player.x, this.player.y);
      this.enemyParryArcState.angle = angleToPlayer;
      this.enemyParryArcState.startProgress = 0;
      this.enemyParryArcState.endProgress = 0;
      this.enemyParryArcState.visible = true;

      this.tweens.add({
        targets: this.enemyParryArcState,
        endProgress: 1,
        duration: 150,
        ease: 'Linear',
        onComplete: () => {
          this.tweens.add({
            targets: this.enemyParryArcState,
            startProgress: 1,
            duration: 150,
            ease: 'Linear',
            onComplete: () => {
              this.enemyParryArcState.visible = false;
            }
          });
        }
      });
    }
  }

  private fireNormal() {
    let angle = this.playerAimAngle;
    // 冲锋套件：子弹散布
    if (this.activeKit === 'charge' && this.time.now < this.kitEffectEndTime) {
      angle += (Math.random() - 0.5) * CHARGE_KIT_SPREAD * 2;
    }
    const bullet = this.bullets.get(this.player.x, this.player.y) as Phaser.Physics.Arcade.Sprite | null;
    if (!bullet) return;

    bullet.enableBody(true, this.player.x, this.player.y, true, true);
    bullet.setTintFill(this.playerBulletColor);
    bullet.setDepth(3);
    bullet.setVelocity(Math.cos(angle) * BULLET_SPEED, Math.sin(angle) * BULLET_SPEED);
    bullet.setData('isCompanion', false); // 确保非伴生子弹被明确标记
    
    // 放大对撞命中体，增加双方子弹相撞概率
    if (bullet.body) {
      bullet.body.setSize(BULLET_SIZE + 14, BULLET_SIZE + 14).setOffset(-7, -7);
    }
  }
  
  private fireUltimate(speedMult = 1.0) {
    let angle = this.playerAimAngle;
    const bullet = this.ultimates.get(this.player.x, this.player.y) as Phaser.Physics.Arcade.Sprite | null;
    if (!bullet) return;

    // ----- 关键修复：清除从对象池复用时可能残留的旧发射器 -----
    const oldEmitter = bullet.getData('trailEmitter') as Phaser.GameObjects.Particles.ParticleEmitter;
    if (oldEmitter) {
      oldEmitter.stopFollow();
      oldEmitter.stop();
      oldEmitter.destroy();
      bullet.setData('trailEmitter', null);
    }
    const oldCoreEmitter = bullet.getData('trailCoreEmitter') as Phaser.GameObjects.Particles.ParticleEmitter;
    if (oldCoreEmitter) {
      oldCoreEmitter.stopFollow();
      oldCoreEmitter.stop();
      oldCoreEmitter.destroy();
      bullet.setData('trailCoreEmitter', null);
    }
    const oldSparkEmitter = bullet.getData('sparkEmitter') as Phaser.GameObjects.Particles.ParticleEmitter;
    if (oldSparkEmitter) {
      oldSparkEmitter.stopFollow();
      oldSparkEmitter.stop();
      oldSparkEmitter.destroy();
      bullet.setData('sparkEmitter', null);
    }
    // --------------------------------------------------------

    // 狙击套件 Stage 3：可选择锁定预测位置
    if (this.sniperKitActive && this.sniperKitStage >= 3 && (this as any)._sniperLockPred) {
      const px = (this as any)._sniperPredX, py = (this as any)._sniperPredY;
      if (px !== undefined && py !== undefined) {
        angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, px, py);
      }
    }

    bullet.enableBody(true, this.player.x, this.player.y, true, true);
    bullet.setDepth(3);
    const speed = ULTIMATE_SPEED * speedMult;
    // 高速弹防止隧穿：等比放大碰撞体
    if (bullet.body) {
      const extra = Math.ceil(speed / 60); // 覆盖一帧的位移量
      const s = ULTIMATE_SIZE + extra;
      bullet.body.setSize(s, s).setOffset(-extra / 2, -extra / 2);
    }
    bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    bullet.setData('nextCompanionSpawnTime', this.time.now);
    // 狙击套件发射后保持敌人冻结 500ms
    if (speedMult > 1.0) this.sniperFreezeUntil = this.time.now + 500;
    
    // 增加大招发射时的打击感
    this.cameras.main.shake(200, 0.03); // 强烈震屏
    this.hitStop(60); // 发射瞬间停顿
    this.cameras.main.flash(150, 255, 255, 255); // 白闪特效

    // 在大招子弹上挂载专属粒子发射器
    const skinData = loadSkin();
    const trailColor = skinData.trailColor ?? 0xffffff;
    const trailLifespan = skinData.trailLifespan !== undefined ? skinData.trailLifespan : 1200;

    let emitter: Phaser.GameObjects.Particles.ParticleEmitter;
    let coreEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    let sparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    
    // 子弹的初始角度赋值，使得视觉方向正确
    bullet.rotation = angle;
    // 使用传入的发射角度（弧度转角度）来控制所有粒子的旋转方向
    const angleDeg = angle * 180 / Math.PI;

    // 根据需求恢复：1. 红色连贯的实线激光中心； 2. 垂直于激光的空心紫色(或用户指定色)椭圆环； 3. 散落微粒
    
    // 1. 连续的深红实线激光 (采用等比例缩放与长条纹理，避免渲染变形)
    coreEmitter = this.add.particles(0, 0, 'ult_line', {
      speed: 0,
      scale: { start: 2.0, end: 1.0 }, // 使用统一缩放，长条矩形会直接整体变小，而不产生非对称形变
      alpha: { start: 1.0, end: 0.0 },   
      tint: 0xff0000, 
      blendMode: 'NORMAL',
      lifespan: trailLifespan * 0.9,
      frequency: 1, 
      quantity: 3, // 每频发3颗填补高速移动可能产生的位移间隙
      rotate: angleDeg
    });

    // 2. 垂直散布的空心椭圆波纹 (采用预先画好的垂直椭圆纹理 + 等比缩放)
    emitter = this.add.particles(0, 0, 'ult_ring_ellipse', {
      speed: 0,
      scale: { start: 2.5, end: 0 }, // 放大初始波纹，让椭圆环更大
      alpha: { start: 1.0, end: 0 },
      tint: trailColor, 
      blendMode: 'NORMAL',
      lifespan: trailLifespan * 0.8,
      frequency: 30, // 控制波纹生成间距
      rotate: angleDeg
    });

    // 3. 散落微粒
    sparkEmitter = this.add.particles(0, 0, 'ult_trail', {
      speed: { min: 20, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: trailColor,
      blendMode: 'NORMAL',
      lifespan: trailLifespan * 0.6,
      frequency: 15,
      gravityY: 0,
    });

    coreEmitter.setDepth(2); // 激光在底层
    sparkEmitter.setDepth(3);
    emitter.setDepth(4);     // 圆环在顶层，通过半透重叠实现“激光穿过圆环”的效果
    
    coreEmitter.startFollow(bullet);
    sparkEmitter.startFollow(bullet);
    emitter.startFollow(bullet);

    bullet.setData('trailEmitter', emitter);
    bullet.setData('trailCoreEmitter', coreEmitter);
    bullet.setData('sparkEmitter', sparkEmitter);

    // 玩家后坐力反冲
    this.applyPlayerKnockback(angle + Math.PI, 800);
  }

  private enemyFire(time: number) {
    if (!this.player || !this.player.active) return;
    // 测试模式：敌人不攻击
    if (this.gameMode === 'test') return;

    // 检查必杀技蓄力状态
    if (!this.isEnemyChargingUltimate && (time - this.lastEnemyUltimateFired >= ENEMY_ULTIMATE_FIRE_RATE * this.diffFireRateMult)) {
      this.isEnemyChargingUltimate = true;
      this.enemyChargeStartTime = time;
      this.playerMarkPendingRemove = false;
      this.enemyAimAngle = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, this.player.x, this.player.y);
    }
    
    if (this.isEnemyChargingUltimate) {
      // NPC 蓄力中
      const chargeDuration = time - this.enemyChargeStartTime;
      const progress = Math.min(chargeDuration / ULTIMATE_CHARGE_TIME, 1);
      
      const idealAngle = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, this.player.x, this.player.y);
      const aimInfo = this.getAimAngle(idealAngle, this.enemy.x, this.enemy.y, this.player, this.isPlayerMarked, this.enemyAimAngle, false);
      
      this.isEnemyAimLocked = aimInfo.locked;
      const diff = Phaser.Math.Angle.ShortestBetween(this.enemyAimAngle, aimInfo.angle);
      this.enemyAimAngle += diff * (aimInfo.locked ? 0.4 : 0.05);
      
      if (chargeDuration >= 400 && !this.enemyChargeCompleteSoundPlayed) {
        this.enemyChargeCompleteSoundPlayed = true;
        this.playChargeCompleteSound();
      }
      
      this.drawEnemyTrajectory(this.enemyAimAngle, progress);
      
      if (chargeDuration >= ULTIMATE_CHARGE_TIME) {
        this.fireEnemyUltimate();
        this.isEnemyChargingUltimate = false;
        this.enemyChargeCompleteSoundPlayed = false;
        this.enemyTrajectoryUI.clear();
        this.lastEnemyTrajectoryLength = -999;
        this.lastEnemyUltimateFired = time;
        this.lastEnemyFired = time; // 必杀技重置普攻冷却
        
        if (this.playerMarkPendingRemove) {
          this.isPlayerMarked = false;
          this.playerMarkPendingRemove = false;
        }
      }
      return; // 蓄力时无法普攻
    }

    // 普攻预测瞄准
    let targetX = this.player.x;
    let targetY = this.player.y;
    if (this.player.body) {
      const dist = Phaser.Math.Distance.Between(this.enemy.x, this.enemy.y, targetX, targetY);
      const timeToHit = dist / (ENEMY_BULLET_SPEED * this.diffSpeedMult);
      targetX += this.player.body.velocity.x * timeToHit;
      targetY += this.player.body.velocity.y * timeToHit;
    }
    const angle = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, targetX, targetY);

    // 普通攻击
    if (time - this.lastEnemyFired < ENEMY_FIRE_RATE * this.diffFireRateMult) return;
    this.lastEnemyFired = time;
    
    const bullet = this.enemyBullets.get(this.enemy.x, this.enemy.y) as Phaser.Physics.Arcade.Sprite | null;
    if (!bullet) return;
    
    bullet.enableBody(true, this.enemy.x, this.enemy.y, true, true);
    bullet.setDepth(3);
    bullet.setScale(1); // 恢复普攻大小
    bullet.setVelocity(Math.cos(angle) * ENEMY_BULLET_SPEED * this.diffSpeedMult, Math.sin(angle) * ENEMY_BULLET_SPEED * this.diffSpeedMult);
    // 放大对撞命中体，增加双方子弹相撞概率
    if (bullet.body) {
      bullet.body.setSize(ENEMY_BULLET_SIZE + 14, ENEMY_BULLET_SIZE + 14).setOffset(-7, -7);
    }
  }

  private fireEnemyUltimate() {
    const angle = this.enemyAimAngle;
    const ultimate = this.enemyUltimates.get(this.enemy.x, this.enemy.y) as Phaser.Physics.Arcade.Sprite | null;
    if (ultimate) {
      ultimate.enableBody(true, this.enemy.x, this.enemy.y, true, true);
      ultimate.setDepth(3);
      ultimate.setScale(2.5); // 放大表示必杀技
      ultimate.setVelocity(Math.cos(angle) * ENEMY_ULTIMATE_SPEED, Math.sin(angle) * ENEMY_ULTIMATE_SPEED);
      
      // 敌人发射必杀打击感
      this.cameras.main.shake(200, 0.03);
      this.hitStop(60);
      this.cameras.main.flash(150, 255, 100, 100); // 偏红的闪光
      
      // 敌人后坐力反冲
      this.applyEnemyKnockback(angle + Math.PI, 800, 200);
    }
  }

  private applyEnemyKnockback(angle: number, speed: number, duration: number = 120) {
    if (!this.enemy || !this.enemy.active) return;
    this.isEnemyKnockedBack = true;
    this.enemy.setAcceleration(0, 0);
    this.enemy.setMaxVelocity(3000);
    this.enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.enemy.setDrag(5000, 5000);
    
    if (this.enemyKnockbackTimer) {
      this.enemyKnockbackTimer.remove();
    }
    this.enemyKnockbackTimer = this.time.delayedCall(duration, () => {
      this.isEnemyKnockedBack = false;
      if (this.enemy && this.enemy.active) {
        this.enemy.setMaxVelocity(ENEMY_SPEED * this.diffSpeedMult);
        this.enemy.setDrag(ENEMY_DRAG, ENEMY_DRAG);
      }
    });
  }

  private applyPlayerKnockback(angle: number, speed: number) {
    if (!this.player || !this.player.active) return;
    this.isPlayerKnockedBack = true;
    this.player.setAcceleration(0, 0);
    this.player.setMaxVelocity(3000);
    this.player.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.player.setDrag(6000, 6000);
    
    if (this.playerKnockbackTimer) {
      this.playerKnockbackTimer.remove();
    }
    this.playerKnockbackTimer = this.time.delayedCall(120, () => {
      this.isPlayerKnockedBack = false;
      if (this.player && this.player.active) {
        this.player.setMaxVelocity(this.currentPlayerMaxSpeed);
        this.player.setDrag(PLAYER_DRAG, PLAYER_DRAG);
      }
    });
  }

  private directionalSquashTween(target: Phaser.Physics.Arcade.Sprite, hitAngle: number) {
    if (!target || !target.scene) return;
    this.tweens.killTweensOf(target);
    target.rotation = hitAngle; // 面向受击方向
    // 沿着子弹方向压扁，垂直方向拉伸
    target.setScale(0.6, 1.4);
    
    this.tweens.add({
      targets: target,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Elastic.easeOut',
      onComplete: () => {
        if (target && target.active) {
          target.setScale(1);
        }
      }
    });
  }

  private destroyBulletWithVFX(bullet: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.body) return;

    // 清理大招特效（先停发射，延迟销毁让粒子自然消散）
    this.stopBulletEmitters(bullet);

    // 如果是反弹弹，只清特效不回收（留给命中判断处理）
    if (bullet.getData('isReflected')) return;

    // 立即回收到对象池
    bullet.disableBody(true, true);
    bullet.setScale(1);
    bullet.setAlpha(1);
  }

  private hitStop(duration: number) {
    // 限制顿帧频率，防止连发击中导致物理引擎被无限期挂起（表现为严重卡顿）
    if (this.time.now - this.lastHitStopTime < 150) return;
    this.lastHitStopTime = this.time.now;

    if (this.hitStopTimer) {
      this.hitStopTimer.remove();
    }
    this.physics.pause();
    this.hitStopTimer = this.time.delayedCall(duration, () => {
      this.physics.resume();
    });
  }

  private handleEnemyPerfectDodge() {
    if (!this.hasEnemyPerfectDodged) {
      this.hasEnemyPerfectDodged = true;
      this.enemyPerfectDodgeBuff = true;
      
      const text = this.add.text(this.enemy.x, this.enemy.y - 40, 'PERFECT DODGE!', {
        fontFamily: 'monospace', fontSize: '24px', color: '#ff5500', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(200);
      
      this.tweens.add({
        targets: text,
        y: text.y - 60,
        alpha: 0,
        duration: 1200,
        ease: 'Cubic.easeOut',
        onComplete: () => text.destroy()
      });

      if (this.enemyPerfectDodgeTimer) this.enemyPerfectDodgeTimer.remove();
      this.enemyPerfectDodgeTimer = this.time.delayedCall(3000, () => {
        this.enemyPerfectDodgeBuff = false;
      });
    }
  }

  private onBulletClash(bulletObj: unknown, enemyBulletObj: unknown) {
    const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
    const enemyBullet = enemyBulletObj as Phaser.Physics.Arcade.Sprite;

    if (bullet && bullet.active) {
      this.destroyBulletWithVFX(bullet);
      this.whiteHitEmitter.explode(5, bullet.x, bullet.y);
    }
    
    if (enemyBullet && enemyBullet.active) {
      this.destroyBulletWithVFX(enemyBullet);
      this.whiteHitEmitter.explode(5, enemyBullet.x, enemyBullet.y);
    }
  }

  private meleeAttack() {
    // 简单的冷却或僵直限制，防止疯狂连按，暂借用普攻禁用的状态
    if (this.isNormalAttackDisabled) return;
    
    this.isNormalAttackDisabled = true;
    this.normalAttackDisableEndTime = this.time.now + 400;
    this.parryCooldown = this.time.now + 400;
    
    this.playerMeleeHitTime = this.time.now;
    
    // 检查是否发生拼刀 (Clash)
    if (Math.abs(this.playerMeleeHitTime - this.enemyMeleeHitTime) < 150 || this.isEnemyMeleeAttacking) {
      this.handleMeleeClash();
      return;
    }
    
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);

    // 玩家近战视觉特效（交叉剑痕）
    const slash1 = this.add.line(this.enemy.x, this.enemy.y, -30, -30, 30, 30, COLORS.player).setLineWidth(6).setDepth(20);
    const slash2 = this.add.line(this.enemy.x, this.enemy.y, -30, 30, 30, -30, COLORS.player).setLineWidth(6).setDepth(20);
    slash1.setRotation(angle);
    slash2.setRotation(angle);
    
    // 玩家近战强力顿帧与白闪
    this.hitStop(100);
    this.cameras.main.flash(150, 255, 255, 255);
    this.cameras.main.shake(150, 0.04);
    
    this.tweens.add({
      targets: [slash1, slash2],
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        slash1.destroy();
        slash2.destroy();
      }
    });

    if (dist <= 150) {
      if (this.playerNextMeleeWillStun) {
        this.playerNextMeleeWillStun = false;
        // 拼刀后连击命中惩罚
        this.applyEnemyKnockback(angle, 2500, 1000);
        this.isEnemyNormalAttackDisabled = true;
        this.enemyNormalAttackDisableEndTime = this.time.now + 2000;
      } else {
        // 普通近战命中
        this.applyEnemyKnockback(angle, 2000, 200);
        this.enemyHitEmitter.explode(30, this.enemy.x, this.enemy.y);
        
        this.enemyHp -= ENEMY_DAMAGE * 3;
        this.updateHUD();
        
        this.enemy.setTintFill(COLORS.white);
        this.time.delayedCall(100, () => {
          if (this.enemy && this.enemy.active) this.enemy.clearTint();
        });

        if (this.enemyHp <= 0) {
          this.defeatEnemy();
        }
      }
    }
  }

  private enemyMeleeAttack() {
    if (this.gameOver || !this.player || !this.enemy) return;

    this.isEnemyMeleeAttacking = true;
    this.lastEnemyMeleeTime = this.time.now;
    this.enemyMeleeHitTime = this.time.now;

    if (Math.abs(this.enemyMeleeHitTime - this.playerMeleeHitTime) < 150 || this.isNormalAttackDisabled) {
      this.isEnemyMeleeAttacking = false;
      this.handleMeleeClash();
      return;
    }

    const angle = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, this.player.x, this.player.y);
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);

    const slash1 = this.add.line(this.player.x, this.player.y, -30, -30, 30, 30, COLORS.enemy).setLineWidth(6).setDepth(20);
    const slash2 = this.add.line(this.player.x, this.player.y, -30, 30, 30, -30, COLORS.enemy).setLineWidth(6).setDepth(20);
    slash1.setRotation(angle);
    slash2.setRotation(angle);

    this.hitStop(100);
    this.cameras.main.flash(150, 255, 0, 0);
    this.cameras.main.shake(150, 0.04);

    this.tweens.add({
      targets: [slash1, slash2],
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        slash1.destroy();
        slash2.destroy();
      }
    });

    if (dist <= 150) {
      if (this.enemyNextMeleeWillStun) {
        this.enemyNextMeleeWillStun = false;
        this.applyPlayerKnockback(angle, 2500);
        this.isPlayerKnockedBack = true;
        this.player.setTintFill(COLORS.white);
        if (this.playerKnockbackTimer) this.playerKnockbackTimer.remove();
        this.playerKnockbackTimer = this.time.delayedCall(1000, () => {
          this.isPlayerKnockedBack = false;
          if (this.player && this.player.active) {
             this.player.clearTint();
          }
        });
        this.isNormalAttackDisabled = true;
        this.normalAttackDisableEndTime = this.time.now + 2000;
      } else {
        this.applyPlayerKnockback(angle, 1500);
        this.playerHitEmitter.explode(20, this.player.x, this.player.y);
      }
    }

    this.time.delayedCall(200, () => {
      this.isEnemyMeleeAttacking = false;
    });
  }

  private handleMeleeClash() {
    if (!this.player || !this.enemy) return;
    const midX = (this.player.x + this.enemy.x) / 2;
    const midY = (this.player.y + this.enemy.y) / 2;

    this.hitStop(200);
    this.cameras.main.flash(200, 255, 255, 255);
    this.cameras.main.shake(250, 0.05);

    const clashSpark = this.add.star(midX, midY, 5, 20, 40, 0xFFFF00).setDepth(25);
    this.tweens.add({
      targets: clashSpark,
      scaleX: 3,
      scaleY: 3,
      rotation: Math.PI,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => clashSpark.destroy()
    });

    this.parryCooldown = 0;
    this.lastEnemyMeleeTime = 0;
    this.isNormalAttackDisabled = false;
    this.isEnemyMeleeAttacking = false;
    this.playerNextMeleeWillStun = true;
    this.enemyNextMeleeWillStun = true;
  }

  private onUltimateClash(ultObj: unknown, enemyUltObj: unknown) {
    const ult = ultObj as Phaser.Physics.Arcade.Sprite;
    const enemyUlt = enemyUltObj as Phaser.Physics.Arcade.Sprite;
    if (ult && ult.active) {
      this.destroyBulletWithVFX(ult);
      this.whiteHitEmitter.explode(20, ult.x, ult.y);
    }
    if (enemyUlt && enemyUlt.active) {
      this.destroyBulletWithVFX(enemyUlt);
      this.whiteHitEmitter.explode(20, enemyUlt.x, enemyUlt.y);
    }
    // 必杀对撞震屏
    this.cameras.main.shake(300, 0.05);
    this.cameras.main.flash(200, 255, 255, 255);
  }

  private onUltimatePenetrateClash(ultObj: unknown, enemyBulletObj: unknown) {
    // 玩家必杀抵消敌人普攻，必杀继续飞行
    const enemyBullet = enemyBulletObj as Phaser.Physics.Arcade.Sprite;
    if (enemyBullet && enemyBullet.active) {
      this.destroyBulletWithVFX(enemyBullet);
      this.whiteHitEmitter.explode(5, enemyBullet.x, enemyBullet.y);
    }
  }

  private onEnemyUltimatePenetrateClash(enemyUltObj: unknown, bulletObj: unknown) {
    // 敌人必杀抵消玩家普攻，必杀继续飞行
    const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
    if (bullet && bullet.active) {
      this.destroyBulletWithVFX(bullet);
      this.whiteHitEmitter.explode(5, bullet.x, bullet.y);
    }
  }

  private onBulletHitEnemy(obj1: unknown, obj2: unknown) {
    if (this.isEnemyDashing) {
      this.handleEnemyPerfectDodge();
      return;
    }
    
    const bullet = (obj1 === this.enemy ? obj2 : obj1) as Phaser.Physics.Arcade.Sprite;
    
    // 如果敌人在极限闪避buff期，则无敌
    if (this.hasEnemyPerfectDodged && this.enemyPerfectDodgeBuff) {
      return; 
    }

    // 普攻命中敌人，重置玩家闪避冷却，允许连续闪避（回归原版无条件刷新手感）
    this.lastDashTime = 0;

    // 给敌人施加刚被命中标记
    this.isEnemyMarked = true;
    this.enemyMarkPendingRemove = false;
    if (this.enemyHitMarkTimer) this.enemyHitMarkTimer.remove();
    this.enemyHitMarkTimer = this.time.delayedCall(1000, () => {
      if (!this.isCharging) {
        this.isEnemyMarked = false;
      } else {
        this.enemyMarkPendingRemove = true;
      }
    });
    
    // 击退与强控制敌人
    if (bullet && bullet.body) {
      const angle = Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x);
      this.applyEnemyKnockback(angle, 1200, 300); // 增加控制时间到300ms
      this.enemyHitEmitter.explode(10, this.enemy.x, this.enemy.y);
      this.whiteHitEmitter.explode(10, this.enemy.x, this.enemy.y);
      this.directionalSquashTween(this.enemy, angle);
    }
    
    if (bullet && bullet.active) {
      this.destroyBulletWithVFX(bullet);
    }

    if (this.enemyHp <= 0) return; // 避免重复触发

    // 无尽模式：BOSS 只吃大招伤害，普攻仅标记+击退
    // 标准模式：普攻不造成伤害（原有逻辑）

    this.hitStop(40);
    this.cameras.main.shake(120, 0.015);

    // 受击长白闪
    this.enemy.setTintFill(COLORS.white);
    this.time.delayedCall(80, () => {
      if (this.enemy && this.enemy.active) this.enemy.clearTint();
    });
  }
  
  private onUltimateHitEnemy(obj1: unknown, obj2: unknown) {
    if (this.isEnemyDashing) {
      this.handleEnemyPerfectDodge();
      return;
    }
    
    const bullet = (obj1 === this.enemy ? obj2 : obj1) as Phaser.Physics.Arcade.Sprite;
    
    // 如果这是敌人发出的反弹大招（已经被玩家弹反回去的），不应该再被敌人弹反或造成对玩家的伤害逻辑
    // 并且如果这大招正在执行贝塞尔曲线（reflectTween），需要取消 tween 否则会继续强制移动
    const isReflected = bullet.getData('isReflected');
    if (isReflected) {
      const tween = bullet.getData('reflectTween') as Phaser.Tweens.Tween;
      if (tween) tween.stop();
    }
    
    // ----- 敌人弹反判定 -----
    if (this.isEnemyParrying && !isReflected) {
      this.enemyParrySuccess = true;
      const parryDuration = this.time.now - this.enemyParryStartTime;
      
      // 极限弹反 (<= 150ms)
      if (parryDuration <= 150) {
        this.cameras.main.flash(200, 255, 200, 0); // 橙闪
        this.cameras.main.shake(200, 0.04);
        this.hitStop(80);
        
        // 反弹大招回玩家
        if (bullet && bullet.body && this.player && this.player.active) {
          const backAngle = Phaser.Math.Angle.Between(bullet.x, bullet.y, this.player.x, this.player.y);
          bullet.setVelocity(Math.cos(backAngle) * ENEMY_ULTIMATE_SPEED * 1.5, Math.sin(backAngle) * ENEMY_ULTIMATE_SPEED * 1.5);
          bullet.setData('isReflected', true);
        }
        return; // 不受伤害、不击退
      } else {
        // 普通弹反 (> 150ms)
        this.cameras.main.flash(200, 255, 200, 0); // 橙闪
        this.cameras.main.shake(200, 0.03);
        
        this.isEnemyNormalAttackDisabled = true;
        this.enemyNormalAttackDisableEndTime = this.time.now + 3000;
        
        if (bullet && bullet.body) {
          const angle = Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x);
          this.applyEnemyKnockback(angle, 1500); // 大幅击退
        }
        if (bullet && bullet.active) {
          this.destroyBulletWithVFX(bullet);
        }
        return; // 抵消大招
      }
    }

    if (this.hasEnemyPerfectDodged && this.enemyPerfectDodgeBuff) {
      return; // 如果敌人在极限闪避buff期，则无敌
    }

    // 必杀命中敌人，重置玩家闪避冷却
    this.lastDashTime = 0;

    // 必杀击退力度更大
    if (bullet && bullet.body && !isReflected) {
      const angle = Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x);
      this.applyEnemyKnockback(angle, 1800);
      this.enemyHitEmitter.explode(30, this.enemy.x, this.enemy.y);
      this.whiteHitEmitter.explode(20, this.enemy.x, this.enemy.y);
      this.directionalSquashTween(this.enemy, angle);
    }
    
    if (bullet && bullet.active) {
      this.destroyBulletWithVFX(bullet);
    }
    
    if (this.enemyHp <= 0) return;

    // 无尽模式：大招一击必杀 BOSS
    if (this.gameMode === 'endless') {
      this.enemyHp = 0;
      this.updateHUD();
      this.hitStop(80);
      this.cameras.main.shake(200, 0.03);
      this.enemy.setTintFill(COLORS.white);
      this.time.delayedCall(100, () => {
        if (this.enemy && this.enemy.active) this.enemy.clearTint();
      });
      this.defeatEnemy();
      return;
    }

    this.enemyHp -= ULTIMATE_DAMAGE;
    this.updateHUD();

    this.hitStop(80);
    this.cameras.main.shake(200, 0.03);

    this.enemy.setTintFill(COLORS.white);
    this.time.delayedCall(100, () => {
      if (this.enemy && this.enemy.active) this.enemy.clearTint();
    });

    if (this.enemyHp <= 0) {
      this.defeatEnemy();
    }
  }
  
  private handlePerfectDodge() {
    if (!this.hasPerfectDodged) {
      this.hasPerfectDodged = true;
      this.perfectDodgeBuff = true;
      
      const text = this.add.text(this.player.x, this.player.y - 40, 'PERFECT DODGE!', {
        fontFamily: 'monospace', fontSize: '24px', color: '#00FFFF', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(200);
      
      this.tweens.add({
        targets: text,
        y: text.y - 60,
        alpha: 0,
        duration: 1200,
        ease: 'Cubic.easeOut',
        onComplete: () => text.destroy()
      });

      if (this.perfectDodgeTimer) this.perfectDodgeTimer.remove();
      this.perfectDodgeTimer = this.time.delayedCall(3000, () => {
        this.perfectDodgeBuff = false;
      });
    }
  }

  private onEnemyBulletHitPlayer(obj1: unknown, obj2: unknown) {
    if (this.isPlayerInvincible && this.isDashing) {
      this.handlePerfectDodge();
      return;
    }
    if (this.isPlayerInvincible || this.gameOver) return;

    const bullet = (obj1 === this.player ? obj2 : obj1) as Phaser.Physics.Arcade.Sprite;
    
    // 给玩家施加刚被命中标记
    this.isPlayerMarked = true;
    this.playerMarkPendingRemove = false;
    if (this.playerHitMarkTimer) this.playerHitMarkTimer.remove();
    this.playerHitMarkTimer = this.time.delayedCall(1000, () => {
      if (!this.isEnemyChargingUltimate) {
        this.isPlayerMarked = false;
      } else {
        this.playerMarkPendingRemove = true;
      }
    });
    
    if (bullet && bullet.body) {
      const angle = Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x);
      this.applyPlayerKnockback(angle, 1200);
      this.playerHitEmitter.explode(15, this.player.x, this.player.y);
      this.whiteHitEmitter.explode(10, this.player.x, this.player.y);
      this.directionalSquashTween(this.player, angle);
    }
    
    if (bullet && bullet.active) {
      this.destroyBulletWithVFX(bullet);
    }
    
  }

  private getParryCd(baseMs: number): number {
    return baseMs * (1 - (this.skillBuffs.parryCd || 0) * 0.2);
  }

  private startParry() {
    if ((this.time.now < this.parryCooldown && !this.modInfiniteParry) || this.isParrying || this.isDashing) return;
    
    // ----- 近战与弹反的逻辑分化 -----
    if (this.enemy && this.enemy.active) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
      if (dist <= 150) {
        this.meleeAttack();
        return; // 执行近战后，不进入弹反逻辑
      }
    }

    this.isParrying = true;
    this.parryStartTime = this.time.now;
    this.parrySuccess = false;
    
    // 弹反动作视觉提示：弧线特效
    if (this.enemy && this.enemy.active) {
      const angleToEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
      this.parryArcState.angle = angleToEnemy;
      this.parryArcState.startProgress = 0;
      this.parryArcState.endProgress = 0;
      this.parryArcState.visible = true;

      // 总长500ms的弹反判定窗口，完美弹反延长至250ms
      // 视觉上我们让弧线出现用250ms，消失用250ms
      // 第一阶段：结束端从头绘制到尾
      this.tweens.add({
        targets: this.parryArcState,
        endProgress: 1,
        duration: 250,
        ease: 'Linear',
        onComplete: () => {
          // 第二阶段：紧接着从头开始消失追上尾端
          this.tweens.add({
            targets: this.parryArcState,
            startProgress: 1,
            duration: 250,
            ease: 'Linear',
            onComplete: () => {
              this.parryArcState.visible = false;
              this.isParrying = false; // 结束弹反状态
              // 如果这 500ms 内没有成功弹反，进入冷却惩罚
              if (!this.parrySuccess) {
                this.parryCooldown = this.time.now + this.getParryCd(3000);
              }
            }
          });
        }
      });
    }
  }

  private onEnemyUltimateHitPlayer(obj1: unknown, obj2: unknown) {
    if (this.isPlayerInvincible && this.isDashing) {
      this.handlePerfectDodge();
      return;
    }
    if (this.isPlayerInvincible || this.gameOver) return;

    const bullet = (obj1 === this.player ? obj2 : obj1) as Phaser.Physics.Arcade.Sprite;

    const isReflected = bullet.getData('isReflected');
    if (isReflected) {
      const tween = bullet.getData('reflectTween') as Phaser.Tweens.Tween;
      if (tween) tween.stop();
    }

    // 弹反判定
    if (this.isParrying && !isReflected) {
      this.parrySuccess = true;
      const parryDuration = this.time.now - this.parryStartTime;
      
      // 极限弹反 (<= 250ms) 或 开启了无限完美弹反修改器
      if (parryDuration <= 250 || this.modPerfectParry) {
        this.cameras.main.flash(200, 255, 255, 255); // 白闪
        this.cameras.main.shake(300, 0.06); // 更强烈的震屏
        this.hitStop(150); // 更强烈的顿帧
        
        // 极限弹反：大招沿着弧线飞回敌人当前（或弹反瞬间的）位置
        if (bullet && bullet.body && this.enemy && this.enemy.active) {
          bullet.setData('isReflected', true);
          
          // 记录起点和目标点
          const startX = bullet.x;
          const startY = bullet.y;
          const targetX = this.enemy.x;
          const targetY = this.enemy.y;
          
          // 停止物理引擎原本的直线速度
          bullet.body.enable = false;
          bullet.setVelocity(0, 0);
          
          // 计算贝塞尔曲线控制点（向侧边偏移形成弧线）
          const dist = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
          const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);
          const cpDist = dist * 0.5; // 控制弧度高度
          const cpAngle = angle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
          const cpX = (startX + targetX) / 2 + Math.cos(cpAngle) * cpDist;
          const cpY = (startY + targetY) / 2 + Math.sin(cpAngle) * cpDist;
          
          // 使用 Tween 驱动子弹沿曲线飞行
          const curve = new Phaser.Curves.QuadraticBezier(
            new Phaser.Math.Vector2(startX, startY),
            new Phaser.Math.Vector2(cpX, cpY),
            new Phaser.Math.Vector2(targetX, targetY)
          );
          
          const flightDuration = dist / (ENEMY_ULTIMATE_SPEED * 1.5) * 1000;
          
          bullet.setData('reflectTween', this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: flightDuration,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
              if (bullet && bullet.active) {
                const t = tween.getValue() as number;
                const pos = curve.getPoint(t);
                if (pos) {
                  bullet.setPosition(pos.x, pos.y);
                }
                // 恢复碰撞体以重新触发判断
                if (bullet.body && !bullet.body.enable) bullet.body.enable = true;
              }
            }
          }));
        }
        return; // 不受伤害、不击退
      } else if (parryDuration <= 500) {
        // 普通弹反 (> 250ms 且 <= 500ms)
        this.cameras.main.flash(200, 255, 255, 0); // 黄闪
        this.cameras.main.shake(200, 0.03);
        
        this.isNormalAttackDisabled = true;
        this.normalAttackDisableEndTime = this.time.now + 3000;
        
        if (bullet && bullet.body) {
          const angle = Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x);
          this.applyPlayerKnockback(angle, 1500); // 大幅击退
        }
        if (bullet && bullet.active) {
          this.destroyBulletWithVFX(bullet);
        }
        return; // 抵消大招
      } else {
        // 弹反判定时间过期，遭受惩罚
        this.parryCooldown = this.time.now + this.getParryCd(3000);
      }
    }

    if (bullet && bullet.body && !isReflected) {
      const angle = Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x);
      this.applyPlayerKnockback(angle, 1800); // 必杀击退更强
      this.playerHitEmitter.explode(30, this.player.x, this.player.y);
      this.whiteHitEmitter.explode(20, this.player.x, this.player.y);
      this.directionalSquashTween(this.player, angle);
    }
    
    if (bullet && bullet.active) {
      this.destroyBulletWithVFX(bullet);
    }
    
    this.cameras.main.shake(200, 0.03);
    this.killPlayer(); // 被必杀击中一击毙命
  }
  
  private onEnemyHitPlayer(obj1: unknown, obj2: unknown) {
    if (this.isPlayerInvincible && this.isDashing) {
      this.handlePerfectDodge();
      return;
    }
    if (this.isPlayerInvincible || this.gameOver) return;
    
    // 给玩家施加刚被命中标记
    this.isPlayerMarked = true;
    this.playerMarkPendingRemove = false;
    if (this.playerHitMarkTimer) this.playerHitMarkTimer.remove();
    this.playerHitMarkTimer = this.time.delayedCall(1000, () => {
      if (!this.isEnemyChargingUltimate) {
        this.isPlayerMarked = false;
      } else {
        this.playerMarkPendingRemove = true;
      }
    });

    // 碰撞敌人仅击退，不致命（只有大招才致命）
    const angle = Math.atan2(this.player.y - this.enemy.y, this.player.x - this.enemy.x);
    this.applyPlayerKnockback(angle, 1200);
    this.playerHitEmitter.explode(15, this.player.x, this.player.y);
    this.whiteHitEmitter.explode(10, this.player.x, this.player.y);
    this.directionalSquashTween(this.player, angle);
    
  }
  
  private killPlayer() {
    if (!this.player || !this.player.active) return;
    if (this.isPlayerInvincible || this.gameOver) return;

    // 受到攻击时打断必杀技蓄力
    if (this.isCharging) {
      this.isCharging = false;
      this.chargeStartTime = 0;
      if (this.chargeUI) this.chargeUI.clear();
      if (this.trajectoryUI) this.trajectoryUI.clear();
      if (this.sniperKitActive) {
        this.sniperPredictGfx.clear();
        this.sniperEnemyHighlightGfx.clear();
        this.cleanupSniperKit();
      }
    }
    if (this.isEnemyChargingUltimate) {
      this.isEnemyChargingUltimate = false;
      if (this.enemyTrajectoryUI) {
        this.enemyTrajectoryUI.clear();
        this.lastEnemyTrajectoryLength = -999;
      }
    }

    this.hitStop(60);
    this.cameras.main.shake(150, 0.02);

    this.player.setTintFill(COLORS.white);
    this.time.delayedCall(80, () => {
      if (this.player && this.player.active) this.player.clearTint();
    });

    this.defeatPlayer();
  }

  // ========== 无尽模式小兵 AI ==========

  private updateDuplicateBosses(delta: number) {
    for (const dup of this.duplicateBosses) {
      if (!dup.active || !this.player || !this.player.active) continue;
      // 复制 BOSS 追击玩家
      const angle = Phaser.Math.Angle.Between(dup.x, dup.y, this.player.x, this.player.y);
      dup.setAcceleration(Math.cos(angle) * ENEMY_ACCEL * 0.5, Math.sin(angle) * ENEMY_ACCEL * 0.5);
    }
  }

  private updateMinions(delta: number, time: number) {
    const minions = this.minions.getChildren().filter((m: any) => m.active) as Phaser.Physics.Arcade.Sprite[];
    const speedMult = this.diffSpeedMult * (1 + (this.skillBuffs.speed || 0) * 0.05);
    const dmgMult = 1 + (this.skillBuffs.damage || 0) * 0.3;
    const frMult = Math.max(0.5, 1 - (this.skillBuffs.fireRate || 0) * 0.1);

    for (const m of minions) {
      if (!this.player || !this.player.active) continue;
      // 追击玩家
      const angle = Phaser.Math.Angle.Between(m.x, m.y, this.player.x, this.player.y);
      m.setAcceleration(Math.cos(angle) * ENEMY_ACCEL * 0.6, Math.sin(angle) * ENEMY_ACCEL * 0.6);
      m.setMaxVelocity(MINION_SPEED * speedMult, MINION_SPEED * speedMult);

      // 更新血条跟随
      if ((m as any).hpBar && (m as any).hpBar.active) {
        (m as any).hpBar.setPosition(m.x, m.y - 15);
      }

      // 射击：每个小兵独立计时
      const dist = Phaser.Math.Distance.Between(m.x, m.y, this.player.x, this.player.y);
      const lastFired = (m as any)._lastFired || 0;
      if (dist < 600 && time - lastFired > MINION_FIRE_RATE * frMult) {
        (m as any)._lastFired = time;
        const bullet = this.enemyBullets.get(m.x, m.y) as Phaser.Physics.Arcade.Sprite | null;
        if (bullet) {
          bullet.enableBody(true, m.x, m.y, true, true);
          bullet.setDepth(3);
          bullet.setScale(0.7);
          bullet.setVelocity(
            Math.cos(angle) * MINION_BULLET_SPEED * speedMult,
            Math.sin(angle) * MINION_BULLET_SPEED * speedMult
          );
        }
      }
    }
  }

  // ========== 无尽模式波次系统 ==========

  private updateWaveHUD() {
    if (this.waveHUD && this.waveHUD.active) {
      const bn = { dodge: '闪避', parry: '弹反', split: '分裂' }[this.bossType] || '';
      this.waveHUD.setText(`无尽模式\n第 ${this.waveNumber} 波 [${bn}]`);
    }
  }

  private startWave() {
    this.waveNumber++;
    this.waveState = 'fighting';
    this.updateWaveHUD();

    // BOSS 类型轮换
    const types: Array<'dodge' | 'parry' | 'split'> = ['dodge', 'parry', 'split'];
    this.bossType = types[this.bossTypeIndex % 3];
    this.bossTypeIndex++;
    const bossName = { dodge: '闪避型', parry: '弹反型', split: '分裂型' }[this.bossType];

    const minionCount = MINIONS_PER_WAVE_BASE + Math.floor((this.waveNumber - 1) * MINIONS_PER_WAVE_INCREASE);

    // 波次公告
    const announce = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, `第 ${this.waveNumber} 波`, {
      fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '48px', color: '#ff9933',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(70).setScrollFactor(0).setAlpha(0);

    const subText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `BOSS: ${bossName}`, {
      fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '24px', color: '#ff6633',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(70).setScrollFactor(0).setAlpha(0);

    this.tweens.add({
      targets: [announce, subText],
      alpha: 1, scaleX: 1.2, scaleY: 1.2,
      duration: 300, ease: 'Back.easeOut',
      yoyo: true, hold: 800,
      onComplete: () => { announce.destroy(); subText.destroy(); },
    });

    // 生成小兵（延迟，给公告让路）
    this.time.delayedCall(500, () => {
      for (let i = 0; i < minionCount; i++) {
        this.spawnMinion();
      }
    });

    // 生成 BOSS
    this.time.delayedCall(1000, () => {
      this.spawnBoss();
    });
  }

  private spawnMinion() {
    const edge = Phaser.Math.Between(0, 3);
    let x = 0, y = 0;
    const margin = 40;
    switch (edge) {
      case 0: x = GAME_WIDTH + margin; y = Phaser.Math.Between(margin, GAME_HEIGHT - margin); break;
      case 1: x = -margin; y = Phaser.Math.Between(margin, GAME_HEIGHT - margin); break;
      case 2: x = Phaser.Math.Between(margin, GAME_WIDTH - margin); y = GAME_HEIGHT + margin; break;
      case 3: x = Phaser.Math.Between(margin, GAME_WIDTH - margin); y = -margin; break;
    }

    const minion = this.physics.add.sprite(x, y, ASSET_KEYS.enemy);
    minion.setDisplaySize(MINION_SIZE, MINION_SIZE);
    minion.setTint(0xff8844); // 橙色区分小兵
    minion.setDepth(2);
    minion.setDrag(ENEMY_DRAG, ENEMY_DRAG);
    const spd = MINION_SPEED * this.diffSpeedMult;
    minion.setMaxVelocity(spd, spd);
    // 小兵血量随波次增长
    (minion as any).hp = Math.floor((MINION_HP + this.waveNumber * 0.5) * this.diffHpMult);
    (minion as any).isMinion = true;

    // 小兵血条
    const hpBar = this.add.text(minion.x, minion.y - 15, '▮'.repeat((minion as any).hp), {
      fontFamily: 'monospace', fontSize: '8px', color: '#ff8844'
    }).setOrigin(0.5, 1).setDepth(3);
    (minion as any).hpBar = hpBar;

    this.minions.add(minion);
  }

  private spawnBoss() {
    // 清理之前的重复 BOSS
    for (const dup of this.duplicateBosses) {
      if (dup && dup.active) dup.destroy();
    }
    this.duplicateBosses = [];
    if (this.splitBossTimer) { this.splitBossTimer.remove(); this.splitBossTimer = null; }

    this.enemy.setPosition(GAME_WIDTH - 150, GAME_HEIGHT / 2);
    this.enemy.setVisible(true).setActive(true);
    this.enemy.setDisplaySize(ENEMY_SIZE, ENEMY_SIZE);
    this.enemy.body!.setSize(ENEMY_SIZE, ENEMY_SIZE).setOffset(0, 0);
    this.enemy.setDrag(ENEMY_DRAG, ENEMY_DRAG);
    const bossSpeed = BOSS_SPEED_BASE + BOSS_SPEED_PER_WAVE * (this.waveNumber - 1);
    this.enemy.setMaxVelocity(bossSpeed * this.diffSpeedMult, bossSpeed * this.diffSpeedMult);
    this.currentEnemyMaxSpeed = bossSpeed * this.diffSpeedMult;
    // BOSS 只能大招击杀（普攻不扣血），HUD 用显示值
    this.enemyHp = (BOSS_BASE_HP + BOSS_HP_PER_WAVE * (this.waveNumber - 1)) * this.diffHpMult;
    this.gameOver = false;

    // BOSS 类型视觉
    const tintMap = { dodge: 0x3399ff, parry: 0xff5533, split: 0x9933ff };
    this.enemy.setTint(tintMap[this.bossType]);
    (this.enemy as any)._bossType = this.bossType;

    // 分裂型 BOSS：启动 30 秒分裂定时器
    if (this.bossType === 'split') {
      this.splitBossTimer = this.time.addEvent({
        delay: 30000, loop: true,
        callback: () => this.bossSplit(),
      });
    }

    // 闪避型/弹反型：确保难度允许 AI 技能
    if (this.bossType === 'dodge' || this.bossType === 'parry') {
      this.diffEnableEnemySkills = true;
    }
  }

  // 分裂型 BOSS：复制自身 + 额外 2 个小兵
  private bossSplit() {
    if (!this.enemy || !this.enemy.active || this.gameOver) return;
    // 创建复制 BOSS
    const dup = this.physics.add.sprite(
      this.enemy.x + Phaser.Math.Between(-80, 80),
      this.enemy.y + Phaser.Math.Between(-80, 80),
      ASSET_KEYS.enemy
    );
    dup.setDisplaySize(ENEMY_SIZE, ENEMY_SIZE);
    dup.setTint(0x9933ff);
    dup.setDepth(2);
    dup.setDrag(ENEMY_DRAG, ENEMY_DRAG);
    dup.setMaxVelocity(
      BOSS_SPEED_BASE + BOSS_SPEED_PER_WAVE * (this.waveNumber - 1),
      BOSS_SPEED_BASE + BOSS_SPEED_PER_WAVE * (this.waveNumber - 1)
    );
    (dup as any)._isDuplicate = true;
    this.duplicateBosses.push(dup);

    // 碰撞：玩家子弹命中复制 BOSS
    this.physics.add.overlap(this.bullets, dup, this.onBulletHitDuplicateBoss, undefined, this);
    this.physics.add.overlap(this.ultimates, dup, this.onUltimateHitDuplicateBoss, undefined, this);
    this.physics.add.overlap(this.player, dup, () => {
      const angle = Math.atan2(this.player.y - dup.y, this.player.x - dup.x);
      this.applyPlayerKnockback(angle, 1200);
    });

    // 额外生成 2 个小兵
    for (let i = 0; i < 2; i++) {
      this.spawnMinion();
    }

    // 视觉提示
    const text = this.add.text(dup.x, dup.y - 30, '分裂!', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ff00ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(200);
    this.tweens.add({
      targets: text, alpha: 0, y: text.y - 40, duration: 1000,
      onComplete: () => text.destroy(),
    });
  }

  private onBulletHitDuplicateBoss(_obj1: unknown, obj2: unknown) {
    const dup = obj2 as Phaser.Physics.Arcade.Sprite;
    if (!dup.active) return;
    dup.setTintFill(COLORS.white);
    this.time.delayedCall(80, () => { if (dup.active) dup.clearTint(); });
    // 复制 BOSS 也免疫普攻，只受大招伤害
  }

  private onUltimateHitDuplicateBoss(obj1: unknown, obj2: unknown) {
    const ult = obj1 as Phaser.Physics.Arcade.Sprite;
    const dup = obj2 as Phaser.Physics.Arcade.Sprite;
    if (!ult.active || !dup.active) return;
    // 复制 BOSS 被大招击中 → 直接消灭
    const cx = dup.x, cy = dup.y;
    dup.destroy();
    for (let i = 0; i < 8; i++) {
      const p = this.add.image(cx, cy, ASSET_KEYS.pixel).setDepth(4);
      p.setTint(0x9933ff);
      const a = (Math.PI * 2 * i) / 8;
      this.tweens.add({
        targets: p, x: cx + Math.cos(a) * 60, y: cy + Math.sin(a) * 60,
        alpha: 0, duration: 300, onComplete: () => p.destroy(),
      });
    }
    // 清理重复 BOSS 数组
    this.duplicateBosses = this.duplicateBosses.filter(d => d !== dup && d.active);
  }

  // 小兵碰撞处理
  private onBulletHitMinion(obj1: unknown, obj2: unknown) {
    const bullet = obj1 as Phaser.Physics.Arcade.Sprite;
    const minion = obj2 as Phaser.Physics.Arcade.Sprite;
    if (!bullet.active || !minion.active) return;
    bullet.setActive(false).setVisible(false);
    bullet.body?.enable && (bullet.body.enable = false);
    (minion as any).hp--;
    // 更新血条
    const remHp = Math.max(0, (minion as any).hp);
    if ((minion as any).hpBar) {
      ((minion as any).hpBar as Phaser.GameObjects.Text).setText('▮'.repeat(Math.max(1, remHp)));
    }
    if ((minion as any).hp <= 0) {
      // 小兵死亡碎裂
      const cx = minion.x, cy = minion.y;
      if ((minion as any).hpBar) ((minion as any).hpBar as Phaser.GameObjects.Text).destroy();
      minion.destroy();
      for (let i = 0; i < 8; i++) {
        const p = this.add.image(cx, cy, ASSET_KEYS.pixel).setDepth(4);
        p.setTint(0xff8844);
        const a = (Math.PI * 2 * i) / 8;
        const dist = Phaser.Math.Between(20, 60);
        this.tweens.add({
          targets: p, x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist,
          alpha: 0, duration: 300, ease: 'Linear',
          onComplete: () => p.destroy(),
        });
      }
      // 检查是否清完所有小兵+ boss
      this.checkEndlessWaveComplete();
    }
  }

  private onUltimateHitMinion(obj1: unknown, obj2: unknown) {
    const ult = obj1 as Phaser.Physics.Arcade.Sprite;
    const minion = obj2 as Phaser.Physics.Arcade.Sprite;
    if (!ult.active || !minion.active) return;
    (minion as any).hp = 0;
    const cx = minion.x, cy = minion.y;
    if ((minion as any).hpBar) ((minion as any).hpBar as Phaser.GameObjects.Text).destroy();
    minion.destroy();
    for (let i = 0; i < 12; i++) {
      const p = this.add.image(cx, cy, ASSET_KEYS.pixel).setDepth(4);
      p.setTint(0xff8844);
      const a = (Math.PI * 2 * i) / 12;
      this.tweens.add({
        targets: p, x: cx + Math.cos(a) * 80, y: cy + Math.sin(a) * 80,
        alpha: 0, duration: 300, onComplete: () => p.destroy(),
      });
    }
    this.checkEndlessWaveComplete();
  }

  private onMinionHitPlayer(obj1: unknown, obj2: unknown) {
    const player = obj1 as Phaser.Physics.Arcade.Sprite;
    const minion = obj2 as Phaser.Physics.Arcade.Sprite;
    if (!player.active || !minion.active) return;
    if (this.gameOver || this.isPlayerInvincible) return;
    if (this.isDashing) {
      this.handlePerfectDodge();
      return;
    }
    // 撞到小兵：击退 + 扣血
    const angle = Math.atan2(player.y - minion.y, player.x - minion.x);
    this.applyPlayerKnockback(angle, 800);
    this.playerHitEmitter?.explode(8, player.x, player.y);
  }

  private checkEndlessWaveComplete() {
    if (this.waveState !== 'fighting') return;
    // 检查是否还有小兵存活
    const aliveMinions = this.minions.getChildren().filter((m: any) => m.active);
    if (aliveMinions.length > 0) return;
    // 检查 BOSS 是否还活着
    if (this.enemy && this.enemy.active && this.enemy.visible) return;
    // BOSS 被击败
    this.showSkillSelection();
  }

  private showSkillSelection() {
    this.waveState = 'skillSelect';
    this.gameOver = true; // 暂停战斗
    if (this.player && this.player.active) this.player.setVelocity(0, 0);

    // 技能池：随机 3 选 1
    const dashCdLevel = (this.skillBuffs.dashCd || 0);
    const parryCdLevel = (this.skillBuffs.parryCd || 0);
    const allSkills = [
      { key: 'speed', name: '速度提升', desc: `移速 +5%`, icon: '👟' },
      { key: 'fireRate', name: '射速提升', desc: `射击间隔 -10%`, icon: '🔫' },
      { key: 'dashCd', name: '闪避冷却', desc: `闪避CD -15% (Lv${dashCdLevel + 1})`, icon: '💨' },
      { key: 'parryCd', name: '弹反冷却', desc: `弹反CD -20% (Lv${parryCdLevel + 1})`, icon: '🛡️' },
    ];
    // 随机选 3 个不重复
    const shuffled = [...allSkills].sort(() => Math.random() - 0.5);
    const skills = shuffled.slice(0, 3);

    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    // 清理上一次的面板对象
    this.clearSkillPanelObjects();

    // 半透明背景遮罩（拦截所有点击，防止穿透到游戏）
    const overlay = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setDepth(59).setInteractive().setScrollFactor(0);
    this.skillPanelObjects.push(overlay);

    const title = this.add.text(cx, cy - 130, `— 第 ${this.waveNumber} 波 通关 · 选择强化 —`, {
      fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '28px', color: '#ff9933'
    }).setOrigin(0.5).setDepth(60).setScrollFactor(0);
    title.setShadow(0, 0, '#ff9933', 10, true, true);
    this.skillPanelObjects.push(title);

    skills.forEach((skill, i) => {
      const bx = cx + (i - 1) * 200;
      const by = cy + 20;
      const bg = this.add.rectangle(bx, by, 170, 120, 0x111111, 1)
        .setStrokeStyle(2, 0x00e5ff, 0.8).setDepth(60).setInteractive({ useHandCursor: true }).setScrollFactor(0);
      const icon = this.add.text(bx, by - 25, skill.icon, { fontSize: '30px' }).setOrigin(0.5).setDepth(60).setScrollFactor(0);
      const nm = this.add.text(bx, by + 5, skill.name, {
        fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '18px', color: '#00e5ff'
      }).setOrigin(0.5).setDepth(60).setScrollFactor(0);
      const desc = this.add.text(bx, by + 30, skill.desc, {
        fontFamily: 'monospace', fontSize: '12px', color: '#aaaaaa'
      }).setOrigin(0.5).setDepth(60).setScrollFactor(0);

      bg.on('pointerover', () => bg.setFillStyle(0x003344));
      bg.on('pointerout', () => bg.setFillStyle(0x111111));
      bg.on('pointerdown', () => {
        this.selectSkill(skill.key);
      });

      this.skillPanelObjects.push(bg, icon, nm, desc);
    });
  }

  private clearSkillPanelObjects() {
    for (const obj of this.skillPanelObjects) {
      if (obj && obj.active !== false && 'destroy' in obj) obj.destroy();
    }
    this.skillPanelObjects = [];
  }

  private selectSkill(key: string) {
    this.chosenSkillKey = key;
    this.skillBuffs[key] = (this.skillBuffs[key] || 0) + 1;
    this.clearSkillPanelObjects();
    this.gameOver = false;

    // 显示提示
    const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `已选择: ${key}`, {
      fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '28px', color: '#00ff88'
    }).setOrigin(0.5).setDepth(70);
    this.tweens.add({
      targets: toast, alpha: 0, y: GAME_HEIGHT / 2 - 50, duration: 1500,
      onComplete: () => toast.destroy(),
    });

    // 延迟进入下一波
    this.time.delayedCall(1000, () => {
      this.clearBattlefield();
      this.startWave();
    });
  }

  private clearBattlefield() {
    // 清除所有子弹
    [this.bullets, this.enemyBullets, this.ultimates, this.enemyUltimates].forEach(group => {
      group.getChildren().forEach((child: any) => {
        if (child.active) {
          this.cleanupBulletEmitters(child as Phaser.Physics.Arcade.Sprite);
          child.setActive(false).setVisible(false);
          if (child.body) child.body.enable = false;
        }
      });
    });
  }

  private defeatEnemy() {
    // 无尽模式：不清除 gameOver，让玩家继续清剩余小兵
    // gameOver 由 showSkillSelection 设置
    if (this.gameMode !== 'endless') {
      this.gameOver = true;
    }
    if (this.enemy && this.enemy.active) this.enemy.setVelocity(0, 0);
    if (this.player && this.player.active) this.player.setVelocity(0, 0);

    if (this.enemyTrajectoryUI) {
      this.enemyTrajectoryUI.clear();
      this.lastEnemyTrajectoryLength = -999;
    }

    // 清理分裂定时器
    if (this.splitBossTimer) { this.splitBossTimer.remove(); this.splitBossTimer = null; }

    // 瞬间碎裂向外扩散
    const cx = this.enemy.x;
    const cy = this.enemy.y;
    this.enemy.setVisible(false).setActive(false);
    this.enemy.setPosition(-200, -200);

    for (let i = 0; i < 24; i++) {
      const p = this.add.image(cx, cy, ASSET_KEYS.pixel).setDepth(4);
      p.setTint(COLORS.enemy);
      const a = (Math.PI * 2 * i) / 24;
      const dist = Phaser.Math.Between(50, 150);
      this.tweens.add({
        targets: p,
        x: cx + Math.cos(a) * dist,
        y: cy + Math.sin(a) * dist,
        alpha: 0,
        duration: 500,
        ease: 'Linear',
        onComplete: () => p.destroy(),
      });
    }

    // 无尽模式：BOSS 死亡后检查波次完成（等小兵清完再弹技能选择）
    if (this.gameMode === 'endless') {
      this.time.delayedCall(600, () => {
        this.checkEndlessWaveComplete();
      });
    } else {
      this.time.delayedCall(800, () => {
        this.scene.start('GameOverScene', { win: true, mode: this.gameMode });
      });
    }
  }
  
  private defeatPlayer() {
    this.gameOver = true;
    this.player.setVelocity(0, 0);
    if (this.enemy.active) this.enemy.setVelocity(0, 0);
    
    if (this.enemyTrajectoryUI) {
      this.enemyTrajectoryUI.clear();
      this.lastEnemyTrajectoryLength = -999;
    }
    
    const cx = this.player.x;
    const cy = this.player.y;
    this.player.destroy();
    
    for (let i = 0; i < 24; i++) {
      const p = this.add.image(cx, cy, ASSET_KEYS.pixel).setDepth(4);
      p.setTint(COLORS.player);
      const a = (Math.PI * 2 * i) / 24;
      const dist = Phaser.Math.Between(50, 150);
      this.tweens.add({
        targets: p,
        x: cx + Math.cos(a) * dist,
        y: cy + Math.sin(a) * dist,
        alpha: 0,
        duration: 500,
        ease: 'Linear',
        onComplete: () => p.destroy(),
      });
    }
    
    this.time.delayedCall(800, () => {
      this.scene.start('GameOverScene', { win: false, mode: this.gameMode });
    });
  }

  private pauseGame() {
    this.scene.pause();
    this.scene.launch('PauseScene');
  }

  // 轨迹相交对撞检测：弥补高速子弹的隧道效应，大幅提升双方子弹对撞概率
  private checkBulletClash() {
    const pBullets = this.bullets.getChildren().filter((b) => b.active) as Phaser.Physics.Arcade.Sprite[];
    const eBullets = this.enemyBullets.getChildren().filter((b) => b.active) as Phaser.Physics.Arcade.Sprite[];
    if (pBullets.length === 0 || eBullets.length === 0) return;

    const threshold = 16; // 近距离触发阈值
    const thresholdSq = threshold * threshold;

    for (let i = 0; i < pBullets.length; i++) {
      const pb = pBullets[i];
      if (!pb.active) continue;
      const pbBody = pb.body as Phaser.Physics.Arcade.Body | null;
      const pvx = pbBody ? pbBody.velocity.x : 0;
      const pvy = pbBody ? pbBody.velocity.y : 0;

      for (let j = 0; j < eBullets.length; j++) {
        const eb = eBullets[j];
        if (!eb.active) continue;
        const ebBody = eb.body as Phaser.Physics.Arcade.Body | null;
        const evx = ebBody ? ebBody.velocity.x : 0;
        const evy = ebBody ? ebBody.velocity.y : 0;

        // 当前距离够近直接判定
        const dx = pb.x - eb.x;
        const dy = pb.y - eb.y;
        if (dx * dx + dy * dy <= thresholdSq) {
          this.onBulletClash(pb, eb);
          break;
        }

        // 检测两子弹本帧轨迹是否相交：用本帧移动前的位置（当前位置 - 速度*delta）
        // 近似为线段，检测两线段是否相交且交点足够近
        const dt = 1 / 60;
        const px0 = pb.x - pvx * dt, py0 = pb.y - pvy * dt;
        const ex0 = eb.x - evx * dt, ey0 = eb.y - evy * dt;
        if (this.segmentsIntersectNear(px0, py0, pb.x, pb.y, ex0, ey0, eb.x, eb.y, threshold)) {
          this.onBulletClash(pb, eb);
          break;
        }
      }
    }
  }

  // 判断两线段是否相交，且交点距离两线段均不超过 maxDist
  private segmentsIntersectNear(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number,
    maxDist: number
  ): boolean {
    const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
    if (Math.abs(d) < 0.0001) return false; // 平行
    const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
    const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
    if (t < 0 || t > 1 || u < 0 || u > 1) return false; // 不在线段范围内
    // 交点
    const ix = x1 + t * (x2 - x1);
    const iy = y1 + t * (y2 - y1);
    // 交点必须在两条线段上且足够近
    const d1Sq = (ix - x1) * (ix - x1) + (iy - y1) * (iy - y1);
    const d2Sq = (ix - x3) * (ix - x3) + (iy - y3) * (iy - y3);
    const maxSq = maxDist * maxDist;
    return d1Sq <= maxSq && d2Sq <= maxSq;
  }

  private cleanupBullets() {
    const maxDistSq = 1500 * 1500;
    const cx = this.cameras.main.midPoint.x;
    const cy = this.cameras.main.midPoint.y;

    // 普攻子弹：距离相机中心太远就回收
    [this.bullets, this.enemyBullets].forEach(group => {
      const children = group.getChildren();
      for (let i = 0; i < children.length; i++) {
        const bullet = children[i] as Phaser.Physics.Arcade.Sprite;
        if (bullet.active) {
          const dx = bullet.x - cx;
          const dy = bullet.y - cy;
          if (dx * dx + dy * dy > maxDistSq) {
            this.cleanupBulletEmitters(bullet);
            bullet.disableBody(true, true);
          }
        }
      }
    });

    // 大招：同时满足「在战斗矩形外」+「在视角外」才回收
    if (!this.player || !this.player.active || !this.enemy || !this.enemy.active) return;
    const COMBAT_MARGIN = 300;
    const VIEW_MARGIN = 200;
    const combatLeft = Math.min(this.player.x, this.enemy.x) - COMBAT_MARGIN;
    const combatRight = Math.max(this.player.x, this.enemy.x) + COMBAT_MARGIN;
    const combatTop = Math.min(this.player.y, this.enemy.y) - COMBAT_MARGIN;
    const combatBottom = Math.max(this.player.y, this.enemy.y) + COMBAT_MARGIN;
    const cam = this.cameras.main;
    const viewLeft = cam.scrollX - VIEW_MARGIN;
    const viewRight = cam.scrollX + GAME_WIDTH + VIEW_MARGIN;
    const viewTop = cam.scrollY - VIEW_MARGIN;
    const viewBottom = cam.scrollY + GAME_HEIGHT + VIEW_MARGIN;

    const shouldClean = (bullet: Phaser.Physics.Arcade.Sprite) => {
      const outsideCombat = bullet.x < combatLeft || bullet.x > combatRight
        || bullet.y < combatTop || bullet.y > combatBottom;
      const outsideView = bullet.x < viewLeft || bullet.x > viewRight
        || bullet.y < viewTop || bullet.y > viewBottom;
      return outsideCombat && outsideView;
    };

    [this.ultimates, this.enemyUltimates].forEach(group => {
      const children = group.getChildren();
      for (let i = 0; i < children.length; i++) {
        const bullet = children[i] as Phaser.Physics.Arcade.Sprite;
        if (bullet.active && shouldClean(bullet)) {
          this.cleanupBulletEmitters(bullet);
          bullet.disableBody(true, true);
        }
      }
    });
  }

  // 停止子弹上挂载的粒子发射器（用于命中时，粒子自然消散；保留引用让fireUltimate回收时销毁）
  private stopBulletEmitters(bullet: Phaser.Physics.Arcade.Sprite) {
    const keys = ['trailEmitter', 'trailCoreEmitter', 'sparkEmitter'];
    for (const key of keys) {
      const emitter = bullet.getData(key) as Phaser.GameObjects.Particles.ParticleEmitter | null;
      if (emitter) {
        emitter.stopFollow();
        emitter.stop();
      }
    }
  }

  // 立即清理子弹上挂载的粒子发射器（用于离屏回收/清场）
  private cleanupBulletEmitters(bullet: Phaser.Physics.Arcade.Sprite) {
    const keys = ['trailEmitter', 'trailCoreEmitter', 'sparkEmitter'];
    for (const key of keys) {
      const emitter = bullet.getData(key) as Phaser.GameObjects.Particles.ParticleEmitter | null;
      if (emitter) {
        emitter.stopFollow();
        emitter.stop();
        emitter.destroy();
        bullet.setData(key, null);
      }
    }
  }

  private updateCamera() {
    let targetX = this.player.x;
    let targetY = this.player.y;

    if (this.isCinematicFocus && this.enemy.active) {
      // 完美闪避慢放时，镜头聚焦在敌人或者两者中心偏敌人
      targetX = this.enemy.x;
      targetY = this.enemy.y;
    } else {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
      const threshold = 400;

      if (dist < threshold && this.enemy.active) {
        targetX = (this.player.x + this.enemy.x) / 2;
        targetY = (this.player.y + this.enemy.y) / 2;
      }
    }

    // 简单平滑插值移动摄像机
    const lerpFactor = this.isCinematicFocus ? 0.2 : 0.1;
    this.cameras.main.scrollX += (targetX - GAME_WIDTH / 2 - this.cameras.main.scrollX) * lerpFactor;
    this.cameras.main.scrollY += (targetY - GAME_HEIGHT / 2 - this.cameras.main.scrollY) * lerpFactor;
  }

  private updateMinimap() {
    this.minimapGraphics.clear();
    
    // 小地图的中心和半径，相对于屏幕左上角
    const cx = 80;
    const cy = 80;
    const radius = 60;
    
    // 背景
    this.minimapGraphics.fillStyle(0xffffff, 0.8);
    this.minimapGraphics.lineStyle(2, 0xcccccc, 1);
    this.minimapGraphics.fillRoundedRect(cx - radius, cy - radius, radius * 2, radius * 2, 8);
    this.minimapGraphics.strokeRoundedRect(cx - radius, cy - radius, radius * 2, radius * 2, 8);

    // 比例尺
    const scale = 0.05;

    // 玩家(中心点)
    this.minimapGraphics.fillStyle(COLORS.player, 1);
    this.minimapGraphics.fillCircle(cx, cy, 4);

    // 敌人
    if (this.enemy.active) {
      const dx = (this.enemy.x - this.player.x) * scale;
      const dy = (this.enemy.y - this.player.y) * scale;

      let drawX = cx + dx;
      let drawY = cy + dy;

      const distToCenter = Math.sqrt(dx * dx + dy * dy);
      if (distToCenter > radius - 4) {
        const ratio = (radius - 4) / distToCenter;
        drawX = cx + dx * ratio;
        drawY = cy + dy * ratio;
      }

      this.minimapGraphics.fillStyle(COLORS.enemy, 1);
      this.minimapGraphics.fillCircle(drawX, drawY, 4);
    }
  }

  private updateOutOfCombatPenalty(time: number, delta: number) {
    if (!this.enemy.active || this.gameOver) return;

    let isFleeing = false;
    // 使用玩家速度向量与（敌人到玩家方向）向量判断是否在逃跑
    if (this.player.body!.velocity.lengthSq() > 10) {
      const vx = this.player.body!.velocity.x;
      const vy = this.player.body!.velocity.y;
      const dx = this.enemy.x - this.player.x;
      const dy = this.enemy.y - this.player.y;
      const dot = vx * dx + vy * dy;
      if (dot < 0) {
        isFleeing = true;
      }
    }

    if (isFleeing) {
      this.outOfCombatTimer += delta;
    } else {
      // 只要没有在逃跑（如朝向敌人移动、或者没动），脱战计时就归零
      this.outOfCombatTimer = 0;
      this.isOutOfCombatPenalty = false;
    }

    if (this.outOfCombatTimer > 5000) {
      this.isOutOfCombatPenalty = true;
      // 将玩家设为标记状态，使其容易受到追踪技能打击
      this.isPlayerMarked = true;
    }
  }

  private dash() {
    const dashCooldown = DASH_COOLDOWN * (1 - (this.skillBuffs.dashCd || 0) * 0.15);
    if (this.time.now - this.lastDashTime < dashCooldown || this.isDashing || this.gameOver || !this.player || !this.player.active) return;
    
    if (this.comboDashValid) {
      this.comboDashCount++;
    } else {
      this.comboDashCount = 1;
    }
    
    this.comboDashValid = false;
    if (this.comboDashWindowTimer) {
      this.comboDashWindowTimer.remove();
      this.comboDashWindowTimer = null;
    }

    this.isDashing = true;
    this.lastDashTime = this.time.now;
    this.isPlayerInvincible = true;
    this.hasPerfectDodged = false;

    let dashAngle = this.playerAimAngle;
    
    // 如果玩家有移动输入或者有初速度，根据速度决定冲刺方向
    if (this.player.body!.velocity.lengthSq() > 10) {
      dashAngle = Math.atan2(this.player.body!.velocity.y, this.player.body!.velocity.x);
    }
    
    const vx = Math.cos(dashAngle) * DASH_SPEED;
    const vy = Math.sin(dashAngle) * DASH_SPEED;
    
    this.player.setMaxVelocity(DASH_SPEED, DASH_SPEED);
    this.player.setVelocity(vx, vy);

    // 添加摄像机短暂变焦增强速度感
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 0.96, // 轻微后拉
      duration: DASH_DURATION / 2,
      yoyo: true,
      ease: 'Sine.easeInOut'
    });

    this.time.delayedCall(DASH_DURATION, () => {
      this.isDashing = false;
      if (!this.gameOver && this.player && this.player.active) {
        this.player.setMaxVelocity(this.currentPlayerMaxSpeed, this.currentPlayerMaxSpeed);
      }
      if (!this.gameOver) {
        this.isPlayerInvincible = false;
      }
      
      this.comboDashValid = true;
      this.comboDashWindowTimer = this.time.delayedCall(800, () => {
        this.comboDashValid = false;
        this.comboDashCount = 0;
      });
    });
  }

  private createDashTrail() {
    if (!this.player || !this.player.active) return;

    // 每一帧都生成残影，使其连接成平滑的动态模糊轨迹
    const trail = this.add.sprite(this.player.x, this.player.y, ASSET_KEYS.player);
    
    // 获取当前运动方向
    let angle = this.player.rotation;
    if (this.player.body!.velocity.lengthSq() > 10) {
      angle = Math.atan2(this.player.body!.velocity.y, this.player.body!.velocity.x);
    }
    
    trail.setRotation(angle);
    trail.setTint(0x666666);
    trail.setAlpha(0.7);
    trail.setDepth(this.player.depth - 1);
    
    // 初始就沿着运动方向进行拉伸，产生速度模糊感
    trail.setScale(1.5, 0.8);
    
    this.tweens.add({
      targets: trail,
      alpha: 0,
      scaleX: 3.5, // 进一步向后拉长
      scaleY: 0.1, // 进一步压扁
      duration: DASH_DURATION + 50,
      ease: 'Power2',
      onComplete: () => {
        trail.destroy();
      }
    });
  }
}
