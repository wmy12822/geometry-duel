// 游戏全局常量配置

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

// 玩家
export const PLAYER_SPEED = 450; // 此处可视为最大速度
export const PLAYER_ACCEL = 6000; // 加速度
export const PLAYER_DRAG = 5000; // 阻尼减速度
export const PLAYER_SIZE = 28;
export const PLAYER_HITBOX = 16;
export const DASH_SPEED = 2400; // 闪避冲刺速度
export const DASH_DURATION = 150; // 闪避冲刺持续时间（毫秒）
export const DASH_COOLDOWN = 1200; // 闪避冲刺冷却时间（毫秒）

// 子弹
export const BULLET_SPEED = 900;
export const BULLET_SIZE = 8;
export const FIRE_RATE = 220; // 毫秒

// 必杀技
export const ULTIMATE_CHARGE_TIME = 500; // 蓄力毫秒
export const ULTIMATE_SPEED = 2400;
export const ULTIMATE_SIZE = 24;
export const ULTIMATE_DAMAGE = 999;

// 敌人 NPC
export const ENEMY_SPEED = 300;
export const ENEMY_ACCEL = 3500; // 敌人加速度
export const ENEMY_DRAG = 3000; // 敌人阻尼
export const ENEMY_SIZE = 34;
export const ENEMY_HP = 15;
export const ENEMY_DAMAGE = 10; // 对玩家造成伤害
export const ENEMY_FIRE_RATE = 220; // 敌人射击间隔（毫秒），与玩家一致
export const ENEMY_BULLET_SPEED = 900; // 敌人子弹速度，与玩家一致
export const ENEMY_BULLET_SIZE = 10; // 敌人子弹大小

// 敌人必杀技
export const ENEMY_ULTIMATE_FIRE_RATE = 3000; // 敌人必杀技间隔
export const ENEMY_ULTIMATE_SPEED = 2400; // 与玩家一致
export const ENEMY_ULTIMATE_SIZE = 24; // 与玩家一致

// 无尽模式 - 小兵
export const MINION_HP = 3;
export const MINION_SPEED = 250;
export const MINION_SIZE = 20;
export const MINION_DAMAGE = 5;
export const MINION_FIRE_RATE = 500;
export const MINION_BULLET_SPEED = 700;
export const MINION_BULLET_SIZE = 6;

// 无尽模式 - BOSS（每关加成）
export const BOSS_BASE_HP = 20;
export const BOSS_HP_PER_WAVE = 5;
export const BOSS_SPEED_BASE = 280;
export const BOSS_SPEED_PER_WAVE = 15;
export const MINIONS_PER_WAVE_BASE = 2;
export const MINIONS_PER_WAVE_INCREASE = 1;

// 武器套件系统
export const WEAPON_WHEEL_LONG_PRESS = 400; // 长按触发轮盘毫秒
export const WEAPON_WHEEL_RADIUS = 120; // 轮盘半径
export const WEAPON_KIT_DURATION = 10000; // 套件效果持续毫秒
export const WEAPON_KIT_COOLDOWN = 20000; // 套件冷却毫秒
export const CHARGE_KIT_FIRE_RATE = 60; // 冲锋套件射击间隔
export const CHARGE_KIT_SPREAD = 0.26; // 冲锋套件子弹散布（弧度，约±15度）

// 狙击套件
export const SNIPER_KIT_MIN_CHARGE = 800; // 最低蓄力时间ms
export const SNIPER_STAGE1_TIME = 1500; // 第一阶段触发时间ms（慢放开始+镜头变焦）
export const SNIPER_STAGE2_TIME = 2500; // 第二阶段触发时间ms（暗角+弹速1.5x）
export const SNIPER_STAGE3_TIME = 4000; // 第三阶段触发时间ms（预测锁定+弹速2.5x）
export const SNIPER_SPEED_MULT_STAGE2 = 1.5; // 第二阶段弹速倍率
export const SNIPER_SPEED_MULT_STAGE3 = 2.5; // 第三阶段弹速倍率
export const SNIPER_PREDICT_TIME = 0.3; // 预测提前量（秒）

// 风爆技能
export const WIND_BURST_TIMESCALE = 0.06; // 慢放倍率
export const WIND_BURST_AOE_INNER_R = 120; // AoE内圈半径
export const WIND_BURST_AOE_MIDDLE_R = 240; // AoE中圈半径
export const WIND_BURST_AOE_OUTER_R = 360; // AoE外圈半径
export const WIND_BURST_CONFIRM_DEADZONE = 25; // 确认死区(px)
export const WIND_BURST_STUN_DURATION = 800; // 击退结束后的僵直时长(ms)
export const WIND_BURST_AOE_ANIM_DURATION = 600; // AoE动画时长(ms)
export const WIND_BURST_CAMERA_ZOOM = 0.7; // 技能启用时镜头拉远倍率
export const WIND_BURST_CROSSHAIR_COLOR_GREEN = 0x00ff88;
export const WIND_BURST_CROSSHAIR_COLOR_RED = 0xff2222;

// 颜色（纯色，无渐变）
export const COLORS = {
  bg: 0xffffff, // 纯白
  player: 0x000000, // 纯黑
  enemy: 0xff3333, // 警示红
  bullet: 0x000000, // 黑色子弹
  ultimate: 0xff3333, // 必杀技红色
  enemy_bullet: 0xff3333, // 敌人红色子弹
  white: 0xffffff,
  grid: 0x1a1a2e, // 网格点阵色
  grid_dot: 0x2a2a4a, // 网格交点
  grid_bg: 0x0a0a14, // 深色底
  black: 0x000000, // 纯黑色文字及边框
};