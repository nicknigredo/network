import React, { useState, useEffect } from 'react';
import {
  ConnectionPoint,
  InternalConnection,
  Splitter,
  Cable,
  ATS,
  Terminal,
  TerminalPort
} from '../types';
import {
  getCableStructure,
  calculateCableLength,
  getSplitterPortCounts,
  SPLITTER_LOSSES,
  isSplitterPort,
  isCableFiber,
  isTerminalPort
} from '../utils';

interface AtsDetailDialogProps {
  ats: ATS | null;
  onClose: () => void;
  cables: Cable[];
  atsList: ATS[];
  fiberConnections: InternalConnection[];
  selectedConnectionPoint: ConnectionPoint | null;
  onConnectionPointClick: (point: ConnectionPoint) => void;
  onRemoveFiberConnection: (idx: number) => void;
  style?: React.CSSProperties;
  onUpdateAtsSplitters: (atsId: number, newSplitters: Splitter[]) => void;
  onUpdateAtsInternalConnections: (atsId: number, newConnections: InternalConnection[]) => void;
  onUpdateAtsTerminals: (atsId: number, newTerminals: Terminal[]) => void;
}

export default function AtsDetailDialog({
    ats,
    onClose,
    cables,
    atsList,
    fiberConnections: globalExternalConnections, // Переименовано для ясности
    selectedConnectionPoint,
    onConnectionPointClick,
    onRemoveFiberConnection,
    style,
    onUpdateAtsSplitters,
    onUpdateAtsInternalConnections,
    onUpdateAtsTerminals,
  }: AtsDetailDialogProps) {
    // НОВОЕ СОСТОЯНИЕ: для показа модального окна отчета по соединениям
    // ПЕРЕМЕЩЕНО ВВЕРХ, ЧТОБЫ ИЗБЕЖАТЬ ОШИБКИ REACT HOOKS
    const [showConnectionsReport, setShowConnectionsReport] = useState(false);
    // НОВОЕ СОСТОЯНИЕ: для сворачивания/разворачивания списка сплиттеров
    const [showSplitterList, setShowSplitterList] = useState(true); // Можно установить false по умолчанию, если хотите, чтобы он был свернут
    // Состояние для сворачивания/разворачивания списка терминалов OLT
    const [showTerminalList, setShowTerminalList] = useState(true);
  
    const [maxHeight, setMaxHeight] = useState(600);
    const [rowHeight] = useState(24);
    const minSplitterHeight = 40; // <-- ОПРЕДЕЛЯЕМ ЗДЕСЬ
    const [totalWidth] = useState(900);
    const [cableSpacing] = useState(40);
    const [svgInternalPadding] = useState(50); // Отступ внутри SVG от верхнего края, это будет базовый Y для начала контента
  
    // Состояние для внутренних соединений и сплиттеров в текущей муфте
    const [splitters, setSplitters] = useState<Splitter[]>(ats?.splitters || []);
    const [internalConnections, setInternalConnections] = useState<InternalConnection[]>(ats?.internalFiberConnections || []);
  
    useEffect(() => {
      // Обновляем состояния при изменении пропса ats
      setSplitters(ats?.splitters || []);
      setInternalConnections(ats?.internalFiberConnections || []);
    }, [ats]);
    
    const incomingCable = cables.find(c => c.targetElement?.type === 'ats' && c.targetElement.id === ats?.id);
    const outgoingCables = cables.filter(c => c.sourceElement.type === 'ats' && c.sourceElement.id === ats?.id);
  
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
  
    // НОВОЕ: Расчет общей высоты для терминалов
    const totalTerminalsSvgHeight = ats?.terminals.reduce((acc, terminal) => {
      const calculatedTerminalHeight = Math.max(60, terminal.portCount * rowHeight + 20);
      return acc + calculatedTerminalHeight + 20; // +20px отступ между терминалами
    }, 0) || 0;
  
    // Позиции для исходящих кабелей (правая колонка)
    const outgoingCablesStartRelativeYPositions: number[] = [];
    let currentOutgoingRelativeY = 0;
    outgoingCables.forEach((cable) => {
      outgoingCablesStartRelativeYPositions.push(currentOutgoingRelativeY);
      const cableFibersHeight = getCableStructure(cable.fiberCount).length * rowHeight;
      currentOutgoingRelativeY += (cableFibersHeight + 35) + cableSpacing;
    });
    const totalOutgoingCablesVisualHeight = currentOutgoingRelativeY;
  
    // Расчет общей высоты SVG (теперь учитываем и сплиттеры, и терминалы)
    const leftColumnEnd = splitterSectionY + totalSplittersSvgHeight + totalTerminalsSvgHeight;
    const rightColumnEnd = contentBaseY + totalOutgoingCablesVisualHeight;
  
    const svgCalculatedHeight = Math.max(leftColumnEnd, rightColumnEnd) + svgInternalPadding;
  
    useEffect(() => {
      const updateHeight = () => {
        setMaxHeight(window.innerHeight * 0.8);
      };
      updateHeight();
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }, []);
  
    if (!ats) return null;
  
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
      const fromAts = atsList.find(b => b.id === cable.sourceElement.id);
      const toAts = atsList.find(b => b.id === cable.targetElement?.id);
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
              `От ${fromAts?.number || '?'}` :
              `До ${toAts?.number || '?'}`}
          </text>
        </g>
      );
    };
  
    // НОВАЯ / ОБНОВЛЕННАЯ ФУНКЦИЯ ПРОВЕРКИ ЗАНЯТОСТИ ТОЧКИ СОЕДИНЕНИЯ
    const isConnectionPointBusy = (point: ConnectionPoint) => {
      // Проверяем ЗАНЯТОСТЬ только в рамках внутренних соединений текущей АТС
      const isBusyInternally = internalConnections.some(conn => {
        const checkEnd = (end: ConnectionPoint) => {
          if (isCableFiber(point) && isCableFiber(end)) {
            return end.cableId === point.cableId && end.fiberIdx === point.fiberIdx;
          }
          if (isSplitterPort(point) && isSplitterPort(end)) {
            return end.splitterId === point.splitterId &&
                   end.portType === point.portType &&
                   end.portIdx === point.portIdx;
          }
          if (isTerminalPort(point) && isTerminalPort(end)) {
            return end.terminalId === point.terminalId &&
                   end.portIdx === point.portIdx;
          }
          return false;
        };
        return checkEnd(conn.end1) || checkEnd(conn.end2);
      });
  
      // Убираем проверку внешних соединений - каждое волокно может соединяться независимо в каждом элементе
      return isBusyInternally;
    };
  
    // НОВАЯ ФУНКЦИЯ: для отрисовки сплиттера в SVG
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
        type: '1x8', // По умолчанию 1x8, можно изменить
        connectorType: 'SC/UPC', // Устанавливаем SC/UPC по умолчанию
        level: level,
        number: '', // Инициализируем пустым значением для ручного ввода
      };
      const updatedSplitters = [...splitters, newSplitter];
      setSplitters(updatedSplitters);
      onUpdateAtsSplitters(ats.id, updatedSplitters);
    };
  
    const handleDeleteSplitter = (splitterId: string) => {
      const updatedSplitters = splitters.filter(s => s.id !== splitterId);
      // Также нужно удалить все внутренние соединения, связанные с этим сплиттером
      const updatedInternalConnections = internalConnections.filter(conn => {
        // Используем type guards для безопасного доступа к свойствам splitterId
        const isEnd1SplitterPort = (conn.end1.type === 'splitterPort' && conn.end1.splitterId === splitterId);
        const isEnd2SplitterPort = (conn.end2.type === 'splitterPort' && conn.end2.splitterId === splitterId);
        return !(isEnd1SplitterPort || isEnd2SplitterPort);
      });
  
      setSplitters(updatedSplitters);
      setInternalConnections(updatedInternalConnections); // Обновляем внутренние соединения
      onUpdateAtsSplitters(ats.id, updatedSplitters);
      onUpdateAtsInternalConnections(ats.id, updatedInternalConnections); // Обновляем состояние в App.tsx
    };
  
    const handleUpdateSplitterNumber = (splitterId: string, newNumber: string) => {
      const updatedSplitters = splitters.map(s =>
        s.id === splitterId ? { ...s, number: newNumber } : s
      );
      setSplitters(updatedSplitters);
      onUpdateAtsSplitters(ats.id, updatedSplitters);
    };
  
    // НОВАЯ ФУНКЦИЯ: для изменения типа сплиттера
    const handleUpdateSplitterType = (splitterId: string, newType: Splitter['type']) => {
      const updatedSplitters = splitters.map(s =>
        s.id === splitterId ? { ...s, type: newType } : s
      );
      setSplitters(updatedSplitters);
      onUpdateAtsSplitters(ats.id, updatedSplitters);
    };
  
    // НОВАЯ ФУНКЦИЯ: для изменения типа коннектора сплиттера
    const handleUpdateSplitterConnectorType = (splitterId: string, newType: Splitter['connectorType']) => {
      const updatedSplitters = splitters.map(s =>
        s.id === splitterId ? { ...s, connectorType: newType } : s
      );
      setSplitters(updatedSplitters);
      onUpdateAtsSplitters(ats.id, updatedSplitters);
    };
  
    // --- Конец функций для управления сплиттерами ---
  
    // НОВАЯ ФУНКЦИЯ: для визуализации терминала OLT в SVG
    const renderTerminalSvg = (terminal: Terminal, y: number) => {
      const terminalBodyWidth = 100; // Ширина прямоугольного тела терминала
      const portsAlignmentX = 300; // X-координата для выравнивания портов терминала (теперь совпадает со сплиттерами)
      const terminalRectX = portsAlignmentX - terminalBodyWidth;

      const totalPorts = terminal.portCount;
      const calculatedTerminalHeight = Math.max(60, totalPorts * rowHeight + 20); // Минимум 60px высоты

      // Цвет фона терминала (отличается от сплиттеров)
      const backgroundColor = '#e8f4fd'; // Светло-голубой для терминалов

      // Расчет равномерного вертикального интервала между портами
      const portSpacing = calculatedTerminalHeight / (totalPorts + 1);
      let currentPortYOffset = portSpacing;

      return (
        <g transform={`translate(0, ${y})`}>
          {/* Фоновый прямоугольник терминала */}
          <rect
            x={terminalRectX} y="0"
            width={terminalBodyWidth}
            height={calculatedTerminalHeight}
            fill={backgroundColor}
            stroke="#0066cc"
            strokeWidth="2"
            rx="8" ry="8"
          />

          {/* Вертикальный текст с номером терминала */}
          <text
            x={terminalRectX + 15}
            y={calculatedTerminalHeight / 2}
            textAnchor="start"
            dominantBaseline="middle"
            fontSize="12"
            fontWeight="bold"
            fill="#0066cc"
            transform={`rotate(-90 ${terminalRectX + 15} ${calculatedTerminalHeight / 2})`}
          >
            {terminal.number || `OLT: ${terminal.oltNumber}`}
          </text>

          {/* Модель терминала */}
          <text
            x={terminalRectX + terminalBodyWidth / 2}
            y={calculatedTerminalHeight + 15}
            textAnchor="middle"
            fontSize="10"
            fill="#666"
          >
            {terminal.model}
          </text>

          {/* Порты терминала */}
          {Array.from({ length: totalPorts }).map((_, idx) => {
            const point: ConnectionPoint = {
              type: 'terminalPort',
              terminalId: terminal.id,
              portIdx: idx,
            };
            const isSelected = selectedConnectionPoint?.type === point.type &&
                               selectedConnectionPoint.terminalId === point.terminalId &&
                               selectedConnectionPoint.portIdx === point.portIdx;
            const busy = isConnectionPointBusy(point);
            const portColor = isSelected ? 'gold' : busy ? 'gray' : '#0066cc';
            const cursor = busy ? 'not-allowed' : 'pointer';

            // Текущая Y-координата для этого порта
            const currentPortY = currentPortYOffset;
            currentPortYOffset += portSpacing;

            // Получаем информацию о порте
            const port = terminal.ports.find((p: TerminalPort) => p.portIdx === idx);
            const attenuation = port?.attenuation || 7;

            return (
              <g key={`terminal-port-${idx}`} transform={`translate(${portsAlignmentX}, ${currentPortY})`}>
                <circle
                  cx="0" cy="0" r="6" fill={portColor} stroke="black" strokeWidth="1"
                  style={{ cursor: cursor }}
                  onClick={() => !busy && onConnectionPointClick(point)}
                >
                  <title>{`Порт терминала ${idx + 1} (${attenuation} дБ)`}</title>
                </circle>
                {/* Метка порта с мощностью */}
                <text x="-20" y="0" textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#333">
                  P{idx + 1}
                </text>
                {/* Мощность порта */}
                <text x="15" y="0" textAnchor="start" dominantBaseline="middle" fontSize="10" fill="#666">
                  {attenuation}дБ
                </text>
              </g>
            );
          })}
        </g>
      );
    };
  
    // --- Функция для добавления терминала ---
    const handleAddTerminal = () => {
      // Создаем новый терминал с базовыми параметрами
      const newTerminal: Terminal = {
        id: `terminal-${Date.now()}`,
        model: 'OLT', // Модель по умолчанию
        portCount: 16, // Количество портов по умолчанию
        number: '', // Номер терминала (пустой для ручного ввода)
        oltNumber: '', // Номер OLT (пустой для ручного ввода)
        status: 'projected', // Статус по умолчанию
        ports: Array.from({ length: 16 }, (_, idx) => ({
          portIdx: idx,
          attenuation: 7, // Мощность по умолчанию 7 дБ
          powerMode: 'default7' // Режим мощности по умолчанию
        }))
      };

      // Обновляем состояние терминалов в АТС
      const updatedTerminals = [...ats.terminals, newTerminal];
      
      // Обновляем состояние в App.tsx через пропсы
      onUpdateAtsTerminals(ats.id, updatedTerminals);
      
      console.log('Добавлен новый терминал:', newTerminal);
    };
  
    // --- Функция для удаления терминала ---
    const handleDeleteTerminal = (terminalId: string) => {
      const updatedTerminals = ats.terminals.filter(t => t.id !== terminalId);
      
      // Также нужно удалить все внутренние соединения, связанные с этим терминалом
      const updatedInternalConnections = internalConnections.filter(conn => {
        const isEnd1TerminalPort = (conn.end1.type === 'terminalPort' && conn.end1.terminalId === terminalId);
        const isEnd2TerminalPort = (conn.end2.type === 'terminalPort' && conn.end2.terminalId === terminalId);
        return !(isEnd1TerminalPort || isEnd2TerminalPort);
      });

      // Обновляем терминалы
      onUpdateAtsTerminals(ats.id, updatedTerminals);
      
      // Обновляем внутренние соединения
      setInternalConnections(updatedInternalConnections);
      onUpdateAtsInternalConnections(ats.id, updatedInternalConnections);
      
      console.log('Удален терминал:', terminalId);
    };
  
    // --- Функция для изменения номера терминала ---
    const handleUpdateTerminalNumber = (terminalId: string, newNumber: string) => {
      const updatedTerminals = ats.terminals.map(terminal => {
        if (terminal.id === terminalId) {
          return { ...terminal, number: newNumber };
        }
        return terminal;
      });
      
      onUpdateAtsTerminals(ats.id, updatedTerminals);
      console.log('Обновлен номер терминала:', terminalId, '->', newNumber);
    };

    // --- Функция для изменения количества портов терминала ---
    const handleUpdateTerminalPortCount = (terminalId: string, newPortCount: 4 | 8 | 16) => {
      const updatedTerminals = ats.terminals.map(terminal => {
        if (terminal.id === terminalId) {
          // Создаем новый массив портов с нужным количеством
          const newPorts: TerminalPort[] = Array.from({ length: newPortCount }, (_, idx) => {
            // Если порт уже существовал, сохраняем его настройки
            const existingPort = terminal.ports.find(p => p.portIdx === idx);
            if (existingPort) {
              return existingPort;
            }
            // Иначе создаем новый порт с настройками по умолчанию
            return {
              portIdx: idx,
              attenuation: 7,
              powerMode: 'default7'
            };
          });

          return {
            ...terminal,
            portCount: newPortCount,
            ports: newPorts
          };
        }
        return terminal;
      });
      
      // Также нужно удалить внутренние соединения, связанные с удаленными портами
      const updatedInternalConnections = internalConnections.filter(conn => {
        const isEnd1TerminalPort = (conn.end1.type === 'terminalPort' && conn.end1.terminalId === terminalId);
        const isEnd2TerminalPort = (conn.end2.type === 'terminalPort' && conn.end2.terminalId === terminalId);
        
        if (isEnd1TerminalPort && conn.end1.type === 'terminalPort' && conn.end1.portIdx >= newPortCount) return false;
        if (isEnd2TerminalPort && conn.end2.type === 'terminalPort' && conn.end2.portIdx >= newPortCount) return false;
        
        return true;
      });

      // Обновляем терминалы
      onUpdateAtsTerminals(ats.id, updatedTerminals);
      
      // Обновляем внутренние соединения
      setInternalConnections(updatedInternalConnections);
      onUpdateAtsInternalConnections(ats.id, updatedInternalConnections);
      
      console.log('Обновлено количество портов терминала:', terminalId, '->', newPortCount);
    };

    // --- Функция для изменения мощности порта терминала ---
    const handleUpdateTerminalPortAttenuation = (terminalId: string, portIdx: number, newAttenuation: number) => {
      const updatedTerminals = ats.terminals.map(terminal => {
        if (terminal.id === terminalId) {
          const updatedPorts = terminal.ports.map(port => {
            if (port.portIdx === portIdx) {
              return { ...port, attenuation: newAttenuation };
            }
            return port;
          });
          
          return { ...terminal, ports: updatedPorts };
        }
        return terminal;
      });
      
      onUpdateAtsTerminals(ats.id, updatedTerminals);
      console.log('Обновлена мощность порта терминала:', terminalId, 'порт', portIdx, '->', newAttenuation);
    };

    // --- Функция для изменения статуса терминала ---
    const handleUpdateTerminalStatus = (terminalId: string, newStatus: 'existing' | 'projected') => {
      const updatedTerminals = ats.terminals.map(terminal => {
        if (terminal.id === terminalId) {
          return { ...terminal, status: newStatus };
        }
        return terminal;
      });
      
      onUpdateAtsTerminals(ats.id, updatedTerminals);
      console.log('Обновлен статус терминала:', terminalId, '->', newStatus);
    };
    
    // НОВАЯ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: для форматирования точки соединения в читаемую строку
    const formatConnectionPoint = (point: ConnectionPoint, currentAtsId: number) => {
        if (isCableFiber(point)) { // Используем type guard
            const cable = cables.find(c => String(c.id) === point.cableId);
            const cableNumber = cable ? `Кабель #${cable.id}` : `Неизвестный кабель #${point.cableId}`;
            return `${cableNumber} волокно #${point.fiberIdx + 1} (${point.direction === 'in' ? 'вход' : 'выход'})`;
        } else if (isSplitterPort(point)) { // Используем type guard
            const splitter = splitters.find(s => s.id === point.splitterId);
            const splitterName = splitter ? (splitter.number || `Сплиттер ID:${point.splitterId.substring(point.splitterId.lastIndexOf('-') + 1)}`) : `Неизвестный сплиттер ID:${point.splitterId.substring(point.splitterId.lastIndexOf('-') + 1)}`;
            return `${splitterName} ${point.portType === 'input' ? 'входной' : 'выходной'} порт #${point.portIdx + 1}`;
        } else if (isTerminalPort(point)) { // Используем type guard
            const terminal = ats.terminals.find(t => t.id === point.terminalId);
            const terminalName = terminal ? (terminal.number || `Терминал ID:${point.terminalId.substring(point.terminalId.lastIndexOf('-') + 1)}`) : `Неизвестный терминал ID:${point.terminalId.substring(point.terminalId.lastIndexOf('-') + 1)}`;
            const terminalStatus = terminal ? (terminal.status === 'existing' ? ' (сущ.)' : ' (проект.)') : '';
            return `${terminalName}${terminalStatus} порт #${point.portIdx + 1}`;
        }
        return 'Неизвестная точка'; // На всякий случай
    };
  
    // НОВАЯ ФУНКЦИЯ: для генерации отчета по соединениям
    const generateConnectionReport = () => {
        const report: string[] = [];
  
        // 1. Внутренние соединения для текущей АТС
        report.push('--- ВНУТРЕННИЕ СОЕДИНЕНИЯ ---');
        if (internalConnections.length === 0) {
            report.push('Нет внутренних соединений.');
        } else {
            internalConnections.forEach((conn, i) => {
                const end1Str = formatConnectionPoint(conn.end1, ats.id);
                const end2Str = formatConnectionPoint(conn.end2, ats.id);
                report.push(`${i + 1}. ${end1Str} <---> ${end2Str}`);
            });
        }
  
        // 2. Внешние соединения, имеющие отношение к этой АТС (входящие/исходящие кабели)
        report.push('\n--- ВНЕШНИЕ СОЕДИНЕНИЯ (С УЧАСТИЕМ КАБЕЛЕЙ ЭТОЙ АТС) ---');
        const relevantExternalConnections = globalExternalConnections.filter(conn => {
            // Проверяем, участвует ли хотя бы один конец соединения во входящем или исходящем кабеле *данной* АТС
            // И убеждаемся, что оба конца являются волокнами кабеля, так как внешние соединения только между кабелями.
            if (isCableFiber(conn.end1) && isCableFiber(conn.end2)) {
                const end1CableId = parseInt(conn.end1.cableId);
                const end2CableId = parseInt(conn.end2.cableId);
  
                const isEnd1RelatedToAts = (incomingCable && incomingCable.id === end1CableId) || outgoingCables.some(c => c.id === end1CableId);
                const isEnd2RelatedToAts = (incomingCable && incomingCable.id === end2CableId) || outgoingCables.some(c => c.id === end2CableId);
  
                return isEnd1RelatedToAts || isEnd2RelatedToAts;
            }
            return false;
        });
  
        if (relevantExternalConnections.length === 0) {
            report.push('Нет внешних соединений, связанных с этой АТС.');
        } else {
            relevantExternalConnections.forEach((conn, i) => {
                const end1Str = formatConnectionPoint(conn.end1, ats.id);
                const end2Str = formatConnectionPoint(conn.end2, ats.id);
                report.push(`${i + 1}. ${end1Str} <---> ${end2Str}`);
            });
        }
  
        return report;
    };
  
    // НОВАЯ ФУНКЦИЯ: для расчета общего затухания сплиттера
    const getSplitterTotalAttenuation = (splitter: Splitter): number => {
      return SPLITTER_LOSSES[splitter.type]; // Возвращаем только затухание сплиттера
    };
  
    // --- НОВОЕ: Предварительный расчет координат всех портов сплиттеров и терминалов ---
    // Этот Map будет хранить абсолютные {x, y} координаты для каждого порта
    const splitterPortCoordinates = new Map<string, { x: number; y: number }>();
    const terminalPortCoordinates = new Map<string, { x: number; y: number }>();
    
    // Формируем общий массив элементов в том же порядке, что и для отображения
    const elementsForCoordinates: Array<{ type: 'terminal' | 'splitter'; obj: any; sortKey: number; id: string }> = [];
    
    // Добавляем терминалы с их временными метками
    if (ats && ats.terminals) {
      ats.terminals.forEach(t => {
        const timestamp = typeof t.id === 'string' && t.id.startsWith('terminal-') 
          ? parseInt(t.id.replace('terminal-', '')) 
          : Date.now();
        elementsForCoordinates.push({ type: 'terminal', obj: t, sortKey: timestamp, id: t.id });
      });
    }
    
    // Добавляем сплиттеры с их временными метками
    splitters.forEach(s => {
      const timestamp = typeof s.id === 'string' && s.id.startsWith('splitter-') 
        ? parseInt(s.id.replace('splitter-', '')) 
        : Date.now();
      elementsForCoordinates.push({ type: 'splitter', obj: s, sortKey: timestamp, id: s.id });
    });
    
    // Сортируем по времени добавления (timestamp) - тот же порядок, что и для отображения
    elementsForCoordinates.sort((a, b) => a.sortKey - b.sortKey);
    
    // Рассчитываем координаты портов в правильном порядке
    let currentY = 0; // Начинаем с 0, так как элементы отображаются относительно группы
    const portsAlignmentX = 300; // X-координата портов относительно `g`
    const absolutePortsX = 20 + portsAlignmentX; // Абсолютная X-координата портов в SVG
    
    elementsForCoordinates.forEach(element => {
      if (element.type === 'splitter') {
        const splitter = element.obj;
        const { input: inputPortsCount, outputs: outputPortsCount } = getSplitterPortCounts(splitter.type);
        const totalPorts = inputPortsCount + outputPortsCount;
        const calculatedSplitterHeight = Math.max(minSplitterHeight, totalPorts * rowHeight + 20);
        const portSpacing = calculatedSplitterHeight / (totalPorts + 1);
        
        let currentPortYOffset = portSpacing;
        
        // Сохраняем координаты входных портов
        for (let idx = 0; idx < inputPortsCount; idx++) {
          const point: ConnectionPoint = { type: 'splitterPort', splitterId: splitter.id, portType: 'input', portIdx: idx };
          splitterPortCoordinates.set(JSON.stringify(point), { 
            x: absolutePortsX, 
            y: splitterSectionY + currentY + currentPortYOffset
          });
          currentPortYOffset += portSpacing;
        }
        
        // Сохраняем координаты выходных портов
        for (let idx = 0; idx < outputPortsCount; idx++) {
          const point: ConnectionPoint = { type: 'splitterPort', splitterId: splitter.id, portType: 'output', portIdx: idx };
          splitterPortCoordinates.set(JSON.stringify(point), { 
            x: absolutePortsX, 
            y: splitterSectionY + currentY + currentPortYOffset
          });
          currentPortYOffset += portSpacing;
        }
        
        currentY += calculatedSplitterHeight + 20;
      } else {
        const terminal = element.obj;
        const totalPorts = terminal.portCount;
        const calculatedTerminalHeight = Math.max(60, totalPorts * rowHeight + 20);
        const portSpacing = calculatedTerminalHeight / (totalPorts + 1);
        
        let currentPortYOffset = portSpacing;
        
        // Сохраняем координаты портов терминала
        for (let idx = 0; idx < totalPorts; idx++) {
          const point: ConnectionPoint = { type: 'terminalPort', terminalId: terminal.id, portIdx: idx };
          const coords = { 
            x: absolutePortsX, 
            y: splitterSectionY + currentY + currentPortYOffset
          };
          const key = JSON.stringify(point);
          terminalPortCoordinates.set(key, coords);
          currentPortYOffset += portSpacing;
        }
        
        currentY += calculatedTerminalHeight + 20;
      }
    });
  
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
          <h2 style={{ margin: 0 }}>Детали АТС №{ats.number}</h2>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer'
          }}>×</button>
        </div>
  
        {/* Единая рабочая область (с прокруткой) */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          {/* Новый раздел для управления OLT */}
          <div style={{ padding: '10px 20px 10px 20px', borderBottom: '1px dashed #eee', marginBottom: '10px' }}>
            <h3 style={{ margin: '5px 0' }}>Управление OLT:</h3>
            <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button onClick={handleAddTerminal} style={{ padding: '6px 10px', cursor: 'pointer' }}>Добавить OLT</button>
            </div>
            {/* Список терминалов OLT */}
            <div style={{ marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
              <h4 style={{ margin: 0, cursor: 'pointer' }} onClick={() => setShowTerminalList(prev => !prev)}>
                Список OLT ({ats.terminals.length}) {showTerminalList ? '▼' : '►'}
              </h4>
            </div>
            {showTerminalList && ats.terminals.length > 0 && (
              <div style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
                {ats.terminals.map((terminal, idx) => (
                  <div key={terminal.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 0',
                    borderBottom: '1px dashed #eee',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '5px' }}>
                        <span>Номер терминала: </span>
                        <input
                          type="text"
                          value={terminal.number}
                          onChange={(e) => handleUpdateTerminalNumber(terminal.id, e.target.value)}
                          style={{ marginLeft: '5px', width: '80px', padding: '2px' }}
                          placeholder="Введите номер"
                        />
                        <span style={{ marginLeft: '10px' }}>Модель: {terminal.model}</span>
                      </div>
                      <div style={{ marginBottom: '5px' }}>
                        <span>Количество портов: </span>
                        <select
                          value={terminal.portCount}
                          onChange={(e) => handleUpdateTerminalPortCount(terminal.id, parseInt(e.target.value) as 4 | 8 | 16)}
                          style={{ marginLeft: '5px', width: '80px', padding: '2px' }}
                        >
                          <option value={4}>4</option>
                          <option value={8}>8</option>
                          <option value={16}>16</option>
                        </select>
                        <span style={{ marginLeft: '10px' }}>OLT: {terminal.oltNumber}</span>
                      </div>
                      <div style={{ marginBottom: '5px' }}>
                        <span>Статус: </span>
                        <select
                          value={terminal.status}
                          onChange={(e) => handleUpdateTerminalStatus(terminal.id, e.target.value as 'existing' | 'projected')}
                          style={{ marginLeft: '5px', width: '120px', padding: '2px' }}
                        >
                          <option value="existing">Существующий</option>
                          <option value="projected">Проектируемый</option>
                        </select>
                      </div>
                      {/* Отображение портов с возможностью редактирования мощности */}
                      <div style={{ marginTop: '5px', fontSize: '12px' }}>
                        <span style={{ fontWeight: 'bold' }}>Порты:</span>
                        {terminal.ports.map((port, portIdx) => (
                          <span key={portIdx} style={{ marginLeft: '10px' }}>
                            P{portIdx + 1}:
                            <input
                              type="number"
                              value={port.attenuation}
                              onChange={(e) => handleUpdateTerminalPortAttenuation(terminal.id, portIdx, parseInt(e.target.value) || 7)}
                              style={{ width: '50px', marginLeft: '2px', padding: '1px' }}
                              min="1"
                              max="20"
                            />
                            дБ
                          </span>
                        ))}
                      </div>
                    </div>
                    <button style={{ marginLeft: '10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }} onClick={() => handleDeleteTerminal(terminal.id)}>Удалить</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* HTML секция для управления сплиттерами (вне SVG) */}
          <div style={{ padding: '10px 20px 10px 20px', borderBottom: '1px dashed #eee', marginBottom: '10px' }}>
            <h3 style={{ margin: '5px 0' }}>Управление сплиттерами:</h3>
            <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button onClick={() => handleAddSplitter(1)} style={{ padding: '6px 10px', cursor: 'pointer' }}>Добавить Сплиттер 1 ур.</button>
              <button onClick={() => handleAddSplitter(2)} style={{ padding: '6px 10px', cursor: 'pointer' }}>Добавить Сплиттер 2 ур.</button>
              <button onClick={() => handleAddSplitter(3)} style={{ padding: '6px 10px', cursor: 'pointer' }}>Добавить Сплиттер 3 ур.</button>
              <button 
                onClick={() => {
                  if (!ats) return;
                  // Простая проверка для АТС
                  const errors: string[] = [];
                  
                  if (splitters.length === 0) {
                    errors.push(`АТС ${ats.number}: отсутствуют сплиттеры`);
                  }
                  
                  if (internalConnections.length === 0) {
                    errors.push(`АТС ${ats.number}: отсутствуют внутренние соединения волокон`);
                  }
                  
                  if (errors.length === 0) {
                    alert('Проверка пройдена успешно! Все соединения корректны.');
                  } else {
                    alert('Обнаружены ошибки:\n' + errors.join('\n'));
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
                      Уровень: {splitter.level} |
                      {/* НОВОЕ: Выпадающий список для выбора типа сплиттера */}
                      Тип:
                      <select
                        value={splitter.type}
                        onChange={(e) => handleUpdateSplitterType(splitter.id, e.target.value as Splitter['type'])}
                        style={{ marginLeft: '5px', width: '80px', padding: '2px' }}
                      >
                        <option value="1x2">1x2</option>
                        <option value="1x4">1x4</option>
                        <option value="1x8">1x8</option>
                        <option value="1x16">1x16</option>
                      </select>
                      {/* НОВОЕ: Выпадающий список для выбора типа коннектора */}
                      | Коннектор:
                      <select
                        value={splitter.connectorType || 'null'} // Используем 'null' как строковое значение для отсутствия коннектора
                        onChange={(e) => handleUpdateSplitterConnectorType(splitter.id, e.target.value === 'null' ? null : e.target.value as Splitter['connectorType'])}
                        style={{ marginLeft: '5px', width: '100px', padding: '2px' }}
                      >
                        <option value="null">Без коннектора</option>
                        <option value="SC/UPC">SC/UPC</option>
                        <option value="SC/APC">SC/APC</option>
                      </select>
                      <br/>
                      Номер:
                      <input
                        type="text"
                        value={splitter.number}
                        onChange={(e) => handleUpdateSplitterNumber(splitter.id, e.target.value)}
                        style={{ marginLeft: '5px', width: '80px', padding: '2px' }} // Уменьшил padding
                      />
                      {/* НОВОЕ: Отображение затухания сплиттера */}
                      <span style={{ marginLeft: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                        Затухание: {getSplitterTotalAttenuation(splitter).toFixed(1)} дБ
                      </span>
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
  
            {/* ЕДИНАЯ СЕКЦИЯ: терминалы и сплиттеры в одной вертикальной колонке */}
              <g transform={`translate(20, ${splitterSectionY})`}>
              {(() => {
                // Формируем общий массив элементов: терминалы и сплиттеры
                const elements: Array<{ type: 'terminal' | 'splitter'; obj: any; sortKey: number; id: string }> = [];
                
                // Добавляем терминалы с их временными метками
                if (ats && ats.terminals) {
                  ats.terminals.forEach(t => {
                    const timestamp = typeof t.id === 'string' && t.id.startsWith('terminal-') 
                      ? parseInt(t.id.replace('terminal-', '')) 
                      : Date.now();
                    elements.push({ type: 'terminal', obj: t, sortKey: timestamp, id: t.id });
                  });
                }
                
                // Добавляем сплиттеры с их временными метками
                splitters.forEach(s => {
                  const timestamp = typeof s.id === 'string' && s.id.startsWith('splitter-') 
                    ? parseInt(s.id.replace('splitter-', '')) 
                    : Date.now();
                  elements.push({ type: 'splitter', obj: s, sortKey: timestamp, id: s.id });
                });
                
                // Сортируем по времени добавления (timestamp)
                elements.sort((a, b) => a.sortKey - b.sortKey);
                
                // Рендерим по очереди, аккумулируя Y
                let currentY = 0;
                const rendered: React.ReactNode[] = [];
                elements.forEach((el) => {
                  let height = 0;
                  if (el.type === 'splitter') {
                    const { input, outputs } = getSplitterPortCounts(el.obj.type);
                    height = Math.max(40, (input + outputs) * rowHeight + 20);
                  } else {
                    height = Math.max(60, el.obj.portCount * rowHeight + 20);
                  }
                  rendered.push(
                    <React.Fragment key={el.id}>
                      {el.type === 'splitter'
                        ? renderSplitterSvg(el.obj, currentY)
                        : renderTerminalSvg(el.obj, currentY)}
                    </React.Fragment>
                  );
                  currentY += height + 20;
                });
                return rendered;
              })()}
              </g>
  
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
                if (cable.targetElement?.type === 'ats' && cable.targetElement.id === ats?.id) {
                  x1 = 20 + 240 + 60; // 20(padding) + 240(модуль+волокно) + 60(ширина_ячейки)
                  y1 = incomingCableFibersY + cableFiberEnd1.fiberIdx * rowHeight + rowHeight / 2;
                }
                // Для исходящего кабеля
                else if (cable.sourceElement.type === 'ats' && cable.sourceElement.id === ats?.id) {
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
              } else if (conn.end1.type === 'terminalPort') {
                const terminalPortEnd1 = conn.end1;
                // Используем предрасчитанные координаты из Map
                const coords = terminalPortCoordinates.get(JSON.stringify(terminalPortEnd1));
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
                if (cable.targetElement?.type === 'ats' && cable.targetElement.id === ats?.id) {
                  x2 = 20 + 240 + 60; // 20(padding) + 240(модуль+волокно) + 60(ширина_ячейки)
                  y2 = incomingCableFibersY + cableFiberEnd2.fiberIdx * rowHeight + rowHeight / 2;
                }
                // Для исходящего кабеля
                else if (cable.sourceElement.type === 'ats' && cable.sourceElement.id === ats?.id) {
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
              } else if (conn.end2.type === 'terminalPort') {
                const terminalPortEnd2 = conn.end2;
                // Используем предрасчитанные координаты из Map
                const coords = terminalPortCoordinates.get(JSON.stringify(terminalPortEnd2));
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
                    onUpdateAtsInternalConnections(ats.id, updatedInternalConnections);
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
                    <h3 style={{ margin: 0 }}>Отчет по соединениям АТС №{ats.number}</h3>
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