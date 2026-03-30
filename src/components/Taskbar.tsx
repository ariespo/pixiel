import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TaskbarProps {
  onStartAction: (action: 'shutdown' | 'settings') => void;
}

export default function Taskbar({ onStartAction }: TaskbarProps) {
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-10 bg-coffee-300 border-t-4 border-coffee-800 flex items-center justify-between px-2 relative z-[100]">
      <div className="relative">
        <button 
          onClick={() => setShowStartMenu(!showStartMenu)}
          className={`pixel-button px-4 py-1 text-sm font-bold flex items-center gap-2 ${showStartMenu ? 'bg-coffee-200' : ''}`}
        >
          <div className="w-3 h-3 bg-amber-500 border border-coffee-900"></div>
          START
        </button>

        <AnimatePresence>
          {showStartMenu && (
            <>
              <div 
                className="fixed inset-0 z-[-1]" 
                onClick={() => setShowStartMenu(false)}
              />
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="absolute bottom-full left-0 mb-1 w-48 pixel-border bg-coffee-100 overflow-hidden"
              >
                <div className="bg-coffee-800 text-coffee-100 p-2 text-xs font-bold border-b-2 border-coffee-900 flex items-center gap-2">
                   <div className="w-4 h-4 bg-amber-500 border border-coffee-100"></div>
                   Elysium OS
                </div>
                <button 
                  onClick={() => { onStartAction('settings'); setShowStartMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-amber-500 hover:text-coffee-900 transition-colors flex items-center gap-3"
                >
                  <span className="text-lg">⚙️</span> 设置 / Settings
                </button>
                <button 
                  onClick={() => { onStartAction('shutdown'); setShowStartMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-red-500 hover:text-white transition-colors flex items-center gap-3"
                >
                  <span className="text-lg">🔴</span> 关机 / Shutdown
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="pixel-border-inset px-3 py-1 text-sm bg-coffee-100 text-coffee-900">
        {time}
      </div>
    </div>
  );
}
