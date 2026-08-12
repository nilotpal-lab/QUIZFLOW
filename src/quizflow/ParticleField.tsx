'use client';

import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Shape = 'cube' | 'triangle' | 'circle';
type Trigger = 'correct' | 'wrong' | 'streak' | null;

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  baseVx: number;
  baseVy: number;
  baseVz: number;
  color: string;
  shape: Shape;
  size: number;
  rotation: number;
  rotationSpeed: number;
}

interface TriggerState {
  type: Trigger;
  startTime: number;
}

export interface ParticleFieldProps {
  trigger?: Trigger;
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 60;
const FOCAL_LEN = 500;
const WRAP_LIMIT = 1200;
const COLORS: string[] = [
  '#a78bfa',
  '#f472b6',
  '#34d399',
  '#fbbf24',
  '#60a5fa',
  '#fb923c',
];
const SHAPES: Shape[] = ['cube', 'triangle', 'circle'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function wrap(value: number, limit: number): number {
  if (value > limit) return -limit;
  if (value < -limit) return limit;
  return value;
}

function createParticle(): Particle {
  const vx = rand(0.2, 0.5) * (Math.random() < 0.5 ? 1 : -1);
  const vy = rand(0.2, 0.5) * (Math.random() < 0.5 ? 1 : -1);
  const vz = rand(0.2, 0.5) * (Math.random() < 0.5 ? 1 : -1);
  return {
    x: rand(-1000, 1000),
    y: rand(-1000, 1000),
    z: rand(-1000, 1000),
    vx,
    vy,
    vz,
    baseVx: vx,
    baseVy: vy,
    baseVz: vz,
    color: randChoice(COLORS),
    shape: randChoice(SHAPES),
    size: rand(4, 12),
    rotation: rand(0, Math.PI * 2),
    rotationSpeed: rand(0.005, 0.03) * (Math.random() < 0.5 ? 1 : -1),
  };
}

// ---------------------------------------------------------------------------
// Drawing functions
// ---------------------------------------------------------------------------

function drawParticle(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  scale: number,
  p: Particle,
  overrideColor?: string,
  glowAmount?: number,
): void {
  const s = p.size * scale;
  const color = overrideColor ?? p.color;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(p.rotation);

  if (glowAmount && glowAmount > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glowAmount * scale * 8;
  }

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, scale * 1.5);

  if (p.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.shape === 'triangle') {
    const h = s * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(s, h * 0.5);
    ctx.lineTo(-s, h * 0.5);
    ctx.closePath();
    ctx.fill();
  } else {
    // 'cube' — rotated square outline
    ctx.beginPath();
    ctx.rect(-s, -s, s * 2, s * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParticleField({
  trigger = null,
  active = true,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const triggerRef = useRef<TriggerState | null>(null);
  const animFrameRef = useRef<number>(0);

  // Initialise particles once
  useEffect(() => {
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, createParticle);
  }, []);

  // Handle trigger changes
  useEffect(() => {
    if (!trigger) {
      triggerRef.current = null;
      return;
    }

    triggerRef.current = { type: trigger, startTime: performance.now() };

    const particles = particlesRef.current;

    if (trigger === 'correct') {
      // Burst: give all particles high outward velocity
      particles.forEach((p) => {
        const mag = rand(4, 10);
        const angle = rand(0, Math.PI * 2);
        const elevation = rand(-Math.PI / 2, Math.PI / 2);
        p.vx = Math.cos(elevation) * Math.cos(angle) * mag;
        p.vy = Math.cos(elevation) * Math.sin(angle) * mag;
        p.vz = Math.sin(elevation) * mag;
      });
    } else if (trigger === 'wrong') {
      // Shake + flash red — handled during render loop per frame
    } else if (trigger === 'streak') {
      // Spiral inward: velocities point toward centre
      particles.forEach((p) => {
        const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) || 1;
        const speed = rand(1, 3);
        p.vx = (-p.x / dist) * speed;
        p.vy = (-p.y / dist) * speed;
        p.vz = (-p.z / dist) * speed;
      });
    }
  }, [trigger]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = () => {
      if (!running) return;
      animFrameRef.current = requestAnimationFrame(tick);

      if (!active) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const now = performance.now();

      ctx.clearRect(0, 0, W, H);

      const ts = triggerRef.current;
      const elapsed = ts ? now - ts.startTime : Infinity;

      // Determine per-frame effect modifiers
      const isCorrectBurst = ts?.type === 'correct' && elapsed < 800;
      const isWrongShake = ts?.type === 'wrong' && elapsed < 400;
      const isStreak = ts?.type === 'streak' && elapsed < 1000;

      // After burst decays, restore base velocities
      if (ts?.type === 'correct' && elapsed >= 800 && elapsed < 900) {
        particlesRef.current.forEach((p) => {
          p.vx = p.baseVx;
          p.vy = p.baseVy;
          p.vz = p.baseVz;
        });
      }
      // After streak ends, restore base velocities
      if (ts?.type === 'streak' && elapsed >= 1000 && elapsed < 1100) {
        particlesRef.current.forEach((p) => {
          p.vx = p.baseVx;
          p.vy = p.baseVy;
          p.vz = p.baseVz;
        });
      }

      // Clear trigger state when fully done
      if (ts) {
        const duration =
          ts.type === 'correct' ? 800 : ts.type === 'wrong' ? 400 : 1000;
        if (elapsed > duration + 200) {
          triggerRef.current = null;
        }
      }

      const particles = particlesRef.current;

      particles.forEach((p) => {
        // Apply velocities
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Wrong shake jitter
        if (isWrongShake) {
          p.x += rand(-3, 3);
          p.y += rand(-3, 3);
        }

        // Correct burst: velocity decays toward base
        if (isCorrectBurst) {
          const decayFactor = Math.max(0, 1 - elapsed / 800);
          p.vx = p.baseVx + (p.vx - p.baseVx) * decayFactor;
          p.vy = p.baseVy + (p.vy - p.baseVy) * decayFactor;
          p.vz = p.baseVz + (p.vz - p.baseVz) * decayFactor;
        }

        // Wrap around
        p.x = wrap(p.x, WRAP_LIMIT);
        p.y = wrap(p.y, WRAP_LIMIT);
        p.z = wrap(p.z, WRAP_LIMIT);

        // Rotate
        p.rotation += p.rotationSpeed;

        // Perspective projection
        const denom = p.z + FOCAL_LEN;
        if (denom <= 0) return; // behind camera — skip

        const projScale = FOCAL_LEN / denom;
        const sx = cx + p.x * projScale;
        const sy = cy + p.y * projScale;

        // Depth-based opacity: farther (larger z) = more transparent
        const depthT = Math.min(1, Math.max(0, (p.z + 1000) / 2000));
        const opacity = 0.15 + depthT * 0.85;

        ctx.globalAlpha = opacity;

        // Determine color and glow overrides
        let overrideColor: string | undefined;
        let glowAmount = 0;

        if (isWrongShake) {
          overrideColor = '#ef4444';
        } else if (isStreak) {
          glowAmount = Math.max(0, 1 - elapsed / 1000);
        }

        drawParticle(ctx, sx, sy, projScale, p, overrideColor, glowAmount);
      });

      ctx.globalAlpha = 1;
    };

    tick();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
    />
  );
}
