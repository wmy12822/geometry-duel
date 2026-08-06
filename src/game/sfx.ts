// 音效模块 — Phaser Sound Manager + 真实音频文件
// 来源：原作《几何决斗》音效（pama1234 仓库，AGPL-3.0）+ Tabasco "Gunshot Sounds"（CC BY 3.0）
// 详见 public/audio/CREDITS.txt
// 统一走 Phaser Sound Manager（this.sound），自动处理移动端解锁与 per-sound 音量/detune。

import type Phaser from 'phaser';

const MUTED_KEY = 'gdp_muted_v1';

// 音频文件清单（由 sfx.loadAudioFiles 后台非阻塞加载），key -> public/ 相对路径
// 全部为 OGG Vorbis 单声道 44.1kHz，体积小、解码快（枪声由原始 WAV 转换而来）
export const SFX_FILES: Record<string, string> = {
  // 原作《几何决斗》
  mech_fire: 'audio/mech_fire.ogg', // 普攻/机械
  ult_fire: 'audio/ult_fire.ogg', // 大招发射
  bolt_arm: 'audio/bolt_arm.ogg', // 蓄力开始/拉栓
  charge_done: 'audio/charge_done.ogg', // 蓄力完成
  hit_metal: 'audio/hit_metal.ogg', // 命中/受伤
  // Tabasco 真实枪声（CC BY 3.0，由 WAV 转 OGG 压缩）
  pistol: 'audio/pistol.ogg',
  sks: 'audio/sks.ogg',
  mosin: 'audio/mosin.ogg',
  shotgun: 'audio/shotgun.ogg',
};

// 逻辑音效 -> 已加载 key 数组（播放时随机选一个 + 随机 detune，避免连射单调）
// 原则：连发/高频事件用《几何决斗》原作短音（mech_fire/hit_metal），绝不叠长枪声；
// 真实枪声只留给一次性事件（风爆爆炸、玩家死亡）。
export const SFX_KEYS: Record<string, readonly string[]> = {
  shoot: ['mech_fire'],        // 原作普攻（GUNMech），短促，连发不叠噪音
  enemyShoot: ['mech_fire'],   // 敌人射击同原作用音，随机 detune 区分
  ultFire: ['ult_fire'],       // 原作大招发射
  enemyDeath: ['hit_metal'],   // 原作命中音，短促，多敌连杀不爆
  windBoom: ['shotgun'],       // 风爆爆炸：真实枪声爆响（0.7s 短）
  impact: ['hit_metal'],       // 命中/受击
  dash: ['mech_fire'],         // 冲刺：机械动作音
  parryDeflect: ['hit_metal'], // 弹反
  chargeUp: ['bolt_arm'],      // 蓄力开始
  chargeComplete: ['charge_done'], // 蓄力完成
  playerDeath: ['shotgun'],    // 玩家死亡：短促枪声（不用 15s 长尾音）
};

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

// 同步静音状态到 Sound Manager（全局共享，一次设置即全局生效）
export function applyMute(scene: Phaser.Scene): void {
  scene.sound.mute = isMuted();
}

// 后台非阻塞加载音效（来源与许可见 public/audio/CREDITS.txt）
// 不在任何场景的 preload 里阻塞加载：菜单/游戏秒开，音频在后台逐个 fetch+decode，
// 完成后写入全局 Audio Cache（scene.sound.play 直接可用）。
// 单个文件失败/超时只影响该音效，绝不影响游戏本身。
const AUDIO_DECODE_TIMEOUT_MS = 15000;

// 正在后台解码的音效（key -> 恒 resolve 的 Promise）。play 时若该 key 仍在解码，
// 会等它加载完成再播（首次点击最多延迟几百毫秒），绝不丢声。
const pendingAudio = new Map<string, Promise<void>>();

export function loadAudioFiles(scene: Phaser.Scene): void {
  const ctx = scene.sound.context; // WebAudio AudioContext（NoAudio 环境下为 null）
  if (!ctx) return;

  const entries = Object.entries(SFX_FILES);

  entries.forEach(([key, url]) => {
    // 已在缓存（如回到菜单重复进入 create）则跳过，避免重复 fetch
    if (scene.cache.audio.exists(key)) return;
    // 已在加载中（BootScene 与 StartScene 都调用时）
    if (pendingAudio.has(key)) return;

    const decode = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => ctx.decodeAudioData(buf))
      .then((audioBuffer) => {
        scene.cache.audio.add(key, audioBuffer);
        // eslint-disable-next-line no-console
        console.log(`[sfx] loaded ${key}`);
      })
      .catch((e) => {
        // 单个文件失败不抛给全局，仅记录；该音效缺失但游戏正常
        console.warn(`[sfx] failed ${key}:`, e?.message ?? e);
      });

    // 单文件超时兜底：个别浏览器 decodeAudioData 可能长时间不回调
    const p = Promise.race([
      decode,
      new Promise<void>((resolve) => setTimeout(() => resolve(), AUDIO_DECODE_TIMEOUT_MS)),
    ]);
    pendingAudio.set(key, p);
    p.then(() => pendingAudio.delete(key));
  });
}

// 播放单个音效；静音时忽略。
// 关键：key 尚未解码完成时绝不抛错（Phaser 对缺 key 的 play 会 throw），
// 而是等加载完成再播；完全未知的 key 则静默跳过。
export function playSFX(scene: Phaser.Scene, name: string, opts?: { volume?: number; detune?: number }): void {
  if (isMuted()) return;
  const cfg = { volume: opts?.volume ?? 1, detune: opts?.detune ?? 0 };

  // 仍在后台解码：等它加载完再播（保证首次点击也有声音）
  const pending = pendingAudio.get(name);
  if (pending) {
    pending.then(() => {
      if (scene.cache.audio.exists(name)) scene.sound.play(name, cfg);
    });
    return;
  }

  if (!scene.cache.audio.exists(name)) return; // 未知 key / 加载失败：静默跳过
  scene.sound.play(name, cfg);
}

// 通用 UI 点击音（菜单/按钮）：超短机械"哒"声，各界面统一调用
export function uiClick(scene: Phaser.Scene, volume = 0.5): void {
  playSFX(scene, SFX_KEYS.shoot[0], { volume });
}

// 从一组变体中随机选一个播放，并加随机 detune（±70 cents），适合高频重复音效
export function playRandom(
  scene: Phaser.Scene,
  keys: readonly string[],
  opts?: { volume?: number; detune?: number },
): void {
  if (isMuted()) return;
  const key = keys[Math.floor(Math.random() * keys.length)];
  // 复用 playSFX 的"等加载完成再播/静默跳过"逻辑，高频连发也不抛错
  playSFX(scene, key, {
    volume: opts?.volume ?? 1,
    detune: opts?.detune ?? Math.floor(Math.random() * 141) - 70,
  });
}
