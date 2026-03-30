import db from '../database';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
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

export class ChatModel {
  // Session operations
  static createSession(title: string, presetId?: string): ChatSession {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    const stmt = db.prepare(`
      INSERT INTO chat_sessions (id, title, preset_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, title, presetId || null, now, now);

    return {
      id,
      title,
      preset_id: presetId,
      created_at: now,
      updated_at: now,
      message_count: 0
    };
  }

  static getSession(id: string): ChatSession | null {
    const stmt = db.prepare(`
      SELECT s.*, COUNT(m.id) as message_count
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON s.id = m.session_id
      WHERE s.id = ?
      GROUP BY s.id
    `);
    return stmt.get(id) as ChatSession | null;
  }

  static listSessions(limit = 50, offset = 0): ChatSession[] {
    const stmt = db.prepare(`
      SELECT s.*, COUNT(m.id) as message_count
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON s.id = m.session_id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as ChatSession[];
  }

  static updateSession(id: string, updates: Partial<Pick<ChatSession, 'title' | 'preset_id'>>): boolean {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.preset_id !== undefined) {
      fields.push('preset_id = ?');
      values.push(updates.preset_id);
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));
    values.push(id);

    const stmt = db.prepare(`
      UPDATE chat_sessions SET ${fields.join(', ')} WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  static deleteSession(id: string): boolean {
    const stmt = db.prepare('DELETE FROM chat_sessions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Message operations
  static addMessage(
    sessionId: string,
    role: ChatMessage['role'],
    content: string,
    metadata?: ChatMessage['metadata'],
    createdAt?: number
  ): ChatMessage {
    const id = uuidv4();
    const now = createdAt ?? Math.floor(Date.now() / 1000);

    const stmt = db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      sessionId,
      role,
      content,
      metadata ? JSON.stringify(metadata) : null,
      now
    );

    // Update session's updated_at
    db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

    return {
      id,
      session_id: sessionId,
      role,
      content,
      metadata,
      created_at: now
    };
  }

  static getMessages(sessionId: string, limit?: number, offset = 0): ChatMessage[] {
    let sql = `
      SELECT * FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `;
    const params: any[] = [sessionId];

    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }

    const stmt = db.prepare(sql);
    const messages = stmt.all(...params) as any[];

    return messages.map(m => ({
      ...m,
      metadata: m.metadata ? JSON.parse(m.metadata) : undefined
    }));
  }

  static getRecentMessages(sessionId: string, count: number): ChatMessage[] {
    const stmt = db.prepare(`
      SELECT * FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const messages = stmt.all(sessionId, count) as any[];

    return messages
      .reverse()
      .map(m => ({
        ...m,
        metadata: m.metadata ? JSON.parse(m.metadata) : undefined
      }));
  }

  static updateMessage(id: string, content: string): boolean {
    const stmt = db.prepare(`
      UPDATE chat_messages SET content = ? WHERE id = ?
    `);
    const result = stmt.run(content, id);
    return result.changes > 0;
  }

  static deleteMessage(id: string): boolean {
    const stmt = db.prepare('DELETE FROM chat_messages WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static deleteMessagesBySession(sessionId: string): boolean {
    const stmt = db.prepare('DELETE FROM chat_messages WHERE session_id = ?');
    const result = stmt.run(sessionId);
    return result.changes > 0;
  }

  // Get formatted history for LLM context
  // Returns messages with full metadata for frontend to format
  static getMessageHistoryForLLM(sessionId: string, maxMessages = 50): { role: string; content: string; sender?: string; timestamp?: number }[] {
    const messages = this.getRecentMessages(sessionId, maxMessages);

    return messages.map(m => ({
      role: m.role,
      content: m.content,
      sender: m.metadata?.name,
      timestamp: m.created_at
    }));
  }
}
