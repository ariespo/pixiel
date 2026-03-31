import { useState, useEffect, useRef, useCallback } from 'react';
import { buildSystemPrompt } from '../utils/systemPrompt';
import { motion, AnimatePresence } from 'motion/react';
import { usePersistentChat, usePresets } from '../hooks/usePersistentChat';
import { useLLM } from '../hooks/useLLM';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useSettings } from '../contexts/SettingsContext';
import { ChatCompletionPreset } from '../services/api';
import { PlayerSetup } from './SetupWizard';
import { runGapAnalysis, runAfkAnalysis } from '../services/gapAnalysis';
import { hasPoke, removePokeTag } from '../services/llmProcessor';
import { extractMusicTag, searchMusic } from '../services/musicService';
import type { MusicInfo } from '../services/musicService';
import MusicPlayer from './MusicPlayer';
import MomentsPanel from './MomentsPanel';
import ProfileModal, { UserProfile } from './ProfileModal';
import SettingsModal from './SettingsModal';
import PresetManager from './PresetManager';
import PresetImporter from './PresetImporter';

// Format timestamp for display
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

/**
 * Remove <聊天> tags from message content
 * Handles both complete and incomplete tags (e.g., missing closing tag)
 */
const cleanChatTags = (content: string): string => {
  // Remove complete <聊天>...</聊天> tags
  let cleaned = content.replace(/<聊天>[\s\S]*?<\/聊天>/g, '');
  // Remove standalone opening tag (in case closing tag is missing)
  cleaned = cleaned.replace(/<聊天>/g, '');
  // Remove standalone closing tag
  cleaned = cleaned.replace(/<\/聊天>/g, '');
  return cleaned.trim();
};

/**
 * Remove role prefix like [夏目 (AI)]: or [小明 (用户)]: or [时间] 角色 (AI):
 * LLM may echo the formatted prefix from history examples
 */
const cleanRolePrefix = (content: string): string => {
  // Match patterns like:
  // [2026-03-30 12:59] 夏目 (AI): 内容
  // [夏目 (AI)]: 内容
  let cleaned = content.replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*\[?[^\[\]]*?\(AI\)\]?:\s*/g, '');
  cleaned = cleaned.replace(/^\[.+?\)\]:\s*/g, '');
  cleaned = cleaned.replace(/^\[.+?\]\s*/g, '');
  return cleaned.trim();
};

type MessageStatus = 'sending' | 'sent' | 'failed';

interface ChatAppWithPersistenceProps {
  playerSetup?: PlayerSetup | null;
  initialMessage?: string | null;
}

export default function ChatAppWithPersistence({ playerSetup, initialMessage }: ChatAppWithPersistenceProps) {
  const {
    sessions,
    currentSession,
    currentSessionId,
    messages,
    isLoading: isLoadingSessions,
    createSession,
    updateSession,
    addMessage,
    addMessageToSession,
    deleteMessage,
    updateMessage,
    getHistoryForLLM,
    deleteSession
  } = usePersistentChat();

  const {
    presets,
    activePreset,
    isLoading: isLoadingPresets,
    createPreset,
    updatePreset,
    deletePreset,
    exportPreset,
    uploadPreset,
    importPresetJSON,
    setActive,
    loadPresets
  } = usePresets();

  const { initChat, sendMessage, generateOpeningMessage, isTyping } = useLLM();
  const isOnline = useOnlineStatus();
  const { apiUrl, apiKey, model } = useSettings();

  const [inputValue, setInputValue] = useState('');
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'moments'>('chat');
  const [showProfile, setShowProfile] = useState(false);
  const [showHeroineProfile, setShowHeroineProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [showPresetImporter, setShowPresetImporter] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<ChatCompletionPreset | null>(null);

  // Message send status tracking
  const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null);
  const [messageStatuses, setMessageStatuses] = useState<Record<string, MessageStatus>>({});
  const [failedMessageContent, setFailedMessageContent] = useState<string>('');

  // 动作互动相关
  const [isShaking, setIsShaking] = useState(false);
  const [actionNotification, setActionNotification] = useState<string | null>(null);

  // 音乐播放器相关
  const [currentMusic, setCurrentMusic] = useState<MusicInfo | null>(null);
  const [isSearchingMusic, setIsSearchingMusic] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    // Try to load from localStorage first (for returning players)
    const savedSetup = localStorage.getItem('player_setup');
    const setup = playerSetup || (savedSetup ? JSON.parse(savedSetup) : null);

    if (setup) {
      const avatar = setup.gender === '男' ? '👨' :
                     setup.gender === '女' ? '👩' : '👤';
      return {
        nickname: setup.nickname,
        signature: setup.identity === '社畜' ? '努力工作，认真生活' : '学业进步，天天向上',
        avatar
      };
    }
    // Default fallback
    return {
      nickname: '试用官 #49201',
      signature: '正在进行产品试用中...',
      avatar: '👤'
    };
  });

  // Heroine (夏目) profile
  const [heroineProfile, setHeroineProfile] = useState<UserProfile>({
    nickname: '夏目',
    signature: '',
    avatar: '🌸'
  });

  // Moments (朋友圈) state - moved from MomentsPanel to ensure event listeners work
  const [posts, setPosts] = useState<any[]>(() => {
    // Try to load from localStorage first
    const savedPosts = localStorage.getItem('moments_posts');
    if (savedPosts) {
      try {
        return JSON.parse(savedPosts);
      } catch (e) {
        console.error('[Moments] Failed to parse saved posts:', e);
      }
    }
    // Default: no initial posts
    return [];
  });

  // Persist posts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('moments_posts', JSON.stringify(posts));
  }, [posts]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const welcomeCreatedRef = useRef(false);
  const hasRunGapAnalysis = useRef(false);

  // AFK detection refs
  const lastActivityTimeRef = useRef<number>(Date.now());
  const hasTriggeredAfk = useRef<boolean>(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (currentView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, currentView]);

  // AFK detection: track user activity and trigger Natsume's caring messages
  useEffect(() => {
    const AFK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    const CHECK_INTERVAL_MS = 10 * 60 * 1000;    // 10 minutes in milliseconds
    const MIN_MESSAGES_FOR_AFK = 3;              // Need at least some conversation history

    // Track activity: mouse, keyboard, touch
    const updateActivity = () => {
      lastActivityTimeRef.current = Date.now();
      // Reset AFK trigger when user becomes active again
      if (hasTriggeredAfk.current) {
        hasTriggeredAfk.current = false;
        console.log('[AFK] User active again, reset AFK trigger');
      }
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    // Check every 10 minutes
    const intervalId = setInterval(() => {
      if (!currentSessionId || !isOnline) return;
      if (messages.length < MIN_MESSAGES_FOR_AFK) return;

      const now = Date.now();
      const idleTime = now - lastActivityTimeRef.current;

      // Only trigger once per idle period, and only if idle > 2 hours
      if (idleTime >= AFK_THRESHOLD_MS && !hasTriggeredAfk.current) {
        hasTriggeredAfk.current = true;
        console.log('[AFK] Player idle for', Math.floor(idleTime / 60000), 'minutes, triggering Natsume caring messages');

        // Get last user message for context
        let lastUserMsg: typeof messages[0] | null = null;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            lastUserMsg = messages[i];
            break;
          }
        }

        if (!lastUserMsg) return;

        const recentHistory = messages.slice(-10);
        const savedSetup = localStorage.getItem('player_setup');
        const setup = playerSetup || (savedSetup ? JSON.parse(savedSetup) : null);

        // Run AFK analysis (specifically for idle detection)
        runAfkAnalysis(
          currentSessionId,
          lastUserMsg,
          recentHistory,
          Math.floor(lastActivityTimeRef.current / 1000),
          Math.floor(now / 1000),
          { apiUrl, apiKey, model },
          setup,
          async (role, content, metadata, createdAt) => {
            await addMessage(role, content, metadata, createdAt);
          }
        ).catch(e => console.error('[AFK] Error:', e));
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId, isOnline, messages.length, apiUrl, apiKey, model]);

  // Listen for system commands
  useEffect(() => {
    const handleUpdateSign = (e: CustomEvent) => {
      const { content } = e.detail;
      setHeroineProfile(prev => ({ ...prev, signature: content }));
    };

    const handleUpdateNickname = (e: CustomEvent) => {
      const { name } = e.detail;
      setHeroineProfile(prev => ({ ...prev, nickname: name }));
    };

    const handleUpdatePlayerSign = (e: CustomEvent) => {
      const { content } = e.detail;
      setUserProfile(prev => ({ ...prev, signature: content }));
      // Also update localStorage
      const savedSetup = localStorage.getItem('player_setup');
      if (savedSetup) {
        const setup = JSON.parse(savedSetup);
        localStorage.setItem('player_setup', JSON.stringify({ ...setup, signature: content }));
      }
    };

    const handleUpdatePlayerNickname = (e: CustomEvent) => {
      const { name } = e.detail;
      setUserProfile(prev => ({ ...prev, nickname: name }));
      // Also update localStorage
      const savedSetup = localStorage.getItem('player_setup');
      if (savedSetup) {
        const setup = JSON.parse(savedSetup);
        localStorage.setItem('player_setup', JSON.stringify({ ...setup, nickname: name }));
      }
    };

    // Listen for moments-related commands
    const handleAddMoment = (e: CustomEvent) => {
      const { owner, content } = e.detail;
      const newPost = {
        id: Date.now().toString(),
        mid: Date.now(),
        author: owner === '女主' ? '夏目' : owner,
        avatar: '🌸',
        text: content,
        timestamp: formatTime(Math.floor(Date.now() / 1000)),
        comments: []
      };
      setPosts(prev => [newPost, ...prev]);
      console.log('[System] Added moment:', newPost);
    };

    const handleAddComment = (e: CustomEvent) => {
      const { mid, text } = e.detail;
      setPosts(prev => prev.map(post => {
        if (post.mid === mid || post.id === String(mid)) {
          return {
            ...post,
            comments: [...post.comments, {
              id: Date.now().toString(),
              author: '夏目',
              text: text,
              timestamp: formatTime(Math.floor(Date.now() / 1000))
            }]
          };
        }
        return post;
      }));
      console.log('[System] Added comment to moment:', mid);
    };

    const handleDeleteMoment = (e: CustomEvent) => {
      const { mid, reason } = e.detail;
      setPosts(prev => prev.filter(post => post.mid !== mid && post.id !== String(mid)));
      console.log('[System] Deleted moment:', mid, 'reason:', reason);
    };

    const handleReplyComment = (e: CustomEvent) => {
      const { mid, cid, text } = e.detail;
      setPosts(prev => prev.map(post => {
        if (post.mid === mid || post.id === String(mid)) {
          return {
            ...post,
            comments: [...post.comments, {
              id: Date.now().toString(),
              author: heroineProfile.nickname,
              text: text,
              timestamp: formatTime(Math.floor(Date.now() / 1000))
            }]
          };
        }
        return post;
      }));
      console.log('[System] Reply comment added:', mid, cid, text);
    };

    window.addEventListener('update-sign', handleUpdateSign as EventListener);
    window.addEventListener('update-nickname', handleUpdateNickname as EventListener);
    window.addEventListener('update-player-sign', handleUpdatePlayerSign as EventListener);
    window.addEventListener('update-player-nickname', handleUpdatePlayerNickname as EventListener);
    window.addEventListener('add-moment', handleAddMoment as EventListener);
    window.addEventListener('add-comment', handleAddComment as EventListener);
    window.addEventListener('delete-moment', handleDeleteMoment as EventListener);
    window.addEventListener('reply-comment', handleReplyComment as EventListener);

    return () => {
      window.removeEventListener('update-sign', handleUpdateSign as EventListener);
      window.removeEventListener('update-nickname', handleUpdateNickname as EventListener);
      window.removeEventListener('update-player-sign', handleUpdatePlayerSign as EventListener);
      window.removeEventListener('update-player-nickname', handleUpdatePlayerNickname as EventListener);
      window.removeEventListener('add-moment', handleAddMoment as EventListener);
      window.removeEventListener('add-comment', handleAddComment as EventListener);
      window.removeEventListener('delete-moment', handleDeleteMoment as EventListener);
      window.removeEventListener('reply-comment', handleReplyComment as EventListener);
    };
  }, []);

  // Initialize LLM when session changes
  useEffect(() => {
    if (currentSessionId && !hasInitialized.current) {
      hasInitialized.current = true;
      initChat();
    }
  }, [currentSessionId, initChat]);

  // Load preset when session changes
  useEffect(() => {
    const loadPreset = async () => {
      if (currentSession?.preset_id) {
        const preset = presets.find(p => p.id === currentSession.preset_id);
        setCurrentPreset(preset || null);
      } else {
        setCurrentPreset(activePreset);
      }
    };
    loadPreset();
  }, [currentSession, presets, activePreset]);

  // Auto-create welcome session for new players (guarded to run exactly once)
  useEffect(() => {
    if (welcomeCreatedRef.current) return;
    if (!playerSetup || sessions.length !== 0 || isLoadingSessions) return;
    // Wait for presets to finish loading before creating welcome session
    if (isLoadingPresets) return;

    welcomeCreatedRef.current = true;

    const createWelcomeSession = async () => {
      // createSession returns the new session ID — use it directly to avoid stale closure
      const sessionId = await createSession('与夏目的初次相遇');

      // Initialize chat with system prompt
      const customSystemPrompt = buildSystemPrompt(playerSetup);
      await initChat(customSystemPrompt);

      // Generate AI opening message based on player info
      try {
        const playerInfo = {
          gender: playerSetup.gender,
          nickname: playerSetup.nickname,
          identity: playerSetup.identity
        };

        await generateOpeningMessage(playerInfo, {
          systemPrompt: customSystemPrompt,
          preset: activePreset || undefined,
          onPoke: () => {
            console.log('[Opening] Detected poke tag');
            triggerShake('戳了戳你');
          },
          onChatMessage: async (rawMsg) => {
            console.log('[Opening] AI response:', rawMsg);

            // Handle music tags
            const musicKeyword = extractMusicTag(rawMsg);
            if (musicKeyword) {
              console.log('[Opening] Searching for music:', musicKeyword);
              setIsSearchingMusic(true);
              const musicInfo = await searchMusic(musicKeyword);
              setIsSearchingMusic(false);
              if (musicInfo) {
                console.log('[Opening] Found music:', musicInfo.title);
                setCurrentMusic(musicInfo);
              }
            }

            // Clean message - remove tags
            let cleanedMsg = removePokeTag(rawMsg);
            cleanedMsg = cleanedMsg.replace(/<音乐>[\s\S]*?<\/音乐>/g, '').trim();

            // Save the AI-generated opening message
            if (cleanedMsg) {
              await addMessageToSession(sessionId, 'assistant', cleanedMsg, {
                name: heroineProfile.nickname,
                timestamp: formatTime(Math.floor(Date.now() / 1000))
              });
            }
          }
        });
      } catch (error) {
        console.error('[Opening] Failed to generate AI opening:', error);

        // Fallback to hardcoded welcome message if AI fails
        const welcomeContent = initialMessage
          ? initialMessage
          : (() => {
              const identityText = playerSetup.identity === '社畜'
                ? '听说你是个上班族啊...每天忙来忙去的，应该很累吧？'
                : '在校学生吗...真羡慕你还有那么多时间。不像我，只能待在这个房间里。';
              return `<聊天>哼，终于有人来了。\n我还以为这个破软件根本就没人会用呢。\n\n${identityText}\n\n算了，既然来了，就陪我聊会儿天吧。\n反正...我也没什么别的事可做。\n</聊天>`;
            })();

        await addMessageToSession(sessionId, 'assistant', welcomeContent, {
          name: heroineProfile.nickname,
          timestamp: formatTime(Math.floor(Date.now() / 1000))
        });
      }
    };

    createWelcomeSession();
  }, [playerSetup, sessions.length, isLoadingSessions, isLoadingPresets, activePreset]);

  // Gap analysis：页面加载完毕、消息就绪后，检查是否需要补发历史留言
  useEffect(() => {
    // 等待消息加载完成
    if (!currentSessionId || isLoadingSessions || messages.length === 0) return;
    // 只运行一次
    if (hasRunGapAnalysis.current) return;
    // 夏目不在线时不触发
    if (!isOnline) return;

    hasRunGapAnalysis.current = true;

    const lastMsg = messages[messages.length - 1];
    const nowSec = Math.floor(Date.now() / 1000);
    const gap = nowSec - lastMsg.created_at;

    console.log('[GapAnalysis] Last message at', new Date(lastMsg.created_at * 1000).toLocaleString(), '| gap:', Math.floor(gap / 3600), 'h', Math.floor((gap % 3600) / 60), 'm');

    if (gap < 2 * 60 * 60) {
      console.log('[GapAnalysis] Gap < 2h, skipping.');
      return;
    }

    // 找到最后一条玩家消息（给 LLM 作参考）
    let lastUserMsg: typeof messages[0] | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserMsg = messages[i]; break; }
    }
    if (!lastUserMsg) return;

    const recentHistory = messages.slice(-10);
    const savedSetup = localStorage.getItem('player_setup');
    const setup = playerSetup || (savedSetup ? JSON.parse(savedSetup) : null);

    runGapAnalysis(
      currentSessionId,
      lastUserMsg,
      recentHistory,
      lastMsg.created_at,
      nowSec,
      { apiUrl, apiKey, model },
      setup,
      async (role, content, metadata, createdAt) => {
        await addMessage(role, content, metadata, createdAt);
      }
    ).catch(e => console.error('[GapAnalysis] Error:', e));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId, isLoadingSessions, messages.length, isOnline]);


  // Send message
  const handleSend = async () => {
    if (!inputValue.trim() || !currentSessionId) return;

    const content = inputValue.trim();
    setInputValue('');

    // Add user message
    const userMessage = await addMessage('user', content, {
      name: userProfile.nickname,
      timestamp: formatTime(Math.floor(Date.now() / 1000))
    });

    // Track this message
    setLastUserMessageId(userMessage.id);
    setFailedMessageContent('');
    setMessageStatuses(prev => ({ ...prev, [userMessage.id]: 'sending' }));

    // 离线时段：只保存消息，不调用 LLM
    if (!isOnline) {
      setMessageStatuses(prev => ({ ...prev, [userMessage.id]: 'sent' }));
      setShowOfflineNotice(true);
      setTimeout(() => setShowOfflineNotice(false), 6000);
      return;
    }
    setShowOfflineNotice(false);

    try {
      // Get message history for context
      const history = await getHistoryForLLM(50);

      // Track already sent messages to avoid duplicates
      const sentMessages = new Set<string>();

      // Build system prompt from player setup if available
      const customSystemPrompt = (() => {
        const savedSetup = localStorage.getItem('player_setup');
        const setup = playerSetup || (savedSetup ? JSON.parse(savedSetup) : null);
        return setup ? buildSystemPrompt(setup) : undefined;
      })();

      // Send to LLM with preset settings and real-time message callback
      await sendMessage(content, {
        history: history.slice(0, -1),
        preset: currentPreset || undefined,
        systemPrompt: customSystemPrompt,
        onPoke: () => {
          console.log('[Chat] Detected poke tag');
          triggerShake('戳了戳你');
        },
        onChatMessage: async (rawMsg) => {
          // Avoid sending duplicate messages
          if (sentMessages.has(rawMsg)) return;
          sentMessages.add(rawMsg);

          // Process actions and get cleaned message
          const cleanedMsg = await handleMessageWithActions(rawMsg);

          // Only save non-empty messages
          if (cleanedMsg) {
            await addMessage('assistant', cleanedMsg, {
              name: heroineProfile.nickname,
              timestamp: formatTime(Math.floor(Date.now() / 1000))
            });
          }
        }
      });

      // Mark as sent successfully
      setMessageStatuses(prev => ({ ...prev, [userMessage.id]: 'sent' }));
    } catch (error) {
      console.error('[Chat] Failed to send message:', error);
      // Mark as failed
      setMessageStatuses(prev => ({ ...prev, [userMessage.id]: 'failed' }));
      setFailedMessageContent(content);
    }
  };

  // Trigger screen shake animation
  const triggerShake = useCallback((actionText: string) => {
    setIsShaking(true);
    setActionNotification(`${heroineProfile.nickname}${actionText}`);

    // Add system message to chat (centered, neutral)
    addMessage('system', `${heroineProfile.nickname}戳了戳你`, {
      timestamp: formatTime(Math.floor(Date.now() / 1000))
    }).catch(e => console.error('[Poke] Failed to add system message:', e));

    // Clear shake after animation (1.2s matches new CSS duration)
    setTimeout(() => {
      setIsShaking(false);
    }, 1200);

    // Clear notification after delay
    setTimeout(() => {
      setActionNotification(null);
    }, 3000);
  }, [heroineProfile.nickname, addMessage]);

  // Handle actions from AI messages
  const handleMessageWithActions = useCallback(async (rawMessage: string) => {
    console.log('[handleMessageWithActions] Raw message:', rawMessage);

    // Handle music tags
    const musicKeyword = extractMusicTag(rawMessage);
    console.log('[Music] Extracted keyword:', musicKeyword);
    if (musicKeyword) {
      console.log('[Music] Searching for:', musicKeyword);
      setIsSearchingMusic(true);
      const musicInfo = await searchMusic(musicKeyword);
      setIsSearchingMusic(false);
      if (musicInfo) {
        console.log('[Music] Found:', musicInfo.title, '-', musicInfo.artist);
        setCurrentMusic(musicInfo);
      } else {
        console.warn('[Music] Not found:', musicKeyword);
      }
    }

    // Return message with all special tags removed
    let cleaned = removePokeTag(rawMessage);
    cleaned = cleaned.replace(/<音乐>[\s\S]*?<\/音乐>/g, '').trim();
    cleaned = cleanChatTags(cleaned);
    cleaned = cleanRolePrefix(cleaned);
    console.log('[handleMessageWithActions] Cleaned message:', cleaned);
    return cleaned;
  }, []);
  const handleRetry = async (messageId: string) => {
    if (!currentSessionId || !failedMessageContent) return;

    setMessageStatuses(prev => ({ ...prev, [messageId]: 'sending' }));

    try {
      // Get message history for context
      const history = await getHistoryForLLM(50);

      // Track already sent messages to avoid duplicates
      const sentMessages = new Set<string>();

      // Build system prompt from player setup if available
      const customSystemPrompt = (() => {
        const savedSetup = localStorage.getItem('player_setup');
        const setup = playerSetup || (savedSetup ? JSON.parse(savedSetup) : null);
        return setup ? buildSystemPrompt(setup) : undefined;
      })();

      // Retry sending to LLM
      await sendMessage(failedMessageContent, {
        history: history.slice(0, -1),
        preset: currentPreset || undefined,
        systemPrompt: customSystemPrompt,
        onPoke: () => {
          console.log('[Retry] Detected poke tag');
          triggerShake('戳了戳你');
        },
        onChatMessage: async (rawMsg) => {
          if (sentMessages.has(rawMsg)) return;
          sentMessages.add(rawMsg);

          // Process actions and get cleaned message
          const cleanedMsg = await handleMessageWithActions(rawMsg);

          // Only save non-empty messages
          if (cleanedMsg) {
            await addMessage('assistant', cleanedMsg, {
              name: heroineProfile.nickname,
              timestamp: formatTime(Math.floor(Date.now() / 1000))
            });
          }
        }
      });

      // Mark as sent successfully
      setMessageStatuses(prev => ({ ...prev, [messageId]: 'sent' }));
      setFailedMessageContent('');
    } catch (error) {
      console.error('[Chat] Retry failed:', error);
      setMessageStatuses(prev => ({ ...prev, [messageId]: 'failed' }));
    }
  };

  // Delete a failed message
  const handleDeleteFailed = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
      setLastUserMessageId(null);
      setFailedMessageContent('');
      // Also restore the failed content to input so user can edit and resend
      if (failedMessageContent) {
        setInputValue(failedMessageContent);
      }
    } catch (error) {
      console.error('[Chat] Failed to delete message:', error);
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

  const handleCreatePreset = async (data: Partial<ChatCompletionPreset>) => {
    try {
      await createPreset(data);
    } catch (err) {
      console.error('Failed to create preset:', err);
    }
  };

  const handleUpdatePreset = async (preset: ChatCompletionPreset) => {
    try {
      const { id, created_at, updated_at, ...updates } = preset;
      await updatePreset(preset.id, updates);
    } catch (err) {
      console.error('Failed to update preset:', err);
    }
  };

  const handleSelectPresetForSession = async (presetId: string | null) => {
    if (currentSessionId) {
      try {
        await updateSession(currentSessionId, { preset_id: presetId || undefined });
        const preset = presetId ? presets.find(p => p.id === presetId) : null;
        setCurrentPreset(preset || null);
      } catch (err) {
        console.error('Failed to update session preset:', err);
      }
    }
  };

  // Notify LLM about moments activity (new post or comment)
  const notifyLLM = useCallback(async (type: 'new_post' | 'comment', data: { mid?: number; cid?: number; content: string; author: string }) => {
    if (!isOnline || !currentSessionId) {
      console.log('[Moments] LLM offline or no session, notification queued');
      return;
    }

    const notificationMsg = type === 'new_post'
      ? `[系统通知] 与你聊天的玩家${data.author}发布了新动态: "${data.content}"`
      : `[系统通知] 与你聊天的玩家${data.author}评论了你的动态(ID:${data.mid}): "${data.content}"`;

    console.log('[Moments] Notifying LLM:', notificationMsg);

    try {
      const history = await getHistoryForLLM(50);
      const customSystemPrompt = (() => {
        const savedSetup = localStorage.getItem('player_setup');
        const setup = playerSetup || (savedSetup ? JSON.parse(savedSetup) : null);
        return setup ? buildSystemPrompt(setup) : undefined;
      })();

      // Track already processed responses to avoid duplicates
      const processedResponses = new Set<string>();

      await sendMessage(notificationMsg, {
        history: history,
        preset: currentPreset || undefined,
        systemPrompt: customSystemPrompt,
        onPoke: () => {
          console.log('[Moments] Detected poke tag');
          triggerShake('戳了戳你');
        },
        onChatMessage: async (rawMsg) => {
          // Skip if already processed
          if (processedResponses.has(rawMsg)) return;
          processedResponses.add(rawMsg);

          // Process actions and get cleaned message
          const cleanedMsg = await handleMessageWithActions(rawMsg);

          // Save AI's response to chat (if it's a chat message)
          if (cleanedMsg) {
            await addMessage('assistant', cleanedMsg, {
              name: heroineProfile.nickname,
              timestamp: formatTime(Math.floor(Date.now() / 1000))
            });
          }
        },
        onCommand: (cmd) => {
          // Handle REPLY_COMMENT command - add comment to the moment
          if (cmd.type === 'REPLY_COMMENT') {
            console.log('[Moments] LLM replied to comment:', cmd);
          }
        }
      });
    } catch (error) {
      console.error('[Moments] Failed to notify LLM:', error);
    }
  }, [isOnline, currentSessionId, getHistoryForLLM, playerSetup, currentPreset, sendMessage, addMessage, handleMessageWithActions]);

  // Reset everything: delete all sessions, presets, and start fresh
  const handleReset = async () => {
    console.log('[Reset] Starting fresh...');

    // Mark that we're in the middle of a reset to prevent auto-creation
    welcomeCreatedRef.current = true;

    // Delete all existing sessions
    for (const session of sessions) {
      try {
        await deleteSession(session.id);
        console.log('[Reset] Deleted session:', session.id);
      } catch (e) {
        console.error('[Reset] Failed to delete session:', session.id, e);
      }
    }

    // Delete all presets to force re-import of default preset
    for (const preset of presets) {
      try {
        await deletePreset(preset.id);
        console.log('[Reset] Deleted preset:', preset.id);
      } catch (e) {
        console.error('[Reset] Failed to delete preset:', preset.id, e);
      }
    }

    // Clear local state
    setMessageStatuses({});
    setLastUserMessageId(null);
    setFailedMessageContent('');

    // Reset other initialization flags
    hasInitialized.current = false;
    hasRunGapAnalysis.current = false;

    // Clear player setup from localStorage to force re-setup
    localStorage.removeItem('player_setup');

    // Clear moments/posts
    localStorage.removeItem('moments_posts');
    setPosts([]);
    console.log('[Reset] All sessions deleted, presets cleared, moments cleared, user needs to set up again');

    // Reload page to trigger fresh start
    window.location.reload();
  };

  // Handle profile changes and notify LLM if nickname/signature changed
  const handleProfileChange = async (newProfile: UserProfile) => {
    const oldNickname = userProfile.nickname;
    const oldSignature = userProfile.signature;
    const newNickname = newProfile.nickname;
    const newSignature = newProfile.signature;

    // Update profile state
    setUserProfile(newProfile);
    setShowProfile(false);

    // Check if nickname or signature changed
    const nicknameChanged = oldNickname !== newNickname;
    const signatureChanged = oldSignature !== newSignature;

    if ((nicknameChanged || signatureChanged) && isOnline && currentSessionId) {
      let notificationMsg = '[系统通知] 与你聊天的玩家';
      if (nicknameChanged && signatureChanged) {
        notificationMsg += `${oldNickname}修改了昵称为"${newNickname}"，并更新了签名:"${newSignature}"`;
      } else if (nicknameChanged) {
        notificationMsg += `${oldNickname}修改了昵称为"${newNickname}"`;
      } else {
        notificationMsg += `${newNickname}更新了签名:"${newSignature}"`;
      }

      console.log('[Profile] Notifying LLM:', notificationMsg);

      try {
        const history = await getHistoryForLLM(50);
        const customSystemPrompt = (() => {
          const savedSetup = localStorage.getItem('player_setup');
          const setup = playerSetup || (savedSetup ? JSON.parse(savedSetup) : null);
          return setup ? buildSystemPrompt(setup) : undefined;
        })();

        await sendMessage(notificationMsg, {
          history: history,
          preset: currentPreset || undefined,
          systemPrompt: customSystemPrompt,
          onPoke: () => {
            console.log('[Profile] Detected poke tag');
            triggerShake('戳了戳你');
          },
          onChatMessage: async (rawMsg) => {
            // Process actions and get cleaned message
            const cleanedMsg = await handleMessageWithActions(rawMsg);

            // Save AI's response to chat (if it's a chat message)
            if (cleanedMsg) {
              await addMessage('assistant', cleanedMsg, {
                name: heroineProfile.nickname,
                timestamp: formatTime(Math.floor(Date.now() / 1000))
              });
            }
          }
        });
      } catch (error) {
        console.error('[Profile] Failed to notify LLM:', error);
      }
    }
  };

  return (
    <div className={`fixed inset-0 bg-coffee-900 flex z-30 ${isShaking ? 'animate-shake' : ''}`}>
      {/* Shake animation style */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          5% { transform: translateX(-2px) rotate(-0.5deg); }
          10% { transform: translateX(2px) rotate(0.5deg); }
          15% { transform: translateX(-2px) rotate(-0.5deg); }
          20% { transform: translateX(2px) rotate(0.5deg); }
          25% { transform: translateX(-1px) rotate(-0.25deg); }
          30% { transform: translateX(1px) rotate(0.25deg); }
          35% { transform: translateX(-1px) rotate(-0.25deg); }
          40% { transform: translateX(1px) rotate(0.25deg); }
          45% { transform: translateX(-0.5px) rotate(0deg); }
          50% { transform: translateX(0.5px) rotate(0deg); }
          55%, 100% { transform: translateX(0); }
        }
        .animate-shake {
          animation: shake 1.2s ease-in-out;
        }
      `}</style>

      {/* Action notification toast */}
      <AnimatePresence>
        {actionNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-coffee-800/90 text-coffee-100 px-4 py-2 rounded text-sm"
            style={{
              boxShadow: '0 4px 0 rgba(0,0,0,0.3)',
            }}
          >
            <span className="text-amber-400">👆</span> {actionNotification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        <div className="scanlines absolute inset-0 pointer-events-none"></div>
        <div className="crt-flicker absolute inset-0 pointer-events-none"></div>

        <div className="flex-1 pixel-border flex flex-col relative z-10 h-full max-w-3xl mx-auto w-full">
          {currentView === 'chat' ? (
            <>
              {/* Header */}
              <div className="bg-coffee-800 text-coffee-100 p-4 flex items-center justify-between border-b-4 border-coffee-900">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowHeroineProfile(true)}
                    className="relative w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity"
                    title="查看资料"
                  >
                    <div className="w-10 h-10 pixel-border-inset bg-coffee-300 flex items-center justify-center">
                      <span className="text-xl">{heroineProfile.avatar}</span>
                    </div>
                    {/* 在线状态指示器 */}
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-coffee-800 ${
                        isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                      }`}
                      title={isOnline ? '在线' : '离线'}
                    />
                  </button>
                  <div>
                    <h2 className="font-bold text-lg">{heroineProfile.nickname}</h2>
                    <p className="text-xs text-coffee-300 flex items-center gap-2">
                      <span className={isOnline ? 'text-green-400' : 'text-gray-400'}>
                        {isOnline ? '在线' : '离线（23:30 下线，08:00 上线）'}
                      </span>
                      {heroineProfile.signature && (
                        <>
                          <span className="text-coffee-500">|</span>
                          <span className="text-amber-400 italic truncate max-w-[180px]" title={heroineProfile.signature}>
                            {heroineProfile.signature}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPresetManager(true)}
                    className="pixel-button px-3 py-2 text-sm"
                    title="预设管理"
                  >
                    ⚙️
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="pixel-button px-3 py-2 text-sm"
                    title="全屏"
                  >
                    🖵
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="pixel-button px-3 py-2 text-sm"
                    title="设置"
                  >
                    🔧
                  </button>
                  <button
                    onClick={() => setCurrentView('moments')}
                    className="pixel-button px-4 py-2 text-sm"
                  >
                    查看动态
                  </button>
                </div>
              </div>

              {/* 离线通知横幅 */}
              <AnimatePresence>
                {(!isOnline || showOfflineNotice) && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="bg-coffee-700 text-coffee-100 text-xs text-center py-2 px-4 border-b-2 border-coffee-900"
                  >
                    {!isOnline
                      ? '夏目已下线休息了……她每天 08:00 上线，23:30 下线。消息已保存，等她上线后会看到的。'
                      : '夏目暂时不在，消息已保存，稍后她会回复你。'}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {!currentSessionId ? (
                  <div className="flex flex-col items-center justify-center h-full text-coffee-400">
                    <p className="text-lg">正在加载...</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                      const status = messageStatuses[msg.id];
                      const isFailed = status === 'failed';
                      const isSending = status === 'sending';

                      // System messages (e.g., poke notifications) - centered, neutral
                      if (msg.role === 'system') {
                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex justify-center my-4"
                          >
                            <div className="text-xs text-coffee-500 bg-coffee-200/50 px-4 py-2 rounded-full">
                              {msg.content}
                            </div>
                          </motion.div>
                        );
                      }

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 20, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                          {/* Avatar */}
                          <div
                            onClick={msg.role === 'user' ? () => setShowProfile(true) : undefined}
                            className={`w-10 h-10 pixel-border shrink-0 flex items-center justify-center text-xl transition-transform ${
                              msg.role === 'user'
                                ? 'bg-amber-400 cursor-pointer hover:bg-amber-300 active:translate-y-[2px]'
                                : 'bg-coffee-300'
                            }`}
                          >
                            {msg.role === 'user' ? userProfile.avatar : heroineProfile.avatar}
                          </div>

                          <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className="text-[10px] text-coffee-400 mb-1 flex items-center gap-2">
                              <span>
                                {msg.metadata?.name || (msg.role === 'user' ? userProfile.nickname : heroineProfile.nickname)} • {formatTime(msg.created_at)}
                              </span>
                              {/* Status indicators for user messages */}
                              {msg.role === 'user' && (
                                <>
                                  {isSending && (
                                    <span className="text-amber-400 animate-pulse">发送中...</span>
                                  )}
                                  {isFailed && (
                                    <span className="text-red-400 font-bold">✗ 发送失败</span>
                                  )}
                                </>
                              )}
                            </div>
                            <div
                              className={`max-w-full p-3 ${
                                msg.role === 'user'
                                  ? isFailed
                                    ? 'bg-red-200 text-coffee-900 border-4 border-red-400'
                                    : 'bg-amber-500 text-coffee-900 border-4 border-coffee-800'
                                  : 'bg-coffee-50 text-coffee-900 border-4 border-coffee-800'
                              }`}
                              style={{
                                boxShadow: msg.role === 'user'
                                  ? 'inset -2px -2px 0px 0px rgba(0,0,0,0.2), inset 2px 2px 0px 0px rgba(255,255,255,0.5), 4px 4px 0px 0px rgba(0,0,0,0.3)'
                                  : 'inset -2px -2px 0px 0px rgba(0,0,0,0.2), inset 2px 2px 0px 0px rgba(255,255,255,0.5), 4px 4px 0px 0px rgba(0,0,0,0.3)'
                              }}
                            >
                              {msg.role === 'assistant' ? cleanRolePrefix(cleanChatTags(msg.content)) : msg.content}
                            </div>
                            {/* Action buttons for failed messages */}
                            {isFailed && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleRetry(msg.id)}
                                  disabled={isTyping}
                                  className="pixel-button px-3 py-1 text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-50"
                                >
                                  🔄 重发
                                </button>
                                <button
                                  onClick={() => handleDeleteFailed(msg.id)}
                                  className="pixel-button px-3 py-1 text-xs bg-coffee-600 hover:bg-coffee-500"
                                >
                                  ✕ 撤回并编辑
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
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
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 bg-coffee-200 border-t-4 border-coffee-800 flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={
                    !currentSessionId ? "正在加载..." :
                    !isOnline ? "夏目休息中，留言后她上线会看到..." :
                    "输入消息..."
                  }
                  disabled={!currentSessionId || isTyping}
                  className="flex-1 pixel-border-inset p-3 outline-none text-coffee-900 bg-coffee-50 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || !currentSessionId || isTyping}
                  className="pixel-button px-6 font-bold disabled:opacity-50"
                >
                  发送
                </button>
              </div>
            </>
          ) : (
            <MomentsPanel
              userProfile={userProfile}
              onBack={() => setCurrentView('chat')}
              posts={posts}
              setPosts={setPosts}
              onNotifyLLM={notifyLLM}
            />
          )}
        </div>

        {/* Modals */}
        <AnimatePresence>
          {showProfile && (
            <ProfileModal
              profile={userProfile}
              onSave={handleProfileChange}
              onClose={() => setShowProfile(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSettings && (
            <SettingsModal onClose={() => setShowSettings(false)} onReset={handleReset} />
          )}
        </AnimatePresence>

        {/* 夏目资料弹窗 */}
        <AnimatePresence>
          {showHeroineProfile && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="pixel-border w-full max-w-md bg-coffee-100 flex flex-col"
              >
                <div className="bg-coffee-800 text-coffee-100 p-4 border-b-4 border-coffee-900 flex items-center justify-between">
                  <h3 className="font-bold text-lg">个人资料</h3>
                  <button
                    onClick={() => setShowHeroineProfile(false)}
                    className="text-coffee-300 hover:text-coffee-100 text-xl"
                  >
                    ×
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  {/* 头像 */}
                  <div className="flex justify-center">
                    <div className="w-20 h-20 pixel-border-inset bg-coffee-300 flex items-center justify-center">
                      <span className="text-4xl">{heroineProfile.avatar}</span>
                    </div>
                  </div>
                  {/* 昵称 */}
                  <div className="space-y-2">
                    <label className="text-sm text-coffee-600 font-bold">昵称</label>
                    <div className="pixel-border-inset bg-coffee-50 p-3 text-coffee-800">
                      {heroineProfile.nickname}
                    </div>
                  </div>
                  {/* 签名 */}
                  <div className="space-y-2">
                    <label className="text-sm text-coffee-600 font-bold">个性签名</label>
                    <div className="pixel-border-inset bg-coffee-50 p-3 text-coffee-800 min-h-[60px]">
                      {heroineProfile.signature || '还没有设置签名...'}
                    </div>
                  </div>
                  {/* 状态 */}
                  <div className="space-y-2">
                    <label className="text-sm text-coffee-600 font-bold">状态</label>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 ${isOnline ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                      <span className="text-coffee-800">{isOnline ? '在线' : '离线'}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t-4 border-coffee-200 bg-coffee-100">
                  <button
                    onClick={() => setShowHeroineProfile(false)}
                    className="w-full pixel-button py-2"
                  >
                    关闭
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPresetManager && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="pixel-border w-full max-w-2xl h-[80vh] bg-coffee-100 flex flex-col"
              >
                <PresetManager
                  presets={presets}
                  activePreset={activePreset}
                  currentSessionPresetId={currentSession?.preset_id}
                  onSelectPreset={handleSelectPresetForSession}
                  onCreatePreset={handleCreatePreset}
                  onEditPreset={handleUpdatePreset}
                  onDeletePreset={deletePreset}
                  onImportPreset={() => {
                    setShowPresetManager(false);
                    setShowPresetImporter(true);
                  }}
                  onExportPreset={exportPreset}
                  onSetActive={setActive}
                  onClose={() => setShowPresetManager(false)}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPresetImporter && (
            <PresetImporter
              onImport={uploadPreset}
              onClose={() => setShowPresetImporter(false)}
            />
          )}
        </AnimatePresence>

        {/* Music Player */}
        <AnimatePresence>
          {currentMusic && (
            <MusicPlayer
              music={currentMusic}
              onClose={() => setCurrentMusic(null)}
            />
          )}
        </AnimatePresence>

        {/* Music search loading indicator */}
        <AnimatePresence>
          {isSearchingMusic && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-4 right-4 z-50 bg-coffee-800 text-coffee-100 px-4 py-2 pixel-border"
            >
              <span className="text-xs">🎵 正在搜索音乐...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
