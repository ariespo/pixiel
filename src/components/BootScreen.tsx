import { useState, useEffect } from 'react';

const bootSequence = [
  "BIOS Date 04/15/26 10:23:11 Ver 1.00",
  "CPU: Quantum Neural Processor v9.4",
  "Memory Test: 64000K OK",
  "Initializing Brain-Computer Interface...",
  "BCI Link: ESTABLISHED",
  "Loading OS...",
  "Starting Project 'Elysium'...",
  "Connecting to matching server...",
  "Match found: User #49201",
  "Launching application..."
];

export default function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < bootSequence.length) {
      const timer = setTimeout(() => {
        setLines(prev => [...prev, bootSequence[currentIndex]]);
        setCurrentIndex(prev => prev + 1);
      }, Math.random() * 300 + 100); // Random delay between 100ms and 400ms
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, onComplete]);

  return (
    <div className="absolute inset-0 bg-black text-amber-500 font-pixel p-8 flex flex-col z-10">
      <div className="relative z-10">
        {lines.map((line, i) => (
          <div key={i} className="mb-2 text-lg">{line}</div>
        ))}
        {currentIndex < bootSequence.length && (
          <div className="animate-pulse w-3 h-5 bg-amber-500 inline-block"></div>
        )}
      </div>
    </div>
  );
}
