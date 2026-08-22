import React, { useEffect, useRef } from 'react';
import './CursorTrail.css';

export default function CursorTrail() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // 3D Particle Settings for MASSIVE Antigravity Background Sphere
    const NUM_PARTICLES = 800; // Lots of particles
    const particles = [];
    
    // Colors exactly matching the Antigravity branding (Blue, Red, Purple)
    const colors = ['#2563eb', '#ef4444', '#a855f7', '#60a5fa', '#3b82f6'];

    // Distribute particles evenly on a sphere using the Fibonacci sphere algorithm
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const phi = Math.acos(-1 + (2 * i) / NUM_PARTICLES);
      const theta = Math.sqrt(NUM_PARTICLES * Math.PI) * phi;
      
      // Store normalized coordinates
      particles.push({
        baseX: Math.cos(theta) * Math.sin(phi),
        baseY: Math.sin(theta) * Math.sin(phi),
        baseZ: Math.cos(phi),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 1.5 + 0.8,
      });
    }

    let targetMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let currentMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const onMouseMove = (e) => {
      targetMouse.x = e.clientX;
      targetMouse.y = e.clientY;
    };
    window.addEventListener('mousemove', onMouseMove);

    let angleX = 0;
    let angleY = 0;

    const draw = () => {
      // Dynamic radius based on screen size so it fills the screen
      const SPHERE_RADIUS = Math.max(window.innerWidth, window.innerHeight) * 0.6;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Smooth mouse interpolation (easing) for buttery smooth rotation
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.05;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.05;

      // Base auto-rotation + mouse-influenced rotation mapped to full screen
      angleX += 0.0005;
      angleY += 0.001;
      
      // Calculate rotation based on cursor position relative to the center of the screen
      const rotX = angleX + ((currentMouse.y - window.innerHeight / 2) / window.innerHeight) * 1.2;
      const rotY = angleY + ((currentMouse.x - window.innerWidth / 2) / window.innerWidth) * 1.2;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      // Center of the screen
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      particles.forEach(p => {
        // Scale normalized coordinates by radius
        const px = p.baseX * SPHERE_RADIUS;
        const py = p.baseY * SPHERE_RADIUS;
        const pz = p.baseZ * SPHERE_RADIUS;

        // Rotate around X axis
        const y1 = py * cosX - pz * sinX;
        const z1 = py * sinX + pz * cosX;
        
        // Rotate around Y axis
        const x2 = px * cosY + z1 * sinY;
        const z2 = -px * sinY + z1 * cosY;
        const y2 = y1;

        // Perspective projection
        const focalLength = 1000;
        const scale = focalLength / (focalLength + z2 + SPHERE_RADIUS * 0.5);

        const projX = cx + x2 * scale;
        const projY = cy + y2 * scale;

        // Depth-based opacity fading
        const alpha = Math.min(1, Math.max(0.05, scale * 1.5 - 0.3));
        
        if (alpha > 0.05) {
          ctx.beginPath();
          
          // In Antigravity, particles are tiny dashes/lines oriented in a swirling direction
          const dashLength = p.size * scale * 4;
          // Calculate a 2D tangent vector for the dash direction
          const dx = (-y2 * 0.01) * scale;
          const dy = (x2 * 0.01) * scale;
          
          ctx.moveTo(projX, projY);
          ctx.lineTo(projX + dx * dashLength, projY + dy * dashLength);
          
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(0.5, p.size * scale);
          ctx.globalAlpha = alpha;
          // Add subtle glow
          ctx.shadowBlur = 3 * scale;
          ctx.shadowColor = p.color;
          ctx.stroke();
        }
      });
      
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Ensure canvas acts as a true background and ignores pointer events completely
  return <canvas ref={canvasRef} className="cursor-trail-canvas" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: -10 }} />;
}
