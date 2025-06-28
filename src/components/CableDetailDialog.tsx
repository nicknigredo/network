import React, { useState, useEffect } from 'react';
import {
  CableDetailDialogProps,
  ConnectionPoint,
  InternalConnection,
  Splitter,
  Cable,
  Box
} from '../types';
import {
  getCableStructure,
  calculateCableLength,
  getSplitterPortCounts,
  SPLITTER_LOSSES,
  validateBoxConnections,
  isSplitterPort,
  isCableFiber
} from '../utils';

export default function CableDetailDialog({
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
    
    const incomingCable = cables.find(c => c.targetElement?.type === 'box' && c.targetElement.id === box?.id);
    const outgoingCables = cables.filter(c => c.sourceElement.type === 'box' && c.sourceElement.id === box?.id);
  
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
      const fromBox = boxes.find(b => b.id === cable.sourceElement.id);
      const toBox = boxes.find(b => b.id === cable.targetElement?.id);
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
      // Проверяем ЗАНЯТОСТЬ только в рамках внутренних соединений текущего бокса
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
      onUpdateBoxSplitters(box.id, updatedSplitters);
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
  
    // НОВАЯ ФУНКЦИЯ: для изменения типа сплиттера
    const handleUpdateSplitterType = (splitterId: string, newType: Splitter['type']) => {
      const updatedSplitters = splitters.map(s =>
        s.id === splitterId ? { ...s, type: newType } : s
      );
      setSplitters(updatedSplitters);
      onUpdateBoxSplitters(box.id, updatedSplitters);
    };
  
    // НОВАЯ ФУНКЦИЯ: для изменения типа коннектора сплиттера
    const handleUpdateSplitterConnectorType = (splitterId: string, newType: Splitter['connectorType']) => {
      const updatedSplitters = splitters.map(s =>
        s.id === splitterId ? { ...s, connectorType: newType } : s
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
        report.push('\n--- ВНЕШНИЕ СОЕДИНЕНИЯ (С УЧАСТИЕМ КАБЕЛЕЙ ЭТОГО БОКСА) ---');
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
  
    // НОВАЯ ФУНКЦИЯ: для расчета общего затухания сплиттера
    function getSplitterTotalAttenuation(splitter: Splitter): number {
      return SPLITTER_LOSSES[splitter.type]; // Возвращаем только затухание сплиттера
    }
  
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
          <div style={{ padding: '10px 20px 10px 20px', borderBottom: '1px dashed #eee', marginBottom: '10px' }}>
            <h3 style={{ margin: '5px 0' }}>Управление сплиттерами:</h3>
            <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button onClick={() => handleAddSplitter(1)} style={{ padding: '6px 10px', cursor: 'pointer' }}>Добавить Сплиттер 1 ур.</button>
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
                if (cable.targetElement?.type === 'box' && cable.targetElement.id === box?.id) {
                  x1 = 20 + 240 + 60; // 20(padding) + 240(модуль+волокно) + 60(ширина_ячейки)
                  y1 = incomingCableFibersY + cableFiberEnd1.fiberIdx * rowHeight + rowHeight / 2;
                }
                // Для исходящего кабеля
                else if (cable.sourceElement.type === 'box' && cable.sourceElement.id === box?.id) {
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
                if (cable.targetElement?.type === 'box' && cable.targetElement.id === box?.id) {
                  x2 = 20 + 240 + 60; // 20(padding) + 240(модуль+волокно) + 60(ширина_ячейки)
                  y2 = incomingCableFibersY + cableFiberEnd2.fiberIdx * rowHeight + rowHeight / 2;
                }
                // Для исходящего кабеля
                else if (cable.sourceElement.type === 'box' && cable.sourceElement.id === box?.id) {
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