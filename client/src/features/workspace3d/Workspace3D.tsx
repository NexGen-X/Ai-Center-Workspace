import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AIAgent } from '../../../../shared/types.js';
import {
  Monitor,
  RotateCw,
  Eye,
  Compass,
  Zap,
  Activity,
  Layers,
  Sparkles,
  Maximize2,
  AlertCircle
} from 'lucide-react';

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

type CameraPreset = 'cinematic' | 'tactical' | 'core' | 'front';

export const Workspace3D: React.FC<Workspace3DProps> = ({ agents, onSelectAgent, onFallbackTo2D }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoTour, setAutoTour] = useState(true);
  const [activePreset, setActivePreset] = useState<CameraPreset>('cinematic');
  const [hoveredAgent, setHoveredAgent] = useState<AIAgent | null>(null);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [controlsRef, setControlsRef] = useState<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

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
    const height = container.clientHeight || 460;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060911);
    scene.fog = new THREE.FogExp2(0x060911, 0.028);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 13, 20);
    camera.lookAt(0, 1.5, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 2. Interactive OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.04; // Don't clip under the floor
    controls.minDistance = 5;
    controls.maxDistance = 38;
    controls.target.set(0, 1.5, 0);
    controls.autoRotate = autoTour;
    controls.autoRotateSpeed = 0.7;
    setControlsRef(controls);

    // 3. Lighting System
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    keyLight.position.set(12, 22, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 60;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.2);
    rimLight.position.set(-14, 15, -12);
    scene.add(rimLight);

    const coreLight = new THREE.PointLight(0x38bdf8, 4.0, 30);
    coreLight.position.set(0, 3, 0);
    scene.add(coreLight);

    // 4. Cyber Command Floor with Procedural Canvas Tech Pattern
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d')!;
    fctx.fillStyle = '#080d1a';
    fctx.fillRect(0, 0, 512, 512);

    // Draw tech concentric circles & radial grid ticks
    fctx.strokeStyle = '#1e293b';
    fctx.lineWidth = 1.5;
    for (let r = 50; r <= 240; r += 45) {
      fctx.beginPath();
      fctx.arc(256, 256, r, 0, Math.PI * 2);
      fctx.stroke();
    }
    // Neon accent ring
    fctx.strokeStyle = '#0284c7';
    fctx.lineWidth = 2.5;
    fctx.beginPath();
    fctx.arc(256, 256, 180, 0, Math.PI * 2);
    fctx.stroke();

    fctx.strokeStyle = '#38bdf8';
    fctx.lineWidth = 1;
    fctx.setLineDash([4, 12]);
    fctx.beginPath();
    fctx.arc(256, 256, 120, 0, Math.PI * 2);
    fctx.stroke();
    fctx.setLineDash([]);

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(2, 2);

    const floorGeo = new THREE.PlaneGeometry(44, 44);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.4,
      metalness: 0.6
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Hologram grid overlay
    const grid = new THREE.GridHelper(44, 44, 0x0284c7, 0x111c30);
    grid.position.y = 0.02;
    scene.add(grid);

    // 5. Central Quantum AI Hologram Core
    // Multitier base pedestal
    const baseGeo = new THREE.CylinderGeometry(2.8, 3.2, 0.35, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, 0.175, 0);
    baseMesh.receiveShadow = true;
    scene.add(baseMesh);

    // Neon trim ring
    const baseRingGeo = new THREE.TorusGeometry(3.1, 0.04, 16, 64);
    const baseRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.35;
    scene.add(baseRing);

    // Holographic Gyroscope Nested Rings
    const ring1Geo = new THREE.TorusGeometry(1.6, 0.035, 16, 64);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
    const gyroRing1 = new THREE.Mesh(ring1Geo, ring1Mat);
    gyroRing1.position.set(0, 2.5, 0);
    scene.add(gyroRing1);

    const ring2Geo = new THREE.TorusGeometry(1.3, 0.03, 16, 64);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.8 });
    const gyroRing2 = new THREE.Mesh(ring2Geo, ring2Mat);
    gyroRing2.position.set(0, 2.5, 0);
    scene.add(gyroRing2);

    const ring3Geo = new THREE.TorusGeometry(1.0, 0.025, 16, 64);
    const ring3Mat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.75 });
    const gyroRing3 = new THREE.Mesh(ring3Geo, ring3Mat);
    gyroRing3.position.set(0, 2.5, 0);
    scene.add(gyroRing3);

    // Central Floating Crystalline Quantum AI Core (Icosahedron)
    const coreGeo = new THREE.IcosahedronGeometry(0.75, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9,
      wireframe: true
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, 2.5, 0);
    scene.add(coreMesh);

    // Inner glowing energy orb inside the icosahedron
    const innerOrbGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const innerOrbMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.9
    });
    const innerOrb = new THREE.Mesh(innerOrbGeo, innerOrbMat);
    innerOrb.position.set(0, 2.5, 0);
    scene.add(innerOrb);

    // Vertical Translucent Holographic Pillar of Light
    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 14, 32, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(0, 7, 0);
    scene.add(pillar);

    // 6. Ambient Floating Cyber Dust Particles
    const particleCount = 350;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const pRadius = 2 + Math.random() * 16;
      const pAngle = Math.random() * Math.PI * 2;
      particlePositions[i * 3] = Math.sin(pAngle) * pRadius;
      particlePositions[i * 3 + 1] = Math.random() * 12;
      particlePositions[i * 3 + 2] = Math.cos(pAngle) * pRadius;
      particleSpeeds[i] = 0.2 + Math.random() * 0.5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    // Create soft circular particle texture
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pctx = pCanvas.getContext('2d')!;
    const pGrad = pctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    pGrad.addColorStop(0, 'rgba(56, 189, 248, 1)');
    pGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.5)');
    pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    pctx.fillStyle = pGrad;
    pctx.fillRect(0, 0, 32, 32);
    const pTex = new THREE.CanvasTexture(pCanvas);

    const particleMat = new THREE.PointsMaterial({
      size: 0.22,
      map: pTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 7. Background Quantum Compute Towers at 4 corners
    const towerCoords = [
      [-16, -16],
      [16, -16],
      [-16, 16],
      [16, 16]
    ];
    towerCoords.forEach(([tx, tz]) => {
      const towerGeo = new THREE.BoxGeometry(2.4, 9, 2.4);
      const towerMat = new THREE.MeshStandardMaterial({
        color: 0x090e1a,
        metalness: 0.8,
        roughness: 0.3
      });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(tx, 4.5, tz);
      tower.castShadow = true;
      tower.receiveShadow = true;
      scene.add(tower);

      // Server vertical LED strips
      const ledGeo = new THREE.BoxGeometry(0.1, 7.5, 0.1);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const led1 = new THREE.Mesh(ledGeo, ledMat);
      led1.position.set(tx + 1.15, 4.5, tz);
      scene.add(led1);
    });

    // 8. Build High-Tech AI Workstations, Neural Data Links & Cyber Droids
    const interactiveMeshes: THREE.Mesh[] = [];
    const agentMap = new Map<THREE.Mesh, AIAgent>();
    const characterMeshes: {
      mesh: THREE.Group;
      headVisor: THREE.Mesh;
      hoverRing1: THREE.Mesh;
      hoverRing2: THREE.Mesh;
      satellite1: THREE.Mesh;
      satellite2: THREE.Mesh;
      screenMat: THREE.MeshBasicMaterial;
      screenCanvas: HTMLCanvasElement;
      screenCtx: CanvasRenderingContext2D;
      screenTex: THREE.CanvasTexture;
      dataCurve: THREE.QuadraticBezierCurve3;
      pulseMesh: THREE.Mesh;
      agent: AIAgent;
      baseAngle: number;
    }[] = [];

    const radius = 7.5;
    const totalAgents = Math.max(agents.length, 1);

    agents.forEach((agent, index) => {
      const angle = (index / totalAgents) * Math.PI * 1.6 - Math.PI * 0.8;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius - 0.8;

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.lookAt(0, 0, 0);

      const roleColor = ROLE_HEX_COLORS[agent.role] || 0x3b82f6;

      // A. Curved Cyber Workstation Desk
      const deskGeo = new THREE.BoxGeometry(2.6, 0.12, 1.3);
      const deskMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.7,
        roughness: 0.3
      });
      const desk = new THREE.Mesh(deskGeo, deskMat);
      desk.position.set(0, 1.05, 0);
      desk.castShadow = true;
      desk.receiveShadow = true;
      group.add(desk);

      // Neon edge trim on desk front
      const edgeGeo = new THREE.BoxGeometry(2.6, 0.04, 0.04);
      const edgeMat = new THREE.MeshBasicMaterial({ color: roleColor });
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set(0, 1.05, 0.65);
      group.add(edge);

      // Angled titanium legs
      const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
      const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.05, 12);
      const leg1 = new THREE.Mesh(legGeo, legMat);
      leg1.position.set(1.15, 0.525, 0.45);
      const leg2 = new THREE.Mesh(legGeo, legMat);
      leg2.position.set(-1.15, 0.525, 0.45);
      group.add(leg1);
      group.add(leg2);

      // B. Floating Holographic Terminal Screen with Live Procedural Code Canvas
      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = 256;
      screenCanvas.height = 160;
      const screenCtx = screenCanvas.getContext('2d')!;
      const screenTex = new THREE.CanvasTexture(screenCanvas);

      const screenGeo = new THREE.PlaneGeometry(1.3, 0.8);
      const screenMat = new THREE.MeshBasicMaterial({
        map: screenTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95
      });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.set(0, 1.65, -0.35);
      screen.rotation.x = 0.15;
      group.add(screen);

      // Screen border frame
      const frameGeo = new THREE.BoxGeometry(1.34, 0.84, 0.02);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(0, 1.65, -0.37);
      frame.rotation.x = 0.15;
      group.add(frame);

      // C. Cyber Droid Character Avatar (Behind Desk)
      const droidGroup = new THREE.Group();
      droidGroup.position.set(0, 0, 0.85);

      // Dual Hover Rings (Levitation Effect)
      const hRing1Geo = new THREE.TorusGeometry(0.48, 0.02, 16, 32);
      const hRing1Mat = new THREE.MeshBasicMaterial({ color: roleColor, transparent: true, opacity: 0.85 });
      const hoverRing1 = new THREE.Mesh(hRing1Geo, hRing1Mat);
      hoverRing1.rotation.x = Math.PI / 2;
      hoverRing1.position.y = 0.3;
      droidGroup.add(hoverRing1);

      const hRing2Geo = new THREE.TorusGeometry(0.36, 0.015, 16, 32);
      const hRing2Mat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.7 });
      const hoverRing2 = new THREE.Mesh(hRing2Geo, hRing2Mat);
      hoverRing2.rotation.x = Math.PI / 2;
      hoverRing2.position.y = 0.22;
      droidGroup.add(hoverRing2);

      // Angular Torso (Titanium Chassis)
      const torsoGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.85, 8);
      const torsoMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.8,
        roughness: 0.25
      });
      const torso = new THREE.Mesh(torsoGeo, torsoMat);
      torso.position.set(0, 0.9, 0);
      torso.castShadow = true;
      droidGroup.add(torso);

      // Chest Power Core
      const chestCoreGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const chestCoreMat = new THREE.MeshBasicMaterial({
        color: agent.status === 'BUSY' ? 0xf59e0b : roleColor
      });
      const chestCore = new THREE.Mesh(chestCoreGeo, chestCoreMat);
      chestCore.position.set(0, 1.05, 0.32);
      droidGroup.add(chestCore);

      // Aerodynamic Cyber Helmet (Head)
      const headGeo = new THREE.SphereGeometry(0.32, 24, 24);
      const headMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.9,
        roughness: 0.2
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 1.55, 0);
      head.castShadow = true;
      droidGroup.add(head);

      // Horizontal Glowing Visor Scanner (Eyes)
      const visorGeo = new THREE.BoxGeometry(0.42, 0.1, 0.12);
      const visorMat = new THREE.MeshStandardMaterial({
        color: agent.status === 'BUSY' ? 0xf59e0b : roleColor,
        emissive: agent.status === 'BUSY' ? 0xf59e0b : roleColor,
        emissiveIntensity: agent.status === 'DISABLED' ? 0.1 : 1.2,
        roughness: 0.1
      });
      const headVisor = new THREE.Mesh(visorGeo, visorMat);
      headVisor.position.set(0, 1.55, 0.27);
      droidGroup.add(headVisor);

      // Two Micro-Satellite Subprocess Orbs Orbiting Head
      const satGeo = new THREE.SphereGeometry(0.06, 12, 12);
      const satMat = new THREE.MeshBasicMaterial({ color: roleColor });
      const satellite1 = new THREE.Mesh(satGeo, satMat);
      const satellite2 = new THREE.Mesh(satGeo, satMat);
      droidGroup.add(satellite1);
      droidGroup.add(satellite2);

      group.add(droidGroup);
      scene.add(group);

      // D. Neural Data Link (Energy Beam to Central Quantum Core)
      const startPt = new THREE.Vector3(x, 1.2, z);
      const midPt = new THREE.Vector3(x * 0.45, 3.8, z * 0.45);
      const endPt = new THREE.Vector3(0, 2.5, 0);
      const dataCurve = new THREE.QuadraticBezierCurve3(startPt, midPt, endPt);

      const tubeGeo = new THREE.TubeGeometry(dataCurve, 24, 0.025, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: agent.status === 'BUSY' ? 0xf59e0b : roleColor,
        transparent: true,
        opacity: agent.status === 'DISABLED' ? 0.08 : 0.35
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tube);

      // Traveling Photon Pulse along the curve
      const pulseGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: agent.status === 'BUSY' ? 0xfbbf24 : 0x67e8f9
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      scene.add(pulseMesh);

      // Register interactive meshes for click & raycasting
      interactiveMeshes.push(head);
      agentMap.set(head, agent);

      characterMeshes.push({
        mesh: droidGroup,
        headVisor,
        hoverRing1,
        hoverRing2,
        satellite1,
        satellite2,
        screenMat,
        screenCanvas,
        screenCtx,
        screenTex,
        dataCurve,
        pulseMesh,
        agent,
        baseAngle: angle
      });
    });

    // 9. Raycasting & Interaction
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
        if (ag) {
          onSelectAgent(ag);
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);

    // 10. Resize Observer
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || 460;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // 11. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Gyroscope multi-axis rotation
      gyroRing1.rotation.x = elapsedTime * 0.9;
      gyroRing1.rotation.y = elapsedTime * 0.6;
      gyroRing2.rotation.y = -elapsedTime * 0.7;
      gyroRing2.rotation.z = elapsedTime * 0.5;
      gyroRing3.rotation.z = -elapsedTime * 0.8;
      gyroRing3.rotation.x = -elapsedTime * 0.4;

      // Central core geometric pulse & spin
      coreMesh.rotation.y = elapsedTime * 1.1;
      coreMesh.rotation.x = Math.sin(elapsedTime * 0.7) * 0.4;
      const coreScale = 1 + Math.sin(elapsedTime * 3) * 0.06;
      coreMesh.scale.set(coreScale, coreScale, coreScale);

      innerOrb.scale.set(1 + Math.sin(elapsedTime * 4) * 0.12, 1 + Math.sin(elapsedTime * 4) * 0.12, 1 + Math.sin(elapsedTime * 4) * 0.12);

      // Animate Floating Cyber Particles
      const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
      const pArray = posAttr.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pArray[i * 3 + 1] += particleSpeeds[i] * 0.02;
        if (pArray[i * 3 + 1] > 14) {
          pArray[i * 3 + 1] = 0.2;
        }
      }
      posAttr.needsUpdate = true;
      particleSystem.rotation.y = elapsedTime * 0.03;

      // Animate AI Droids & Neural Data Pulses
      characterMeshes.forEach((item, idx) => {
        const offset = idx * 0.6;
        const isBusy = item.agent.status === 'BUSY';
        const isReady = item.agent.status === 'READY';

        // Organic levitation bobbing
        item.mesh.position.y = Math.sin(elapsedTime * 2.5 + offset) * 0.06;

        // Counter-rotating hover rings
        item.hoverRing1.rotation.z = elapsedTime * 2;
        item.hoverRing2.rotation.z = -elapsedTime * 2.5;

        // Orbiting satellite subprocess orbs
        const satRadius = 0.5;
        const satSpeed = isBusy ? 4.5 : 2.0;
        item.satellite1.position.set(
          Math.cos(elapsedTime * satSpeed + offset) * satRadius,
          1.55 + Math.sin(elapsedTime * 2 + offset) * 0.1,
          Math.sin(elapsedTime * satSpeed + offset) * satRadius
        );
        item.satellite2.position.set(
          Math.cos(elapsedTime * satSpeed + offset + Math.PI) * satRadius,
          1.55 - Math.sin(elapsedTime * 2 + offset) * 0.1,
          Math.sin(elapsedTime * satSpeed + offset + Math.PI) * satRadius
        );

        // Neural Link Traveling Photon Pulse
        const pulseSpeed = isBusy ? 1.4 : 0.6;
        const pulseProgress = ((elapsedTime * pulseSpeed + offset) % 1);
        const pulsePt = item.dataCurve.getPoint(pulseProgress);
        item.pulseMesh.position.copy(pulsePt);

        // Update procedural terminal screen canvas every few frames
        if (Math.floor(elapsedTime * 24) % 4 === 0) {
          const sCtx = item.screenCtx;
          sCtx.fillStyle = '#060a14';
          sCtx.fillRect(0, 0, 256, 160);

          // Header
          sCtx.fillStyle = isBusy ? '#f59e0b' : '#38bdf8';
          sCtx.font = 'bold 13px monospace';
          sCtx.fillText(`[AGENT] ${item.agent.name.toUpperCase()}`, 10, 20);

          sCtx.font = '10px monospace';
          sCtx.fillStyle = '#64748b';
          sCtx.fillText(`ROLE: ${item.agent.role} | ${item.agent.modelId}`, 10, 36);

          // Simulated terminal lines / wave activity
          const numLines = 6;
          for (let li = 0; li < numLines; li++) {
            const yLine = 56 + li * 14;
            const lineProgress = ((elapsedTime * 3 + li * 2 + idx) % 10) / 10;
            sCtx.fillStyle = isBusy ? '#fbbf24' : '#0ea5e9';
            sCtx.fillRect(10, yLine, 30 + lineProgress * 180, 5);
          }

          // Status footer
          sCtx.fillStyle = isBusy ? '#f59e0b' : isReady ? '#10b981' : '#ef4444';
          sCtx.font = 'bold 11px monospace';
          sCtx.fillText(`● STATUS: ${item.agent.status}`, 10, 148);

          item.screenTex.needsUpdate = true;
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup resources
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);

      floorGeo.dispose();
      floorMat.dispose();
      floorTexture.dispose();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [agents, autoTour]);

  // Handle Preset Camera Views
  const handleApplyPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef;
    if (!camera || !controls) return;

    if (preset === 'cinematic') {
      setAutoTour(true);
      controls.autoRotate = true;
      camera.position.set(0, 13, 20);
      controls.target.set(0, 1.5, 0);
    } else if (preset === 'tactical') {
      setAutoTour(false);
      controls.autoRotate = false;
      camera.position.set(0, 22, 12);
      controls.target.set(0, 1.5, 0);
    } else if (preset === 'core') {
      setAutoTour(false);
      controls.autoRotate = false;
      camera.position.set(0, 4.5, 8);
      controls.target.set(0, 2.5, 0);
    } else if (preset === 'front') {
      setAutoTour(false);
      controls.autoRotate = false;
      camera.position.set(0, 8, 17);
      controls.target.set(0, 1.5, 0);
    }
  };

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
    <div className="relative w-full h-[440px] lg:h-[500px] bg-[#060911] rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl shadow-blue-950/30 group">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Top Left: Title Badge & Camera Preset Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 flex-wrap">
        <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-xs font-semibold text-white flex items-center gap-2 shadow-lg">
          <Monitor className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="font-bold">Virtual 3D Command Deck</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">
            {agents.length} Neural Nodes
          </span>
        </div>

        {/* Camera Preset Selector */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 text-xs shadow-lg">
          <button
            onClick={() => handleApplyPreset('cinematic')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ${
              activePreset === 'cinematic'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Kamera Berputar Sinematik"
          >
            <RotateCw className="w-3 h-3" />
            <span>Orbit</span>
          </button>
          <button
            onClick={() => handleApplyPreset('tactical')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ${
              activePreset === 'tactical'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tampilan Taktikal Atas"
          >
            <Compass className="w-3 h-3" />
            <span>Taktikal</span>
          </button>
          <button
            onClick={() => handleApplyPreset('core')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ${
              activePreset === 'core'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Fokus Quantum Hologram Core"
          >
            <Zap className="w-3 h-3 text-cyan-400" />
            <span>Core</span>
          </button>
          <button
            onClick={() => handleApplyPreset('front')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ${
              activePreset === 'front'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tampilan Depan Operasi"
          >
            <Eye className="w-3 h-3" />
            <span>Depan</span>
          </button>
        </div>
      </div>

      {/* Top Right: View Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={() => {
            const nextTour = !autoTour;
            setAutoTour(nextTour);
            if (controlsRef) controlsRef.autoRotate = nextTour;
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border backdrop-blur-md transition flex items-center gap-1.5 shadow-lg ${
            autoTour
              ? 'bg-blue-600/30 border-blue-500 text-blue-300'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Nyalakan/matikan rotasi otomatis kamera"
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoTour ? 'animate-spin' : ''}`} />
          <span>Auto-Tour</span>
        </button>

        <button
          onClick={onFallbackTo2D}
          className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition shadow-lg flex items-center gap-1.5"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>2D Mode</span>
        </button>
      </div>

      {/* Hover Info Tooltip */}
      {hoveredAgent && (
        <div className="absolute bottom-4 left-4 z-10 p-3.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-blue-500/50 text-xs shadow-2xl shadow-blue-950/50 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none max-w-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-bold text-white text-sm">{hoveredAgent.name}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {hoveredAgent.role}
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${hoveredAgent.status === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : hoveredAgent.status === 'BUSY' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
              {hoveredAgent.status}
            </span>
          </div>
          <p className="text-slate-400 text-[11px] font-mono mb-1">
            Model: <span className="text-white font-semibold">{hoveredAgent.modelId}</span> via {hoveredAgent.providerName || 'Provider'}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mb-2">
            <span>Beban Tugas: {hoveredAgent.completedTasks || 0} / {hoveredAgent.totalTasks || 0}</span>
            <span>•</span>
            <span>{hoveredAgent.totalRuns || 0} Runs</span>
          </div>
          <p className="text-cyan-400 text-[11px] font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3 animate-spin" />
            <span>Klik avatar droid untuk membuka inspeksi & instruksi</span>
          </p>
        </div>
      )}

      {/* Interactive Navigation Guide Footer */}
      <div className="absolute bottom-3 right-4 z-10 text-[11px] text-slate-400 font-mono hidden sm:flex items-center gap-3 pointer-events-none bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80">
        <span>🖱️ Drag: Putar 360°</span>
        <span>•</span>
        <span>Scroll: Zoom In/Out</span>
        <span>•</span>
        <span>Klik Avatar: Inspeksi Agen</span>
      </div>
    </div>
  );
};
