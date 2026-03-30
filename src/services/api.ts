// In development, use relative path to leverage Vite proxy
// In production, use the configured API URL
const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || '/api');

// Chat Sessions API
export const chatApi = {
  // Create new session
  createSession: async (title: string, presetId?: string) => {
    const res = await fetch(`${API_BASE}/chat/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, preset_id: presetId })
    });
    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
  },

  // List all sessions
  listSessions: async (limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const res = await fetch(`${API_BASE}/chat/sessions?${params}`);
    if (!res.ok) throw new Error('Failed to list sessions');
    return res.json();
  },

  // Get specific session
  getSession: async (id: string) => {
    const res = await fetch(`${API_BASE}/chat/sessions/${id}`);
    if (!res.ok) throw new Error('Failed to get session');
    return res.json();
  },

  // Update session
  updateSession: async (id: string, updates: { title?: string; preset_id?: string }) => {
    const res = await fetch(`${API_BASE}/chat/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update session');
    return res.json();
  },

  // Delete session
  deleteSession: async (id: string) => {
    const res = await fetch(`${API_BASE}/chat/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete session');
    return res.json();
  },

  // Get messages
  getMessages: async (sessionId: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}/messages?${params}`);
    if (!res.ok) throw new Error('Failed to get messages');
    return res.json();
  },

  // Add message
  addMessage: async (sessionId: string, role: 'user' | 'assistant' | 'system', content: string, metadata?: any, createdAt?: number) => {
    const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content, metadata, ...(createdAt !== undefined && { created_at: createdAt }) })
    });
    if (!res.ok) throw new Error('Failed to add message');
    return res.json();
  },

  // Update message
  updateMessage: async (messageId: string, content: string) => {
    const res = await fetch(`${API_BASE}/chat/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) throw new Error('Failed to update message');
    return res.json();
  },

  // Delete message
  deleteMessage: async (messageId: string) => {
    const res = await fetch(`${API_BASE}/chat/messages/${messageId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete message');
  },

  // Get LLM history format
  getHistory: async (sessionId: string, maxMessages?: number) => {
    const params = new URLSearchParams();
    if (maxMessages) params.append('max', maxMessages.toString());
    const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}/history?${params}`);
    if (!res.ok) throw new Error('Failed to get history');
    return res.json();
  }
};

// SillyTavern-style Prompt Entry
export interface PromptEntry {
  id: string;
  preset_id: string;
  name: string;
  content: string;
  enabled: boolean;
  position: number;

  // SillyTavern specific fields
  role: 'system' | 'user' | 'assistant';
  system_prompt: boolean;
  identifier?: string;
  marker?: boolean;
  injection_position: number;
  injection_depth: number;
  injection_order: number;
  injection_trigger?: string[];
  forbid_overrides: boolean;

  created_at: number;
  updated_at: number;
}

// Presets API (SillyTavern Chat Completion format)
export interface ChatCompletionPreset {
  id: string;
  name: string;
  description?: string;

  // OpenAI API parameters
  temperature: number;
  top_p: number;
  top_k: number;
  top_a: number;
  min_p: number;
  presence_penalty: number;
  frequency_penalty: number;
  repetition_penalty: number;

  // Context and token limits
  openai_max_context: number;
  openai_max_tokens: number;
  max_context_unlocked: boolean;
  max_history: number;

  // Stop sequences
  stop_sequences?: string[];

  // SillyTavern specific settings
  wrap_in_quotes: boolean;
  names_behavior: number;
  send_if_empty: string;
  impersonation_prompt?: string;
  new_chat_prompt?: string;
  new_group_chat_prompt?: string;
  new_example_chat_prompt?: string;
  continue_nudge_prompt?: string;
  bias_preset_selected: string;
  stream_openai: boolean;

  // Format settings
  wi_format?: string;
  scenario_format?: string;
  personality_format?: string;
  group_nudge_prompt?: string;

  // Prompt entries
  prompt_entries?: PromptEntry[];

  // Raw import data
  raw_data?: string;

  created_at: number;
  updated_at: number;
}

// Alias for backward compatibility
export type TextGenPreset = ChatCompletionPreset;

export const presetApi = {
  // List all presets
  list: async (limit?: number, offset?: number): Promise<ChatCompletionPreset[]> => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const res = await fetch(`${API_BASE}/presets?${params}`);
    if (!res.ok) throw new Error('Failed to list presets');
    return res.json();
  },

  // Get specific preset
  get: async (id: string): Promise<ChatCompletionPreset> => {
    const res = await fetch(`${API_BASE}/presets/${id}`);
    if (!res.ok) throw new Error('Failed to get preset');
    return res.json();
  },

  // Get active preset
  getActive: async (): Promise<ChatCompletionPreset | null> => {
    const res = await fetch(`${API_BASE}/presets/active`);
    if (!res.ok) throw new Error('Failed to get active preset');
    return res.json();
  },

  // Set active preset
  setActive: async (presetId: string | null): Promise<void> => {
    const res = await fetch(`${API_BASE}/presets/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset_id: presetId })
    });
    if (!res.ok) throw new Error('Failed to set active preset');
  },

  // Create new preset
  create: async (data: Partial<ChatCompletionPreset>): Promise<ChatCompletionPreset> => {
    const res = await fetch(`${API_BASE}/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create preset');
    return res.json();
  },

  // Import from SillyTavern JSON
  importJSON: async (data: any): Promise<ChatCompletionPreset> => {
    const res = await fetch(`${API_BASE}/presets/import/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to import preset');
    return res.json();
  },

  // Upload preset file (JSON or YAML)
  upload: async (file: File): Promise<ChatCompletionPreset> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/presets/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Failed to upload preset');
    return res.json();
  },

  // Export preset to SillyTavern format
  export: async (id: string): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/presets/${id}/export`);
    if (!res.ok) throw new Error('Failed to export preset');
    return res.blob();
  },

  // Update preset
  update: async (id: string, updates: Partial<ChatCompletionPreset>): Promise<ChatCompletionPreset> => {
    const res = await fetch(`${API_BASE}/presets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update preset');
    return res.json();
  },

  // Delete preset
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/presets/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete preset');
  },

  // Get default preset values
  getDefaults: async (): Promise<Partial<ChatCompletionPreset>> => {
    const res = await fetch(`${API_BASE}/presets/defaults`);
    if (!res.ok) throw new Error('Failed to get defaults');
    return res.json();
  },

  // Prompt Entries API
  getPromptEntries: async (presetId: string): Promise<PromptEntry[]> => {
    const res = await fetch(`${API_BASE}/presets/${presetId}/entries`);
    if (!res.ok) throw new Error('Failed to get prompt entries');
    return res.json();
  },

  createPromptEntry: async (presetId: string, data: Partial<PromptEntry>): Promise<PromptEntry> => {
    const res = await fetch(`${API_BASE}/presets/${presetId}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create prompt entry');
    return res.json();
  },

  updatePromptEntry: async (presetId: string, entryId: string, updates: Partial<PromptEntry>): Promise<PromptEntry[]> => {
    const res = await fetch(`${API_BASE}/presets/${presetId}/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update prompt entry');
    return res.json();
  },

  deletePromptEntry: async (presetId: string, entryId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/presets/${presetId}/entries/${entryId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete prompt entry');
  },

  reorderPromptEntries: async (presetId: string, entryIds: string[]): Promise<PromptEntry[]> => {
    const res = await fetch(`${API_BASE}/presets/${presetId}/entries/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_ids: entryIds })
    });
    if (!res.ok) throw new Error('Failed to reorder prompt entries');
    return res.json();
  }
};

// Helper function to download exported preset
export const downloadPreset = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
