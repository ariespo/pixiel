import { useState } from 'react';
import { motion } from 'motion/react';

export type PlayerIdentity = '社畜' | '在校学生';
export type PlayerGender = '男' | '女' | '保密';

export interface PlayerSetup {
  nickname: string;
  gender: PlayerGender;
  identity: PlayerIdentity;
}

interface SetupWizardProps {
  onComplete: (setup: PlayerSetup) => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [setup, setSetup] = useState<PlayerSetup>({
    nickname: '',
    gender: '保密',
    identity: '社畜'
  });

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete(setup);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return setup.nickname.trim().length >= 2 && setup.nickname.trim().length <= 12;
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-coffee-900 flex items-center justify-center z-50">
      {/* CRT Effect */}
      <div className="scanlines absolute inset-0 pointer-events-none"></div>
      <div className="crt-flicker absolute inset-0 pointer-events-none"></div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="pixel-border w-full max-w-md bg-coffee-100 mx-4"
      >
        {/* Header */}
        <div className="bg-coffee-800 text-coffee-100 p-4 border-b-4 border-coffee-900">
          <h1 className="text-xl font-bold">联结.exe</h1>
          <p className="text-xs text-coffee-300 mt-1">初次启动 - 用户设置</p>
        </div>

        {/* Progress */}
        <div className="flex p-4 gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 ${
                s <= step ? 'bg-amber-400' : 'bg-coffee-300'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="p-6 min-h-[200px]">
          {step === 1 && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-bold text-coffee-800">第一步：设置昵称</h2>
              <p className="text-sm text-coffee-600">
                在这个终端里，你会被称作什么？
              </p>
              <input
                type="text"
                value={setup.nickname}
                onChange={(e) => setSetup({ ...setup, nickname: e.target.value })}
                placeholder="输入2-12个字符"
                maxLength={12}
                className="w-full pixel-border-inset p-3 bg-coffee-50 outline-none text-coffee-900"
              />
              <p className="text-xs text-coffee-500">
                {setup.nickname.length}/12 字符
              </p>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-bold text-coffee-800">第二步：选择性别</h2>
              <p className="text-sm text-coffee-600">
                这会影响到部分对话内容。
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(['男', '女', '保密'] as PlayerGender[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setSetup({ ...setup, gender: g })}
                    className={`py-3 border-2 transition-all ${
                      setup.gender === g
                        ? 'bg-amber-400 border-amber-500 text-coffee-900 font-bold shadow-inner'
                        : 'bg-coffee-700 border-coffee-600 text-coffee-200 hover:bg-coffee-600'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      {setup.gender === g && <span className="text-sm">✓</span>}
                      {g}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-bold text-coffee-800">第三步：选择身份</h2>
              <p className="text-sm text-coffee-600">
                你目前的生活状态是？
              </p>
              <div className="space-y-2">
                {(['社畜', '在校学生'] as PlayerIdentity[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => setSetup({ ...setup, identity: id })}
                    className={`w-full py-3 text-left px-4 border-2 transition-all ${
                      setup.identity === id
                        ? 'bg-amber-400 border-amber-500 text-coffee-900 shadow-inner'
                        : 'bg-coffee-700 border-coffee-600 text-coffee-200 hover:bg-coffee-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {setup.identity === id && <span className="text-sm font-bold">✓</span>}
                      <span className="font-bold">{id}</span>
                    </div>
                    <div className={`text-xs mt-1 ${setup.identity === id ? 'text-coffee-700' : 'text-coffee-400'}`}>
                      {id === '社畜' ? '每天忙于工作，生活规律但有些疲惫' : '正在求学，时间相对自由但经济拮据'}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-4 border-coffee-800 flex justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="pixel-button px-4 py-2"
            >
              返回
            </button>
          ) : (
            <div></div>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="pixel-button px-6 py-2 font-bold disabled:opacity-50"
          >
            {step === 3 ? '完成' : '下一步'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
