"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

export function Sculpture3D({ style }: { style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    const getSize = () => {
      const p = canvas.parentElement;
      return { w: p?.clientWidth || 440, h: p?.clientHeight || 520 };
    };
    const { w, h } = getSize();

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 0.15, 4.4);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    const ro = new ResizeObserver(() => {
      const { w: rw, h: rh } = getSize();
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
      renderer.setSize(rw, rh, false);
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // ── Lighting — museum portrait setup ──────────────────────────────────────
    // Strong key: upper-front-left
    const key = new THREE.DirectionalLight(0xffffff, 5.2);
    key.position.set(-2.2, 3.8, 4.8);
    scene.add(key);

    // Soft fill: from right
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(4.5, 0.5, 3.0);
    scene.add(fill);

    // Rim: behind, separates form from background
    const rim = new THREE.DirectionalLight(0xffffff, 1.8);
    rim.position.set(0.8, 2.2, -5.0);
    scene.add(rim);

    // Ground bounce: subtle upward fill
    const ground = new THREE.DirectionalLight(0xffffff, 0.28);
    ground.position.set(0, -4, 2);
    scene.add(ground);

    scene.add(new THREE.AmbientLight(0xffffff, 0.16));

    // ── Textures ──────────────────────────────────────────────────────────────
    const texLoader = new THREE.TextureLoader();
    const normalMap = texLoader.load("/material0_normal.jpg");
    const aoMap = texLoader.load("/material0_occlusion.jpg");
    // Normal map should be in linear space
    normalMap.colorSpace = THREE.LinearSRGBColorSpace;

    // ── Material — polished white marble with baked detail ────────────────────
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf3f0eb),
      roughness: 0.08,
      metalness: 0.03,
      normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      aoMap,
      aoMapIntensity: 0.65,
    });

    // ── Pivot for smooth rotation (YXZ order = Y first, then mouse tilt) ──────
    const pivot = new THREE.Group();
    pivot.rotation.order = "YXZ";
    scene.add(pivot);

    // ── Load OBJ ──────────────────────────────────────────────────────────────
    const objLoader = new OBJLoader();
    objLoader.load("/rapid.obj", (obj) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = mat;
          child.geometry.computeVertexNormals();
        }
      });

      // Auto-center and scale to fit ~2.2 units
      const box = new THREE.Box3().setFromObject(obj);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const s = 2.2 / maxDim;

      obj.scale.setScalar(s);
      obj.position.set(-center.x * s, -center.y * s, -center.z * s);

      // Scans from RapidCompact / STL sources often have Z as up-axis.
      // Rotate -90° around X to bring Z-up into Y-up (standard CG).
      obj.rotation.x = -Math.PI / 2;

      pivot.add(obj);
    });

    // ── Mouse ─────────────────────────────────────────────────────────────────
    const onMouse = (e: MouseEvent) => {
      mouse.current.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    // ── Render loop ───────────────────────────────────────────────────────────
    let t = 0;
    function tick() {
      t += 0.0032;
      const m = mouse.current;
      m.x += (m.tx - m.x) * 0.032;
      m.y += (m.ty - m.y) * 0.032;

      pivot.rotation.y = t + m.x * 0.3;
      pivot.rotation.x = m.y * 0.14;

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouse);
      ro.disconnect();
      mat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    />
  );
}
