"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

// Placeholder profile — shown immediately while the OBJ loads over the network.
// Same bust cross-section as before: head → neck → shoulders → plinth.
const BUST_PROFILE: [number, number][] = [
  [0.0,   1.06], [0.06,  1.02], [0.24,  0.92], [0.33,  0.75],
  [0.37,  0.56], [0.38,  0.35], [0.35,  0.14], [0.27,  0.00],
  [0.21, -0.14], [0.15, -0.30], [0.17, -0.46], [0.36, -0.61],
  [0.58, -0.76], [0.70, -0.88], [0.62, -0.98], [0.46, -1.04],
  [0.0,  -1.04],
];

export function Sculpture3D({ style }: { style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true; // guard against cleanup-after-unmount

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

    // ── Lighting ──────────────────────────────────────────────────────────────
    const key = new THREE.DirectionalLight(0xffffff, 5.2);
    key.position.set(-2.2, 3.8, 4.8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(4.5, 0.5, 3.0);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.8);
    rim.position.set(0.8, 2.2, -5.0);
    scene.add(rim);
    const ground = new THREE.DirectionalLight(0xffffff, 0.28);
    ground.position.set(0, -4, 2);
    scene.add(ground);
    scene.add(new THREE.AmbientLight(0xffffff, 0.16));

    // ── Pivot (YXZ order keeps Y-spin independent of mouse-X tilt) ───────────
    const pivot = new THREE.Group();
    pivot.rotation.order = "YXZ";
    scene.add(pivot);

    // ── Placeholder — LatheGeometry bust, visible while OBJ downloads ─────────
    const placeholderMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf3f0eb),
      roughness: 0.1,
      metalness: 0.03,
    });
    const placeholderGeo = new THREE.LatheGeometry(
      BUST_PROFILE.map(([x, y]) => new THREE.Vector2(x, y)),
      96,
    );
    placeholderGeo.computeVertexNormals();
    const placeholderMesh = new THREE.Mesh(placeholderGeo, placeholderMat);
    pivot.add(placeholderMesh);

    // Plinth cap for the placeholder
    const plinGeo = new THREE.CylinderGeometry(0.46, 0.52, 0.06, 64);
    const plinMesh = new THREE.Mesh(plinGeo, placeholderMat);
    plinMesh.position.y = -1.07;
    pivot.add(plinMesh);

    // ── Textures for the real model ───────────────────────────────────────────
    const texLoader = new THREE.TextureLoader();
    const normalMap = texLoader.load("/material0_normal.jpg");
    const aoMap = texLoader.load("/material0_occlusion.jpg");
    normalMap.colorSpace = THREE.LinearSRGBColorSpace;

    const realMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf3f0eb),
      roughness: 0.08,
      metalness: 0.03,
      normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      aoMap,
      aoMapIntensity: 0.65,
    });

    // ── Load OBJ — swap placeholder when ready ────────────────────────────────
    const objLoader = new OBJLoader();
    objLoader.load("/rapid.obj", (obj) => {
      if (!active) return;

      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = realMat;
          child.geometry.computeVertexNormals();
        }
      });

      // Center + scale to 2.2 units
      const box = new THREE.Box3().setFromObject(obj);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const s = 2.2 / Math.max(size.x, size.y, size.z);
      obj.scale.setScalar(s);
      obj.position.set(-center.x * s, -center.y * s, -center.z * s);

      // STL/RapidCompact exports usually have Z as up — rotate to Y-up
      obj.rotation.x = -Math.PI / 2;

      // Swap: remove placeholder, add real model
      pivot.remove(placeholderMesh, plinMesh);
      placeholderGeo.dispose();
      plinGeo.dispose();
      placeholderMat.dispose();

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
      active = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouse);
      ro.disconnect();
      realMat.dispose();
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
