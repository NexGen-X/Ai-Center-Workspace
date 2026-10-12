import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AIAgent, DashboardSummary, ServerMetrics, Activity } from '../../../../shared/types.js';
import {
  RotateCw,
  Zap,
  Activity as ActivityIcon,
  Layers,
  Sparkles,
  Plus,
  Cpu,
  HardDrive,
  Clock,
  Radio,
  X,
  Volume2,
  VolumeX,
  Server,
  Shield,
  Compass,
  CheckCircle2
} from 'lucide-react';
import { audioService } from '../../services/audio.js';

interface Workspace3DProps {
  agents: AIAgent[];
  summary: DashboardSummary | null;
  serverMetrics: ServerMetrics | null;
  activities: Activity[];
  currentUser: any;
  onSelectAgent: (agent: AIAgent) => void;
  onOpenCreateTask: () => void;
  onOpenTasks: () => void;
  onOpenProjects: () => void;
  onOpenManageTeam: () => void;
  onFallbackTo2D: () => void;
}

export const Workspace3D: React.FC<Workspace3DProps> = ({
  agents,
  summary,
  serverMetrics,
  activities,
  currentUser,
  onSelectAgent,
  onOpenCreateTask,
  onOpenTasks,
  onOpenProjects,
  onOpenManageTeam,
  onFallbackTo2D
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoTour, setAutoTour] = useState(false);
  const [activeCamView, setActiveCamView] = useState<'overview' | 'task_wall' | 'server_rack' | 'isometric' | 'agent' | 'tour'>('overview');
  const [isAudioMuted, setIsAudioMuted] = useState(() => audioService.isMuted());
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<AIAgent | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [webGlSupported, setWebGlSupported] = useState(true);

  // References for camera transitions
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const targetCamPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 15, 23));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 2.5, 0));

  const operatorName = currentUser?.displayName || 'Yulian';

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
    const height = container.clientHeight || 560;

    // 1. Scene, Camera, High-Fidelity Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14); // Deep space cyber dark
    scene.fog = new THREE.FogExp2(0x070b14, 0.018);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 15, 23);
    camera.lookAt(0, 2.5, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 2. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 5;
    controls.maxDistance = 45;
    controls.target.set(0, 2.5, 0);
    controlsRef.current = controls;

    // 3. Cinematic Studio & Cybernetic Lighting
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.2);
    scene.add(ambientLight);

    // Main key light with soft shadow map
    const mainSun = new THREE.DirectionalLight(0xf1f5f9, 2.2);
    mainSun.position.set(16, 28, 18);
    mainSun.castShadow = true;
    mainSun.shadow.mapSize.width = 2048;
    mainSun.shadow.mapSize.height = 2048;
    mainSun.shadow.camera.near = 0.5;
    mainSun.shadow.camera.far = 80;
    mainSun.shadow.bias = -0.0001;
    mainSun.shadow.normalBias = 0.02;
    scene.add(mainSun);

    // Cool cyan volumetric fill
    const cyanFill = new THREE.DirectionalLight(0x06b6d4, 1.4);
    cyanFill.position.set(-18, 16, -10);
    scene.add(cyanFill);

    // Deep purple rim light for metallic edge bevels
    const purpleRim = new THREE.DirectionalLight(0x8b5cf6, 1.1);
    purpleRim.position.set(0, 18, -20);
    scene.add(purpleRim);

    // Core Holo-Pedestal Point Light (Pulsing glow on floor)
    const holoPointLight = new THREE.PointLight(0x06b6d4, 2.5, 14);
    holoPointLight.position.set(0, 3.2, 1.5);
    scene.add(holoPointLight);

    // Server rack amber/cyan accent point lights
    const serverLight = new THREE.PointLight(0x38bdf8, 2.0, 12);
    serverLight.position.set(-15, 3.0, 0);
    scene.add(serverLight);

    // 4. Procedural High-Gloss Carbon-Fiber / Circuit Epoxy Floor
    const createCyberFloorTexture = () => {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 1024;
      const ctx = c.getContext('2d')!;

      // Dark obsidian titanium base
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, 1024, 1024);

      // Beveled tile grid
      const tileSize = 128;
      ctx.strokeStyle = '#152033';
      ctx.lineWidth = 3;
      for (let x = 0; x <= 1024; x += tileSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1024);
        ctx.stroke();
      }
      for (let y = 0; y <= 1024; y += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();
      }

      // High-tech circuit traces and junction micro-dots
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.lineWidth = 1.5;
      for (let x = tileSize; x < 1024; x += tileSize * 2) {
        ctx.beginPath();
        ctx.moveTo(x, 30);
        ctx.lineTo(x, 1024 - 30);
        ctx.stroke();
      }

      ctx.fillStyle = '#38bdf8';
      for (let x = 0; x <= 1024; x += tileSize) {
        for (let y = 0; y <= 1024; y += tileSize) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(5, 4);
      return tex;
    };

    const floorGeo = new THREE.PlaneGeometry(42, 34);
    const floorMat = new THREE.MeshStandardMaterial({
      map: createCyberFloorTexture(),
      roughness: 0.22,
      metalness: 0.85
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 5. Architectural Walls, Cyber Columns, and Overhead Cable Trusses
    // A. Back Mainframe Wall
    const backWallGeo = new THREE.PlaneGeometry(42, 16);
    const backWallMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.6,
      metalness: 0.7
    });
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(0, 8, -9.5);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // B. Left Server Wall
    const leftWallGeo = new THREE.PlaneGeometry(34, 16);
    const leftWallMat = new THREE.MeshStandardMaterial({
      color: 0x0d1424,
      roughness: 0.5,
      metalness: 0.8
    });
    const leftWall = new THREE.Mesh(leftWallGeo, leftWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-20.5, 8, 7);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // C. Right Security Perimeter Wall
    const rightWall = new THREE.Mesh(leftWallGeo, leftWallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(20.5, 8, 7);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // Overhead Light Truss Beams with Neon Emissive Strips
    [-4, 2, 8].forEach((tz) => {
      const trussGeo = new THREE.BoxGeometry(40, 0.35, 0.35);
      const trussMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.4 });
      const truss = new THREE.Mesh(trussGeo, trussMat);
      truss.position.set(0, 12.5, tz);
      scene.add(truss);

      // Embedded LED Strip underneath truss
      const ledGeo = new THREE.BoxGeometry(36, 0.06, 0.08);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(0, 12.28, tz);
      scene.add(led);
    });

    // 6. Massive Curved Holographic Command Wall (Projector Dashboard)
    const projCanvas = document.createElement('canvas');
    projCanvas.width = 1024;
    projCanvas.height = 512;
    const pctx = projCanvas.getContext('2d')!;
    const projTex = new THREE.CanvasTexture(projCanvas);

    const projGeo = new THREE.PlaneGeometry(16.5, 8.2);
    const projMat = new THREE.MeshBasicMaterial({
      map: projTex,
      side: THREE.DoubleSide
    });
    const projScreen = new THREE.Mesh(projGeo, projMat);
    projScreen.position.set(0, 7.8, -9.4);
    scene.add(projScreen);

    // Glowing border frame for the holographic screen
    const screenFrameGeo = new THREE.BoxGeometry(16.8, 8.5, 0.08);
    const screenFrameMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.3
    });
    const screenFrame = new THREE.Mesh(screenFrameGeo, screenFrameMat);
    screenFrame.position.set(0, 7.8, -9.45);
    scene.add(screenFrame);

    const updateProjectorScreen = () => {
      // Background gradient
      const bgGrad = pctx.createLinearGradient(0, 0, 1024, 512);
      bgGrad.addColorStop(0, '#090e1a');
      bgGrad.addColorStop(0.5, '#0d1527');
      bgGrad.addColorStop(1, '#080d17');
      pctx.fillStyle = bgGrad;
      pctx.fillRect(0, 0, 1024, 512);

      // High-tech header bar
      pctx.fillStyle = 'rgba(14, 165, 233, 0.15)';
      pctx.fillRect(0, 0, 1024, 130);
      pctx.strokeStyle = '#0284c7';
      pctx.lineWidth = 2;
      pctx.beginPath();
      pctx.moveTo(0, 130);
      pctx.lineTo(1024, 130);
      pctx.stroke();

      // System Title & Welcome
      pctx.font = 'bold 36px "Segoe UI", sans-serif';
      pctx.fillStyle = '#ffffff';
      pctx.fillText(`AI COMMAND CENTER • OPERATOR: ${operatorName.toUpperCase()}`, 50, 65);

      pctx.font = '19px monospace';
      pctx.fillStyle = '#38bdf8';
      pctx.fillText('STATUS: ALL NEURAL SYSTEMS NOMINAL • QUANTUM ENCRYPTION ACTIVE', 50, 105);

      // KPI Metric Cards
      const runningCount = summary?.runningTasksCount ?? 0;
      const completedCount = summary?.completedTasksCount ?? 2;
      const onlineAgents = summary?.onlineAgentsCount ?? agents.filter((a) => a.status === 'READY').length;
      const totalAgents = summary?.totalAgentsCount ?? agents.length;
      const activeProj = summary?.activeProjectsCount ?? 2;

      const metrics = [
        { label: 'ACTIVE TASKS', val: `${runningCount}`, col: '#38bdf8' },
        { label: 'COMPLETED TODAY', val: `${completedCount}`, col: '#34d399' },
        { label: 'AGENT SWARM', val: `${onlineAgents}/${totalAgents} READY`, col: '#a855f7' },
        { label: 'ACTIVE PIPELINES', val: `${activeProj}`, col: '#f59e0b' }
      ];

      metrics.forEach((m, idx) => {
        const cx = 50 + idx * 230;
        const cy = 160;
        pctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        pctx.beginPath();
        pctx.roundRect(cx, cy, 215, 135, 14);
        pctx.fill();

        pctx.strokeStyle = '#1e293b';
        pctx.lineWidth = 1.5;
        pctx.stroke();

        // Top accent line
        pctx.fillStyle = m.col;
        pctx.fillRect(cx, cy, 215, 4);

        pctx.font = 'bold 14px monospace';
        pctx.fillStyle = '#94a3b8';
        pctx.fillText(m.label, cx + 20, cy + 38);

        pctx.font = 'bold 34px monospace';
        pctx.fillStyle = '#ffffff';
        pctx.fillText(m.val, cx + 20, cy + 96);
      });

      // Bottom Telemetry Waveform Box
      pctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      pctx.beginPath();
      pctx.roundRect(50, 325, 924, 145, 16);
      pctx.fill();
      pctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      pctx.stroke();

      pctx.font = 'bold 16px monospace';
      pctx.fillStyle = '#38bdf8';
      pctx.fillText('LIVE TELEMETRY STREAM & ORCHESTRATION EVENT BUS', 80, 365);

      // Waveform line simulation
      pctx.strokeStyle = '#06b6d4';
      pctx.lineWidth = 2.5;
      pctx.beginPath();
      for (let x = 80; x <= 940; x += 20) {
        const y = 420 + Math.sin(x * 0.05) * 18 + Math.cos(x * 0.02) * 12;
        if (x === 80) pctx.moveTo(x, y);
        else pctx.lineTo(x, y);
      }
      pctx.stroke();

      projTex.needsUpdate = true;
    };
    updateProjectorScreen();

    // 7. Centerpiece: High-Tech 3D Quantum Holo-Pedestal & Hologram Core
    const holoGroup = new THREE.Group();
    holoGroup.position.set(0, 0, 1.5);

    // Pedestal Base Cylinder with brushed titanium
    const pedBaseGeo = new THREE.CylinderGeometry(2.6, 3.0, 0.65, 32);
    const pedBaseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.2
    });
    const pedBase = new THREE.Mesh(pedBaseGeo, pedBaseMat);
    pedBase.position.set(0, 0.325, 0);
    pedBase.receiveShadow = true;
    pedBase.castShadow = true;
    holoGroup.add(pedBase);

    // Glowing Neon Recessed Energy Ring
    const pedRingGeo = new THREE.CylinderGeometry(2.35, 2.35, 0.12, 32);
    const pedRingMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const pedRing = new THREE.Mesh(pedRingGeo, pedRingMat);
    pedRing.position.set(0, 0.68, 0);
    holoGroup.add(pedRing);

    // Holographic Emitter Projector Lens
    const lensGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.25, 32);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.1 });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0, 0.78, 0);
    holoGroup.add(lens);

    // 3D Holographic Wireframe Globe / Icosahedron
    const holoGlobeGeo = new THREE.IcosahedronGeometry(1.35, 2);
    const holoGlobeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      wireframe: true,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85
    });
    const holoGlobe = new THREE.Mesh(holoGlobeGeo, holoGlobeMat);
    holoGlobe.position.set(0, 3.2, 0);
    holoGroup.add(holoGlobe);

    // Inner Glowing Core Sphere
    const holoCoreGeo = new THREE.SphereGeometry(0.75, 24, 24);
    const holoCoreMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.65
    });
    const holoCore = new THREE.Mesh(holoCoreGeo, holoCoreMat);
    holoCore.position.set(0, 3.2, 0);
    holoGroup.add(holoCore);

    // Concentric Holographic Orbital Rings
    const ring1Geo = new THREE.RingGeometry(1.9, 1.98, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const holoRing1 = new THREE.Mesh(ring1Geo, ringMat);
    holoRing1.position.set(0, 3.2, 0);
    holoRing1.rotation.x = Math.PI / 3;
    holoGroup.add(holoRing1);

    const ring2Geo = new THREE.RingGeometry(2.3, 2.38, 48);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
    const holoRing2 = new THREE.Mesh(ring2Geo, ringMat2);
    holoRing2.position.set(0, 3.2, 0);
    holoRing2.rotation.y = Math.PI / 4;
    holoGroup.add(holoRing2);

    scene.add(holoGroup);

    // 8. Enterprise Supercomputer Server Rack Cluster (Left Side)
    const serverCluster = new THREE.Group();
    serverCluster.position.set(-16.5, 0, -1);

    const rackUnitGeo = new THREE.BoxGeometry(2.4, 5.8, 2.2);
    const rackUnitMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f19,
      metalness: 0.9,
      roughness: 0.3
    });

    const rackGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.45,
      roughness: 0.05,
      metalness: 0.2,
      transmission: 0.6
    });

    const rackLeds: THREE.Mesh[] = [];

    [-3.2, 0, 3.2].forEach((offsetZ, rIdx) => {
      const rack = new THREE.Mesh(rackUnitGeo, rackUnitMat);
      rack.position.set(0, 2.9, offsetZ);
      rack.castShadow = true;
      rack.receiveShadow = true;
      serverCluster.add(rack);

      // Glass front door
      const glassDoorGeo = new THREE.BoxGeometry(0.08, 5.4, 2.0);
      const glassDoor = new THREE.Mesh(glassDoorGeo, rackGlassMat);
      glassDoor.position.set(1.22, 2.9, offsetZ);
      serverCluster.add(glassDoor);

      // Multiple rack blades with blinking LEDs inside
      for (let bi = 0; bi < 8; bi++) {
        const bladeY = 0.8 + bi * 0.65;
        const bladeGeo = new THREE.BoxGeometry(2.0, 0.48, 1.9);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.5 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(0.1, bladeY, offsetZ);
        serverCluster.add(blade);

        // Blinking LED status lights
        for (let li = 0; li < 4; li++) {
          const ledGeo = new THREE.SphereGeometry(0.045, 8, 8);
          const ledColor = li === 0 ? 0x10b981 : li === 1 ? 0x38bdf8 : li === 2 ? 0xf59e0b : 0x06b6d4;
          const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
          const led = new THREE.Mesh(ledGeo, ledMat);
          led.position.set(1.15, bladeY, offsetZ - 0.6 + li * 0.4);
          serverCluster.add(led);
          rackLeds.push(led);
        }
      }

      // Fluorescent liquid-cooling tube
      const tubeGeo = new THREE.CylinderGeometry(0.06, 0.06, 5.0, 16);
      const tubeMat = new THREE.MeshBasicMaterial({ color: rIdx === 1 ? 0xa855f7 : 0x06b6d4 });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.position.set(1.05, 2.9, offsetZ + 0.85);
      serverCluster.add(tube);
    });

    scene.add(serverCluster);

    // 9. Floating Atmospheric Data Dust Particles
    const particleCount = 240;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 36;
      particlePositions[i + 1] = Math.random() * 12 + 0.5;
      particlePositions[i + 2] = (Math.random() - 0.5) * 28;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.08,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 10. Workstations & Realistic Cybernetic Agent Avatars
    const interactiveMeshes: THREE.Mesh[] = [];
    const agentMap = new Map<THREE.Mesh, AIAgent>();
    const agentPositions: { agent: AIAgent; pos: THREE.Vector3 }[] = [];
    const animatedAgentGroups: {
      group: THREE.Group;
      head: THREE.Mesh;
      reactor: THREE.Mesh;
      auraRing: THREE.Mesh;
      wristHolo: THREE.Mesh;
      baseY: number;
      index: number;
    }[] = [];

    // Desk clusters: 2 Left, 2 Right
    const deskConfigs = [
      { deskPos: new THREE.Vector3(-10.5, 0, -2.5), charPos: new THREE.Vector3(-8.8, 0, -2.5), isStanding: true },
      { deskPos: new THREE.Vector3(-10.5, 0, 3.8), charPos: new THREE.Vector3(-10.5, 0, 4.8), isStanding: false },
      { deskPos: new THREE.Vector3(10.5, 0, -2.5), charPos: new THREE.Vector3(10.5, 0, -1.5), isStanding: false },
      { deskPos: new THREE.Vector3(10.5, 0, 3.8), charPos: new THREE.Vector3(12.2, 0, 3.8), isStanding: true }
    ];

    agents.forEach((agent, index) => {
      const cfg = deskConfigs[index % deskConfigs.length];
      const deskOffset = Math.floor(index / deskConfigs.length) * 1.0;
      const deskX = cfg.deskPos.x + (index >= 4 ? (cfg.deskPos.x > 0 ? 3.5 : -3.5) : 0);
      const deskZ = cfg.deskPos.z + deskOffset;

      // Workstation Desk Group
      const deskGroup = new THREE.Group();
      deskGroup.position.set(deskX, 0, deskZ);

      // Sleek Tempered Glass & Titanium Desk Surface
      const deskTopGeo = new THREE.BoxGeometry(3.8, 0.12, 1.9);
      const deskTopMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.9,
        roughness: 0.15
      });
      const deskTop = new THREE.Mesh(deskTopGeo, deskTopMat);
      deskTop.position.set(0, 1.35, 0);
      deskTop.castShadow = true;
      deskTop.receiveShadow = true;
      deskGroup.add(deskTop);

      // Cantilever Beveled Legs with Blue Neon Inset
      const deskLegMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.2 });
      [-1.75, 1.75].forEach((lx) => {
        const legGeo = new THREE.BoxGeometry(0.12, 1.35, 1.6);
        const leg = new THREE.Mesh(legGeo, deskLegMat);
        leg.position.set(lx, 0.675, 0);
        leg.castShadow = true;
        deskGroup.add(leg);

        const neonBarGeo = new THREE.BoxGeometry(0.13, 1.1, 0.06);
        const neonBarMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
        const neonBar = new THREE.Mesh(neonBarGeo, neonBarMat);
        neonBar.position.set(lx, 0.675, 0);
        deskGroup.add(neonBar);
      });

      // Curved Ultra-Wide High-Tech Holographic Dual Monitor Setup
      [-0.75, 0.75].forEach((mx) => {
        const monFrameGeo = new THREE.BoxGeometry(1.2, 0.75, 0.08);
        const monFrameMat = new THREE.MeshStandardMaterial({ color: 0x030712, metalness: 0.9 });
        const monFrame = new THREE.Mesh(monFrameGeo, monFrameMat);
        monFrame.position.set(mx, 2.05, -0.45);
        monFrame.rotation.y = mx > 0 ? -0.15 : 0.15;
        monFrame.castShadow = true;
        deskGroup.add(monFrame);

        // Active emissive screen display
        const monScreenGeo = new THREE.PlaneGeometry(1.15, 0.7);
        const monScreenMat = new THREE.MeshBasicMaterial({
          color: agent.status === 'BUSY' ? 0xf59e0b : 0x0284c7
        });
        const monScreen = new THREE.Mesh(monScreenGeo, monScreenMat);
        monScreen.position.set(mx, 2.05, -0.4);
        monScreen.rotation.y = mx > 0 ? -0.15 : 0.15;
        deskGroup.add(monScreen);
      });

      // Ergonomic Swivel Mesh Chair
      const chairGroup = new THREE.Group();
      chairGroup.position.set(0, 0, 1.0);
      const chairSeatGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.12, 24);
      const chairSeatMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
      const chairSeat = new THREE.Mesh(chairSeatGeo, chairSeatMat);
      chairSeat.position.set(0, 0.75, 0);
      chairSeat.castShadow = true;
      chairGroup.add(chairSeat);

      const chairBackGeo = new THREE.BoxGeometry(0.8, 0.9, 0.1);
      const chairBack = new THREE.Mesh(chairBackGeo, chairSeatMat);
      chairBack.position.set(0, 1.25, 0.35);
      chairBack.castShadow = true;
      chairGroup.add(chairBack);

      const chairStemGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.75, 12);
      const chairStemMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
      const chairStem = new THREE.Mesh(chairStemGeo, chairStemMat);
      chairStem.position.set(0, 0.375, 0);
      chairGroup.add(chairStem);
      deskGroup.add(chairGroup);

      scene.add(deskGroup);

      // =========================================================================
      // REALISTIC CYBERNETIC ANDROID / HUMANOID AGENT MODEL
      // =========================================================================
      const charX = cfg.charPos.x + (index >= 4 ? (cfg.charPos.x > 0 ? 3.5 : -3.5) : 0);
      const charZ = cfg.charPos.z + deskOffset;
      const charGroup = new THREE.Group();
      charGroup.position.set(charX, 0, charZ);

      if (cfg.isStanding) {
        charGroup.lookAt(charX + (deskX > charX ? 1 : -1), 0, charZ);
      } else {
        charGroup.lookAt(deskX, 0, deskZ);
      }

      // Role Theme Color
      const roleColor =
        agent.role === 'Orchestrator'
          ? 0x06b6d4 // Cyan
          : agent.role === 'Planner'
          ? 0xa855f7 // Purple
          : agent.role === 'Executor'
          ? 0x10b981 // Emerald
          : agent.role === 'QA / Reviewer'
          ? 0xf59e0b // Amber
          : 0xec4899; // Pink

      // 1. Holographic Floor Aura Ring (Under Agent Feet)
      const auraRingGeo = new THREE.RingGeometry(0.75, 0.88, 32);
      const auraRingMat = new THREE.MeshBasicMaterial({
        color: roleColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const auraRing = new THREE.Mesh(auraRingGeo, auraRingMat);
      auraRing.rotation.x = -Math.PI / 2;
      auraRing.position.set(0, 0.02, 0);
      charGroup.add(auraRing);

      // 2. Reinforced Tactical Boots
      const bootMat = new THREE.MeshStandardMaterial({ color: 0x020617, metalness: 0.8, roughness: 0.3 });
      const toeMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
      [-0.18, 0.18].forEach((bx) => {
        const bootGeo = new THREE.BoxGeometry(0.18, 0.22, 0.38);
        const boot = new THREE.Mesh(bootGeo, bootMat);
        boot.position.set(bx, 0.11, 0.05);
        boot.castShadow = true;
        charGroup.add(boot);

        const toeGeo = new THREE.BoxGeometry(0.16, 0.12, 0.14);
        const toe = new THREE.Mesh(toeGeo, toeMat);
        toe.position.set(bx, 0.08, 0.24);
        charGroup.add(toe);
      });

      // 3. Articulated Exoskeleton Legs
      const legGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.82, 16);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.4 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.18, 0.52, 0);
      legL.castShadow = true;
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(0.18, 0.52, 0);
      legR.castShadow = true;
      charGroup.add(legL);
      charGroup.add(legR);

      // Knee Guards with Role Accent
      [-0.18, 0.18].forEach((kx) => {
        const kneeGeo = new THREE.BoxGeometry(0.16, 0.18, 0.14);
        const kneeMat = new THREE.MeshStandardMaterial({ color: roleColor, metalness: 0.8, roughness: 0.3 });
        const knee = new THREE.Mesh(kneeGeo, kneeMat);
        knee.position.set(kx, 0.55, 0.1);
        charGroup.add(knee);
      });

      // 4. Tactical Utility Belt & Hip Chassis
      const beltGeo = new THREE.BoxGeometry(0.68, 0.14, 0.42);
      const beltMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
      const belt = new THREE.Mesh(beltGeo, beltMat);
      belt.position.set(0, 0.98, 0);
      charGroup.add(belt);

      // 5. High-Detail Armored Torso with Pectoral Plates
      const torsoGeo = new THREE.BoxGeometry(0.66, 0.75, 0.38);
      const torsoMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.85,
        roughness: 0.35
      });
      const torso = new THREE.Mesh(torsoGeo, torsoMat);
      torso.position.set(0, 1.4, 0);
      torso.castShadow = true;
      charGroup.add(torso);

      // Chest Armor Plates (Left & Right)
      [-0.15, 0.15].forEach((cx) => {
        const chestPlateGeo = new THREE.BoxGeometry(0.26, 0.32, 0.12);
        const chestPlateMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          metalness: 0.9,
          roughness: 0.25
        });
        const chestPlate = new THREE.Mesh(chestPlateGeo, chestPlateMat);
        chestPlate.position.set(cx, 1.5, 0.18);
        charGroup.add(chestPlate);
      });

      // Central Arc-Reactor / Quantum Energy Core (Chest)
      const reactorGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16);
      const reactorMat = new THREE.MeshStandardMaterial({
        color: roleColor,
        emissive: roleColor,
        emissiveIntensity: 1.8
      });
      const reactor = new THREE.Mesh(reactorGeo, reactorMat);
      reactor.rotation.x = Math.PI / 2;
      reactor.position.set(0, 1.48, 0.22);
      charGroup.add(reactor);

      // Shoulder Pauldrons (Left & Right)
      [-0.42, 0.42].forEach((sx) => {
        const pauldronGeo = new THREE.BoxGeometry(0.2, 0.22, 0.3);
        const pauldronMat = new THREE.MeshStandardMaterial({ color: roleColor, metalness: 0.85, roughness: 0.3 });
        const pauldron = new THREE.Mesh(pauldronGeo, pauldronMat);
        pauldron.position.set(sx, 1.7, 0);
        pauldron.castShadow = true;
        charGroup.add(pauldron);
      });

      // 6. Arms & Forearm Wrist Gauntlets
      const armMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.4 });
      [-0.38, 0.38].forEach((ax) => {
        const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.65, 12);
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.set(ax, 1.35, 0);
        arm.castShadow = true;
        charGroup.add(arm);
      });

      // Floating Mini Holographic Screen on Left Wrist Gauntlet
      const wristHoloGeo = new THREE.PlaneGeometry(0.35, 0.22);
      const wristHoloMat = new THREE.MeshBasicMaterial({
        color: roleColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const wristHolo = new THREE.Mesh(wristHoloGeo, wristHoloMat);
      wristHolo.position.set(-0.48, 1.25, 0.2);
      wristHolo.rotation.set(-0.3, 0.5, 0.2);
      charGroup.add(wristHolo);

      // Standing Agent Data Tablet / Pad in Hand
      if (cfg.isStanding) {
        const padGeo = new THREE.BoxGeometry(0.28, 0.04, 0.42);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x020617, metalness: 0.9 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(0.32, 1.15, 0.35);
        pad.rotation.set(0.4, 0.2, -0.3);
        charGroup.add(pad);

        const padScreenGeo = new THREE.PlaneGeometry(0.24, 0.36);
        const padScreenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const padScreen = new THREE.Mesh(padScreenGeo, padScreenMat);
        padScreen.rotation.x = -Math.PI / 2;
        padScreen.position.set(0.32, 1.18, 0.35);
        padScreen.rotation.set(-Math.PI / 2 + 0.4, 0, -0.3);
        charGroup.add(padScreen);
      }

      // 7. Articulated Neck & Cybernetic Helmet Head
      const neckGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.2, 16);
      const neckMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
      const neck = new THREE.Mesh(neckGeo, neckMat);
      neck.position.set(0, 1.82, 0);
      charGroup.add(neck);

      // Cyber Helmet Shell
      const helmetGeo = new THREE.SphereGeometry(0.32, 24, 24);
      const helmetMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.9,
        roughness: 0.2
      });
      const head = new THREE.Mesh(helmetGeo, helmetMat);
      head.position.set(0, 2.05, 0);
      head.castShadow = true;
      charGroup.add(head);

      // Curved Luminescent Visor (High-Tech Glow)
      const visorGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 24, 1, false, 0, Math.PI);
      const visorMat = new THREE.MeshStandardMaterial({
        color: roleColor,
        emissive: roleColor,
        emissiveIntensity: 1.6,
        roughness: 0.1,
        metalness: 0.9
      });
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.rotation.y = Math.PI / 2;
      visor.position.set(0, 2.04, 0.14);
      charGroup.add(visor);

      // Tactical Headset / Antenna with Blinking Comms LED
      const antennaGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8);
      const antennaMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
      const antenna = new THREE.Mesh(antennaGeo, antennaMat);
      antenna.position.set(-0.32, 2.25, -0.05);
      antenna.rotation.z = -0.2;
      charGroup.add(antenna);

      const commsLedGeo = new THREE.SphereGeometry(0.04, 8, 8);
      const commsLedMat = new THREE.MeshBasicMaterial({ color: agent.status === 'BUSY' ? 0xf59e0b : 0x10b981 });
      const commsLed = new THREE.Mesh(commsLedGeo, commsLedMat);
      commsLed.position.set(-0.35, 2.4, -0.05);
      charGroup.add(commsLed);

      // 8. Floating 3D Holographic Name & Role Billboard (Canvas Billboard)
      const createNameplateTexture = () => {
        const nc = document.createElement('canvas');
        nc.width = 384;
        nc.height = 128;
        const nctx = nc.getContext('2d')!;

        // Holographic container box
        nctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        nctx.beginPath();
        nctx.roundRect(10, 10, 364, 108, 18);
        nctx.fill();

        nctx.strokeStyle = agent.status === 'BUSY' ? '#f59e0b' : '#38bdf8';
        nctx.lineWidth = 3;
        nctx.stroke();

        // Pulsing status dot
        nctx.fillStyle = agent.status === 'BUSY' ? '#f59e0b' : '#10b981';
        nctx.beginPath();
        nctx.arc(36, 44, 9, 0, Math.PI * 2);
        nctx.fill();

        // Agent Name
        nctx.font = 'bold 28px "Segoe UI", sans-serif';
        nctx.fillStyle = '#ffffff';
        nctx.fillText(agent.name, 56, 52);

        // Role & Status
        nctx.font = 'bold 18px monospace';
        nctx.fillStyle = '#94a3b8';
        nctx.fillText(`${agent.role.toUpperCase()} • ${agent.status}`, 36, 92);

        const nTex = new THREE.CanvasTexture(nc);
        return nTex;
      };

      const nameplateGeo = new THREE.PlaneGeometry(1.6, 0.55);
      const nameplateMat = new THREE.MeshBasicMaterial({
        map: createNameplateTexture(),
        transparent: true,
        side: THREE.DoubleSide
      });
      const nameplate = new THREE.Mesh(nameplateGeo, nameplateMat);
      nameplate.position.set(0, 2.75, 0);
      charGroup.add(nameplate);

      scene.add(charGroup);

      // Register interactive meshes for raycast picking (Head, Torso, and Nameplate)
      interactiveMeshes.push(head);
      interactiveMeshes.push(torso);
      interactiveMeshes.push(nameplate);
      agentMap.set(head, agent);
      agentMap.set(torso, agent);
      agentMap.set(nameplate, agent);
      agentPositions.push({ agent, pos: new THREE.Vector3(charX, 1.8, charZ) });

      animatedAgentGroups.push({
        group: charGroup,
        head,
        reactor,
        auraRing,
        wristHolo,
        baseY: 0,
        index
      });
    });

    // 11. Raycasting (Interaction & Hover)
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

    // 12. Resize Observer
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || 560;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // 13. Dynamic Render Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth camera interpolation
      if (activeCamView !== 'tour' && !autoTour) {
        camera.position.lerp(targetCamPos.current, 0.05);
        controls.target.lerp(targetLookAt.current, 0.05);
      } else {
        // Auto-tour orbital sweep
        const orbitRadius = 22;
        const orbitAngle = time * 0.14;
        camera.position.x = Math.sin(orbitAngle) * orbitRadius;
        camera.position.z = Math.cos(orbitAngle) * orbitRadius;
        camera.position.y = 14 + Math.sin(time * 0.25) * 2.2;
        controls.target.set(0, 2.5, 0);
      }

      // Rotate Holographic Core Globe & Orbital Tech Rings
      holoGlobe.rotation.y = time * 0.45;
      holoGlobe.rotation.x = Math.sin(time * 0.3) * 0.2;
      holoCore.scale.setScalar(1.0 + Math.sin(time * 2.5) * 0.08);
      holoRing1.rotation.z = time * 0.6;
      holoRing2.rotation.z = -time * 0.45;

      // Pulse Holo Point Light
      holoPointLight.intensity = 2.2 + Math.sin(time * 3.0) * 0.6;

      // Animate Living Agents (Breathing sway, head ambient scan, floor aura rotation)
      animatedAgentGroups.forEach((item) => {
        // Subtle breathing sway
        item.group.position.y = item.baseY + Math.sin(time * 2.2 + item.index) * 0.015;
        // Natural ambient head looking
        item.head.rotation.y = Math.sin(time * 1.4 + item.index) * 0.07;
        // Rotating tech aura ring on the floor
        item.auraRing.rotation.z = time * 0.5 + item.index;
        // Pulsing wrist holo
        item.wristHolo.rotation.z = Math.sin(time * 1.5 + item.index) * 0.05;
      });

      // Animate floating atmospheric dust particles
      const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] += Math.sin(time + positions[i - 1]) * 0.003;
        if (positions[i] > 14) positions[i] = 0.5;
      }
      posAttr.needsUpdate = true;

      // Blink server rack LEDs randomly
      if (Math.floor(time * 10) % 3 === 0 && rackLeds.length > 0) {
        const randomLed = rackLeds[Math.floor(Math.random() * rackLeds.length)];
        randomLed.visible = Math.random() > 0.3;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);

      floorGeo.dispose();
      floorMat.dispose();
      projCanvas.remove();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [agents, summary, operatorName]);

  // Camera Director Views
  const handleCamOverview = () => {
    audioService.playCameraSwitch();
    setActiveCamView('overview');
    setAutoTour(false);
    setSelectedAgentId(null);
    targetCamPos.current.set(0, 15, 23);
    targetLookAt.current.set(0, 2.5, 0);
  };

  const handleCamTaskWall = () => {
    audioService.playCameraSwitch();
    setActiveCamView('task_wall');
    setAutoTour(false);
    setSelectedAgentId(null);
    targetCamPos.current.set(0, 7.8, 6.0);
    targetLookAt.current.set(0, 7.8, -9.4);
  };

  const handleCamServerRack = () => {
    audioService.playCameraSwitch();
    setActiveCamView('server_rack');
    setAutoTour(false);
    setSelectedAgentId(null);
    targetCamPos.current.set(-11, 4.2, 5.0);
    targetLookAt.current.set(-16.5, 3.0, -1);
  };

  const handleCamIsometric = () => {
    audioService.playCameraSwitch();
    setActiveCamView('isometric');
    setAutoTour(false);
    setSelectedAgentId(null);
    targetCamPos.current.set(16, 16, 16);
    targetLookAt.current.set(0, 1.5, 0);
  };

  const handleCamFocusAgent = (agent: AIAgent) => {
    audioService.playCameraSwitch();
    setActiveCamView('agent');
    setAutoTour(false);
    setSelectedAgentId(agent.id);

    const targetAgentIndex = agents.findIndex((a) => a.id === agent.id);
    const isLeft = targetAgentIndex % 2 === 0;
    const ax = isLeft ? -9.5 : 9.5;
    const az = (targetAgentIndex % 4) * 1.5 - 1.5;

    targetCamPos.current.set(ax + (isLeft ? 4.2 : -4.2), 3.4, az + 4.2);
    targetLookAt.current.set(ax, 1.8, az);
  };

  const handleToggleAutoTour = () => {
    audioService.playClick();
    const nextState = !autoTour;
    setAutoTour(nextState);
    if (nextState) {
      setActiveCamView('tour');
    } else {
      handleCamOverview();
    }
  };

  const handleToggleSound = () => {
    const nextMuted = audioService.toggleMute();
    setIsAudioMuted(nextMuted);
  };

  if (!webGlSupported) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
        <h3 className="text-sm font-bold text-white">WebGL Tidak Didukung pada Browser Ini</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Perangkat Anda tidak mendukung akselerasi grafis 3D WebGL.
        </p>
        <button
          type="button"
          onClick={onFallbackTo2D}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white"
        >
          Beralih ke Tampilan 2D
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[480px] sm:h-[580px] lg:h-[700px] bg-[#070b14] rounded-2xl border border-cyan-500/30 overflow-hidden shadow-2xl shadow-cyan-950/40 select-none">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Floating Top-Left Card: ✦ Team • Live */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 flex flex-col gap-2 pointer-events-auto max-w-[calc(100%-16px)] sm:max-w-xs">
        <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-cyan-500/20 shadow-xl w-full">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2 pb-1.5 border-b border-slate-800/80">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>✦ AI Neural Swarm</span>
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active</span>
            </div>
          </div>

          {/* Member Chips */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-0.5 sm:pb-1">
            {agents.slice(0, 4).map((agent) => {
              const isSelected = selectedAgentId === agent.id;
              return (
                <div
                  key={agent.id}
                  onClick={() => handleCamFocusAgent(agent)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/20'
                      : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                  title={`Klik untuk fokus kamera ke ${agent.name}`}
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                    {agent.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-[11px] block leading-tight truncate max-w-[70px]">
                      {agent.name}
                    </span>
                    <span className="text-[9px] text-cyan-400 font-mono block leading-tight">
                      {agent.status === 'BUSY' ? 'executing' : 'ready'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Right Panel: Server & Layanan + Aktivitas Terbaru */}
      {isSidebarOpen && (
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-30 w-[calc(100%-16px)] sm:w-80 max-h-[85%] sm:max-h-[88%] flex flex-col gap-2.5 sm:gap-3 pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-right-4">
          {/* Top Panel: Server & Layanan • live */}
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-cyan-500/20 shadow-xl space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>Supercomputer Telemetry</span>
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>online</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition"
                  title="Tutup panel"
                  aria-label="Tutup panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>CPU Load</span>
                </span>
                <span className="font-bold text-emerald-400">
                  {serverMetrics?.cpuUsagePercent ?? 8.2}% ({serverMetrics?.cpuCores ?? 2} Core)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>VRAM / RAM</span>
                </span>
                <span className="font-bold text-cyan-400">
                  {serverMetrics
                    ? `${(serverMetrics.memoryUsedBytes / (1024 * 1024)).toFixed(0)} / ${(
                        serverMetrics.memoryTotalBytes / (1024 * 1024)
                      ).toFixed(0)} MB`
                    : '1434 / 1936 MB'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-pink-400" />
                  <span>Storage NVMe</span>
                </span>
                <span className="font-bold text-slate-300">
                  {serverMetrics
                    ? `${(serverMetrics.diskUsedBytes / (1024 * 1024 * 1024)).toFixed(1)} / ${(
                        serverMetrics.diskTotalBytes / (1024 * 1024 * 1024)
                      ).toFixed(1)} GB`
                    : '19.6 / 42.2 GB'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ActivityIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Load Avg</span>
                </span>
                <span className="font-bold text-emerald-400">
                  {serverMetrics?.loadAvg ? serverMetrics.loadAvg.map((v) => v.toFixed(2)).join(' / ') : '0.02 / 0.08 / 0.08'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Panel: Aktivitas Terbaru */}
          <div className="p-4 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold text-white">Event Log AI</span>
              <span className="text-[10px] text-cyan-400 font-mono">{activities.length} events</span>
            </div>

            <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 max-h-56 text-xs">
              {activities.slice(0, 6).map((act) => (
                <div key={act.id} className="flex items-start gap-2.5 pb-2 border-b border-slate-800/40">
                  <div className="w-6 h-6 rounded-full bg-cyan-950/50 border border-cyan-500/40 flex items-center justify-center shrink-0 text-[10px] font-bold text-cyan-400 mt-0.5">
                    {act.actorName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                      <span className="font-bold text-white mr-1">{act.actorName}</span>
                      {act.summary}
                    </p>
                    <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
                      {new Date(act.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hover Info Tooltip */}
      {hoveredAgent && (
        <div className="absolute bottom-20 left-4 z-20 p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-cyan-400 text-xs shadow-2xl shadow-cyan-950/60 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none max-w-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white text-sm">{hoveredAgent.name}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {hoveredAgent.role}
            </span>
          </div>
          <p className="text-slate-400 text-[11px] font-mono">Model: {hoveredAgent.modelId}</p>
          <p className="text-cyan-400 text-[10px] mt-1 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Klik avatar android untuk detail & eksekusi prompt</span>
          </p>
        </div>
      )}

      {/* Floating Bottom Toolbar */}
      <div className="absolute bottom-2.5 inset-x-2 sm:bottom-4 sm:inset-x-4 z-20 flex items-center justify-between gap-1.5 sm:gap-3 pointer-events-auto">
        {/* Left Action: + Titip tugas baru */}
        <button
          type="button"
          onClick={onOpenCreateTask}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-xs font-bold text-white shadow-xl shadow-cyan-600/30 transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 text-white shrink-0" />
          <span className="hidden sm:inline">+ Titip tugas baru</span>
          <span className="sm:hidden text-[11px] font-bold">Tugas</span>
        </button>

        {/* Center: Camera Director Presets */}
        <div className="flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-xl gap-1 overflow-x-auto no-scrollbar max-w-full">
          <button
            type="button"
            onClick={handleCamOverview}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
              activeCamView === 'overview'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>⊙ Overview</span>
          </button>

          <button
            type="button"
            onClick={handleCamTaskWall}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
              activeCamView === 'task_wall'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>▣ Holo Wall</span>
          </button>

          <button
            type="button"
            onClick={handleCamServerRack}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
              activeCamView === 'server_rack'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Fokus Kamera ke Server Rack"
          >
            <Server className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Server Cluster</span>
            <span className="sm:hidden">Rack</span>
          </button>

          <button
            type="button"
            onClick={handleCamIsometric}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
              activeCamView === 'isometric'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Sudut Pandang Isometrik 3D"
          >
            <span>📐 Isometrik</span>
          </button>

          {/* Quick Agent Focus Pills */}
          {agents.slice(0, 3).map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => handleCamFocusAgent(agent)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
                selectedAgentId === agent.id && activeCamView === 'agent'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>{agent.name.split(' ')[0]}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={handleToggleAutoTour}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
              autoTour
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <RotateCw className={`w-3 h-3 ${autoTour ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Auto-tour</span>
            <span className="sm:hidden">Tour</span>
          </button>
        </div>

        {/* Right Toggle Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleSound}
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md border text-xs font-semibold shadow-xl transition ${
              isAudioMuted
                ? 'bg-slate-900/90 border-slate-800 text-slate-500 hover:text-slate-300'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 shadow-emerald-500/10'
            }`}
            title={isAudioMuted ? 'Suara SFX Nonaktif (Klik untuk Aktifkan)' : 'Suara SFX Aktif (Klik untuk Mute)'}
            aria-label="Toggle SFX Audio"
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />}
          </button>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md border text-xs font-semibold shadow-xl transition ${
              isSidebarOpen
                ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white'
                : 'bg-cyan-600 border-cyan-500 text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden sm:inline">Riwayat aktivitas</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </button>

          <button
            type="button"
            onClick={onFallbackTo2D}
            className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 backdrop-blur-md border border-slate-800 text-slate-400 hover:text-white transition"
            title="Beralih ke Tampilan 2D"
            aria-label="Beralih ke Tampilan 2D"
          >
            <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
