import { GAME_WIDTH, GAME_HEIGHT } from './constants';

// 按键配置：位置、大小、透明度
export interface KeyButtonConfig {
  x: number;
  y: number;
  size: number; // 宽高（正方形），摇杆为直径
  alpha: number; // 透明度 0~1
}

export interface KeyLayoutConfig {
  joystick: KeyButtonConfig;
  z: KeyButtonConfig;
  x: KeyButtonConfig;
  c: KeyButtonConfig;
  v: KeyButtonConfig;
  w: KeyButtonConfig; // 武器轮盘
}

// PC 键盘绑定
export interface PCKeyBindings {
  moveUp: string;
  moveDown: string;
  moveLeft: string;
  moveRight: string;
  attack: string;
  ultimate: string;
  dash: string;
  parry: string;
  pause: string;
}

export const DEFAULT_PC_BINDINGS: PCKeyBindings = {
  moveUp: 'W',
  moveDown: 'S',
  moveLeft: 'A',
  moveRight: 'D',
  attack: 'Z',
  ultimate: 'X',
  dash: 'Space',
  parry: 'V',
  pause: 'ESC',
};

// 控制模式
export type ControlMode = 'mobile' | 'pc';

const STORAGE_KEY = 'gdp_key_layout_v1';
const PC_BINDINGS_KEY = 'gdp_pc_bindings_v1';
const CONTROL_MODE_KEY = 'gdp_control_mode_v1';

export const DEFAULT_KEY_LAYOUT: KeyLayoutConfig = {
  joystick: { x: 120, y: GAME_HEIGHT - 120, size: 120, alpha: 0.25 },
  z: { x: GAME_WIDTH - 180, y: GAME_HEIGHT - 80, size: 60, alpha: 1 },
  x: { x: GAME_WIDTH - 80, y: GAME_HEIGHT - 80, size: 60, alpha: 1 },
  c: { x: GAME_WIDTH - 130, y: GAME_HEIGHT - 160, size: 60, alpha: 1 },
  v: { x: GAME_WIDTH - 80, y: GAME_HEIGHT - 170, size: 60, alpha: 1 },
  w: { x: 55, y: GAME_HEIGHT - 200, size: 48, alpha: 0.9 },
};

export function loadKeyLayout(): KeyLayoutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        joystick: { ...DEFAULT_KEY_LAYOUT.joystick, ...parsed.joystick },
        z: { ...DEFAULT_KEY_LAYOUT.z, ...parsed.z },
        x: { ...DEFAULT_KEY_LAYOUT.x, ...parsed.x },
        c: { ...DEFAULT_KEY_LAYOUT.c, ...parsed.c },
        v: { ...DEFAULT_KEY_LAYOUT.v, ...parsed.v },
        w: { ...DEFAULT_KEY_LAYOUT.w, ...parsed.w },
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_KEY_LAYOUT };
}

export function saveKeyLayout(config: KeyLayoutConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

export function loadPCBindings(): PCKeyBindings {
  try {
    const raw = localStorage.getItem(PC_BINDINGS_KEY);
    if (raw) return { ...DEFAULT_PC_BINDINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PC_BINDINGS };
}

export function savePCBindings(bindings: PCKeyBindings): void {
  try {
    localStorage.setItem(PC_BINDINGS_KEY, JSON.stringify(bindings));
  } catch { /* ignore */ }
}

export function loadControlMode(): ControlMode {
  try {
    const raw = localStorage.getItem(CONTROL_MODE_KEY);
    if (raw === 'pc' || raw === 'mobile') return raw;
  } catch { /* ignore */ }
  return 'mobile';
}

export function saveControlMode(mode: ControlMode): void {
  try {
    localStorage.setItem(CONTROL_MODE_KEY, mode);
  } catch { /* ignore */ }
}

// 键盘 keyCode 到可读名称的映射
export const KEY_NAME_MAP: Record<string, string> = {
  'W': 'W', 'A': 'A', 'S': 'S', 'D': 'D',
  'Z': 'Z', 'X': 'X', 'C': 'C', 'V': 'V',
  'Q': 'Q', 'E': 'E', 'R': 'R', 'F': 'F',
  'Space': 'Space', 'Shift': 'Shift', 'Ctrl': 'Ctrl',
  'ESC': 'ESC', 'Tab': 'Tab',
  '1': '1', '2': '2', '3': '3', '4': '4',
  'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
  'MouseLeft': '鼠标左', 'MouseRight': '鼠标右',
};
