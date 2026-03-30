import { useState } from 'react';
import { motion } from 'motion/react';
import { useSettings, type Font } from '../contexts/SettingsContext';
import { GoogleGenAI } from '@google/genai';

interface SettingsModalProps {
  onClose: () => void;
  onReset?: () => Promise<void>;
}

export default function SettingsModal({ onClose, onReset }: SettingsModalProps) {
  const { 
    theme, setTheme, 
    font, setFont, 
    fontSize, setFontSize,
    apiUrl, setApiUrl,
    apiKey, setApiKey,
    model, setModel
  } = useSettings();

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-preview',
    'gpt-3.5-turbo',
    'gpt-4o',
    'claude-3-5-sonnet-20240620',
    'deepseek-chat'
  ]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchModels = async () => {
    if (!apiUrl) return;
    setIsLoadingModels(true);
    setModelsError('');
    try {
      let url = apiUrl.trim();
      if (url.endsWith('/chat/completions')) {
        url = url.replace('/chat/completions', '/models');
      } else if (url.endsWith('/')) {
        url = `${url}models`;
      } else {
        url = `${url}/models`;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          const models = data.data.map((m: any) => m.id);
          setAvailableModels(models);
          if (models.length > 0 && !models.includes(model)) {
            setModel(models[0]);
          }
        } else {
          setModelsError('接收到的模型格式无效');
        }
      } else {
        setModelsError(`错误 ${res.status}: 获取模型失败`);
      }
    } catch (e: any) {
      setModelsError(`失败: ${e.message}`);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleReset = async () => {
    if (!onReset) return;
    setIsResetting(true);
    try {
      await onReset();
      setShowResetConfirm(false);
      onClose();
    } catch (e) {
      console.error('Reset failed:', e);
    } finally {
      setIsResetting(false);
    }
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    try {
      if (!apiUrl) {
        // Test default Gemini API
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const chat = ai.chats.create({ model: 'gemini-3.1-pro-preview' });
          await chat.sendMessage({ message: 'hi' });
          setTestResult({ success: true, message: '默认 Gemini API 连接成功！' });
        } catch (e: any) {
          setTestResult({ success: false, message: `默认 API 失败: ${e.message}` });
        }
        setIsTesting(false);
        return;
      }

      // Test custom API
      let url = apiUrl.trim();
      if (!url.endsWith('/chat/completions')) {
        url = url.endsWith('/') ? `${url}chat/completions` : `${url}/chat/completions`;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        setTestResult({ success: true, message: '连接成功！' });
      } else {
        const err = await res.text();
        setTestResult({ success: false, message: `错误 ${res.status}: ${err.substring(0, 100)}...` });
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setTestResult({ success: false, message: '请求超时 (10秒)。' });
      } else {
        setTestResult({ success: false, message: `失败: ${e.message}` });
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="pixel-border w-full max-w-md bg-coffee-100 flex flex-col max-h-full"
      >
        <div className="bg-coffee-800 text-coffee-100 px-2 py-1 text-sm flex justify-between items-center shrink-0">
          <span>联结.exe</span>
          <button onClick={onClose} className="hover:text-amber-400">X</button>
        </div>
        
        <div className="p-6 space-y-6 text-coffee-900 overflow-y-auto">
          {/* Theme Settings */}
          <div className="space-y-2">
            <h3 className="font-bold border-b-2 border-coffee-800 pb-1">主题颜色</h3>
            <div className="flex gap-2">
              <button onClick={() => setTheme('coffee')} className={`pixel-button px-3 py-1 text-sm ${theme === 'coffee' ? 'bg-amber-400' : ''}`}>咖啡</button>
              <button onClick={() => setTheme('cyberpunk')} className={`pixel-button px-3 py-1 text-sm ${theme === 'cyberpunk' ? 'bg-amber-400' : ''}`}>赛博朋克</button>
              <button onClick={() => setTheme('retro')} className={`pixel-button px-3 py-1 text-sm ${theme === 'retro' ? 'bg-amber-400' : ''}`}>复古</button>
            </div>
          </div>

          {/* Font Settings */}
          <div className="space-y-2">
            <h3 className="font-bold border-b-2 border-coffee-800 pb-1">字体</h3>
            <div className="space-y-2">
              <p className="text-xs text-coffee-600">中文像素字体</p>
              <div className="flex flex-col gap-2">
                {[
                  { key: 'MyMaruMonica', label: '莫妮卡圆像素' },
                  { key: 'UranusPixel', label: '天王星像素' },
                  { key: 'BoutiqueBitmap', label: '精品点阵体' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFont(key as Font)}
                    className={`pixel-button px-3 py-1 text-sm text-left ${font === key ? 'bg-amber-400' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-coffee-600 mt-2">英文字体</p>
              <div className="flex flex-col gap-2">
                {[
                  { key: 'DotGothic16', label: 'DotGothic16' },
                  { key: 'VT323', label: 'VT323' },
                  { key: 'PressStart2P', label: 'Press Start 2P' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFont(key as Font)}
                    className={`pixel-button px-3 py-1 text-sm text-left ${font === key ? 'bg-amber-400' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Font Size Settings */}
          <div className="space-y-2">
            <h3 className="font-bold border-b-2 border-coffee-800 pb-1">字体大小</h3>
            <div className="flex gap-2">
              <button onClick={() => setFontSize('small')} className={`pixel-button px-3 py-1 text-sm ${fontSize === 'small' ? 'bg-amber-400' : ''}`}>小</button>
              <button onClick={() => setFontSize('medium')} className={`pixel-button px-3 py-1 text-sm ${fontSize === 'medium' ? 'bg-amber-400' : ''}`}>中</button>
              <button onClick={() => setFontSize('large')} className={`pixel-button px-3 py-1 text-sm ${fontSize === 'large' ? 'bg-amber-400' : ''}`}>大</button>
            </div>
          </div>

          {/* API Settings */}
          <div className="space-y-3">
            <h3 className="font-bold border-b-2 border-coffee-800 pb-1">API 配置</h3>
            
            <div className="space-y-1">
              <label className="text-xs font-bold">API 地址 (留空则使用默认)</label>
              <input 
                type="text" 
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full pixel-border-inset p-2 text-sm bg-coffee-50 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold">API 密钥</label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full pixel-border-inset p-2 text-sm bg-coffee-50 outline-none"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold">模型</label>
                {apiUrl && (
                  <button
                    onClick={fetchModels}
                    disabled={isLoadingModels}
                    className="text-xs text-amber-700 hover:text-amber-600 disabled:opacity-50"
                  >
                    {isLoadingModels ? '加载中...' : '↻ 获取模型列表'}
                  </button>
                )}
              </div>
              <input 
                type="text"
                list="available-models"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="例如: gpt-4o"
                className="w-full pixel-border-inset p-2 text-sm bg-coffee-50 outline-none"
              />
              <datalist id="available-models">
                {availableModels.map(m => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {modelsError && <div className="text-[10px] text-red-600">{modelsError}</div>}
            </div>

            <button 
              onClick={handleTestConnection}
              disabled={isTesting}
              className="pixel-button px-4 py-2 text-sm w-full font-bold"
            >
              {isTesting ? '测试中...' : '测试连接'}
            </button>
            {testResult && (
              <div className={`text-xs p-2 pixel-border-inset ${testResult.success ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'}`}>
                {testResult.message}
              </div>
            )}
          </div>

          {/* Reset Section */}
          <div className="space-y-3 pt-4 border-t-2 border-coffee-800">
            <h3 className="font-bold border-b-2 border-coffee-800 pb-1 text-red-700">危险区域</h3>
            <p className="text-xs text-coffee-600">
              这将删除所有历史消息并开始全新的对话。此操作不可撤销。
            </p>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="pixel-button px-4 py-2 text-sm w-full font-bold bg-red-200 hover:bg-red-300 text-red-900"
            >
              让一切重新开始
            </button>
          </div>
        </div>

        <div className="p-4 border-t-4 border-coffee-800 flex justify-end shrink-0">
          <button onClick={onClose} className="pixel-button px-6 py-2 font-bold">
            确定
          </button>
        </div>

        {/* Reset Confirmation Dialog */}
        {showResetConfirm && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="pixel-border w-full max-w-sm bg-coffee-100 p-6 space-y-4"
            >
              <h3 className="font-bold text-lg text-red-700">⚠️ 确认重置</h3>
              <p className="text-sm text-coffee-900">
                你确定要<span className="font-bold text-red-700">让一切重新开始</span>吗？
              </p>
              <p className="text-xs text-coffee-600">
                这将永久删除所有历史消息和对话记录。夏目会忘记你们之间的一切。此操作<span className="font-bold text-red-700">不可撤销</span>。
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  className="pixel-button px-4 py-2 text-sm flex-1"
                >
                  取消
                </button>
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="pixel-button px-4 py-2 text-sm flex-1 bg-red-200 hover:bg-red-300 text-red-900 disabled:opacity-50"
                >
                  {isResetting ? '重置中...' : '确认重置'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
