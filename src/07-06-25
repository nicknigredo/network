import React from 'react';
import { MapContainer, TileLayer, Marker, ScaleControl, useMapEvents, Popup, Tooltip, Polyline, LayerGroup, LayersControl, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { DivIcon, DragEndEvent, LatLngExpression } from 'leaflet';
import { useRef, useEffect, useState } from 'react';
import JSZip from 'jszip';
import * as XLSX from 'xlsx'; // <-- Импортируем библиотеку xlsx
import { saveAs } from 'file-saver'; // <-- Импортируем saveAs из file-saver
import Tabs from './components/Tabs';

// Тип для структуры волокна и модуля
interface FiberStructure {
  module: number;
  moduleColor: { name: string; color: string; border?: string };
  fiber: number;
  fiberColor: { name: string; color: string; border?: string };
}

// Тип для бокса
interface Box {
  id: number;
  position: [number, number];
  number: string;
  splitter: string;
  address: string;
  place: string;
  connections: {
    input: { cableId: number } | null;
    outputs: Array<{ cableId: number } | null>;
  };
}

// Тип для кабеля
interface Cable {
  id: number;
  points: [number, number][];
  sourceBoxId: number;
  targetBoxId: number | null;
  fiberCount: number;
  layingType: 'подвес' | 'канализация';
}

// Тип для компонента CableDetailDialog
interface CableDetailDialogProps {
  box: Box | null;
  onClose: () => void;
  cables: Cable[];
  boxes: Box[];
  fiberConnections: {
    end1: { cableId: string; fiberIdx: number };
    end2: { cableId: string; fiberIdx: number };
  }[];
  selectedFiber: {
    cableId: string;
    fiberIdx: number;
    direction: 'in' | 'out';
  } | null;
  onFiberClick: (cableId: string, fiberIdx: number, direction: 'in' | 'out') => void;
  onRemoveFiberConnection: (idx: number) => void;
  style?: React.CSSProperties;
}

// Тип для цветов ODESA
interface OdesaColor {
  name: string;
  color: string;
  border?: string;
}

// Константы для цветов ODESA
const ODESA_COLORS: OdesaColor[] = [
  { name: 'червоний', color: '#ff0000' },
  { name: 'зелений', color: '#00b050' },
  { name: 'синій', color: '#0070c0' },
  { name: 'жовтий', color: '#ffff00' },
  { name: 'білий', color: '#ffffff', border: '#bbb' },
  { name: 'сірий', color: '#b7b7b7' },
  { name: 'коричневий', color: '#703000' },
  { name: 'фіолетовий', color: '#7030a0' },
  { name: 'оранжевий', color: '#ff9900' },
  { name: 'чорний', color: '#000000' },
  { name: 'рожевий', color: '#ff99cc' },
  { name: 'бірюзовий', color: '#00ffff' },
];

// === Тип для опоры ===
interface Pole {
  id: number;
  position: [number, number];
  number: string;
  tpNumber: string;
  purpose: '0,4кВт' | '10кВт' | 'УТК' | 'Освещение';
  labelOffset: [number, number]; // смещение подписи
}

// === Тип для колодца ===
interface Well {
  id: number;
  position: [number, number];
  number: string;
  labelOffset: [number, number];
}

// === Универсальный тип выбранного элемента ===
type SelectedElement =
  | { type: 'box'; id: number }
  | { type: 'cable'; id: number }
  | { type: 'pole'; id: number }
  | { type: 'well'; id: number }
  | null;

function CableDetailDialog({
  box,
  onClose,
  cables,
  boxes,
  fiberConnections,
  selectedFiber,
  onFiberClick,
  onRemoveFiberConnection,
  style
}: CableDetailDialogProps) {
  const [maxHeight, setMaxHeight] = useState(600);
  const [rowHeight] = useState(24); // Высота строки для расчетов
  const [totalWidth] = useState(900); // Увеличиваем общую ширину
  const [cableSpacing] = useState(40); // Отступ между кабелями
  const [topPadding] = useState(50); // Отступ сверху для заголовков кабелей
  
  const incomingCable = cables.find(c => c.targetBoxId === box?.id);
  const outgoingCables = cables.filter(c => c.sourceBoxId === box?.id);

  // Получаем высоту для входящего кабеля
  const incomingHeight = incomingCable 
    ? getCableStructure(incomingCable.fiberCount).length * rowHeight 
    : 0;

  // Получаем общую высоту для всех исходящих кабелей
  let outgoingHeight = 0;
  let outgoingRowOffsets: { [key: string]: number } = {};
  let currentOffset = 0;

  outgoingCables.forEach(cable => {
    outgoingRowOffsets[cable.id] = currentOffset;
    const cableHeight = getCableStructure(cable.fiberCount).length * rowHeight;
    outgoingHeight += cableHeight + cableSpacing; // Добавляем отступ
    currentOffset += getCableStructure(cable.fiberCount).length;
  });

  // Определяем максимальную высоту для рабочей области
  const svgHeight = Math.max(incomingHeight, outgoingHeight) + 40;

  useEffect(() => {
    const updateHeight = () => {
      setMaxHeight(window.innerHeight * 0.8);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  if (!box) return null;

  const renderCell = (
    text: string, 
    background: string, 
    width: number, 
    x: number, 
    y: number,
    border?: string
  ) => (
    <g transform={`translate(${x}, ${y})`}>
      <rect 
        width={width} 
        height={rowHeight} 
        fill={background}
        stroke={border || "none"}
        strokeWidth={border ? 1 : 0}
      />
      <text
        x={width / 2}
        y={rowHeight / 2}
        dominantBaseline="middle"
        textAnchor="middle"
        fill={background === '#ffffff' ? '#000' : '#fff'}
        style={{ fontSize: '12px' }}
      >
        {text}
      </text>
    </g>
  );

  const renderCableInfo = (cable: Cable, side: 'left' | 'right', y: number) => {
    const fromBox = boxes.find(b => b.id === cable.sourceBoxId);
    const toBox = boxes.find(b => b.id === cable.targetBoxId);
    const length = calculateCableLength(cable.points).toFixed(1);

    return (
      <g transform={`translate(${side === 'left' ? 20 : totalWidth - 380}, ${y - 35})`}>
        <rect
          width={280}
          height={24}
          fill="#f0f0f0"
          stroke="#ccc"
          strokeWidth={1}
        />
        <text
          x={10}
          y={17}
          fill="#000"
          style={{ fontSize: '12px' }}
        >
          Кабель #{cable.id} • {cable.fiberCount}вол. • {length}м • 
          {side === 'left' ? 
            `От ${fromBox?.number || '?'}` :
            `До ${toBox?.number || '?'}`}
        </text>
      </g>
    );
  };

  const isFiberBusy = (cableId: string, fiberIdx: number) => {
    return fiberConnections.some(conn =>
      (conn.end1.cableId === cableId && conn.end1.fiberIdx === fiberIdx) ||
      (conn.end2.cableId === cableId && conn.end2.fiberIdx === fiberIdx)
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      maxHeight: `${maxHeight}px`,
      maxWidth: '1200px',
      width: '90%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      ...style
    }}>
      {/* Заголовок */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0 }}>Детали бокса №{box.number}</h2>
        <button onClick={onClose} style={{ 
          background: 'none',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer'
        }}>×</button>
      </div>

      {/* Единая рабочая область */}
      <div style={{ overflow: 'auto', flex: 1 }}>
        <svg 
          width={totalWidth} 
          height={svgHeight + topPadding}  // Добавляем отступ сверху
          style={{
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '20px',
            boxSizing: 'border-box',
            margin: '0 auto',
            display: 'block'
          }}
        >
          {/* Входящий кабель слева */}
          {incomingCable && (
            <>
              {renderCableInfo(incomingCable, 'left', topPadding)}
              <g transform={`translate(20, ${topPadding})`}>
                {getCableStructure(incomingCable.fiberCount).map((fiber, idx) => {
                  const cableId = String(incomingCable.id);
                  const isSelected = selectedFiber?.cableId === cableId && 
                                   selectedFiber.fiberIdx === idx && 
                                   selectedFiber.direction === 'in';
                  const isConnected = fiberConnections.some(conn =>
                    conn.end1.cableId === cableId && conn.end1.fiberIdx === idx
                  );
                  const y = idx * rowHeight;

                  return (
                    <g key={`in-${idx}`} transform={`translate(0, ${y})`}>
                      {renderCell(fiber.moduleColor.name, fiber.moduleColor.color, 120, 0, 0, fiber.moduleColor.border)}
                      {renderCell(fiber.fiberColor.name, fiber.fiberColor.color, 120, 120, 0, fiber.fiberColor.border)}
                      <g 
                        transform="translate(240, 0)" 
                        onClick={() => !isFiberBusy(cableId, idx) && onFiberClick(cableId, idx, 'in')}
                        style={{ cursor: isFiberBusy(cableId, idx) ? 'not-allowed' : 'pointer' }}
                      >
                        <rect 
                          width={60} 
                          height={rowHeight} 
                          fill={isSelected ? '#ffe066' : isFiberBusy(cableId, idx) ? '#e0e0e0' : isConnected ? '#b2f2ff' : '#fff'}
                        />
                        <text
                          x={30}
                          y={rowHeight / 2}
                          dominantBaseline="middle"
                          textAnchor="middle"
                          style={{ fontSize: '12px', fill: isFiberBusy(cableId, idx) ? '#888' : '#000' }}
                        >
                          {fiber.fiber}
                        </text>
                        <circle
                          cx={60}
                          cy={rowHeight / 2}
                          r={4}
                          fill="#0070c0"
                          style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.3))' }}
                        />
                      </g>
                    </g>
                  );
                })}
              </g>
            </>
          )}

          {/* Линии соединений */}
          {fiberConnections.map((conn, i) => {
            if (!incomingCable) return null;
            const cable1 = cables.find(c => String(c.id) === conn.end1.cableId);
            const cable2 = cables.find(c => String(c.id) === conn.end2.cableId);
            if (!cable1 || !cable2) return null;

            let x1, y1, x2, y2;
            if (incomingCable && cable1.id === incomingCable.id) {
              x1 = 320;
              y1 = conn.end1.fiberIdx * rowHeight + rowHeight / 2 + topPadding;
            } else {
              const idx = outgoingCables.findIndex(c => c.id === cable1.id);
              const startY = (outgoingRowOffsets[cable1.id] || 0) * rowHeight + idx * cableSpacing + topPadding;
              x1 = totalWidth - 380;
              y1 = conn.end1.fiberIdx * rowHeight + rowHeight / 2 + startY;
            }
            if (incomingCable && cable2.id === incomingCable.id) {
              x2 = 320;
              y2 = conn.end2.fiberIdx * rowHeight + rowHeight / 2 + topPadding;
            } else {
              const idx = outgoingCables.findIndex(c => c.id === cable2.id);
              const startY = (outgoingRowOffsets[cable2.id] || 0) * rowHeight + idx * cableSpacing + topPadding;
              x2 = totalWidth - 380;
              y2 = conn.end2.fiberIdx * rowHeight + rowHeight / 2 + startY;
            }

            const controlX1 = x1 + (x2 - x1) * 0.25;
            const controlX2 = x1 + (x2 - x1) * 0.75;

            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${controlX1} ${y1}, ${controlX2} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="#0070c0"
                strokeWidth={2}
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
                onClick={() => onRemoveFiberConnection(i)}
              >
                <title>{`Кабель #${conn.end1.cableId} волокно #${conn.end1.fiberIdx + 1} ↔ Кабель #${conn.end2.cableId} волокно #${conn.end2.fiberIdx + 1}`}</title>
              </path>
            );
          })}

          {/* Исходящие кабели справа */}
          {outgoingCables.map((cable, cableIndex) => {
            const startY = (outgoingRowOffsets[cable.id] || 0) * rowHeight + 
                          cableIndex * cableSpacing + 
                          topPadding;
            return (
              <g key={`out-${cable.id}`}>
                {renderCableInfo(cable, 'right', startY)}
                <g transform={`translate(${totalWidth - 380}, ${startY})`}>
                  {getCableStructure(cable.fiberCount).map((fiber, idx) => {
                    const cableId = String(cable.id);
                    const isSelected = selectedFiber?.cableId === cableId && 
                                     selectedFiber.fiberIdx === idx && 
                                     selectedFiber.direction === 'out';
                    const isConnected = fiberConnections.some(conn =>
                      conn.end2.cableId === cableId && conn.end2.fiberIdx === idx
                    );
                    const y = idx * rowHeight;

                    return (
                      <g key={`out-${idx}`} transform={`translate(0, ${y})`}>
                        <g 
                          transform="translate(0, 0)" 
                          onClick={() => !isFiberBusy(cableId, idx) && onFiberClick(cableId, idx, 'out')}
                          style={{ cursor: isFiberBusy(cableId, idx) ? 'not-allowed' : 'pointer' }}
                        >
                          <rect 
                            width={60} 
                            height={rowHeight} 
                            fill={isSelected ? '#ffe066' : isFiberBusy(cableId, idx) ? '#e0e0e0' : isConnected ? '#b2f2ff' : '#fff'}
                          />
                          <text
                            x={30}
                            y={rowHeight / 2}
                            dominantBaseline="middle"
                            textAnchor="middle"
                            style={{ fontSize: '12px', fill: isFiberBusy(cableId, idx) ? '#888' : '#000' }}
                          >
                            {fiber.fiber}
                          </text>
                          <circle
                            cx={0}
                            cy={rowHeight / 2}
                            r={4}
                            fill="#0070c0"
                            style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.3))' }}
                          />
                        </g>
                        {renderCell(fiber.fiberColor.name, fiber.fiberColor.color, 120, 60, 0, fiber.fiberColor.border)}
                        {renderCell(fiber.moduleColor.name, fiber.moduleColor.color, 120, 180, 0, fiber.moduleColor.border)}
                      </g>
                    );
                  })}
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Toolbar({ onAddBox, onAddCable, cableMode, onExportToKMZ, onAddPole, poleMode, onAddWell, wellMode }: { onAddBox: () => void, onAddCable: () => void, cableMode: boolean, onExportToKMZ: () => void, onAddPole: () => void, poleMode: boolean, onAddWell: () => void, wellMode: boolean }) {
  return (
    <div style={{ position: "absolute", top: 10, left: 80, zIndex: 1000, background: "#fff", padding: 10, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
      <button onClick={onAddBox}>Добавить бокс</button>
      <button onClick={onAddCable} style={{ background: cableMode ? '#e0e0e0' : undefined, marginLeft: 8 }}>Добавить кабель</button>
      <button onClick={onAddPole} style={{ background: poleMode ? '#e0e0e0' : undefined, marginLeft: 8 }}>Опора</button>
      <button onClick={onAddWell} style={{ background: wellMode ? '#e0e0e0' : undefined, marginLeft: 8 }}>Колодец</button>
    </div>
  );
}

function AddBoxOnMap({ onMapClick, enabled }: { onMapClick: (pos: [number, number]) => void, enabled: boolean }) {
  useMapEvents({
    click(e: any) {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

function AddCableOnMap({ onMapClick, enabled }: { onMapClick: (pos: [number, number]) => void, enabled: boolean }) {
  useMapEvents({
    click(e: any) {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

function AddPoleOnMap({ onMapClick, enabled }: { onMapClick: (pos: [number, number]) => void, enabled: boolean }) {
  useMapEvents({
    click(e: any) {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

function AddWellOnMap({ onMapClick, enabled }: { onMapClick: (pos: [number, number]) => void, enabled: boolean }) {
  useMapEvents({
    click(e: any) {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

function getBoxIcon(number: string) {
  return new DivIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `
      <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="30" height="30" rx="4" fill="blue" fill-opacity="0.7" stroke="black" stroke-width="2" />
        <text x="20" y="25" font-size="14" text-anchor="middle" fill="white">${number}</text>
      </svg>
    `
  });
}

function getCablePointIcon(selected: boolean) {
  return new DivIcon({
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    html: `
      <svg width="12" height="12" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="6" r="5" fill="${selected ? 'orange' : 'white'}" stroke="green" stroke-width="2" />
      </svg>
    `
  });
}

const ATTACHMENT_OFFSET = 0.00009;

function calculateCableLength(points: [number, number][]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const from = L.latLng(points[i - 1][0], points[i - 1][1]);
    const to = L.latLng(points[i][0], points[i][1]);
    length += from.distanceTo(to);
  }
  return length;
}

// Геометрическая середина по длине линии
function getPolylineMiddlePoint(points: [number, number][]): [number, number] {
  if (points.length === 0) return [0, 0];
  if (points.length === 1) return points[0];
  const total = calculateCableLength(points);
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const from = L.latLng(points[i - 1][0], points[i - 1][1]);
    const to = L.latLng(points[i][0], points[i][1]);
    const seg = from.distanceTo(to);
    if (acc + seg >= total / 2) {
      const ratio = (total / 2 - acc) / seg;
      return [
        from.lat + (to.lat - from.lat) * ratio,
        from.lng + (to.lng - from.lng) * ratio
      ];
    }
    acc += seg;
  }
  return points[Math.floor(points.length / 2)];
}

// Функция генерации структуры модулей и волокон
function getCableStructure(fiberCount: number): FiberStructure[] {
  let modules = 1;
  let fibersPerModule = fiberCount;
  if (fiberCount === 24) { modules = 2; fibersPerModule = 12; }
  if (fiberCount === 48) { modules = 4; fibersPerModule = 12; }
  if (fiberCount === 96) { modules = 8; fibersPerModule = 12; }
  if (fiberCount === 144) { modules = 12; fibersPerModule = 12; }
  
  const structure: FiberStructure[] = [];
  for (let m = 0; m < modules; m++) {
    for (let f = 0; f < fibersPerModule; f++) {
      if (m * fibersPerModule + f >= fiberCount) break;
      const isOneModuleCase = fiberCount === 4 || fiberCount === 8 || fiberCount === 12;
      const moduleColorObj = isOneModuleCase ? ODESA_COLORS[4] : ODESA_COLORS[m % 12];
      structure.push({
        module: m + 1,
        moduleColor: {
          ...moduleColorObj,
          name: isOneModuleCase ? moduleColorObj.name : `${moduleColorObj.name} (${m + 1})`
        },
        fiber: f + 1,
        fiberColor: ODESA_COLORS[f % 12],
      });
    }
  }
  return structure;
}

// Получаем координаты центра бокса
function getBoxCenter(box: Box): [number, number] {
  return box.position;
}

function getWellIcon() {
  // Круг радиус 8, белый, три линии: вверх, 135°, 225°
  // 0° — вверх, 135° — влево-вниз, 225° — вправо-вниз
  // Центр (12,12), радиус 8
  // cos/sin для точек на окружности
  const r = 8;
  const cx = 12, cy = 12;
  function point(angleDeg: number) {
    const rad = (angleDeg - 90) * Math.PI / 180; // -90 чтобы 0° было вверх
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }
  const [x1, y1] = point(0);   // вверх
  const [x2, y2] = point(135); // влево-вниз
  const [x3, y3] = point(225); // вправо-вниз
  return new DivIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `
      <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="8" fill="#fff" stroke="black" stroke-width="1.5" />
        <line x1="12" y1="12" x2="${x1}" y2="${y1}" stroke="black" stroke-width="1.5" />
        <line x1="12" y1="12" x2="${x2}" y2="${y2}" stroke="black" stroke-width="1.5" />
        <line x1="12" y1="12" x2="${x3}" y2="${y3}" stroke="black" stroke-width="1.5" />
      </svg>
    `
  });
}

function App() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [addBoxMode, setAddBoxMode] = useState(false);
  const [addCableMode, setAddCableMode] = useState(false);
  const [newBoxPosition, setNewBoxPosition] = useState<[number, number] | null>(null);
  const [boxParams, setBoxParams] = useState({ number: "", splitter: "", address: "", place: "" });

  const [cables, setCables] = useState<Cable[]>([]);
  const [cablePoints, setCablePoints] = useState<[number, number][]>([]);
  const [selectedCableId, setSelectedCableId] = useState<number | null>(null);

  const [fiberConnections, setFiberConnections] = useState<{
    end1: { cableId: string; fiberIdx: number };
    end2: { cableId: string; fiberIdx: number };
  }[]>([]);

  const [selectedFiber, setSelectedFiber] = useState<{
    cableId: string;
    fiberIdx: number;
    direction: 'in' | 'out';
  } | null>(null);

  const leftTableRef = useRef<HTMLDivElement>(null);
  const rightTableRef = useRef<HTMLDivElement>(null);
  const [svgHeight, setSvgHeight] = useState(0);
  const [svgWidth, setSvgWidth] = useState(0);
  const [svgLeftOffset, setSvgLeftOffset] = useState(0);

  const [maxHeight, setMaxHeight] = useState(600);
  const [rowHeight] = useState(24);
  const [svgWidthFixed] = useState(150);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  const [poles, setPoles] = useState<Pole[]>([]);
  const [addPoleMode, setAddPoleMode] = useState(false);
  const [selectedPoleId, setSelectedPoleId] = useState<number | null>(null);
  const [poleParams, setPoleParams] = useState({ number: '', tpNumber: '', purpose: '0,4кВт' as Pole['purpose'] });
  const [draggedLabelPoleId, setDraggedLabelPoleId] = useState<number | null>(null);
  const [labelDragOffset, setLabelDragOffset] = useState<[number, number] | null>(null);

  const [wells, setWells] = useState<Well[]>([]);
  const [addWellMode, setAddWellMode] = useState(false);
  const [selectedWellId, setSelectedWellId] = useState<number | null>(null);

  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
  const [openedBoxId, setOpenedBoxId] = useState<number | null>(null);

  const [boxesOpen, setBoxesOpen] = useState(true);
  const [cablesOpen, setCablesOpen] = useState(true);
  const [polesOpen, setPolesOpen] = useState(true);
  const [wellsOpen, setWellsOpen] = useState(true);

  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isPassportsMenuOpen, setIsPassportsMenuOpen] = useState(false);
  const [isProtocolsMenuOpen, setIsProtocolsMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isAnalysisMenuOpen, setIsAnalysisMenuOpen] = useState(false); // <-- Добавил состояние для "Анализ"

  const [activeTab, setActiveTab] = useState('situational');

  const tabs = [
    { id: 'situational', label: 'Ситуационный план' },
    { id: 'network', label: 'Структура сети' },
    { id: 'splicing', label: 'Схема розварки' }, // Добавляем новую вкладку
    { id: 'house', label: 'Домовые сети' },
    { id: 'materials', label: 'Спецификация материалов' },
    { id: 'works', label: 'Спецификация работ' },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
      setMaxHeight(window.innerHeight * 0.8);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Состояния для кабельных соединений
  const [cableStart, setCableStart] = useState<{
    boxId: number;
    position: [number, number];
  } | null>(null);

  const [cableEnd, setCableEnd] = useState<{
    boxId: number;
    position: [number, number];
  } | null>(null);

  const [showCableParamsModal, setShowCableParamsModal] = useState(false);

  const [newCableParams, setNewCableParams] = useState<{
    fiberCount: number;
    layingType: 'подвес' | 'канализация';
  }>({
    fiberCount: 12,
    layingType: 'подвес'
  });

  useEffect(() => {
    const updateSvgDimensions = () => {
      const leftTable = leftTableRef.current?.getBoundingClientRect();
      const rightTable = rightTableRef.current?.getBoundingClientRect();
      const centerContainer = document.querySelector('.center-container')?.getBoundingClientRect();

      if (leftTable && rightTable && centerContainer) {
        // Рассчитываем ширину SVG
        const svgWidth = rightTable.right - leftTable.left + 100; // Добавляем запас

        // Рассчитываем высоту SVG
        const maxRows = Math.max(
          leftTable.height || 0,
          rightTable.height || 0
        );
        const svgHeight = maxRows + 50; // Добавляем запас

        // Рассчитываем смещение SVG
        const svgLeftOffset = leftTable.left - centerContainer.left;

        // Устанавливаем размеры и смещение
        setSvgWidth(svgWidth);
        setSvgHeight(svgHeight);
        setSvgLeftOffset(svgLeftOffset);

        console.log('SVG Dimensions:', { svgWidth, svgHeight, svgLeftOffset });
      } else {
        // Если расчёты не удались, задаём резервные значения
        setSvgWidth(800); // Резервная ширина
        setSvgHeight(400); // Резервная высота
        setSvgLeftOffset(0); // Резервное смещение
        console.error('Не удалось получить размеры таблиц или контейнера.');
      }
    };

    const timeout = setTimeout(() => {
      updateSvgDimensions();
    }, 0);

    window.addEventListener('resize', updateSvgDimensions);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', updateSvgDimensions);
    };
  }, []);

  const handleMapClick = (position: [number, number]) => {
    setNewBoxPosition(position);
    setAddBoxMode(false);
  };

  const handleAddBox = (position: [number, number]) => {
    const newBox = {
      id: boxes.length + 1,
      position,
      number: boxParams.number,
      splitter: boxParams.splitter,
      address: boxParams.address,
      place: boxParams.place,
      connections: {
        input: null,
        outputs: Array(6).fill(null) // Создаем 6 пустых слотов для исходящих кабелей
      }
    };
    setBoxes([...boxes, newBox]);
    setNewBoxPosition(null);
    setAddBoxMode(false);
    setBoxParams({ number: "", splitter: "", address: "", place: "" });
  };

  const handleSaveBox = () => {
    if (!newBoxPosition) return;
    handleAddBox(newBoxPosition);
  };

  const handleMarkerDblClick = (boxId: number) => {
    setOpenedBoxId(boxId);
  };

  const handleCloseDetails = () => {
    setOpenedBoxId(null);
  };

  const handleMarkerDragEnd = (boxId: number, e: DragEndEvent) => {
    const { lat, lng } = (e.target as L.Marker).getLatLng();
    
    // Обновляем позицию бокса
    setBoxes(boxes => boxes.map(b =>
      b.id === boxId ? { ...b, position: [lat, lng] } : b
    ));

    // Обновляем точки кабелей, связанных с этим боксом
    setCables(cables => cables.map(cable => {
      // Если бокс является началом кабеля
      if (cable.sourceBoxId === boxId) {
        const newPoints = [...cable.points];
        newPoints[0] = [lat, lng]; // Обновляем первую точку
        return { ...cable, points: newPoints };
      }
      // Если бокс является концом кабеля
      if (cable.targetBoxId === boxId) {
        const newPoints = [...cable.points];
        newPoints[newPoints.length - 1] = [lat, lng]; // Обновляем последнюю точку
        return { ...cable, points: newPoints };
      }
      return cable;
    }));
  };

  const handleBoxClick = (boxId: number, position: [number, number]) => {
    if (addCableMode) {
      if (!cableStart) {
        // Начинаем новый кабель
        setCableStart({ boxId, position });
        setCablePoints([position]);
        setCableEnd(null);
      } else if (!cableEnd && boxId !== cableStart.boxId) {
        // Завершаем кабель
        setCablePoints(points => [...points, position]);
        setCableEnd({ boxId, position });
        setShowCableParamsModal(true);
        setNewCableParams({ fiberCount: 12, layingType: 'подвес' }); // значения по умолчанию
      }
    }
  };

  const handleCableClick = (cableId: number) => {
    setSelectedCableId(cableId);
  };

  const handleCableMapClick = (pos: [number, number]) => {
    if (addCableMode && cableStart && !cableEnd) {
      setCablePoints(points => [...points, pos]);
    }
  };

  const handleCableConnection = (boxId: number) => {
    const box = boxes.find(b => b.id === boxId);
    if (!box) return;

    const position = box.position;

    if (!cableStart) {
      // Начало кабеля (исходящий)
      const availableOutputSlot = box.connections.outputs.findIndex(output => output === null);
      if (availableOutputSlot === -1) {
        alert('Достигнуто максимальное количество исходящих кабелей (6)');
        return;
      }
      setCableStart({ boxId, position });
      setCablePoints([position]);
    } else {
      // Конец кабеля (входящий)
      if (box.connections.input !== null) {
        alert('Бокс уже имеет входящий кабель');
        return;
      }
      if (box.id === cableStart.boxId) {
        alert('Нельзя подключить кабель к тому же боксу');
        return;
      }
      
      setCableEnd({ boxId, position });
      setShowCableParamsModal(true);
    }
  };

  const handleSaveCableWithParams = () => {
    if (!cableStart || !cableEnd) return;

    const newCable = {
      id: cables.length + 1, // Просто берем следующий номер после последнего кабеля
      points: cablePoints,
      sourceBoxId: cableStart.boxId,
      targetBoxId: cableEnd.boxId,
      fiberCount: newCableParams.fiberCount,
      layingType: newCableParams.layingType
    };

    setCables([...cables, newCable]);
    setShowCableParamsModal(false);
    setAddCableMode(false);
    setCableStart(null);
    setCableEnd(null);
    setCablePoints([]);
  };

  // Drag промежуточных точек
  const handleCablePointDragEnd = (cableId: number, pointIdx: number, e: DragEndEvent) => {
    const { lat, lng } = (e.target as L.Marker).getLatLng();
    setCables(cables => cables.map(cable => {
      if (cable.id === cableId) {
        const newPoints = [...cable.points];
        newPoints[pointIdx] = [lat, lng];
        return { ...cable, points: newPoints };
      }
      return cable;
    }));
  }; 

  console.log('cablePoints', cablePoints);
  console.log('fiberConnections:', fiberConnections);

  function handleFiberClick(cableId: string, fiberIdx: number, direction: 'in' | 'out') {
    if (isFiberBusyGlobal(cableId, fiberIdx)) return;
    if (!selectedFiber) {
      setSelectedFiber({ cableId, fiberIdx, direction });
    } else {
      // Нельзя соединять волокно само с собой
      if (selectedFiber.cableId === cableId && selectedFiber.fiberIdx === fiberIdx) {
        setSelectedFiber(null);
        return;
      }
      // Оба волокна должны быть свободны
      if (isFiberBusyGlobal(selectedFiber.cableId, selectedFiber.fiberIdx)) {
        setSelectedFiber(null);
        return;
      }
      // Добавляем соединение
      setFiberConnections([...fiberConnections, {
        end1: { cableId: selectedFiber.cableId, fiberIdx: selectedFiber.fiberIdx },
        end2: { cableId, fiberIdx }
      }]);
      setSelectedFiber(null);
    }
  }

  function handleExportToKMZ() {
    const zip = new JSZip();

    // Генерация KML
    const kmlContent = generateKML();
    zip.file('doc.kml', kmlContent);

    // Генерация KMZ
    zip.generateAsync({ type: 'blob' }).then((content) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'export.kmz';
      link.click();
    });
  }

  function generateKML() {
    const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <name>Экспорт данных</name>
          <!-- Стили для кабелей -->
          <Style id="cable-4">
            <LineStyle>
              <color>ff000000</color> <!-- Чёрный -->
              <width>5</width> <!-- Увеличена толщина -->
            </LineStyle>
          </Style>
          <Style id="cable-8">
            <LineStyle>
              <color>ff0000ff</color> <!-- Красный -->
              <width>5</width> <!-- Увеличена толщина -->
            </LineStyle>
          </Style>
          <Style id="cable-12">
            <LineStyle>
              <color>ff00ff00</color> <!-- Зелёный -->
              <width>5</width> <!-- Увеличена толщина -->
            </LineStyle>
          </Style>
          <Style id="cable-24">
            <LineStyle>
              <color>ffff0000</color> <!-- Синий -->
              <width>5</width> <!-- Увеличена толщина -->
            </LineStyle>
          </Style>
          <Style id="cable-48">
            <LineStyle>
              <color>ff00ffff</color> <!-- Оранжевый -->
              <width>5</width> <!-- Увеличена толщина -->
            </LineStyle>
          </Style>
          <Style id="cable-96">
            <LineStyle>
              <color>ff703000</color> <!-- Коричневый -->
              <width>5</width> <!-- Увеличена толщина -->
            </LineStyle>
          </Style>
          <Style id="cable-144">
            <LineStyle>
              <color>ff7030a0</color> <!-- Фиолетовый -->
              <width>5</width> <!-- Увеличена толщина -->
            </LineStyle>
          </Style>
    `;

    const kmlFooter = `
        </Document>
      </kml>
    `;

    // Генерация боксов
    const boxesKML = boxes.map((box) => `
      <Placemark>
        <name>Бокс №${box.number}</name>
        <description>
          <![CDATA[
            <b>Сплиттер:</b> ${box.splitter}<br/>
            <b>Адрес:</b> ${box.address}<br/>
            <b>Место:</b> ${box.place}
          ]]>
        </description>
        <Point>
          <coordinates>${box.position[1]},${box.position[0]},0</coordinates>
        </Point>
      </Placemark>
    `).join('');

    // Генерация кабелей
    const cablesKML = cables.map((cable) => `
      <Placemark>
        <name>Кабель ID: ${cable.id}</name>
        <description>
          <![CDATA[
            <b>Тип:</b> ${cable.layingType}<br/>
            <b>Длина:</b> ${calculateCableLength(cable.points).toFixed(1)} м<br/>
            <b>Волоконность:</b> ${cable.fiberCount}
          ]]>
        </description>
        <styleUrl>#cable-${cable.fiberCount}</styleUrl>
        <LineString>
          <coordinates>
            ${cable.points.map((point) => `${point[1]},${point[0]},0`).join(' ')}
          </coordinates>
        </LineString>
      </Placemark>
    `).join('');

    return `${kmlHeader}${boxesKML}${cablesKML}${kmlFooter}`;
  }

  function handleRemoveFiberConnection(idx: number) {
    setFiberConnections(fiberConnections => fiberConnections.filter((_, i) => i !== idx));
  }

  // Глобальная проверка занятости волокна (для handleFiberClick)
  function isFiberBusyGlobal(cableId: string, fiberIdx: number) {
    return fiberConnections.some(conn =>
      (conn.end1.cableId === cableId && conn.end1.fiberIdx === fiberIdx) ||
      (conn.end2.cableId === cableId && conn.end2.fiberIdx === fiberIdx)
    );
  }

  function getPoleIcon(purpose: string) {
    let fill = '#00b050'; // зелёный по умолчанию
    if (purpose === '10кВт') fill = '#ff0000';
    if (purpose === 'УТК') fill = '#ffe066';
    if (purpose === 'Освещение') fill = '#00bfff';
    return new DivIcon({
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      html: `
        <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" fill="${fill}" stroke="black" stroke-width="1.5" />
          <line x1="12" y1="4" x2="12" y2="20" stroke="black" stroke-width="1.5" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="black" stroke-width="1.5" />
        </svg>
      `
    });
  }

  function handleMapClickPole(position: [number, number]) {
    setPoles([...poles, {
      id: Date.now(),
      position,
      number: '',
      tpNumber: '',
      purpose: '0,4кВт',
      labelOffset: [4, 0]
    }]);
  }

  const selectedPole = poles.find(p => p.id === selectedPoleId);
  function handlePolePropertyChange(field: keyof Pole, value: any) {
    setPoles(poles => poles.map(p =>
      p.id === selectedPoleId ? { ...p, [field]: value } : p
    ));
  }
  function handlePolePositionChange(newPos: [number, number]) {
    setPoles(poles => poles.map(p =>
      p.id === selectedPoleId ? { ...p, position: newPos } : p
    ));
  }
  function handleLabelDragStart(poleId: number, e: any) {
    // Проверяем, что e существует и есть clientX/clientY
    if (!e || typeof e.clientX !== 'number' || typeof e.clientY !== 'number') return;
    setDraggedLabelPoleId(poleId);
    setLabelDragOffset([e.clientX, e.clientY]);
  }
  function handleLabelDrag(e: any) {
    if (draggedLabelPoleId !== null && labelDragOffset) {
      const dx = e.clientX - labelDragOffset[0];
      const dy = e.clientY - labelDragOffset[1];
      setPoles(poles => poles.map(p =>
        p.id === draggedLabelPoleId ? { ...p, labelOffset: [p.labelOffset[0] + dx, p.labelOffset[1] + dy] } : p
      ));
      setLabelDragOffset([e.clientX, e.clientY]);
    }
  }
  function handleLabelDragEnd() {
    setDraggedLabelPoleId(null);
    setLabelDragOffset(null);
  }
  useEffect(() => {
    if (draggedLabelPoleId !== null) {
      window.addEventListener('mousemove', handleLabelDrag);
      window.addEventListener('mouseup', handleLabelDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleLabelDrag);
        window.removeEventListener('mouseup', handleLabelDragEnd);
      };
    }
  }, [draggedLabelPoleId, labelDragOffset]);

  function handleMapClickWell(position: [number, number]) {
    setWells([...wells, {
      id: Date.now(),
      position,
      number: '',
      labelOffset: [4, 0]
    }]);
  }

  const selectedWell = wells.find(w => w.id === selectedWellId);
  function handleWellPropertyChange(field: keyof Well, value: any) {
    setWells(wells => wells.map(w =>
      w.id === selectedWellId ? { ...w, [field]: value } : w
    ));
  }

  // === Обработчики выбора элементов ===
  function handleSelectBox(boxId: number) {
    setSelectedElement({ type: 'box', id: boxId });
  }
  function handleSelectCable(cableId: number) {
    setSelectedElement({ type: 'cable', id: cableId });
  }
  function handleSelectPole(poleId: number) {
    setSelectedElement({ type: 'pole', id: poleId });
  }
  function handleSelectWell(wellId: number) {
    setSelectedElement({ type: 'well', id: wellId });
  }

  // === Для защиты от конфликта click/dblclick ===
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // === Обработчики кликов для дерева элементов ===
  const handleToggleBoxes = () => setBoxesOpen(!boxesOpen);
  const handleToggleCables = () => setCablesOpen(!cablesOpen);
  const handleTogglePoles = () => setPolesOpen(!polesOpen);
  const handleToggleWells = () => setWellsOpen(!wellsOpen);

  // === Функции переключения меню ===
  const toggleFileMenu = () => {
    setIsFileMenuOpen(prevState => !prevState);
    setIsPassportsMenuOpen(false);
    setIsProtocolsMenuOpen(false);
    setIsExportMenuOpen(false);
    setIsAnalysisMenuOpen(false); // <-- Закрываем меню "Анализ"
  };

  const toggleEditMenu = () => {
    // setIsEditMenuOpen(prevState => !prevState); // Если будет состояние для Правки
    setIsFileMenuOpen(false);
    setIsPassportsMenuOpen(false);
    setIsProtocolsMenuOpen(false);
    setIsExportMenuOpen(false);
    setIsAnalysisMenuOpen(false); // <-- Закрываем меню "Анализ"
  };

  const togglePassportsMenu = () => {
    setIsPassportsMenuOpen(prevState => !prevState);
    setIsFileMenuOpen(false);
    setIsProtocolsMenuOpen(false);
    setIsExportMenuOpen(false);
    setIsAnalysisMenuOpen(false); // <-- Закрываем меню "Анализ"
  };

  const toggleProtocolsMenu = () => {
    setIsProtocolsMenuOpen(prevState => !prevState);
    setIsFileMenuOpen(false);
    setIsPassportsMenuOpen(false);
    setIsExportMenuOpen(false);
    setIsAnalysisMenuOpen(false); // <-- Закрываем меню "Анализ"
  };

  const toggleExportMenu = () => {
    setIsExportMenuOpen(prevState => !prevState);
    setIsFileMenuOpen(false);
    setIsPassportsMenuOpen(false);
    setIsProtocolsMenuOpen(false);
    setIsAnalysisMenuOpen(false); // <-- Закрываем меню "Анализ"
  };

   const toggleAnalysisMenu = () => { // <-- НОВАЯ ФУНКЦИЯ для "Анализ"
    setIsAnalysisMenuOpen(prevState => !prevState);
    setIsFileMenuOpen(false);
    setIsPassportsMenuOpen(false);
    setIsProtocolsMenuOpen(false);
    setIsExportMenuOpen(false);
  };

  // Функция для закрытия всех меню (например, при клике вне меню) - опционально, но хорошая практика
  const closeAllMenus = () => {
    setIsFileMenuOpen(false);
    setIsPassportsMenuOpen(false);
    setIsProtocolsMenuOpen(false);
    setIsExportMenuOpen(false);
    setIsAnalysisMenuOpen(false); // <-- Добавляем закрытие меню "Анализ"
    setIsImportMenuOpen(false); // Добавляем закрытие меню импорта
  };

  // === Функции для экспорта в Excel ===
  const handleExportBoxReport = () => {
    const boxData = boxes.map(box => {
      // Находим входящий кабель
      const incomingCable = cables.find(cable => cable.targetBoxId === box.id);
      
      // Находим исходящие кабели
      const outgoingCables = cables.filter(cable => cable.sourceBoxId === box.id);

      return {
        ID: box.id,
        Номер: box.number,
        Сплиттер: box.splitter,
        Адрес: box.address,
        Место: box.place,
        Координаты: `${box.position[0].toFixed(6)}, ${box.position[1].toFixed(6)}`,
        Входящий_кабель_ID: incomingCable ? incomingCable.id : '',
        Исходящие_кабели_ID: outgoingCables.map(c => c.id).join(', ')
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(boxData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Отчет по боксам');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, 'Отчет_Бокс.xlsx');
  };

  const handleExportCableReport = () => {
    const cableData = cables.map(cable => {
      const sourceBox = boxes.find(box => box.id === cable.sourceBoxId);
      const targetBox = boxes.find(box => box.id === cable.targetBoxId);
      const length = calculateCableLength(cable.points).toFixed(1);

      return {
        ID: cable.id,
        'Источник (Бокс ID)': cable.sourceBoxId,
        'Источник (Номер бокса)': sourceBox ? sourceBox.number : 'Неизвестно',
        'Назначение (Бокс ID)': cable.targetBoxId,
        'Назначение (Номер бокса)': targetBox ? targetBox.number : 'Неизвестно',
        Волоконность: cable.fiberCount,
        'Тип прокладки': cable.layingType,
        Длина_м: length,
        Количество_точек: cable.points.length,
        Координаты_точек: cable.points.map(pt => `(${pt[0].toFixed(6)}, ${pt[1].toFixed(6)})`).join('; ')
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(cableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Отчет по кабелям');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, 'Отчет_ВОК.xlsx');
  };
  // === Конец функций для экспорта в Excel ===

  // Добавляем новое состояние для меню импорта
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);

  // Добавляем функцию переключения меню импорта
  const toggleImportMenu = () => {
    setIsImportMenuOpen(prevState => !prevState);
    setIsFileMenuOpen(false);
    setIsPassportsMenuOpen(false);
    setIsProtocolsMenuOpen(false);
    setIsExportMenuOpen(false);
    setIsAnalysisMenuOpen(false);
  };

  // Добавляем функции для импорта
  const handleImportBoxReport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (!jsonData || jsonData.length === 0) {
            alert('Файл не содержит данных');
            return;
          }

          // Обновляем боксы
          const newBoxes = jsonData.map((row: any) => {
            if (!row.Координаты) {
              throw new Error('Отсутствуют координаты в данных');
            }

            const [lat, lng] = row.Координаты.split(',').map((coord: string) => {
              const num = parseFloat(coord.trim());
              if (isNaN(num)) {
                throw new Error('Некорректный формат координат');
              }
              return num;
            });

            return {
              id: row.ID || Math.max(...boxes.map(b => b.id), 0) + 1,
              position: [lat, lng] as [number, number],
              number: row.Номер || '',
              splitter: row.Сплиттер || '',
              address: row.Адрес || '',
              place: row.Место || '',
              connections: {
                input: row.Входящий_кабель_ID ? { cableId: row.Входящий_кабель_ID } : null,
                outputs: row.Исходящие_кабели_ID ? 
                  row.Исходящие_кабели_ID.split(',').map((id: string) => ({ cableId: parseInt(id.trim()) })) : 
                  Array(6).fill(null)
              }
            };
          });

          setBoxes(newBoxes);
          alert(`Успешно импортировано ${newBoxes.length} боксов`);
        } catch (error: unknown) {
          if (error instanceof Error) {
            alert(`Ошибка при импорте: ${error.message}`);
          } else {
            alert('Произошла неизвестная ошибка при импорте');
          }
        }
      };
      reader.readAsArrayBuffer(file);
    };
    
    input.click();
  };

  const handleImportCableReport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (!jsonData || jsonData.length === 0) {
            alert('Файл не содержит данных');
            return;
          }

          // Обновляем кабели
          const newCables = jsonData.map((row: any) => {
            if (!row.Координаты_точек) {
              throw new Error('Отсутствуют координаты точек в данных');
            }

            const points = row.Координаты_точек.split(';').map((point: string) => {
              const [lat, lng] = point.replace(/[()]/g, '').split(',').map(coord => {
                const num = parseFloat(coord.trim());
                if (isNaN(num)) {
                  throw new Error('Некорректный формат координат');
                }
                return num;
              });
              return [lat, lng] as [number, number];
            });

            if (points.length < 2) {
              throw new Error('Кабель должен иметь минимум 2 точки');
            }

            return {
              id: row.ID || Math.max(...cables.map(c => c.id), 0) + 1,
              sourceBoxId: row['Источник (Бокс ID)'] || null,
              targetBoxId: row['Назначение (Бокс ID)'] || null,
              fiberCount: row.Волоконность || 4,
              layingType: row['Тип прокладки'] || 'подвес',
              points: points
            };
          });

          setCables(newCables);
          alert(`Успешно импортировано ${newCables.length} кабелей`);
        } catch (error: unknown) {
          if (error instanceof Error) {
            alert(`Ошибка при импорте: ${error.message}`);
          } else {
            alert('Произошла неизвестная ошибка при импорте');
          }
        }
      };
      reader.readAsArrayBuffer(file);
    };
    
    input.click();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden'
    }}>
      {/* Верхняя панель с названием проекта */}
      <div style={{
        backgroundColor: '#094961',
        color: 'white',
        padding: '12px 24px',
        fontSize: '18px',
        fontWeight: '500',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        flexShrink: 0
      }}>
        Тестовая страница проекта GPON
      </div>

      {/* Строка меню */}
      <div style={{
        backgroundColor: '#f0f0f0',
        borderBottom: '1px solid #ddd',
        padding: '8px 24px',
        display: 'flex',
        gap: '20px',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        alignItems: 'flex-start',
        position: 'relative',
        zIndex: 2000
      }}>
        {/* Пункт меню "Файл" */}
        <div style={{ position: 'relative' }}>
          <span
            onClick={toggleFileMenu}
            style={{ cursor: 'pointer', fontWeight: '500', color: '#333', userSelect: 'none' }}
          >
            Файл
          </span>
          {/* Выпадающий список для "Файл" */}
          {isFileMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              padding: '8px 0',
              zIndex: 2001,
              minWidth: '120px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span
                style={{
                  padding: '6px 15px',
                  cursor: 'pointer',
                  color: '#333',
                  fontSize: '14px',
                }}
              >
                Загрузить
              </span>
              <span
                style={{
                  padding: '6px 15px',
                  cursor: 'pointer',
                  color: '#333',
                  fontSize: '14px',
                }}
              >
                Сохранить
              </span>
            </div>
          )}
        </div>

        <span style={{ cursor: 'pointer', fontWeight: '500', color: '#333' }} onClick={toggleEditMenu}>Правка</span>

        {/* Пункт меню "Паспорта" */}
        <div style={{ position: 'relative' }}>
           <span
            onClick={togglePassportsMenu}
            style={{ cursor: 'pointer', fontWeight: '500', color: '#333', userSelect: 'none' }}
          >
            Паспорта
          </span>
           {/* Выпадающий список для "Паспорта" */}
          {isPassportsMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              padding: '8px 0',
              zIndex: 2001,
              minWidth: '200px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span
                style={{
                  padding: '6px 15px',
                  cursor: 'pointer',
                  color: '#333',
                  fontSize: '14px',
                }}
              >
                Паспорта рег. участков
              </span>
              {/* Пункт "Паспорта затуханий сплиттеров" удален */}
            </div>
          )}
        </div>

        {/* Пункт меню "Протоколы" */}
        <div style={{ position: 'relative' }}>
           <span
            onClick={toggleProtocolsMenu}
            style={{ cursor: 'pointer', fontWeight: '500', color: '#333', userSelect: 'none' }}
          >
            Протоколы
          </span>
           {/* Выпадающий список для "Протоколы" */}
          {isProtocolsMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              padding: '8px 0',
              zIndex: 2001,
              minWidth: '200px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span
                style={{
                  padding: '6px 15px',
                  cursor: 'pointer',
                  color: '#333',
                  fontSize: '14px',
                }}
              >
                Протоколы затуханий сплиттеров
              </span>
            </div>
          )}
        </div>

        {/* Пункт меню "Импорт" */}
        <div style={{ position: 'relative' }}>
          <span
            onClick={toggleImportMenu}
            style={{ cursor: 'pointer', fontWeight: '500', color: '#333', userSelect: 'none' }}
          >
            Импорт
          </span>
          {isImportMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              padding: '8px 0',
              zIndex: 2001,
              minWidth: '220px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span
                style={{
                  padding: '6px 15px',
                  cursor: 'pointer',
                  color: '#333',
                  fontSize: '14px',
                }}
                onClick={handleImportBoxReport}
              >
                Импорт Отчет_Бокс.xlsx
              </span>
              <span
                style={{
                  padding: '6px 15px',
                  cursor: 'pointer',
                  color: '#333',
                  fontSize: '14px',
                }}
                onClick={handleImportCableReport}
              >
                Импорт Отчет_ВОК.xlsx
              </span>
            </div>
          )}
        </div>

        {/* Пункт меню "Экспорт" */}
        <div style={{ position: 'relative' }}>
           <span
            onClick={toggleExportMenu}
            style={{ cursor: 'pointer', fontWeight: '500', color: '#333', userSelect: 'none' }}
          >
            Экспорт
          </span>
           {/* Выпадающий список для "Экспорт" */}
          {isExportMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              padding: '8px 0',
              zIndex: 2001,
              minWidth: '220px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span
                style={{
                  padding: '6px 15px',
                  cursor: 'pointer',
                  color: '#333',
                  fontSize: '14px',
                }}
                onClick={handleExportBoxReport} // <-- Связываем с функцией экспорта боксов
              >
                Экспорт Отчет_Бокс.xlsx
              </span>
              <span
                style={{
                  padding: '6px 15px',
                  cursor: 'pointer',
                  color: '#333',
                  fontSize: '14px',
                }}
                onClick={handleExportCableReport} // <-- Связываем с функцией экспорта кабелей
              >
                Экспорт Отчет_ВОК.xlsx
              </span>
              <span
                style={{
                  padding: '6px 15px',
                  cursor: 'pointer',
                  color: '#333',
                  fontSize: '14px',
                }}
                onClick={handleExportToKMZ}
              >
                Экспорт в KMZ
              </span>
            </div>
          )}
        </div>

        {/* Пункт меню "Анализ" */}
         <span style={{ cursor: 'pointer', fontWeight: '500', color: '#333' }} onClick={toggleAnalysisMenu}>Анализ</span> {/* <-- Добавляем обработчик клика для "Анализ" */}

      </div>

      {/* Вкладки */}
      <Tabs tabs={tabs} onTabChange={handleTabChange} />

      {/* Основной контейнер для остального содержимого */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        {activeTab === 'situational' && (
          <>
            {/* Левая панель с деревом объектов */}
            <div style={{
              width: 300,
              background: '#f8f8f8',
              borderRight: '1px solid #ddd',
              padding: '10px 0',
              overflowY: 'auto',
              zIndex: 1000,
              flexShrink: 0
            }}>
              <div style={{ padding: '0 15px' }}>
                <h3 style={{ marginTop: 0, marginBottom: 10 }}>Элементы</h3>

                {/* Боксы */}
                <div style={{ marginBottom: 15 }}>
                  <b onClick={handleToggleBoxes} style={{ cursor: 'pointer', display: 'block', padding: '5px 0' }}>Боксы ({boxes.length})</b>
                  {boxesOpen && (
                    <ul style={{ listStyle: 'none', paddingLeft: 15, margin: 0 }}>
                      {boxes.map(box => (
                        <li
                          key={box.id}
                          onClick={() => handleSelectBox(box.id)}
                          style={{
                            cursor: 'pointer',
                            padding: '3px 0',
                            color: selectedElement?.type === 'box' && selectedElement.id === box.id ? '#0070c0' : '#333',
                            fontWeight: selectedElement?.type === 'box' && selectedElement.id === box.id ? 'bold' : 'normal'
                          }}
                        >
                          №{box.number || 'Без номера'} ({box.position[0].toFixed(5)}, {box.position[1].toFixed(5)})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Кабели */}
                <div style={{ marginBottom: 15 }}>
                  <b onClick={handleToggleCables} style={{ cursor: 'pointer', display: 'block', padding: '5px 0' }}>Кабели ({cables.length})</b>
                  {cablesOpen && (
                    <ul style={{ listStyle: 'none', paddingLeft: 15, margin: 0 }}>
                      {cables.map(cable => (
                        <li
                          key={cable.id}
                          onClick={() => handleSelectCable(cable.id)}
                          style={{
                            cursor: 'pointer',
                            padding: '3px 0',
                            color: selectedElement?.type === 'cable' && selectedElement.id === cable.id ? '#0070c0' : '#333',
                            fontWeight: selectedElement?.type === 'cable' && selectedElement.id === cable.id ? 'bold' : 'normal'
                          }}
                        >
                          ID: {cable.id} ({cable.fiberCount} вол.)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Опоры */}
                <div style={{ marginBottom: 15 }}>
                  <b onClick={handleTogglePoles} style={{ cursor: 'pointer', display: 'block', padding: '5px 0' }}>Опоры ({poles.length})</b>
                  {polesOpen && (
                    <ul style={{ listStyle: 'none', paddingLeft: 15, margin: 0 }}>
                      {poles.map(pole => (
                        <li
                          key={pole.id}
                          onClick={() => handleSelectPole(pole.id)}
                          style={{
                            cursor: 'pointer',
                            padding: '3px 0',
                            color: selectedElement?.type === 'pole' && selectedElement.id === pole.id ? '#0070c0' : '#333',
                            fontWeight: selectedElement?.type === 'pole' && selectedElement.id === pole.id ? 'bold' : 'normal'
                          }}
                        >
                          №{pole.number || 'Без номера'} ({pole.position[0].toFixed(5)}, {pole.position[1].toFixed(5)})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Колодцы */}
                <div style={{ marginBottom: 15 }}>
                  <b onClick={handleToggleWells} style={{ cursor: 'pointer', display: 'block', padding: '5px 0' }}>Колодцы ({wells.length})</b>
                  {wellsOpen && (
                    <ul style={{ listStyle: 'none', paddingLeft: 15, margin: 0 }}>
                      {wells.map(well => (
                        <li
                          key={well.id}
                          onClick={() => handleSelectWell(well.id)}
                          style={{
                            cursor: 'pointer',
                            padding: '3px 0',
                            color: selectedElement?.type === 'well' && selectedElement.id === well.id ? '#0070c0' : '#333',
                            fontWeight: selectedElement?.type === 'well' && selectedElement.id === well.id ? 'bold' : 'normal'
                          }}
                        >
                          №{well.number || 'Без номера'} ({well.position[0].toFixed(5)}, {well.position[1].toFixed(5)})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

              </div>
            </div>

            {/* Контейнер для карты и остальных элементов */}
            <div style={{ position: 'relative', flexGrow: 1, overflow: 'hidden' }}>
              <Toolbar
                onAddBox={() => setAddBoxMode(true)}
                onAddCable={() => {
                  setAddCableMode(true);
                  setCableStart(null);
                  setCablePoints([]);
                  setCableEnd(null);
                }}
                cableMode={addCableMode}
                onExportToKMZ={handleExportToKMZ}
                onAddPole={() => setAddPoleMode(m => !m)}
                poleMode={addPoleMode}
                onAddWell={() => setAddWellMode(m => !m)}
                wellMode={addWellMode}
              />
              <MapContainer
                center={[50.45086, 30.52281]} // Координаты центра карты (Киев)
                zoom={16}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false} // Отключаем дефолтный ZoomControl
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19} // Добавляем или изменяем свойство maxZoom
                />
                <ScaleControl position="bottomright" /> {/* Полоса масштаба внизу справа */}
                <ZoomControl position="bottomright" /> {/* Кнопки масштабирования внизу справа, добавленные нами */}

                <AddBoxOnMap onMapClick={handleMapClick} enabled={addBoxMode} />
                <AddCableOnMap
                  onMapClick={handleCableMapClick}
                  enabled={addCableMode && !!cableStart && !cableEnd}
                />
                <AddPoleOnMap onMapClick={handleMapClickPole} enabled={addPoleMode} />
                <AddWellOnMap onMapClick={handleMapClickWell} enabled={addWellMode} />

                <LayersControl position="topleft">
                  <LayersControl.Overlay name="Кабели" checked>
                    <LayerGroup>
                      {/* Существующие кабели */}
                      {cables.map(cable => (
                        <React.Fragment key={cable.id}>
                          <Polyline
                            key={cable.id + '-' + cable.fiberCount + '-' + cable.layingType}
                            positions={cable.points as LatLngExpression[]}
                            color={
                              cable.fiberCount === 4 ? "#000"
                              : cable.fiberCount === 8 ? "#ff0000"
                              : cable.fiberCount === 12 ? "#00b050"
                              : cable.fiberCount === 24 ? "#0070c0"
                              : cable.fiberCount === 48 ? "#ff9900"
                              : cable.fiberCount === 96 ? "#703000"
                              : cable.fiberCount === 144 ? "#7030a0"
                              : "green"
                            }
                            dashArray={cable.layingType === "канализация" ? "6 6" : undefined}
                            weight={4}
                            eventHandlers={{ click: () => handleSelectCable(cable.id) }}
                          >
                            {cable.points.length > 1 && (
                              <Tooltip
                                position={getPolylineMiddlePoint(cable.points)}
                                direction="top"
                                offset={[0, -10]}
                                permanent
                                opacity={0.85}
                                interactive={false}
                              >
                                <span style={{ fontSize: 13, fontWeight: 600 }}>
                                  {calculateCableLength(cable.points).toFixed(1)} м
                                </span>
                              </Tooltip>
                            )}
                          </Polyline>
                          {/* Drag-ручки на промежуточных точках (кроме концов) для выбранного кабеля */}
                          {selectedElement?.type === 'cable' && selectedElement.id === cable.id && cable.points.slice(1, -1).map((pt, idx) => (
                            <Marker
                              key={idx}
                              position={pt}
                              icon={getCablePointIcon(false)}
                              draggable={true}
                              eventHandlers={{
                                dragend: (e) => handleCablePointDragEnd(cable.id, idx + 1, e as DragEndEvent)
                              }}
                            />
                          ))}
                        </React.Fragment>
                      ))}
                      {/* Строящийся кабель */}
                      {addCableMode && cableStart && cablePoints.length > 0 && (
                        <Polyline
                          positions={cablePoints as LatLngExpression[]}
                          color="orange"
                          dashArray="6 6"
                          weight={4}
                        />
                      )}
                    </LayerGroup>
                  </LayersControl.Overlay>
                  <LayersControl.Overlay name="Боксы" checked>
                    <LayerGroup>
                      {boxes.map((box) => (
                        <React.Fragment key={box.id}>
                          <Marker
                            position={box.position}
                            icon={getBoxIcon(box.number)}
                            draggable={true}
                            eventHandlers={{
                              dblclick: () => {
                                if (clickTimeoutRef.current) {
                                  clearTimeout(clickTimeoutRef.current);
                                  clickTimeoutRef.current = null;
                                }
                                handleMarkerDblClick(box.id);
                              },
                              dragend: (e) => handleMarkerDragEnd(box.id, e as DragEndEvent),
                              click: () => {
                                if (addCableMode) {
                                  handleBoxClick(box.id, box.position);
                                } else {
                                  // Задержка, чтобы не сработал click после dblclick
                                  if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                                  clickTimeoutRef.current = setTimeout(() => {
                                    handleSelectBox(box.id);
                                    clickTimeoutRef.current = null;
                                  }, 200);
                                }
                              }
                            }}
                          />
                        </React.Fragment>
                      ))}
                    </LayerGroup>
                  </LayersControl.Overlay>
                  <LayersControl.Overlay name="Опоры" checked>
                    <LayerGroup>
                      {poles.map(pole => (
                        <React.Fragment key={pole.id}>
                          <Marker
                            position={pole.position}
                            icon={getPoleIcon(pole.purpose)}
                            draggable={true}
                            eventHandlers={{
                              dragend: (e) => {
                                const { lat, lng } = (e.target as L.Marker).getLatLng();
                                setPoles(poles => poles.map(p =>
                                  p.id === pole.id ? { ...p, position: [lat, lng] } : p
                                ));
                              },
                              click: () => handleSelectPole(pole.id)
                            }}
                          />
                          {/* Подпись с номером опоры */}
                          <Marker
                            position={[pole.position[0] + pole.labelOffset[0] * 0.00001, pole.position[1] + pole.labelOffset[1] * 0.00001]}
                            icon={new DivIcon({
                              className: '',
                              iconSize: [40, 20],
                              iconAnchor: [20, 10],
                              html: `<div style="font-size:15px;font-weight:bold;color:#222;cursor:move;">${pole.number || ''}</div>`
                            })}
                            draggable={true}
                            eventHandlers={{
                              dragstart: (e) => {
                                const orig = (e as any).originalEvent;
                                if (orig && typeof orig.clientX === 'number' && typeof orig.clientY === 'number') {
                                  handleLabelDragStart(pole.id, orig);
                                }
                              },
                              dragend: (e) => handleLabelDragEnd(),
                              click: () => handleSelectPole(pole.id)
                            }}
                          />
                        </React.Fragment>
                      ))}
                    </LayerGroup>
                  </LayersControl.Overlay>
                  <LayersControl.Overlay name="Колодцы" checked>
                    <LayerGroup>
                      {wells.map(well => (
                        <React.Fragment key={well.id}>
                          <Marker
                            position={well.position}
                            icon={getWellIcon()}
                            draggable={true}
                            eventHandlers={{
                              dragend: (e) => {
                                const { lat, lng } = (e.target as L.Marker).getLatLng();
                                setWells(wells => wells.map(w =>
                                  w.id === well.id ? { ...w, position: [lat, lng] } : w
                                ));
                              },
                              click: () => handleSelectWell(well.id)
                            }}
                          />
                          {/* Подпись с номером колодца */}
                          <Marker
                            position={[well.position[0] + well.labelOffset[0] * 0.00001, well.position[1] + well.labelOffset[1] * 0.00001]}
                            icon={new DivIcon({
                              className: '',
                              iconSize: [40, 20],
                              iconAnchor: [20, 10],
                              html: `<div style="font-size:15px;font-weight:bold;color:#222;cursor:move;">${well.number || ''}</div>`
                            })}
                            draggable={true}
                            eventHandlers={{
                              dragstart: (e) => {
                                const orig = (e as any).originalEvent;
                                if (orig && typeof orig.clientX === 'number' && typeof orig.clientY === 'number') {
                                  setDraggedLabelPoleId(well.id);
                                  setLabelDragOffset([orig.clientX, orig.clientY]);
                                }
                              },
                              dragend: (e) => handleLabelDragEnd(),
                              click: () => handleSelectWell(well.id)
                            }}
                          />
                        </React.Fragment>
                      ))}
                    </LayerGroup>
                  </LayersControl.Overlay>
                </LayersControl>
              </MapContainer>
            </div>
          </>
        )}

        {activeTab === 'network' && (
          <div style={{ padding: 20 }}>
            <h2>Структура сети</h2>
            <p>Здесь будет отображаться информация о структуре сети.</p>
          </div>
        )}

        {activeTab === 'splicing' && (
          <div style={{ padding: 20 }}>
            <h2>Схема розварки</h2>
            <p>Здесь будет отображаться схема розварки волокон.</p>
          </div>
        )}

        {activeTab === 'house' && (
          <div style={{ padding: 20 }}>
            <h2>Домовые сети</h2>
            <p>Здесь будет отображаться информация о домовых сетях.</p>
          </div>
        )}

        {activeTab === 'materials' && (
          <div style={{ padding: 20 }}>
            <h2>Спецификация материалов</h2>
            <p>Здесь будет отображаться спецификация материалов.</p>
          </div>
        )}

        {activeTab === 'works' && (
          <div style={{ padding: 20 }}>
            <h2>Спецификация работ</h2>
            <p>Здесь будет отображаться спецификация работ.</p>
          </div>
        )}

        {/* Диалог с деталями бокса */}
        {openedBoxId !== null && (
          <CableDetailDialog
            box={boxes.find(b => b.id === openedBoxId) || null}
            onClose={handleCloseDetails}
            cables={cables}
            boxes={boxes}
            fiberConnections={fiberConnections}
            selectedFiber={selectedFiber}
            onFiberClick={handleFiberClick}
            onRemoveFiberConnection={handleRemoveFiberConnection}
            style={{ zIndex: 6000 }} // Увеличиваем z-index для окна бокса
          />
        )}

        {showCableParamsModal && (
          <div style={{
            position: "absolute", top: "35%", left: "50%", transform: "translate(-50%, -35%)",
            background: "#fff", padding: 24, borderRadius: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)", zIndex: 4000
          }}>
            <h3>Параметры кабеля</h3>
            <div style={{ marginBottom: 12 }}>
              <label>Волоконность:&nbsp;
                <select
                  value={newCableParams.fiberCount}
                  onChange={e => setNewCableParams(p => ({ ...p, fiberCount: Number(e.target.value) }))}
                >
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={96}>96</option>
                  <option value={144}>144</option>
                </select>
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>Тип прокладки:&nbsp;
                <select
                  value={newCableParams.layingType}
                  onChange={e => setNewCableParams(p => ({ ...p, layingType: e.target.value as 'подвес' | 'канализация' }))}
                >
                  <option value="подвес">Подвес</option>
                  <option value="канализация">Канализация</option>
                </select>
              </label>
            </div>
            <button onClick={handleSaveCableWithParams} style={{ marginRight: 12 }}>Сохранить</button>
            <button onClick={() => setShowCableParamsModal(false)}>Отмена</button>
          </div>
        )}

        {/* === Область свойств справа === */}
        {openedBoxId === null && activeTab === 'situational' && ( // Добавляем условие activeTab
          <div style={{
            width: 340, // Задаем фиксированную ширину
            background: '#f8f8f8', // Фон как у левой панели
            borderLeft: '1px solid #ddd', // Граница слева
            padding: 18,
            overflowY: 'auto', // Скролл, если контент не помещается
            flexShrink: 0 // Запрещаем панели сжиматься
            // Удалены: position, right, top, boxShadow, borderRadius, zIndex
          }}>
            {selectedElement === null && (
              <div style={{ color: '#888', fontSize: 15, textAlign: 'center', marginTop: 40 }}>
                Выберите элемент на карте
              </div>
            )}
            {selectedElement?.type === 'box' && (() => {
              const box = boxes.find(b => b.id === selectedElement.id);
              if (!box) return null;
              return (
                <>
                  <h3 style={{ marginTop: 0 }}>Свойства бокса</h3>
                  <div style={{ marginBottom: 10 }}>
                    <label>Номер бокса:<br />
                      <input value={box.number} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, number: e.target.value } : b))} style={{ width: '100%' }} />
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Сплиттер:<br />
                      <input value={box.splitter} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, splitter: e.target.value } : b))} style={{ width: '100%' }} />
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Адрес:<br />
                      <input value={box.address} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, address: e.target.value } : b))} style={{ width: '100%' }} />
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Место установки:<br />
                      <input value={box.place} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, place: e.target.value } : b))} style={{ width: '100%' }} />
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Координаты:<br />
                      <input value={`${box.position[0].toFixed(6)}, ${box.position[1].toFixed(6)}`} readOnly style={{ width: '100%', color: '#888' }} />
                    </label>
                  </div>
                </>
              );
            })()}
            {selectedElement?.type === 'cable' && (() => {
              const cable = cables.find(c => c.id === selectedElement.id);
              if (!cable) return null;
              return (
                <>
                  <h3 style={{ marginTop: 0 }}>Свойства кабеля</h3>
                  <div style={{ marginBottom: 10 }}>
                    <label>Волоконность:<br />
                      <select
                        value={cable.fiberCount}
                        onChange={e => {
                          const newFiberCount = Number(e.target.value);
                          setCables(cables => cables.map(c =>
                            c.id === cable.id ? { ...c, fiberCount: newFiberCount } : c
                          ));
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value={4}>4</option>
                        <option value={8}>8</option>
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                        <option value={48}>48</option>
                        <option value={96}>96</option>
                        <option value={144}>144</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Тип прокладки:<br />
                      <select
                        value={cable.layingType}
                        onChange={e => {
                          const newLayingType = e.target.value as Cable['layingType'];
                          setCables(cables => cables.map(c =>
                            c.id === cable.id ? { ...c, layingType: newLayingType } : c
                          ));
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="подвес">Подвес</option>
                        <option value="канализация">Канализация</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Длина:<br />
                      <input value={`${calculateCableLength(cable.points).toFixed(1)} м`} readOnly style={{ width: '100%', color: '#888' }} />
                    </label>
                  </div>
                </>
              );
            })()}
            {selectedElement?.type === 'pole' && (() => {
              const pole = poles.find(p => p.id === selectedElement.id);
              if (!pole) return null;
              return (
                <>
                  <h3 style={{ marginTop: 0 }}>Свойства опоры</h3>
                  <div style={{ marginBottom: 10 }}>
                    <label>Номер опоры:<br />
                      <input value={pole.number} onChange={e => setPoles(poles => poles.map(p => p.id === pole.id ? { ...p, number: e.target.value } : p))} style={{ width: '100%' }} />
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Номер ТП:<br />
                      <input value={pole.tpNumber} onChange={e => setPoles(poles => poles.map(p => p.id === pole.id ? { ...p, tpNumber: e.target.value } : p))} style={{ width: '100%' }} />
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Назначение:<br />
                      <select value={pole.purpose} onChange={e => setPoles(poles => poles.map(p => p.id === pole.id ? { ...p, purpose: e.target.value as Pole['purpose'] } : p))} style={{ width: '100%' }}>
                        <option value="0,4кВт">0,4кВт</option>
                        <option value="10кВт">10кВт</option>
                        <option value="УТК">УТК</option>
                        <option value="Освещение">Освещение</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Координаты:<br />
                      <input value={`${pole.position[0].toFixed(6)}, ${pole.position[1].toFixed(6)}`} readOnly style={{ width: '100%', color: '#888' }} />
                    </label>
                  </div>
                </>
              );
            })()}
            {selectedElement?.type === 'well' && (() => {
              const well = wells.find(w => w.id === selectedElement.id);
              if (!well) return null;
              return (
                <>
                  <h3 style={{ marginTop: 0 }}>Свойства колодца</h3>
                  <div style={{ marginBottom: 10 }}>
                    <label>Номер колодца:<br />
                      <input value={well.number} onChange={e => setWells(wells => wells.map(w => w.id === well.id ? { ...w, number: e.target.value } : w))} style={{ width: '100%' }} />
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Координаты:<br />
                      <input value={`${well.position[0].toFixed(6)}, ${well.position[1].toFixed(6)}`} readOnly style={{ width: '100%', color: '#888' }} />
                    </label>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {newBoxPosition && (
          <div style={{
            position: "absolute", 
            top: "30%", 
            left: "50%", 
            transform: "translate(-50%, -30%)",
            background: "#fff", 
            padding: 24, 
            borderRadius: 10, 
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)", 
            zIndex: 4000
          }}>
            <h3>Параметры бокса</h3>
            <div>
              <label>
                Номер: <input value={boxParams.number} onChange={e => setBoxParams({ ...boxParams, number: e.target.value })} />
              </label>
            </div>
            <div>
              <label>
                Сплиттер: <input value={boxParams.splitter} onChange={e => setBoxParams({ ...boxParams, splitter: e.target.value })} />
              </label>
            </div>
            <div>
              <label>
                Адрес: <input value={boxParams.address} onChange={e => setBoxParams({ ...boxParams, address: e.target.value })} />
              </label>
            </div>
            <div>
              <label>
                Место установки: <input value={boxParams.place} onChange={e => setBoxParams({ ...boxParams, place: e.target.value })} />
              </label>
            </div>
            <button onClick={handleSaveBox}>Сохранить</button>
          </div>
        )}

        {/* Временная таблица для проверки параметров кабелей */}
        {/* Таблица кабелей полностью удалена */}
      </div>
    </div>
  );
}

export default App;