import { GoogleGenAI } from '@google/genai';
import type { PlayerSetup } from '../components/SetupWizard';
import { buildSystemPrompt } from '../utils/systemPrompt';

interface GapMessage {
  time: string;   // "YYYY-MM-DD HH:mm"
  content: string;
}

interface LLMSettings {
  apiUrl: string;
  apiKey: string;
  model: string;
}

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
}

type AddMessageFn = (
  role: 'assistant',
  content: string,
  metadata: { name: string; timestamp: string },
  createdAt: number
) => Promise<unknown>;

function formatTimestamp(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDiff(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} 天 ${h} 小时`;
  if (h > 0) return `${h} 小时 ${m} 分钟`;
  return `${m} 分钟`;
}

/** Parse "YYYY-MM-DD HH:mm" → Unix timestamp (seconds). Returns null if invalid. */
function parseTime(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, 0);
  if (isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

/** Extract the JSON array from inside <留言>...</留言> tags. */
function parseGapResponse(raw: string): GapMessage[] {
  const match = raw.match(/<留言>([\s\S]*?)<\/留言>/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[1].trim());
    if (!Array.isArray(arr)) return [];
    return arr.filter((item: any) => typeof item.time === 'string' && typeof item.content === 'string');
  } catch {
    return [];
  }
}

/**
 * Run gap analysis: ask the LLM whether 夏目 would have sent additional messages
 * during the period between the last conversation activity and now.
 *
 * @param lastUserMsg  - the most recent user message
 * @param recentHistory - last ~10 messages for context (sorted by created_at ASC)
 * @param lastMsgTimeSec - created_at of the very last message (user OR assistant)
 * @param currentTimeSec - current Unix timestamp
 */
export async function runGapAnalysis(
  sessionId: string,
  lastUserMsg: { content: string; created_at: number },
  recentHistory: HistoryMessage[],
  lastMsgTimeSec: number,
  currentTimeSec: number,
  settings: LLMSettings,
  playerSetup: PlayerSetup | null,
  addMessageFn: AddMessageFn
): Promise<void> {
  const lastUserTime = formatTimestamp(lastUserMsg.created_at);
  const lastActivityTime = formatTimestamp(lastMsgTimeSec);
  const currentTime = formatTimestamp(currentTimeSec);
  const diffSec = currentTimeSec - lastMsgTimeSec;
  const diffStr = formatDiff(diffSec);

  const systemPrompt = playerSetup ? buildSystemPrompt(playerSetup) : '';

  // Build recent history snippet for context
  const historySnippet = recentHistory
    .map(m => {
      const who = m.role === 'user' ? '玩家' : '夏目';
      return `[${formatTimestamp(m.created_at)}] ${who}：${m.content}`;
    })
    .join('\n');

  const prompt = `[系统] 以下是夏目的行动思考环节，不会出现在聊天记录里。

近期聊天记录：
${historySnippet}

玩家上次发消息时间：${lastUserTime}
玩家上次发的内容：「${lastUserMsg.content}」
对话最后活跃时间：${lastActivityTime}
当前时间：${currentTime}
距离上次活跃已经过去：${diffStr}

请以女主角的身份思考：
1. 玩家上一次给你发信息是什么时候？
2. 你当前对玩家的好感是多少，基于这点，你目前对他的态度应该是怎样的？
3. 你的最近留言内容的态度变化是否合理？是否有高度重复/近似的内容？如果有，请换成不一样的表达方法。
4. 在"${lastActivityTime}"到"${currentTime}"这段时间里，你是否还想再给玩家发消息？（如果你在上面聊天记录里已经发了最新的消息，请判断你是否还有额外的话要说。）

请用以下格式回复（若不需要留言则返回空数组）：

<留言>
[
  {"time": "YYYY-MM-DD HH:mm", "content": "消息内容"},
  ...
]
</留言>

规则：
- 消息数量 0-3 条，不要太多
- 时间必须在"${lastActivityTime}"之后、"${currentTime}"之前
- 保持夏目的性格：表面傲娇，内心孤独，不显得太刻意主动
- 间隔时间越长越可能想起玩家并留言；间隔较短可以不留言
- 消息要简短口语化，用 <聊天>...</聊天> 格式包裹内容`;

  let rawResponse = '';

  try {
    const { apiUrl, apiKey, model } = settings;

    if (!apiUrl) {
      // Gemini SDK path — use process.env same as useLLM.ts
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const chat = ai.chats.create({
        model: model || 'gemini-3.1-pro-preview',
        config: { systemInstruction: systemPrompt, temperature: 0.8 },
      });
      const response = await chat.sendMessage({ message: prompt });
      rawResponse = response.text ?? '';
    } else {
      // OpenAI-compatible path
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
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          stream: false,
          temperature: 0.8,
          max_tokens: 512,
        }),
      });
      if (!res.ok) {
        console.error('[gapAnalysis] API error:', res.status, await res.text());
        return;
      }
      const data = await res.json();
      rawResponse = data.choices?.[0]?.message?.content ?? '';
    }
  } catch (e) {
    console.error('[gapAnalysis] LLM call failed:', e);
    return;
  }

  console.log('[gapAnalysis] Raw response:', rawResponse);

  if (!rawResponse) return;

  const gapMessages = parseGapResponse(rawResponse);
  console.log('[gapAnalysis] Parsed messages:', gapMessages);
  if (gapMessages.length === 0) return;

  // Extract content from <聊天> tags if present, otherwise use raw content
  const extractContent = (raw: string): string => {
    const m = raw.match(/<聊天>([\s\S]*?)<\/聊天>/);
    return m ? m[1].trim() : raw.trim();
  };

  for (const gapMsg of gapMessages) {
    const ts = parseTime(gapMsg.time);
    if (!ts) continue;
    // Clamp to the valid window: after last activity, before now
    if (ts <= lastMsgTimeSec || ts >= currentTimeSec) continue;

    const content = extractContent(gapMsg.content);
    if (!content) continue;

    try {
      await addMessageFn(
        'assistant',
        content,
        { name: '夏目', timestamp: gapMsg.time },
        ts
      );
      console.log('[gapAnalysis] Inserted gap message at', gapMsg.time, ':', content);
    } catch (e) {
      console.error('[gapAnalysis] Failed to insert gap message:', e);
    }
  }
}

/**
 * Run AFK (idle) analysis: when the player is idle on the page for a long time,
 * ask the LLM what caring messages Natsume would send.
 *
 * This is different from gap analysis - the player is "online" but not responding.
 */
export async function runAfkAnalysis(
  sessionId: string,
  lastUserMsg: { content: string; created_at: number },
  recentHistory: HistoryMessage[],
  idleStartTimeSec: number,
  currentTimeSec: number,
  settings: LLMSettings,
  playerSetup: PlayerSetup | null,
  addMessageFn: AddMessageFn
): Promise<void> {
  const lastUserTime = formatTimestamp(lastUserMsg.created_at);
  const idleStartTime = formatTimestamp(idleStartTimeSec);
  const currentTime = formatTimestamp(currentTimeSec);
  const idleSec = currentTimeSec - idleStartTimeSec;
  const idleStr = formatDiff(idleSec);

  const systemPrompt = playerSetup ? buildSystemPrompt(playerSetup) : '';

  const historySnippet = recentHistory
    .map(m => {
      const who = m.role === 'user' ? '玩家' : '夏目';
      return `[${formatTimestamp(m.created_at)}] ${who}：${m.content}`;
    })
    .join('\n');

  const prompt = `[系统] 以下是夏目的行动思考环节，不会出现在聊天记录里。

近期聊天记录：
${historySnippet}

玩家上次发消息时间：${lastUserTime}
玩家上次发的内容：「${lastUserMsg.content}」
玩家停止回应的时间：${idleStartTime}
当前时间：${currentTime}
玩家已经${idleStr}没有回应了（但页面一直保持着在线状态）

请以女主角的身份思考：
1. 玩家上一次给你发信息是什么时候？
2. 你当前对玩家的好感是多少，基于这点，你目前对他的态度应该是怎样的？
3. 你的最近留言内容的态度变化是否合理？是否有高度重复/近似的内容？如果有，请换成不一样的表达方法。
4. 玩家明明在线，却突然不再回复你。${idleStr}过去了，你现在是什么心情？你是否想给玩家发消息问问ta去哪里了？

请用以下格式回复（若不需要留言则返回空数组）：

<留言>
[
  {"time": "YYYY-MM-DD HH:mm", "content": "消息内容"},
  ...
]
</留言>

规则：
- 消息数量 0-3 条，不要太多
- 时间必须在"${idleStartTime}"之后、"${currentTime}"之前
- 保持夏目的性格：表面傲娇，内心孤独，担心但又不想表现得太明显
- ${idleStr}的等待会让夏目从疑惑→担心→有点委屈/生气
- 消息要简短口语化，用 <聊天>...</聊天> 格式包裹内容
- 可以问"你去哪了"、"还在吗"、"怎么不说话了"之类的关心的话`;

  let rawResponse = '';

  try {
    const { apiUrl, apiKey, model } = settings;

    if (!apiUrl) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const chat = ai.chats.create({
        model: model || 'gemini-3.1-pro-preview',
        config: { systemInstruction: systemPrompt, temperature: 0.8 },
      });
      const response = await chat.sendMessage({ message: prompt });
      rawResponse = response.text ?? '';
    } else {
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
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          stream: false,
          temperature: 0.8,
          max_tokens: 512,
        }),
      });
      if (!res.ok) {
        console.error('[afkAnalysis] API error:', res.status, await res.text());
        return;
      }
      const data = await res.json();
      rawResponse = data.choices?.[0]?.message?.content ?? '';
    }
  } catch (e) {
    console.error('[afkAnalysis] LLM call failed:', e);
    return;
  }

  console.log('[afkAnalysis] Raw response:', rawResponse);

  if (!rawResponse) return;

  const afkMessages = parseGapResponse(rawResponse);
  console.log('[afkAnalysis] Parsed messages:', afkMessages);
  if (afkMessages.length === 0) return;

  const extractContent = (raw: string): string => {
    const m = raw.match(/<聊天>([\s\S]*?)<\/聊天>/);
    return m ? m[1].trim() : raw.trim();
  };

  for (const afkMsg of afkMessages) {
    const ts = parseTime(afkMsg.time);
    if (!ts) continue;
    if (ts <= idleStartTimeSec || ts >= currentTimeSec) continue;

    const content = extractContent(afkMsg.content);
    if (!content) continue;

    try {
      await addMessageFn(
        'assistant',
        content,
        { name: '夏目', timestamp: afkMsg.time },
        ts
      );
      console.log('[afkAnalysis] Inserted AFK message at', afkMsg.time, ':', content);
    } catch (e) {
      console.error('[afkAnalysis] Failed to insert AFK message:', e);
    }
  }
}
