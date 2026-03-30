import { useState, useEffect } from 'react';

// 在线时间: 8:00 ~ 23:30
export function isNatsumeOnline(): boolean {
  const now = new Date();
  const total = now.getHours() * 60 + now.getMinutes();
  return total >= 8 * 60 && total < 23 * 60 + 30;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(isNatsumeOnline);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsOnline(isNatsumeOnline());
    }, 30_000); // 每30秒检查一次
    return () => clearInterval(timer);
  }, []);

  return isOnline;
}
