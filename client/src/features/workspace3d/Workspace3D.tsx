import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AIAgent, DashboardSummary, ServerMetrics, Activity } from '../../../../shared/types.js';
import {
  Monitor,
  RotateCw,
  Eye,
  Compass,
  Zap,
  Activity as ActivityIcon,
  Layers,
  Sparkles,
  Plus,
  Play,
  Cpu,
  HardDrive,
  Clock,
  Radio,
  ChevronRight,
  Maximize2,
  X,
  User,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  Server
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
  const targetCamPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 14, 22));
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

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2133); // Soft midnight navy background
    scene.fog = new THREE.FogExp2(0x1a2133, 0.022);

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
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 2. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera under floor
    controls.minDistance = 6;
    controls.maxDistance = 42;
    controls.target.set(0, 2.5, 0);
    controlsRef.current = controls;

    // 3. Ambient & Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xe2e8f0, 1.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.4);
    sunLight.position.set(16, 26, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 70;
    sunLight.shadow.bias = -0.0002;
    scene.add(sunLight);

    const softFillLight = new THREE.DirectionalLight(0xa5b4fc, 1.2);
    softFillLight.position.set(-18, 18, -12);
    scene.add(softFillLight);

    const loungeLight = new THREE.PointLight(0xfef08a, 1.2, 18);
    loungeLight.position.set(0, 4.5, 2);
    scene.add(loungeLight);

    // 4. Studio Room Architecture: Floor, Walls, Rugs
    // A. Warm Matte Cream/Beige Studio Floor
    const floorGeo = new THREE.PlaneGeometry(38, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xcfc5bb,
      roughness: 0.85,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // B. Soft Pastel Lavender Circular Rug (Center Lounge)
    const rugGeo1 = new THREE.CircleGeometry(4.8, 48);
    const rugMat1 = new THREE.MeshStandardMaterial({
      color: 0xa899c7,
      roughness: 0.95
    });
    const rug1 = new THREE.Mesh(rugGeo1, rugMat1);
    rug1.rotation.x = -Math.PI / 2;
    rug1.position.set(0, 0.015, 2.8);
    rug1.receiveShadow = true;
    scene.add(rug1);

    // C. Soft Sky-Blue Adjacent Circular Rug
    const rugGeo2 = new THREE.CircleGeometry(3.2, 48);
    const rugMat2 = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.95
    });
    const rug2 = new THREE.Mesh(rugGeo2, rugMat2);
    rug2.rotation.x = -Math.PI / 2;
    rug2.position.set(-3.2, 0.02, 3.6);
    rug2.receiveShadow = true;
    scene.add(rug2);

    // D. Back Gradient Wall
    const backWallGeo = new THREE.PlaneGeometry(38, 14);
    const backWallMat = new THREE.MeshStandardMaterial({
      color: 0x333c56,
      roughness: 0.8
    });
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(0, 7, -8.5);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // E. Left Accent Wall with Neon Typography Sign
    const leftWallGeo = new THREE.PlaneGeometry(30, 14);
    const leftWallMat = new THREE.MeshStandardMaterial({
      color: 0x272f45,
      roughness: 0.8
    });
    const leftWall = new THREE.Mesh(leftWallGeo, leftWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-18.5, 7, 6);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Neon Wall Art: "GOOD IDEAS BETTER WEBSITES"
    const neonCanvas = document.createElement('canvas');
    neonCanvas.width = 512;
    neonCanvas.height = 256;
    const nctx = neonCanvas.getContext('2d')!;
    nctx.clearRect(0, 0, 512, 256);
    nctx.font = 'bold 38px sans-serif';
    nctx.fillStyle = '#818cf8';
    nctx.shadowColor = '#6366f1';
    nctx.shadowBlur = 18;
    nctx.fillText('GOOD', 30, 70);
    nctx.fillText('IDEAS', 30, 125);
    nctx.fillText('BETTER', 30, 180);
    nctx.fillText('WEBSITES', 30, 235);

    const neonTexture = new THREE.CanvasTexture(neonCanvas);
    const neonGeo = new THREE.PlaneGeometry(6, 3);
    const neonMat = new THREE.MeshBasicMaterial({
      map: neonTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const neonSign = new THREE.Mesh(neonGeo, neonMat);
    neonSign.rotation.y = Math.PI / 2;
    neonSign.position.set(-18.4, 6.5, -2);
    scene.add(neonSign);

    // 5. Large Projector Screen on the Back Wall (Interactive Live Dashboard)
    const projCanvas = document.createElement('canvas');
    projCanvas.width = 1024;
    projCanvas.height = 512;
    const pctx = projCanvas.getContext('2d')!;
    const projTex = new THREE.CanvasTexture(projCanvas);

    const projGeo = new THREE.PlaneGeometry(13.6, 6.8);
    const projMat = new THREE.MeshBasicMaterial({
      map: projTex,
      side: THREE.DoubleSide
    });
    const projScreen = new THREE.Mesh(projGeo, projMat);
    projScreen.position.set(0, 7.2, -8.4);
    scene.add(projScreen);

    // Projector Mount Bar & Suspension Wires
    const projBarGeo = new THREE.CylinderGeometry(0.08, 0.08, 14.4, 16);
    const projBarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const projBar = new THREE.Mesh(projBarGeo, projBarMat);
    projBar.rotation.z = Math.PI / 2;
    projBar.position.set(0, 10.7, -8.35);
    scene.add(projBar);

    // Function to render content on projector canvas
    const updateProjectorScreen = () => {
      pctx.fillStyle = '#20293d';
      pctx.fillRect(0, 0, 1024, 512);

      // Gradient header backdrop
      const grad = pctx.createLinearGradient(0, 0, 1024, 0);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#2c3752');
      pctx.fillStyle = grad;
      pctx.fillRect(0, 0, 1024, 160);

      // Greeting Header
      pctx.font = 'bold 38px sans-serif';
      pctx.fillStyle = '#ffffff';
      pctx.fillText(`Selamat siang, ${operatorName}! 👋`, 50, 75);

      pctx.font = '22px sans-serif';
      pctx.fillStyle = '#94a3b8';
      pctx.fillText('Semua sistem berjalan dengan baik.', 50, 120);

      // 4 Metric Pill Cards on the Projector
      const runningCount = summary?.runningTasksCount ?? 0;
      const completedCount = summary?.completedTasksCount ?? 2;
      const onlineAgents = summary?.onlineAgentsCount ?? agents.filter(a => a.status === 'READY').length;
      const totalAgents = summary?.totalAgentsCount ?? agents.length;
      const activeProj = summary?.activeProjectsCount ?? 2;

      const cards = [
        { label: 'Tugas berjalan', val: `${runningCount}`, col: '#38bdf8' },
        { label: 'Selesai hari ini', val: `${completedCount}`, col: '#34d399' },
        { label: 'Tim online', val: `${onlineAgents}/${totalAgents} online`, col: '#a855f7' },
        { label: 'Proyek aktif', val: `${activeProj}`, col: '#fbbf24' }
      ];

      cards.forEach((c, idx) => {
        const cx = 50 + idx * 230;
        const cy = 200;
        pctx.fillStyle = '#172033';
        pctx.beginPath();
        pctx.roundRect(cx, cy, 210, 140, 16);
        pctx.fill();

        pctx.strokeStyle = '#2d3b55';
        pctx.lineWidth = 2;
        pctx.stroke();

        // Indicator dot
        pctx.fillStyle = c.col;
        pctx.beginPath();
        pctx.arc(cx + 25, cy + 32, 7, 0, Math.PI * 2);
        pctx.fill();

        pctx.font = '16px sans-serif';
        pctx.fillStyle = '#94a3b8';
        pctx.fillText(c.label, cx + 42, cy + 38);

        pctx.font = 'bold 36px monospace';
        pctx.fillStyle = '#ffffff';
        pctx.fillText(c.val, cx + 25, cy + 96);
      });

      // Active Task Status Box below
      pctx.fillStyle = '#172033';
      pctx.beginPath();
      pctx.roundRect(50, 375, 924, 90, 16);
      pctx.fill();
      pctx.strokeStyle = '#2d3b55';
      pctx.stroke();

      pctx.font = '17px sans-serif';
      pctx.fillStyle = '#64748b';
      pctx.fillText('Task saat ini:', 80, 412);

      pctx.font = 'bold 20px sans-serif';
      pctx.fillStyle = runningCount > 0 ? '#38bdf8' : '#94a3b8';
      pctx.fillText(
        runningCount > 0
          ? 'Sedang menjalankan eksekusi orkestrasi otomatis...'
          : 'Belum ada tugas berjalan. Sistem siap menerima instruksi.',
        80,
        446
      );

      projTex.needsUpdate = true;
    };
    updateProjectorScreen();

    // 6. Furniture & Studio Props
    // A. Center Lounge: Modern Grey Fabric Sofa with Plaid Throw
    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(-2.5, 0, 1.8);
    sofaGroup.rotation.y = 0.25;

    // Sofa Base / Cushion
    const sofaBaseGeo = new THREE.BoxGeometry(4.4, 0.9, 2.0);
    const sofaBaseMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    const sofaBase = new THREE.Mesh(sofaBaseGeo, sofaBaseMat);
    sofaBase.position.set(0, 0.45, 0);
    sofaBase.castShadow = true;
    sofaBase.receiveShadow = true;
    sofaGroup.add(sofaBase);

    // Sofa Backrest
    const sofaBackGeo = new THREE.BoxGeometry(4.4, 1.2, 0.5);
    const sofaBack = new THREE.Mesh(sofaBackGeo, sofaBaseMat);
    sofaBack.position.set(0, 1.1, -0.75);
    sofaBack.castShadow = true;
    sofaGroup.add(sofaBack);

    // Sofa Armrests
    const armGeo = new THREE.BoxGeometry(0.5, 0.8, 2.0);
    const armL = new THREE.Mesh(armGeo, sofaBaseMat);
    armL.position.set(-2.2, 0.85, 0);
    const armR = new THREE.Mesh(armGeo, sofaBaseMat);
    armR.position.set(2.2, 0.85, 0);
    sofaGroup.add(armL);
    sofaGroup.add(armR);

    // Plaid Throw Blanket draped on sofa
    const throwGeo = new THREE.BoxGeometry(1.6, 0.05, 1.6);
    const throwMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.8 });
    const throwMesh = new THREE.Mesh(throwGeo, throwMat);
    throwMesh.position.set(-0.6, 0.93, 0.1);
    throwMesh.rotation.y = 0.1;
    sofaGroup.add(throwMesh);

    scene.add(sofaGroup);

    // B. Soft Beanbags / Poufs
    // Sky-Blue Round Beanbag
    const pouf1Geo = new THREE.SphereGeometry(0.9, 16, 16);
    const pouf1Mat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.95 });
    const pouf1 = new THREE.Mesh(pouf1Geo, pouf1Mat);
    pouf1.scale.set(1.1, 0.65, 1.1);
    pouf1.position.set(-4.5, 0.4, 4.2);
    pouf1.castShadow = true;
    scene.add(pouf1);

    // Pastel Yellow Round Beanbag
    const pouf2Geo = new THREE.SphereGeometry(0.8, 16, 16);
    const pouf2Mat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.95 });
    const pouf2 = new THREE.Mesh(pouf2Geo, pouf2Mat);
    pouf2.scale.set(1.0, 0.6, 1.0);
    pouf2.position.set(-3.0, 0.35, 5.8);
    pouf2.castShadow = true;
    scene.add(pouf2);

    // C. Modular Wooden Coffee Table Blocks (Right of Lounge)
    const tableGroup = new THREE.Group();
    tableGroup.position.set(5.2, 0, 3.8);

    const block1Geo = new THREE.BoxGeometry(2.4, 0.8, 2.0);
    const blockMat = new THREE.MeshStandardMaterial({ color: 0xded2c6, roughness: 0.7 });
    const block1 = new THREE.Mesh(block1Geo, blockMat);
    block1.position.set(0, 0.4, 0);
    block1.castShadow = true;
    block1.receiveShadow = true;
    tableGroup.add(block1);

    const block2Geo = new THREE.BoxGeometry(1.8, 1.1, 1.6);
    const block2 = new THREE.Mesh(block2Geo, blockMat);
    block2.position.set(1.4, 0.55, 0.6);
    block2.castShadow = true;
    tableGroup.add(block2);

    scene.add(tableGroup);

    // D. Mini Retro Green Radio/Speaker on Floor with Cable
    const radioGeo = new THREE.BoxGeometry(0.6, 0.8, 0.45);
    const radioMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 });
    const radio = new THREE.Mesh(radioGeo, radioMat);
    radio.position.set(0.5, 0.4, 5.0);
    radio.rotation.y = -0.4;
    radio.castShadow = true;
    scene.add(radio);

    // Radio speaker grille
    const grilleGeo = new THREE.CircleGeometry(0.18, 16);
    const grilleMat = new THREE.MeshBasicMaterial({ color: 0x064e3b });
    const grille = new THREE.Mesh(grilleGeo, grilleMat);
    grille.position.set(0.5, 0.5, 5.23);
    grille.rotation.y = -0.4;
    scene.add(grille);

    // E. Indoor Potted Plants (Monstera / Foliage in Terracotta Pots)
    const plantLocations = [
      [-16, -6],
      [-17, 8],
      [16, 7]
    ];
    plantLocations.forEach(([px, pz]) => {
      const plantGroup = new THREE.Group();
      plantGroup.position.set(px, 0, pz);

      // Pot
      const potGeo = new THREE.CylinderGeometry(0.65, 0.45, 1.2, 16);
      const potMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.8 });
      const pot = new THREE.Mesh(potGeo, potMat);
      pot.position.set(0, 0.6, 0);
      pot.castShadow = true;
      plantGroup.add(pot);

      // Leaves (Multiple stylized broad leaves)
      for (let li = 0; li < 6; li++) {
        const leafAngle = (li / 6) * Math.PI * 2;
        const leafGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x34d399, roughness: 0.7 });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.scale.set(0.4, 1.2, 0.1);
        leaf.position.set(Math.cos(leafAngle) * 0.4, 1.5 + Math.random() * 0.4, Math.sin(leafAngle) * 0.4);
        leaf.rotation.set(Math.sin(leafAngle) * 0.5, leafAngle, Math.cos(leafAngle) * 0.5);
        leaf.castShadow = true;
        plantGroup.add(leaf);
      }
      scene.add(plantGroup);
    });

    // 7. Workstations & Stylized 3D Character Avatars
    const interactiveMeshes: THREE.Mesh[] = [];
    const agentMap = new Map<THREE.Mesh, AIAgent>();
    const agentPositions: { agent: AIAgent; pos: THREE.Vector3 }[] = [];

    // Desk clusters: 2 desks on the Left side, 2 desks on the Right side
    const deskConfigs = [
      { deskPos: new THREE.Vector3(-11, 0, -2.5), charPos: new THREE.Vector3(-9.2, 0, -2.5), isStanding: true },
      { deskPos: new THREE.Vector3(-11, 0, 3.5), charPos: new THREE.Vector3(-11, 0, 4.4), isStanding: false },
      { deskPos: new THREE.Vector3(10.5, 0, -2.5), charPos: new THREE.Vector3(10.5, 0, -1.6), isStanding: false },
      { deskPos: new THREE.Vector3(10.5, 0, 3.5), charPos: new THREE.Vector3(12.2, 0, 3.5), isStanding: true }
    ];

    agents.forEach((agent, index) => {
      const cfg = deskConfigs[index % deskConfigs.length];
      const deskOffset = Math.floor(index / deskConfigs.length) * 0.8;
      const deskX = cfg.deskPos.x + (index >= 4 ? (cfg.deskPos.x > 0 ? 3 : -3) : 0);
      const deskZ = cfg.deskPos.z + deskOffset;

      const workstationGroup = new THREE.Group();
      workstationGroup.position.set(deskX, 0, deskZ);

      // Desk Top (Light Wood / Minimalist White)
      const deskTopGeo = new THREE.BoxGeometry(3.6, 0.12, 1.8);
      const deskTopMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 });
      const deskTop = new THREE.Mesh(deskTopGeo, deskTopMat);
      deskTop.position.set(0, 1.3, 0);
      deskTop.castShadow = true;
      deskTop.receiveShadow = true;
      workstationGroup.add(deskTop);

      // Desk Legs (Blue / Grey cylindrical modern legs)
      const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.3, 12);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
      [
        [-1.6, 0.65, -0.75],
        [1.6, 0.65, -0.75],
        [-1.6, 0.65, 0.75],
        [1.6, 0.65, 0.75]
      ].forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, ly, lz);
        leg.castShadow = true;
        workstationGroup.add(leg);
      });

      // White Monitor Riser Stand
      const riserGeo = new THREE.BoxGeometry(2.4, 0.16, 0.6);
      const riserMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const riser = new THREE.Mesh(riserGeo, riserMat);
      riser.position.set(0, 1.44, -0.4);
      riser.castShadow = true;
      workstationGroup.add(riser);

      // Dual Computer Monitors displaying code/UI
      [-0.65, 0.65].forEach((mx) => {
        const monGeo = new THREE.BoxGeometry(1.0, 0.65, 0.06);
        const monMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          emissive: agent.status === 'BUSY' ? 0xf59e0b : 0x0284c7,
          emissiveIntensity: 0.6
        });
        const mon = new THREE.Mesh(monGeo, monMat);
        mon.position.set(mx, 1.88, -0.4);
        mon.rotation.y = mx > 0 ? -0.1 : 0.1;
        workstationGroup.add(mon);
      });

      // Blue Round Stool Chair
      const stoolGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.8, 16);
      const stoolMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
      const stool = new THREE.Mesh(stoolGeo, stoolMat);
      stool.position.set(0, 0.4, 0.9);
      stool.castShadow = true;
      workstationGroup.add(stool);

      scene.add(workstationGroup);

      // B. Stylized 3D Chibi / Humanoid Character Avatar
      const charGroup = new THREE.Group();
      const charX = cfg.charPos.x + (index >= 4 ? (cfg.charPos.x > 0 ? 3 : -3) : 0);
      const charZ = cfg.charPos.z + deskOffset;
      charGroup.position.set(charX, 0, charZ);

      // Orientation towards desk
      if (cfg.isStanding) {
        charGroup.lookAt(charX + (deskX > charX ? 1 : -1), 0, charZ);
      } else {
        charGroup.lookAt(deskX, 0, deskZ);
      }

      // Torso / Hoodie (Colored per agent role)
      const roleColor =
        agent.role === 'Orchestrator'
          ? 0x3b82f6
          : agent.role === 'Planner'
          ? 0x8b5cf6
          : agent.role === 'Executor'
          ? 0x10b981
          : agent.role === 'QA / Reviewer'
          ? 0xf59e0b
          : 0xec4899;

      const bodyGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.9, 16);
      const bodyMat = new THREE.MeshStandardMaterial({ color: roleColor, roughness: 0.6 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(0, 1.1, 0);
      body.castShadow = true;
      charGroup.add(body);

      // Legs / Pants
      const legPantsGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 12);
      const legPantsMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
      const legL = new THREE.Mesh(legPantsGeo, legPantsMat);
      legL.position.set(-0.16, 0.45, 0);
      const legR = new THREE.Mesh(legPantsGeo, legPantsMat);
      legR.position.set(0.16, 0.45, 0);
      charGroup.add(legL);
      charGroup.add(legR);

      // Shoes / Sneakers (White)
      const shoeGeo = new THREE.BoxGeometry(0.18, 0.14, 0.3);
      const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
      shoeL.position.set(-0.16, 0.08, 0.05);
      const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
      shoeR.position.set(0.16, 0.08, 0.05);
      charGroup.add(shoeL);
      charGroup.add(shoeR);

      // Head / Face
      const headGeo = new THREE.SphereGeometry(0.36, 16, 16);
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdfc4 });
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 1.85, 0);
      head.castShadow = true;
      charGroup.add(head);

      // Anime / Chibi Hair (Dark brown / black)
      const hairGeo = new THREE.SphereGeometry(0.39, 16, 16);
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18 });
      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.set(0, 1.93, -0.05);
      charGroup.add(hair);

      // If standing, add coffee mug or tablet
      if (cfg.isStanding) {
        const mugGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.22, 12);
        const mugMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const mug = new THREE.Mesh(mugGeo, mugMat);
        mug.position.set(0.35, 1.0, 0.3);
        charGroup.add(mug);
      }

      scene.add(charGroup);

      // Register head mesh for interaction
      interactiveMeshes.push(head);
      agentMap.set(head, agent);
      agentPositions.push({ agent, pos: new THREE.Vector3(charX, 1.5, charZ) });
    });

    // 8. Raycasting (Interaction & Hover)
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

    // 10. Animation Loop & Smooth Camera Glide
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera interpolation towards target position and target lookAt
      if (activeCamView !== 'tour' && !autoTour) {
        camera.position.lerp(targetCamPos.current, 0.05);
        controls.target.lerp(targetLookAt.current, 0.05);
      } else {
        // Auto-tour orbit
        const orbitRadius = 22;
        const orbitAngle = elapsedTime * 0.15;
        camera.position.x = Math.sin(orbitAngle) * orbitRadius;
        camera.position.z = Math.cos(orbitAngle) * orbitRadius;
        camera.position.y = 15 + Math.sin(elapsedTime * 0.25) * 2;
        controls.target.set(0, 2.5, 0);
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

  // Handle Camera Moves
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
    targetCamPos.current.set(0, 7.2, 5.5);
    targetLookAt.current.set(0, 7.2, -8.4);
  };

  const handleCamServerRack = () => {
    audioService.playCameraSwitch();
    setActiveCamView('server_rack');
    setAutoTour(false);
    setSelectedAgentId(null);
    targetCamPos.current.set(0, 4.2, 6.5);
    targetLookAt.current.set(0, 1.8, -1.0);
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

    // Find agent desk coordinate
    const targetAgentIndex = agents.findIndex(a => a.id === agent.id);
    const isLeft = targetAgentIndex % 2 === 0;
    const ax = isLeft ? -9.5 : 9.5;
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

      {/* Floating Top-Left Card: ✦ Team • Live (Matching Reference Screenshot) */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 flex flex-col gap-2 pointer-events-auto max-w-[calc(100%-16px)] sm:max-w-xs">
        <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-800 shadow-xl w-full">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2 pb-1.5 border-b border-slate-800/80">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>✦ Team</span>
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live</span>
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
                      {agent.status === 'BUSY' ? 'sedang kerja' : 'denyut baru'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Right Panel: Server & Layanan + Aktivitas Terbaru (Matching Reference Screenshot) */}
      {isSidebarOpen && (
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-30 w-[calc(100%-16px)] sm:w-80 max-h-[85%] sm:max-h-[88%] flex flex-col gap-2.5 sm:gap-3 pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-right-4">
          {/* Top Panel: Server & Layanan • live */}
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>Server & layanan</span>
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
                  <span>CPU</span>
                </span>
                <span className="font-bold text-emerald-400">
                  {serverMetrics?.cpuUsagePercent ?? 8.2}% ({serverMetrics?.cpuCores ?? 2} core)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>RAM</span>
                </span>
                <span className="font-bold text-cyan-400">
                  {serverMetrics
                    ? `${(serverMetrics.memoryUsedBytes / (1024 * 1024)).toFixed(0)} / ${(
                        serverMetrics.memoryTotalBytes / (1024 * 1024)
                      ).toFixed(0)} MB (${serverMetrics.memoryUsagePercent}%)`
                    : '1434 / 1936 MB (74.1%)'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-pink-400" />
                  <span>Disk</span>
                </span>
                <span className="font-bold text-slate-300">
                  {serverMetrics
                    ? `${(serverMetrics.diskUsedBytes / (1024 * 1024 * 1024)).toFixed(1)} / ${(serverMetrics.diskTotalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB (${serverMetrics.diskUsagePercent}%)`
                    : '19.6 / 42.2 GB (46.5%)'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ActivityIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Load</span>
                </span>
                <span className="font-bold text-emerald-400">
                  {serverMetrics?.loadAvg ? serverMetrics.loadAvg.map((v) => v.toFixed(2)).join(' / ') : '0.02 / 0.08 / 0.08'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Uptime</span>
                </span>
                <span className="font-bold text-slate-300">
                  {serverMetrics ? `${Math.floor(serverMetrics.uptimeSeconds / 3600)}h` : '7h 4j'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Panel: Aktivitas Terbaru (Live feed list) */}
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

      {/* Floating Bottom Toolbar (Matching Reference Screenshot) */}
      <div className="absolute bottom-2.5 inset-x-2 sm:bottom-4 sm:inset-x-4 z-20 flex items-center justify-between gap-1.5 sm:gap-3 pointer-events-auto">
        {/* Left Action: + Titip tugas baru */}
        <button
          onClick={onOpenCreateTask}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 backdrop-blur-md border border-slate-800 text-xs font-bold text-white shadow-xl transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="hidden sm:inline">+ Titip tugas baru</span>
          <span className="sm:hidden text-[11px] font-bold">Tugas</span>
        </button>

        {/* Center: Camera Director Pills (Overview, Task wall, Arka, Hanna, Auto-tour) */}
        <div className="flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-xl gap-1 overflow-x-auto no-scrollbar max-w-full">
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

          {/* Quick Agent Pills */}
          {agents.slice(0, 3).map((agent) => (
            <button
              key={agent.id}
              onClick={() => handleCamFocusAgent(agent)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center gap-1 shrink-0 whitespace-nowrap ${
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
