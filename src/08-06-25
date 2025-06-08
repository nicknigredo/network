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

// Тип для сплиттера
interface Splitter {
  id: string; // Уникальный ID для сплиттера внутри бокса (например, 'splitter-1-level1', 'splitter-2-level2-a')
  type: '1x2' | '1x4' | '1x8' | '1x16'; // Тип сплиттера
  hasConnector: boolean; // Наличие коннектора (true/false)
  level: 1 | 2 | 3; // Уровень сплиттера: 1-й, 2-й, 3-й
  number: string; // НОВОЕ ПОЛЕ: номер сплиттера для отображения (вручную)
}

// Тип для точки соединения (волокно кабеля или порт сплиттера)
type ConnectionPoint =
  | { type: 'cableFiber'; cableId: string; fiberIdx: number; direction: 'in' | 'out' }
  | { type: 'splitterPort'; splitterId: string; portType: 'input' | 'output'; portIdx: number };

// Тип для внутреннего соединения в боксе
interface InternalConnection {
  end1: ConnectionPoint;
  end2: ConnectionPoint;
}

// Константы для потерь сплиттеров
const SPLITTER_LOSSES: Record<Splitter['type'], number> = {
  '1x2': 4.3,
  '1x4': 7.4,
  '1x8': 10.7,
  '1x16': 13.9,
};

// Функция для определения количества портов сплиттера
function getSplitterPortCounts(type: Splitter['type']): { input: number; outputs: number } {
  switch (type) {
    case '1x2': return { input: 1, outputs: 2 };
    case '1x4': return { input: 1, outputs: 4 };
    case '1x8': return { input: 1, outputs: 8 };
    case '1x16': return { input: 1, outputs: 16 };
    default: return { input: 0, outputs: 0 }; // Должен быть недостижим с типизацией
  }
}

// Тип для бокса
interface Box {
  id: number;
  position: [number, number];
  number: string;
  address: string;
  place: string;
  connections: {
    input: { cableId: number } | null;
    outputs: Array<{ cableId: number } | null>;
  };
  splitters: Splitter[];
  internalFiberConnections: InternalConnection[];
  status: 'existing' | 'projected'; // Состояние: существующий или проектируемый
  oltTerminalNo: string; // Номер терминала OLT
  oltPortNo: string;     // Номер порта OLT
  // НОВОЕ ПОЛЕ: Модель бокса
  model: 'FOB-02-04-04LC' | 'FOB-03-12-08LC' | 'FOB-04-16-16LC' | 'FOB-05-24-24LC' |
         'FOB-02-04-04SC' | 'FOB-03-12-08SC' | 'FOB-04-16-16SC' | 'FOB-05-24-24SC' |
         'FOB-05-24';
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
  fiberConnections: InternalConnection[]; // Обновляем тип (это глобальные внешние соединения)
  selectedConnectionPoint: ConnectionPoint | null;
  onConnectionPointClick: (point: ConnectionPoint) => void;
  onRemoveFiberConnection: (idx: number) => void;
  style?: React.CSSProperties;
  onUpdateBoxSplitters: (boxId: number, newSplitters: Splitter[]) => void;
  onUpdateBoxInternalConnections: (boxId: number, newConnections: InternalConnection[]) => void;
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
  fiberConnections: globalExternalConnections, // Переименовано для ясности
  selectedConnectionPoint,
  onConnectionPointClick,
  onRemoveFiberConnection,
  style,
  onUpdateBoxSplitters,
  onUpdateBoxInternalConnections,
}: CableDetailDialogProps) {
  // НОВОЕ СОСТОЯНИЕ: для показа модального окна отчета по соединениям
  // ПЕРЕМЕЩЕНО ВВЕРХ, ЧТОБЫ ИЗБЕЖАТЬ ОШИБКИ REACT HOOKS
  const [showConnectionsReport, setShowConnectionsReport] = useState(false);
  // НОВОЕ СОСТОЯНИЕ: для сворачивания/разворачивания списка сплиттеров
  const [showSplitterList, setShowSplitterList] = useState(true); // Можно установить false по умолчанию, если хотите, чтобы он был свернут

  const [maxHeight, setMaxHeight] = useState(600);
  const [rowHeight] = useState(24);
  const minSplitterHeight = 40; // <-- ОПРЕДЕЛЯЕМ ЗДЕСЬ
  const [totalWidth] = useState(900);
  const [cableSpacing] = useState(40);
  const [svgInternalPadding] = useState(50); // Отступ внутри SVG от верхнего края, это будет базовый Y для начала контента

  // Состояние для внутренних соединений и сплиттеров в текущем боксе
  const [splitters, setSplitters] = useState<Splitter[]>(box?.splitters || []);
  const [internalConnections, setInternalConnections] = useState<InternalConnection[]>(box?.internalFiberConnections || []);

  useEffect(() => {
    // Обновляем состояния при изменении пропса box
    setSplitters(box?.splitters || []);
    setInternalConnections(box?.internalFiberConnections || []);
  }, [box]);
  
  const incomingCable = cables.find(c => c.targetBoxId === box?.id);
  const outgoingCables = cables.filter(c => c.sourceBoxId === box?.id);

  // --- Расчеты Y-координат для элементов внутри SVG ---
  const contentBaseY = svgInternalPadding; // Базовая Y-координата для начала основного контента SVG

  // Позиции для входящего кабеля (левая колонка)
  const incomingCableHeaderY = contentBaseY;
  const incomingCableFibersHeight = incomingCable
    ? getCableStructure(incomingCable.fiberCount).length * rowHeight 
    : 0;
  const incomingCableFibersY = incomingCableHeaderY + 35; // Волокна начинаются на 35px ниже заголовка

  // Позиции для секции сплиттеров (под входящим кабелем)
  const splitterSectionY = incomingCableFibersY + incomingCableFibersHeight + (incomingCableFibersHeight > 0 ? 30 : 0); // Отступ 30px после волокон входящего кабеля
  
  // Расчет общей высоты для сплиттеров динамически (ПЕРЕМЕЩЕНО СЮДА)
  const totalSplittersSvgHeight = splitters.reduce((acc, splitter) => {
    const { input: inputPortsCount, outputs: outputPortsCount } = getSplitterPortCounts(splitter.type);
    const totalPorts = inputPortsCount + outputPortsCount;
    const individualSplitterCalculatedHeight = Math.max(minSplitterHeight, totalPorts * rowHeight + 20); 
    return acc + individualSplitterCalculatedHeight + 20; // +20px отступ между сплиттерами
  }, 0);

  // Позиции для исходящих кабелей (правая колонка)
  const outgoingCablesStartRelativeYPositions: number[] = [];
  let currentOutgoingRelativeY = 0;
  outgoingCables.forEach((cable) => {
    outgoingCablesStartRelativeYPositions.push(currentOutgoingRelativeY);
    const cableFibersHeight = getCableStructure(cable.fiberCount).length * rowHeight;
    currentOutgoingRelativeY += (cableFibersHeight + 35) + cableSpacing;
  });
  const totalOutgoingCablesVisualHeight = currentOutgoingRelativeY;

  // Расчет общей высоты SVG
  const leftColumnEnd = splitterSectionY + totalSplittersSvgHeight;
  const rightColumnEnd = contentBaseY + totalOutgoingCablesVisualHeight;

  const svgCalculatedHeight = Math.max(leftColumnEnd, rightColumnEnd) + svgInternalPadding;

  // --- НОВОЕ: Предварительный расчет координат всех портов сплиттеров ---
  // Этот Map будет хранить абсолютные {x, y} координаты для каждого порта сплиттера
  const splitterPortCoordinates = new Map<string, { x: number; y: number }>();
  let currentSplitterAbsoluteY = splitterSectionY; // Абсолютная Y-позиция для текущего сплиттера

  splitters.forEach(splitter => {
    const portsAlignmentX = 300; // X-координата портов относительно `g` для сплиттеров
    const absolutePortsX = 20 + portsAlignmentX; // Абсолютная X-координата портов в SVG (20px - смещение группы сплиттеров)

    const { input: inputPortsCount, outputs: outputPortsCount } = getSplitterPortCounts(splitter.type);
    const totalPorts = inputPortsCount + outputPortsCount;
    const calculatedSplitterHeight = Math.max(minSplitterHeight, totalPorts * rowHeight + 20);
    const portSpacing = calculatedSplitterHeight / (totalPorts + 1);

    let currentPortYOffset = portSpacing; // Y-смещение порта относительно начала СВОЕГО сплиттера

    // Сохраняем координаты входных портов
    for (let idx = 0; idx < inputPortsCount; idx++) {
      const point: ConnectionPoint = { type: 'splitterPort', splitterId: splitter.id, portType: 'input', portIdx: idx };
      splitterPortCoordinates.set(JSON.stringify(point), { 
        x: absolutePortsX, 
        y: currentSplitterAbsoluteY + currentPortYOffset // Абсолютная Y-координата
      });
      currentPortYOffset += portSpacing;
    }

    // Сохраняем координаты выходных портов
    for (let idx = 0; idx < outputPortsCount; idx++) {
      const point: ConnectionPoint = { type: 'splitterPort', splitterId: splitter.id, portType: 'output', portIdx: idx };
      splitterPortCoordinates.set(JSON.stringify(point), { 
        x: absolutePortsX, 
        y: currentSplitterAbsoluteY + currentPortYOffset 
      });
      currentPortYOffset += portSpacing;
    }

    currentSplitterAbsoluteY += calculatedSplitterHeight + 20; // Увеличиваем Y для следующего сплиттера (высота + отступ)
  });

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

    // Удален неиспользуемый блок isFiberBusy, который вызывал ошибки типизации

    return (
      <g transform={`translate(${side === 'left' ? 20 : totalWidth - 380}, ${y})`}>
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

  // НОВАЯ / ОБНОВЛЕННАЯ ФУНКЦИЯ ПРОВЕРКИ ЗАНЯТОСТИ ТОЧКИ СОЕДИНЕНИЯ
  const isConnectionPointBusy = (point: ConnectionPoint) => {
    // Проверяем ЗАНЯТОСТЬ в рамках внутренних соединений текущего бокса
    const isBusyInternally = internalConnections.some(conn => {
      const checkEnd = (end: ConnectionPoint) => {
        if (point.type === 'cableFiber' && end.type === 'cableFiber') {
          return end.cableId === point.cableId && end.fiberIdx === point.fiberIdx;
        }
        if (point.type === 'splitterPort' && end.type === 'splitterPort') {
          return end.splitterId === point.splitterId &&
                 end.portType === point.portType &&
                 end.portIdx === point.portIdx;
        }
        return false;
      };
      return checkEnd(conn.end1) || checkEnd(conn.end2);
    });

    // Дополнительно проверяем, занято ли волокно кабеля внешними соединениями
    const isBusyExternally = globalExternalConnections.some(conn => {
      // Проверяем только если текущая 'point' - это волокно кабеля
      if (point.type === 'cableFiber') {
        const checkExternalEnd = (end: ConnectionPoint) => {
          if (end.type === 'cableFiber') {
            // Проверяем, участвует ли данное соединение в текущем входящем/исходящем кабеле бокса
            return (end.cableId === point.cableId && end.fiberIdx === point.fiberIdx);
          }
          return false;
        };
        return checkExternalEnd(conn.end1) || checkExternalEnd(conn.end2);
      }
      return false; // Порты сплиттеров не могут быть заняты внешними соединениями
    });

    return isBusyInternally || isBusyExternally;
  };

  // НОВАЯ ФУНКЦИЯ для отрисовки сплиттера в SVG
  const renderSplitterSvg = (splitter: Splitter, y: number) => {
    const splitterBodyWidth = 80; // Ширина прямоугольного тела сплиттера
    // X-координата, на которой будут выровнены все порты сплиттера
    // (относительно начального смещения группы сплиттеров в 20px)
    const portsAlignmentX = 300; // 320 (абсолютная X для волокон кабеля) - 20 (смещение группы) = 300
    // X-координата начала прямоугольника сплиттера
    const splitterRectX = portsAlignmentX - splitterBodyWidth;

    const { input: inputPortsCount, outputs: outputPortsCount } = getSplitterPortCounts(splitter.type);
    const totalPorts = inputPortsCount + outputPortsCount;

    // Расчет высоты сплиттера, чтобы вместить все порты + отступы
    const calculatedSplitterHeight = Math.max(minSplitterHeight, totalPorts * rowHeight + 20); 

    // Определяем цвет фона в зависимости от уровня сплиттера (существующая логика)
    let backgroundColor = '#e0e0e0'; 
    if (splitter.level === 1) {
      backgroundColor = '#FFDDDD'; // Светло-красный для 1-го уровня
    } else if (splitter.level === 2) {
      backgroundColor = '#DDFFDD'; // Светло-зеленый для 2-го уровня
    } else if (splitter.level === 3) {
      backgroundColor = '#DDDDFF'; // Светло-синий для 3-го уровня
    }

    // Расчет равномерного вертикального интервала между портами
    const portSpacing = calculatedSplitterHeight / (totalPorts + 1);
    let currentPortYOffset = portSpacing; // Начальная Y-координата для первого порта

    return (
      <g transform={`translate(0, ${y})`}> {/* Это 'g' уже смещено на 20px по X в App.tsx */}
        {/* Фоновый прямоугольник сплиттера */}
        <rect
          x={splitterRectX} y="0"
          width={splitterBodyWidth}
          height={calculatedSplitterHeight}
          fill={backgroundColor}
          stroke="#999"
          strokeWidth="1"
          rx="5" ry="5"
        />

        {/* Вертикальный текст с номером сплиттера */}
        <text
          x={splitterRectX + 10} // Смещение от левого края прямоугольника (10px отступ)
          y={calculatedSplitterHeight / 2} // Центр по высоте
          textAnchor="start" // Текст будет начинаться от этой точки
          dominantBaseline="middle" // Центрируем по вертикали относительно Y
          fontSize="13" 
          fontWeight="bold"
          fill="#333"
          // Поворот вокруг своей точки (x, y), чтобы текст начинался от смещенной X-позиции
          transform={`rotate(-90 ${splitterRectX + 10} ${calculatedSplitterHeight / 2})`}
        >
          {splitter.number || `ID: ${splitter.id.substring(splitter.id.lastIndexOf('-') + 1)}`}
        </text>

        {/* Входной порт */}
        {Array.from({ length: inputPortsCount }).map((_, idx) => {
          const point: ConnectionPoint = {
            type: 'splitterPort',
            splitterId: splitter.id,
            portType: 'input',
            portIdx: idx,
          };
          const isSelected = selectedConnectionPoint?.type === point.type &&
                             selectedConnectionPoint.splitterId === point.splitterId &&
                             selectedConnectionPoint.portType === point.portType &&
                             selectedConnectionPoint.portIdx === point.portIdx;
          const busy = isConnectionPointBusy(point);
          const portColor = isSelected ? 'gold' : busy ? 'gray' : '#0070c0';
          const cursor = busy ? 'not-allowed' : 'pointer';

          // Текущая Y-координата для этого порта
          const currentPortY = currentPortYOffset;
          currentPortYOffset += portSpacing; // Увеличиваем смещение для следующего порта

          return (
            <g key={`in-port-${idx}`} transform={`translate(${portsAlignmentX}, ${currentPortY})`}>
              <circle
                cx="0" cy="0" r="6" fill={portColor} stroke="black" strokeWidth="1"
                style={{ cursor: cursor }}
                onClick={() => !busy && onConnectionPointClick(point)}
              >
                 <title>{`Входной порт ${idx + 1}`}</title>
              </circle>
              {/* Метка порта */}
              <text x="-15" y="0" textAnchor="end" dominantBaseline="middle" fontSize="12" fill="#333">
                IN
              </text>
            </g>
          );
        })}

        {/* Выходные порты */}
        {Array.from({ length: outputPortsCount }).map((_, idx) => {
          const point: ConnectionPoint = {
            type: 'splitterPort',
            splitterId: splitter.id,
            portType: 'output',
            portIdx: idx,
          };
          const isSelected = selectedConnectionPoint?.type === point.type &&
                             selectedConnectionPoint.splitterId === point.splitterId &&
                             selectedConnectionPoint.portType === point.portType &&
                             selectedConnectionPoint.portIdx === point.portIdx;
          const busy = isConnectionPointBusy(point);
          const portColor = isSelected ? 'gold' : busy ? 'gray' : '#0070c0';
          const cursor = busy ? 'not-allowed' : 'pointer';

          // Текущая Y-координата для этого порта
          const currentPortY = currentPortYOffset;
          currentPortYOffset += portSpacing; // Увеличиваем смещение для следующего порта

          return (
            <g key={`out-port-${idx}`} transform={`translate(${portsAlignmentX}, ${currentPortY})`}>
              <circle
                cx="0" cy="0" r="6" fill={portColor} stroke="black" strokeWidth="1"
                style={{ cursor: cursor }}
                onClick={() => !busy && onConnectionPointClick(point)}
              >
                 <title>{`Выходной порт ${idx + 1}`}</title>
              </circle>
              {/* Метка порта */}
              <text x="-15" y="0" textAnchor="end" dominantBaseline="middle" fontSize="12" fill="#333">
                OUT{idx + 1}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  // --- Функции для управления сплиттерами ---
  const handleAddSplitter = (level: Splitter['level']) => {
    const newSplitter: Splitter = {
      id: `splitter-${Date.now()}`,
      type: '1x8',
      hasConnector: true,
      level: level,
      number: '', // Инициализируем пустым значением для ручного ввода
    };
    const updatedSplitters = [...splitters, newSplitter];
    setSplitters(updatedSplitters);
    onUpdateBoxSplitters(box.id, updatedSplitters);
  };

  const handleDeleteSplitter = (splitterId: string) => {
    const updatedSplitters = splitters.filter(s => s.id !== splitterId);
    // Также нужно удалить все внутренние соединения, связанные с этим сплиттером
    const updatedInternalConnections = internalConnections.filter(conn => {
      const isEnd1SplitterPort = conn.end1.type === 'splitterPort' && conn.end1.splitterId === splitterId;
      const isEnd2SplitterPort = conn.end2.type === 'splitterPort' && conn.end2.splitterId === splitterId;
      return !(isEnd1SplitterPort || isEnd2SplitterPort);
    });

    setSplitters(updatedSplitters);
    setInternalConnections(updatedInternalConnections); // Обновляем внутренние соединения
    onUpdateBoxSplitters(box.id, updatedSplitters);
    onUpdateBoxInternalConnections(box.id, updatedInternalConnections); // Обновляем состояние в App.tsx
  };

  const handleUpdateSplitterNumber = (splitterId: string, newNumber: string) => {
    const updatedSplitters = splitters.map(s =>
      s.id === splitterId ? { ...s, number: newNumber } : s
    );
    setSplitters(updatedSplitters);
    onUpdateBoxSplitters(box.id, updatedSplitters);
  };


  // --- Конец функций для управления сплиттерами ---

  // НОВОЕ СОСТОЯНИЕ: для показа модального окна отчета по соединениям
  // Эта строка дублируется и должна быть удалена
  
  // НОВАЯ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: для форматирования точки соединения в читаемую строку
  const formatConnectionPoint = (point: ConnectionPoint, currentBoxId: number) => {
      if (isCableFiber(point)) { // Используем type guard
          const cable = cables.find(c => String(c.id) === point.cableId);
          const cableNumber = cable ? `Кабель #${cable.id}` : `Неизвестный кабель #${point.cableId}`;
          return `${cableNumber} волокно #${point.fiberIdx + 1} (${point.direction === 'in' ? 'вход' : 'выход'})`;
      } else if (isSplitterPort(point)) { // Используем type guard
          const splitter = splitters.find(s => s.id === point.splitterId);
          const splitterName = splitter ? (splitter.number || `Сплиттер ID:${point.splitterId.substring(point.splitterId.lastIndexOf('-') + 1)}`) : `Неизвестный сплиттер ID:${point.splitterId.substring(point.splitterId.lastIndexOf('-') + 1)}`;
          return `${splitterName} ${point.portType === 'input' ? 'входной' : 'выходной'} порт #${point.portIdx + 1}`;
      }
      return 'Неизвестная точка'; // На всякий случай
  };

  // НОВАЯ ФУНКЦИЯ: для генерации отчета по соединениям
  const generateConnectionReport = () => {
      const report: string[] = [];

      // 1. Внутренние соединения для текущего бокса
      report.push('--- ВНУТРЕННИЕ СОЕДИНЕНИЯ ---');
      if (internalConnections.length === 0) {
          report.push('Нет внутренних соединений.');
      } else {
          internalConnections.forEach((conn, i) => {
              const end1Str = formatConnectionPoint(conn.end1, box.id);
              const end2Str = formatConnectionPoint(conn.end2, box.id);
              report.push(`${i + 1}. ${end1Str} <---> ${end2Str}`);
          });
      }

      // 2. Внешние соединения, имеющие отношение к этому боксу (входящие/исходящие кабели)
      report.push('\n--- ВНЕШНИЕ СОЕДИНЕНИЯ (с участием кабелей этого бокса) ---');
      const relevantExternalConnections = globalExternalConnections.filter(conn => {
          // Проверяем, участвует ли хотя бы один конец соединения во входящем или исходящем кабеле *данного* бокса
          // И убеждаемся, что оба конца являются волокнами кабеля, так как внешние соединения только между кабелями.
          if (isCableFiber(conn.end1) && isCableFiber(conn.end2)) {
              const end1CableId = parseInt(conn.end1.cableId);
              const end2CableId = parseInt(conn.end2.cableId);

              const isEnd1RelatedToBox = (incomingCable && incomingCable.id === end1CableId) || outgoingCables.some(c => c.id === end1CableId);
              const isEnd2RelatedToBox = (incomingCable && incomingCable.id === end2CableId) || outgoingCables.some(c => c.id === end2CableId);

              return isEnd1RelatedToBox || isEnd2RelatedToBox;
          }
          return false;
      });

      if (relevantExternalConnections.length === 0) {
          report.push('Нет внешних соединений, связанных с этим боксом.');
      } else {
          relevantExternalConnections.forEach((conn, i) => {
              const end1Str = formatConnectionPoint(conn.end1, box.id);
              const end2Str = formatConnectionPoint(conn.end2, box.id);
              report.push(`${i + 1}. ${end1Str} <---> ${end2Str}`);
          });
      }

      return report;
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

      {/* Единая рабочая область (с прокруткой) */}
      <div style={{ overflow: 'auto', flex: 1 }}>
        {/* HTML секция для управления сплиттерами (вне SVG) */}
        <div style={{ padding: '10px 20px 10px 20px', borderBottom: '1px dashed #eee', marginBottom: '10px' }}> {/* Уменьшил padding и marginBottom */}
          <h3 style={{ margin: '5px 0' }}>Управление сплиттерами:</h3> {/* Уменьшил margin */}
          <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}> {/* Уменьшил marginBottom, добавил gap */}
            <button onClick={() => handleAddSplitter(1)} style={{ padding: '6px 10px', cursor: 'pointer' }}>Добавить Сплиттер 1 ур.</button> {/* Уменьшил padding */}
            <button onClick={() => handleAddSplitter(2)} style={{ padding: '6px 10px', cursor: 'pointer' }}>Добавить Сплиттер 2 ур.</button>
            <button onClick={() => handleAddSplitter(3)} style={{ padding: '6px 10px', cursor: 'pointer' }}>Добавить Сплиттер 3 ур.</button>
            <button 
              onClick={() => {
                if (!box) return;
                const validation = validateBoxConnections(box);
                if (validation.isValid) {
                  alert('Проверка пройдена успешно! Все соединения корректны.');
                } else {
                  alert('Обнаружены ошибки:\n' + validation.errors.join('\n'));
                }
              }} 
              style={{ 
                marginLeft: '10px', 
                padding: '8px 12px', 
                cursor: 'pointer',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Проверить соединения
            </button>
            {/* НОВАЯ КНОПКА: Показать соединения */}
            <button 
              onClick={() => setShowConnectionsReport(true)}
              style={{ 
                marginLeft: '10px', 
                padding: '8px 12px', 
                cursor: 'pointer',
                backgroundColor: '#0070c0', // Синий цвет
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Показать соединения
            </button>
          </div>
          {/* ОБНОВЛЕННЫЙ БЛОК: Заголовок для списка сплиттеров и кнопка сворачивания */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '5px' // Немного уменьшил отступ
          }}>
            <h4 style={{ margin: '0', cursor: 'pointer' }} onClick={() => setShowSplitterList(!showSplitterList)}>
              Список сплиттеров ({splitters.length}) {showSplitterList ? '▼' : '►'}
            </h4>
          </div>
          {/* Условное отображение списка сплиттеров */}
          {showSplitterList && splitters.length > 0 && (
            <div style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
              {/* <h4 style={{ marginTop: 0, marginBottom: 10 }}>Список сплиттеров:</h4> */} {/* Удален дублирующий заголовок */}
              {splitters.map((splitter) => (
                <div key={splitter.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 0', // Уменьшил padding
                  borderBottom: '1px dashed #eee',
                }}>
                  <span>
                    Уровень: {splitter.level} | Тип: {splitter.type} | Коннектор: {splitter.hasConnector ? 'Да' : 'Нет'}
                    <br/>
                    Номер:
                    <input
                      type="text"
                      value={splitter.number}
                      onChange={(e) => handleUpdateSplitterNumber(splitter.id, e.target.value)}
                      style={{ marginLeft: '5px', width: '80px', padding: '2px' }} // Уменьшил padding
                    />
                  </span>
                  <button onClick={() => handleDeleteSplitter(splitter.id)} style={{ marginLeft: '10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>Удалить</button> {/* Уменьшил padding и margin */}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SVG область для визуализации кабелей и сплиттеров */}
        <svg
          width={totalWidth}
          height={svgCalculatedHeight}
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
              {renderCableInfo(incomingCable, 'left', incomingCableHeaderY)}
              <g transform={`translate(20, ${incomingCableFibersY})`}>
                {getCableStructure(incomingCable.fiberCount).map((fiber, idx) => {
                  const cableId = String(incomingCable.id);
                  const point: ConnectionPoint = {
                    type: 'cableFiber',
                    cableId: cableId,
                    fiberIdx: idx,
                    direction: 'in' // Указываем направление
                  };
                  const isSelected = selectedConnectionPoint?.type === point.type &&
                                   selectedConnectionPoint.cableId === point.cableId &&
                                   selectedConnectionPoint.fiberIdx === point.fiberIdx &&
                                   selectedConnectionPoint.direction === point.direction;
                  const busy = isConnectionPointBusy(point); // Используем isConnectionPointBusy из CableDetailDialog
                  const y = idx * rowHeight;

                  return (
                    <g key={`in-${idx}`} transform={`translate(0, ${y})`}>
                      {renderCell(fiber.moduleColor.name, fiber.moduleColor.color, 120, 0, 0, fiber.moduleColor.border)}
                      {renderCell(fiber.fiberColor.name, fiber.fiberColor.color, 120, 120, 0, fiber.fiberColor.border)}
                      <g
                        transform="translate(240, 0)"
                        onClick={() => !busy && onConnectionPointClick(point)} // Используем новую функцию и `busy`
                        style={{ cursor: busy ? 'not-allowed' : 'pointer' }}
                      >
                        <rect
                          width={60}
                          height={rowHeight}
                          fill={isSelected ? '#ffe066' : busy ? '#e0e0e0' : '#fff'} // Обновляем цвет, если занято
                        />
                        <text
                          x={30}
                          y={rowHeight / 2}
                          dominantBaseline="middle"
                          textAnchor="middle"
                          style={{ fontSize: '12px', fill: busy ? '#888' : '#000' }} // Обновляем цвет текста, если занято
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

          {/* Секция для визуализации сплиттеров внутри SVG */}
          {splitters.length > 0 && (
            <g transform={`translate(20, ${splitterSectionY})`}>
              {/* <text x="0" y="0" fontSize="14" fill="#333" fontWeight="bold">Визуализация сплиттеров (здесь будут SVG элементы):</text> */}
              {splitters.map((splitter, sIdx) => {
                // Динамический расчет Y-позиции для текущего сплиттера
                let currentSplitterY = 0;
                if (sIdx > 0) {
                    for (let i = 0; i < sIdx; i++) {
                        const prevSplitter = splitters[i];
                        const prevPorts = getSplitterPortCounts(prevSplitter.type);
                        const prevTotalPorts = prevPorts.input + prevPorts.outputs;
                        const prevIndividualHeight = Math.max(40, prevTotalPorts * rowHeight + 20); // 40 - minSplitterHeight
                        currentSplitterY += prevIndividualHeight + 20; // Высота предыдущего + отступ
                    }
                }
                return (
                  <React.Fragment key={splitter.id}>
                    {renderSplitterSvg(splitter, currentSplitterY)}
                  </React.Fragment>
                );
              })}
            </g>
          )}

          {/* Линии внешних соединений (кабель-кабель) */}
          {globalExternalConnections.map((conn, i) => { // Используем globalExternalConnections
            if (!incomingCable) return null;

            // Убеждаемся, что оба конца соединения являются волокнами кабеля
            if (conn.end1.type === 'cableFiber' && conn.end2.type === 'cableFiber') {
              // Явно сужаем тип для conn.end1 и conn.end2
              const end1 = conn.end1;
              const end2 = conn.end2;

              const cable1 = cables.find(c => String(c.id) === end1.cableId);
              const cable2 = cables.find(c => String(c.id) === end2.cableId);
              if (!cable1 || !cable2) return null;

              let x1, y1, x2, y2;
              // Определяем координаты для end1
              if (incomingCable && cable1.id === incomingCable.id) {
                x1 = 320;
                y1 = incomingCableFibersY + end1.fiberIdx * rowHeight + rowHeight / 2; // середина волокна
              } else { // Если end1 - это исходящий кабель (на правой стороне)
                const cable1Index = outgoingCables.findIndex(c => c.id === cable1.id);
                if (cable1Index === -1) return null;
                x1 = totalWidth - 380;
                y1 = contentBaseY + outgoingCablesStartRelativeYPositions[cable1Index] + 35 + end1.fiberIdx * rowHeight + rowHeight / 2; // середина волокна исходящего
              }

              // Определяем координаты для end2
              if (incomingCable && cable2.id === incomingCable.id) {
                x2 = 320;
                y2 = incomingCableFibersY + end2.fiberIdx * rowHeight + rowHeight / 2; // середина волокна
              } else { // Если end2 - это исходящий кабель (на правой стороне)
                const cable2Index = outgoingCables.findIndex(c => c.id === cable2.id);
                if (cable2Index === -1) return null;
                x2 = totalWidth - 380;
                y2 = contentBaseY + outgoingCablesStartRelativeYPositions[cable2Index] + 35 + end2.fiberIdx * rowHeight + rowHeight / 2; // середина волокна исходящего
              }

              // НОВОЕ: Логика для изгиба вертикальных линий
              let controlX1, controlY1, controlX2, controlY2;
              const minHorizontalDistanceForBend = 10; // Если |x1 - x2| меньше этого значения, применяем изгиб
              const bendMagnitude = 50; // На сколько пикселей изогнуть линию по горизонтали

              if (Math.abs(x1 - x2) < minHorizontalDistanceForBend) {
                  // Если точки находятся на одной вертикали (или очень близко), создаем изгиб
                  // Определяем направление изгиба: если слева, то вправо; если справа, то влево
                  const bendDirection = (x1 < totalWidth / 2) ? 1 : -1; 
                  controlX1 = x1 + (bendDirection * bendMagnitude);
                  controlX2 = x2 + (bendDirection * bendMagnitude);
                  controlY1 = y1; // Сохраняем горизонтальную касательную в начале
                  controlY2 = y2; // Сохраняем горизонтальную касательную в конце
              } else {
                  // Для горизонтальных или диагональных линий используем существующую логику
                  controlX1 = x1 + (x2 - x1) * 0.25;
                  controlX2 = x1 + (x2 - x1) * 0.75;
                  controlY1 = y1;
                  controlY2 = y2;
              }

              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#0070c0"
                  strokeWidth={2}
                  style={{ cursor: 'pointer', pointerEvents: 'all' }}
                  onClick={() => onRemoveFiberConnection(i)}
                >
                  <title>{`Кабель #${end1.cableId} волокно #${end1.fiberIdx + 1} ↔ Кабель #${end2.cableId} волокно #${end2.fiberIdx + 1}`}</title>
                </path>
              );
            }
            return null; // Пропускаем соединения, которые не являются "кабель-кабель"
          })}

          {/* Линии внутренних соединений (сплиттер-сплиттер, волокно-сплиттер) */}
          {internalConnections.map((conn, i) => { // Теперь используется локальное состояние internalConnections
            // Определяем координаты для end1
            let x1, y1, x2, y2;

            // !!! Важное исправление позиций: теперь используем абсолютные координаты
            // относительно начала SVG (0,0) для всех точек.
            // Секция сплиттеров начинается с x=20 и y=splitterSectionY.
            // Каждый сплиттер внутри этой секции смещен на sIdx * (singleSplitterSvgElementHeight + 20).

            if (conn.end1.type === 'cableFiber') {
              const cableFiberEnd1 = conn.end1;
              const cable = cables.find(c => String(c.id) === cableFiberEnd1.cableId);
              if (!cable) return null;

              // Для входящего кабеля
              if (cable.targetBoxId === box?.id) {
                x1 = 20 + 240 + 60; // 20(padding) + 240(модуль+волокно) + 60(ширина_ячейки)
                y1 = incomingCableFibersY + cableFiberEnd1.fiberIdx * rowHeight + rowHeight / 2;
              }
              // Для исходящего кабеля
              else if (cable.sourceBoxId === box?.id) {
                const cableIndex = outgoingCables.findIndex(c => c.id === cable.id);
                if (cableIndex === -1) return null;
                x1 = totalWidth - 380; // Начало исходящего кабеля
                y1 = contentBaseY + outgoingCablesStartRelativeYPositions[cableIndex] + 35 + cableFiberEnd1.fiberIdx * rowHeight + rowHeight / 2;
              } else {
                return null;
              }
            } else if (conn.end1.type === 'splitterPort') {
              const splitterPortEnd1 = conn.end1;
              // Используем предрасчитанные координаты из Map
              const coords = splitterPortCoordinates.get(JSON.stringify(splitterPortEnd1));
              if (!coords) return null; 
              x1 = coords.x;
              y1 = coords.y;
            } else {
              return null;
            }

            // Определяем координаты для end2
            if (conn.end2.type === 'cableFiber') {
              const cableFiberEnd2 = conn.end2;
              const cable = cables.find(c => String(c.id) === cableFiberEnd2.cableId);
              if (!cable) return null;

              // Для входящего кабеля
              if (cable.targetBoxId === box?.id) {
                x2 = 20 + 240 + 60; // 20(padding) + 240(модуль+волокно) + 60(ширина_ячейки)
                y2 = incomingCableFibersY + cableFiberEnd2.fiberIdx * rowHeight + rowHeight / 2;
              }
              // Для исходящего кабеля
              else if (cable.sourceBoxId === box?.id) {
                const cableIndex = outgoingCables.findIndex(c => c.id === cable.id);
                if (cableIndex === -1) return null;
                x2 = totalWidth - 380; // Начало исходящего кабеля
                y2 = contentBaseY + outgoingCablesStartRelativeYPositions[cableIndex] + 35 + cableFiberEnd2.fiberIdx * rowHeight + rowHeight / 2;
              } else {
                return null;
              }
            } else if (conn.end2.type === 'splitterPort') {
              const splitterPortEnd2 = conn.end2;
              // Используем предрасчитанные координаты из Map
              const coords = splitterPortCoordinates.get(JSON.stringify(splitterPortEnd2));
              if (!coords) return null;
              x2 = coords.x;
              y2 = coords.y;
            } else {
              return null;
            }

            // НОВОЕ: Логика для изгиба вертикальных линий (повторяем ту же логику)
            let controlX1, controlY1, controlX2, controlY2;
            const minHorizontalDistanceForBend = 10; // Если |x1 - x2| меньше этого значения, применяем изгиб
            const bendMagnitude = 50; // На сколько пикселей изогнуть линию по горизонтали

            if (Math.abs(x1 - x2) < minHorizontalDistanceForBend) {
                // Если точки находятся на одной вертикали (или очень близко), создаем изгиб
                const bendDirection = (x1 < totalWidth / 2) ? 1 : -1; // Изгиб вправо, если слева; влево, если справа
                controlX1 = x1 + (bendDirection * bendMagnitude);
                controlX2 = x2 + (bendDirection * bendMagnitude);
                controlY1 = y1; // Сохраняем горизонтальную касательную
                controlY2 = y2; // Сохраняем горизонтальную касательную
            } else {
                // Для горизонтальных или диагональных линий используем существующую логику
                controlX1 = x1 + (x2 - x1) * 0.25;
                controlX2 = x1 + (x2 - x1) * 0.75;
                controlY1 = y1;
                controlY2 = y2;
            }

            // Цвет для внутренних соединений (например, оранжевый)
            return (
              <path
                key={`internal-conn-${i}`}
                d={`M ${x1} ${y1} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${x2} ${y2}`}
                fill="none"
                stroke="#ff9900" // Оранжевый цвет для внутренних соединений
                strokeWidth={2}
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
                onClick={() => {
                  // Логика удаления внутреннего соединения
                  const updatedInternalConnections = internalConnections.filter((_, idx) => idx !== i);
                  setInternalConnections(updatedInternalConnections);
                  onUpdateBoxInternalConnections(box.id, updatedInternalConnections);
                }}
              >
                <title>{`Внутреннее соединение`}</title>
              </path>
            );
          })}


          {/* Исходящие кабели справа */}
          {outgoingCables.length > 0 && (
            <g transform={`translate(0, ${contentBaseY})`}>
              {outgoingCables.map((cable, cableIndex) => {
                const cableGroupOverallY = outgoingCablesStartRelativeYPositions[cableIndex];
                return (
                  <g key={`out-${cable.id}`} transform={`translate(0, ${cableGroupOverallY})`}>
                    {renderCableInfo(cable, 'right', 0)}
                    <g transform={`translate(${totalWidth - 380}, 35)`}>
                      {getCableStructure(cable.fiberCount).map((fiber, idx) => {
                        const cableId = String(cable.id);
                        const point: ConnectionPoint = {
                          type: 'cableFiber',
                          cableId: cableId,
                          fiberIdx: idx,
                          direction: 'out' // Указываем направление
                        };
                        const isSelected = selectedConnectionPoint?.type === point.type &&
                                         selectedConnectionPoint.cableId === point.cableId &&
                                         selectedConnectionPoint.fiberIdx === point.fiberIdx &&
                                         selectedConnectionPoint.direction === point.direction;
                        const busy = isConnectionPointBusy(point); // Используем isConnectionPointBusy из CableDetailDialog
                        const y = idx * rowHeight;

                        return (
                          <g key={`out-${idx}`} transform={`translate(0, ${y})`}>
                            <g
                              transform="translate(0, 0)"
                              onClick={() => !busy && onConnectionPointClick(point)} // Используем новую функцию и `busy`
                              style={{ cursor: busy ? 'not-allowed' : 'pointer' }}
                            >
                              <rect
                                width={60}
                                height={rowHeight}
                                fill={isSelected ? '#ffe066' : busy ? '#e0e0e0' : '#fff'} // Обновляем цвет, если занято
                              />
                              <text
                                x={30}
                                y={rowHeight / 2}
                                dominantBaseline="middle"
                                textAnchor="middle"
                                style={{ fontSize: '12px', fill: busy ? '#888' : '#000' }} // Обновляем цвет текста, если занято
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
            </g>
          )}
        </svg>
      </div>
      
      {/* НОВОЕ МОДАЛЬНОЕ ОКНО: Отчет по соединениям */}
      {showConnectionsReport && (
          <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              maxHeight: `${maxHeight * 0.8}px`, // Немного меньше, чем основное окно
              maxWidth: '600px',
              width: '80%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 6001, // Выше, чем основное окно
              border: '1px solid #ccc'
          }}>
              <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '15px'
              }}>
                  <h3 style={{ margin: 0 }}>Отчет по соединениям бокса №{box.number}</h3>
                  <button onClick={() => setShowConnectionsReport(false)} style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '20px',
                      cursor: 'pointer'
                  }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', padding: '10px', borderRadius: '4px' }}>
                  {generateConnectionReport().map((line, index) => (
                      <p key={index} style={{ margin: '5px 0', fontSize: '14px', whiteSpace: 'pre-wrap' }}>{line}</p>
                  ))}
              </div>
          </div>
      )}
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

function getBoxIcon(number: string, status: Box['status']) { // Добавляем status как параметр
  let fillColor = 'blue'; // По умолчанию проектируемый - синий
  if (status === 'existing') {
    fillColor = 'red'; // Существующий - красный
  }

  return new DivIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `
      <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="20" height="20" rx="4" fill="${fillColor}" fill-opacity="0.7" stroke="black" stroke-width="2" />
        <text x="15" y="18" font-size="14" text-anchor="middle" fill="white">${number}</text>
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

// Добавляем функцию isConnectionPointBusyGlobal
function isConnectionPointBusyGlobal(
  point: ConnectionPoint,
  // Параметр openedBoxId удален, так как функция теперь проверяет все боксы.
  boxes: Box[],
  fiberConnections: InternalConnection[] // Эти соединения являются глобальными внешними
): boolean {
  // Проверяем занятость во внешних (глобальных) соединениях
  const isBusyExternally = fiberConnections.some(conn => {
    const checkEnd = (end: ConnectionPoint) => {
      // Если точка - волокно кабеля, проверяем, занята ли она во внешних соединениях
      if (point.type === 'cableFiber' && end.type === 'cableFiber') {
        return end.cableId === point.cableId && end.fiberIdx === point.fiberIdx;
      }
      // Порты сплиттеров не могут быть во внешних соединениях, поэтому здесь всегда false
      return false;
    };
    return checkEnd(conn.end1) || checkEnd(conn.end2);
  });

  if (isBusyExternally) return true; // Если точка занята внешне, сразу возвращаем true

  // Затем проверяем занятость во внутренних соединениях каждого бокса
  for (const box of boxes) {
    const isBusyInternallyInThisBox = box.internalFiberConnections.some(conn => {
      const checkEnd = (end: ConnectionPoint) => {
        // Если точка - волокно кабеля
        if (point.type === 'cableFiber' && end.type === 'cableFiber') {
          // Проверяем, является ли это волокно частью входящего/исходящего кабеля данного бокса
          const isIncomingCableOfBox = box.connections.input?.cableId === parseInt(point.cableId);
          const isOutgoingCableOfBox = box.connections.outputs.some(out => out?.cableId === parseInt(point.cableId));
          
          if ((isIncomingCableOfBox || isOutgoingCableOfBox) && end.cableId === point.cableId && end.fiberIdx === point.fiberIdx) {
            return true;
          }
        }
        // Если точка - порт сплиттера
        if (point.type === 'splitterPort' && end.type === 'splitterPort') {
          // Проверяем, принадлежит ли этот порт сплиттеру внутри данного бокса
          const isSplitterInThisBox = box.splitters.some(s => s.id === point.splitterId);
          if (isSplitterInThisBox && end.splitterId === point.splitterId && 
              end.portType === point.portType && 
              end.portIdx === point.portIdx) {
            return true;
          }
        }
        return false;
      };
      return checkEnd(conn.end1) || checkEnd(conn.end2);
    });
    if (isBusyInternallyInThisBox) return true; // Если точка занята внутри этого бокса, возвращаем true
  }

  return false; // Если точка не занята нигде
}

// Добавляем type guards для ConnectionPoint (если они были удалены, восстановим их)
function isSplitterPort(point: ConnectionPoint): point is { type: 'splitterPort'; splitterId: string; portType: 'input' | 'output'; portIdx: number } {
  return point.type === 'splitterPort';
}

function isCableFiber(point: ConnectionPoint): point is { type: 'cableFiber'; cableId: string; fiberIdx: number; direction: 'in' | 'out' } {
  return point.type === 'cableFiber';
}

// Обновляем функцию validateBoxConnections (с явным сужением типа)
function validateBoxConnections(box: Box): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Проверяем каждое внутреннее соединение
  box.internalFiberConnections.forEach((conn, idx) => {
    // Проверка 1: Оба конца соединения должны быть определены
    if (!conn.end1 || !conn.end2) {
      errors.push(`Соединение #${idx + 1}: Один из концов соединения не определен`);
      return;
    }

    // Проверка 2: Нельзя соединять два входных порта сплиттера
    if (isSplitterPort(conn.end1) && isSplitterPort(conn.end2)) {
      if (conn.end1.portType === 'input' && conn.end2.portType === 'input') {
        errors.push(`Соединение #${idx + 1}: Нельзя соединять два входных порта сплиттеров`);
      }
    }

    // Проверка 3: Проверяем соответствие типов сплиттеров и количества соединений
    if (isSplitterPort(conn.end1)) {
      const end1SplitterPort = conn.end1; // Явное сужение типа
      const splitter1 = box.splitters.find(s => s.id === end1SplitterPort.splitterId);
      if (splitter1) {
        const portCounts = getSplitterPortCounts(splitter1.type);
        if (end1SplitterPort.portType === 'input' && end1SplitterPort.portIdx >= portCounts.input) {
          errors.push(`Соединение #${idx + 1}: Входной порт ${end1SplitterPort.portIdx + 1} не существует для сплиттера типа ${splitter1.type}`);
        }
        if (end1SplitterPort.portType === 'output' && end1SplitterPort.portIdx >= portCounts.outputs) {
          errors.push(`Соединение #${idx + 1}: Выходной порт ${end1SplitterPort.portIdx + 1} не существует для сплиттера типа ${splitter1.type}`);
        }
      }
    }
    if (isSplitterPort(conn.end2)) {
      const end2SplitterPort = conn.end2; // Явное сужение типа
      const splitter2 = box.splitters.find(s => s.id === end2SplitterPort.splitterId);
      if (splitter2) {
        const portCounts = getSplitterPortCounts(splitter2.type);
        if (end2SplitterPort.portType === 'input' && end2SplitterPort.portIdx >= portCounts.input) {
          errors.push(`Соединение #${idx + 1}: Входной порт ${end2SplitterPort.portIdx + 1} не существует для сплиттера типа ${splitter2.type}`);
        }
        if (end2SplitterPort.portType === 'output' && end2SplitterPort.portIdx >= portCounts.outputs) {
          errors.push(`Соединение #${idx + 1}: Выходной порт ${end2SplitterPort.portIdx + 1} не существует для сплиттера типа ${splitter2.type}`);
        }
      }
    }
  });

  // Проверка 4: Проверяем "висящие" соединения
  const allConnectionPoints = new Set<string>();
  box.internalFiberConnections.forEach(conn => {
    if (isSplitterPort(conn.end1)) { // Используем type guard
        allConnectionPoints.add(JSON.stringify(conn.end1));
    }
    if (isSplitterPort(conn.end2)) { // Используем type guard
        allConnectionPoints.add(JSON.stringify(conn.end2));
    }
  });

  // Проверяем все порты сплиттеров
  box.splitters.forEach(splitter => {
    const portCounts = getSplitterPortCounts(splitter.type);
    
    // Проверяем входные порты
    for (let i = 0; i < portCounts.input; i++) {
      const port: ConnectionPoint = {
        type: 'splitterPort',
        splitterId: splitter.id,
        portType: 'input',
        portIdx: i
      };
      if (!allConnectionPoints.has(JSON.stringify(port))) {
        errors.push(`Сплиттер ${splitter.number || splitter.id.substring(splitter.id.lastIndexOf('-') + 1)}: Входной порт ${i + 1} не соединен`);
      }
    }
    
    // Проверяем выходные порты
    for (let i = 0; i < portCounts.outputs; i++) {
      const port: ConnectionPoint = {
        type: 'splitterPort',
        splitterId: splitter.id,
        portType: 'output',
        portIdx: i
      };
      if (!allConnectionPoints.has(JSON.stringify(port))) {
        errors.push(`Сплиттер ${splitter.number || splitter.id.substring(splitter.id.lastIndexOf('-') + 1)}: Выходной порт ${i + 1} не соединен`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

function App() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [addBoxMode, setAddBoxMode] = useState(false);
  const [addCableMode, setAddCableMode] = useState(false);
  const [newBoxPosition, setNewBoxPosition] = useState<[number, number] | null>(null);
  const [boxParams, setBoxParams] = useState({ 
    number: "", 
    address: "", 
    place: "" 
  });

  const [cables, setCables] = useState<Cable[]>([]);
  const [cablePoints, setCablePoints] = useState<[number, number][]>([]);
  const [selectedCableId, setSelectedCableId] = useState<number | null>(null);

  const [fiberConnections, setFiberConnections] = useState<InternalConnection[]>([]);

  const [selectedConnectionPoint, setSelectedConnectionPoint] = useState<ConnectionPoint | null>(null);

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
  const [splittersOpen, setSplittersOpen] = useState(false); // Изменено с true на false

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
    if (addBoxMode) {
      setNewBoxPosition(position);
      // Убираем setAddBoxMode(false) отсюда
    }
  };

  const handleAddBox = (position: [number, number]) => {
    const newBox: Box = {
      id: boxes.length + 1,
      position,
      number: boxParams.number,
      address: boxParams.address,
      place: boxParams.place,
      connections: {
        input: null,
        outputs: Array(6).fill(null)
      },
      splitters: [],
      internalFiberConnections: [],
      status: 'projected',
      oltTerminalNo: '',
      oltPortNo: '',
      model: 'FOB-05-24', // Инициализация по умолчанию, можно выбрать другое
    };
    setBoxes([...boxes, newBox]);
    setNewBoxPosition(null);
    setAddBoxMode(false);
    setBoxParams({ number: "", address: "", place: "" });
  };

  const handleSaveBox = () => {
    if (!newBoxPosition) return;
    handleAddBox(newBoxPosition);
  };

  const handleMarkerDblClick = (boxId: number) => {
    setOpenedBoxId(boxId);
    boxIdToUpdateInternalConnections.current = boxId; // Сохраняем ID бокса для обновления внутренних соединений
  };

  const handleCloseDetails = () => {
    setOpenedBoxId(null);
    boxIdToUpdateInternalConnections.current = null; // Очищаем ID при закрытии
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

  // Обновляем вызов функции в handleConnectionPointClick
  function handleConnectionPointClick(point: ConnectionPoint) {
    // Используем обновленную глобальную функцию для проверки занятости
    // Обратите внимание: `openedBoxId` здесь не передается, т.к. `isConnectionPointBusyGlobal` теперь сама итерируется по всем боксам
    if (isConnectionPointBusyGlobal(point, boxes, fiberConnections)) return;

    if (!selectedConnectionPoint) {
      setSelectedConnectionPoint(point);
    } else {
      // Проверка на совпадение типов точек и конкретных ID (для отмены выбора)
      if (selectedConnectionPoint.type === point.type) {
        if (point.type === 'cableFiber' && selectedConnectionPoint.type === 'cableFiber') {
          if (selectedConnectionPoint.cableId === point.cableId && 
              selectedConnectionPoint.fiberIdx === point.fiberIdx) {
            setSelectedConnectionPoint(null);
            return;
          }
        }
        if (point.type === 'splitterPort' && selectedConnectionPoint.type === 'splitterPort') {
          if (selectedConnectionPoint.splitterId === point.splitterId && 
              selectedConnectionPoint.portType === point.portType && 
              selectedConnectionPoint.portIdx === point.portIdx) {
            setSelectedConnectionPoint(null);
            return;
          }
        }
      }
      
      // Обе точки должны быть свободны (повторная проверка на случай, если первая точка стала занятой между кликами)
      // Используем обновленную глобальную функцию
      if (isConnectionPointBusyGlobal(selectedConnectionPoint, boxes, fiberConnections)) {
        setSelectedConnectionPoint(null);
        return;
      }

      // Определяем, является ли соединение внутренним (хотя бы один конец - порт сплиттера)
      const isInternalConnection = 
        selectedConnectionPoint.type === 'splitterPort' || point.type === 'splitterPort';

      if (isInternalConnection) {
        // Это внутреннее соединение, связанное со сплиттером
        if (openedBoxId !== null) { // Убеждаемся, что диалог бокса открыт
          setBoxes(prevBoxes => prevBoxes.map(box => {
            if (box.id === openedBoxId) {
              return {
                ...box,
                internalFiberConnections: [...box.internalFiberConnections, { end1: selectedConnectionPoint, end2: point }]
              };
            }
            return box;
          }));
        } else {
            // Если мы пытаемся создать внутреннее соединение, но диалог бокса не открыт - это логическая ошибка
            console.warn("Попытка создать внутреннее соединение вне контекста открытого бокса.");
            alert("Не удалось создать соединение: бокс не выбран.");
        }
      } else {
        // Это внешнее соединение (кабель-кабель)
        setFiberConnections(prev => [...prev, {
          end1: selectedConnectionPoint,
          end2: point
        }]);
      }
      
      setSelectedConnectionPoint(null);
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
    return fiberConnections.some(conn => {
      const checkEnd = (end: ConnectionPoint) => {
        if (end.type === 'cableFiber') {
          return end.cableId === cableId && end.fiberIdx === fiberIdx;
        }
        return false;
      };
      return checkEnd(conn.end1) || checkEnd(conn.end2);
    });
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
  const handleToggleSplitters = () => setSplittersOpen(!splittersOpen); // НОВАЯ ФУНКЦИЯ: для открытия/закрытия списка сплиттеров

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
              address: row.Адрес || '',
              place: row.Место || '',
              connections: {
                input: row.Входящий_кабель_ID ? { cableId: row.Входящий_кабель_ID } : null,
                outputs: row.Исходящие_кабели_ID ? 
                  row.Исходящие_кабели_ID.split(',').map((id: string) => ({ cableId: parseInt(id.trim()) })) : 
                  Array(6).fill(null)
              },
              splitters: [],
              internalFiberConnections: [],
              // Явно проверяем тип status при импорте
              status: (row.Состояние === 'existing' || row.Состояние === 'projected') ? row.Состояние : 'projected',
              oltTerminalNo: row['№ терминала (OLT)'] || '',
              oltPortNo: row['№ порта (OLT Port)'] || '',
              // НОВОЕ ПОЛЕ: Модель бокса (берем из импорта или ставим по умолчанию)
              model: (['FOB-02-04-04LC', 'FOB-03-12-08LC', 'FOB-04-16-16LC', 'FOB-05-24-24LC',
                       'FOB-02-04-04SC', 'FOB-03-12-08SC', 'FOB-04-16-16SC', 'FOB-05-24-24SC',
                       'FOB-05-24'].includes(row['Модель бокса'])) ? row['Модель бокса'] : 'FOB-05-24',
            } as Box; // Явно приводим каждый элемент к типу Box
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

  const boxIdToUpdateInternalConnections = useRef<number | null>(null);

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
        NOVA                 Тестовая страница проекта GPON
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

                {/* НОВАЯ СЕКЦИЯ: Сплиттеры */}
                <div style={{ marginBottom: 15 }}>
                  <b onClick={handleToggleSplitters} style={{ cursor: 'pointer', display: 'block', padding: '5px 0' }}>
                    Сплиттеры ({boxes.reduce((acc, box) => acc + box.splitters.length, 0)})
                  </b>
                  {splittersOpen && (
                    <ul style={{ listStyle: 'none', paddingLeft: 15, margin: 0 }}>
                      {/* Сплиттеры 1-го уровня */}
                      <li style={{ marginTop: 5 }}>
                        <b style={{ cursor: 'pointer', display: 'block' }}>
                          Сплиттеры 1-го уровня ({boxes.reduce((acc, box) => acc + box.splitters.filter(s => s.level === 1).length, 0)})
                        </b>
                        <ul style={{ listStyle: 'none', paddingLeft: 15, margin: 0 }}>
                          {boxes.map(box => (
                            <React.Fragment key={`box-splitters-1-${box.id}`}>
                              {box.splitters
                                .filter(splitter => splitter.level === 1)
                                .map(splitter => (
                                  <li
                                    key={splitter.id}
                                    style={{
                                      padding: '3px 0',
                                      color: '#333',
                                      cursor: 'default'
                                    }}
                                  >
                                    Бокс №{box.number || 'Без номера'} - Сплиттер №{splitter.number}
                                  </li>
                                ))}
                            </React.Fragment>
                          ))}
                        </ul>
                      </li>

                      {/* Сплиттеры 2-го уровня */}
                      <li style={{ marginTop: 5 }}>
                        <b style={{ cursor: 'pointer', display: 'block' }}>
                          Сплиттеры 2-го уровня ({boxes.reduce((acc, box) => acc + box.splitters.filter(s => s.level === 2).length, 0)})
                        </b>
                        <ul style={{ listStyle: 'none', paddingLeft: 15, margin: 0 }}>
                          {boxes.map(box => (
                            <React.Fragment key={`box-splitters-2-${box.id}`}>
                              {box.splitters
                                .filter(splitter => splitter.level === 2)
                                .map(splitter => (
                                  <li
                                    key={splitter.id}
                                    style={{
                                      padding: '3px 0',
                                      color: '#333',
                                      cursor: 'default'
                                    }}
                                  >
                                    Бокс №{box.number || 'Без номера'} - Сплиттер №{splitter.number}
                                  </li>
                                ))}
                            </React.Fragment>
                          ))}
                        </ul>
                      </li>

                      {/* Сплиттеры 3-го уровня */}
                      <li style={{ marginTop: 5 }}>
                        <b style={{ cursor: 'pointer', display: 'block' }}>
                          Сплиттеры 3-го уровня ({boxes.reduce((acc, box) => acc + box.splitters.filter(s => s.level === 3).length, 0)})
                        </b>
                        <ul style={{ listStyle: 'none', paddingLeft: 15, margin: 0 }}>
                          {boxes.map(box => (
                            <React.Fragment key={`box-splitters-3-${box.id}`}>
                              {box.splitters
                                .filter(splitter => splitter.level === 3)
                                .map(splitter => (
                                  <li
                                    key={splitter.id}
                                    style={{
                                      padding: '3px 0',
                                      color: '#333',
                                      cursor: 'default'
                                    }}
                                  >
                                    Бокс №{box.number || 'Без номера'} - Сплиттер №{splitter.number}
                                  </li>
                                ))}
                            </React.Fragment>
                          ))}
                        </ul>
                      </li>
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
                            icon={getBoxIcon(box.number, box.status)} // Передаем status в getBoxIcon
                            draggable={true}
                            eventHandlers={{
                              dblclick: () => {
                                handleMarkerDblClick(box.id);
                              },
                              dragend: (e) => handleMarkerDragEnd(box.id, e as DragEndEvent),
                              click: () => {
                                if (addCableMode) {
                                  handleBoxClick(box.id, box.position);
                                } else {
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
            fiberConnections={fiberConnections} // Теперь это globalExternalConnections для CableDetailDialog
            selectedConnectionPoint={selectedConnectionPoint}
            onConnectionPointClick={handleConnectionPointClick}
            onRemoveFiberConnection={handleRemoveFiberConnection}
            onUpdateBoxSplitters={(boxId, newSplitters) => {
              setBoxes(prevBoxes => prevBoxes.map(b => 
                b.id === boxId ? { ...b, splitters: newSplitters } : b
              ));
            }}
            onUpdateBoxInternalConnections={(boxId, newConnections) => {
              setBoxes(prevBoxes => prevBoxes.map(b => 
                b.id === boxId ? { ...b, internalFiberConnections: newConnections } : b
              ));
            }}
            style={{ zIndex: 6000 }}
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
                  {/* НОВОЕ ПОЛЕ: Состояние */}
                  <div style={{ marginBottom: 10 }}>
                    <label>Состояние:<br />
                      <select
                        value={box.status}
                        onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, status: e.target.value as Box['status'] } : b))}
                        style={{ width: '100%' }}
                      >
                        <option value="projected">Проектируемый</option>
                        <option value="existing">Существующий</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Номер бокса:<br />
                      <input value={box.number} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, number: e.target.value } : b))} style={{ width: '100%' }} />
                    </label>
                  </div>
                  {/* НОВОЕ ПОЛЕ: Модель бокса */}
                  <div style={{ marginBottom: 10 }}>
                    <label>Модель бокса:<br />
                      <select
                        value={box.model}
                        onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, model: e.target.value as Box['model'] } : b))}
                        style={{ width: '100%' }}
                      >
                        <option value="FOB-02-04-04LC">FOB-02-04-04LC</option>
                        <option value="FOB-03-12-08LC">FOB-03-12-08LC</option>
                        <option value="FOB-04-16-16LC">FOB-04-16-16LC</option>
                        <option value="FOB-05-24-24LC">FOB-05-24-24LC</option>
                        <option value="FOB-02-04-04SC">FOB-02-04-04SC</option>
                        <option value="FOB-03-12-08SC">FOB-03-12-08SC</option>
                        <option value="FOB-04-16-16SC">FOB-04-16-16SC</option>
                        <option value="FOB-05-24-24SC">FOB-05-24-24SC</option>
                        <option value="FOB-05-24">FOB-05-24</option>
                      </select>
                    </label>
                  </div>
                  {/* НОВЫЕ ПОЛЯ: № терминала (OLT) и № порта (OLT Port) */}
                  <div style={{ marginBottom: 10 }}>
                    <label>№ терминала (OLT):<br />
                      <input value={box.oltTerminalNo} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, oltTerminalNo: e.target.value } : b))} style={{ width: '100%' }} />
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>№ порта (OLT Port):<br />
                      <input value={box.oltPortNo} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, oltPortNo: e.target.value } : b))} style={{ width: '100%' }} />
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
                  {/* РАЗДЕЛЕННЫЕ ПОЛЯ: Координаты */}
                  <div style={{ marginBottom: 10 }}>
                    <label>Широта:<br />
                      <input value={box.position[0].toFixed(6)} readOnly style={{ width: '100%', color: '#888' }} />
                    </label>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label>Долгота:<br />
                      <input value={box.position[1].toFixed(6)} readOnly style={{ width: '100%', color: '#888' }} />
                    </label>
                  </div>

                  {/* НОВАЯ СЕКЦИЯ: Список сплиттеров в боксе */}
                  {box.splitters.length > 0 && (
                    <div style={{ marginTop: 20, borderTop: '1px dashed #eee', paddingTop: 15 }}>
                      <h4 style={{ marginTop: 0, marginBottom: 10 }}>Установленные сплиттеры:</h4>
                      {box.splitters.map((splitter, idx) => (
                        <div key={splitter.id} style={{ marginBottom: 8, fontSize: '13px', lineHeight: '1.4' }}>
                          <strong>Сплиттер {idx + 1}:</strong> Уровень {splitter.level}, Номер: {splitter.number || 'не задан'}
                        </div>
                      ))}
                    </div>
                  )}
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

        {/* Форма создания бокса */}
        {addBoxMode && newBoxPosition && (
          <div style={{
            position: 'fixed', // Это правильно, для центрирования по экрану
            top: '50%',       // Центрируем по вертикали
            left: '50%',      // Центрируем по горизонтали
            transform: 'translate(-50%, -50%)', // Точное центрирование по осям X и Y
            background: 'white',
            padding: '20px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 4000 // Увеличим zIndex, чтобы оно было поверх всего
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Параметры бокса</h3> {/* Добавил заголовок */}
            <div style={{ marginBottom: '10px' }}>
              <label>
                Номер бокса: <input value={boxParams.number} onChange={e => setBoxParams({ ...boxParams, number: e.target.value })} />
              </label>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>
                Адрес установки: <input value={boxParams.address} onChange={e => setBoxParams({ ...boxParams, address: e.target.value })} />
              </label>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>
                Место установки: <input value={boxParams.place} onChange={e => setBoxParams({ ...boxParams, place: e.target.value })} />
              </label>
            </div>
            <button onClick={handleSaveBox} style={{ padding: '8px 15px', cursor: 'pointer' }}>Сохранить</button>
            <button onClick={() => {
              setNewBoxPosition(null); // Сбросить позицию
              setAddBoxMode(false);   // Выйти из режима добавления
              setBoxParams({ number: "", address: "", place: "" }); // Очистить поля
            }} style={{ marginLeft: '10px', padding: '8px 15px', cursor: 'pointer', background: '#ccc' }}>Отмена</button> {/* Добавил кнопку Отмена */}
          </div>
        )}

        {/* Временная таблица для проверки параметров кабелей */}
        {/* Таблица кабелей полностью удалена */}
      </div>
    </div>
  );
}

export default App;