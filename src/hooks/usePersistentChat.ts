import { useState, useCallback, useEffect } from 'react';
import { chatApi, presetApi, TextGenPreset } from '../services/api';

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    name?: string;
    avatar?: string;
    timestamp?: string;
  };
  created_at: number;
}

export interface ChatSession {
  id: string;
  title: string;
  preset_id?: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}

export function usePersistentChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start as true to prevent premature checks
  const [error, setError] = useState<string | null>(null);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Load messages when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const data = await chatApi.listSessions(50);
      setSessions(data);
      // Auto-select the single session if none is currently selected
      if (data.length > 0) {
        setCurrentSessionId(prev => prev ?? data[0].id);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load sessions');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const data = await chatApi.getMessages(sessionId);
      setMessages(data);
      setError(null);
    } catch (err) {
      setError('Failed to load messages');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const createSession = async (title: string, presetId?: string): Promise<string> => {
    try {
      setIsLoading(true);
      const session = await chatApi.createSession(title, presetId);
      setSessions(prev => [session, ...prev]);
      setCurrentSessionId(session.id);
      setError(null);
      return session.id;
    } catch (err) {
      setError('Failed to create session');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const selectSession = useCallback((sessionId: string | null) => {
    setCurrentSessionId(sessionId);
  }, []);

  const deleteSession = async (sessionId: string) => {
    // Always remove from local state; ignore server 404 (already deleted)
    try { await chatApi.deleteSession(sessionId); } catch { /* ignore */ }
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  };

  const updateSession = async (sessionId: string, updates: Partial<ChatSession>) => {
    try {
      await chatApi.updateSession(sessionId, updates);
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, ...updates } : s
      ));
    } catch (err) {
      setError('Failed to update session');
      throw err;
    }
  };

  const addMessage = async (
    role: Message['role'],
    content: string,
    metadata?: Message['metadata'],
    createdAt?: number
  ): Promise<Message> => {
    if (!currentSessionId) {
      throw new Error('No active session');
    }

    try {
      const message = await chatApi.addMessage(currentSessionId, role, content, metadata, createdAt);
      setMessages(prev => {
        const next = [...prev, message];
        // Keep sorted by created_at in case historical messages are inserted
        return next.sort((a, b) => a.created_at - b.created_at);
      });
      // Refresh sessions to update message count
      loadSessions();
      return message;
    } catch (err) {
      setError('Failed to add message');
      throw err;
    }
  };

  /**
   * Like addMessage but accepts an explicit sessionId — use this when the session
   * was just created and the state update hasn't propagated to closures yet.
   */
  const addMessageToSession = async (
    sessionId: string,
    role: Message['role'],
    content: string,
    metadata?: Message['metadata'],
    createdAt?: number
  ): Promise<Message> => {
    try {
      const message = await chatApi.addMessage(sessionId, role, content, metadata, createdAt);
      setMessages(prev => {
        const next = [...prev, message];
        return next.sort((a, b) => a.created_at - b.created_at);
      });
      loadSessions();
      return message;
    } catch (err) {
      setError('Failed to add message');
      throw err;
    }
  };

  /** Returns the most recent user message, or null if none exists. */
  const getLastUserMessage = (): Message | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i];
    }
    return null;
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await chatApi.deleteMessage(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      setError('Failed to delete message');
      throw err;
    }
  };

  const updateMessage = async (messageId: string, updates: Partial<Pick<Message, 'content' | 'metadata'>>) => {
    try {
      // If content changed, call API to update
      if (updates.content !== undefined) {
        await chatApi.updateMessage(messageId, updates.content);
      }
      // Update local state
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, ...updates } : m
      ));
    } catch (err) {
      setError('Failed to update message');
      throw err;
    }
  };

  const getHistoryForLLM = async (maxMessages = 50): Promise<{ role: string; content: string; sender?: string; timestamp?: number }[]> => {
    if (!currentSessionId) return [];
    try {
      const data = await chatApi.getHistory(currentSessionId, maxMessages);
      // Backend returns { history, preset } object
      return data.history || [];
    } catch (err) {
      console.error('Failed to get history:', err);
      return [];
    }
  };

  // Get current session with preset info
  const getSessionWithPreset = async (): Promise<{ session: ChatSession | null; preset: TextGenPreset | null }> => {
    if (!currentSessionId) return { session: null, preset: null };
    try {
      const session = await chatApi.getSession(currentSessionId);
      return { session, preset: session.preset };
    } catch (err) {
      console.error('Failed to get session with preset:', err);
      return { session: null, preset: null };
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;

  return {
    // State
    sessions,
    currentSession,
    currentSessionId,
    messages,
    isLoading,
    error,

    // Actions
    createSession,
    selectSession,
    deleteSession,
    updateSession,
    addMessage,
    addMessageToSession,
    deleteMessage,
    updateMessage,
    loadSessions,
    loadMessages,
    getHistoryForLLM,
    getSessionWithPreset,
    getLastUserMessage,
    refresh: loadSessions
  };
}

// Hook for managing presets
export function usePresets() {
  const [presets, setPresets] = useState<TextGenPreset[]>([]);
  const [activePreset, setActivePreset] = useState<TextGenPreset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPresets = async () => {
    try {
      setIsLoading(true);

      // Load preset list first
      let presetList = await presetApi.list();

      // If no presets, auto-import default preset
      if (presetList.length === 0) {
        try {
          const response = await fetch('/Imported_Preset.json');
          if (response.ok) {
            const defaultPreset = await response.json();
            const imported = await presetApi.importJSON(defaultPreset);
            presetList = [imported];
            console.log('[Presets] Auto-imported default preset');
            // Set the imported preset as active
            try {
              await presetApi.setActive(imported.id);
              setActivePreset(imported);
              console.log('[Presets] Set imported preset as active');
            } catch (activeErr) {
              console.error('[Presets] Failed to set active preset:', activeErr);
            }
          }
        } catch (importErr) {
          console.log('[Presets] No default preset found to import');
        }
      }

      setPresets(presetList);

      // Try to get active preset separately (may fail if none set)
      try {
        const currentActive = await presetApi.getActive();
        setActivePreset(currentActive);
      } catch (activeErr) {
        // If no active preset but we have presets, set the first one as active
        if (presetList.length > 0) {
          await setActive(presetList[0].id);
        } else {
          setActivePreset(null);
          console.log('No active preset set');
        }
      }

      setError(null);
    } catch (err) {
      setError('Failed to load presets');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadPreset = async (file: File) => {
    try {
      setIsLoading(true);
      const preset = await presetApi.upload(file);
      setPresets(prev => [preset, ...prev]);
      return preset;
    } catch (err) {
      setError('Failed to upload preset');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const importPresetJSON = async (data: any) => {
    try {
      setIsLoading(true);
      const preset = await presetApi.importJSON(data);
      setPresets(prev => [preset, ...prev]);
      return preset;
    } catch (err) {
      setError('Failed to import preset');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const createPreset = async (data: Partial<TextGenPreset>) => {
    try {
      setIsLoading(true);
      const preset = await presetApi.create(data);
      setPresets(prev => [preset, ...prev]);
      return preset;
    } catch (err) {
      setError('Failed to create preset');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreset = async (id: string, updates: Partial<TextGenPreset>) => {
    try {
      setIsLoading(true);

      // If prompt_entries are included, we need to handle them separately
      const { prompt_entries, ...presetUpdates } = updates;

      // Update preset basic info
      const preset = await presetApi.update(id, presetUpdates);

      // Update prompt entries if provided
      if (prompt_entries) {
        // Get current entries to compare
        const currentPreset = presets.find(p => p.id === id);
        const currentEntries = currentPreset?.prompt_entries || [];

        // Process each entry
        for (const entry of prompt_entries) {
          if (entry.id.startsWith('temp_')) {
            // New entry - create it
            await presetApi.createPromptEntry(id, {
              name: entry.name,
              content: entry.content,
              enabled: entry.enabled,
              position: entry.position,
              role: entry.role,
              system_prompt: entry.system_prompt,
              identifier: entry.identifier,
              marker: entry.marker,
              injection_position: entry.injection_position,
              injection_depth: entry.injection_depth,
              injection_order: entry.injection_order,
              injection_trigger: entry.injection_trigger,
              forbid_overrides: entry.forbid_overrides
            });
          } else {
            // Existing entry - update it
            const currentEntry = currentEntries.find(e => e.id === entry.id);
            if (currentEntry) {
              const hasChanges =
                currentEntry.name !== entry.name ||
                currentEntry.content !== entry.content ||
                currentEntry.enabled !== entry.enabled ||
                currentEntry.position !== entry.position ||
                currentEntry.role !== entry.role ||
                currentEntry.system_prompt !== entry.system_prompt ||
                currentEntry.marker !== entry.marker ||
                currentEntry.injection_position !== entry.injection_position ||
                currentEntry.injection_depth !== entry.injection_depth ||
                currentEntry.injection_order !== entry.injection_order ||
                currentEntry.forbid_overrides !== entry.forbid_overrides;

              if (hasChanges) {
                await presetApi.updatePromptEntry(id, entry.id, {
                  name: entry.name,
                  content: entry.content,
                  enabled: entry.enabled,
                  position: entry.position,
                  role: entry.role,
                  system_prompt: entry.system_prompt,
                  identifier: entry.identifier,
                  marker: entry.marker,
                  injection_position: entry.injection_position,
                  injection_depth: entry.injection_depth,
                  injection_order: entry.injection_order,
                  injection_trigger: entry.injection_trigger,
                  forbid_overrides: entry.forbid_overrides
                });
              }
            }
          }
        }

        // Delete removed entries
        const newEntryIds = new Set(prompt_entries.map(e => e.id).filter(id => !id.startsWith('temp_')));
        for (const oldEntry of currentEntries) {
          if (!newEntryIds.has(oldEntry.id)) {
            await presetApi.deletePromptEntry(id, oldEntry.id);
          }
        }

        // Refresh preset to get updated entries
        const updatedPreset = await presetApi.get(id);
        setPresets(prev => prev.map(p => p.id === id ? updatedPreset : p));
        if (activePreset?.id === id) {
          setActivePreset(updatedPreset);
        }
        return updatedPreset;
      }

      setPresets(prev => prev.map(p => p.id === id ? preset : p));
      if (activePreset?.id === id) {
        setActivePreset(preset);
      }
      return preset;
    } catch (err) {
      setError('Failed to update preset');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deletePreset = async (id: string) => {
    try {
      await presetApi.delete(id);
      setPresets(prev => prev.filter(p => p.id !== id));
      if (activePreset?.id === id) {
        setActivePreset(null);
      }
    } catch (err) {
      setError('Failed to delete preset');
      throw err;
    }
  };

  const exportPreset = async (preset: TextGenPreset) => {
    try {
      const blob = await presetApi.export(preset.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${preset.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to export preset');
      throw err;
    }
  };

  const setActive = async (presetId: string | null) => {
    try {
      await presetApi.setActive(presetId);
      const preset = presetId ? await presetApi.get(presetId) : null;
      setActivePreset(preset);
    } catch (err) {
      setError('Failed to set active preset');
      throw err;
    }
  };

  useEffect(() => {
    loadPresets();
  }, []);

  return {
    presets,
    activePreset,
    isLoading,
    error,
    loadPresets,
    uploadPreset,
    importPresetJSON,
    createPreset,
    updatePreset,
    deletePreset,
    exportPreset,
    setActive
  };
}
