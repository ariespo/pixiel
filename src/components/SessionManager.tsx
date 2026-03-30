import { useState } from 'react';
import { motion } from 'motion/react';
import { TextGenPreset } from '../services/api';

interface Session {
  id: string;
  title: string;
  preset_id?: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}

interface Props {
  sessions: Session[];
  currentSessionId: string | null;
  presets: TextGenPreset[];
  onSelectSession: (id: string) => void;
  onNewSession: (presetId?: string) => void;
  onDeleteSession: (id: string) => void;
  onClose: () => void;
  onManagePresets: () => void;
}

export default function SessionManager({
  sessions,
  currentSessionId,
  presets,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onClose,
  onManagePresets
}: Props) {
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [showNewSession, setShowNewSession] = useState(false);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const getPresetName = (presetId?: string) => {
    if (!presetId) return '无预设';
    const preset = presets.find(p => p.id === presetId);
    return preset?.name || '未知预设';
  };

  return (
    <div className="h-full flex flex-col bg-coffee-800 text-coffee-100">
      {/* Header */}
      <div className="p-4 border-b-4 border-coffee-900 flex items-center justify-between">
        <h2 className="font-bold text-lg">会话管理</h2>
        <button onClick={onClose} className="hover:text-amber-400">✕</button>
      </div>

      {/* New Session Button */}
      <div className="p-4 border-b-4 border-coffee-900">
        <button
          onClick={() => setShowNewSession(!showNewSession)}
          className="pixel-button w-full py-2 font-bold"
        >
          {showNewSession ? '取消' : '+ 新会话'}
        </button>

        {showNewSession && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 space-y-3"
          >
            {/* Preset Selection */}
            <div>
              <label className="text-xs text-coffee-300 block mb-1">选择预设</label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full pixel-border-inset p-2 bg-coffee-700 text-coffee-100 text-sm"
              >
                <option value="">默认设置</option>
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                onNewSession(selectedPreset || undefined);
                setShowNewSession(false);
                setSelectedPreset('');
              }}
              className="pixel-button w-full py-2 text-sm bg-amber-500 text-coffee-900"
            >
              创建
            </button>
          </motion.div>
        )}
      </div>

      {/* Preset Management Button */}
      <div className="p-4 border-b-4 border-coffee-900">
        <button
          onClick={onManagePresets}
          className="pixel-button w-full py-2 text-sm"
        >
          ⚙️ 管理预设
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sessions.length === 0 ? (
          <p className="text-center text-coffee-400 text-sm p-4">暂无会话</p>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`p-3 cursor-pointer transition-colors ${
                currentSessionId === session.id
                  ? 'bg-amber-500 text-coffee-900'
                  : 'bg-coffee-700 hover:bg-coffee-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm truncate flex-1">{session.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="text-xs opacity-50 hover:opacity-100 ml-2"
                >
                  🗑️
                </button>
              </div>
              <div className="text-xs opacity-70 mt-1">
                {session.message_count} 条消息 · {formatDate(session.updated_at)}
              </div>
              {session.preset_id && (
                <div className={`text-xs mt-1 ${currentSessionId === session.id ? 'text-coffee-700' : 'text-amber-400'}`}>
                  预设: {getPresetName(session.preset_id)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
