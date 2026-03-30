import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTypewriterOptions {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export function useTypewriter({ text, speed = 30, onComplete }: UseTypewriterOptions) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const speedRef = useRef(speed);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    setDisplayText('');
    setIsComplete(false);
    setIsTyping(true);

    let currentIndex = 0;
    const chars = text.split('');
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const typeNextChar = () => {
      if (currentIndex < chars.length) {
        setDisplayText(text.slice(0, currentIndex + 1));
        currentIndex++;

        const char = chars[currentIndex - 1];
        let delay = speedRef.current;
        if (char === '\n') {
          delay = speedRef.current * 3;
        } else if (['，', '。', '；', '：', '！', '？', ',', '.', ';', ':', '!', '?'].includes(char)) {
          delay = speedRef.current * 2;
        }

        timeoutId = setTimeout(typeNextChar, delay);
      } else {
        setIsComplete(true);
        setIsTyping(false);
        onCompleteRef.current?.();
      }
    };

    timeoutId = setTimeout(typeNextChar, 300);
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [text]);

  const skip = useCallback(() => {
    setDisplayText(text);
    setIsComplete(true);
    setIsTyping(false);
    onCompleteRef.current?.();
  }, [text]);

  return { displayText, isComplete, isTyping, skip };
}
