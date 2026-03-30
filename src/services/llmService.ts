import { GoogleGenAI } from '@google/genai';
import { processStreamingContent } from './llmProcessor';

export interface LLMCallSettings {
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
}

/**
 * Single non-streaming LLM call. Returns the first extracted chat message, or raw text if no tags.
 */
export async function callLLMOnce(
  messages: { role: string; content: string }[],
  settings: LLMCallSettings
): Promise<string | null> {
  const { apiUrl, apiKey, model, temperature = 0.7 } = settings;

  try {
    if (!apiUrl) {
      // Gemini SDK
      const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY as string) || apiKey });
      const systemMsg = messages.find(m => m.role === 'system')?.content ?? '';
      const userMessages = messages.filter(m => m.role !== 'system');
      const userOnly = userMessages.filter(m => m.role === 'user');
      const lastUser = userOnly[userOnly.length - 1];
      if (!lastUser) return null;

      const newChat = ai.chats.create({
        model: model || 'gemini-3.1-pro-preview',
        config: { systemInstruction: systemMsg, temperature },
      });
      const response = await newChat.sendMessage({ message: lastUser.content });
      const { messages: chatMsgs } = processStreamingContent(response.text ?? '');
      return chatMsgs[0] ?? response.text ?? null;
    } else {
      // Custom OpenAI-compatible API (non-streaming)
      let url = apiUrl.trim();
      if (!url.endsWith('/chat/completions')) {
        url = url.endsWith('/') ? `${url}chat/completions` : `${url}/chat/completions`;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          temperature,
          max_tokens: 256,
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content ?? null;
      if (!raw) return null;
      const { messages: chatMsgs } = processStreamingContent(raw);
      return chatMsgs[0] ?? raw;
    }
  } catch (e) {
    console.error('[llmService] callLLMOnce failed:', e);
    return null;
  }
}
