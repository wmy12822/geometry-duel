# 战斗系统

2D 像素几何射击对战游戏，基于 Phaser 3 + React + TypeScript 构建。

## 玩法

- **几何定制** — 16×16 像素网格自定义角色外形 + 16 色调色板
- **弹幕射击** — 2D 顶部视角双人对战
- **武器套件** — 冲锋枪 / 狙击模式（多段蓄力 + 预测锁定）
- **必杀技** — 蓄力释放高伤害大招
- **闪避 Dash** — 快速位移躲避弹幕
- **无尽模式** — 小兵 + BOSS 波次递增

## 操控

| 操作 | 键盘 | 触屏 |
|------|------|------|
| 移动 | WASD | 虚拟摇杆 |
| 射击 | 鼠标点击 | 触屏点击 |
| 闪避 | 空格 | 双击 |
| 必杀技 | 长按鼠标 | 长按屏幕 |
| 武器套件 | Q/E | 按钮 |

## 技术栈

- **Phaser 3** — 2D 游戏引擎
- **React 19** — UI 容器
- **TypeScript** — 类型安全
- **Vite** — 构建工具
- **Tailwind CSS** — 样式

## 开发

```bash
npm install
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

## 音效来源

- **《几何决斗》原始音效** — 来自开源仓库 `pama1234/just-some-other-libgdx-game`（game0003），该仓库为 **GNU AGPL v3.0** 许可；文件 `mech_fire/ult_fire/bolt_arm/charge_done/hit_metal.ogg`。来源：https://github.com/pama1234/just-some-other-libgdx-game
- **Gunshot Sounds** by Vincent Sevedge — OpenGameArt，**CC BY 3.0**；文件 `pistol/mosin/sks/shotgun.ogg`（由原始 WAV 转为单声道 OGG 压缩）。来源：https://opengameart.org/content/gunshot-sounds

详细说明见 `public/audio/CREDITS.txt`。

## 许可

Private — 个人项目
