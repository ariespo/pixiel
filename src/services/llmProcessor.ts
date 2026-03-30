// LLM Response Processor
// Handles parsing of think tags, chat tags, and system commands

export interface ParsedResponse {
  // Normal chat messages to display
  chatMessages: string[];
  // System commands to execute
  commands: SystemCommand[];
  // Raw response (for debugging)
  rawResponse: string;
  // Processed response (after removing think blocks)
  processedResponse: string;
}

export type SystemCommand =
  | { type: 'SET_VAL'; key: string; value: string }
  | { type: 'ADD_MOMENT'; owner: string; content: string }
  | { type: 'ADD_COMMENT'; mid: number; cid: number; text: string; reason: string }
  | { type: 'REPLY_COMMENT'; mid: number; cid: number; text: string }
  | { type: 'UPDATE_SIGN'; content: string }
  | { type: 'UPDATE_NICKNAME'; name: string }
  | { type: 'DELETE_MOMENT'; mid: number; reason: string }
  | { type: 'UNKNOWN'; raw: string };

// Variable storage for the game state
class VariableStore {
  private vars: Map<string, string> = new Map();
  private listeners: Set<(key: string, value: string) => void> = new Set();

  set(key: string, value: string) {
    this.vars.set(key, value);
    this.listeners.forEach(cb => cb(key, value));
  }

  get(key: string): string | undefined {
    return this.vars.get(key);
  }

  delete(key: string) {
    this.vars.delete(key);
  }

  has(key: string): boolean {
    return this.vars.has(key);
  }

  subscribe(callback: (key: string, value: string) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  clear() {
    this.vars.clear();
  }
}

export const variableStore = new VariableStore();

/**
 * Extract <动作>标签内容
 */
export function extractActions(text: string): string[] {
  const actions: string[] = [];
  const actionRegex = /<动作>([\s\S]*?)<\/动作>/g;
  let match;
  while ((match = actionRegex.exec(text)) !== null) {
    actions.push(match[1].trim());
  }
  return actions;
}

/**
 * Remove <动作> tags from text
 */
export function removeActionTags(text: string): string {
  return text.replace(/<动作>[\s\S]*?<\/动作>/g, '').trim();
}

/**
 * Extract <音乐> tags from text
 * Returns array of music keywords
 */
export function extractMusicTags(text: string): string[] {
  const musics: string[] = [];
  const musicRegex = /<音乐>([\s\S]*?)<\/音乐>/g;
  let match;
  while ((match = musicRegex.exec(text)) !== null) {
    musics.push(match[1].trim());
  }
  return musics;
}

/**
 * Remove <音乐> tags from text
 */
export function removeMusicTags(text: string): string {
  return text.replace(/<音乐>[\s\S]*?<\/音乐>/g, '').trim();
}

/**
 * Check if text contains <戳一戳> tag (simplified poke action)
 */
export function hasPoke(text: string): boolean {
  return text.includes('<戳一戳>');
}

/**
 * Remove <戳一戳> tag from text
 */
export function removePokeTag(text: string): string {
  return text.replace(/<戳一戳>/g, '').trim();
}
/**
 * Extract complete <聊天>...</聊天> blocks from buffer
 * Also extracts lines with [Name (AI)]: prefix as chat messages
 * Returns extracted messages and remaining buffer content
 */
export function extractCompleteChatBlocks(buffer: string, isFinal = false): {
  messages: string[];
  remaining: string;
} {
  const messages: string[] = [];
  let remaining = buffer;

  // Match complete <聊天>...</聊天> blocks
  const chatRegex = /<聊天>([\s\S]*?)<\/聊天>/g;
  let match;

  while ((match = chatRegex.exec(buffer)) !== null) {
    const content = match[1].trim();
    if (content) {
      messages.push(content);
    }
    // Remove this complete block from remaining
    remaining = remaining.replace(match[0], '');
  }

  // Match lines with [Name (AI)]: prefix and treat as chat messages
  // In streaming mode: only extract lines ending with \n (complete lines)
  // In final mode: also extract lines without \n (final content)
  if (isFinal) {
    // Final mode: extract all [Name (AI)]: lines (with or without newline)
    const rolePrefixRegexFinal = /^\[.+?\s*\(AI\)\]:\s*(.+?)$/gm;
    while ((match = rolePrefixRegexFinal.exec(remaining)) !== null) {
      const content = match[1].trim();
      if (content) {
        messages.push(content);
      }
      // Remove this line from remaining
      remaining = remaining.replace(match[0], '');
    }
  } else {
    // Streaming mode: only extract complete lines (ending with \n)
    const rolePrefixRegex = /^\[.+?\s*\(AI\)\]:\s*(.+?)\n/gm;
    while ((match = rolePrefixRegex.exec(remaining)) !== null) {
      const content = match[1].trim();
      if (content) {
        messages.push(content);
      }
      // Remove this line from remaining
      remaining = remaining.replace(match[0], '');
    }
  }

  return { messages, remaining };
}

/**
 * Extract system commands from text
 */
export function extractSystemCommands(text: string): SystemCommand[] {
  const commands: SystemCommand[] = [];

  // Parse SET_VAL
  const setValRegex = /SET_VAL\s*\(\s*(\w+)\s*[:,]\s*["']?([^"')\]]+)["']?\s*\)/gi;
  let match;
  while ((match = setValRegex.exec(text)) !== null) {
    commands.push({
      type: 'SET_VAL',
      key: match[1].trim(),
      value: match[2].trim()
    });
  }

  // Parse ADD_MOMENT
  const addMomentRegex = /ADD_MOMENT\s*\(\s*owner\s*:\s*["']([^"']+)["']\s*,\s*content\s*:\s*["']([^"']+)["']\s*\)/gi;
  while ((match = addMomentRegex.exec(text)) !== null) {
    commands.push({
      type: 'ADD_MOMENT',
      owner: match[1].trim(),
      content: match[2].trim()
    });
  }

  // Parse ADD_COMMENT (flexible format - supports both old and LLM-generated formats)
  // Format 1: ADD_COMMENT(mid: 1, cid: 1, text: "...", reason: "...")
  // Format 2: ADD_COMMENT(mid: 1, sender: "夏目", text: "...")
  const addCommentRegex = /ADD_COMMENT\s*\(\s*mid\s*:\s*(\d+)\s*,\s*(?:(?:cid\s*:\s*(\d+)\s*,\s*text\s*:\s*["']([^"']+)["']\s*,\s*reason\s*:\s*["']([^"']+)["'])|(?:sender\s*:\s*["'][^"']+["']\s*,\s*text\s*:\s*["']([^"']+)["']))\s*\)/gi;
  while ((match = addCommentRegex.exec(text)) !== null) {
    if (match[2]) {
      // Format 1: with cid and reason
      commands.push({
        type: 'ADD_COMMENT',
        mid: parseInt(match[1]),
        cid: parseInt(match[2]),
        text: match[3].trim(),
        reason: match[4].trim()
      });
    } else {
      // Format 2: with sender (simplified)
      commands.push({
        type: 'ADD_COMMENT',
        mid: parseInt(match[1]),
        cid: 0,
        text: match[5].trim(),
        reason: 'LLM reply to moment'
      });
    }
  }

  // Parse REPLY_COMMENT (for replying to player's comment)
  const replyCommentRegex = /REPLY_COMMENT\s*\(\s*mid\s*:\s*(\d+)\s*,\s*cid\s*:\s*(\d+)\s*,\s*text\s*:\s*["']([^"']+)["']\s*\)/gi;
  while ((match = replyCommentRegex.exec(text)) !== null) {
    commands.push({
      type: 'REPLY_COMMENT',
      mid: parseInt(match[1]),
      cid: parseInt(match[2]),
      text: match[3].trim()
    });
  }

  // Parse UPDATE_SIGN
  const updateSignRegex = /UPDATE_SIGN\s*\(\s*content\s*:\s*["']([^"']+)["']\s*\)/gi;
  while ((match = updateSignRegex.exec(text)) !== null) {
    commands.push({
      type: 'UPDATE_SIGN',
      content: match[1].trim()
    });
  }

  // Parse UPDATE_NICKNAME
  const updateNicknameRegex = /UPDATE_NICKNAME\s*\(\s*name\s*:\s*["']([^"']+)["']\s*\)/gi;
  while ((match = updateNicknameRegex.exec(text)) !== null) {
    commands.push({
      type: 'UPDATE_NICKNAME',
      name: match[1].trim()
    });
  }

  // Parse DELETE_MOMENT
  const deleteMomentRegex = /DELETE_MOMENT\s*\(\s*mid\s*:\s*(\d+)\s*,\s*reason\s*:\s*["']([^"']+)["']\s*\)/gi;
  while ((match = deleteMomentRegex.exec(text)) !== null) {
    commands.push({
      type: 'DELETE_MOMENT',
      mid: parseInt(match[1]),
      reason: match[2].trim()
    });
  }

  return commands;
}

/**
 * Remove all content from first <think> or <thinking> to last </think> or </thinking>
 * This ensures everything between (including nested tags) is removed
 */
export function removeThinkBlocks(text: string): string {
  let result = text;

  // Find the first occurrence of opening tag
  const firstThink = result.indexOf('<think>');
  const firstThinking = result.indexOf('<thinking>');

  let startIndex = -1;
  if (firstThink !== -1 && firstThinking !== -1) {
    startIndex = Math.min(firstThink, firstThinking);
  } else if (firstThink !== -1) {
    startIndex = firstThink;
  } else if (firstThinking !== -1) {
    startIndex = firstThinking;
  }

  if (startIndex === -1) {
    // No opening tag found, return as-is
    return result;
  }

  // Find the last occurrence of closing tag
  const lastThinkClose = result.lastIndexOf('</think>');
  const lastThinkingClose = result.lastIndexOf('</thinking>');

  let endIndex = -1;
  if (lastThinkClose !== -1 && lastThinkingClose !== -1) {
    endIndex = Math.max(lastThinkClose, lastThinkingClose);
  } else if (lastThinkClose !== -1) {
    endIndex = lastThinkClose;
  } else if (lastThinkingClose !== -1) {
    endIndex = lastThinkingClose;
  }

  if (endIndex === -1) {
    // No closing tag found - this is incomplete content
    // Remove from startIndex to end of string (it's all think content)
    return result.substring(0, startIndex);
  }

  // Remove from startIndex to endIndex + length of closing tag
  const closeTagLength = endIndex === lastThinkClose ? '</think>'.length : '</thinking>'.length;
  result = result.substring(0, startIndex) + result.substring(endIndex + closeTagLength);

  return result;
}

/**
 * Check if text contains incomplete think block (has opening but no closing)
 */
export function hasIncompleteThinkBlock(text: string): boolean {
  const firstThink = text.indexOf('<think>');
  const firstThinking = text.indexOf('<thinking>');

  let startIndex = -1;
  if (firstThink !== -1 && firstThinking !== -1) {
    startIndex = Math.min(firstThink, firstThinking);
  } else if (firstThink !== -1) {
    startIndex = firstThink;
  } else if (firstThinking !== -1) {
    startIndex = firstThinking;
  }

  if (startIndex === -1) return false;

  // Check if there's a closing tag after the opening tag
  const afterOpen = text.substring(startIndex);
  const hasClose = afterOpen.includes('</think>') || afterOpen.includes('</thinking>');

  return !hasClose;
}

/**
 * Get content before any think block starts
 */
export function getContentBeforeThink(text: string): string {
  const firstThink = text.indexOf('<think>');
  const firstThinking = text.indexOf('<thinking>');

  let startIndex = -1;
  if (firstThink !== -1 && firstThinking !== -1) {
    startIndex = Math.min(firstThink, firstThinking);
  } else if (firstThink !== -1) {
    startIndex = firstThink;
  } else if (firstThinking !== -1) {
    startIndex = firstThinking;
  }

  if (startIndex === -1) return text;
  return text.substring(0, startIndex);
}

/**
 * Remove role prefix like [夏目 (AI)]: or [小明 (用户)]:
 * LLM may echo the formatted prefix from history examples
 */
function cleanRolePrefix(content: string): string {
  // Match patterns like: [夏目 (AI)]: [2026-03-25 10:30] 夏目 (AI):  etc.
  let cleaned = content.replace(/^\[.+?\)\]:\s*/g, '');
  cleaned = cleaned.replace(/^\[.+?\]\s*/g, '');
  return cleaned.trim();
}

/**
 * Process streaming content - remove think blocks and extract chat messages
 */
export function processStreamingContent(text: string): {
  messages: string[];
  commands: SystemCommand[];
  processed: string;
  hasPoke: boolean;
} {
  // Step 0: Check for poke tag in original text (before any processing)
  const hasPokeTag = hasPoke(text);

  // Step 1: Remove think blocks (from first opening to last closing)
  let processed = removeThinkBlocks(text);

  // Step 2: Extract chat messages (final mode - extract all complete content)
  const { messages: rawMessages, remaining } = extractCompleteChatBlocks(processed, true);

  // Step 2.5: Clean role prefixes from extracted messages
  const messages = rawMessages.map(msg => cleanRolePrefix(msg));

  // Step 3: Extract system commands from remaining text
  const commands = extractSystemCommands(remaining);

  // Step 4: Remove system command blocks and action tags
  let cleaned = remaining.replace(/<系统指令>[\s\S]*?<\/系统指令>/gi, '');

  // Step 5: Remove action tags (they're handled separately)
  cleaned = removeActionTags(cleaned);

  // Step 6: Remove music tags (they're handled separately)
  cleaned = removeMusicTags(cleaned);

  // Step 7: Clean up whitespace
  cleaned = cleaned.trim();

  // Step 8: Remove role prefixes from processed content (for non-chat-tag messages)
  cleaned = cleanRolePrefix(cleaned);

  return { messages, commands, processed: cleaned, hasPoke: hasPokeTag };
}

/**
 * Execute a system command
 */
export function executeCommand(command: SystemCommand): void {
  switch (command.type) {
    case 'SET_VAL':
      variableStore.set(command.key, command.value);
      console.log(`[System] SET_VAL: ${command.key} = ${command.value}`);
      // Handle special keys
      if (command.key === 'heroine_sign') {
        window.dispatchEvent(new CustomEvent('update-sign', {
          detail: { content: command.value }
        }));
      }
      if (command.key === 'heroine_nickname') {
        window.dispatchEvent(new CustomEvent('update-nickname', {
          detail: { name: command.value }
        }));
      }
      if (command.key === 'player_sign') {
        window.dispatchEvent(new CustomEvent('update-player-sign', {
          detail: { content: command.value }
        }));
      }
      if (command.key === 'player_nickname') {
        window.dispatchEvent(new CustomEvent('update-player-nickname', {
          detail: { name: command.value }
        }));
      }
      break;

    case 'ADD_MOMENT':
      window.dispatchEvent(new CustomEvent('add-moment', {
        detail: { owner: command.owner, content: command.content }
      }));
      console.log(`[System] ADD_MOMENT: ${command.owner} - ${command.content}`);
      break;

    case 'ADD_COMMENT':
      window.dispatchEvent(new CustomEvent('add-comment', {
        detail: {
          mid: command.mid,
          cid: command.cid,
          text: command.text,
          reason: command.reason
        }
      }));
      console.log(`[System] ADD_COMMENT: moment ${command.mid}, comment ${command.cid}`);
      break;

    case 'REPLY_COMMENT':
      window.dispatchEvent(new CustomEvent('reply-comment', {
        detail: {
          mid: command.mid,
          cid: command.cid,
          text: command.text
        }
      }));
      console.log(`[System] REPLY_COMMENT: moment ${command.mid}, comment ${command.cid}`);
      break;

    case 'UPDATE_SIGN':
      variableStore.set('heroine_sign', command.content);
      window.dispatchEvent(new CustomEvent('update-sign', {
        detail: { content: command.content }
      }));
      console.log(`[System] UPDATE_SIGN: ${command.content}`);
      break;

    case 'UPDATE_NICKNAME':
      variableStore.set('heroine_nickname', command.name);
      window.dispatchEvent(new CustomEvent('update-nickname', {
        detail: { name: command.name }
      }));
      console.log(`[System] UPDATE_NICKNAME: ${command.name}`);
      break;

    case 'DELETE_MOMENT':
      window.dispatchEvent(new CustomEvent('delete-moment', {
        detail: { mid: command.mid, reason: command.reason }
      }));
      console.log(`[System] DELETE_MOMENT: ${command.mid}, reason: ${command.reason}`);
      break;

    case 'UNKNOWN':
      console.warn(`[System] Unknown command: ${command.raw}`);
      break;
  }
}

/**
 * Legacy: Process raw LLM response (non-streaming)
 */
export function processLLMResponse(rawResponse: string): ParsedResponse {
  const { messages, commands, processed } = processStreamingContent(rawResponse);

  return {
    chatMessages: messages,
    commands,
    rawResponse,
    processedResponse: processed
  };
}

/**
 * Check if response has valid chat content
 */
export function extractChatMessages(rawResponse: string): string[] {
  const { messages } = processStreamingContent(rawResponse);

  if (messages.length > 0) {
    return messages;
  }

  // If no <聊天> tags found, return the processed response as a single message
  const { processed } = processStreamingContent(rawResponse);
  if (processed) {
    return [processed];
  }

  return [];
}
