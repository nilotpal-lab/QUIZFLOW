'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  CSSProperties,
} from 'react';

// ---------------------------------------------------------------------------
// useScreenShake
// ---------------------------------------------------------------------------

interface UseScreenShakeReturn {
  shakeStyle: CSSProperties;
  triggerShake: (intensity?: number) => void;
}

export function useScreenShake(): UseScreenShakeReturn {
  const [shakeStyle, setShakeStyle] = useState<CSSProperties>({
    transform: 'none',
  });

  const triggerShake = useCallback((intensity: number = 6) => {
    let frame = 0;
    const totalFrames = 8;

    const step = () => {
      if (frame < totalFrames) {
        const x = (Math.random() * 2 - 1) * intensity;
        const y = (Math.random() * 2 - 1) * intensity;
        setShakeStyle({ transform: `translate(${x}px, ${y}px)` });
        frame++;
        setTimeout(() => requestAnimationFrame(step), 16);
      } else {
        setShakeStyle({ transform: 'none' });
      }
    };

    requestAnimationFrame(step);
  }, []);

  return { shakeStyle, triggerShake };
}

// ---------------------------------------------------------------------------
// DamageParticles
// ---------------------------------------------------------------------------

interface DamageParticlesProps {
  count: number;
  color?: 'damage' | 'heal' | string;
  onDone?: () => void;
}

function getParticleColors(color?: string): string[] {
  if (color === 'heal') {
    return ['#2ecc71', '#1abc9c', '#a8f0c6', '#55efc4', '#00b894'];
  }
  // default: 'damage' or any other value
  return ['#7b0000', '#c0392b', '#e74c3c', '#e67e22', '#f39c12'];
}

const PARTICLE_STYLE_ID = 'boss-vfx-particle-keyframes';

function ensureParticleKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PARTICLE_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = PARTICLE_STYLE_ID;
  style.textContent = `
    @keyframes bossParticleFall {
      0% {
        transform: translateY(0) rotate(0deg);
        opacity: 1;
      }
      80% {
        opacity: 0.8;
      }
      100% {
        transform: translateY(80vh) rotate(var(--particle-rot, 360deg));
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

export function DamageParticles({
  count,
  color,
  onDone,
}: DamageParticlesProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    ensureParticleKeyframes();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!visible) return null;

  const colors = getParticleColors(color);

  const particles = Array.from({ length: count }, (_, i) => {
    const left = Math.random() * 100;
    const size = 6 + Math.random() * 8; // 6–14 px
    const duration = 0.8 + Math.random() * 0.4; // 0.8–1.2 s
    const rotation = Math.floor(Math.random() * 720) - 360;
    const particleColor = colors[Math.floor(Math.random() * colors.length)];
    const delay = Math.random() * 0.2;

    return (
      <div
        key={i}
        style={{
          position: 'fixed',
          left: `${left}vw`,
          top: '20%',
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: particleColor,
          // @ts-expect-error CSS custom property
          '--particle-rot': `${rotation}deg`,
          animation: `bossParticleFall ${duration}s ${delay}s ease-in forwards`,
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      />
    );
  });

  return <>{particles}</>;
}

// ---------------------------------------------------------------------------
// BossHealthBar
// ---------------------------------------------------------------------------

interface BossHealthBarProps {
  health: number;
  maxHealth: number;
  isFlashing?: boolean;
}

const FLASH_STYLE_ID = 'boss-vfx-flash-keyframes';

function ensureFlashKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(FLASH_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = FLASH_STYLE_ID;
  style.textContent = `
    @keyframes bossFlash {
      0%   { opacity: 1; }
      33%  { opacity: 0.3; }
      66%  { opacity: 1; }
      83%  { opacity: 0.3; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

function getBarColor(ratio: number): string {
  if (ratio > 0.6) return '#27ae60';
  if (ratio > 0.3) return '#f1c40f';
  return '#e74c3c';
}

export function BossHealthBar({
  health,
  maxHealth,
  isFlashing = false,
}: BossHealthBarProps) {
  useEffect(() => {
    ensureFlashKeyframes();
  }, []);

  const ratio = Math.max(0, Math.min(1, health / maxHealth));
  const fillPercent = ratio * 100;
  const barColor = getBarColor(ratio);

  const fillStyle: CSSProperties = {
    width: `${fillPercent}%`,
    height: '100%',
    backgroundColor: barColor,
    transition: 'width 0.4s ease, background-color 0.4s ease',
    position: 'relative',
    ...(isFlashing
      ? { animation: 'bossFlash 0.15s ease-in-out 3' }
      : {}),
  };

  return (
    <div
      style={{
        position: 'relative',
        border: '2px solid #10100F',
        borderRadius: 8,
        overflow: 'hidden',
        height: 20,
        boxShadow: '3px 3px 0 #10100F',
        backgroundColor: '#2d2d2d',
      }}
    >
      <div style={fillStyle} />

      {/* HP text overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 800,
          fontSize: 11,
          color: '#ffffff',
          textShadow: '1px 1px 0 #10100F',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {health} / {maxHealth}
      </div>
    </div>
  );
}
