import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { KeyConfigScene } from './scenes/KeyConfigScene';
import { SkinEditorScene } from './scenes/SkinEditorScene';
import { ColorPickerScene } from './scenes/ColorPickerScene';
import { PauseScene } from './scenes/PauseScene';
import { StartScene } from './scenes/StartScene';
import VirtualJoystickPlugin from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin.js';

export function createGame(parent: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent,
    backgroundColor: '#0F0F0F',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    input: {
      activePointers: 3,
      disableContextMenu: true, // 彻底禁用右键菜单
    },
    plugins: {
      global: [
        {
          key: 'rexVirtualJoystick',
          plugin: VirtualJoystickPlugin,
          start: true,
        },
      ],
    },
    scene: [BootScene, StartScene, KeyConfigScene, ColorPickerScene, SkinEditorScene, GameScene, PauseScene, GameOverScene],
  };

  return new Phaser.Game(config);
}