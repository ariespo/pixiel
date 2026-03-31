import db from '../database';
import { v4 as uuidv4 } from 'uuid';

// SillyTavern-style Prompt Entry
export interface PromptEntry {
  id: string;
  preset_id: string;
  name: string;
  content: string;
  enabled: boolean;
  position: number;

  // SillyTavern specific
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

// SillyTavern Chat Completion Preset format
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

// Default preset values
export const DEFAULT_PRESET: Omit<ChatCompletionPreset, 'id' | 'created_at' | 'updated_at' | 'prompt_entries'> = {
  name: 'Default',
  temperature: 0.7,
  top_p: 1.0,
  top_k: 0,
  top_a: 0,
  min_p: 0,
  presence_penalty: 0,
  frequency_penalty: 0,
  repetition_penalty: 1,
  openai_max_context: 8192,
  openai_max_tokens: 512,
  max_context_unlocked: false,
  max_history: 50,
  wrap_in_quotes: false,
  names_behavior: 0,
  send_if_empty: '',
  bias_preset_selected: 'Default (none)',
  stream_openai: false
};

export class PresetModel {
  // Parse SillyTavern Chat Completion preset format from imported JSON
  static parseSillyTavernPreset(data: any): Partial<ChatCompletionPreset> {
    // Handle both direct format and nested format
    const preset = data.preset || data;

    // Parse prompt entries from prompts array
    const promptEntries: Omit<PromptEntry, 'preset_id' | 'created_at' | 'updated_at'>[] = [];

    if (preset.prompts && Array.isArray(preset.prompts)) {
      preset.prompts.forEach((p: any, index: number) => {
        // Skip entries with marker=true (they're placeholders for system components)
        // But still include them for completeness
        promptEntries.push({
          id: p.identifier || uuidv4(),
          name: p.name || `条目 ${index + 1}`,
          content: p.content || p.text || '',
          enabled: p.enabled !== false && p.system_prompt !== false,
          position: p.injection_order ?? index,
          role: p.role || 'system',
          system_prompt: p.system_prompt !== false,
          identifier: p.identifier,
          marker: p.marker === true,
          injection_position: p.injection_position ?? 0,
          injection_depth: p.injection_depth ?? 4,
          injection_order: p.injection_order ?? 100,
          injection_trigger: Array.isArray(p.injection_trigger) ? p.injection_trigger : undefined,
          forbid_overrides: p.forbid_overrides === true
        });
      });
    }

    return {
      name: preset.name || data.name || 'Imported Preset',
      description: preset.description || data.description || '',

      // API parameters
      temperature: preset.temperature ?? data.temperature ?? DEFAULT_PRESET.temperature,
      top_p: preset.top_p ?? data.top_p ?? DEFAULT_PRESET.top_p,
      top_k: preset.top_k ?? data.top_k ?? DEFAULT_PRESET.top_k,
      top_a: preset.top_a ?? data.top_a ?? DEFAULT_PRESET.top_a,
      min_p: preset.min_p ?? data.min_p ?? DEFAULT_PRESET.min_p,
      presence_penalty: preset.presence_penalty ?? data.presence_penalty ?? DEFAULT_PRESET.presence_penalty,
      frequency_penalty: preset.frequency_penalty ?? data.frequency_penalty ?? DEFAULT_PRESET.frequency_penalty,
      repetition_penalty: preset.repetition_penalty ?? data.repetition_penalty ?? DEFAULT_PRESET.repetition_penalty,

      // Context settings
      openai_max_context: preset.openai_max_context ?? data.openai_max_context ?? DEFAULT_PRESET.openai_max_context,
      openai_max_tokens: preset.openai_max_tokens ?? data.openai_max_tokens ?? preset.max_tokens ?? data.max_tokens ?? DEFAULT_PRESET.openai_max_tokens,
      max_context_unlocked: preset.max_context_unlocked === true || preset.max_context_unlocked === 1,
      max_history: preset.max_history ?? data.max_history ?? DEFAULT_PRESET.max_history,
      stop_sequences: this.parseStopSequences(preset.stop_sequences || data.stop_sequences),

      // SillyTavern settings
      wrap_in_quotes: preset.wrap_in_quotes === true,
      names_behavior: preset.names_behavior ?? DEFAULT_PRESET.names_behavior,
      send_if_empty: preset.send_if_empty ?? DEFAULT_PRESET.send_if_empty,
      impersonation_prompt: preset.impersonation_prompt || undefined,
      new_chat_prompt: preset.new_chat_prompt || undefined,
      new_group_chat_prompt: preset.new_group_chat_prompt || undefined,
      new_example_chat_prompt: preset.new_example_chat_prompt || undefined,
      continue_nudge_prompt: preset.continue_nudge_prompt || undefined,
      bias_preset_selected: preset.bias_preset_selected ?? DEFAULT_PRESET.bias_preset_selected,
      stream_openai: preset.stream_openai === true || preset.stream_openai === 1,

      // Format settings
      wi_format: preset.wi_format || undefined,
      scenario_format: preset.scenario_format || undefined,
      personality_format: preset.personality_format || undefined,
      group_nudge_prompt: preset.group_nudge_prompt || undefined,

      // Prompt entries
      prompt_entries: promptEntries.map(e => ({
        ...e,
        preset_id: 'temp',
        created_at: 0,
        updated_at: 0
      })) as PromptEntry[],

      // Store original
      raw_data: JSON.stringify(data)
    };
  }

  private static parseStopSequences(data: any): string[] | undefined {
    if (!data) return undefined;
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') return [data];
    return undefined;
  }

  // Convert preset to SillyTavern export format
  static toSillyTavernFormat(preset: ChatCompletionPreset): any {
    const data: any = {
      name: preset.name,
      temperature: preset.temperature,
      top_p: preset.top_p,
      top_k: preset.top_k,
      top_a: preset.top_a,
      min_p: preset.min_p,
      presence_penalty: preset.presence_penalty,
      frequency_penalty: preset.frequency_penalty,
      repetition_penalty: preset.repetition_penalty,
      openai_max_context: preset.openai_max_context,
      openai_max_tokens: preset.openai_max_tokens,
      max_context_unlocked: preset.max_context_unlocked,
      max_history: preset.max_history,
      wrap_in_quotes: preset.wrap_in_quotes,
      names_behavior: preset.names_behavior,
      send_if_empty: preset.send_if_empty,
      bias_preset_selected: preset.bias_preset_selected,
      stream_openai: preset.stream_openai
    };

    if (preset.stop_sequences?.length) {
      data.stop_sequences = preset.stop_sequences;
    }

    if (preset.impersonation_prompt) data.impersonation_prompt = preset.impersonation_prompt;
    if (preset.new_chat_prompt) data.new_chat_prompt = preset.new_chat_prompt;
    if (preset.new_group_chat_prompt) data.new_group_chat_prompt = preset.new_group_chat_prompt;
    if (preset.new_example_chat_prompt) data.new_example_chat_prompt = preset.new_example_chat_prompt;
    if (preset.continue_nudge_prompt) data.continue_nudge_prompt = preset.continue_nudge_prompt;
    if (preset.wi_format) data.wi_format = preset.wi_format;
    if (preset.scenario_format) data.scenario_format = preset.scenario_format;
    if (preset.personality_format) data.personality_format = preset.personality_format;
    if (preset.group_nudge_prompt) data.group_nudge_prompt = preset.group_nudge_prompt;

    // Export prompt entries as prompts array
    if (preset.prompt_entries?.length) {
      data.prompts = preset.prompt_entries
        .sort((a, b) => a.position - b.position)
        .map(e => ({
          name: e.name,
          content: e.content,
          enabled: e.enabled,
          role: e.role,
          system_prompt: e.system_prompt,
          identifier: e.identifier,
          marker: e.marker,
          injection_position: e.injection_position,
          injection_depth: e.injection_depth,
          injection_order: e.injection_order,
          injection_trigger: e.injection_trigger || [],
          forbid_overrides: e.forbid_overrides
        }));
    }

    return data;
  }

  static create(presetData: Partial<ChatCompletionPreset>): ChatCompletionPreset {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    const data = {
      ...DEFAULT_PRESET,
      ...presetData
    };

    // Insert preset
    const stmt = db.prepare(`
      INSERT INTO presets (
        id, name, description, temperature, top_p, top_k, top_a, min_p,
        presence_penalty, frequency_penalty, repetition_penalty,
        openai_max_context, openai_max_tokens, max_context_unlocked, max_history,
        stop_sequences, wrap_in_quotes, names_behavior, send_if_empty,
        impersonation_prompt, new_chat_prompt, new_group_chat_prompt, new_example_chat_prompt,
        continue_nudge_prompt, bias_preset_selected, stream_openai,
        wi_format, scenario_format, personality_format, group_nudge_prompt,
        raw_data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.description || null,
      data.temperature,
      data.top_p,
      data.top_k,
      data.top_a,
      data.min_p,
      data.presence_penalty,
      data.frequency_penalty,
      data.repetition_penalty,
      data.openai_max_context,
      data.openai_max_tokens,
      data.max_context_unlocked ? 1 : 0,
      data.max_history,
      data.stop_sequences ? JSON.stringify(data.stop_sequences) : null,
      data.wrap_in_quotes ? 1 : 0,
      data.names_behavior,
      data.send_if_empty,
      data.impersonation_prompt || null,
      data.new_chat_prompt || null,
      data.new_group_chat_prompt || null,
      data.new_example_chat_prompt || null,
      data.continue_nudge_prompt || null,
      data.bias_preset_selected,
      data.stream_openai ? 1 : 0,
      data.wi_format || null,
      data.scenario_format || null,
      data.personality_format || null,
      data.group_nudge_prompt || null,
      data.raw_data || null,
      now,
      now
    );

    // Create prompt entries if provided
    const entries = data.prompt_entries || [];
    if (entries.length) {
      const entryStmt = db.prepare(`
        INSERT INTO preset_prompt_entries (
          id, preset_id, name, content, enabled, position,
          role, system_prompt, identifier, marker,
          injection_position, injection_depth, injection_order, injection_trigger, forbid_overrides,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const entry of entries) {
        entryStmt.run(
          entry.id?.startsWith('temp_') || !entry.id ? uuidv4() : entry.id,
          id,
          entry.name,
          entry.content,
          entry.enabled ? 1 : 0,
          entry.position,
          entry.role || 'system',
          entry.system_prompt ? 1 : 0,
          entry.identifier || null,
          entry.marker ? 1 : 0,
          entry.injection_position ?? 0,
          entry.injection_depth ?? 4,
          entry.injection_order ?? 100,
          entry.injection_trigger ? JSON.stringify(entry.injection_trigger) : null,
          entry.forbid_overrides ? 1 : 0,
          now,
          now
        );
      }
    }

    return {
      id,
      ...data,
      created_at: now,
      updated_at: now,
      prompt_entries: this.getPromptEntries(id)
    } as ChatCompletionPreset;
  }

  static getPromptEntries(presetId: string): PromptEntry[] {
    const stmt = db.prepare(`
      SELECT * FROM preset_prompt_entries
      WHERE preset_id = ?
      ORDER BY position ASC, created_at ASC
    `);
    const rows = stmt.all(presetId) as any[];
    return rows.map(row => ({
      id: row.id,
      preset_id: row.preset_id,
      name: row.name,
      content: row.content,
      enabled: Boolean(row.enabled),
      position: row.position,
      role: row.role,
      system_prompt: Boolean(row.system_prompt),
      identifier: row.identifier,
      marker: Boolean(row.marker),
      injection_position: row.injection_position,
      injection_depth: row.injection_depth,
      injection_order: row.injection_order,
      injection_trigger: row.injection_trigger ? JSON.parse(row.injection_trigger) : undefined,
      forbid_overrides: Boolean(row.forbid_overrides),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  static getById(id: string): ChatCompletionPreset | null {
    const stmt = db.prepare('SELECT * FROM presets WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      ...this.rowToPreset(row),
      prompt_entries: this.getPromptEntries(id)
    };
  }

  static getActive(): ChatCompletionPreset | null {
    const stmt = db.prepare(`
      SELECT p.* FROM presets p
      JOIN active_preset ap ON p.id = ap.preset_id
      WHERE ap.id = 1
    `);
    const row = stmt.get() as any;
    if (!row) return null;

    return {
      ...this.rowToPreset(row),
      prompt_entries: this.getPromptEntries(row.id)
    };
  }

  static setActive(presetId: string | null): boolean {
    const stmt = db.prepare('UPDATE active_preset SET preset_id = ?, updated_at = ? WHERE id = 1');
    const result = stmt.run(presetId || null, Math.floor(Date.now() / 1000));
    return result.changes > 0;
  }

  static list(limit = 50, offset = 0): ChatCompletionPreset[] {
    const stmt = db.prepare(`
      SELECT * FROM presets
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as any[];
    return rows.map(row => ({
      ...this.rowToPreset(row),
      prompt_entries: this.getPromptEntries(row.id)
    }));
  }

  static update(id: string, updates: Partial<ChatCompletionPreset>): boolean {
    const fields: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, (v: any) => any> = {
      stop_sequences: (v) => v ? JSON.stringify(v) : null,
      max_context_unlocked: (v) => v ? 1 : 0,
      wrap_in_quotes: (v) => v ? 1 : 0,
      stream_openai: (v) => v ? 1 : 0
    };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id' && key !== 'created_at' && key !== 'updated_at' && key !== 'raw_data' && key !== 'prompt_entries') {
        fields.push(`${key} = ?`);
        values.push(fieldMap[key] ? fieldMap[key](value) : value);
      }
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(Math.floor(Date.now() / 1000));
      values.push(id);

      const stmt = db.prepare(`
        UPDATE presets SET ${fields.join(', ')} WHERE id = ?
      `);

      stmt.run(...values);
    }

    return true;
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM presets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Prompt Entry CRUD
  static createPromptEntry(presetId: string, entry: Omit<PromptEntry, 'id' | 'preset_id' | 'created_at' | 'updated_at'>): PromptEntry {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    const stmt = db.prepare(`
      INSERT INTO preset_prompt_entries (
        id, preset_id, name, content, enabled, position,
        role, system_prompt, identifier, marker,
        injection_position, injection_depth, injection_order, injection_trigger, forbid_overrides,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      presetId,
      entry.name,
      entry.content,
      entry.enabled ? 1 : 0,
      entry.position,
      entry.role || 'system',
      entry.system_prompt ? 1 : 0,
      entry.identifier || null,
      entry.marker ? 1 : 0,
      entry.injection_position ?? 0,
      entry.injection_depth ?? 4,
      entry.injection_order ?? 100,
      entry.injection_trigger ? JSON.stringify(entry.injection_trigger) : null,
      entry.forbid_overrides ? 1 : 0,
      now,
      now
    );

    return {
      id,
      preset_id: presetId,
      ...entry,
      created_at: now,
      updated_at: now
    };
  }

  static updatePromptEntry(entryId: string, updates: Partial<Omit<PromptEntry, 'id' | 'preset_id' | 'created_at'>>): boolean {
    const fields: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, (v: any) => any> = {
      enabled: (v) => v ? 1 : 0,
      system_prompt: (v) => v ? 1 : 0,
      marker: (v) => v ? 1 : 0,
      forbid_overrides: (v) => v ? 1 : 0,
      injection_trigger: (v) => v ? JSON.stringify(v) : null
    };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id' && key !== 'preset_id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(fieldMap[key] ? fieldMap[key](value) : value);
      }
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));
    values.push(entryId);

    const stmt = db.prepare(`
      UPDATE preset_prompt_entries SET ${fields.join(', ')} WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  static deletePromptEntry(entryId: string): boolean {
    const stmt = db.prepare('DELETE FROM preset_prompt_entries WHERE id = ?');
    const result = stmt.run(entryId);
    return result.changes > 0;
  }

  static reorderPromptEntries(presetId: string, entryIds: string[]): boolean {
    const stmt = db.prepare('UPDATE preset_prompt_entries SET position = ?, updated_at = ? WHERE id = ? AND preset_id = ?');
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < entryIds.length; i++) {
      stmt.run(i, now, entryIds[i], presetId);
    }

    return true;
  }

  private static rowToPreset(row: any): ChatCompletionPreset {
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      temperature: row.temperature ?? DEFAULT_PRESET.temperature,
      top_p: row.top_p ?? DEFAULT_PRESET.top_p,
      top_k: row.top_k ?? DEFAULT_PRESET.top_k,
      top_a: row.top_a ?? DEFAULT_PRESET.top_a,
      min_p: row.min_p ?? DEFAULT_PRESET.min_p,
      presence_penalty: row.presence_penalty ?? DEFAULT_PRESET.presence_penalty,
      frequency_penalty: row.frequency_penalty ?? DEFAULT_PRESET.frequency_penalty,
      repetition_penalty: row.repetition_penalty ?? DEFAULT_PRESET.repetition_penalty,
      openai_max_context: row.openai_max_context ?? DEFAULT_PRESET.openai_max_context,
      openai_max_tokens: row.openai_max_tokens ?? DEFAULT_PRESET.openai_max_tokens,
      max_context_unlocked: Boolean(row.max_context_unlocked),
      max_history: row.max_history ?? DEFAULT_PRESET.max_history,
      stop_sequences: row.stop_sequences ? JSON.parse(row.stop_sequences) : undefined,
      wrap_in_quotes: Boolean(row.wrap_in_quotes),
      names_behavior: row.names_behavior ?? DEFAULT_PRESET.names_behavior,
      send_if_empty: row.send_if_empty || '',
      impersonation_prompt: row.impersonation_prompt,
      new_chat_prompt: row.new_chat_prompt,
      new_group_chat_prompt: row.new_group_chat_prompt,
      new_example_chat_prompt: row.new_example_chat_prompt,
      continue_nudge_prompt: row.continue_nudge_prompt,
      bias_preset_selected: row.bias_preset_selected ?? DEFAULT_PRESET.bias_preset_selected,
      stream_openai: Boolean(row.stream_openai),
      wi_format: row.wi_format,
      scenario_format: row.scenario_format,
      personality_format: row.personality_format,
      group_nudge_prompt: row.group_nudge_prompt,
      raw_data: row.raw_data,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // Build system prompt from enabled prompt entries
  // Supports World Info / Lorebook style keyword triggering
  static buildSystemPrompt(preset: ChatCompletionPreset, context?: {
    userMessage?: string;
    history?: Array<{ role: string; content: string }>;
  }): string {
    if (!preset.prompt_entries?.length) return '';

    // Build context text for keyword matching
    const contextText = context
      ? [
          context.userMessage || '',
          ...(context.history || []).slice(-10).map(h => h.content) // Last 10 messages
        ].join(' ')
      : '';

    const enabledEntries = preset.prompt_entries
      .filter(e => {
        if (!e.enabled || e.marker) return false;

        // If entry has injection_trigger, only include if keywords match
        if (e.injection_trigger && e.injection_trigger.length > 0) {
          const matched = e.injection_trigger.some(keyword =>
            contextText.toLowerCase().includes(keyword.toLowerCase())
          );
          return matched;
        }

        // No trigger = always include (traditional prompt entry)
        return true;
      })
      .sort((a, b) => a.position - b.position);

    return enabledEntries
      .map(e => e.content.trim())
      .filter(Boolean)
      .join('\n\n');
  }

  // Apply preset to build API request
  static applyToRequest(preset: ChatCompletionPreset): any {
    const request: any = {
      temperature: preset.temperature,
      max_tokens: preset.openai_max_tokens,
      top_p: preset.top_p,
      presence_penalty: preset.presence_penalty,
      frequency_penalty: preset.frequency_penalty
    };

    if (preset.stop_sequences?.length) {
      request.stop = preset.stop_sequences;
    }

    return request;
  }

  // Build messages array with preset context
  static buildMessages(preset: ChatCompletionPreset, options: {
    systemPrompt?: string;
    history?: Array<{ role: string; content: string }>;
    userMessage: string;
  }): Array<{ role: string; content: string; name?: string }> {
    const messages: Array<{ role: string; content: string; name?: string }> = [];

    // System message from preset prompt entries (with World Info keyword matching)
    const systemContent = this.buildSystemPrompt(preset, {
      userMessage: options.userMessage,
      history: options.history
    }) || options.systemPrompt || '';
    if (systemContent) {
      messages.push({ role: 'system', content: systemContent });
    }

    // History
    if (options.history) {
      const limitedHistory = preset.max_history
        ? options.history.slice(-preset.max_history)
        : options.history;

      for (const msg of limitedHistory) {
        messages.push({
          role: msg.role as any,
          content: msg.content
        });
      }
    }

    // User message
    messages.push({ role: 'user', content: options.userMessage });

    return messages;
  }
}
