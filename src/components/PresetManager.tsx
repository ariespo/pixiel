import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChatCompletionPreset, PromptEntry } from '../services/api';

interface Props {
  presets: ChatCompletionPreset[];
  activePreset: ChatCompletionPreset | null;
  currentSessionPresetId?: string;
  onSelectPreset: (presetId: string | null) => void;
  onCreatePreset: (data: Partial<ChatCompletionPreset>) => void;
  onEditPreset: (preset: ChatCompletionPreset) => void;
  onDeletePreset: (id: string) => void;
  onImportPreset: () => void;
  onExportPreset: (preset: ChatCompletionPreset) => void;
  onSetActive: (presetId: string | null) => void;
  onClose: () => void;
}

export default function PresetManager({
  presets,
  activePreset,
  currentSessionPresetId,
  onSelectPreset,
  onCreatePreset,
  onEditPreset,
  onDeletePreset,
  onImportPreset,
  onExportPreset,
  onSetActive,
  onClose
}: Props) {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingPreset, setEditingPreset] = useState<ChatCompletionPreset | null>(null);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const handleEdit = (preset: ChatCompletionPreset) => {
    setEditingPreset(preset);
    setView('edit');
  };

  const handleCreate = () => {
    setEditingPreset(null);
    setView('edit');
  };

  const handleSave = (presetData: Partial<ChatCompletionPreset>) => {
    if (editingPreset) {
      onEditPreset({ ...editingPreset, ...presetData } as ChatCompletionPreset);
    } else {
      onCreatePreset(presetData);
    }
    setView('list');
    setEditingPreset(null);
  };

  return (
    <div className="h-full flex flex-col bg-coffee-800 text-coffee-100">
      {/* Header */}
      <div className="p-4 border-b-4 border-coffee-900 flex items-center justify-between">
        <h2 className="font-bold text-lg">
          {view === 'list' ? '对话补全预设' : editingPreset ? '编辑预设' : '新建预设'}
        </h2>
        <button onClick={onClose} className="hover:text-amber-400">✕</button>
      </div>

      {/* Content */}
      {view === 'list' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Actions */}
          <div className="p-4 border-b-4 border-coffee-900 space-y-2">
            <button
              onClick={handleCreate}
              className="pixel-button w-full py-2 font-bold"
            >
              + 新建预设
            </button>
            <button
              onClick={onImportPreset}
              className="pixel-button w-full py-2 text-sm"
            >
              📥 导入 SillyTavern 预设
            </button>
          </div>

          {/* Active Preset */}
          {activePreset && (
            <div className="p-4 border-b-4 border-coffee-900 bg-amber-900/20">
              <h3 className="text-xs text-amber-400 mb-1">全局默认预设</h3>
              <div className="flex items-center justify-between">
                <span className="font-bold">{activePreset.name}</span>
                <span className="text-xs text-coffee-400">
                  T={activePreset.temperature.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Preset List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {presets.length === 0 ? (
              <p className="text-center text-coffee-400 text-sm p-4">
                暂无预设<br />
                <span className="text-xs">导入或创建一个新预设</span>
              </p>
            ) : (
              presets.map(preset => (
                <div
                  key={preset.id}
                  className={`p-3 transition-colors ${
                    currentSessionPresetId === preset.id
                      ? 'bg-amber-500 text-coffee-900'
                      : activePreset?.id === preset.id
                        ? 'bg-amber-900/40 border border-amber-500/50'
                        : 'bg-coffee-700 hover:bg-coffee-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">{preset.name}</span>
                    <div className="flex items-center gap-1">
                      {activePreset?.id === preset.id && (
                        <span className="text-xs px-2 py-0.5 bg-amber-500 text-coffee-900 rounded">默认</span>
                      )}
                      {currentSessionPresetId === preset.id && (
                        <span className="text-xs px-2 py-0.5 bg-green-500 text-coffee-900 rounded">当前</span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs opacity-70 mb-2">
                    T={(preset.temperature ?? 0.7).toFixed(2)} |
                    TopP={(preset.top_p ?? 1.0).toFixed(2)} |
                    Max={preset.openai_max_tokens ?? 512} |
                    PP={preset.presence_penalty ?? 0} |
                    FP={preset.frequency_penalty ?? 0}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => onSelectPreset(preset.id)}
                      className="pixel-button px-2 py-1 text-xs"
                      disabled={currentSessionPresetId === preset.id}
                    >
                      应用
                    </button>
                    <button
                      onClick={() => onSetActive(preset.id)}
                      className="pixel-button px-2 py-1 text-xs"
                      disabled={activePreset?.id === preset.id}
                    >
                      设为默认
                    </button>
                    <button
                      onClick={() => handleEdit(preset)}
                      className="pixel-button px-2 py-1 text-xs"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => onExportPreset(preset)}
                      className="pixel-button px-2 py-1 text-xs"
                    >
                      导出
                    </button>
                    <button
                      onClick={() => onDeletePreset(preset.id)}
                      className="pixel-button px-2 py-1 text-xs bg-red-900/50"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <PresetEditor
          preset={editingPreset}
          onSave={handleSave}
          onCancel={() => {
            setView('list');
            setEditingPreset(null);
          }}
        />
      )}
    </div>
  );
}

// Preset Editor Component
interface EditorProps {
  preset: ChatCompletionPreset | null;
  onSave: (data: Partial<ChatCompletionPreset>) => void;
  onCancel: () => void;
}

function PresetEditor({ preset, onSave, onCancel }: EditorProps) {
  const [activeTab, setActiveTab] = useState<'params' | 'prompts'>('params');
  const [formData, setFormData] = useState<Partial<ChatCompletionPreset>>({
    name: preset?.name || '新预设',
    description: preset?.description || '',
    temperature: preset?.temperature ?? 0.7,
    top_p: preset?.top_p ?? 1.0,
    top_k: preset?.top_k ?? 0,
    top_a: preset?.top_a ?? 0,
    min_p: preset?.min_p ?? 0,
    presence_penalty: preset?.presence_penalty ?? 0,
    frequency_penalty: preset?.frequency_penalty ?? 0,
    repetition_penalty: preset?.repetition_penalty ?? 1,
    openai_max_context: preset?.openai_max_context ?? 8192,
    openai_max_tokens: preset?.openai_max_tokens ?? 512,
    max_context_unlocked: preset?.max_context_unlocked ?? false,
    max_history: preset?.max_history ?? 50,
    stop_sequences: preset?.stop_sequences || [],
    stream_openai: preset?.stream_openai ?? false,
    prompt_entries: preset?.prompt_entries || []
  });
  const [editingEntry, setEditingEntry] = useState<PromptEntry | null>(null);

  const handleChange = (field: keyof ChatCompletionPreset, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addPromptEntry = () => {
    const newEntry: PromptEntry = {
      id: `temp_${Date.now()}`,
      preset_id: preset?.id || 'temp',
      name: '新条目',
      content: '',
      enabled: true,
      position: formData.prompt_entries?.length || 0,
      role: 'system',
      system_prompt: true,
      injection_position: 0,
      injection_depth: 4,
      injection_order: 100,
      forbid_overrides: false,
      created_at: Date.now(),
      updated_at: Date.now()
    };
    setFormData(prev => ({
      ...prev,
      prompt_entries: [...(prev.prompt_entries || []), newEntry]
    }));
    setEditingEntry(newEntry);
  };

  const updatePromptEntry = (entryId: string, updates: Partial<PromptEntry>) => {
    setFormData(prev => ({
      ...prev,
      prompt_entries: prev.prompt_entries?.map(e =>
        e.id === entryId ? { ...e, ...updates } : e
      ) || []
    }));
    if (editingEntry?.id === entryId) {
      setEditingEntry({ ...editingEntry, ...updates });
    }
  };

  const deletePromptEntry = (entryId: string) => {
    setFormData(prev => ({
      ...prev,
      prompt_entries: prev.prompt_entries?.filter(e => e.id !== entryId) || []
    }));
    if (editingEntry?.id === entryId) {
      setEditingEntry(null);
    }
  };

  const moveEntry = (index: number, direction: 'up' | 'down') => {
    const entries = formData.prompt_entries || [];
    if (direction === 'up' && index > 0) {
      const newEntries = [...entries];
      [newEntries[index], newEntries[index - 1]] = [newEntries[index - 1], newEntries[index]];
      newEntries.forEach((e, i) => e.position = i);
      setFormData(prev => ({ ...prev, prompt_entries: newEntries }));
    } else if (direction === 'down' && index < entries.length - 1) {
      const newEntries = [...entries];
      [newEntries[index], newEntries[index + 1]] = [newEntries[index + 1], newEntries[index]];
      newEntries.forEach((e, i) => e.position = i);
      setFormData(prev => ({ ...prev, prompt_entries: newEntries }));
    }
  };

  const SliderField = ({ label, field, min, max, step = 0.01, description }: {
    label: string;
    field: keyof ChatCompletionPreset;
    min: number;
    max: number;
    step?: number;
    description?: string;
  }) => (
    <div className="mb-4">
      <label className="block text-xs text-coffee-300 mb-1">
        {label}: {Number(formData[field] ?? 0).toFixed(step < 1 ? 2 : 0)}
      </label>
      {description && <p className="text-[10px] text-coffee-400 mb-1">{description}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={formData[field] as number}
        onChange={(e) => handleChange(field, parseFloat(e.target.value))}
        className="w-full accent-amber-500"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b-2 border-coffee-900">
        <button
          type="button"
          onClick={() => setActiveTab('params')}
          className={`flex-1 py-2 text-sm font-bold ${
            activeTab === 'params' ? 'bg-amber-500 text-coffee-900' : 'text-coffee-300 hover:text-amber-400'
          }`}
        >
          API 参数
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('prompts')}
          className={`flex-1 py-2 text-sm font-bold ${
            activeTab === 'prompts' ? 'bg-amber-500 text-coffee-900' : 'text-coffee-300 hover:text-amber-400'
          }`}
        >
          提示词管理 ({formData.prompt_entries?.length || 0})
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'params' ? (
          <>
            {/* Name */}
            <div className="mb-4">
              <label className="block text-xs text-coffee-300 mb-1">预设名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full pixel-border-inset p-2 bg-coffee-700 text-coffee-100 text-sm"
                required
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-xs text-coffee-300 mb-1">描述</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full pixel-border-inset p-2 bg-coffee-700 text-coffee-100 text-sm"
                placeholder="可选描述..."
              />
            </div>

            <div className="border-t-2 border-coffee-700 my-4" />

            {/* Temperature */}
            <SliderField
              label="温度 (Temperature)"
              field="temperature"
              min={0}
              max={2}
              description="越高越随机，越低越确定"
            />

            {/* Top P */}
            <SliderField
              label="Top P (Nucleus Sampling)"
              field="top_p"
              min={0}
              max={1}
              description="控制词汇选择的多样性"
            />

            {/* Presence Penalty */}
            <SliderField
              label="存在惩罚 (Presence Penalty)"
              field="presence_penalty"
              min={-2}
              max={2}
              description="对已有token进行惩罚，促进话题多样性"
            />

            {/* Frequency Penalty */}
            <SliderField
              label="频率惩罚 (Frequency Penalty)"
              field="frequency_penalty"
              min={-2}
              max={2}
              description="对频繁出现的token进行惩罚，减少重复"
            />

            <div className="border-t-2 border-coffee-700 my-4" />

            {/* Max Tokens */}
            <SliderField
              label="最大生成 Token 数"
              field="openai_max_tokens"
              min={16}
              max={65535}
              step={16}
            />

            {/* Max Context */}
            <SliderField
              label="最大上下文长度"
              field="openai_max_context"
              min={1024}
              max={2000000}
              step={1024}
            />

            {/* Max History */}
            <SliderField
              label="最大历史消息数"
              field="max_history"
              min={1}
              max={200}
              step={1}
              description="保留在上下文中的消息数量"
            />

            {/* Stop Sequences */}
            <div className="mb-4">
              <label className="block text-xs text-coffee-300 mb-1">停止序列 (Stop Sequences)</label>
              <input
                type="text"
                value={(formData.stop_sequences || []).join(', ')}
                onChange={(e) => handleChange('stop_sequences', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                className="w-full pixel-border-inset p-2 bg-coffee-700 text-coffee-100 text-sm"
                placeholder="用逗号分隔，如: User:, Assistant:"
              />
            </div>

            {/* Stream Toggle */}
            <div className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="stream_openai"
                checked={formData.stream_openai}
                onChange={(e) => handleChange('stream_openai', e.target.checked)}
                className="accent-amber-500"
              />
              <label htmlFor="stream_openai" className="text-xs text-coffee-300">启用流式传输</label>
            </div>
          </>
        ) : (
          <>
            {/* Prompt Entries List */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-coffee-300">提示词条目</label>
                <button
                  type="button"
                  onClick={addPromptEntry}
                  className="pixel-button px-2 py-1 text-xs"
                >
                  + 添加条目
                </button>
              </div>

              {/* Entries */}
              <div className="space-y-2">
                {formData.prompt_entries?.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`p-2 border-2 ${
                      editingEntry?.id === entry.id
                        ? 'border-amber-500 bg-amber-900/20'
                        : 'border-coffee-700 bg-coffee-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={entry.enabled}
                          onChange={(e) => updatePromptEntry(entry.id, { enabled: e.target.checked })}
                          className="accent-amber-500"
                        />
                        <span className={`text-sm font-bold ${entry.enabled ? 'text-coffee-100' : 'text-coffee-500 line-through'}`}>
                          {entry.name}
                        </span>
                        {entry.marker && <span className="text-xs text-amber-400">[标记]</span>}
                        {entry.identifier && <span className="text-xs text-coffee-400">({entry.identifier})</span>}
                        {entry.injection_trigger && entry.injection_trigger.length > 0 && (
                          <span className="text-xs text-green-400" title={`触发词: ${entry.injection_trigger.join(', ')}`}>
                            📚 {entry.injection_trigger.length}个触发词
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveEntry(index, 'up')}
                          disabled={index === 0}
                          className="text-xs px-1 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveEntry(index, 'down')}
                          disabled={index === (formData.prompt_entries?.length || 0) - 1}
                          className="text-xs px-1 disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEntry(editingEntry?.id === entry.id ? null : entry)}
                          className="pixel-button px-2 py-0.5 text-xs"
                        >
                          {editingEntry?.id === entry.id ? '收起' : '编辑'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePromptEntry(entry.id)}
                          className="pixel-button px-2 py-0.5 text-xs bg-red-900/50"
                        >
                          删除
                        </button>
                      </div>
                    </div>

                    {editingEntry?.id === entry.id && (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) => updatePromptEntry(entry.id, { name: e.target.value })}
                          className="w-full pixel-border-inset p-2 bg-coffee-800 text-coffee-100 text-sm"
                          placeholder="条目名称"
                        />
                        <div className="flex gap-2">
                          <select
                            value={entry.role}
                            onChange={(e) => updatePromptEntry(entry.id, { role: e.target.value as any })}
                            className="flex-1 pixel-border-inset p-2 bg-coffee-800 text-coffee-100 text-sm"
                          >
                            <option value="system">system</option>
                            <option value="user">user</option>
                            <option value="assistant">assistant</option>
                          </select>
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={entry.system_prompt}
                              onChange={(e) => updatePromptEntry(entry.id, { system_prompt: e.target.checked })}
                              className="accent-amber-500"
                            />
                            系统提示
                          </label>
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={entry.marker}
                              onChange={(e) => updatePromptEntry(entry.id, { marker: e.target.checked })}
                              className="accent-amber-500"
                            />
                            标记
                          </label>
                        </div>
                        <input
                          type="text"
                          value={entry.identifier || ''}
                          onChange={(e) => updatePromptEntry(entry.id, { identifier: e.target.value })}
                          className="w-full pixel-border-inset p-2 bg-coffee-800 text-coffee-100 text-sm"
                          placeholder="标识符 (identifier)"
                        />
                        {/* World Book / Knowledge Book Trigger Keywords */}
                        <input
                          type="text"
                          value={entry.injection_trigger?.join(', ') || ''}
                          onChange={(e) => {
                            const keywords = e.target.value
                              .split(/[,，]/)
                              .map(k => k.trim())
                              .filter(Boolean);
                            updatePromptEntry(entry.id, {
                              injection_trigger: keywords.length > 0 ? keywords : undefined
                            });
                          }}
                          className="w-full pixel-border-inset p-2 bg-coffee-800 text-amber-400 text-sm"
                          placeholder="世界书触发关键词（用逗号分隔，如: 咖啡店, 老板娘）"
                        />
                        <textarea
                          value={entry.content}
                          onChange={(e) => updatePromptEntry(entry.id, { content: e.target.value })}
                          className="w-full pixel-border-inset p-2 bg-coffee-800 text-coffee-100 text-sm h-32 resize-none"
                          placeholder="提示词内容（触发时注入）..."
                        />
                      </div>
                    )}
                  </div>
                ))}

                {!formData.prompt_entries?.length && (
                  <p className="text-center text-coffee-400 text-sm py-4">
                    暂无提示词条目<br />
                    <span className="text-xs">点击上方按钮添加</span>
                  </p>
                )}
              </div>
            </div>

            {/* Preview */}
            {formData.prompt_entries && formData.prompt_entries.filter(e => e.enabled && !e.marker).length > 0 && (
              <div className="mt-4">
                <label className="block text-xs text-coffee-300 mb-2">最终系统提示词预览</label>
                <div className="p-3 bg-coffee-900/50 border border-coffee-700 text-xs text-coffee-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {formData.prompt_entries
                    .filter(e => e.enabled && !e.marker)
                    .sort((a, b) => a.position - b.position)
                    .map(e => e.content.trim())
                    .filter(Boolean)
                    .join('\n\n') || '(无内容)'}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2 p-4 border-t-2 border-coffee-700">
        <button type="submit" className="pixel-button flex-1 py-2 font-bold bg-amber-500 text-coffee-900">
          保存
        </button>
        <button type="button" onClick={onCancel} className="pixel-button flex-1 py-2">
          取消
        </button>
      </div>
    </form>
  );
}
