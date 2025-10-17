import React, { useState, useEffect, useRef } from 'react';
import { Target, Heart, TrendingUp, Award, Clock } from 'lucide-react';

export default function AimTrainerGame() {
  const [gameState, setGameState] = useState('menu'); // menu, playing, gameover
  const [targets, setTargets] = useState([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [clicks, setClicks] = useState([]);
  const [gameTime, setGameTime] = useState(0);
  const [difficulty, setDifficulty] = useState(1);
  
  const gameAreaRef = useRef(null);
  const timerRef = useRef(null);
  const spawnIntervalRef = useRef(null);

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setLives(3);
    setClicks([]);
    setTargets([]);
    setGameTime(0);
    setDifficulty(1);
    
    // Start spawning targets continuously
    setTimeout(() => {
      spawnTarget();
      startSpawning(1500);
    }, 100);
  };

  const startSpawning = (interval) => {
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
    }
    spawnIntervalRef.current = setInterval(() => {
      spawnTarget();
    }, interval);
  };

  const spawnTarget = () => {
    if (!gameAreaRef.current) return;
    
    const area = gameAreaRef.current.getBoundingClientRect();
    const initialSize = Math.max(50, 100 - difficulty * 5);
    
    const newTarget = {
      id: Date.now() + Math.random(),
      x: Math.random() * (area.width - initialSize),
      y: Math.random() * (area.height - initialSize),
      initialSize: initialSize,
      currentSize: initialSize,
      spawnTime: Date.now(),
      shrinkRate: 0.3 + (difficulty * 0.05) // Shrinks faster as difficulty increases
    };

    setTargets(prev => [...prev, newTarget]);
  };

  const handleTargetClick = (target, e) => {
    e.stopPropagation();
    
    if (gameState !== 'playing') return;
    
    const clickTime = Date.now();
    const reactionTime = clickTime - target.spawnTime;
    
    setClicks(prev => [...prev, {
      targetId: target.id,
      reactionTime: reactionTime,
      timestamp: clickTime
    }]);

    setTargets(prev => prev.filter(t => t.id !== target.id));
    setScore(s => s + 1);
    
    // Increase difficulty every 5 hits - spawn targets faster
    if ((score + 1) % 5 === 0) {
      setDifficulty(d => {
        const newDiff = d + 1;
        // Spawn targets more frequently as difficulty increases
        const newInterval = Math.max(500, 1500 - (newDiff * 150));
        startSpawning(newInterval);
        return newDiff;
      });
    }
  };

  // Animate targets shrinking and remove when too small
  useEffect(() => {
    if (gameState !== 'playing') return;

    const animationInterval = setInterval(() => {
      setTargets(prev => {
        const updated = prev.map(target => ({
          ...target,
          currentSize: Math.max(0, target.currentSize - target.shrinkRate)
        }));

        // Remove targets that are too small and deduct lives
        const filtered = updated.filter(target => {
          if (target.currentSize <= 10) {
            setLives(l => Math.max(0, l - 1));
            return false;
          }
          return true;
        });

        return filtered;
      });
    }, 16); // ~60fps

    return () => clearInterval(animationInterval);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setGameTime(t => t + 1);
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
      };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
    }
  }, [gameState]);

  useEffect(() => {
    if (lives <= 0 && gameState === 'playing') {
      setGameState('gameover');
      setTargets([]);
    }
  }, [lives, gameState]);

  const getAverageReaction = () => {
    if (clicks.length === 0) return 0;
    return Math.round(clicks.reduce((a, b) => a + b.reactionTime, 0) / clicks.length);
  };

  const getAccuracy = () => {
    if (clicks.length === 0) return 0;
    const totalTargets = score + (3 - lives);
    return Math.round((score / totalTargets) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-4">
      {gameState === 'menu' && (
        <div className="text-center">
          <div className="mb-8">
            <Target className="text-yellow-400 mx-auto mb-4" size={80} />
            <h1 className="text-6xl font-bold text-white mb-4">Clicking Game</h1>
            <p className="text-xl text-gray-300 mb-2">Test your reaction time and hand-eye coordination!</p>
            <p className="text-lg text-gray-400">Click the targets before they shrink away</p>
          </div>
          
          <button
            onClick={startGame}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-12 py-4 rounded-xl text-2xl font-bold hover:scale-105 transform transition shadow-2xl"
          >
            Start Game
          </button>

          <div className="mt-8 bg-gray-800 bg-opacity-50 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-white text-xl font-bold mb-3">How to Play</h3>
            <ul className="text-gray-300 text-left space-y-2">
              <li>• Click targets before they shrink completely</li>
              <li>• Faster clicks = bigger targets when you hit them</li>
              <li>• You have 3 lives - miss 3 targets and game over</li>
              <li>• Multiple targets spawn continuously</li>
              <li>• Difficulty increases as you score!</li>
            </ul>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="w-full max-w-6xl">
          <div className="flex justify-between items-center mb-4 bg-gray-800 bg-opacity-70 rounded-lg p-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Target className="text-yellow-400" size={24} />
                <span className="text-white text-2xl font-bold">Score: {score}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Heart className="text-red-500" size={24} />
                <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <Heart
                      key={i}
                      size={24}
                      className={i < lives ? 'text-red-500 fill-red-500' : 'text-gray-600'}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-gray-400 text-sm">Difficulty</div>
                <div className="text-white text-xl font-bold">{difficulty}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-sm">Time</div>
                <div className="text-white text-xl font-bold flex items-center gap-1">
                  <Clock size={20} />
                  {gameTime}s
                </div>
              </div>
            </div>
          </div>

          <div
            ref={gameAreaRef}
            className="relative bg-gray-900 bg-opacity-50 rounded-xl overflow-hidden border-4 border-gray-700 cursor-crosshair"
            style={{ height: '600px' }}
          >
            {targets.map(target => {
              const sizePercent = (target.currentSize / target.initialSize) * 100;
              const hue = Math.max(0, Math.min(120, sizePercent * 1.2)); // Green to red gradient
              
              return (
                <div
                  key={target.id}
                  onClick={(e) => handleTargetClick(target, e)}
                  className="absolute rounded-full cursor-pointer hover:scale-110 transform transition-transform shadow-2xl border-4 border-white"
                  style={{
                    left: `${target.x}px`,
                    top: `${target.y}px`,
                    width: `${target.currentSize}px`,
                    height: `${target.currentSize}px`,
                    backgroundColor: `hsl(${hue}, 80%, 50%)`,
                    transition: 'width 0.016s linear, height 0.016s linear'
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="text-center">
          <Award className="text-yellow-400 mx-auto mb-4" size={80} />
          <h1 className="text-5xl font-bold text-white mb-8">Game Over!</h1>
          
          <div className="bg-gray-800 bg-opacity-70 rounded-2xl p-8 mb-8 max-w-2xl">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-700 rounded-lg p-6">
                <Target className="text-yellow-400 mx-auto mb-2" size={32} />
                <p className="text-gray-400 text-sm mb-1">Final Score</p>
                <p className="text-5xl font-bold text-white">{score}</p>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-6">
                <Clock className="text-blue-400 mx-auto mb-2" size={32} />
                <p className="text-gray-400 text-sm mb-1">Time Survived</p>
                <p className="text-5xl font-bold text-white">{gameTime}s</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <TrendingUp className="text-green-400 mx-auto mb-2" size={24} />
                <p className="text-gray-400 text-sm mb-1">Avg Reaction</p>
                <p className="text-2xl font-bold text-green-400">{getAverageReaction()}ms</p>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <Award className="text-purple-400 mx-auto mb-2" size={24} />
                <p className="text-gray-400 text-sm mb-1">Accuracy</p>
                <p className="text-2xl font-bold text-purple-400">{getAccuracy()}%</p>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <Target className="text-orange-400 mx-auto mb-2" size={24} />
                <p className="text-gray-400 text-sm mb-1">Max Level</p>
                <p className="text-2xl font-bold text-orange-400">{difficulty}</p>
              </div>
            </div>
          </div>

          <button
            onClick={startGame}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-12 py-4 rounded-xl text-2xl font-bold hover:scale-105 transform transition shadow-2xl"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
