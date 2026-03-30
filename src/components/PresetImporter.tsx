import React, { useState, useCallback } from 'react';
import { motion } from 'motion/react';

interface Props {
  onImport: (file: File) => Promise<any>;
  onClose: () => void;
}

export default function PresetImporter({ onImport, onClose }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = async (files: File[]) => {
    setIsLoading(true);

    try {
      for (const file of files) {
        await onImport(file);
      }
      setSuccess(`成功导入 ${files.length} 个预设`);
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setError(err.message || '导入失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    setSuccess(null);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter((f: File) =>
      f.name.endsWith('.json') ||
      f.name.endsWith('.yaml') ||
      f.name.endsWith('.yml')
    );

    if (validFiles.length === 0) {
      setError('请上传 JSON 或 YAML 格式的预设文件');
      return;
    }

    await processFiles(validFiles as File[]);
  }, [onImport, onClose]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setSuccess(null);
    await processFiles(Array.from(files) as File[]);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="pixel-border w-full max-w-md bg-coffee-100 flex flex-col"
      >
        {/* Header */}
        <div className="bg-coffee-800 text-coffee-100 px-4 py-2 flex justify-between items-center">
          <span className="font-bold">导入 SillyTavern 预设</span>
          <button onClick={onClose} className="hover:text-amber-400">✕</button>
        </div>

        <div className="p-6">
          <p className="text-sm text-coffee-700 mb-4">
            支持 SillyTavern 格式的对话补全预设：
          </p>
          <ul className="text-xs text-coffee-600 mb-6 space-y-1">
            <li>• JSON 格式（从 SillyTavern 导出的 Chat Completion 预设）</li>
            <li>• YAML 格式</li>
            <li>• 包含 OpenAI API 参数（Temperature, Top P, Presence/Frequency Penalty 等）</li>
            <li>• 支持提示词条目系统（多个可开关的提示词模块）</li>
            <li>• 兼容 SillyTavern 的 Prompt Manager 格式</li>
          </ul>

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-4 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? 'border-amber-500 bg-amber-100'
                : 'border-coffee-400 bg-coffee-50'
            }`}
          >
            <div className="text-4xl mb-2">⚙️</div>
            <p className="text-sm text-coffee-700 mb-2">
              拖放文件到此处，或
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json,.yaml,.yml"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="pixel-button px-4 py-2 text-sm inline-block">
                选择文件
              </span>
            </label>
          </div>

          {/* Status */}
          {isLoading && (
            <div className="mt-4 text-center text-coffee-700">
              <span className="animate-pulse">导入中...</span>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-200 text-red-900 text-sm pixel-border-inset">
              ❌ {error}
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-green-200 text-green-900 text-sm pixel-border-inset">
              ✅ {success}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
