import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { UserProfile } from './ProfileModal';

type Comment = {
  id: string;
  author: string;
  text: string;
  timestamp: string;
};

type Post = {
  id: string;
  author: string;
  avatar: string;
  text: string;
  image?: string;
  timestamp: string;
  comments: Comment[];
  mid?: number; // System ID for command matching
};

interface MomentsPanelProps {
  userProfile: UserProfile;
  onBack: () => void;
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  onNotifyLLM?: (type: 'new_post' | 'comment', data: { mid?: number; cid?: number; content: string; author: string }) => void;
}

export default function MomentsPanel({ userProfile, onBack, posts, setPosts, onNotifyLLM }: MomentsPanelProps) {
  const [newPostText, setNewPostText] = useState('');
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});

  const getFormattedTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const handlePublish = () => {
    if (!newPostText.trim()) return;
    const newPost: Post = {
      id: Date.now().toString(),
      mid: Date.now(),
      author: userProfile.nickname,
      avatar: userProfile.avatar,
      text: newPostText,
      timestamp: getFormattedTime(),
      comments: []
    };
    setPosts([newPost, ...posts]);

    // Notify LLM about new post
    onNotifyLLM?.('new_post', {
      mid: newPost.mid,
      content: newPostText,
      author: userProfile.nickname
    });

    setNewPostText('');
  };

  const handleComment = (postId: string) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    // Find the post to get its mid
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      author: userProfile.nickname,
      text: text,
      timestamp: getFormattedTime()
    };

    setPosts(posts.map(p =>
      p.id === postId
        ? { ...p, comments: [...p.comments, newComment] }
        : p
    ));

    // Notify LLM about comment
    onNotifyLLM?.('comment', {
      mid: post.mid,
      cid: parseInt(newComment.id),
      content: text,
      author: userProfile.nickname
    });

    setCommentInputs({ ...commentInputs, [postId]: '' });
  };

  return (
    <div className="h-full bg-coffee-100 text-coffee-900 flex flex-col overflow-hidden">
      <div className="bg-coffee-800 text-coffee-100 p-3 font-bold border-b-4 border-coffee-900 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="pixel-button px-2 py-1 text-xs flex items-center gap-1">
            <span>◀</span> 返回
          </button>
          <span>朋友圈 / Moments</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Publish Section */}
        <div className="pixel-border-inset p-3 bg-coffee-50">
          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="分享你的心情..."
            className="w-full bg-transparent outline-none resize-none h-20 text-sm"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handlePublish}
              className="pixel-button px-4 py-1 text-xs"
            >
              发布
            </button>
          </div>
        </div>

        {/* Posts List */}
        <AnimatePresence initial={false}>
          {posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-b-2 border-coffee-300 pb-4"
            >
              <div className="flex gap-3 mb-2">
                <div className="w-10 h-10 pixel-border bg-coffee-300 flex items-center justify-center shrink-0 text-xl">
                  {post.avatar}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-coffee-800">{post.author}</div>
                  <div className="text-sm mt-1 leading-relaxed">{post.text}</div>

                  {post.image && (
                    <div className="mt-2 pixel-border overflow-hidden">
                      <img
                        src={post.image}
                        alt="post"
                        className="w-full h-auto pixelated"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <div className="text-[10px] text-coffee-500 mt-2">{post.timestamp}</div>

                  {/* Comments Section */}
                  <div className="mt-3 bg-coffee-200/50 p-2 space-y-2">
                    {post.comments.map(comment => (
                      <div key={comment.id} className="text-xs">
                        <span className="font-bold text-coffee-700">{comment.author}: </span>
                        <span>{comment.text}</span>
                      </div>
                    ))}

                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={commentInputs[post.id] || ''}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id)}
                        placeholder="评论..."
                        className="flex-1 bg-coffee-50 border-2 border-coffee-300 px-2 py-1 text-xs outline-none"
                      />
                      <button
                        onClick={() => handleComment(post.id)}
                        className="pixel-button px-2 py-0 text-[10px]"
                      >
                        发送
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
