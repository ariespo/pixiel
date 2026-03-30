import { useState, useEffect, useRef, useCallback } from 'react';
import BootScreen from './components/BootScreen';
import LoginScreen from './components/LoginScreen';
import SetupWizard, { PlayerSetup } from './components/SetupWizard';
import PrologueScreen from './components/PrologueScreen';
import ChatAppWithPersistence from './components/ChatAppWithPersistence';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { chatApi } from './services/api';
import { runGapAnalysis, type HistoryMessage } from './services/gapAnalysis';
import { isNatsumeOnline } from './hooks/useOnlineStatus';

type AppState = 'boot' | 'login' | 'syncing' | 'setup' | 'prologue' | 'chat';

// Gap threshold: 2 hours in seconds
const GAP_THRESHOLD = 2 * 60 * 60;

function SyncScreen({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-coffee-900 flex flex-col items-center justify-center z-50">
      <div className="scanlines absolute inset-0 pointer-events-none"></div>
      <div className="crt-flicker absolute inset-0 pointer-events-none"></div>

      <div className="text-coffee-100 text-center">
        <div className="text-2xl mb-4 font-bold tracking-widest">ELYSIUM</div>
        <div className="text-amber-400 animate-pulse">{message}</div>
        <div className="mt-4 w-48 h-2 bg-coffee-800 pixel-border-inset">
          <div className="h-full bg-amber-500 animate-pulse" style={{ width: '60%' }}></div>
        </div>
      </div>
    </div>
  );
}

function AppInner() {
  const [appState, setAppState] = useState<AppState>('boot');
  const [syncMessage, setSyncMessage] = useState('正在连接服务器...');
  const [playerSetup, setPlayerSetup] = useState<PlayerSetup | null>(() => {
    const saved = localStorage.getItem('player_setup');
    return saved ? JSON.parse(saved) : null;
  });
  const [initialAIMessage, setInitialAIMessage] = useState<string | null>(null);

  const { apiUrl, apiKey, model } = useSettings();

  // Boot phase detection
  const isNewPlayerRef = useRef<boolean | null>(null);
  const bootDoneRef = useRef(false);
  const checkDoneRef = useRef(false);

  useEffect(() => {
    const check = async () => {
      try {
        const sessions = await chatApi.listSessions(1);
        isNewPlayerRef.current = sessions.length === 0;
      } catch {
        isNewPlayerRef.current = true;
      }
      checkDoneRef.current = true;
      maybeTransition();
    };
    check();
  }, []);

  const maybeTransition = () => {
    if (!bootDoneRef.current || !checkDoneRef.current) return;
    if (isNewPlayerRef.current) {
      setAppState('setup');
    } else {
      setAppState('login');
    }
  };

  const handleBootComplete = () => {
    bootDoneRef.current = true;
    maybeTransition();
  };

  /** Gap analysis: runs immediately after login, before entering chat */
  const runSyncAndAnalysis = useCallback(async () => {
    console.log('[App] Starting sync and gap analysis...');
    setAppState('syncing');

    try {
      // 1. Get session
      setSyncMessage('正在读取会话...');
      const sessions = await chatApi.listSessions(1);
      if (sessions.length === 0) {
        console.log('[App] No session found, skipping analysis');
        setAppState('chat');
        return;
      }

      const sessionId = sessions[0].id;
      const nowSec = Math.floor(Date.now() / 1000);

      // 2. Get messages
      setSyncMessage('正在同步消息记录...');
      const allMessages: HistoryMessage[] = await chatApi.getMessages(sessionId);
      console.log('[App] Loaded', allMessages.length, 'messages');

      if (!allMessages || allMessages.length === 0) {
        setAppState('chat');
        return;
      }

      // 3. Check gap
      const lastMsg = allMessages[allMessages.length - 1];
      const gap = nowSec - lastMsg.created_at;
      console.log('[App] Last message at:', new Date(lastMsg.created_at * 1000).toLocaleString());
      console.log('[App] Gap:', Math.floor(gap / 3600), 'h', Math.floor((gap % 3600) / 60), 'm');

      // Skip if gap < 2 hours
      if (gap < GAP_THRESHOLD) {
        console.log('[App] Gap < 2h, no analysis needed');
        setAppState('chat');
        return;
      }

      // Skip if Natsume is offline
      if (!isNatsumeOnline()) {
        console.log('[App] Natsume is offline, skipping analysis');
        setSyncMessage('夏目已离线，直接进入聊天...');
        await new Promise(r => setTimeout(r, 500));
        setAppState('chat');
        return;
      }

      // 4. Find last user message for context
      let lastUserMsg: HistoryMessage | null = null;
      for (let i = allMessages.length - 1; i >= 0; i--) {
        if (allMessages[i].role === 'user') {
          lastUserMsg = allMessages[i];
          break;
        }
      }

      if (!lastUserMsg) {
        console.log('[App] No user message found, skipping analysis');
        setAppState('chat');
        return;
      }

      // 5. Run gap analysis
      setSyncMessage('夏目正在思考...');
      const recentHistory = allMessages.slice(-10);
      const savedSetup = localStorage.getItem('player_setup');
      const setup = playerSetup || (savedSetup ? JSON.parse(savedSetup) : null);

      console.log('[App] Calling LLM for gap analysis...');

      let insertedCount = 0;
      await runGapAnalysis(
        sessionId,
        lastUserMsg,
        recentHistory,
        lastMsg.created_at,
        nowSec,
        { apiUrl, apiKey, model },
        setup,
        async (role, content, metadata, createdAt) => {
          await chatApi.addMessage(sessionId, role, content, metadata, createdAt);
          insertedCount++;
          console.log('[App] Inserted gap message at', new Date(createdAt * 1000).toLocaleString());
        }
      );

      if (insertedCount > 0) {
        setSyncMessage(`收到 ${insertedCount} 条新消息...`);
        await new Promise(r => setTimeout(r, 800));
      }

      console.log('[App] Gap analysis complete, entering chat');
      setAppState('chat');

    } catch (e) {
      console.error('[App] Sync/Analysis error:', e);
      // Even if analysis fails, enter chat
      setSyncMessage('同步完成，进入聊天...');
      await new Promise(r => setTimeout(r, 500));
      setAppState('chat');
    }
  }, [apiUrl, apiKey, model, playerSetup]);

  const handleLoginComplete = () => {
    // Don't go directly to chat - run analysis first
    runSyncAndAnalysis();
  };

  const handleSetupComplete = (setup: PlayerSetup) => {
    setPlayerSetup(setup);
    localStorage.setItem('player_setup', JSON.stringify(setup));
    setAppState('prologue');
  };

  const handlePrologueComplete = () => {
    setAppState('chat');
  };

  return (
    <div className="w-full h-screen bg-coffee-900 overflow-hidden relative">
      {appState === 'boot' && <BootScreen onComplete={handleBootComplete} />}
      {appState === 'login' && <LoginScreen onLogin={handleLoginComplete} />}
      {appState === 'syncing' && <SyncScreen message={syncMessage} />}
      {appState === 'setup' && <SetupWizard onComplete={handleSetupComplete} />}
      {appState === 'prologue' && playerSetup && (
        <PrologueScreen
          playerSetup={playerSetup}
          onComplete={handlePrologueComplete}
          onPreloadComplete={setInitialAIMessage}
        />
      )}
      {appState === 'chat' && (
        <ChatAppWithPersistence playerSetup={playerSetup} initialMessage={initialAIMessage} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppInner />
    </SettingsProvider>
  );
}
