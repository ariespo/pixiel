import { useState } from 'react';
import { motion } from 'motion/react';

export type UserProfile = {
  nickname: string;
  signature: string;
  avatar: string; // emoji or short string
};

type ProfileModalProps = {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  onClose: () => void;
};

const AVATAR_OPTIONS = ['👤', '🐱', '🐶', '🦊', '🤖', '👾', '🌟', '🍀'];

export default function ProfileModal({ profile, onSave, onClose }: ProfileModalProps) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [signature, setSignature] = useState(profile.signature);
  const [avatar, setAvatar] = useState(profile.avatar);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100]">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="pixel-border w-full max-w-md bg-coffee-100 flex flex-col"
      >
        <div className="bg-coffee-800 text-coffee-100 p-3 font-bold flex justify-between items-center">
          <span>个人资料编辑 / Edit Profile</span>
          <button onClick={onClose} className="hover:text-amber-500">X</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar Selection */}
          <div>
            <label className="block text-sm font-bold mb-2 text-coffee-800">选择头像 / Avatar</label>
            <div className="flex flex-wrap gap-3">
              {AVATAR_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setAvatar(opt)}
                  className={`w-12 h-12 pixel-border flex items-center justify-center text-2xl transition-all active:translate-y-[2px] ${
                    avatar === opt ? 'bg-amber-500 border-coffee-900 scale-110' : 'bg-coffee-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-sm font-bold mb-2 text-coffee-800">昵称 / Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full pixel-border-inset p-3 bg-coffee-50 outline-none text-coffee-900"
            />
          </div>

          {/* Signature */}
          <div>
            <label className="block text-sm font-bold mb-2 text-coffee-800">个性签名 / Signature</label>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full pixel-border-inset p-3 bg-coffee-50 outline-none text-coffee-900 h-24 resize-none"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={onClose}
              className="flex-1 pixel-button bg-coffee-300 py-3 font-bold"
            >
              取消
            </button>
            <button 
              onClick={() => onSave({ nickname, signature, avatar })}
              className="flex-1 pixel-button bg-amber-500 py-3 font-bold"
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
