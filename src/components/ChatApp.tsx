import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLLM } from '../hooks/useLLM';
import MomentsPanel from './MomentsPanel';
import ProfileModal, { UserProfile } from './ProfileModal';
import SettingsModal from './SettingsModal';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'partner';
  timestamp: string;
};

const getFormattedTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

export default function ChatApp() {
  const { initChat, sendMessage, isTyping } = useLLM();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentView, setCurrentView] = useState<'chat' | 'moments'>('chat');
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    nickname: '试用官 #49201',
    signature: '正在进行产品试用中...',
    avatar: '👤'
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasGreeted = useRef(false);

  useEffect(() => {
    initChat();
    // Initial greeting from the partner
    if (!hasGreeted.current) {
      hasGreeted.current = true;
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: '喂，在吗？听说你是我的匹配对象。',
          sender: 'partner',
          timestamp: getFormattedTime()
        }]);
      }, 1500);
    }
  }, [initChat]);

  useEffect(() => {
    if (currentView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, currentView]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: getFormattedTime()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    
    const responseText = await sendMessage(userMsg.text);
    
    if (responseText) {
      const partnerMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: 'partner',
        timestamp: getFormattedTime()
      };
      setMessages(prev => [...prev, partnerMsg]);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="fixed inset-0 bg-coffee-900 flex justify-center p-4 md:p-8 z-30">
      <div className="scanlines absolute inset-0"></div>
      <div className="crt-flicker absolute inset-0"></div>
      
      {/* Main App Area */}
      <div className="flex-1 pixel-border flex flex-col relative z-10 h-full max-w-3xl w-full">
        {currentView === 'chat' ? (
          <>
            {/* Header */}
            <div className="bg-coffee-800 text-coffee-100 p-4 flex items-center justify-between border-b-4 border-coffee-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 pixel-border-inset bg-coffee-300 flex items-center justify-center">
                  <span className="text-xl">🌸</span>
                </div>
                <div>
                  <h2 className="font-bold text-lg">Natsume (夏目)</h2>
                  <p className="text-xs text-coffee-300">今天也是朝气满满的一天呀</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleFullscreen}
                  className="pixel-button px-3 py-2 text-sm"
                  title="全屏 (Fullscreen)"
                >
                  🖵
                </button>
                <button 
                  onClick={() => setShowSettings(true)}
                  className="pixel-button px-3 py-2 text-sm"
                  title="设置 (Settings)"
                >
                  ⚙️
                </button>
                <button 
                  onClick={() => setCurrentView('moments')}
                  className="pixel-button px-4 py-2 text-sm"
                >
                  查看动态
                </button>
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    <div 
                      onClick={msg.sender === 'user' ? () => setShowProfile(true) : undefined}
                      className={`w-10 h-10 pixel-border shrink-0 flex items-center justify-center text-xl transition-transform ${
                        msg.sender === 'user' ? 'bg-amber-400 cursor-pointer hover:bg-amber-300 active:translate-y-[2px]' : 'bg-coffee-300'
                      }`}
                    >
                      {msg.sender === 'user' ? userProfile.avatar : '🌸'}
                    </div>

                    <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className="text-[10px] text-coffee-400 mb-1">
                        {msg.sender === 'user' ? userProfile.nickname : 'Natsume'} • {msg.timestamp}
                      </div>
                      <div 
                        className={`max-w-full p-3 ${
                          msg.sender === 'user' 
                            ? 'bg-amber-500 text-coffee-900 border-4 border-coffee-800' 
                            : 'bg-coffee-50 text-coffee-900 border-4 border-coffee-800'
                        }`}
                        style={{
                          boxShadow: msg.sender === 'user' 
                            ? 'inset -2px -2px 0px 0px rgba(0,0,0,0.2), inset 2px 2px 0px 0px rgba(255,255,255,0.5), 4px 4px 0px 0px rgba(0,0,0,0.3)'
                            : 'inset -2px -2px 0px 0px rgba(0,0,0,0.2), inset 2px 2px 0px 0px rgba(255,255,255,0.5), 4px 4px 0px 0px rgba(0,0,0,0.3)'
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start"
                  >
                    <div className="bg-coffee-50 text-coffee-900 border-4 border-coffee-800 p-3 flex gap-1 items-center">
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 bg-coffee-800"></motion.div>
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-coffee-800"></motion.div>
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-coffee-800"></motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input */}
            <div className="p-4 bg-coffee-200 border-t-4 border-coffee-800 flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="输入消息..."
                className="flex-1 pixel-border-inset p-3 outline-none text-coffee-900 bg-coffee-50"
              />
              <button 
                onClick={handleSend}
                disabled={!inputValue.trim() || isTyping}
                className="pixel-button px-6 font-bold disabled:opacity-50"
              >
                发送
              </button>
            </div>
          </>
        ) : (
          <MomentsPanel userProfile={userProfile} onBack={() => setCurrentView('chat')} />
        )}
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <ProfileModal 
            profile={userProfile}
            onSave={(p) => {
              setUserProfile(p);
              setShowProfile(false);
            }}
            onClose={() => setShowProfile(false)}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
