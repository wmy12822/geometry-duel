import { useEffect, useRef, type FC } from 'react';
import Phaser from 'phaser';
import { createGame } from './game/main';

/** 原 Phaser 游戏入口。博物馆 Agent 前端改用 museum_agent.py 内嵌 HTML。 */

const App: FC = () => {
  const parentRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !parentRef.current) return;
    const game: Phaser.Game = createGame(parentRef.current);
    initialized.current = true;

    return () => {
      game.destroy(true);
      initialized.current = false;
    };
  }, []);

  return (
    <div className="w-full h-full bg-[#0F0F11] flex items-center justify-center overflow-hidden">
      <div ref={parentRef} className="w-full h-full" />
    </div>
  );
};

export default App;
