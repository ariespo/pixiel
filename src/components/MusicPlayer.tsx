import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { MusicInfo } from '../services/musicService';

interface MusicPlayerProps {
  music: MusicInfo;
  onClose: () => void;
}

export default function MusicPlayer({ music, onClose }: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showLyrics, setShowLyrics] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(music.playUrl);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    // Auto-play when loaded
    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      // Auto-play blocked, user needs to click
      console.log('[Music] Auto-play blocked');
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [music.playUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-4 right-4 z-50"
    >
      <div className="pixel-border bg-coffee-100 w-72 overflow-hidden">
        {/* Header */}
        <div className="bg-coffee-800 text-coffee-100 px-3 py-1 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs">♪</span>
            <span className="text-xs">正在播放</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs hover:text-amber-400"
          >
            ✕
          </button>
        </div>

        {/* Album Cover & Info */}
        <div className="p-3 flex gap-3">
          <div className="w-16 h-16 bg-coffee-300 flex-shrink-0 pixel-border-inset overflow-hidden">
            {music.coverUrl ? (
              <img
                src={music.coverUrl}
                alt={music.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-coffee-500 text-2xl">
                ♪
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-coffee-900 truncate" title={music.title}>
              {music.title}
            </p>
            <p className="text-xs text-coffee-600 truncate" title={music.artist}>
              {music.artist}
            </p>
            {music.album && (
              <p className="text-[10px] text-coffee-500 truncate" title={music.album}>
                {music.album}
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-3 pb-2">
          <div className="h-2 bg-coffee-300 pixel-border-inset cursor-pointer relative">
            <div
              className="absolute top-0 left-0 h-full bg-amber-400"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-coffee-600 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration || 0)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="px-3 pb-3 flex justify-center gap-3">
          <button
            onClick={togglePlay}
            className="pixel-button px-4 py-1 text-sm min-w-[60px]"
          >
            {isPlaying ? '暂停' : '播放'}
          </button>
          {music.lyrics && (
            <button
              onClick={() => setShowLyrics(!showLyrics)}
              className={`pixel-button px-3 py-1 text-sm ${showLyrics ? 'bg-amber-400' : ''}`}
            >
              歌词
            </button>
          )}
        </div>

        {/* Lyrics Panel */}
        <AnimatePresence>
          {showLyrics && music.lyrics && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 120 }}
              exit={{ height: 0 }}
              className="overflow-hidden bg-coffee-50 border-t-2 border-coffee-800"
            >
              <div className="p-3 h-full overflow-y-auto text-xs text-coffee-700 whitespace-pre-line leading-relaxed">
                {music.lyrics}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sender Info */}
        <div className="bg-coffee-200 px-3 py-1 text-[10px] text-coffee-600 text-center">
          夏目分享了一首歌
        </div>
      </div>
    </motion.div>
  );
}
