"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

// Profile cross-section of a classical bust rotated 360° around Y axis.
// x = radius at that height, y = height.
const BUST_PROFILE: [number, number][] = [
  [0.0,   1.06],   // apex
  [0.06,  1.02],   // just off-center
  [0.24,  0.92],   // crown
  [0.33,  0.75],   // upper skull
  [0.37,  0.56],   // mid skull
  [0.38,  0.35],   // cheekbone
  [0.35,  0.14],   // lower cheek
  [0.27,  0.00],   // jaw
  [0.21, -0.14],   // chin
  [0.15, -0.30],   // neck
  [0.17, -0.46],   // lower neck
  [0.36, -0.61],   // neck-to-shoulder
  [0.58, -0.76],   // shoulder slope
  [0.70, -0.88],   // shoulder edge
  [0.62, -0.98],   // shoulder base
  [0.46, -1.04],   // plinth edge
  [0.0,  -1.04],   // plinth center (closes bottom)
];

export function Sculpture3D({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Scene ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    const getSize = () => {
      const parent = canvas.parentElement;
      return { w: parent?.clientWidth || 440, h: parent?.clientHeight || 520 };
    };

    const { w, h } = getSize();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 0.05, 4.2);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const ro = new ResizeObserver(() => {
      const { w: rw, h: rh } = getSize();
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
      renderer.setSize(rw, rh, false);
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // ── Bust geometry ────────────────────────────────────────────────────────
    const pts = BUST_PROFILE.map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(pts, 96);
    geo.computeVertexNormals();

    // ── Material — polished white marble ────────────────────────────────────
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf4f1ec),
      roughness: 0.07,
      metalness: 0.04,
    });

    const bust = new THREE.Mesh(geo, mat);
    scene.add(bust);

    // ── Subtle plinth cap (flat disc at base) ────────────────────────────────
    const plinGeo = new THREE.CylinderGeometry(0.46, 0.52, 0.06, 64);
    const plin = new THREE.Mesh(plinGeo, mat);
    plin.position.y = -1.07;
    scene.add(plin);

    // ── Lighting — museum portrait setup ────────────────────────────────────
    // Strong key light: upper-front-left (models the form dramatically)
    const key = new THREE.DirectionalLight(0xffffff, 5.0);
    key.position.set(-2.2, 3.8, 4.8);
    scene.add(key);

    // Soft fill from the right (opens the shadow side slightly)
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(4.5, 0.5, 3.0);
    scene.add(fill);

    // Rim light from behind (separates the form from background)
    const rim = new THREE.DirectionalLight(0xffffff, 1.6);
    rim.position.set(0.8, 2.2, -5.0);
    scene.add(rim);

    // Ground bounce (very subtle upward fill)
    const ground = new THREE.DirectionalLight(0xffffff, 0.25);
    ground.position.set(0, -4, 2);
    scene.add(ground);

    // Low ambient so deep shadows aren't pure black
    scene.add(new THREE.AmbientLight(0xffffff, 0.14));

    // ── Mouse tracking ───────────────────────────────────────────────────────
    const onMouse = (e: MouseEvent) => {
      mouse.current.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    // ── Render loop ──────────────────────────────────────────────────────────
    let t = 0;
    function tick() {
      t += 0.0035;
      const m = mouse.current;
      m.x += (m.tx - m.x) * 0.035;
      m.y += (m.ty - m.y) * 0.035;

      bust.rotation.y = t + m.x * 0.28;
      bust.rotation.x = m.y * 0.12;
      plin.rotation.y = bust.rotation.y;
      plin.rotation.x = bust.rotation.x;

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouse);
      ro.disconnect();
      geo.dispose();
      mat.dispose();
      plinGeo.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    />
  );
}
