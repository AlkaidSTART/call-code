import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
  isChar: boolean;
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const mouse = { x: -9999, y: -9999, radius: 120 };

    const createTextParticles = () => {
      const offscreen = document.createElement('canvas');
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return [];

      offscreen.width = width;
      offscreen.height = height;

      const fontSize = Math.min(width / 7.5, 140);
      offCtx.font = `900 ${fontSize}px "SF Mono", Monaco, Consolas, monospace`;
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      offCtx.fillStyle = '#ffffff';
      offCtx.fillText('CALL CODE', width / 2, height / 2);

      const imageData = offCtx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const sampled: Particle[] = [];
      const step = Math.max(Math.floor(fontSize / 24), 4);

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const index = (y * width + x) * 4;
          if (data[index + 3] > 128) {
            sampled.push({
              x: Math.random() * width,
              y: Math.random() * height,
              originX: x,
              originY: y,
              vx: 0,
              vy: 0,
              size: Math.random() * 1.5 + 1.2,
              alpha: Math.random() * 0.4 + 0.35,
              baseAlpha: Math.random() * 0.4 + 0.35,
              isChar: true,
            });
          }
        }
      }
      return sampled;
    };

    const createAmbientParticles = (count: number): Particle[] => {
      const ambient: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        ambient.push({
          x,
          y,
          originX: x,
          originY: y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 1.2 + 0.6,
          alpha: Math.random() * 0.15 + 0.05,
          baseAlpha: Math.random() * 0.15 + 0.05,
          isChar: false,
        });
      }
      return ambient;
    };

    const init = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      const charParticles = createTextParticles();
      const ambientCount = Math.floor((width * height) / 18000);
      const ambientParticles = createAmbientParticles(ambientCount);
      particles = [...charParticles, ...ambientParticles];
    };

    init();

    const onResize = () => init();
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const isDark =
        document.documentElement.classList.contains('dark') ||
        document.documentElement.dataset.theme === 'dark';
      const particleRgb = isDark ? '255, 255, 255' : '15, 23, 42';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (p.isChar) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < mouse.radius) {
            const force = (1 - dist / mouse.radius) * 6;
            const angle = Math.atan2(dy, dx);
            p.vx -= Math.cos(angle) * force;
            p.vy -= Math.sin(angle) * force;
          }

          const homeDx = p.originX - p.x;
          const homeDy = p.originY - p.y;
          p.vx += homeDx * 0.04;
          p.vy += homeDy * 0.04;
          p.vx *= 0.85;
          p.vy *= 0.85;

          p.x += p.vx;
          p.y += p.vy;
        } else {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }

        ctx.fillStyle = `rgba(${particleRgb}, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="particle-canvas"
      aria-hidden="true"
    />
  );
}
