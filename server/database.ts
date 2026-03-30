import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'app.db'));

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Migrate presets table to SillyTavern format if needed
const migratePresetsTable = () => {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(presets)").all() as any[];
    const existingColumns = new Set(tableInfo.map(col => col.name));

    // Check if this is the old format (has 'type' column) or missing SillyTavern columns
    const hasOldFormat = existingColumns.has('type');
    const hasNewFormat = existingColumns.has('temperature');

    if (hasOldFormat || !hasNewFormat) {
      console.log('[Database] Migrating presets table to SillyTavern format...');

      // SQLite doesn't support DROP COLUMN, so we need to recreate the table
      db.exec(`
        -- Create new table with correct schema
        CREATE TABLE presets_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          temperature REAL DEFAULT 0.7,
          top_p REAL DEFAULT 1.0,
          top_k INTEGER DEFAULT 0,
          top_a REAL DEFAULT 0,
          min_p REAL DEFAULT 0,
          presence_penalty REAL DEFAULT 0,
          frequency_penalty REAL DEFAULT 0,
          repetition_penalty REAL DEFAULT 1,
          openai_max_context INTEGER DEFAULT 8192,
          openai_max_tokens INTEGER DEFAULT 512,
          max_context_unlocked INTEGER DEFAULT 0,
          max_history INTEGER DEFAULT 50,
          stop_sequences TEXT,
          wrap_in_quotes INTEGER DEFAULT 0,
          names_behavior INTEGER DEFAULT 0,
          send_if_empty TEXT DEFAULT '',
          impersonation_prompt TEXT,
          new_chat_prompt TEXT,
          new_group_chat_prompt TEXT,
          new_example_chat_prompt TEXT,
          continue_nudge_prompt TEXT,
          bias_preset_selected TEXT DEFAULT 'Default (none)',
          stream_openai INTEGER DEFAULT 0,
          wi_format TEXT,
          scenario_format TEXT,
          personality_format TEXT,
          group_nudge_prompt TEXT,
          raw_data TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        -- Copy data from old table if it exists
        INSERT INTO presets_new (
          id, name, description, raw_data, created_at, updated_at
        )
        SELECT id, name, description, raw_data, created_at, updated_at
        FROM presets;

        -- Drop old table and rename new one
        DROP TABLE presets;
        ALTER TABLE presets_new RENAME TO presets;

        -- Recreate prompt entries table (it might have old schema too)
        DROP TABLE IF EXISTS preset_prompt_entries;
        DROP TABLE IF EXISTS active_preset;
      `);

      console.log('[Database] Migration completed successfully');
    }
  } catch (err) {
    console.error('[Database] Migration error:', err);
  }
};

migratePresetsTable();

// Initialize tables
db.exec(`
  -- Chat sessions table
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    preset_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    message_count INTEGER DEFAULT 0
  );

  -- Chat messages table
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
  );

  -- Presets table (Chat Completion preset - SillyTavern format)
  CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,

    -- OpenAI API / Chat Completion parameters
    temperature REAL DEFAULT 0.7,
    top_p REAL DEFAULT 1.0,
    top_k INTEGER DEFAULT 0,
    top_a REAL DEFAULT 0,
    min_p REAL DEFAULT 0,
    presence_penalty REAL DEFAULT 0,
    frequency_penalty REAL DEFAULT 0,
    repetition_penalty REAL DEFAULT 1,

    -- Context and token limits
    openai_max_context INTEGER DEFAULT 8192,
    openai_max_tokens INTEGER DEFAULT 512,
    max_context_unlocked INTEGER DEFAULT 0,
    max_history INTEGER DEFAULT 50,

    -- Stop sequences (JSON array)
    stop_sequences TEXT,

    -- SillyTavern specific settings
    wrap_in_quotes INTEGER DEFAULT 0,
    names_behavior INTEGER DEFAULT 0,
    send_if_empty TEXT DEFAULT '',
    impersonation_prompt TEXT,
    new_chat_prompt TEXT,
    new_group_chat_prompt TEXT,
    new_example_chat_prompt TEXT,
    continue_nudge_prompt TEXT,
    bias_preset_selected TEXT DEFAULT 'Default (none)',
    stream_openai INTEGER DEFAULT 0,

    -- Format settings
    wi_format TEXT,
    scenario_format TEXT,
    personality_format TEXT,
    group_nudge_prompt TEXT,

    -- Raw import data
    raw_data TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Preset prompt entries (SillyTavern-style prompt manager)
  CREATE TABLE IF NOT EXISTS preset_prompt_entries (
    id TEXT PRIMARY KEY,
    preset_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    enabled INTEGER DEFAULT 1,
    position INTEGER DEFAULT 0,

    -- SillyTavern specific fields
    role TEXT DEFAULT 'system',
    system_prompt INTEGER DEFAULT 1,
    identifier TEXT,
    marker INTEGER DEFAULT 0,
    injection_position INTEGER DEFAULT 0,
    injection_depth INTEGER DEFAULT 4,
    injection_order INTEGER DEFAULT 100,
    injection_trigger TEXT,
    forbid_overrides INTEGER DEFAULT 0,

    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
  );

  -- Active preset for new chats
  CREATE TABLE IF NOT EXISTS active_preset (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    preset_id TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE SET NULL
  );

  -- Insert default active preset row if not exists
  INSERT OR IGNORE INTO active_preset (id, preset_id) VALUES (1, NULL);

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON chat_messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_updated ON chat_sessions(updated_at);
  CREATE INDEX IF NOT EXISTS idx_prompt_entries_preset ON preset_prompt_entries(preset_id);
  CREATE INDEX IF NOT EXISTS idx_prompt_entries_position ON preset_prompt_entries(position);
`);

export default db;
