import React, { useEffect, useRef } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';

interface AutoScrollRowProps {
  children: React.ReactNode[];
  itemWidth: number;
  gap: number;
  paddingHorizontal?: number;
  speed?: number;
  visibleCount?: number;
}

export function AutoScrollRow({
  children,
  itemWidth,
  gap,
  paddingHorizontal = 12,
  speed = 0.4,
}: AutoScrollRowProps) {
  if (Platform.OS !== 'web') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.nativeRow, { paddingHorizontal, gap }]}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <WebAutoScrollRow
      items={[...children, ...children]}
      paddingHorizontal={paddingHorizontal}
      gap={gap}
      itemWidth={itemWidth}
    />
  );
}

function WebAutoScrollRow({
  items,
  paddingHorizontal,
  gap,
  itemWidth,
}: {
  items: React.ReactNode[];
  paddingHorizontal: number;
  gap: number;
  itemWidth: number;
}) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    function frame(ts: number) {
      if (!el) return;
      if (!pausedRef.current) {
        if (lastTimeRef.current !== null) {
          const delta = ts - lastTimeRef.current;
          el.scrollLeft += delta * 0.02;
        }
        lastTimeRef.current = ts;
        // seamless loop: reset when past halfway (one copy)
        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft = 0;
          lastTimeRef.current = null;
        }
      } else {
        lastTimeRef.current = null;
      }
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pause = () => { pausedRef.current = true; };
  const resume = () => { pausedRef.current = false; };

  return (
    <>
      {/* @ts-ignore */}
      <style>{`.asr::-webkit-scrollbar{display:none}`}</style>
      {/* @ts-ignore */}
      <div
        ref={divRef}
        className="asr"
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
        onPointerDown={pause}
        onPointerUp={resume}
        onPointerLeave={resume}
        style={{
          display: 'flex',
          flexDirection: 'row',
          overflowX: 'auto',
          overflowY: 'hidden',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          width: '100%',
          paddingLeft: paddingHorizontal,
          paddingBottom: 6,
          cursor: 'grab',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {items.map((child, i) => (
          // @ts-ignore
          <div
            key={i}
            style={{
              flexShrink: 0,
              width: itemWidth,
              marginRight: gap,
              display: 'inline-block',
            } as React.CSSProperties}
          >
            {child}
          </div>
        ))}
      </div>
    </>
  );
}

const styles = StyleSheet.create({
  nativeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 6,
  },
});
