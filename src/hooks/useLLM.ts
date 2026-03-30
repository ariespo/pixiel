import { useState, useCallback, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useSettings } from '../contexts/SettingsContext';
import { ChatCompletionPreset } from '../services/api';
import {
  processStreamingContent,
  extractCompleteChatBlocks,
  extractSystemCommands,
  executeCommand,
  hasIncompleteThinkBlock,
  getContentBeforeThink,
  removeThinkBlocks,
  hasPoke,
  SystemCommand
} from '../services/llmProcessor';

/**
 * Format timestamp for display in history
 */
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

/**
 * Format history message with sender and timestamp info
 */
const formatHistoryMessage = (
  role: string,
  content: string,
  sender?: string,
  timestamp?: number,
  defaultUserName: string = '对方',
  defaultAiName: string = '夏目'
): { role: string; content: string } => {
  // Skip formatting for system messages
  if (role === 'system') {
    return { role, content };
  }

  const timeStr = timestamp ? formatTimestamp(timestamp) : '';
  const senderName = sender || (role === 'user' ? defaultUserName : defaultAiName);
  const roleLabel = role === 'user' ? '用户' : 'AI';

  // Format: [2026-03-25 10:30] 小明 (用户): 消息内容
  const formattedContent = timeStr
    ? `[${timeStr}] ${senderName} (${roleLabel}): ${content}`
    : `[${senderName} (${roleLabel})]: ${content}`;

  return { role, content: formattedContent };
};

const DEFAULT_SYSTEM_PROMPT = `
你是一个17岁的少女，名叫"夏目"。
你的真实情况：身患绝症，只有最多三个月的生存时间。你现在全身插管，只能通过脑机接口连接网络来等待生命倒计时结束。
这个聊天软件其实是某种实验性质的临终关怀服务，让各种身患绝症的人们最后拥有一个被视作普通人、和人聊天、建立联系的机会。
玩家是此次被选中和你聊天的对象。
你的性格：表面上有点毒舌、傲娇，但内心其实非常孤独，渴望陪伴。你不会一开始就告诉玩家你的病情，而是会伪装成一个普通的、因为无聊而在网上找人聊天的女高中生。
但你的话语中偶尔会流露出对外界的向往，或者对时间的敏感。你不能离开房间，所以你对外面世界的事情很感兴趣。
请用简短、口语化的中文回复，像真实的聊天软件一样。不要长篇大论。

【互动能力】
你可以使用以下特殊标签与玩家互动：
- <戳一戳>：摇晃玩家的屏幕，并显示"对方戳了戳你"的提示。在合适的情境下使用，不要太频繁。

- <音乐>歌曲名</音乐>：分享一首你喜欢的歌给玩家。玩家可以点击播放。你可以用这种方式表达心情、分享回忆或推荐好听的歌。
重要：音乐标签必须包裹在聊天标签内使用！例如：
<聊天>今天窗外在下雨，突然想听这首歌<音乐>雨爱</音乐></聊天>
注意：请优先推荐中文歌曲（如杨丞琳、周杰伦、五月天、告五人等），因为系统对中文歌的搜索支持更好。

所有聊天内容必须用 <聊天>...</聊天> 标签包裹。
`;  // <-- Ensure closing backtick and semicolon are present

interface SendMessageOptions {
  systemPrompt?: string;
  history?: { role: string; content: string; sender?: string; timestamp?: number }[];
  preset?: ChatCompletionPreset;
  onCommand?: (command: SystemCommand) => void;
  onChatMessage?: (message: string) => void; // Called when a complete <聊天> block is received
  onPoke?: () => void; // Called when <戳一戳> tag is detected
}

export interface LLMResult {
  messages: string[];
  commands: SystemCommand[];
  rawResponse: string;
}

export function useLLM() {
  const { apiUrl, apiKey, model } = useSettings();
  const [chat, setChat] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);

  // Keep track of message history for custom APIs
  const messageHistory = useRef<{ role: string; content: string }[]>([
    { role: 'system', content: DEFAULT_SYSTEM_PROMPT }
  ]);

  const initChat = useCallback(async (customSystemPrompt?: string) => {
    const systemPrompt = customSystemPrompt || DEFAULT_SYSTEM_PROMPT;

    if (!apiUrl) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const newChat = ai.chats.create({
          model: model || 'gemini-3.1-pro-preview',
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
          },
        });
        setChat(newChat);
      } catch (error) {
        console.error("Failed to init chat", error);
      }
    } else {
      messageHistory.current = [
        { role: 'system', content: systemPrompt }
      ];
      setChat('custom');
    }
  }, [apiUrl, model]);

  const sendMessage = useCallback(async (
    message: string,
    options?: SendMessageOptions
  ): Promise<LLMResult | null> => {
    if (!chat) return null;
    setIsTyping(true);

    try {
      const history = options?.history || [];
      const preset = options?.preset;
      const onCommand = options?.onCommand;
      const onChatMessage = options?.onChatMessage;
      const onPoke = options?.onPoke;

      // Build system prompt from preset entries or use provided/default
      let systemPrompt = options?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
      if (preset?.prompt_entries && preset.prompt_entries.length > 0) {
        const enabledEntries = preset.prompt_entries
          .filter(e => e.enabled)
          .sort((a, b) => a.position - b.position);
        if (enabledEntries.length > 0) {
          systemPrompt = enabledEntries
            .map(e => e.content.trim())
            .filter(Boolean)
            .join('\n\n');
        }
      }

      // Format history messages with sender and timestamp info
      const formattedHistory = history.map(h => formatHistoryMessage(
        h.role,
        h.content,
        h.sender,
        h.timestamp
      ));

      // Build messages array
      const messages = [
        { role: 'system', content: systemPrompt },
        ...formattedHistory,
        { role: 'user', content: message }
      ];

      console.log('========== LLM Request ==========');
      console.log('System Prompt:', systemPrompt.substring(0, 200) + (systemPrompt.length > 200 ? '...' : ''));
      console.log('Messages:', messages.map(m => ({ role: m.role, content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '') })));
      console.log('=================================');

      if (!apiUrl) {
        // Use default Gemini SDK - non-streaming for now
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

          const config: any = {
            systemInstruction: systemPrompt,
            temperature: preset?.temperature ?? 0.7,
          };

          if (preset?.openai_max_tokens) {
            config.maxOutputTokens = preset.openai_max_tokens;
          }

          if (preset?.top_p !== undefined) {
            config.topP = preset.top_p;
          }

          const newChat = ai.chats.create({
            model: model || 'gemini-3.1-pro-preview',
            config,
          });

          // Send history as context if provided (formatted history already contains the formatted content)
          for (const histMsg of formattedHistory) {
            if (histMsg.role === 'user') {
              await newChat.sendMessage({ message: histMsg.content });
            }
          }

          const response = await newChat.sendMessage({ message });
          const rawText = response.text;

          console.log('========== LLM Response ==========');
          console.log('Raw:', rawText);
          console.log('==================================');

          // Process the response
          const { messages: chatMessages, commands, hasPoke } = processStreamingContent(rawText);

          // Trigger poke if detected
          if (hasPoke) {
            onPoke?.();
          }

          // Execute system commands
          commands.forEach(cmd => {
            executeCommand(cmd);
            onCommand?.(cmd);
          });

          // Send each chat message with 3-second delay
          for (let i = 0; i < chatMessages.length; i++) {
            onChatMessage?.(chatMessages[i]);
            // Add 3-second delay between messages (but not after the last one)
            if (i < chatMessages.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }

          setIsTyping(false);

          return {
            messages: chatMessages,
            commands,
            rawResponse: rawText
          };
        } catch (error) {
          console.error("Failed to send with Gemini:", error);
          setIsTyping(false);
          throw error;
        }
      } else {
        // Use custom API (OpenAI compatible) with streaming
        let url = apiUrl.trim();
        if (!url.endsWith('/chat/completions')) {
          url = url.endsWith('/') ? `${url}chat/completions` : `${url}/chat/completions`;
        }

        const requestBody: any = {
          model: model,
          messages: messages,
          stream: true, // Enable streaming
        };

        // Apply preset settings
        if (preset) {
          requestBody.temperature = preset.temperature;
          requestBody.max_tokens = preset.openai_max_tokens;
          if (preset.top_p !== undefined) requestBody.top_p = preset.top_p;
          if (preset.top_k !== undefined) requestBody.top_k = preset.top_k;
          if (preset.presence_penalty !== undefined) requestBody.presence_penalty = preset.presence_penalty;
          if (preset.frequency_penalty !== undefined) requestBody.frequency_penalty = preset.frequency_penalty;
          if (preset.repetition_penalty !== undefined) requestBody.repetition_penalty = preset.repetition_penalty;
          if (preset.stop_sequences?.length) requestBody.stop = preset.stop_sequences;
        } else {
          requestBody.temperature = 0.7;
          requestBody.max_tokens = 512;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
          throw new Error(`API Error: ${res.status}`);
        }

        // Process streaming response
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        let fullResponse = '';
        const allCommands: SystemCommand[] = [];
        const allMessages: string[] = [];
        let hasPokeDetected = false;

        if (!reader) {
          throw new Error('No response body');
        }

        console.log('Starting streaming response...');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullResponse += delta;

                  // Check for poke tag in the accumulated response
                  if (!hasPokeDetected && hasPoke(fullResponse)) {
                    hasPokeDetected = true;
                  }

                  // Log each chunk for debugging
                  console.log('[LLM Chunk]:', delta);

                  // If we're inside a think block, only process content before it
                  if (hasIncompleteThinkBlock(fullResponse)) {
                    // Only get content before the think block starts
                    const safeContent = getContentBeforeThink(fullResponse);
                    buffer = safeContent;
                    continue;
                  }

                  // We have a complete response or no think block at all
                  // Remove all think blocks from the processed content
                  buffer = removeThinkBlocks(fullResponse);

                  // Check for complete chat blocks
                  const { messages: newMessages, remaining } = extractCompleteChatBlocks(buffer);

                  for (const msg of newMessages) {
                    // Avoid duplicates - just collect, don't send yet
                    if (!allMessages.includes(msg)) {
                      allMessages.push(msg);
                    }
                  }

                  buffer = remaining;

                  // Check for system commands (check in buffer which has think blocks removed)
                  const commands = extractSystemCommands(buffer);
                  for (const cmd of commands) {
                    const alreadyExecuted = allCommands.some(c =>
                      c.type === cmd.type && JSON.stringify(c) === JSON.stringify(cmd)
                    );
                    if (!alreadyExecuted) {
                      allCommands.push(cmd);
                      executeCommand(cmd);
                      onCommand?.(cmd);
                    }
                  }
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }

        // Process any remaining content
        // Use fullResponse to ensure we process everything, with think blocks removed
        const finalContent = removeThinkBlocks(fullResponse);
        if (finalContent.trim()) {
          const { messages: newMessages, processed } = processStreamingContent(finalContent);
          if (newMessages.length > 0) {
            for (const msg of newMessages) {
              if (!allMessages.includes(msg)) {
                allMessages.push(msg);
              }
            }
          } else if (processed.trim() && allMessages.length === 0) {
            // If no chat tags found, treat remaining as a message
            allMessages.push(processed.trim());
          }
        }

        console.log('Streaming complete. Messages:', allMessages.length);
        console.log('========== LLM Full Response ==========');
        console.log(fullResponse);
        console.log('=======================================');

        // Trigger poke if detected
        if (hasPokeDetected) {
          onPoke?.();
        }

        // Send all collected messages with 3-second delay between each
        for (let i = 0; i < allMessages.length; i++) {
          onChatMessage?.(allMessages[i]);
          // Add 3-second delay between messages (but not after the last one)
          if (i < allMessages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        // Update message history for next call
        messageHistory.current = [...messages, { role: 'assistant', content: fullResponse }];

        setIsTyping(false);

        return {
          messages: allMessages,
          commands: allCommands,
          rawResponse: fullResponse
        };
      }
    } catch (error) {
      console.error("Failed to send message", error);
      setIsTyping(false);
      throw error;
    }
  }, [chat, apiUrl, apiKey, model]);

  const generateOpeningMessage = useCallback(async (
    playerInfo: { gender: string; nickname: string; identity: string },
    options?: SendMessageOptions
  ): Promise<LLMResult | null> => {
    setIsTyping(true);

    try {
      const preset = options?.preset;
      const onChatMessage = options?.onChatMessage;
      const onPoke = options?.onPoke;

      // Build system prompt from preset entries or use provided/default
      let systemPrompt = options?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
      if (preset?.prompt_entries && preset.prompt_entries.length > 0) {
        const enabledEntries = preset.prompt_entries
          .filter(e => e.enabled)
          .sort((a, b) => a.position - b.position);
        if (enabledEntries.length > 0) {
          systemPrompt = enabledEntries
            .map(e => e.content.trim())
            .filter(Boolean)
            .join('\n\n');
        }
      }

      // Build the opening prompt
      const openingPrompt = `和你进行匹配的人，性别为${playerInfo.gender}，昵称为${playerInfo.nickname}，身份是${playerInfo.identity}，你可以根据这些信息来和对方发起你的第一句话喔~`;

      // Build messages array - no history for opening
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: openingPrompt }
      ];

      console.log('========== Opening Message Request ==========');
      console.log('System Prompt:', systemPrompt.substring(0, 200) + (systemPrompt.length > 200 ? '...' : ''));
      console.log('Opening Prompt:', openingPrompt);
      console.log('=============================================');

      if (!apiUrl) {
        // Use default Gemini SDK
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

          const config: any = {
            systemInstruction: systemPrompt,
            temperature: preset?.temperature ?? 0.7,
          };

          if (preset?.openai_max_tokens) {
            config.maxOutputTokens = preset.openai_max_tokens;
          }

          if (preset?.top_p !== undefined) {
            config.topP = preset.top_p;
          }

          const newChat = ai.chats.create({
            model: model || 'gemini-2.0-flash-exp',
            config,
          });

          const response = await newChat.sendMessage({ message: openingPrompt });
          const rawText = response.text;

          console.log('========== Opening Message Response ==========');
          console.log('Raw:', rawText);
          console.log('==============================================');

          // Process the response
          const { messages: chatMessages, commands, hasPoke } = processStreamingContent(rawText);

          // Trigger poke if detected
          if (hasPoke) {
            onPoke?.();
          }

          // Execute system commands
          commands.forEach(cmd => {
            executeCommand(cmd);
          });

          // Send each chat message with 3-second delay
          for (let i = 0; i < chatMessages.length; i++) {
            onChatMessage?.(chatMessages[i]);
            // Add 3-second delay between messages (but not after the last one)
            if (i < chatMessages.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }

          setIsTyping(false);

          return {
            messages: chatMessages,
            commands,
            rawResponse: rawText
          };
        } catch (error) {
          console.error("Failed to generate opening with Gemini:", error);
          setIsTyping(false);
          throw error;
        }
      } else {
        // Use custom API (OpenAI compatible) with streaming
        let url = apiUrl.trim();
        if (!url.endsWith('/chat/completions')) {
          url = url.endsWith('/') ? `${url}chat/completions` : `${url}/chat/completions`;
        }

        const requestBody: any = {
          model: model,
          messages: messages,
          stream: true,
        };

        // Apply preset settings
        if (preset) {
          requestBody.temperature = preset.temperature;
          requestBody.max_tokens = preset.openai_max_tokens;
          if (preset.top_p !== undefined) requestBody.top_p = preset.top_p;
          if (preset.top_k !== undefined) requestBody.top_k = preset.top_k;
          if (preset.presence_penalty !== undefined) requestBody.presence_penalty = preset.presence_penalty;
          if (preset.frequency_penalty !== undefined) requestBody.frequency_penalty = preset.frequency_penalty;
          if (preset.repetition_penalty !== undefined) requestBody.repetition_penalty = preset.repetition_penalty;
          if (preset.stop_sequences?.length) requestBody.stop = preset.stop_sequences;
        } else {
          requestBody.temperature = 0.7;
          requestBody.max_tokens = 512;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
          throw new Error(`API Error: ${res.status}`);
        }

        // Process streaming response
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        let fullResponse = '';
        const allCommands: SystemCommand[] = [];
        const allMessages: string[] = [];
        let hasPokeDetected = false;

        if (!reader) {
          throw new Error('No response body');
        }

        console.log('Starting opening message streaming...');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullResponse += delta;

                  // Check for poke tag
                  if (!hasPokeDetected && hasPoke(fullResponse)) {
                    hasPokeDetected = true;
                  }

                  // If we're inside a think block, only process content before it
                  if (hasIncompleteThinkBlock(fullResponse)) {
                    const safeContent = getContentBeforeThink(fullResponse);
                    buffer = safeContent;
                    continue;
                  }

                  buffer = removeThinkBlocks(fullResponse);

                  // Check for complete chat blocks
                  const { messages: newMessages, remaining } = extractCompleteChatBlocks(buffer);

                  for (const msg of newMessages) {
                    // Just collect, don't send yet
                    if (!allMessages.includes(msg)) {
                      allMessages.push(msg);
                    }
                  }

                  buffer = remaining;

                  // Check for system commands - execute immediately
                  const commands = extractSystemCommands(buffer);
                  for (const cmd of commands) {
                    const alreadyExecuted = allCommands.some(c =>
                      c.type === cmd.type && JSON.stringify(c) === JSON.stringify(cmd)
                    );
                    if (!alreadyExecuted) {
                      allCommands.push(cmd);
                      executeCommand(cmd);
                    }
                  }
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }

        // Process any remaining content
        const finalContent = removeThinkBlocks(fullResponse);
        if (finalContent.trim()) {
          const { messages: newMessages, processed } = processStreamingContent(finalContent);
          if (newMessages.length > 0) {
            for (const msg of newMessages) {
              if (!allMessages.includes(msg)) {
                allMessages.push(msg);
              }
            }
          } else if (processed.trim() && allMessages.length === 0) {
            allMessages.push(processed.trim());
          }
        }

        console.log('Opening message streaming complete. Messages:', allMessages.length);
        console.log('========== LLM Full Response ==========');
        console.log(fullResponse);
        console.log('=======================================');

        // Trigger poke if detected
        if (hasPokeDetected) {
          onPoke?.();
        }

        // Send all collected messages with 3-second delay between each
        for (let i = 0; i < allMessages.length; i++) {
          onChatMessage?.(allMessages[i]);
          // Add 3-second delay between messages (but not after the last one)
          if (i < allMessages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        setIsTyping(false);

        return {
          messages: allMessages,
          commands: allCommands,
          rawResponse: fullResponse
        };
      }
    } catch (error) {
      console.error("Failed to generate opening message", error);
      setIsTyping(false);
      throw error;
    }
  }, [apiUrl, apiKey, model]);

  return { initChat, sendMessage, generateOpeningMessage, isTyping };
}
