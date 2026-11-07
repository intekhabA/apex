import React, { useEffect, useRef } from 'react';

interface DnaBackground3DProps {
  className?: string;
  speed?: number;
  opacity?: number;
  showBloodCells?: boolean;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  baseAlpha: number;
  color: string;
}

interface BloodCell3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  thickness: number;
  pitch: number;
  yaw: number;
  roll: number;
  vPitch: number;
  vYaw: number;
  vRoll: number;
  type: 'red' | 'white';
}

export const DnaBackground3D: React.FC<DnaBackground3DProps> = ({
  className = '',
  speed = 1.0,
  opacity = 0.9,
  showBloodCells = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // 3D Scene Parameters
    let rotation = 0;
    let targetTiltX = 0.22;
    let currentTiltX = 0.22;
    let targetTiltY = -0.12;
    let currentTiltY = -0.12;
    let isVisible = true;

    // Molecular Nucleotide Palette for DNA
    const colorsStrandA = ['#38bdf8', '#0284c7', '#0ea5e9', '#67e8f9']; // Cyan / Medical Blue
    const colorsStrandB = ['#2dd4bf', '#10b981', '#14b8a6', '#818cf8']; // Emerald / Teal / Indigo

    // 1. Ambient Bio-Particles
    const particleCount = 28;
    const particles: Particle3D[] = [];
    const particleColors = ['#38bdf8', '#2dd4bf', '#818cf8', '#fda4af', '#f43f5e'];

    // 2. 3D Blood Cells (Erythrocytes & Leukocytes)
    const bloodCellCount = showBloodCells ? 22 : 0;
    const bloodCells: BloodCell3D[] = [];

    const initEntities = (w: number, h: number) => {
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: (Math.random() - 0.5) * w * 1.3,
          y: (Math.random() - 0.5) * h * 1.3,
          z: (Math.random() - 0.5) * 600,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3 - 0.1,
          vz: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 2.2 + 0.8,
          baseAlpha: Math.random() * 0.5 + 0.2,
          color: particleColors[Math.floor(Math.random() * particleColors.length)],
        });
      }

      bloodCells.length = 0;
      if (showBloodCells) {
        for (let i = 0; i < bloodCellCount; i++) {
          const isWhite = i % 7 === 0;
          bloodCells.push({
            x: (Math.random() - 0.5) * w * 1.1,
            y: (Math.random() - 0.5) * h * 1.1,
            z: (Math.random() - 0.5) * 550,
            // Gentle circulatory flow
            vx: (Math.random() - 0.48) * 0.45,
            vy: (Math.random() - 0.5) * 0.4 - 0.15,
            vz: (Math.random() - 0.5) * 0.4,
            radius: isWhite ? Math.random() * 6 + 14 : Math.random() * 8 + 18,
            thickness: isWhite ? 12 : Math.random() * 2 + 5,
            pitch: Math.random() * Math.PI * 2,
            yaw: Math.random() * Math.PI * 2,
            roll: Math.random() * Math.PI * 2,
            vPitch: (Math.random() - 0.5) * 0.02,
            vYaw: (Math.random() - 0.5) * 0.02,
            vRoll: (Math.random() - 0.5) * 0.02,
            type: isWhite ? 'white' : 'red',
          });
        }
      }
    };

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      initEntities(width, height);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    handleResize();

    // Mouse movement interaction (subtle organic parallax)
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;

      targetTiltY = -0.12 + nx * 0.28;
      targetTiltX = 0.22 + ny * 0.22;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intersectionObserver = new IntersectionObserver((entries) => {
      isVisible = entries[0]?.isIntersecting ?? true;
    });
    intersectionObserver.observe(container);

    interface RenderItem {
      type: 'node' | 'rung' | 'particle' | 'blood_cell';
      z: number;
      draw: (ctx: CanvasRenderingContext2D) => void;
    }

    const fov = 720;

    const render = () => {
      if (!isVisible || width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Smooth camera tilt lerp
      currentTiltX += (targetTiltX - currentTiltX) * 0.05;
      currentTiltY += (targetTiltY - currentTiltY) * 0.05;

      // DNA rotation
      rotation += 0.011 * speed;

      const cx = width * 0.52;
      const cy = height * 0.5;

      const cosX = Math.cos(currentTiltX);
      const sinX = Math.sin(currentTiltX);
      const cosY = Math.cos(currentTiltY);
      const sinY = Math.sin(currentTiltY);

      // 3D projection
      const project3D = (x: number, y: number, z: number) => {
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;

        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        const scale = fov / (fov + z2 + 250);
        const px = cx + x1 * scale;
        const py = cy + y2 * scale;

        return { px, py, pz: z2, scale, rx: x1, ry: y2 };
      };

      const renderQueue: RenderItem[] = [];

      // -------------------------------------------------------------
      // 1. RENDER 3D BLOOD CELLS (ERYTHROCYTES & LEUKOCYTES)
      // -------------------------------------------------------------
      bloodCells.forEach((cell) => {
        // Move with circulatory drift
        cell.x += cell.vx * speed;
        cell.y += cell.vy * speed;
        cell.z += cell.vz * speed;

        // Rotate in 3D (tumbling motion)
        cell.pitch += cell.vPitch * speed;
        cell.yaw += cell.vYaw * speed;
        cell.roll += cell.vRoll * speed;

        // Boundary wrap
        const boundX = width * 0.65;
        const boundY = height * 0.65;
        if (cell.x < -boundX) cell.x = boundX;
        if (cell.x > boundX) cell.x = -boundX;
        if (cell.y < -boundY) cell.y = boundY;
        if (cell.y > boundY) cell.y = -boundY;
        if (cell.z < -300) cell.z = 300;
        if (cell.z > 300) cell.z = -300;

        const proj = project3D(cell.x, cell.y, cell.z);
        if (proj.scale <= 0) return;

        // Depth cueing
        const depthFactor = Math.max(0.2, Math.min(1.0, (1 - proj.pz / 450)));
        const cellAlpha = Math.max(0.15, Math.min(0.85, depthFactor * 0.8)) * opacity;
        const currentRadius = cell.radius * proj.scale;

        if (cell.type === 'red') {
          // Biconcave Red Blood Cell Disc (Erythrocyte)
          // Compute apparent 2D orientation and tilt aspect ratio from 3D angles
          const cosPitch = Math.abs(Math.cos(cell.pitch));
          const aspect = Math.max(0.25, cosPitch); // Tilt ratio (1.0 = face on, 0.25 = edge on)
          const angle = cell.roll + currentTiltY;

          renderQueue.push({
            type: 'blood_cell',
            z: proj.pz,
            draw: (c) => {
              c.save();
              c.translate(proj.px, proj.py);
              c.rotate(angle);

              const rx = currentRadius;
              const ry = currentRadius * aspect;

              // Outer Erythrocyte Disc
              c.beginPath();
              c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);

              // 3D Lighting Gradient across the cell
              const grad = c.createRadialGradient(
                -rx * 0.25,
                -ry * 0.25,
                rx * 0.1,
                0,
                0,
                rx
              );
              // Luminous oxygenated blood tones
              grad.addColorStop(0, '#f43f5e'); // Rose/Coral light reflection
              grad.addColorStop(0.3, '#e11d48'); // Rich arterial crimson
              grad.addColorStop(0.7, '#be123c'); // Deep ruby
              grad.addColorStop(1, '#881337'); // Dark shadow rim

              c.fillStyle = grad;
              c.globalAlpha = cellAlpha;

              // Soft rim glow for front cells
              if (proj.pz < 50) {
                c.shadowColor = '#e11d48';
                c.shadowBlur = Math.min(14, 10 * proj.scale);
              }
              c.fill();

              // Central Biconcave Depression (Dimple)
              // This gives erythrocytes their unmistakable signature 3D biconcave shape
              if (aspect > 0.35) {
                const dimpleRx = rx * 0.42;
                const dimpleRy = ry * 0.42;
                c.beginPath();
                c.ellipse(0, 0, dimpleRx, dimpleRy, 0, 0, Math.PI * 2);

                const dimpleGrad = c.createRadialGradient(
                  0,
                  0,
                  0,
                  0,
                  0,
                  dimpleRx
                );
                dimpleGrad.addColorStop(0, '#4c0519'); // Deep hollow shadow
                dimpleGrad.addColorStop(0.8, '#9f1239');
                dimpleGrad.addColorStop(1, 'transparent');

                c.fillStyle = dimpleGrad;
                c.globalAlpha = Math.min(0.9, cellAlpha * 1.2);
                c.fill();
              }

              // Specular Rim Highlight (Crescent light reflection)
              if (proj.pz < 80) {
                c.beginPath();
                c.ellipse(-rx * 0.2, -ry * 0.2, rx * 0.5, ry * 0.3, -0.2, 0, Math.PI * 2);
                c.fillStyle = '#ffffff';
                c.globalAlpha = cellAlpha * 0.28;
                c.fill();
              }

              c.restore();
            },
          });
        } else {
          // White Blood Cell (Leukocyte sphere with translucent membrane)
          renderQueue.push({
            type: 'blood_cell',
            z: proj.pz,
            draw: (c) => {
              c.save();
              c.translate(proj.px, proj.py);

              const r = currentRadius * 0.85;

              // Translucent leukocyte body
              c.beginPath();
              c.arc(0, 0, r, 0, Math.PI * 2);

              const whiteGrad = c.createRadialGradient(
                -r * 0.3,
                -r * 0.3,
                r * 0.1,
                0,
                0,
                r
              );
              whiteGrad.addColorStop(0, '#f8fafc');
              whiteGrad.addColorStop(0.5, '#cbd5e1');
              whiteGrad.addColorStop(0.9, '#94a3b8');
              whiteGrad.addColorStop(1, '#64748b');

              c.fillStyle = whiteGrad;
              c.globalAlpha = cellAlpha * 0.65;
              c.shadowColor = '#cbd5e1';
              c.shadowBlur = Math.min(12, 8 * proj.scale);
              c.fill();

              // Nucleus texture dots inside leukocyte
              c.beginPath();
              c.arc(-r * 0.2, -r * 0.1, r * 0.35, 0, Math.PI * 2);
              c.fillStyle = '#818cf8';
              c.globalAlpha = cellAlpha * 0.45;
              c.fill();

              c.restore();
            },
          });
        }
      });

      // -------------------------------------------------------------
      // 2. RENDER FLOATING AMBIENT PARTICLES
      // -------------------------------------------------------------
      particles.forEach((p) => {
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        p.z += p.vz * speed;

        const boundX = width * 0.65;
        const boundY = height * 0.65;
        if (p.x < -boundX) p.x = boundX;
        if (p.x > boundX) p.x = -boundX;
        if (p.y < -boundY) p.y = boundY;
        if (p.y > boundY) p.y = -boundY;
        if (p.z < -300) p.z = 300;
        if (p.z > 300) p.z = -300;

        const proj = project3D(p.x, p.y, p.z);
        if (proj.scale > 0) {
          const depthAlpha = Math.max(0.08, Math.min(0.7, (1 - proj.pz / 400) * p.baseAlpha)) * opacity;
          const pRadius = Math.max(0.8, p.radius * proj.scale);

          renderQueue.push({
            type: 'particle',
            z: proj.pz,
            draw: (c) => {
              c.beginPath();
              c.arc(proj.px, proj.py, pRadius, 0, Math.PI * 2);
              c.fillStyle = p.color;
              c.globalAlpha = depthAlpha;
              c.fill();
            },
          });
        }
      });

      // -------------------------------------------------------------
      // 3. RENDER 3D DNA DOUBLE HELIX
      // -------------------------------------------------------------
      const isMobile = width < 640;
      const helixRadius = isMobile ? 85 : Math.min(150, width * 0.16);
      const totalBasePairs = isMobile ? 42 : 58;
      const verticalSpan = height * 1.25;
      const stepY = verticalSpan / totalBasePairs;
      const twistRate = 0.22;

      const strand1Points: { px: number; py: number; pz: number; scale: number; color: string }[] = [];
      const strand2Points: { px: number; py: number; pz: number; scale: number; color: string }[] = [];

      for (let i = 0; i < totalBasePairs; i++) {
        const y = (i - totalBasePairs / 2) * stepY;
        const angle = i * twistRate + rotation;

        const x1 = Math.cos(angle) * helixRadius;
        const z1 = Math.sin(angle) * helixRadius;

        const x2 = Math.cos(angle + Math.PI) * helixRadius;
        const z2 = Math.sin(angle + Math.PI) * helixRadius;

        const p1 = project3D(x1, y, z1);
        const p2 = project3D(x2, y, z2);

        const colorA = colorsStrandA[i % colorsStrandA.length];
        const colorB = colorsStrandB[i % colorsStrandB.length];

        strand1Points.push({ ...p1, color: colorA });
        strand2Points.push({ ...p2, color: colorB });

        // Base pair connecting bridge
        const avgZ = (p1.pz + p2.pz) / 2;

        renderQueue.push({
          type: 'rung',
          z: avgZ - 2,
          draw: (c) => {
            const depthFactor = (avgZ + helixRadius) / (2 * helixRadius);
            const rungAlpha = Math.max(0.12, Math.min(0.65, 0.2 + (1 - depthFactor) * 0.45)) * opacity;
            const lineWidth = Math.max(1, 2.4 * ((p1.scale + p2.scale) / 2));

            const grad = c.createLinearGradient(p1.px, p1.py, p2.px, p2.py);
            grad.addColorStop(0, colorA);
            grad.addColorStop(0.5, '#e0f2fe');
            grad.addColorStop(1, colorB);

            c.save();
            c.beginPath();
            c.moveTo(p1.px, p1.py);
            c.lineTo(p2.px, p2.py);
            c.strokeStyle = grad;
            c.globalAlpha = rungAlpha;
            c.lineWidth = lineWidth;
            c.stroke();

            // Hydrogen bond junction node
            const midX = (p1.px + p2.px) / 2;
            const midY = (p1.py + p2.py) / 2;
            const midRadius = Math.max(1.2, 2.2 * ((p1.scale + p2.scale) / 2));
            c.beginPath();
            c.arc(midX, midY, midRadius, 0, Math.PI * 2);
            c.fillStyle = '#ffffff';
            c.globalAlpha = Math.min(0.85, rungAlpha * 1.4);
            c.fill();
            c.restore();
          },
        });

        // Strand 1 Nucleotide Sphere
        renderQueue.push({
          type: 'node',
          z: p1.pz,
          draw: (c) => {
            const depthRatio = Math.max(0.15, Math.min(1.0, (1 - p1.pz / 250)));
            const nodeRadius = Math.max(2.5, (4.5 + depthRatio * 2.8) * p1.scale);
            const nodeAlpha = Math.max(0.25, Math.min(0.95, depthRatio * 0.9)) * opacity;

            c.save();
            if (p1.pz < 20) {
              c.shadowColor = colorA;
              c.shadowBlur = Math.min(16, 12 * p1.scale);
            }

            c.beginPath();
            c.arc(p1.px, p1.py, nodeRadius, 0, Math.PI * 2);
            c.fillStyle = colorA;
            c.globalAlpha = nodeAlpha;
            c.fill();

            if (p1.pz < 0) {
              c.beginPath();
              c.arc(p1.px - nodeRadius * 0.3, p1.py - nodeRadius * 0.3, nodeRadius * 0.4, 0, Math.PI * 2);
              c.fillStyle = '#ffffff';
              c.globalAlpha = nodeAlpha * 0.8;
              c.fill();
            }
            c.restore();
          },
        });

        // Strand 2 Nucleotide Sphere
        renderQueue.push({
          type: 'node',
          z: p2.pz,
          draw: (c) => {
            const depthRatio = Math.max(0.15, Math.min(1.0, (1 - p2.pz / 250)));
            const nodeRadius = Math.max(2.5, (4.5 + depthRatio * 2.8) * p2.scale);
            const nodeAlpha = Math.max(0.25, Math.min(0.95, depthRatio * 0.9)) * opacity;

            c.save();
            if (p2.pz < 20) {
              c.shadowColor = colorB;
              c.shadowBlur = Math.min(16, 12 * p2.scale);
            }

            c.beginPath();
            c.arc(p2.px, p2.py, nodeRadius, 0, Math.PI * 2);
            c.fillStyle = colorB;
            c.globalAlpha = nodeAlpha;
            c.fill();

            if (p2.pz < 0) {
              c.beginPath();
              c.arc(p2.px - nodeRadius * 0.3, p2.py - nodeRadius * 0.3, nodeRadius * 0.4, 0, Math.PI * 2);
              c.fillStyle = '#ffffff';
              c.globalAlpha = nodeAlpha * 0.8;
              c.fill();
            }
            c.restore();
          },
        });
      }

      // Sort entire 3D scene by Z (Painter's algorithm: deep back elements render first, front elements in front)
      renderQueue.sort((a, b) => b.z - a.z);

      // Continuous glowing backbone ribbons
      const drawStrandBackbone = (points: { px: number; py: number; pz: number; scale: number; color: string }[], strokeColor: string) => {
        if (points.length < 2) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].px, points[0].py);
        for (let i = 1; i < points.length; i++) {
          const xc = (points[i - 1].px + points[i].px) / 2;
          const yc = (points[i - 1].py + points[i].py) / 2;
          ctx.quadraticCurveTo(points[i - 1].px, points[i - 1].py, xc, yc);
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.28 * opacity;
        ctx.stroke();
        ctx.restore();
      };

      drawStrandBackbone(strand1Points, '#38bdf8');
      drawStrandBackbone(strand2Points, '#2dd4bf');

      // Draw all Z-sorted items
      renderQueue.forEach((item) => {
        item.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [speed, opacity, showBloodCells]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
