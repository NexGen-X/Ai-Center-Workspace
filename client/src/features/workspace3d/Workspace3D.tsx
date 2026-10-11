import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AIAgent } from '../../../../shared/types.js';
import { Camera, Compass, Eye, RotateCw, Monitor, AlertCircle } from 'lucide-react';

interface Workspace3DProps {
  agents: AIAgent[];
  onSelectAgent: (agent: AIAgent) => void;
  onFallbackTo2D: () => void;
}

const ROLE_HEX_COLORS: Record<string, number> = {
  Orchestrator: 0x3b82f6, // Blue
  Planner: 0x8b5cf6,      // Purple
  Executor: 0x10b981,     // Emerald
  'QA / Reviewer': 0xf59e0b, // Amber
  DevOps: 0xec4899,       // Pink
  'Domain Specialist': 0x06b6d4 // Cyan
};

export const Workspace3D: React.FC<Workspace3DProps> = ({ agents, onSelectAgent, onFallbackTo2D }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoTour, setAutoTour] = useState(true);
  const [hoveredAgent, setHoveredAgent] = useState<AIAgent | null>(null);
  const [webGlSupported, setWebGlSupported] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight || 400;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 14, 22);
    camera.lookAt(0, 1.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x60a5fa, 2.0);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    const centerPointLight = new THREE.PointLight(0x38bdf8, 2.5, 25);
    centerPointLight.position.set(0, 4, 0);
    scene.add(centerPointLight);

    // 3. Environment: Floor & Grid
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(36, 36, 0x1e293b, 0x161e2e);
    grid.position.y = 0.01;
    scene.add(grid);

    // 4. Center Command Hologram Platform
    const holoGeo = new THREE.CylinderGeometry(2.5, 2.8, 0.2, 32);
    const holoMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x0284c7,
      emissiveIntensity: 0.3
    });
    const holoMesh = new THREE.Mesh(holoGeo, holoMat);
    holoMesh.position.set(0, 0.1, 0);
    holoMesh.receiveShadow = true;
    scene.add(holoMesh);

    // Center glowing core
    const coreGeo = new THREE.OctahedronGeometry(0.8, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.8,
      wireframe: true
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, 2.2, 0);
    scene.add(coreMesh);

    // 5. Build Agent Workstations in a semi-circle
    const interactiveMeshes: THREE.Mesh[] = [];
    const agentMap = new Map<THREE.Mesh, AIAgent>();
    const characterMeshes: { mesh: THREE.Group; agent: AIAgent; baseAngle: number }[] = [];

    const radius = 6.8;
    const totalAgents = Math.max(agents.length, 1);

    agents.forEach((agent, index) => {
      const angle = (index / totalAgents) * Math.PI * 1.5 - Math.PI * 0.75;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius - 1;

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.lookAt(0, 0, 0);

      // Desk
      const deskGeo = new THREE.BoxGeometry(2.4, 0.1, 1.2);
      const deskMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
      const desk = new THREE.Mesh(deskGeo, deskMat);
      desk.position.set(0, 1.0, 0);
      desk.castShadow = true;
      desk.receiveShadow = true;
      group.add(desk);

      // Desk Legs
      const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
      const leg1 = new THREE.Mesh(legGeo, legMat);
      leg1.position.set(1.0, 0.5, 0.4);
      const leg2 = new THREE.Mesh(legGeo, legMat);
      leg2.position.set(-1.0, 0.5, 0.4);
      group.add(leg1);
      group.add(leg2);

      // Computer Monitor
      const monitorGeo = new THREE.BoxGeometry(1.0, 0.6, 0.05);
      const monitorScreenMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: agent.status === 'BUSY' ? 0xf59e0b : 0x38bdf8,
        emissiveIntensity: 0.5
      });
      const monitor = new THREE.Mesh(monitorGeo, monitorScreenMat);
      monitor.position.set(0, 1.45, -0.3);
      group.add(monitor);

      // Character Avatar (Robot / Agent Sphere & Body)
      const roleColor = ROLE_HEX_COLORS[agent.role] || 0x3b82f6;
      const charGroup = new THREE.Group();
      charGroup.position.set(0, 0, 0.8);

      // Body
      const bodyGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.9, 16);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.5,
        roughness: 0.5
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(0, 0.75, 0);
      body.castShadow = true;
      charGroup.add(body);

      // Head
      const headGeo = new THREE.SphereGeometry(0.32, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({
        color: roleColor,
        emissive: roleColor,
        emissiveIntensity: agent.status === 'READY' || agent.status === 'BUSY' ? 0.4 : 0.05,
        roughness: 0.3
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 1.4, 0);
      head.castShadow = true;
      charGroup.add(head);

      // Status Aura Ring
      const ringGeo = new THREE.RingGeometry(0.55, 0.65, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: roleColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      charGroup.add(ring);

      group.add(charGroup);
      scene.add(group);

      // Register interactive mesh for raycasting
      interactiveMeshes.push(head);
      agentMap.set(head, agent);

      characterMeshes.push({ mesh: charGroup, agent, baseAngle: angle });
    });

    // 6. Raycasting & Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const ag = agentMap.get(hit);
        if (ag) {
          setHoveredAgent(ag);
          container.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredAgent(null);
      container.style.cursor = 'default';
    };

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const ag = agentMap.get(hit);
        if (ag) onSelectAgent(ag);
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);

    // 7. Resize Observer
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || 400;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // 8. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Spin central hologram core
      coreMesh.rotation.y = elapsedTime * 0.8;
      coreMesh.rotation.x = Math.sin(elapsedTime * 0.5) * 0.3;

      // Gentle floating animation for character avatars
      characterMeshes.forEach((item, idx) => {
        const offset = idx * 0.5;
        item.mesh.position.y = Math.sin(elapsedTime * 2 + offset) * 0.04;
      });

      // Auto-Tour Camera Orbit
      if (autoTour) {
        const orbitRadius = 18;
        const orbitSpeed = 0.15;
        const camAngle = elapsedTime * orbitSpeed;
        camera.position.x = Math.sin(camAngle) * orbitRadius;
        camera.position.z = Math.cos(camAngle) * orbitRadius;
        camera.position.y = 12 + Math.sin(elapsedTime * 0.2) * 1.5;
        camera.lookAt(0, 1.2, 0);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup resources on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);

      floorGeo.dispose();
      floorMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [agents, autoTour]);

  if (!webGlSupported) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
        <h3 className="text-sm font-bold text-white">WebGL Tidak Didukung pada Browser Ini</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Perangkat Anda tidak mendukung akselerasi grafis 3D WebGL. Gunakan tampilan 2D yang dapat diakses penuh di bawah ini.
        </p>
        <button
          onClick={onFallbackTo2D}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white"
        >
          Beralih ke Tampilan 2D
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] lg:h-[460px] bg-[#0B0F17] rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl group">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* 3D Overlay Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-xs font-semibold text-white flex items-center gap-2 shadow-lg">
          <Monitor className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Ruang Kerja Virtual 3D</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">
            {agents.length} Stasiun
          </span>
        </div>

        <button
          onClick={() => setAutoTour(!autoTour)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border backdrop-blur-md transition flex items-center gap-1.5 shadow-lg ${
            autoTour
              ? 'bg-blue-600/30 border-blue-500 text-blue-300'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoTour ? 'animate-spin' : ''}`} />
          <span>Auto-Tour {autoTour ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={onFallbackTo2D}
          className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition shadow-lg"
        >
          Tampilan 2D (Grid)
        </button>
      </div>

      {/* Hover Info Tooltip */}
      {hoveredAgent && (
        <div className="absolute bottom-4 left-4 z-10 p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-blue-500/40 text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white text-sm">{hoveredAgent.name}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {hoveredAgent.role}
            </span>
          </div>
          <p className="text-slate-400 text-[11px] font-mono">Model: {hoveredAgent.modelId}</p>
          <p className="text-cyan-400 text-[10px] mt-1 font-semibold">Klik untuk membuka detail & prompt eksekusi</p>
        </div>
      )}

      {/* Helper Footer */}
      <div className="absolute bottom-3 right-4 z-10 text-[11px] text-slate-500 font-mono hidden sm:block pointer-events-none">
        Hover untuk menginspeksi • Klik avatar agen untuk membuka instruksi
      </div>
    </div>
  );
};
