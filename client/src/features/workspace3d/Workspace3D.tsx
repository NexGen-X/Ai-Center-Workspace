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
  Bot,
  CheckCircle2,
  Plus,
  Cpu,
  HardDrive,
  Clock,
  Radio,
  X,
  Volume2,
  VolumeX,
  Server,
  AlertCircle,
  Mic,
  MicOff
} from 'lucide-react';
import { audioService } from '../../services/audio.js';

interface Workspace3DProps {
  agents: AIAgent[];
  summary: DashboardSummary | null;
  serverMetrics?: ServerMetrics | null;
  activities: Activity[];
  currentUser: any;
  onSelectAgent: (agent: AIAgent) => void;
  onOpenCreateTask: () => void;
  onOpenTasks: () => void;
  onOpenProjects: () => void;
  onOpenManageTeam: () => void;
  onOpenSwarm?: () => void;
  onOpenCalendar?: () => void;
  onOpenDocuments?: () => void;
  onOpenPlayground?: () => void;
  onOpenSettings?: () => void;
  onOpenPipeline?: () => void;
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
  onOpenSwarm,
  onOpenCalendar,
  onOpenDocuments,
  onOpenPlayground,
  onOpenSettings,
  onOpenPipeline,
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
  const [liveStreamHUD, setLiveStreamHUD] = useState<{
    agentName: string;
    text: string;
    isThinking: boolean;
  } | null>(null);

  const [activeSwarmHUD, setActiveSwarmHUD] = useState<{
    missionId: string;
    subtaskTitle: string;
    agentFrom?: string;
    agentTo?: string;
  } | null>(null);

  // Interactive Voice Command & Speech Feedback Synthesis states
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceHUD, setVoiceHUD] = useState<{
    text: string;
    actionLabel: string;
    status: 'listening' | 'matched' | 'unrecognized';
  } | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // References for camera transitions & 3D dynamic laser mesh
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const targetCamPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 15, 23));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 2.5, 0));
  const triggerBeamRef = useRef<((fromId: string, toId: string) => void) | null>(null);

  const operatorName = currentUser?.displayName || 'Yulian';

  // Live Token Streaming, Reasoning Trace & Swarm Coordination SSE Listener for 3D Studio HUD
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let fadeTimer: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource('/api/realtime');

      eventSource.addEventListener('task.token_chunk', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (fadeTimer) clearTimeout(fadeTimer);

          const fullText: string = data.accumulated || '';
          const thinkStart = fullText.indexOf('<think>');
          const thinkEnd = fullText.indexOf('</think>');
          let snippet = fullText;
          let isThinking = Boolean(data.isThinking);

          if (thinkStart !== -1 && thinkEnd === -1) {
            snippet = fullText.slice(thinkStart + 7).trim();
            isThinking = true;
          } else if (thinkEnd !== -1) {
            snippet = fullText.slice(thinkEnd + 8).trim();
            isThinking = false;
          }

          setLiveStreamHUD({
            agentName: data.agentName || 'Agent',
            text: snippet.slice(-160),
            isThinking
          });
        } catch {
          // ignore parsing error
        }
      });

      eventSource.addEventListener('task.token_completed', () => {
        fadeTimer = setTimeout(() => {
          setLiveStreamHUD(null);
        }, 3500);
      });

      // Swarm Delegation & Handoff Laser Mesh
      eventSource.addEventListener('swarm.agent_handoff', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setActiveSwarmHUD({
            missionId: data.missionId,
            subtaskTitle: data.subtaskTitle || 'Serah Terima Konteks',
            agentFrom: data.fromAgentName,
            agentTo: data.toAgentName
          });
          if (data.fromAgentId && data.toAgentId) {
            triggerBeamRef.current?.(data.fromAgentId, data.toAgentId);
          }
        } catch {}
      });

      eventSource.addEventListener('swarm.subtask_dispatched', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setActiveSwarmHUD({
            missionId: data.missionId,
            subtaskTitle: data.subtask?.title || 'Eksekusi Subtugas Swarm',
            agentTo: data.subtask?.assignedAgentName
          });
        } catch {}
      });

      eventSource.addEventListener('swarm.mission_completed', () => {
        setTimeout(() => setActiveSwarmHUD(null), 4500);
      });

      eventSource.addEventListener('swarm.mission_cancelled', () => {
        setActiveSwarmHUD(null);
      });
    } catch {
      // SSE not supported
    }

    return () => {
      if (eventSource) eventSource.close();
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
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

    // =========================================================================
    // 1. SCENE, CAMERA & ENHANCED LIGHTING (Bright Creative Studio Aesthetic)
    // =========================================================================
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e2638); // Warm deep slate studio atmosphere
    scene.fog = new THREE.FogExp2(0x1e2638, 0.016);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 15, 23);
    camera.lookAt(0, 2.5, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 6;
    controls.maxDistance = 44;
    controls.target.set(0, 2.5, 0);
    controlsRef.current = controls;

    // 3. Balanced Studio Lighting (Natural, bright, high-contrast clarity)
    const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0x334155, 1.4);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.5);
    sunLight.position.set(16, 26, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 70;
    sunLight.shadow.bias = -0.00015;
    scene.add(sunLight);

    const softFillLight = new THREE.DirectionalLight(0xa5b4fc, 1.2);
    softFillLight.position.set(-18, 18, -12);
    scene.add(softFillLight);

    const warmLoungeLight = new THREE.PointLight(0xfef08a, 1.4, 20);
    warmLoungeLight.position.set(0, 5, 2.5);
    scene.add(warmLoungeLight);

    // =========================================================================
    // 4. STUDIO ROOM ARCHITECTURE: HIGH-DETAIL FLOOR, WALLS & MOLDINGS
    // =========================================================================
    // Procedural Studio Hardwood / Parquet Plank Floor Canvas
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 1024;
    floorCanvas.height = 1024;
    const fctx = floorCanvas.getContext('2d')!;
    fctx.fillStyle = '#cfc6bc';
    fctx.fillRect(0, 0, 1024, 1024);

    // Draw subtle hardwood plank lines
    fctx.strokeStyle = '#b8aea2';
    fctx.lineWidth = 3;
    const plankHeight = 64;
    for (let y = 0; y < 1024; y += plankHeight) {
      fctx.beginPath();
      fctx.moveTo(0, y);
      fctx.lineTo(1024, y);
      fctx.stroke();

      const plankWidth = 256;
      const offsetX = (y / plankHeight) % 2 === 0 ? 0 : 128;
      for (let x = offsetX; x < 1024; x += plankWidth) {
        fctx.beginPath();
        fctx.moveTo(x, y);
        fctx.lineTo(x, y + plankHeight);
        fctx.stroke();
      }
    }

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(4, 4);

    const floorGeo = new THREE.PlaneGeometry(40, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.65,
      metalness: 0.08
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Studio Baseboard Skirting Moldings
    const skirtingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const backSkirtingGeo = new THREE.BoxGeometry(40, 0.3, 0.1);
    const backSkirting = new THREE.Mesh(backSkirtingGeo, skirtingMat);
    backSkirting.position.set(0, 0.15, -9.05);
    scene.add(backSkirting);

    const leftSkirtingGeo = new THREE.BoxGeometry(0.1, 0.3, 32);
    const leftSkirting = new THREE.Mesh(leftSkirtingGeo, skirtingMat);
    leftSkirting.position.set(-19.95, 0.15, 6);
    scene.add(leftSkirting);

    // Lounge Circular Rugs with Detailed Stitched Border
    const rugCanvas = document.createElement('canvas');
    rugCanvas.width = 512;
    rugCanvas.height = 512;
    const rctx = rugCanvas.getContext('2d')!;
    rctx.fillStyle = '#9e8fc1';
    rctx.beginPath();
    rctx.arc(256, 256, 250, 0, Math.PI * 2);
    rctx.fill();
    rctx.lineWidth = 12;
    rctx.strokeStyle = '#c4b5fd';
    rctx.stroke();
    rctx.lineWidth = 4;
    rctx.strokeStyle = '#7c3aed';
    rctx.beginPath();
    rctx.arc(256, 256, 220, 0, Math.PI * 2);
    rctx.stroke();

    const rugTexture = new THREE.CanvasTexture(rugCanvas);
    const rugGeo1 = new THREE.CircleGeometry(4.8, 64);
    const rugMat1 = new THREE.MeshStandardMaterial({
      map: rugTexture,
      roughness: 0.9,
      transparent: true
    });
    const rug1 = new THREE.Mesh(rugGeo1, rugMat1);
    rug1.rotation.x = -Math.PI / 2;
    rug1.position.set(0, 0.02, 2.8);
    rug1.receiveShadow = true;
    scene.add(rug1);

    // Soft Sky-Blue Adjacent Rug
    const rugGeo2 = new THREE.CircleGeometry(3.4, 48);
    const rugMat2 = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.92
    });
    const rug2 = new THREE.Mesh(rugGeo2, rugMat2);
    rug2.rotation.x = -Math.PI / 2;
    rug2.position.set(-3.2, 0.025, 3.6);
    rug2.receiveShadow = true;
    scene.add(rug2);

    // Walls
    const backWallGeo = new THREE.PlaneGeometry(40, 15);
    const backWallMat = new THREE.MeshStandardMaterial({ color: 0x333c56, roughness: 0.85 });
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(0, 7.5, -9.1);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWallGeo = new THREE.PlaneGeometry(32, 15);
    const leftWallMat = new THREE.MeshStandardMaterial({ color: 0x272f45, roughness: 0.85 });
    const leftWall = new THREE.Mesh(leftWallGeo, leftWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-20, 7.5, 6);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Studio Windows with Daylight Panels (Right Side Wall)
    const windowGroup = new THREE.Group();
    windowGroup.position.set(19.9, 7.5, 0);
    windowGroup.rotation.y = -Math.PI / 2;

    const windowFrameGeo = new THREE.BoxGeometry(16, 8, 0.15);
    const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const windowFrame = new THREE.Mesh(windowFrameGeo, windowFrameMat);
    windowGroup.add(windowFrame);

    const windowGlassGeo = new THREE.PlaneGeometry(15.6, 7.6);
    const windowGlassMat = new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.65
    });
    const windowGlass = new THREE.Mesh(windowGlassGeo, windowGlassMat);
    windowGlass.position.z = 0.1;
    windowGroup.add(windowGlass);

    // Window Mullions (Grids)
    [-4, 0, 4].forEach((wx) => {
      const mullionGeo = new THREE.BoxGeometry(0.12, 7.6, 0.2);
      const mullion = new THREE.Mesh(mullionGeo, windowFrameMat);
      mullion.position.set(wx, 0, 0.05);
      windowGroup.add(mullion);
    });
    scene.add(windowGroup);

    // Neon Wall Art: "GOOD IDEAS BETTER WEBSITES" with Realistic Mounting Plate
    const neonCanvas = document.createElement('canvas');
    neonCanvas.width = 512;
    neonCanvas.height = 256;
    const nctx = neonCanvas.getContext('2d')!;
    nctx.clearRect(0, 0, 512, 256);
    nctx.font = '900 38px system-ui, sans-serif';
    nctx.fillStyle = '#a5b4fc';
    nctx.shadowColor = '#6366f1';
    nctx.shadowBlur = 22;
    nctx.fillText('GOOD', 35, 65);
    nctx.fillText('IDEAS', 35, 120);
    nctx.fillText('BETTER', 35, 175);
    nctx.fillText('WEBSITES', 35, 230);

    const neonTexture = new THREE.CanvasTexture(neonCanvas);
    const neonGeo = new THREE.PlaneGeometry(6.4, 3.2);
    const neonMat = new THREE.MeshBasicMaterial({
      map: neonTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const neonSign = new THREE.Mesh(neonGeo, neonMat);
    neonSign.rotation.y = Math.PI / 2;
    neonSign.position.set(-19.85, 7.2, -2.5);
    scene.add(neonSign);

    // =========================================================================
    // 5. CRISP PROJECTOR DASHBOARD ON BACK WALL
    // =========================================================================
    const projCanvas = document.createElement('canvas');
    projCanvas.width = 2048;
    projCanvas.height = 1024;
    const pctx = projCanvas.getContext('2d')!;
    const projTex = new THREE.CanvasTexture(projCanvas);
    projTex.minFilter = THREE.LinearFilter;
    projTex.magFilter = THREE.LinearFilter;

    const projGeo = new THREE.PlaneGeometry(14, 7);
    const projMat = new THREE.MeshBasicMaterial({
      map: projTex,
      side: THREE.DoubleSide
    });
    const projScreen = new THREE.Mesh(projGeo, projMat);
    projScreen.position.set(0, 7.5, -8.95);
    scene.add(projScreen);

    // Projector Frame & Ceiling Cables
    const projBarGeo = new THREE.CylinderGeometry(0.09, 0.09, 14.8, 24);
    const projBarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    const projBar = new THREE.Mesh(projBarGeo, projBarMat);
    projBar.rotation.z = Math.PI / 2;
    projBar.position.set(0, 11.2, -8.9);
    scene.add(projBar);

    [-6.5, 6.5].forEach((cx) => {
      const wireGeo = new THREE.CylinderGeometry(0.02, 0.02, 3.8, 8);
      const wire = new THREE.Mesh(wireGeo, projBarMat);
      wire.position.set(cx, 13.1, -8.9);
      scene.add(wire);
    });

    const updateProjectorScreen = () => {
      pctx.fillStyle = '#1e2638';
      pctx.fillRect(0, 0, 2048, 1024);

      // Header Gradient
      const grad = pctx.createLinearGradient(0, 0, 2048, 0);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.5, '#312e81');
      grad.addColorStop(1, '#1e293b');
      pctx.fillStyle = grad;
      pctx.fillRect(0, 0, 2048, 280);

      // Welcome Typography
      pctx.font = 'bold 64px system-ui, sans-serif';
      pctx.fillStyle = '#ffffff';
      pctx.fillText(`Selamat bekerja, ${operatorName}! 👋`, 90, 120);

      pctx.font = '500 36px system-ui, sans-serif';
      pctx.fillStyle = '#cbd5e1';
      pctx.fillText('Antigravity Multi-Agent Neural Command Center • Semua sistem optimal', 90, 195);

      // Live Telemetry Mini Chip
      pctx.fillStyle = '#065f46';
      pctx.beginPath();
      pctx.roundRect(1720, 70, 220, 60, 30);
      pctx.fill();
      pctx.fillStyle = '#34d399';
      pctx.beginPath();
      pctx.arc(1755, 100, 10, 0, Math.PI * 2);
      pctx.fill();
      pctx.font = 'bold 26px monospace';
      pctx.fillText('LIVE 2026', 1780, 110);

      // Metric Cards
      const runningCount = summary?.runningTasksCount ?? 0;
      const completedCount = summary?.completedTasksCount ?? 2;
      const onlineAgents = summary?.onlineAgentsCount ?? agents.filter((a) => a.status === 'READY').length;
      const totalAgents = summary?.totalAgentsCount ?? agents.length;
      const activeProj = summary?.activeProjectsCount ?? 2;

      const cards = [
        { label: 'Tugas Berjalan', val: `${runningCount}`, col: '#38bdf8', icon: '⚡' },
        { label: 'Selesai Hari Ini', val: `${completedCount}`, col: '#34d399', icon: '✓' },
        { label: 'Tim AI Aktif', val: `${onlineAgents}/${totalAgents} Online`, col: '#a855f7', icon: '✦' },
        { label: 'Proyek Aktif', val: `${activeProj}`, col: '#fbbf24', icon: '📁' }
      ];

      cards.forEach((c, idx) => {
        const cx = 90 + idx * 470;
        const cy = 350;

        pctx.fillStyle = '#182132';
        pctx.beginPath();
        pctx.roundRect(cx, cy, 440, 280, 24);
        pctx.fill();

        pctx.strokeStyle = '#2d3b55';
        pctx.lineWidth = 4;
        pctx.stroke();

        // Color accent line
        pctx.fillStyle = c.col;
        pctx.fillRect(cx + 35, cy + 35, 8, 45);

        pctx.font = 'bold 30px system-ui, sans-serif';
        pctx.fillStyle = '#94a3b8';
        pctx.fillText(c.label, cx + 60, cy + 68);

        pctx.font = 'bold 68px monospace';
        pctx.fillStyle = '#ffffff';
        pctx.fillText(c.val, cx + 40, cy + 190);

        pctx.font = '32px system-ui';
        pctx.fillText(c.icon, cx + 370, cy + 70);
      });

      // Active Orchestration Status Banner
      pctx.fillStyle = '#182132';
      pctx.beginPath();
      pctx.roundRect(90, 710, 1850, 200, 24);
      pctx.fill();
      pctx.strokeStyle = '#2d3b55';
      pctx.lineWidth = 4;
      pctx.stroke();

      pctx.font = 'bold 32px system-ui, sans-serif';
      pctx.fillStyle = '#64748b';
      pctx.fillText('STATUS ORKESTRASI SAAT INI:', 140, 785);

      pctx.font = 'bold 38px system-ui, sans-serif';
      pctx.fillStyle = runningCount > 0 ? '#38bdf8' : '#e2e8f0';
      pctx.fillText(
        runningCount > 0
          ? '✦ Memproses pipeline tugas aktif melalui model swarm multi-agent...'
          : '✓ Semua agen siap menerima tugas baru. Klik avatar 3D untuk instruksi.',
        140,
        855
      );

      projTex.needsUpdate = true;
    };
    updateProjectorScreen();

    // =========================================================================
    // 6. HIGH-DETAIL LOUNGE FURNITURE & PROPS
    // =========================================================================
    // Modern Scandinavian Fabric Sofa with Wooden Legs & Pillows
    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(-2.5, 0, 1.8);
    sofaGroup.rotation.y = 0.25;

    // Sofa Wooden Tapered Legs
    const sofaLegGeo = new THREE.CylinderGeometry(0.06, 0.04, 0.4, 12);
    const sofaLegMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.6 });
    [
      [-2.1, 0.2, -0.8],
      [2.1, 0.2, -0.8],
      [-2.1, 0.2, 0.8],
      [2.1, 0.2, 0.8]
    ].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(sofaLegGeo, sofaLegMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      sofaGroup.add(leg);
    });

    // Sofa Base
    const sofaBaseGeo = new THREE.BoxGeometry(4.6, 0.7, 2.1);
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
    const sofaBase = new THREE.Mesh(sofaBaseGeo, sofaMat);
    sofaBase.position.set(0, 0.65, 0);
    sofaBase.castShadow = true;
    sofaBase.receiveShadow = true;
    sofaGroup.add(sofaBase);

    // Individual Cushions
    [-1.15, 1.15].forEach((cx) => {
      const seatCushionGeo = new THREE.BoxGeometry(2.15, 0.25, 1.8);
      const cushionMat = new THREE.MeshStandardMaterial({ color: 0x717f94, roughness: 0.8 });
      const cushion = new THREE.Mesh(seatCushionGeo, cushionMat);
      cushion.position.set(cx, 1.05, 0.1);
      cushion.castShadow = true;
      sofaGroup.add(cushion);
    });

    // Sofa Backrest
    const sofaBackGeo = new THREE.BoxGeometry(4.6, 1.25, 0.55);
    const sofaBack = new THREE.Mesh(sofaBackGeo, sofaMat);
    sofaBack.position.set(0, 1.35, -0.78);
    sofaBack.castShadow = true;
    sofaGroup.add(sofaBack);

    // Sofa Armrests
    const armGeo = new THREE.BoxGeometry(0.55, 0.85, 2.1);
    [-2.3, 2.3].forEach((ax) => {
      const arm = new THREE.Mesh(armGeo, sofaMat);
      arm.position.set(ax, 1.05, 0);
      arm.castShadow = true;
      sofaGroup.add(arm);
    });

    // Throw Blanket
    const throwGeo = new THREE.BoxGeometry(1.6, 0.06, 1.7);
    const throwMat = new THREE.MeshStandardMaterial({ color: 0xe0e7ff, roughness: 0.75 });
    const throwMesh = new THREE.Mesh(throwGeo, throwMat);
    throwMesh.position.set(-0.7, 1.2, 0.15);
    throwMesh.rotation.y = 0.15;
    sofaGroup.add(throwMesh);

    // Throw Pillows
    const pillowGeo = new THREE.BoxGeometry(0.65, 0.65, 0.25);
    const yellowPillowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.8 });
    const yellowPillow = new THREE.Mesh(pillowGeo, yellowPillowMat);
    yellowPillow.position.set(-1.8, 1.3, -0.45);
    yellowPillow.rotation.set(0.1, 0.4, 0.2);
    sofaGroup.add(yellowPillow);

    const tealPillowMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.8 });
    const tealPillow = new THREE.Mesh(pillowGeo, tealPillowMat);
    tealPillow.position.set(1.8, 1.3, -0.45);
    tealPillow.rotation.set(0.1, -0.35, -0.15);
    sofaGroup.add(tealPillow);

    scene.add(sofaGroup);

    // Organic Round Poufs / Beanbags
    const pouf1Geo = new THREE.SphereGeometry(0.95, 24, 24);
    const pouf1Mat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.95 });
    const pouf1 = new THREE.Mesh(pouf1Geo, pouf1Mat);
    pouf1.scale.set(1.15, 0.68, 1.15);
    pouf1.position.set(-4.5, 0.45, 4.2);
    pouf1.castShadow = true;
    scene.add(pouf1);

    const pouf2Geo = new THREE.SphereGeometry(0.85, 24, 24);
    const pouf2Mat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.95 });
    const pouf2 = new THREE.Mesh(pouf2Geo, pouf2Mat);
    pouf2.scale.set(1.05, 0.62, 1.05);
    pouf2.position.set(-3.0, 0.4, 6.0);
    pouf2.castShadow = true;
    scene.add(pouf2);

    // Modular Natural Birch Coffee Table Blocks with High-Detail Decor
    const tableGroup = new THREE.Group();
    tableGroup.position.set(5.2, 0, 3.8);

    const block1Geo = new THREE.BoxGeometry(2.5, 0.8, 2.1);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xe2d7cc, roughness: 0.6 });
    const block1 = new THREE.Mesh(block1Geo, woodMat);
    block1.position.set(0, 0.4, 0);
    block1.castShadow = true;
    block1.receiveShadow = true;
    tableGroup.add(block1);

    const block2Geo = new THREE.BoxGeometry(1.9, 1.15, 1.7);
    const block2 = new THREE.Mesh(block2Geo, woodMat);
    block2.position.set(1.4, 0.575, 0.6);
    block2.castShadow = true;
    tableGroup.add(block2);

    // Laptop on Table
    const laptopBaseGeo = new THREE.BoxGeometry(0.65, 0.03, 0.45);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
    const laptopBase = new THREE.Mesh(laptopBaseGeo, metalMat);
    laptopBase.position.set(-0.3, 0.82, 0.2);
    laptopBase.rotation.y = 0.2;
    tableGroup.add(laptopBase);

    const laptopScreenGeo = new THREE.BoxGeometry(0.65, 0.42, 0.03);
    const laptopScreenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const laptopScreen = new THREE.Mesh(laptopScreenGeo, laptopScreenMat);
    laptopScreen.position.set(-0.3, 1.02, -0.02);
    laptopScreen.rotation.set(-0.3, 0.2, 0);
    tableGroup.add(laptopScreen);

    // Steaming Ceramic Coffee Cup with Saucer
    const saucerGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.03, 16);
    const saucerMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const saucer = new THREE.Mesh(saucerGeo, saucerMat);
    saucer.position.set(0.6, 0.82, -0.3);
    tableGroup.add(saucer);

    const cupGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.16, 16);
    const cup = new THREE.Mesh(cupGeo, saucerMat);
    cup.position.set(0.6, 0.91, -0.3);
    tableGroup.add(cup);

    scene.add(tableGroup);

    // Retro Sage-Green Studio Radio / Smart Speaker
    const radioGroup = new THREE.Group();
    radioGroup.position.set(0.6, 0, 5.2);
    radioGroup.rotation.y = -0.35;

    const radioGeo = new THREE.BoxGeometry(0.65, 0.85, 0.45);
    const radioMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 });
    const radio = new THREE.Mesh(radioGeo, radioMat);
    radio.position.set(0, 0.425, 0);
    radio.castShadow = true;
    radioGroup.add(radio);

    const grilleGeo = new THREE.CircleGeometry(0.19, 24);
    const grilleMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.7 });
    const grille = new THREE.Mesh(grilleGeo, grilleMat);
    grille.position.set(0, 0.52, 0.23);
    radioGroup.add(grille);

    // Radio Knobs & Telescoping Antenna
    const knobGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12);
    const knobMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9 });
    const knob = new THREE.Mesh(knobGeo, knobMat);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(0.18, 0.24, 0.23);
    radioGroup.add(knob);

    const antGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.9, 8);
    const antMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 });
    const ant = new THREE.Mesh(antGeo, antMat);
    ant.position.set(-0.2, 1.25, -0.1);
    ant.rotation.z = -0.15;
    radioGroup.add(ant);

    scene.add(radioGroup);

    // Indoor Foliage & Monstera in Ceramic Terracotta Planters
    const plantLocations = [
      [-17, -6.5],
      [-17.5, 9],
      [17, 8]
    ];
    plantLocations.forEach(([px, pz]) => {
      const plantGroup = new THREE.Group();
      plantGroup.position.set(px, 0, pz);

      const potGeo = new THREE.CylinderGeometry(0.72, 0.5, 1.35, 24);
      const potMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
      const pot = new THREE.Mesh(potGeo, potMat);
      pot.position.set(0, 0.675, 0);
      pot.castShadow = true;
      plantGroup.add(pot);

      // Soil
      const soilGeo = new THREE.CircleGeometry(0.68, 24);
      const soilMat = new THREE.MeshStandardMaterial({ color: 0x3f2e20, roughness: 0.95 });
      const soil = new THREE.Mesh(soilGeo, soilMat);
      soil.rotation.x = -Math.PI / 2;
      soil.position.set(0, 1.32, 0);
      plantGroup.add(soil);

      // Sculpted Monstera Leaves
      for (let li = 0; li < 7; li++) {
        const leafAngle = (li / 7) * Math.PI * 2;
        const leafGeo = new THREE.SphereGeometry(0.55, 12, 12);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6 });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.scale.set(0.35, 1.25, 0.08);
        leaf.position.set(Math.cos(leafAngle) * 0.45, 1.75 + (li % 3) * 0.25, Math.sin(leafAngle) * 0.45);
        leaf.rotation.set(Math.sin(leafAngle) * 0.45, leafAngle, Math.cos(leafAngle) * 0.45);
        leaf.castShadow = true;
        plantGroup.add(leaf);
      }
      scene.add(plantGroup);
    });

    // Elegant Corner Server Rack Unit (Integrated into Studio Architecture)
    const rackGroup = new THREE.Group();
    rackGroup.position.set(-17.5, 0, 1.5);
    rackGroup.rotation.y = Math.PI / 2;

    const rackFrameGeo = new THREE.BoxGeometry(2.4, 5.2, 1.4);
    const rackFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 });
    const rackFrame = new THREE.Mesh(rackFrameGeo, rackFrameMat);
    rackFrame.position.set(0, 2.6, 0);
    rackFrame.castShadow = true;
    rackGroup.add(rackFrame);

    // Server Blades with Status Lights
    const rackLeds: THREE.Mesh[] = [];
    for (let s = 0; s < 6; s++) {
      const bladeGeo = new THREE.BoxGeometry(2.1, 0.6, 1.2);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(0, 0.8 + s * 0.75, 0.05);
      rackGroup.add(blade);

      [-0.7, -0.4, -0.1, 0.2].forEach((lx) => {
        const ledGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const ledMat = new THREE.MeshBasicMaterial({ color: s % 2 === 0 ? 0x10b981 : 0x06b6d4 });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(lx, 0.8 + s * 0.75, 0.66);
        rackGroup.add(led);
        rackLeds.push(led);
      });
    }

    // Glass Door
    const rackGlassGeo = new THREE.PlaneGeometry(2.2, 4.9);
    const rackGlassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.9
    });
    const rackGlass = new THREE.Mesh(rackGlassGeo, rackGlassMat);
    rackGlass.position.set(0, 2.6, 0.71);
    rackGroup.add(rackGlass);

    scene.add(rackGroup);

    // =========================================================================
    // 7. WORKSTATIONS & CLEAR HIGH-DETAIL HUMAN/HOODIE AGENT AVATARS
    // =========================================================================
    const interactiveMeshes: THREE.Mesh[] = [];
    const agentMap = new Map<THREE.Mesh, AIAgent>();
    const agentPositions: { agent: AIAgent; pos: THREE.Vector3 }[] = [];
    const animatedAvatars: { group: THREE.Group; baseY: number; index: number }[] = [];

    const deskConfigs = [
      { deskPos: new THREE.Vector3(-11, 0, -2.5), charPos: new THREE.Vector3(-9.2, 0, -2.5), isStanding: true },
      { deskPos: new THREE.Vector3(-11, 0, 3.5), charPos: new THREE.Vector3(-11, 0, 4.4), isStanding: false },
      { deskPos: new THREE.Vector3(10.5, 0, -2.5), charPos: new THREE.Vector3(10.5, 0, -1.6), isStanding: false },
      { deskPos: new THREE.Vector3(10.5, 0, 3.5), charPos: new THREE.Vector3(12.2, 0, 3.5), isStanding: true }
    ];

    agents.forEach((agent, index) => {
      const cfg = deskConfigs[index % deskConfigs.length];
      const deskOffset = Math.floor(index / deskConfigs.length) * 0.9;
      const deskX = cfg.deskPos.x + (index >= 4 ? (cfg.deskPos.x > 0 ? 3.2 : -3.2) : 0);
      const deskZ = cfg.deskPos.z + deskOffset;

      const workstationGroup = new THREE.Group();
      workstationGroup.position.set(deskX, 0, deskZ);

      // Desk Top (Refined Light Nordic Birch Desk)
      const deskTopGeo = new THREE.BoxGeometry(3.8, 0.12, 1.9);
      const deskTopMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.45,
        metalness: 0.05
      });
      const deskTop = new THREE.Mesh(deskTopGeo, deskTopMat);
      deskTop.position.set(0, 1.35, 0);
      deskTop.castShadow = true;
      deskTop.receiveShadow = true;
      workstationGroup.add(deskTop);

      // Desk Steel Frame & Legs
      const deskLegMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.7, roughness: 0.3 });
      [
        [-1.7, 0.675, -0.8],
        [1.7, 0.675, -0.8],
        [-1.7, 0.675, 0.8],
        [1.7, 0.675, 0.8]
      ].forEach(([lx, ly, lz]) => {
        const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.35, 16);
        const leg = new THREE.Mesh(legGeo, deskLegMat);
        leg.position.set(lx, ly, lz);
        leg.castShadow = true;
        workstationGroup.add(leg);
      });

      // Desk Dark Felt Pad
      const deskPadGeo = new THREE.BoxGeometry(2.6, 0.02, 1.1);
      const deskPadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
      const deskPad = new THREE.Mesh(deskPadGeo, deskPadMat);
      deskPad.position.set(0, 1.42, 0.1);
      workstationGroup.add(deskPad);

      // White Dual Monitor Stand Riser
      const riserGeo = new THREE.BoxGeometry(2.5, 0.14, 0.6);
      const riserMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      const riser = new THREE.Mesh(riserGeo, riserMat);
      riser.position.set(0, 1.48, -0.45);
      riser.castShadow = true;
      workstationGroup.add(riser);

      // Dual Borderless Monitors with Emissive Live Display
      [-0.7, 0.7].forEach((mx) => {
        const monBezelGeo = new THREE.BoxGeometry(1.15, 0.72, 0.06);
        const monBezelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
        const monBezel = new THREE.Mesh(monBezelGeo, monBezelMat);
        monBezel.position.set(mx, 1.95, -0.45);
        monBezel.rotation.y = mx > 0 ? -0.12 : 0.12;
        monBezel.castShadow = true;
        workstationGroup.add(monBezel);

        // Screen
        const screenGeo = new THREE.PlaneGeometry(1.1, 0.67);
        const screenMat = new THREE.MeshBasicMaterial({
          color: agent.status === 'BUSY' ? 0xf59e0b : 0x0284c7
        });
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(mx, 1.95, -0.415);
        screen.rotation.y = mx > 0 ? -0.12 : 0.12;
        workstationGroup.add(screen);
      });

      // Keyboard & Wireless Mouse on Desk
      const kbGeo = new THREE.BoxGeometry(0.9, 0.03, 0.3);
      const kbMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
      const kb = new THREE.Mesh(kbGeo, kbMat);
      kb.position.set(0, 1.44, 0.15);
      workstationGroup.add(kb);

      const mouseGeo = new THREE.BoxGeometry(0.12, 0.04, 0.2);
      const mouse = new THREE.Mesh(mouseGeo, kbMat);
      mouse.position.set(0.65, 1.44, 0.15);
      workstationGroup.add(mouse);

      // Ergonomic Swivel Chair with Wheeled Base
      const chairGroup = new THREE.Group();
      chairGroup.position.set(0, 0, 1.05);

      const seatGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.12, 24);
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
      const seat = new THREE.Mesh(seatGeo, seatMat);
      seat.position.set(0, 0.8, 0);
      seat.castShadow = true;
      chairGroup.add(seat);

      const backGeo = new THREE.BoxGeometry(0.85, 0.95, 0.1);
      const back = new THREE.Mesh(backGeo, seatMat);
      back.position.set(0, 1.35, 0.38);
      back.castShadow = true;
      chairGroup.add(back);

      const stemGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 12);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(0, 0.4, 0);
      chairGroup.add(stem);

      workstationGroup.add(chairGroup);
      scene.add(workstationGroup);

      // =======================================================================
      // HIGH-DETAIL STYLIZED CHARACTER AVATAR (Warm, Friendly, Clear Definition)
      // =======================================================================
      const charX = cfg.charPos.x + (index >= 4 ? (cfg.charPos.x > 0 ? 3.2 : -3.2) : 0);
      const charZ = cfg.charPos.z + deskOffset;
      const charGroup = new THREE.Group();
      charGroup.position.set(charX, 0, charZ);

      if (cfg.isStanding) {
        charGroup.lookAt(charX + (deskX > charX ? 1 : -1), 0, charZ);
      } else {
        charGroup.lookAt(deskX, 0, deskZ);
      }

      // Role Accent Color (Vibrant & Recognizable)
      const roleColor =
        agent.role === 'Orchestrator'
          ? 0x2563eb // Royal Blue
          : agent.role === 'Planner'
          ? 0x9333ea // Vivid Purple
          : agent.role === 'Executor'
          ? 0x059669 // Emerald Green
          : agent.role === 'QA / Reviewer'
          ? 0xd97706 // Amber Gold
          : 0xdb2777; // Rose Pink

      // 1. Detailed White Sneakers with Sole & Accent Stripe
      const soleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
      const shoeUpperMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const shoeStripeMat = new THREE.MeshStandardMaterial({ color: roleColor, roughness: 0.4 });

      [-0.17, 0.17].forEach((sx) => {
        const soleGeo = new THREE.BoxGeometry(0.2, 0.08, 0.42);
        const sole = new THREE.Mesh(soleGeo, soleMat);
        sole.position.set(sx, 0.04, 0.06);
        sole.castShadow = true;
        charGroup.add(sole);

        const upperGeo = new THREE.BoxGeometry(0.18, 0.14, 0.36);
        const upper = new THREE.Mesh(upperGeo, shoeUpperMat);
        upper.position.set(sx, 0.14, 0.05);
        upper.castShadow = true;
        charGroup.add(upper);

        const stripeGeo = new THREE.BoxGeometry(0.2, 0.05, 0.1);
        const stripe = new THREE.Mesh(stripeGeo, shoeStripeMat);
        stripe.position.set(sx, 0.14, 0.05);
        charGroup.add(stripe);
      });

      // 2. Chino / Denim Legs with Natural Fit
      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
      const legGeo = new THREE.CylinderGeometry(0.12, 0.11, 0.85, 16);
      const legL = new THREE.Mesh(legGeo, pantsMat);
      legL.position.set(-0.17, 0.52, 0);
      legL.castShadow = true;
      const legR = new THREE.Mesh(legGeo, pantsMat);
      legR.position.set(0.17, 0.52, 0);
      legR.castShadow = true;
      charGroup.add(legL);
      charGroup.add(legR);

      // 3. Stylized Hoodie / Tech Jacket
      const hoodieMat = new THREE.MeshStandardMaterial({ color: roleColor, roughness: 0.65 });
      const torsoGeo = new THREE.CylinderGeometry(0.38, 0.34, 0.92, 20);
      const torso = new THREE.Mesh(torsoGeo, hoodieMat);
      torso.position.set(0, 1.25, 0);
      torso.castShadow = true;
      charGroup.add(torso);

      // Folded Hood on Back of Neck
      const hoodGeo = new THREE.TorusGeometry(0.26, 0.1, 12, 24);
      const hood = new THREE.Mesh(hoodGeo, hoodieMat);
      hood.position.set(0, 1.62, -0.15);
      hood.rotation.x = 0.5;
      charGroup.add(hood);

      // Hoodie Drawstrings
      const stringGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8);
      const stringMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      [-0.08, 0.08].forEach((hx) => {
        const stringMesh = new THREE.Mesh(stringGeo, stringMat);
        stringMesh.position.set(hx, 1.48, 0.34);
        charGroup.add(stringMesh);
      });

      // 4. Arms & Posed Hands
      const armGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.75, 12);
      const armL = new THREE.Mesh(armGeo, hoodieMat);
      armL.position.set(-0.44, 1.22, 0.05);
      armL.rotation.z = -0.25;
      armL.rotation.x = 0.35;
      armL.castShadow = true;
      charGroup.add(armL);

      const armR = new THREE.Mesh(armGeo, hoodieMat);
      armR.position.set(0.44, 1.22, 0.05);
      armR.rotation.z = 0.25;
      armR.rotation.x = 0.35;
      armR.castShadow = true;
      charGroup.add(armR);

      // Hands (Stylized warm peach skin)
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdfc4, roughness: 0.5 });
      const handGeo = new THREE.SphereGeometry(0.1, 12, 12);
      const handL = new THREE.Mesh(handGeo, skinMat);
      handL.position.set(-0.52, 0.92, 0.22);
      charGroup.add(handL);

      const handR = new THREE.Mesh(handGeo, skinMat);
      handR.position.set(0.52, 0.92, 0.22);
      charGroup.add(handR);

      // Coffee Mug or Tablet if Standing
      if (cfg.isStanding) {
        const mugGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.24, 16);
        const mugMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const mug = new THREE.Mesh(mugGeo, mugMat);
        mug.position.set(0.52, 0.98, 0.32);
        charGroup.add(mug);
      }

      // 5. Stylized Head & Hair
      const headGeo = new THREE.SphereGeometry(0.38, 24, 24);
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 1.95, 0);
      head.castShadow = true;
      charGroup.add(head);

      // Styled Hair (Layered Silhouette)
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.8 });
      const hairGeo = new THREE.SphereGeometry(0.41, 20, 20);
      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.set(0, 2.04, -0.05);
      charGroup.add(hair);

      // Stylish Modern Tech Visor / Glasses
      const glassesGeo = new THREE.BoxGeometry(0.44, 0.12, 0.08);
      const glassesMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        metalness: 0.9,
        roughness: 0.2
      });
      const glasses = new THREE.Mesh(glassesGeo, glassesMat);
      glasses.position.set(0, 1.97, 0.34);
      charGroup.add(glasses);

      // 6. Floating Crisp BillBoard Nameplate Badge
      const badgeCanvas = document.createElement('canvas');
      badgeCanvas.width = 512;
      badgeCanvas.height = 192;
      const bctx = badgeCanvas.getContext('2d')!;
      bctx.fillStyle = '#0f172a';
      bctx.beginPath();
      bctx.roundRect(16, 16, 480, 160, 28);
      bctx.fill();

      bctx.lineWidth = 6;
      bctx.strokeStyle = `#${roleColor.toString(16).padStart(6, '0')}`;
      bctx.stroke();

      // Role tag pill
      bctx.fillStyle = `#${roleColor.toString(16).padStart(6, '0')}`;
      bctx.beginPath();
      bctx.roundRect(40, 36, 170, 38, 19);
      bctx.fill();

      bctx.font = 'bold 22px system-ui, sans-serif';
      bctx.fillStyle = '#ffffff';
      bctx.fillText(agent.role, 55, 62);

      // Name
      bctx.font = 'bold 36px system-ui, sans-serif';
      bctx.fillStyle = '#ffffff';
      bctx.fillText(agent.name, 40, 125);

      // Status Dot
      bctx.fillStyle = agent.status === 'BUSY' ? '#f59e0b' : '#10b981';
      bctx.beginPath();
      bctx.arc(440, 115, 12, 0, Math.PI * 2);
      bctx.fill();

      const badgeTex = new THREE.CanvasTexture(badgeCanvas);
      const badgeGeo = new THREE.PlaneGeometry(1.6, 0.6);
      const badgeMat = new THREE.MeshBasicMaterial({
        map: badgeTex,
        transparent: true,
        side: THREE.DoubleSide
      });
      const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
      badgeMesh.position.set(0, 2.7, 0);
      charGroup.add(badgeMesh);

      scene.add(charGroup);

      // Register interactive meshes for click & hover
      interactiveMeshes.push(head, torso, badgeMesh);
      agentMap.set(head, agent);
      agentMap.set(torso, agent);
      agentMap.set(badgeMesh, agent);

      agentPositions.push({ agent, pos: new THREE.Vector3(charX, 1.8, charZ) });
      animatedAvatars.push({ group: charGroup, baseY: 0, index });
    });

    // =========================================================================
    // 7b. SWARM MULTI-AGENT COORDINATION LASER MESH
    // =========================================================================
    const activeBeams: { mesh: THREE.Mesh; createdAt: number; ttl: number }[] = [];

    triggerBeamRef.current = (fromAgentId: string, toAgentId: string) => {
      const fromItem = agentPositions.find(a => a.agent.id === fromAgentId);
      const toItem = agentPositions.find(a => a.agent.id === toAgentId);
      if (!fromItem || !toItem) return;

      const fromPos = fromItem.pos;
      const toPos = toItem.pos;

      const midPoint = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);
      midPoint.y += 2.5;

      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(fromPos.x, fromPos.y + 0.5, fromPos.z),
        midPoint,
        new THREE.Vector3(toPos.x, toPos.y + 0.5, toPos.z)
      );

      const tubeGeo = new THREE.TubeGeometry(curve, 28, 0.08, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        transparent: true,
        opacity: 0.95
      });

      const beamMesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(beamMesh);
      activeBeams.push({ mesh: beamMesh, createdAt: Date.now(), ttl: 5000 });
    };

    // =========================================================================
    // 8. RAYCASTING INTERACTIVITY & HOVER EVENTS
    // =========================================================================
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

    // 9. Resize Observer
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || 560;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // =========================================================================
    // 10. ANIMATION LOOP & SMOOTH CAMERA GLIDE
    // =========================================================================
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Subtle organic breathing animation for avatars
      animatedAvatars.forEach(({ group, baseY, index }) => {
        group.position.y = baseY + Math.sin(elapsedTime * 2.5 + index * 1.5) * 0.025;
      });

      // Blinking rack server LEDs
      if (Math.floor(elapsedTime * 4) % 2 === 0 && rackLeds.length > 0) {
        const randomIdx = Math.floor(Math.random() * rackLeds.length);
        const ledMat = rackLeds[randomIdx].material as THREE.MeshBasicMaterial;
        ledMat.color.setHex(Math.random() > 0.5 ? 0x10b981 : 0x38bdf8);
      }

      // Smooth camera interpolation towards target position and target lookAt
      if (activeCamView !== 'tour' && !autoTour) {
        camera.position.lerp(targetCamPos.current, 0.05);
        controls.target.lerp(targetLookAt.current, 0.05);
      } else {
        // Auto-tour orbit
        const orbitRadius = 23;
        const orbitAngle = elapsedTime * 0.14;
        camera.position.x = Math.sin(orbitAngle) * orbitRadius;
        camera.position.z = Math.cos(orbitAngle) * orbitRadius;
        camera.position.y = 15 + Math.sin(elapsedTime * 0.25) * 2;
        controls.target.set(0, 2.5, 0);
      }

      // Dynamic Swarm Laser Beam pulsation & TTL cleanup
      const now = Date.now();
      for (let i = activeBeams.length - 1; i >= 0; i--) {
        const b = activeBeams[i];
        const elapsed = now - b.createdAt;
        if (elapsed > b.ttl) {
          scene.remove(b.mesh);
          b.mesh.geometry.dispose();
          (b.mesh.material as THREE.Material).dispose();
          activeBeams.splice(i, 1);
        } else {
          const bMat = b.mesh.material as THREE.MeshBasicMaterial;
          bMat.opacity = 0.4 + 0.6 * Math.sin(elapsedTime * 9);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    // WebGL Context Loss & Restoration Safeguards
    const onContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('[Workspace3D] WebGL context lost. Pausing rendering.');
      cancelAnimationFrame(animationFrameId);
    };

    const onContextRestored = () => {
      console.info('[Workspace3D] WebGL context restored.');
      animate();
    };

    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      triggerBeamRef.current = null;
      activeBeams.forEach(b => {
        scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
      });

      // Deep recursive disposal of all geometries, materials, and textures in the scene
      scene.traverse((obj: any) => {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat: any) => {
              if (mat.map) mat.map.dispose();
              mat.dispose();
            });
          } else {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        }
      });

      controls.dispose();
      renderer.dispose();
      projCanvas.remove();
      floorCanvas.remove();
      rugCanvas.remove();
      neonCanvas.remove();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [agents, summary, operatorName]);

  // Handle Camera Movement Presets
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
    targetCamPos.current.set(0, 7.5, 5.5);
    targetLookAt.current.set(0, 7.5, -8.95);
  };

  const handleCamServerRack = () => {
    audioService.playCameraSwitch();
    setActiveCamView('server_rack');
    setAutoTour(false);
    setSelectedAgentId(null);
    targetCamPos.current.set(-11.5, 4.5, 3.5);
    targetLookAt.current.set(-17.5, 2.5, 1.5);
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
    const ax = isLeft ? -9.2 : 10.5;
    const az = (targetAgentIndex % 4) * 1.5 - 1.5;

    targetCamPos.current.set(ax + (isLeft ? 4.5 : -4.5), 3.8, az + 4.5);
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

  const handleToggleVoiceRecognition = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Browser Anda tidak mendukung Web Speech Recognition API. Gunakan browser Google Chrome atau Microsoft Edge untuk fitur perintah suara.');
      return;
    }

    if (isListeningVoice) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListeningVoice(false);
      setVoiceHUD(null);
      audioService.speak('Perintah suara dinonaktifkan.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'id-ID';

      recognition.onstart = () => {
        setIsListeningVoice(true);
        audioService.playClick();
        setVoiceHUD({
          text: 'Mendengarkan suara...',
          actionLabel: 'Katakan: "Buka Swarm", "Buat Tugas", "Kalender", "Dokumen", "Arena", dll.',
          status: 'listening'
        });
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        if (!transcript) return;

        let matched = false;
        let actionDesc = '';
        let spokenResponse = '';

        if (transcript.includes('swarm') || transcript.includes('kolaborasi')) {
          matched = true;
          actionDesc = 'Membuka Autonomous Mission Swarm';
          spokenResponse = 'Membuka Mission Swarm Control';
          onOpenSwarm?.();
        } else if (transcript.includes('buat tugas') || transcript.includes('tugas baru') || transcript.includes('create task') || transcript.includes('new task')) {
          matched = true;
          actionDesc = 'Membuka Pembuatan Tugas Baru';
          spokenResponse = 'Membuka formulir tugas baru';
          onOpenCreateTask();
        } else if (transcript.includes('tugas') || transcript.includes('tasks') || transcript.includes('riwayat')) {
          matched = true;
          actionDesc = 'Membuka Riwayat & Manajemen Tugas';
          spokenResponse = 'Membuka riwayat tugas';
          onOpenTasks();
        } else if (transcript.includes('jadwal') || transcript.includes('kalender') || transcript.includes('calendar') || transcript.includes('schedule')) {
          matched = true;
          actionDesc = 'Membuka Kalender & Jadwal Otomatis';
          spokenResponse = 'Membuka kalender jadwal otomatis';
          onOpenCalendar?.();
        } else if (transcript.includes('dokumen') || transcript.includes('sop') || transcript.includes('berkas') || transcript.includes('knowledge') || transcript.includes('document')) {
          matched = true;
          actionDesc = 'Membuka Repositori Dokumen & Basis Pengetahuan';
          spokenResponse = 'Membuka basis pengetahuan dokumen';
          onOpenDocuments?.();
        } else if (transcript.includes('arena') || transcript.includes('playground') || transcript.includes('eval') || transcript.includes('judge') || transcript.includes('benchmark')) {
          matched = true;
          actionDesc = 'Membuka LLM-as-a-Judge Arena & Evals';
          spokenResponse = 'Membuka LLM Judge Arena dan Evaluasi';
          onOpenPlayground?.();
        } else if (transcript.includes('pengaturan') || transcript.includes('setting') || transcript.includes('webhook') || transcript.includes('alert')) {
          matched = true;
          actionDesc = 'Membuka Pengaturan Sistem & Webhook';
          spokenResponse = 'Membuka pengaturan sistem';
          onOpenSettings?.();
        } else if (transcript.includes('workflow') || transcript.includes('pipeline') || transcript.includes('alur kerja') || transcript.includes('dag')) {
          matched = true;
          actionDesc = 'Membuka Visual DAG Workflow Studio';
          spokenResponse = 'Membuka Visual Workflow dan DAG Studio';
          onOpenPipeline?.();
        } else if (transcript.includes('proyek') || transcript.includes('project')) {
          matched = true;
          actionDesc = 'Membuka Daftar Proyek';
          spokenResponse = 'Membuka daftar proyek';
          onOpenProjects();
        } else if (transcript.includes('tim') || transcript.includes('manajemen') || transcript.includes('team') || transcript.includes('agen')) {
          matched = true;
          actionDesc = 'Membuka Manajemen Tim Agen';
          spokenResponse = 'Membuka manajemen tim agen';
          onOpenManageTeam();
        } else if (transcript.includes('overview') || transcript.includes('reset') || transcript.includes('kamera utama') || transcript.includes('tampilan utama')) {
          matched = true;
          actionDesc = 'Kamera Tampilan Overview';
          spokenResponse = 'Kamera diatur ke tampilan overview';
          handleCamOverview();
        } else if (transcript.includes('wall') || transcript.includes('dinding')) {
          matched = true;
          actionDesc = 'Kamera Tampilan Task Wall';
          spokenResponse = 'Kamera diarahkan ke task wall';
          handleCamTaskWall();
        } else if (transcript.includes('server') || transcript.includes('rack')) {
          matched = true;
          actionDesc = 'Kamera Tampilan Server Rack';
          spokenResponse = 'Kamera diarahkan ke server rack';
          handleCamServerRack();
        } else if (transcript.includes('isometrik') || transcript.includes('isometric')) {
          matched = true;
          actionDesc = 'Kamera Sudut Isometrik';
          spokenResponse = 'Kamera diatur ke sudut isometrik';
          handleCamIsometric();
        } else if (transcript.includes('tur') || transcript.includes('tour')) {
          matched = true;
          actionDesc = autoTour ? 'Menghentikan Auto Tour' : 'Memulai Auto Tour Studio 3D';
          spokenResponse = autoTour ? 'Auto tour dihentikan' : 'Memulai auto tour studio 3D';
          handleToggleAutoTour();
        } else if (transcript.includes('suara') || transcript.includes('mute') || transcript.includes('unmute')) {
          matched = true;
          actionDesc = isAudioMuted ? 'Mengaktifkan Suara SFX' : 'Mematikan Suara SFX';
          spokenResponse = isAudioMuted ? 'Suara diaktifkan' : 'Suara dinonaktifkan';
          handleToggleSound();
        } else if (transcript.includes('bantuan') || transcript.includes('help')) {
          matched = true;
          actionDesc = 'Bantuan Perintah Suara';
          spokenResponse = 'Perintah tersedia: Buka swarm, buat tugas, kalender, dokumen, arena eval, pengaturan, kamera server, atau tur.';
        }

        if (matched) {
          audioService.playBeam();
          audioService.speak(spokenResponse);
          setVoiceHUD({
            text: `"${transcript}"`,
            actionLabel: `✓ ${actionDesc}`,
            status: 'matched'
          });
        } else {
          setVoiceHUD({
            text: `"${transcript}"`,
            actionLabel: 'Perintah tidak dikenali. Coba: "Buka Swarm", "Kamera Server", "Dokumen", dll.',
            status: 'unrecognized'
          });
        }

        if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
        voiceTimeoutRef.current = setTimeout(() => {
          setVoiceHUD((prev) => (prev?.status === 'listening' ? prev : null));
        }, 5000);
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (voiceTimeoutRef.current) {
        clearTimeout(voiceTimeoutRef.current);
      }
      audioService.stopSpeaking();
    };
  }, []);

  if (!webGlSupported) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
        <h3 className="text-sm font-bold text-white">WebGL Tidak Didukung pada Browser Ini</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Perangkat Anda tidak mendukung akselerasi grafis 3D WebGL.
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
    <div className="relative w-full h-[480px] sm:h-[580px] lg:h-[700px] bg-[#1a2133] rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl shadow-blue-950/40 select-none">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Floating Holographic AI Token Stream / Reasoning HUD */}
      {liveStreamHUD && (
        <div className="absolute top-2.5 sm:top-4 left-1/2 -translate-x-1/2 z-30 max-w-md w-[calc(100%-24px)] sm:w-full p-2.5 sm:p-3 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 shadow-2xl shadow-cyan-950/50 pointer-events-auto animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 mb-1.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${liveStreamHUD.isThinking ? 'bg-indigo-400' : 'bg-cyan-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${liveStreamHUD.isThinking ? 'bg-indigo-500' : 'bg-cyan-500'}`}></span>
              </span>
              <span className="text-[11px] font-bold text-cyan-300 font-mono truncate">
                {liveStreamHUD.isThinking ? '🧠 Deep Reasoning Trace' : `⚡ ${liveStreamHUD.agentName} Mengetik...`}
              </span>
            </div>
            <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/40 uppercase tracking-wider shrink-0 font-bold">
              Live SSE
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-200 line-clamp-2 leading-relaxed break-words">
            {liveStreamHUD.text}
            <span className="inline-block w-1.5 h-3 ml-1 bg-cyan-400 animate-pulse align-middle" />
          </p>
        </div>
      )}

      {/* Floating Holographic Autonomous Swarm Coordination HUD */}
      {activeSwarmHUD && (
        <div className="absolute top-2.5 sm:top-4 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[calc(100%-24px)] sm:w-full p-2.5 sm:p-3 rounded-2xl bg-indigo-950/90 backdrop-blur-md border border-indigo-500/50 shadow-2xl shadow-indigo-950/60 pointer-events-auto animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-indigo-500/30 mb-1.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
              </span>
              <span className="text-[11px] font-bold text-indigo-300 font-mono truncate">
                ✦ AUTONOMOUS SWARM MESH
              </span>
            </div>
            {onOpenSwarm && (
              <button
                onClick={onOpenSwarm}
                className="text-[9px] font-mono text-indigo-200 bg-indigo-900/60 hover:bg-indigo-800/80 px-2 py-0.5 rounded border border-indigo-700/50 uppercase tracking-wider shrink-0 font-bold transition"
              >
                Buka Swarm HUD
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white truncate">
              {activeSwarmHUD.subtaskTitle}
            </span>
            {activeSwarmHUD.agentFrom && activeSwarmHUD.agentTo && (
              <span className="text-[10px] text-indigo-300 shrink-0 font-mono">
                {activeSwarmHUD.agentFrom} ➔ {activeSwarmHUD.agentTo}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Floating Holographic Voice Command & Speech Feedback HUD */}
      {(isListeningVoice || voiceHUD) && (
        <div className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[calc(100%-20px)] sm:w-auto min-w-0 p-2.5 sm:p-3 rounded-2xl bg-slate-950/95 backdrop-blur-md border border-cyan-500/50 shadow-2xl shadow-cyan-950/70 pointer-events-auto animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 mb-1.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isListeningVoice ? 'bg-rose-400' : 'bg-cyan-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isListeningVoice ? 'bg-rose-500' : 'bg-cyan-500'}`}></span>
              </span>
              <span className="text-[11px] font-bold text-cyan-300 font-mono truncate flex items-center gap-1.5">
                <Mic className={`w-3.5 h-3.5 ${isListeningVoice ? 'text-rose-400 animate-pulse' : 'text-cyan-400'}`} />
                {isListeningVoice ? 'VOICE COMMAND AKTIF' : 'SPEECH SYNTHESIS HUD'}
              </span>
            </div>
            <button
              onClick={() => {
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.stop();
                  } catch {
                    // ignore
                  }
                }
                setIsListeningVoice(false);
                setVoiceHUD(null);
                audioService.stopSpeaking();
              }}
              className="text-slate-500 hover:text-slate-300 transition"
              title="Tutup Voice HUD"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-mono font-semibold text-slate-100 flex items-center gap-1.5">
              {voiceHUD?.status === 'matched' ? (
                <span className="text-emerald-400 font-bold">🎤 Terdeteksi:</span>
              ) : voiceHUD?.status === 'unrecognized' ? (
                <span className="text-amber-400 font-bold">❓ Belum Cocok:</span>
              ) : (
                <span className="text-cyan-400 animate-pulse font-bold">🎙️ Bicara:</span>
              )}
              <span className="truncate text-white">{voiceHUD?.text || 'Mendengarkan instruksi...'}</span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              {voiceHUD?.actionLabel || 'Contoh suara: "Buka Swarm", "Kamera Server", "Buat Tugas", "Dokumen", dll.'}
            </p>
          </div>
        </div>
      )}

      {/* Floating Top-Left Card: ✦ Team • Live */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 flex flex-col gap-2 pointer-events-auto max-w-[calc(100%-16px)] sm:max-w-xs">
        <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-800 shadow-xl w-full">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2 pb-1.5 border-b border-slate-800/80">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>✦ Team AI</span>
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Studio Live</span>
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
                      ? 'bg-blue-600/30 border-blue-500 text-white'
                      : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                  title={`Klik untuk fokus kamera ke ${agent.name}`}
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                    {agent.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-[11px] block leading-tight truncate max-w-[70px]">
                      {agent.name}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono block leading-tight">
                      {agent.status === 'BUSY' ? 'sedang kerja' : 'siap'}
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
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>AI Workforce Status</span>
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>live</span>
                </div>
                <button
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
                  <span>Tugas Berjalan</span>
                </span>
                <span className="font-bold text-amber-400">
                  {summary?.runningTasksCount ?? 0} aktif
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tugas Selesai</span>
                </span>
                <span className="font-bold text-emerald-400">
                  {summary?.completedTasksCount ?? 0} tugas
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-purple-400" />
                  <span>Agen Aktif</span>
                </span>
                <span className="font-bold text-cyan-400">
                  {agents.filter((a) => a.enabled !== false).length} / {agents.length} siap
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Proyek</span>
                </span>
                <span className="font-bold text-slate-200">
                  {summary?.activeProjectsCount ?? 0} pipeline
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ActivityIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Status AI</span>
                </span>
                <span className="font-bold text-emerald-400">
                  Optimal (SLA 99.9%)
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Panel: Aktivitas Terbaru */}
          <div className="p-4 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold text-white">Aktivitas terbaru</span>
              <span className="text-[10px] text-slate-500 font-mono">{activities.length} logs</span>
            </div>

            <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 max-h-60 text-xs">
              {activities.slice(0, 6).map((act) => (
                <div key={act.id} className="flex items-start gap-2.5 pb-2 border-b border-slate-800/40">
                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-[10px] font-bold text-cyan-400 mt-0.5">
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
        <div className="absolute bottom-20 left-4 z-20 p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-blue-500/50 text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none max-w-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white text-sm">{hoveredAgent.name}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {hoveredAgent.role}
            </span>
          </div>
          <p className="text-slate-400 text-[11px] font-mono">Model: {hoveredAgent.modelId}</p>
          <p className="text-cyan-400 text-[10px] mt-1 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Klik avatar untuk detail & eksekusi prompt</span>
          </p>
        </div>
      )}

      {/* Floating Bottom Toolbar */}
      <div className="absolute bottom-2.5 inset-x-2 sm:bottom-4 sm:inset-x-4 z-20 flex items-center justify-between gap-1.5 sm:gap-3 pointer-events-auto max-w-[calc(100%-16px)] mx-auto overflow-hidden">
        {/* Left Action: + Titip tugas baru */}
        <button
          onClick={onOpenCreateTask}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 backdrop-blur-md border border-slate-800 text-xs font-bold text-white shadow-xl transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="hidden sm:inline">+ Titip tugas baru</span>
          <span className="sm:hidden text-[11px] font-bold">Tugas</span>
        </button>

        {/* Center: Camera Director Pills */}
        <div className="flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-xl gap-1 overflow-x-auto no-scrollbar max-w-full min-w-0">
          <button
            onClick={handleCamOverview}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
              activeCamView === 'overview'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>⊙ Overview</span>
          </button>

          <button
            onClick={handleCamTaskWall}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
              activeCamView === 'task_wall'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>▣ Task wall</span>
          </button>

          <button
            onClick={handleCamServerRack}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
              activeCamView === 'server_rack'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Fokus Kamera ke Server Rack"
          >
            <Server className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Server Rack</span>
            <span className="sm:hidden">Rack</span>
          </button>

          <button
            onClick={handleCamIsometric}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
              activeCamView === 'isometric'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Sudut Pandang Isometrik 3D"
          >
            <span>📐 Isometrik</span>
          </button>

          {/* Quick Agent Pills (hidden on mobile, visible on desktop) */}
          {agents.slice(0, 3).map((agent) => (
            <button
              key={agent.id}
              onClick={() => handleCamFocusAgent(agent)}
              className={`hidden md:flex px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition items-center gap-1 shrink-0 whitespace-nowrap ${
                selectedAgentId === agent.id && activeCamView === 'agent'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>{agent.name.split(' ')[0]}</span>
            </button>
          ))}

          <button
            onClick={handleToggleAutoTour}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
              autoTour
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <RotateCw className={`w-3 h-3 ${autoTour ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Auto-tour</span>
            <span className="sm:hidden">Tour</span>
          </button>
        </div>

        {/* Right Toggle Button: Riwayat tugas & aktivitas • Live */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Cybernetic Voice Command Toggle Button */}
          <button
            onClick={handleToggleVoiceRecognition}
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md border text-xs font-semibold shadow-xl transition flex items-center justify-center ${
              isListeningVoice
                ? 'bg-rose-500/20 border-rose-500/60 text-rose-400 hover:bg-rose-500/30 shadow-rose-500/20 animate-pulse'
                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30'
            }`}
            title={isListeningVoice ? 'Voice Command Aktif (Klik untuk Matikan)' : 'Perintah Suara & Speech Synthesis (Klik untuk Aktifkan)'}
            aria-label="Toggle Voice Command"
          >
            {isListeningVoice ? <Mic className="w-4 h-4 text-rose-400" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Cybernetic SFX Toggle Button */}
          <button
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
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md border text-xs font-semibold shadow-xl transition ${
              isSidebarOpen
                ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white'
                : 'bg-blue-600 border-blue-500 text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden sm:inline">Riwayat tugas & aktivitas</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </button>

          <button
            onClick={onFallbackTo2D}
            className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 backdrop-blur-md border border-slate-800 text-slate-400 hover:text-white transition"
            title="Beralih ke Tampilan 2D"
          >
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
