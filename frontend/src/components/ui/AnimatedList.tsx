import React, { useRef, useState, useEffect, useCallback, type ReactNode, type MouseEventHandler, type UIEvent } from 'react';
import { motion, useInView } from 'motion/react';

interface AnimatedItemProps {
  children: ReactNode;
  delay?: number;
  index: number;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

const AnimatedItem: React.FC<AnimatedItemProps> = ({
  children, delay = 0, index, onMouseEnter, onClick,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5, once: false });
  return (
    <motion.div
      ref={ref}
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={{ duration: 0.2, delay }}
      className="mb-2 cursor-pointer"
    >
      {children}
    </motion.div>
  );
};

interface AnimatedListProps {
  items?: string[];
  onItemSelect?: (item: string, index: number) => void;
  showGradients?: boolean;
  enableArrowNavigation?: boolean;
  className?: string;
  itemClassName?: string;
  displayScrollbar?: boolean;
  initialSelectedIndex?: number;
}

const AnimatedList: React.FC<AnimatedListProps> = ({
  items = [],
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  className = '',
  itemClassName = '',
  displayScrollbar = true,
  initialSelectedIndex = -1,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [topGradientOpacity, setTopGradientOpacity] = useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1);

  const handleItemMouseEnter = useCallback((i: number) => setSelectedIndex(i), []);

  const handleItemClick = useCallback(
    (item: string, i: number) => { setSelectedIndex(i); onItemSelect?.(item, i); },
    [onItemSelect],
  );

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const t = e.target as HTMLDivElement;
    setTopGradientOpacity(Math.min(t.scrollTop / 50, 1));
    const bd = t.scrollHeight - (t.scrollTop + t.clientHeight);
    setBottomGradientOpacity(t.scrollHeight <= t.clientHeight ? 0 : Math.min(bd / 50, 1));
  };

  useEffect(() => {
    if (!enableArrowNavigation) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault(); setKeyboardNav(true);
        setSelectedIndex(p => Math.min(p + 1, items.length - 1));
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault(); setKeyboardNav(true);
        setSelectedIndex(p => Math.max(p - 1, 0));
      } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < items.length) {
        e.preventDefault(); onItemSelect?.(items[selectedIndex], selectedIndex);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [items, selectedIndex, onItemSelect, enableArrowNavigation]);

  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
    if (el) {
      const m = 50;
      const st = listRef.current.scrollTop;
      const ch = listRef.current.clientHeight;
      if (el.offsetTop < st + m) listRef.current.scrollTo({ top: el.offsetTop - m, behavior: 'smooth' });
      else if (el.offsetTop + el.offsetHeight > st + ch - m)
        listRef.current.scrollTo({ top: el.offsetTop + el.offsetHeight - ch + m, behavior: 'smooth' });
    }
    setKeyboardNav(false);
  }, [selectedIndex, keyboardNav]);

  return (
    <div className={`relative w-full ${className}`}>
      <div
        ref={listRef}
        className={`max-h-[500px] overflow-y-auto p-2 ${
          displayScrollbar
            ? '[&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full'
            : 'scrollbar-hide'
        }`}
        onScroll={handleScroll}
        style={{ scrollbarWidth: displayScrollbar ? 'thin' : 'none' }}
      >
        {items.map((item, i) => (
          <AnimatedItem key={i} delay={0.05} index={i}
            onMouseEnter={() => handleItemMouseEnter(i)}
            onClick={() => handleItemClick(item, i)}
          >
            <div className={`p-4 rounded-xl border border-border/40 transition-colors ${
              selectedIndex === i ? 'bg-accent/50 border-primary/30' : 'bg-card hover:bg-muted/50'
            } ${itemClassName}`}>
              <p className="text-foreground text-sm m-0">{item}</p>
            </div>
          </AnimatedItem>
        ))}
      </div>
      {showGradients && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[50px] bg-gradient-to-b from-background to-transparent pointer-events-none transition-opacity duration-300" style={{ opacity: topGradientOpacity }} />
          <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-gradient-to-t from-background to-transparent pointer-events-none transition-opacity duration-300" style={{ opacity: bottomGradientOpacity }} />
        </>
      )}
    </div>
  );
};

export default AnimatedList;
