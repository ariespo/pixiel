import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SettingsModal from './SettingsModal';
import DesktopParticles from './DesktopParticles';

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState('');
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = () => {
    setIsLoggingIn(true);
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        setTimeout(onLogin, 500);
      }
      setProgress(currentProgress);
    }, 200);
  };

  const handleShutDown = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-coffee-900 flex flex-col z-40">
      <div className="scanlines absolute inset-0 z-50 pointer-events-none"></div>
      <div className="crt-flicker absolute inset-0 z-50 pointer-events-none"></div>
      
      <DesktopParticles />

      {/* Desktop Area */}
      <div className="flex-1 relative p-8 z-10" onClick={() => setIsStartMenuOpen(false)}>
        {/* App Icon on Desktop */}
        <div 
          className="w-24 flex flex-col items-center gap-2 cursor-pointer group active:translate-y-[2px] transition-transform"
          onClick={(e) => {
            e.stopPropagation();
            if (!isLoggingIn) handleLogin();
          }}
        >
          <div className="w-16 h-16 pixel-border bg-coffee-300 flex items-center justify-center group-hover:bg-coffee-200 transition-colors">
            <svg viewBox="0 0 32 32" className="w-10 h-10 pixelated" fill="none">
              <rect x="4" y="4" width="24" height="24" fill="#ffb300" stroke="#4e342e" strokeWidth="2"/>
              <rect x="8" y="8" width="16" height="12" fill="#d7ccc8" stroke="#4e342e" strokeWidth="2"/>
              <rect x="10" y="10" width="4" height="4" fill="#4e342e"/>
              <rect x="18" y="10" width="4" height="4" fill="#4e342e"/>
              <rect x="12" y="16" width="8" height="2" fill="#4e342e"/>
            </svg>
          </div>
          <span className="text-coffee-100 bg-coffee-800 px-2 py-1 text-xs border-2 border-coffee-900">
            Elysium.exe
          </span>
        </div>

        {/* Login Modal */}
        {isLoggingIn && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="pixel-border p-6 w-full max-w-sm bg-coffee-100"
            >
              <div className="bg-coffee-800 text-coffee-100 px-2 py-1 mb-4 text-sm flex justify-between">
                <span>Connecting...</span>
                <span>X</span>
              </div>
              <div className="text-center mb-4 text-coffee-900">Establishing secure BCI link...</div>
              <div className="pixel-border-inset h-6 w-full p-1 bg-coffee-50">
                <div 
                  className="h-full bg-amber-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-right text-xs mt-2 text-coffee-600">{Math.floor(progress)}%</div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Start Menu */}
      <AnimatePresence>
        {isStartMenuOpen && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute bottom-10 left-0 w-64 pixel-border bg-coffee-100 z-30 flex flex-col"
          >
            <div className="bg-coffee-800 text-coffee-100 p-4 font-bold border-b-4 border-coffee-900 flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 border-2 border-coffee-900 flex items-center justify-center">
                <span className="text-coffee-900 text-xs">OS</span>
              </div>
              Elysium OS
            </div>
            <div className="p-2 flex flex-col gap-1">
              <button 
                onClick={() => {
                  setIsStartMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="pixel-button text-left px-4 py-3 font-bold flex items-center gap-3"
              >
                <span className="text-xl">⚙️</span> 设置 (Settings)
              </button>
              <button 
                onClick={handleShutDown}
                className="pixel-button text-left px-4 py-3 font-bold flex items-center gap-3"
              >
                <span className="text-xl">🔌</span> 关机 (Shut Down)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Taskbar */}
      <div className="h-10 bg-coffee-300 border-t-4 border-coffee-800 flex items-center justify-between px-2 relative z-40">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsStartMenuOpen(!isStartMenuOpen);
          }}
          className={`pixel-button px-4 py-1 text-sm font-bold flex items-center gap-2 ${isStartMenuOpen ? 'bg-amber-400' : ''}`}
        >
          <div className="w-3 h-3 bg-amber-500 border border-coffee-900"></div>
          START
        </button>
        <div className="pixel-border-inset px-3 py-1 text-sm bg-coffee-100 text-coffee-900">
          {time}
        </div>
      </div>

      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}
