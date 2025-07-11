import React from 'react';
import { MapContainer, TileLayer, Marker, ScaleControl, useMapEvents, Popup, Tooltip, Polyline, LayerGroup, LayersControl, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { DivIcon, DragEndEvent, LatLngExpression } from 'leaflet';
import { useRef, useEffect, useState } from 'react';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Toolbar from './components/Toolbar';
import Tabs from './components/Tabs';
import CableDetailDialog from './components/CableDetailDialog';
import SpliceClosureDetailDialog from './components/SpliceClosureDetailDialog';
import AtsDetailDialog from './components/AtsDetailDialog';
import {
  AddBoxOnMap,
  AddCableOnMap,
  AddPoleOnMap,
  AddWellOnMap,
  AddSpliceClosureOnMap,
  AddAtsOnMap
} from './components/MapEventHandlers';

// Импорты из вынесенных файлов
import {
  FiberStructure,
  Splitter,
  ConnectionPoint,
  InternalConnection,
  Box,
  SpliceClosure,
  Cable,
  ProjectedWorkDetails,
  CableProjectedWork,
  CableDetailDialogProps,
  OdesaColor,
  Pole,
  Well,
  SelectedElement,
  CableEndpoint,
  MaterialItem,
  MaterialCategory,
  WorkItem,
  WorkCategory,
  ATS,
  Terminal
} from './types';

import {
  SPLITTER_LOSSES,
  CABLE_MODELS,
  ODESA_COLORS,
  WORK_TYPE_LABELS
} from './constants';

import {
  getSplitterPortCounts,
  calculateCableLength,
  getPolylineMiddlePoint,
  getCableStructure,
  getBoxCenter,
  isConnectionPointBusyGlobal,
  isSplitterPort,
  isCableFiber,
  validateBoxConnections,
  getSplitterTotalAttenuation
} from './utils';

import { getBoxIcon, getCablePointIcon, getWellIcon, getPoleIcon, getSpliceClosureIcon, getAtsIcon } from './utils/icons'; 

import AttenuationTable from './components/AttenuationTable';

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
  const [wellParams, setWellParams] = useState<Well>({
    id: 0,
    position: [0, 0],
    number: '',
    labelOffset: [0, 0]
  });

  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
  const [openedBoxId, setOpenedBoxId] = useState<number | null>(null);

  // НОВОЕ СОСТОЯНИЕ: для временных проектных расчетов по кабелям
  const [projectedCableWork, setProjectedCableWork] = useState<Record<number, CableProjectedWork>>({}); // Key: cable ID, Value: Map of work type -> details

  const [boxesOpen, setBoxesOpen] = useState(true);
  const [cablesOpen, setCablesOpen] = useState(true);
  const [polesOpen, setPolesOpen] = useState(true);
  const [wellsOpen, setWellsOpen] = useState(true);
  const [splittersOpen, setSplittersOpen] = useState(false); // Изменено с true на false
  // НОВОЕ СОСТОЯНИЕ: для сворачивания/разворачивания раздела "Работы по кабелю (факт)"
  const [showActualWorks, setShowActualWorks] = useState(false); // Изменено с true на false
  // НОВОЕ СОСТОЯНИЕ: для сворачивания/разворачивания раздела "Работы по кабелю (проект)"
  const [showProjectedWorks, setShowProjectedWorks] = useState(false); // Изменено с true на false

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
    { id: 'attenuation', label: 'Затухания' },
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
  const [cableStart, setCableStart] = useState<CableEndpoint | null>(null);
  const [cableEnd, setCableEnd] = useState<CableEndpoint | null>(null);

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
      splitters: [
        {
          id: `splitter-1-level2`,
          type: '1x8',
          connectorType: null, // Без коннекторов по умолчанию
          level: 2, // Второй уровень
          number: '' // Пустой номер по умолчанию
        }
      ],
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

  const handleMarkerDragEnd = (elementId: number, elementType: 'box' | 'spliceClosure' | 'ats', e: DragEndEvent) => {
    const { lat, lng } = (e.target as L.Marker).getLatLng();
    
    // Обновляем позицию элемента (бокса, муфты или АТС)
    if (elementType === 'box') {
    setBoxes(boxes => boxes.map(b =>
        b.id === elementId ? { ...b, position: [lat, lng] } : b
    ));
    } else if (elementType === 'spliceClosure') {
      setSpliceClosures(spliceClosures => spliceClosures.map(s =>
        s.id === elementId ? { ...s, position: [lat, lng] } : s
      ));
    } else if (elementType === 'ats') {
      setAtsList(atsList => atsList.map(a =>
        a.id === elementId ? { ...a, position: [lat, lng] } : a
      ));
    }

    // Обновляем точки кабелей, связанных с этим элементом
    setCables(cables => cables.map(cable => {
      let shouldUpdate = false;
      let newPoints = [...cable.points];

      // Проверяем начало кабеля
      if (cable.sourceElement?.type === elementType && cable.sourceElement.id === elementId) {
        newPoints[0] = [lat, lng];
        shouldUpdate = true;
      }

      // Проверяем конец кабеля
      if (cable.targetElement && cable.targetElement.type === elementType && cable.targetElement.id === elementId) {
        newPoints[newPoints.length - 1] = [lat, lng];
        shouldUpdate = true;
      }

      return shouldUpdate ? { ...cable, points: newPoints } : cable;
    }));
  };

  const handleBoxClick = (boxId: number, position: [number, number]) => {
    if (addCableMode) {
      if (!cableStart) {
        // Начинаем новый кабель
        setCableStart({ elementId: boxId, elementType: 'box', position });
        setCablePoints([position]);
        setCableEnd(null);
      } else if (!cableEnd && boxId !== cableStart.elementId) {
        // Завершаем кабель
        setCablePoints(points => [...points, position]);
        setCableEnd({ elementId: boxId, elementType: 'box', position });
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

  const handleCableConnection = (elementId: number, elementType: 'box' | 'spliceClosure') => {
    if (selectedCableId) {
      const selectedCable = cables.find(c => c.id === selectedCableId);
      if (!selectedCable) return;
      
      const updatedCable = { ...selectedCable };
      
      // Проверяем, не пытаемся ли мы соединить элемент сам с собой
      if (updatedCable.sourceElement?.id === elementId && 
          updatedCable.sourceElement?.type === elementType) {
        return;
      }
      
      // Устанавливаем source или target в зависимости от того, что еще не установлено
      if (!updatedCable.sourceElement) {
        updatedCable.sourceElement = { type: elementType, id: elementId };
        updatedCable.points[0] = elementType === 'box'
          ? boxes.find(b => b.id === elementId)!.position
          : spliceClosures.find(s => s.id === elementId)!.position;
      } else if (!updatedCable.targetElement) {
        updatedCable.targetElement = { type: elementType, id: elementId };
        updatedCable.points[updatedCable.points.length - 1] = elementType === 'box'
          ? boxes.find(b => b.id === elementId)!.position
          : spliceClosures.find(s => s.id === elementId)!.position;
        
        // После установки обоих концов проверяем валидность соединения
        const sourceElement = updatedCable.sourceElement.type === 'box' 
          ? boxes.find(b => b.id === updatedCable.sourceElement!.id)
          : spliceClosures.find(s => s.id === updatedCable.sourceElement!.id);
          
        const targetElement = updatedCable.targetElement.type === 'box'
          ? boxes.find(b => b.id === updatedCable.targetElement!.id)
          : spliceClosures.find(s => s.id === updatedCable.targetElement!.id);
          
        if (!sourceElement || !targetElement) {
          console.error('Не удалось найти элементы для соединения');
        return;
      }
      }
      
      setCables(cables.map(c => c.id === selectedCableId ? updatedCable : c));
    }
  };

  const handleSaveCableWithParams = () => {
    if (!cableStart || !cableEnd) return;

    const newCable: Cable = {
      id: cables.length + 1,
      points: cablePoints,
      sourceElement: { type: cableStart.elementType, id: cableStart.elementId },
      targetElement: cableEnd ? { type: cableEnd.elementType, id: cableEnd.elementId } : null,
      fiberCount: newCableParams.fiberCount,
      layingType: newCableParams.layingType,
      status: 'projected' as const,
      model: CABLE_MODELS[newCableParams.fiberCount]?.[0] || '',
      oltTerminalNo: '',
      oltPortNo: '',
      actualCableLength: 0, // Инициализация
      actualMarkA: 0,       // Инициализация как число
      actualMarkB: 0,       // Инициализация как число
      actualWorkMetConst: 0, // Инициализация
      actualWorkTK: 0,       // Инициализация
      actualWorkInGround: 0, // Инициализация
      actualWorkExitLKS: 0,  // Инициализация
      actualWorkSuspension: 0, // Инициализация
      actualWorkOnWall: 0,   // Инициализация
      actualWorkOnRiser: 0,  // Инициализация
    };

    // Если тип прокладки - канализация, инициализируем sewerageWorkDetails
    if (newCable.layingType === 'канализация') {
      newCable.sewerageWorkDetails = {
        reserve: 0,
        sections: [0],
      };
    }

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
        
        // Если это начальная или конечная точка, проверяем тип элемента
        if (pointIdx === 0 && cable.sourceElement) {
          const sourceElement = cable.sourceElement.type === 'box'
            ? boxes.find(b => b.id === cable.sourceElement!.id)
            : spliceClosures.find(s => s.id === cable.sourceElement!.id);
          if (sourceElement) {
            newPoints[0] = sourceElement.position;
            return { ...cable, points: newPoints };
          }
        }
        
        if (pointIdx === newPoints.length - 1 && cable.targetElement) {
          const targetElement = cable.targetElement.type === 'box'
            ? boxes.find(b => b.id === cable.targetElement!.id)
            : spliceClosures.find(s => s.id === cable.targetElement!.id);
          if (targetElement) {
            newPoints[newPoints.length - 1] = targetElement.position;
            return { ...cable, points: newPoints };
          }
        }
        
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

      // Определяем, является ли соединение внутренним (хотя бы один конец - порт сплиттера или терминала)
      const isInternalConnection = 
        selectedConnectionPoint.type === 'splitterPort' || point.type === 'splitterPort' ||
        selectedConnectionPoint.type === 'terminalPort' || point.type === 'terminalPort';

      if (isInternalConnection) {
        if (openedBoxId !== null && selectedElement?.type === 'box') {
          // Для бокса
          setBoxes(prevBoxes => prevBoxes.map(box => {
            if (box.id === openedBoxId) {
              return {
                ...box,
                internalFiberConnections: [...box.internalFiberConnections, { end1: selectedConnectionPoint, end2: point }]
              };
            }
            return box;
          }));
        } else if (selectedElement?.type === 'spliceClosure') {
          // Для муфты
          setSpliceClosures(prev => prev.map(sc => {
            if (sc.id === selectedElement.id) {
              return {
                ...sc,
                internalFiberConnections: [...sc.internalFiberConnections, { end1: selectedConnectionPoint, end2: point }]
              };
            }
            return sc;
          }));
        } else if (selectedElement?.type === 'ats') {
          // Для АТС
          setAtsList(prev => prev.map(ats => {
            if (ats.id === selectedElement.id) {
              return {
                ...ats,
                internalFiberConnections: [...ats.internalFiberConnections, { end1: selectedConnectionPoint, end2: point }]
              };
            }
            return ats;
          }));
        } else {
          alert("Не удалось создать соединение: бокс, муфта или АТС не выбраны.");
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
    // Проверяем только внутренние соединения текущего элемента (муфты/бокса/АТС)
    // а не глобальные внешние соединения между кабелями
    return false; // Разрешаем соединение волокна в любом элементе
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
  const handleToggleSpliceClosures = () => setSpliceClosuresOpen(!spliceClosuresOpen);
  const handleToggleAts = () => setAtsOpen(!atsOpen);

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
      const incomingCable = cables.find(cable => cable.targetElement?.type === 'box' && cable.targetElement.id === box.id);
      
      // Находим исходящие кабели
      const outgoingCables = cables.filter(cable => cable.sourceElement.type === 'box' && cable.sourceElement.id === box.id);

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
    // Вспомогательная функция для получения имени элемента (бокса, муфты или АТС)
    const getElementName = (element: { id: number; type: 'box' | 'spliceClosure' | 'coupler' | 'ats' } | null | undefined): string => {
      if (!element) return 'Неизвестно';
      
      if (element.type === 'box') {
        const box = boxes.find(b => b.id === element.id);
        return box ? `Бокс №${box.number}` : `Бокс ID:${element.id}`;
      }
      
      if (element.type === 'spliceClosure') {
        const spliceClosure = spliceClosures.find(sc => sc.id === element.id);
        return spliceClosure ? `Муфта №${spliceClosure.number}` : `Муфта ID:${element.id}`;
      }

      if (element.type === 'coupler') {
        return `Соединитель ID:${element.id}`;
      }

      if (element.type === 'ats') {
        // Пока АТС еще не реализованы, возвращаем заглушку
        return `АТС ID:${element.id}`;
      }

      return 'Неизвестно';
    };

    const cableData = cables.map(cable => {
      const length = calculateCableLength(cable.points).toFixed(1);

      const totalSewerageLength = cable.sewerageWorkDetails 
        ? (cable.sewerageWorkDetails.reserve || 0) + cable.sewerageWorkDetails.sections.reduce((sum, val) => sum + val, 0)
        : 0;

      return {
        ID: cable.id,
        'Откуда': getElementName(cable.sourceElement),
        'Куда': getElementName(cable.targetElement),
        Волоконность: cable.fiberCount,
        'Тип прокладки': cable.layingType,
        'Марка кабеля': cable.model,
        '№ терминала (OLT)': cable.oltTerminalNo || '',
        '№ порта (OLT Port)': cable.oltPortNo || '',
        Длина_м: length,
        'Состояние': cable.status,
        'Работы_Канализация_Общая_Длина_м': cable.layingType === 'канализация' ? totalSewerageLength.toFixed(2) : '',
        // НОВЫЕ ФАКТИЧЕСКИЕ ПОЛЯ ДЛЯ ЭКСПОРТА
        'Длина кабеля (факт)': cable.actualCableLength || 0,
        'Метка А (факт)': cable.actualMarkA || '',
        'Метка Б (факт)': cable.actualMarkB || '',
        'по мет. конст. (факт)': cable.actualWorkMetConst || 0,
        'по т/к (факт)': cable.actualWorkTK || 0,
        'в грунте (факт)': cable.actualWorkInGround || 0,
        'выход из ЛКС (факт)': cable.actualWorkExitLKS || 0,
        'подвес (факт)': cable.actualWorkSuspension || 0,
        'по стене (факт)': cable.actualWorkOnWall || 0,
        'по стояку (факт)': cable.actualWorkOnRiser || 0,
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
    // Вспомогательная функция для парсинга имени элемента из строки отчета
    const parseElementName = (name: string | null | undefined): { type: 'box' | 'coupler' | 'spliceClosure' | 'ats', id: number } | null => {
      if (!name) return null;

      // Поиск бокса
      const boxMatch = name.match(/Бокс ID:(\d+)/) || name.match(/Бокс №(\d+)/);
      if (boxMatch) {
        const numberOrId = boxMatch[1];
        // Ищем по ID (как строке и как числу) и по номеру
        const box = boxes.find(b => 
          String(b.id) === numberOrId || 
          b.id === parseInt(numberOrId, 10) || 
          b.number === numberOrId
        );
        return box ? { type: 'box', id: box.id } : null;
      }

      // Поиск муфты
      const spliceClosureMatch = name.match(/Муфта ID:(\d+)/) || name.match(/Муфта №(\d+)/);
      if (spliceClosureMatch) {
        const numberOrId = spliceClosureMatch[1];
        // Ищем по ID (как строке и как число) и по номеру
        const sc = spliceClosures.find(s => 
          String(s.id) === numberOrId || 
          s.id === parseInt(numberOrId, 10) || 
          s.number === numberOrId
        );
        return sc ? { type: 'spliceClosure', id: sc.id } : null;
      }

      // Поиск АТС
      const atsMatch = name.match(/АТС ID:(\d+)/) || name.match(/АТС №(\d+)/);
      if (atsMatch) {
        const numberOrId = atsMatch[1];
        // Ищем по ID (как строке и как число) и по номеру
        const ats = atsList.find(a => 
          String(a.id) === numberOrId || 
          a.id === parseInt(numberOrId, 10) || 
          a.number === numberOrId
        );
        return ats ? { type: 'ats', id: ats.id } : null;
      }

      // Поиск соединителя
      const couplerMatch = name.match(/Соединитель ID:(\d+)/);
      if (couplerMatch) {
        return { type: 'coupler', id: parseInt(couplerMatch[1], 10) };
      }

      return null;
    };

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
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

          if (!jsonData || jsonData.length === 0) {
            alert('Файл не содержит данных');
            return;
          }

          // Полностью пересоздаем массив кабелей на основе данных из файла
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

            const importedStatus: Cable['status'] = 
              (row.Состояние === 'existing' || row.Состояние === 'projected') 
                ? row.Состояние 
                : 'projected';

            const importedModel = row['Марка кабеля'] || (CABLE_MODELS[row.Волоконность]?.[0] || '');

            const importedSewerageWorkDetails = row['Канализация_Запас'] !== undefined || row['Канализация_Участки'] !== undefined 
              ? {
                  reserve: typeof row['Канализация_Запас'] === 'number' ? row['Канализация_Запас'] : 0,
                  sections: typeof row['Канализация_Участки'] === 'string' 
                    ? row['Канализация_Участки'].split(';').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
                    : [],
                }
              : undefined;

            const sourceElement = parseElementName(row['Откуда']);
            const targetElement = parseElementName(row['Куда']);
            
            // Предупреждаем о проблемах, но не пропускаем кабель
            if (!sourceElement) {
              console.warn(`Не удалось определить источник для кабеля ID: ${row.ID}. Кабель будет импортирован без источника.`);
            }
            if (!targetElement) {
              console.warn(`Не удалось определить назначение для кабеля ID: ${row.ID}. Кабель будет импортирован без назначения.`);
            }

            return {
              id: row.ID || Math.max(...(cables.map(c => c.id).concat(jsonData.map(r => r.ID))), 0) + 1,
              sourceElement: sourceElement || { type: 'box', id: 0 }, // Заглушка если не найден
              targetElement: targetElement || null, // null если не найден
              fiberCount: row.Волоконность || 4,
              layingType: row['Тип прокладки'] || 'подвес',
              points: points,
              status: importedStatus,
              model: importedModel,
              sewerageWorkDetails: importedSewerageWorkDetails,
              oltTerminalNo: row['№ терминала (OLT)'] || '',
              oltPortNo: row['№ порта (OLT Port)'] || '',
              actualCableLength: parseFloat(row['Длина кабеля (факт)'] || 0),
              actualMarkA: parseFloat(row['Метка А (факт)'] || 0),
              actualMarkB: parseFloat(row['Метка Б (факт)'] || 0),
              actualWorkMetConst: parseFloat(row['по мет. конст. (факт)'] || 0),
              actualWorkTK: parseFloat(row['по т/к (факт)'] || 0),
              actualWorkInGround: parseFloat(row['в грунте (факт)'] || 0),
              actualWorkExitLKS: parseFloat(row['выход из ЛКС (факт)'] || 0),
              actualWorkSuspension: parseFloat(row['подвес (факт)'] || 0),
              actualWorkOnWall: parseFloat(row['по стене (факт)'] || 0),
              actualWorkOnRiser: parseFloat(row['по стояку (факт)'] || 0),
            };
          }).filter(Boolean); // Отфильтровываем null значения (пропущенные строки)

          setCables(newCables as Cable[]);
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

  // НОВАЯ ФУНКЦИЯ: для удаления бокса
  const handleDeleteBox = (boxId: number) => {
    // Удаляем бокс из массива боксов
    const updatedBoxes = boxes.filter(box => box.id !== boxId);
    setBoxes(updatedBoxes);
    
    // Закрываем окно деталей бокса
    setSelectedElement(null);
    
    // Удаляем все кабели, связанные с этим боксом
    const updatedCables = cables.filter(cable => 
      cable.sourceElement.id !== boxId && cable.targetElement?.id !== boxId
    );
    setCables(updatedCables);
  };

  // НОВАЯ ФУНКЦИЯ: для удаления кабеля
  const handleDeleteCable = (cableId: number) => {
    // Удаляем кабель из массива кабелей
    const updatedCables = cables.filter(cable => cable.id !== cableId);
    setCables(updatedCables);
    
    // Если удаленный кабель был выбран, сбрасываем выбор
    if (selectedElement?.type === 'cable' && selectedElement.id === cableId) {
      setSelectedElement(null);
    }

    // Также нужно удалить все внутренние и внешние соединения, связанные с этим кабелем
    // Удаляем внешние соединения, где участвует этот кабель
    const updatedFiberConnections = fiberConnections.filter(conn => {
      // Проверяем, является ли одно из концов соединением с волокном данного кабеля
      const isEnd1ThisCableFiber = conn.end1.type === 'cableFiber' && parseInt(conn.end1.cableId) === cableId;
      const isEnd2ThisCableFiber = conn.end2.type === 'cableFiber' && parseInt(conn.end2.cableId) === cableId;
      return !(isEnd1ThisCableFiber || isEnd2ThisCableFiber);
    });
    setFiberConnections(updatedFiberConnections);

    // Удаляем внутренние соединения в боксах, где участвует этот кабель
    setBoxes(prevBoxes => prevBoxes.map(box => {
      const updatedInternalConnections = box.internalFiberConnections.filter(internalConn => {
        const isInternalEnd1ThisCableFiber = internalConn.end1.type === 'cableFiber' && parseInt(internalConn.end1.cableId) === cableId;
        const isInternalEnd2ThisCableFiber = internalConn.end2.type === 'cableFiber' && parseInt(internalConn.end2.cableId) === cableId;
        return !(isInternalEnd1ThisCableFiber || isInternalEnd2ThisCableFiber);
      });
      // Также очищаем ссылки на удаленный кабель в box.connections
      const newBoxConnections = { ...box.connections };
      if (newBoxConnections.input?.cableId === cableId) {
        newBoxConnections.input = null;
      }
      newBoxConnections.outputs = newBoxConnections.outputs.map(output => 
        output?.cableId === cableId ? null : output
      );

      return {
        ...box,
        internalFiberConnections: updatedInternalConnections,
        connections: newBoxConnections
      };
    }));
  };

  // НОВЫЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ для проектных расчетов
  const WORK_TYPE_LABELS = {
    'actualWorkMetConst': 'по мет. конст.',
    'actualWorkTK': 'по т/к',
    'actualWorkInGround': 'в грунте',
    'actualWorkExitLKS': 'выход из ЛКС',
    'actualWorkSuspension': 'подвес',
    'actualWorkOnWall': 'по стене',
    'actualWorkOnRiser': 'по стояку',
  };

  const handleUpdateProjectedReserve = (cableId: number, workTypeLabel: string, value: number) => {
    setProjectedCableWork(prev => ({
      ...prev,
      [cableId]: {
        ...(prev[cableId] || {}),
        [workTypeLabel]: {
          ...(prev[cableId]?.[workTypeLabel] || { reserve: 0, sections: [] }),
          reserve: value,
        },
      },
    }));
  };

  const handleAddProjectedSection = (cableId: number, workTypeLabel: string) => {
    setProjectedCableWork(prev => {
      const currentCableWorks = prev[cableId] || {};
      const currentWorkTypeDetails = currentCableWorks[workTypeLabel];

      if (!currentWorkTypeDetails) {
        // Если нет деталей для этого типа работ, инициализируем их и показываем
        return {
          ...prev,
          [cableId]: {
            ...currentCableWorks,
            [workTypeLabel]: { reserve: 0, sections: [], showDetails: true }, // Инициализируем с showDetails: true
          },
        };
      } else {
        // Если детали уже существуют, добавляем новый участок и убеждаемся, что они показаны
        return {
          ...prev,
          [cableId]: {
            ...currentCableWorks,
            [workTypeLabel]: {
              ...currentWorkTypeDetails,
              sections: [...currentWorkTypeDetails.sections, 0],
              showDetails: true, // Убеждаемся, что видимость включена
            },
          },
        };
      }
    });
  };

  const handleUpdateProjectedSection = (cableId: number, workTypeLabel: string, sectionIdx: number, value: number) => {
    setProjectedCableWork(prev => {
      const currentWork = prev[cableId]?.[workTypeLabel];
      if (!currentWork) return prev;

      const newSections = [...currentWork.sections];
      newSections[sectionIdx] = value;
      return {
        ...prev,
        [cableId]: {
          ...(prev[cableId] || {}),
          [workTypeLabel]: {
            ...currentWork,
            sections: newSections,
          },
        },
      };
    });
  };

  const handleRemoveProjectedSection = (cableId: number, workTypeLabel: string, sectionIdx: number) => {
    setProjectedCableWork(prev => {
      const currentWork = prev[cableId]?.[workTypeLabel];
      if (!currentWork) return prev;

      const newSections = currentWork.sections.filter((_, idx) => idx !== sectionIdx);
      return {
        ...prev,
        [cableId]: {
          ...(prev[cableId] || {}),
          [workTypeLabel]: {
            ...currentWork,
            sections: newSections,
          },
        },
      };
    });
  };

  const calculateProjectedTotal = (cableId: number, workTypeLabel: string) => {
    const workDetails = projectedCableWork[cableId]?.[workTypeLabel];
    if (!workDetails) return 0;
    const totalSectionsSum = workDetails.sections.reduce((sum, val) => sum + val, 0);
    const baseTotal = workDetails.reserve + totalSectionsSum;

    // НОВАЯ ФОРМУЛА РАСЧЕТА: только для "по т/к"
    if (workTypeLabel === 'по т/к') {
      const numberOfSections = workDetails.sections.length; // Количество участков
      return (baseTotal * 1.057) + numberOfSections;
    }
    // НОВАЯ ФОРМУЛА РАСЧЕТА: только для "подвес"
    if (workTypeLabel === 'подвес') {
      return baseTotal * 1.027;
    }
    return baseTotal; // Для всех остальных типов работ возвращаем просто сумму
  };

  // НОВАЯ ФУНКЦИЯ: Удалить запас (с возможностью свернуть раздел)
  const handleRemoveProjectedReserve = (cableId: number, workTypeLabel: string) => {
    setProjectedCableWork(prev => {
      const currentCableWorks = { ...(prev[cableId] || {}) };
      const currentWorkTypeDetails = currentCableWorks[workTypeLabel];

      if (!currentWorkTypeDetails) return prev; 

      // Устанавливаем запас в 0
      const updatedWorkTypeDetails = { ...currentWorkTypeDetails, reserve: 0, showDetails: currentWorkTypeDetails.showDetails }; // Сохраняем состояние showDetails

      // Если после сброса запаса нет и участков, то удаляем весь тип работ
      if (updatedWorkTypeDetails.reserve === 0 && updatedWorkTypeDetails.sections.length === 0) {
        const newCableWorks = { ...currentCableWorks };
        delete newCableWorks[workTypeLabel]; // Удаляем запись для данного типа работ
        return {
          ...prev,
          [cableId]: newCableWorks,
        };
      } else {
        // Иначе просто обновляем запас
        return {
          ...prev,
          [cableId]: {
            ...currentCableWorks,
            [workTypeLabel]: updatedWorkTypeDetails,
          },
        };
      }
    });
  };

  // НОВАЯ ФУНКЦИЯ: Переключение видимости деталей для конкретного вида работ
  const handleToggleProjectedWorkDetails = (cableId: number, workTypeLabel: string) => {
    setProjectedCableWork(prev => {
      const currentCableWorks = { ...(prev[cableId] || {}) };
      const currentWorkTypeDetails = currentCableWorks[workTypeLabel];

      if (!currentWorkTypeDetails) {
        // Если деталей нет, создаем их и показываем
        return {
          ...prev,
          [cableId]: {
            ...currentCableWorks,
            [workTypeLabel]: { reserve: 0, sections: [], showDetails: true },
          },
        };
      } else {
        // Иначе просто переключаем showDetails
        return {
          ...prev,
          [cableId]: {
            ...currentCableWorks,
            [workTypeLabel]: {
              ...currentWorkTypeDetails,
              showDetails: !currentWorkTypeDetails.showDetails,
            },
          },
        };
      }
    });
  };

  // НОВАЯ ФУНКЦИЯ: Определяет, какую длину кабеля отображать на карте (приоритет: факт > проект > трасса)
  const getDisplayCableLength = (cable: Cable): string => {
    // 1. Проверяем фактическую длину
    const actualTotalLength = (cable.actualWorkMetConst || 0) +
                              (cable.actualWorkTK || 0) +
                              (cable.actualWorkInGround || 0) +
                              (cable.actualWorkExitLKS || 0) +
                              (cable.actualWorkSuspension || 0) +
                              (cable.actualWorkOnWall || 0) +
                              (cable.actualWorkOnRiser || 0);

    if (actualTotalLength > 0) {
        return `${Math.ceil(actualTotalLength).toFixed(1)} м`; // Округляем вверх до целого, показываем .0
    }

    // 2. Если фактической нет, проверяем проектную
    const projectedOverallTotal = Object.keys(WORK_TYPE_LABELS).reduce((sum, key) => {
        const label = WORK_TYPE_LABELS[key as keyof typeof WORK_TYPE_LABELS];
        return sum + calculateProjectedTotal(cable.id, label);
    }, 0);

    if (projectedOverallTotal > 0) {
        return `${Math.ceil(projectedOverallTotal).toFixed(1)} м`; // Округляем вверх до целого, показываем .0
    }

    // 3. Если ни фактической, ни проектной нет, всегда показываем "0.0 м"
    return `0.0 м`;
  };

  // НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ СПЕЦИФИКАЦИИ МАТЕРИАЛОВ
  interface MaterialItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
  }

  interface MaterialCategory {
    id: string;
    name: string;
    items: MaterialItem[];
  }

  // ФУНКЦИЯ ДЛЯ ПОДСЧЕТА МАТЕРИАЛОВ (ОБНОВЛЕНО: с группировкой и фильтрацией по статусу)
  const calculateMaterials = (): MaterialCategory[] => {
    // Вспомогательная функция для агрегации (группировки) материалов
    const aggregateItems = (items: MaterialItem[]): MaterialItem[] => {
      const aggregatedMap = new Map<string, MaterialItem>(); // Key: item.name

      items.forEach(item => {
        if (aggregatedMap.has(item.name)) {
          const existingItem = aggregatedMap.get(item.name)!;
          // Суммируем количество, если единица измерения одинакова
          if (existingItem.unit === item.unit) {
            existingItem.quantity += item.quantity;
          } else {
            // Если единицы измерения разные, это должно быть обработано отдельно
            // В данном случае, пока просто добавим как отдельный элемент
            // Можно добавить логирование или более сложную логику, если нужно.
            aggregatedMap.set(`${item.name}-${item.id}`, item); // Добавляем с уникальным ID для избежания конфликта ключей
          }
        } else {
          aggregatedMap.set(item.name, { ...item }); // Делаем копию, чтобы не менять исходный объект
        }
      });
      // Преобразуем Map обратно в массив
      return Array.from(aggregatedMap.values());
    };

    // Категория "Боксы"
    const boxItems: MaterialItem[] = boxes
      .filter(box => box.status !== 'existing') // Исключаем существующие боксы
      .map(box => ({
        id: `box-${box.id}`, // Временно, будет заменено после агрегации
        name: box.model,
        quantity: 1,
        unit: 'шт.'
      }));
    const boxesCategory: MaterialCategory = {
      id: 'boxes',
      name: 'Боксы',
      items: aggregateItems(boxItems)
    };

    // Категория "Сплиттеры"
    const splitterItems: MaterialItem[] = boxes
      .filter(box => box.status !== 'existing') // Исключаем сплиттеры из существующих боксов
      .flatMap(box =>
        box.splitters.map(splitter => ({
          id: `splitter-${splitter.id}`, // Временно
          name: `Сплиттер ${splitter.type} ${splitter.connectorType || 'без коннектора'}`,
          quantity: 1,
          unit: 'шт.'
        }))
      );
    const splittersCategory: MaterialCategory = {
      id: 'splitters',
      name: 'Сплиттеры',
      items: aggregateItems(splitterItems)
    };

    // Категория "Кабели"
    const cableItems: MaterialItem[] = cables
      .filter(cable => cable.status !== 'existing') // Исключаем существующие кабели
      .map(cable => ({
        id: `cable-${cable.id}`, // Временно
        name: `${cable.model} ${cable.fiberCount} волокон`,
        quantity: calculateProjectedTotal(cable.id, 'по мет. конст.') + // Добавляем все проектные работы
                  calculateProjectedTotal(cable.id, 'по т/к') +
                  calculateProjectedTotal(cable.id, 'в грунте') +
                  calculateProjectedTotal(cable.id, 'выход из ЛКС') +
                  calculateProjectedTotal(cable.id, 'подвес') +
                  calculateProjectedTotal(cable.id, 'по стене') +
                  calculateProjectedTotal(cable.id, 'по стояку'),
        unit: 'м'
      }));
    const cablesCategory: MaterialCategory = {
      id: 'cables',
      name: 'Кабели',
      // Для кабелей, вместо quantity: 1, мы используем суммарную проектную длину
      // и агрегируем их по названию, чтобы получить общую длину для каждой марки
      items: aggregateItems(cableItems)
    };

    return [boxesCategory, splittersCategory, cablesCategory];
  };

  // КОМПОНЕНТ ДЛЯ ОТОБРАЖЕНИЯ СПЕЦИФИКАЦИИ
  const MaterialsSpecification = () => {
    const materials = calculateMaterials();

    return (
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}> {/* Добавляем overflowY и flex: 1 */}
        <h2 style={{ marginBottom: '20px' }}>Спецификация материалов</h2>
        
        {materials.map(category => (
          <div key={category.id} style={{ marginBottom: '30px' }}>
            <h3 style={{ 
              backgroundColor: '#094961', 
              color: 'white', 
              padding: '10px',
              marginBottom: '15px',
              borderRadius: '4px'
            }}>
              {category.name}
            </h3>
            
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Наименование</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #ddd', width: '100px' }}>Количество</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd', width: '80px' }}>Ед. изм.</th>
                </tr>
              </thead>
              <tbody>
                {category.items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{item.name}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{item.unit === 'м' ? item.quantity.toFixed(2) : item.quantity}</td>{/* Форматируем метры */}
                    <td style={{ padding: '10px' }}>{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  };

  // НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ СПЕЦИФИКАЦИИ РАБОТ
  interface WorkItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
  }

  interface WorkCategory {
    id: string;
    name: string;
    items: WorkItem[];
  }

  // ФУНКЦИЯ ДЛЯ ПОДСЧЕТА РАБОТ
  const calculateWorks = (): WorkCategory[] => {
    const categories: WorkCategory[] = [];

    // Вспомогательная функция для агрегации (группировки) элементов работ
    const aggregateWorkItems = (items: WorkItem[]): WorkItem[] => {
      const aggregatedMap = new Map<string, WorkItem>();

      items.forEach(item => {
        if (aggregatedMap.has(item.name)) {
          const existingItem = aggregatedMap.get(item.name)!;
          if (existingItem.unit === item.unit) {
            existingItem.quantity += item.quantity;
          } else {
            // Если единицы измерения разные, добавляем как отдельный элемент
            // Или если название уже уникальное (как для агрегированных кабельных работ), просто добавляем.
            aggregatedMap.set(`${item.name}-${item.id}`, item);
          }
        } else {
          aggregatedMap.set(item.name, { ...item }); // Делаем копию, чтобы не менять исходный объект
        }
      });
      return Array.from(aggregatedMap.values());
    };

    // 1. Работы по боксам
    const projectedBoxes = boxes.filter(box => box.status === 'projected');
    const boxWorks: WorkItem[] = [
      {
        id: 'box-installation',
        name: 'Установка бокса',
        quantity: projectedBoxes.length,
        unit: 'шт.'
      }
    ];
    categories.push({ id: 'box-works', name: 'Работы по боксам', items: aggregateWorkItems(boxWorks) });

    // 2. Работы по сплиттерам
    // ИЗМЕНЕНИЕ: Убираем фильтрацию по статусу бокса, чтобы считать ВСЕ сплиттеры
    const allSplitters = boxes.flatMap(box => box.splitters);

    const splittersWithoutConnector: Record<Splitter['type'], number> = {
      '1x2': 0, '1x4': 0, '1x8': 0, '1x16': 0
    };
    let totalSplittersWithConnector = 0;

    allSplitters.forEach(splitter => { // Используем allSplitters
      if (splitter.connectorType === null) {
        // Сплиттеры без коннектора, подсчитываем по каждому типу
        splittersWithoutConnector[splitter.type] += 1;
      } else {
        // Сплиттеры с коннектором, считаем общее количество
        totalSplittersWithConnector += 1;
      }
    });

    const splitterWorksItems: WorkItem[] = [];
    Object.entries(splittersWithoutConnector).forEach(([type, count]) => {
      if (count > 0) {
        splitterWorksItems.push({
          id: `splitter-no-conn-${type}`,
          name: `Монтаж сплиттера ${type} (без коннектора)`,
          quantity: count,
          unit: 'шт.'
        });
      }
    });
    if (totalSplittersWithConnector > 0) {
      splitterWorksItems.push({
        id: 'splitter-with-conn-total',
        name: 'Монтаж сплиттера (с коннектором)',
        quantity: totalSplittersWithConnector,
        unit: 'шт.'
      });
    }
    categories.push({ id: 'splitter-works', name: 'Работы по сплиттерам', items: aggregateWorkItems(splitterWorksItems) });

    // 3. Работы по кабелю (ОБНОВЛЕНО: детализация по видам работ и приоритет факт/проект)
    const projectedCables = cables.filter(cable => cable.status === 'projected');

    // Карта для хранения суммарных длин по марке кабеля и типу работы
    const cableModelWorkBreakdown = new Map<string, Record<string, number>>(); // Map<model, Map<workTypeLabel, totalLength>>

    projectedCables.forEach(cable => {
      const model = cable.model;
      if (!cableModelWorkBreakdown.has(model)) {
        cableModelWorkBreakdown.set(model, {});
      }
      const modelBreakdown = cableModelWorkBreakdown.get(model)!;

      Object.keys(WORK_TYPE_LABELS).forEach(key => {
        const label = WORK_TYPE_LABELS[key as keyof typeof WORK_TYPE_LABELS];
        
        let workLengthForType = 0;

        // Приоритет: фактическая длина для данного типа работы, если есть и больше 0
        const actualWorkKey = key as keyof Cable; // Например: 'actualWorkMetConst'
        if (typeof cable[actualWorkKey] === 'number' && (cable[actualWorkKey] as number) > 0) {
          workLengthForType = cable[actualWorkKey] as number;
        } else {
          // Иначе используем проектную длину (которая включает специфичные множители)
          workLengthForType = calculateProjectedTotal(cable.id, label);
        }

        if (workLengthForType > 0) {
          modelBreakdown[label] = (modelBreakdown[label] || 0) + workLengthForType;
        }
      });
    });

    const cableWorksItems: WorkItem[] = [];
    cableModelWorkBreakdown.forEach((breakdown, model) => {
      let totalLengthForModel = 0;
      const breakdownParts: string[] = [];

      Object.entries(breakdown)
        .filter(([, quantity]) => quantity > 0) // Фильтруем нулевые значения
        .forEach(([workType, quantity]) => {
          totalLengthForModel += quantity;
          breakdownParts.push(`${workType}: ${quantity.toFixed(1)} м`);
        });

      const name = `Прокладка кабеля (${model}), общая длина: ${totalLengthForModel.toFixed(1)} м` +
                   (breakdownParts.length > 0 ? ` (из них: ${breakdownParts.join(', ')})` : '');
      
      if (totalLengthForModel > 0) { // Добавляем только если есть общая длина
        cableWorksItems.push({
          id: `cable-work-summary-${model}`, // Уникальный ID для агрегированной строки
          name: name,
          quantity: totalLengthForModel, // Общее количество для этой строки
          unit: 'м'
        });
      }
    });

    // Применяем aggregateWorkItems, хотя для детальных кабельных работ это может не изменить список,
    // так как 'name' уже будет уникальным для каждой модели с её разбивкой.
    categories.push({ id: 'cable-works', name: 'Работы по кабелю', items: aggregateWorkItems(cableWorksItems) });

    return categories;
  };

  // КОМПОНЕНТ ДЛЯ ОТОБРАЖЕНИЯ СПЕЦИФИКАЦИИ РАБОТ
  const WorksSpecification = () => {
    const works = calculateWorks();

    return (
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}> {/* Добавляем overflowY и flex: 1 */}
        <h2 style={{ marginBottom: '20px' }}>Спецификация работ</h2>
        
        {works.map(category => (
          <div key={category.id} style={{ marginBottom: '30px' }}>
            <h3 style={{ 
              backgroundColor: '#094961', 
              color: 'white', 
              padding: '10px',
              marginBottom: '15px',
              borderRadius: '4px'
            }}>
              {category.name}
            </h3>
            
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Наименование работы</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #ddd', width: '120px' }}>Количество</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd', width: '80px' }}>Ед. изм.</th>
                </tr>
              </thead>
              <tbody>
                {category.items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{item.name}</td>
                    {/* Форматируем метры до одного знака после запятой, остальные числа без десятичных */}
                    <td style={{ padding: '10px', textAlign: 'right' }}>{item.unit === 'м' ? item.quantity.toFixed(1) : item.quantity}</td>
                    <td style={{ padding: '10px' }}>{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  };

  // НОВОЕ СОСТОЯНИЕ: для муфт сращивания
  const [spliceClosures, setSpliceClosures] = useState<SpliceClosure[]>([]);
  const [spliceClosuresOpen, setSpliceClosuresOpen] = useState(false);

  // НОВОЕ СОСТОЯНИЕ: для АТС
  const [atsList, setAtsList] = useState<ATS[]>([]);
  const [atsOpen, setAtsOpen] = useState(false);

  

  // НОВЫЕ СОСТОЯНИЯ: для добавления муфт
  const [addSpliceClosureMode, setAddSpliceClosureMode] = useState(false);
  const [newSpliceClosurePosition, setNewSpliceClosurePosition] = useState<[number, number] | null>(null);
  const [spliceClosureParams, setSpliceClosureParams] = useState({ number: "", address: "", place: "" });

  // НОВЫЕ СОСТОЯНИЯ: для добавления АТС
  const [addAtsMode, setAddAtsMode] = useState(false);
  const [newAtsPosition, setNewAtsPosition] = useState<[number, number] | null>(null);
  const [atsParams, setAtsParams] = useState({ number: "", address: "" });

  // Добавляем новые функции здесь
  const handleMapClickSpliceClosure = (position: [number, number]) => {
    if (addSpliceClosureMode) {
      setNewSpliceClosurePosition(position);
      setSpliceClosureParams({ number: "", address: "", place: "" });
    }
  };

  const handleSpliceClosureClick = (spliceClosureId: number, position: [number, number]) => {
    if (addCableMode) {
      if (!cableStart) {
        setCableStart({ elementId: spliceClosureId, elementType: 'spliceClosure', position });
        setCablePoints([position]);
        setCableEnd(null);
      } else if (!cableEnd && spliceClosureId !== cableStart.elementId) {
        setCablePoints(points => [...points, position]);
        setCableEnd({ elementId: spliceClosureId, elementType: 'spliceClosure', position });
        setShowCableParamsModal(true);
        setNewCableParams({ fiberCount: 12, layingType: 'подвес' });
      }
    } else {
      setSelectedElement({ type: 'spliceClosure', id: spliceClosureId });
    }
  };

  // НОВАЯ ФУНКЦИЯ: сохранение муфты
  const handleSaveSpliceClosure = () => {
    if (!newSpliceClosurePosition) {
      return;
    }

    const newSpliceClosure: SpliceClosure = {
      id: Date.now(), // Уникальный ID
      position: newSpliceClosurePosition,
      number: spliceClosureParams.number,
      address: spliceClosureParams.address,
      place: spliceClosureParams.place,
      connections: {
        input: null,
        outputs: []
      },
      splitters: [],
      internalFiberConnections: [],
      status: 'projected', // По умолчанию проектируемая
      oltTerminalNo: '',
      oltPortNo: '',
      model: 'FOSC-A4-S12' // По умолчанию
    };

    setSpliceClosures(prev => [...prev, newSpliceClosure]);
    
    // Сброс состояния
    setNewSpliceClosurePosition(null);
    setAddSpliceClosureMode(false);
    setSpliceClosureParams({ number: "", address: "", place: "" });
  };

  // НОВАЯ ФУНКЦИЯ: выбор муфты
  const handleSelectSpliceClosure = (spliceClosureId: number) => {
    setSelectedElement({ type: 'spliceClosure', id: spliceClosureId });
  };

  // Компонент SpliceClosureDetailDialog импортируется из отдельного файла

  // Добавить состояние для отображения деталей муфты
  const [showSpliceClosureDetails, setShowSpliceClosureDetails] = useState(false);

  // Добавить функции для обновления сплиттеров и соединений муфты
  const handleUpdateSpliceClosureSplitters = (spliceClosureId: number, newSplitters: Splitter[]) => {
    setSpliceClosures(prev => prev.map(sc => 
      sc.id === spliceClosureId ? { ...sc, splitters: newSplitters } : sc
    ));
  };

  const handleUpdateSpliceClosureInternalConnections = (spliceClosureId: number, newConnections: InternalConnection[]) => {
    setSpliceClosures(prev => prev.map(sc => 
      sc.id === spliceClosureId ? { ...sc, internalFiberConnections: newConnections } : sc
    ));
  };

  // Добавить обработчик двойного клика для открытия детального диалога
  const handleSpliceClosureDblClick = (spliceClosureId: number) => {
    setSelectedElement({ type: 'spliceClosure', id: spliceClosureId });
    setShowSpliceClosureDetails(true);
  };

  const handleSpliceClosurePropertyChange = (field: keyof SpliceClosure, value: any) => {
    if (selectedElement?.type === 'spliceClosure') {
        const id = selectedElement.id;
        setSpliceClosures(prev => prev.map(sc => 
            sc.id === id ? { ...sc, [field]: value } : sc
        ));
    }
  };

  const handleDeleteSpliceClosure = (spliceClosureId: number) => {
    // Удаляем муфту
    setSpliceClosures(prev => prev.filter(sc => sc.id !== spliceClosureId));
    
    // Удаляем связанные кабели
    setCables(prev => prev.filter(cable => 
      !(cable.sourceElement?.type === 'spliceClosure' && cable.sourceElement.id === spliceClosureId) &&
      !(cable.targetElement?.type === 'spliceClosure' && cable.targetElement.id === spliceClosureId)
    ));
    
    // Сбрасываем выделение, если была выбрана удаляемая муфта
    if (selectedElement?.type === 'spliceClosure' && selectedElement.id === spliceClosureId) {
      setSelectedElement(null);
    }
  };

  // НОВЫЙ ОБРАБОТЧИК: для изменения свойств АТС
  const handleAtsPropertyChange = (field: keyof ATS, value: any) => {
    setAtsList(prev => prev.map(ats => 
      ats.id === selectedElement?.id ? { ...ats, [field]: value } : ats
    ));
  };

  // НОВЫЙ ОБРАБОТЧИК: для удаления АТС
  const handleDeleteAts = (atsId: number) => {
    // Удаляем АТС
    setAtsList(prev => prev.filter(ats => ats.id !== atsId));
    
    // Удаляем связанные кабели
    setCables(prev => prev.filter(cable => 
      !(cable.sourceElement?.type === 'ats' && cable.sourceElement.id === atsId) &&
      !(cable.targetElement?.type === 'ats' && cable.targetElement.id === atsId)
    ));
    
    // Сбрасываем выделение, если была выбрана удаляемая АТС
    if (selectedElement?.type === 'ats' && selectedElement.id === atsId) {
              setSelectedElement(null);
          }
  };

  // НОВЫЕ ФУНКЦИИ: для добавления АТС
  const handleMapClickAts = (position: [number, number]) => {
    if (addAtsMode) {
      setNewAtsPosition(position);
      setAtsParams({ number: "", address: "" });
    }
  };

  const handleAtsClick = (atsId: number, position: [number, number]) => {
    if (addCableMode) {
      if (!cableStart) {
        setCableStart({ elementId: atsId, elementType: 'ats', position });
        setCablePoints([position]);
        setCableEnd(null);
      } else if (!cableEnd && atsId !== cableStart.elementId) {
        setCablePoints(points => [...points, position]);
        setCableEnd({ elementId: atsId, elementType: 'ats', position });
        setShowCableParamsModal(true);
        setNewCableParams({ fiberCount: 12, layingType: 'подвес' });
      }
    } else {
      setSelectedElement({ type: 'ats', id: atsId });
    }
  };

  const handleSaveAts = () => {
    if (!newAtsPosition) {
      return;
    }

    const newAts: ATS = {
      id: Date.now(), // Уникальный ID
      position: newAtsPosition,
      number: atsParams.number,
      address: atsParams.address,
      status: 'projected', // По умолчанию проектируемая
      connections: {
        input: null,
        outputs: []
      },
      splitters: [],
      terminals: [],
      internalFiberConnections: []
    };

    setAtsList(prev => [...prev, newAts]);
    
    // Сброс состояния
    setNewAtsPosition(null);
    setAddAtsMode(false);
    setAtsParams({ number: "", address: "" });
  };

  // Добавить состояние для отображения деталей муфты
  //const [showSpliceClosureDetails, setShowSpliceClosureDetails] = useState(false);

  // НОВОЕ СОСТОЯНИЕ: для отображения деталей АТС
  const [showAtsDetails, setShowAtsDetails] = useState(false);

  // НОВЫЙ ОБРАБОТЧИК: двойного клика для АТС
  const handleAtsDblClick = (atsId: number) => {
    setSelectedElement({ type: 'ats', id: atsId });
    setShowAtsDetails(true);
  };

  // НОВЫЕ ФУНКЦИИ: для обновления сплиттеров и соединений АТС
  const handleUpdateAtsSplitters = (atsId: number, newSplitters: Splitter[]) => {
    setAtsList(prev => prev.map(ats => 
      ats.id === atsId ? { ...ats, splitters: newSplitters } : ats
    ));
  };

  const handleUpdateAtsInternalConnections = (atsId: number, newConnections: InternalConnection[]) => {
    setAtsList(prev => prev.map(ats => 
      ats.id === atsId ? { ...ats, internalFiberConnections: newConnections } : ats
    ));
  };

  // НОВАЯ ФУНКЦИЯ: для обновления терминалов АТС
  const handleUpdateAtsTerminals = (atsId: number, newTerminals: Terminal[]) => {
    setAtsList(prev => prev.map(ats => 
      ats.id === atsId ? { ...ats, terminals: newTerminals } : ats
    ));
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

                {/* АТС */}
                <div style={{ marginBottom: 15 }}>
                  <b onClick={() => setAtsOpen(!atsOpen)} style={{ cursor: 'pointer', display: 'block', padding: '5px 0' }}>
                    АТС ({atsList.length})
                  </b>
                  {atsOpen && (
                    <ul style={{ listStyle: 'none', paddingLeft: 15, margin: 0 }}>
                      {atsList.map(ats => (
                        <li
                          key={ats.id}
                          onClick={() => setSelectedElement({ type: 'ats', id: ats.id })}
                          onDoubleClick={() => handleAtsDblClick(ats.id)}
                          style={{
                            cursor: 'pointer',
                            padding: '3px 0',
                            color: selectedElement?.type === 'ats' && selectedElement.id === ats.id ? '#0070c0' : '#333',
                            fontWeight: selectedElement?.type === 'ats' && selectedElement.id === ats.id ? 'bold' : 'normal'
                          }}
                        >
                          №{ats.number || 'Без номера'} ({ats.position[0].toFixed(5)}, {ats.position[1].toFixed(5)})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

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

                                {/* Муфты */}
                                <div style={{ marginBottom: 15 }}>
                  <b onClick={handleToggleSpliceClosures} style={{ cursor: 'pointer', display: 'block', padding: '5px 0' }}>
                    Муфты ({spliceClosures.length})
                  </b>
                  {spliceClosuresOpen && (
                    <ul style={{ listStyle: 'none', paddingLeft: 15, margin: 0 }}>
                      {spliceClosures.map(spliceClosure => (
                        <li
                          key={spliceClosure.id}
                          onClick={() => handleSelectSpliceClosure(spliceClosure.id)}
                          style={{
                            cursor: 'pointer',
                            padding: '3px 0',
                            color: selectedElement?.type === 'spliceClosure' && selectedElement.id === spliceClosure.id ? '#0070c0' : '#333',
                            fontWeight: selectedElement?.type === 'spliceClosure' && selectedElement.id === spliceClosure.id ? 'bold' : 'normal'
                          }}
                        >
                          №{spliceClosure.number || 'Без номера'} ({spliceClosure.position[0].toFixed(5)}, {spliceClosure.position[1].toFixed(5)})
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
              {/* Тулбар */}
              <Toolbar
                onAddAts={() => {
                  setAddAtsMode(!addAtsMode);
                  setAddBoxMode(false);
                  setAddCableMode(false);
                  setAddPoleMode(false);
                  setAddWellMode(false);
                  setAddSpliceClosureMode(false);
                }}
                atsMode={addAtsMode}
                onAddBox={() => {
                  setAddBoxMode(!addBoxMode);
                  setAddAtsMode(false);
                  setAddCableMode(false);
                  setAddPoleMode(false);
                  setAddWellMode(false);
                  setAddSpliceClosureMode(false);
                }}
                addBoxMode={addBoxMode}
                onAddCable={() => {
                  setAddCableMode(!addCableMode);
                  setAddAtsMode(false);
                  setAddBoxMode(false);
                  setAddPoleMode(false);
                  setAddWellMode(false);
                  setAddSpliceClosureMode(false);
                }}
                cableMode={addCableMode}
                onAddPole={() => {
                  setAddPoleMode(!addPoleMode);
                  setAddAtsMode(false);
                  setAddBoxMode(false);
                  setAddCableMode(false);
                  setAddWellMode(false);
                  setAddSpliceClosureMode(false);
                }}
                poleMode={addPoleMode}
                onAddWell={() => {
                  setAddWellMode(!addWellMode);
                  setAddAtsMode(false);
                  setAddBoxMode(false);
                  setAddCableMode(false);
                  setAddPoleMode(false);
                  setAddSpliceClosureMode(false);
                }}
                wellMode={addWellMode}
                onAddSpliceClosure={() => {
                  setAddSpliceClosureMode(!addSpliceClosureMode);
                  setAddAtsMode(false);
                  setAddBoxMode(false);
                  setAddCableMode(false);
                  setAddPoleMode(false);
                  setAddWellMode(false);
                }}
                spliceClosureMode={addSpliceClosureMode}
              />
              <MapContainer
                center={[50.45086, 30.52281]} // Координаты центра карты (Киев)
                zoom={16}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false} // Отключаем дефолтный ZoomControl
              >
                <ScaleControl position="bottomright" /> {/* Полоса масштаба внизу справа */}
                <ZoomControl position="bottomright" /> {/* Кнопки масштабирования внизу справа, добавленные нами */}

                <AddBoxOnMap onMapClick={handleMapClick} enabled={addBoxMode} />
                <AddCableOnMap
                  onMapClick={handleCableMapClick}
                  enabled={addCableMode && !!cableStart && !cableEnd}
                />
                <AddPoleOnMap onMapClick={handleMapClickPole} enabled={addPoleMode} />
                <AddWellOnMap onMapClick={handleMapClickWell} enabled={addWellMode} />
                
                {/* НОВЫЙ КОМПОНЕНТ: для добавления муфт */}
                <AddSpliceClosureOnMap 
                  onMapClick={handleMapClickSpliceClosure} 
                  enabled={addSpliceClosureMode} 
                />

                {/* НОВЫЙ КОМПОНЕНТ: для добавления АТС */}
                <AddAtsOnMap 
                  onMapClick={handleMapClickAts} 
                  enabled={addAtsMode} 
                />

                <LayersControl position="topleft">
                  <LayersControl.BaseLayer name="OpenStreetMap" checked>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      maxZoom={19}
                    />
                  </LayersControl.BaseLayer>
                  <LayersControl.BaseLayer name="Google Satellite" checked={false}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                      url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                      maxZoom={20}
                    />
                  </LayersControl.BaseLayer>
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
                                  {getDisplayCableLength(cable)} {/* ИСПОЛЬЗУЕМ НОВУЮ ФУНКЦИЮ */}
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
                      {boxes.map((box) => {
                        let label = box.number; // По умолчанию - номер бокса
                        
                        // Ищем сплиттер 3-го уровня
                        const splitterL3 = box.splitters.find(s => s.level === 3);
                        if (splitterL3) {
                          label = splitterL3.type;
                        } else {
                          // Если нет, ищем сплиттер 2-го уровня
                          const splitterL2 = box.splitters.find(s => s.level === 2);
                          if (splitterL2) {
                            label = splitterL2.type;
                          }
                        }

                        return (
                          <React.Fragment key={box.id}>
                            <Marker
                              position={box.position}
                              icon={getBoxIcon(label, box.status)}
                              draggable={true}
                              eventHandlers={{
                                dblclick: () => {
                                  handleMarkerDblClick(box.id);
                                },
                                dragend: (e) => handleMarkerDragEnd(box.id, 'box', e as DragEndEvent),
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
                        );
                      })}
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
                                const newPosition: [number, number] = [lat, lng];
                                
                                // Обновляем позицию опоры
                                setPoles(poles => poles.map(p =>
                                  p.id === pole.id ? { ...p, position: newPosition } : p
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
                                const newPosition: [number, number] = [lat, lng];
                                
                                // Обновляем позицию колодца
                                setWells(wells => wells.map(w =>
                                  w.id === well.id ? { ...w, position: newPosition } : w
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
                  
                  {/* НОВЫЙ СЛОЙ: Муфты */}
                  <LayersControl.Overlay name="Муфты" checked>
                    <LayerGroup>
                      {spliceClosures.map(spliceClosure => (
                        <Marker
                          key={spliceClosure.id}
                          position={spliceClosure.position}
                          icon={getSpliceClosureIcon(spliceClosure.number, spliceClosure.status)}
                          draggable={true}
                          eventHandlers={{
                            click: (e) => {
                              if (addCableMode) {
                                handleSpliceClosureClick(spliceClosure.id, spliceClosure.position);
                              } else {
                                if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                                clickTimeoutRef.current = setTimeout(() => {
                                  handleSelectSpliceClosure(spliceClosure.id);
                                  clickTimeoutRef.current = null;
                                }, 200);
                              }
                            },
                            dblclick: () => handleSpliceClosureDblClick(spliceClosure.id), // Добавить двойной клик
                            dragend: (e) => handleMarkerDragEnd(spliceClosure.id, 'spliceClosure', e)
                          }}
                        />
                      ))}
                    </LayerGroup>
                  </LayersControl.Overlay>

                  {/* НОВЫЙ СЛОЙ: АТС */}
                  <LayersControl.Overlay name="АТС" checked>
                    <LayerGroup>
                      {atsList.map(ats => (
                        <Marker
                          key={ats.id}
                          position={ats.position}
                          icon={getAtsIcon(ats.number, ats.status)}
                          draggable={true}
                          eventHandlers={{
                            click: (e) => {
                              if (addCableMode) {
                                handleAtsClick(ats.id, ats.position);
                              } else {
                                if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                                clickTimeoutRef.current = setTimeout(() => {
                                  setSelectedElement({ type: 'ats', id: ats.id });
                                  clickTimeoutRef.current = null;
                                }, 200);
                              }
                            },
                            dblclick: () => handleAtsDblClick(ats.id), // Добавить двойной клик
                            dragend: (e) => handleMarkerDragEnd(ats.id, 'ats', e)
                          }}
                        />
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

        {activeTab === 'attenuation' && (
          <AttenuationTable
            atsList={atsList}
            boxes={boxes}
            spliceClosures={spliceClosures}
            cables={cables}
            fiberConnections={fiberConnections}
          />
        )}

        {activeTab === 'materials' && (
          <MaterialsSpecification />
        )}

        {activeTab === 'works' && (
          <WorksSpecification />
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
                  <div style={{ marginBottom: 15 }}>
                    <h3 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>Свойства бокса</h3>
                    {/* Обновленный стиль для каждого поля */}
                    {/* Применяем flexbox для каждой строки свойств */}
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Состояние:</label>
                      <select
                        value={box.status}
                        onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, status: e.target.value as Box['status'] } : b))}
                        style={{ flexGrow: 1 }}
                      >
                        <option value="projected">Проектируемый</option>
                        <option value="existing">Существующий</option>
                      </select>
                  </div>
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Номер бокса:</label>
                      <input value={box.number} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, number: e.target.value } : b))} style={{ flexGrow: 1 }} />
                  </div>
                  {/* НОВОЕ ПОЛЕ: Модель бокса */}
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Модель бокса:</label>
                      <select
                        value={box.model}
                        onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, model: e.target.value as Box['model'] } : b))}
                        style={{ flexGrow: 1 }}
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
                  </div>
                  {/* НОВЫЕ ПОЛЯ: № терминала (OLT) и № порта (OLT Port) */}
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>№ терминала (OLT):</label>
                      <input value={box.oltTerminalNo} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, oltTerminalNo: e.target.value } : b))} style={{ flexGrow: 1 }} />
                  </div>
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>№ порта (OLT Port):</label>
                      <input value={box.oltPortNo} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, oltPortNo: e.target.value } : b))} style={{ flexGrow: 1 }} />
                  </div>
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Адрес:</label>
                      <input value={box.address} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, address: e.target.value } : b))} style={{ flexGrow: 1 }} />
                  </div>
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Место установки:</label>
                      <input value={box.place} onChange={e => setBoxes(boxes => boxes.map(b => b.id === box.id ? { ...b, place: e.target.value } : b))} style={{ flexGrow: 1 }} />
                  </div>
                  {/* РАЗДЕЛЕННЫЕ ПОЛЯ: Координаты */}
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Широта:</label>
                      <input value={box.position[0].toFixed(6)} readOnly style={{ flexGrow: 1, color: '#888' }} />
                  </div>
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Долгота:</label>
                      <input value={box.position[1].toFixed(6)} readOnly style={{ flexGrow: 1, color: '#888' }} />
                  </div>

                  {/* НОВАЯ СЕКЦИЯ: Список сплиттеров в боксе */}
                  {box.splitters.length > 0 && (
                    <div style={{ marginTop: 20, borderTop: '1px dashed #eee', paddingTop: 15 }}>
                      <h4 style={{ marginTop: 0, marginBottom: 10 }}>Установленные сплиттеры:</h4>
                      {box.splitters.map((splitter, idx) => (
                        <div key={splitter.id} style={{ marginBottom: 8, fontSize: '13px', lineHeight: '1.4' }}>
                            <strong>Сплиттер {idx + 1}:</strong> Уровень {splitter.level}, Номер: {splitter.number || 'не задан'}, {splitter.connectorType || 'Без коннектора'}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                  {/* НОВАЯ КНОПКА: Удалить бокс */}
                  <button
                    onClick={() => handleDeleteBox(box.id)}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      marginTop: '20px', // Добавляем отступ сверху
                      width: '100%'
                    }}
                  >
                    Удалить бокс
                  </button>
                </>
              );
            })()}
            {selectedElement?.type === 'cable' && (() => {
              const cable = cables.find(c => c.id === selectedElement.id);
              if (!cable) return null;
              return (
                <>
                  <div style={{ marginBottom: 15 }}>
                    <h3 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>Свойства кабеля</h3>
                    
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Состояние:</label>
                      <select
                        value={cable.status}
                        onChange={e => setCables(cables => cables.map(c => 
                          c.id === cable.id ? { ...c, status: e.target.value as Cable['status'] } : c
                        ))}
                        style={{ flexGrow: 1 }}
                      >
                        <option value="projected">Проектируемый</option>
                        <option value="existing">Существующий</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Количество волокон:</label>
                      <select
                        value={cable.fiberCount}
                        onChange={e => {
                          const newFiberCount = parseInt(e.target.value);
                          const defaultModel = CABLE_MODELS[newFiberCount]?.[0] || '';
                          setCables(cables => cables.map(c =>
                            c.id === cable.id ? { ...c, fiberCount: newFiberCount, model: defaultModel } : c
                          ));
                        }}
                        style={{ flexGrow: 1 }}
                      >
                        <option value="4">4</option>
                        <option value="8">8</option>
                        <option value="12">12</option>
                        <option value="24">24</option>
                        <option value="48">48</option>
                        <option value="96">96</option>
                        <option value="144">144</option>
                      </select>
                  </div>

                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Марка кабеля:</label>
                      <select
                        value={cable.model || ''}
                        onChange={e => setCables(cables => cables.map(c => 
                          c.id === cable.id ? { ...c, model: e.target.value } : c
                        ))}
                        style={{ flexGrow: 1 }}
                      >
                        <option value="">Выберите марку</option>
                        {CABLE_MODELS[cable.fiberCount]?.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Тип прокладки:</label>
                      <select
                        value={cable.layingType}
                        onChange={e => setCables(cables => cables.map(c => 
                          c.id === cable.id ? { ...c, layingType: e.target.value as Cable['layingType'] } : c
                        ))}
                        style={{ flexGrow: 1 }}
                      >
                        <option value="подвес">Подвес</option>
                        <option value="канализация">Канализация</option>
                      </select>
                  </div>

                    {/* НОВОЕ ПОЛЕ: № терминала (OLT) */}
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>№ терминала (OLT):</label>
                      <input
                        type="text"
                        value={cable.oltTerminalNo || ''}
                        onChange={e => setCables(cables => cables.map(c => 
                          c.id === cable.id ? { ...c, oltTerminalNo: e.target.value } : c
                        ))}
                        style={{ flexGrow: 1 }}
                      />
                  </div>

                    {/* НОВОЕ ПОЛЕ: № порта (OLT Port) */}
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>№ порта (OLT Port):</label>
                      <input
                        type="text"
                        value={cable.oltPortNo || ''}
                        onChange={e => setCables(cables => cables.map(c => 
                          c.id === cable.id ? { ...c, oltPortNo: e.target.value } : c
                        ))}
                        style={{ flexGrow: 1 }}
                      />
                    </div>

                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                      <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Длина трассы:</label>
                      <input 
                        value={`${calculateCableLength(cable.points).toFixed(2)} м`}
                        readOnly
                        style={{ flexGrow: 1, color: '#888' }}
                      />
                    </div>
                  </div>

                  {/* НОВЫЙ РАЗДЕЛ: Работы по кабелю (проектные расчеты) */}
                  <div style={{
                    marginTop: 20,
                    borderTop: '1px dashed #eee',
                    paddingTop: 15,
                    marginBottom: 15
                  }}>
                    {/* ОБНОВЛЕННЫЙ БЛОК: Заголовок для списка проектных работ и кнопка сворачивания */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '10px',
                      justifyContent: 'center',
                    }}>
                      <h4
                        style={{
                          margin: '0',
                          cursor: 'pointer',
                          width: '100%',
                        }}
                        onClick={() => setShowProjectedWorks(!showProjectedWorks)} // Добавляем обработчик клика
                      >
                        Работы по кабелю (проект) {showProjectedWorks ? '▼' : '►'} {/* Индикатор */}
                      </h4>
                    </div>

                    {/* Условное отображение полей проектных работ */}
                    {showProjectedWorks && (
                      <>
                        {/* НОВОЕ ПОЛЕ: Длина (проект) - вычисляемое */}
                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                          <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Длина (проект):</label>
                          <input
                            type="text"
                            value={`${Object.keys(WORK_TYPE_LABELS).reduce((sum, key) => {
                                const label = WORK_TYPE_LABELS[key as keyof typeof WORK_TYPE_LABELS];
                                return sum + calculateProjectedTotal(cable.id, label);
                            }, 0).toFixed(2)} м`}
                            readOnly
                            style={{ flexGrow: 1, color: '#888', fontWeight: 'bold' }}
                          />
                        </div>

                        {Object.keys(WORK_TYPE_LABELS).map((key) => {
                          const label = WORK_TYPE_LABELS[key as keyof typeof WORK_TYPE_LABELS];
                          const currentProjectedWork = projectedCableWork[cable.id]?.[label];
                          const totalProjected = currentProjectedWork ? calculateProjectedTotal(cable.id, label) : null;

                          return (
                            <div key={key} style={{ marginBottom: 15, border: '1px solid #eee', padding: 10, borderRadius: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                                <label
                                  style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px', cursor: 'pointer' }}
                                  onClick={() => handleToggleProjectedWorkDetails(cable.id, label)}
                                >
                                  {label}: {currentProjectedWork?.showDetails ? '▼' : '►'}
                                </label>
                                <input
                                  type="text"
                                  value={totalProjected !== null ? totalProjected.toFixed(2) + ' м' : '0.00 м'}
                                  readOnly
                                  style={{ flexGrow: 1, color: '#888', fontWeight: 'bold' }}
                                />
                                <button
                                  onClick={() => handleAddProjectedSection(cable.id, label)}
                                  style={{ marginLeft: '10px', padding: '5px 8px', cursor: 'pointer', minWidth: '30px' }}
                                >
                                  +
                                </button>
                              </div>

                              {currentProjectedWork && currentProjectedWork.showDetails && (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5, marginLeft: '10px' }}>
                                    <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Запас:</label>
                                    <input
                                      type="number"
                                      value={currentProjectedWork.reserve}
                                      onChange={e => handleUpdateProjectedReserve(cable.id, label, parseFloat(e.target.value) || 0)}
                                      style={{ flexGrow: 1 }}
                                    />
                                    <button
                                      onClick={() => handleRemoveProjectedReserve(cable.id, label)}
                                      style={{ marginLeft: '10px', padding: '5px 8px', cursor: 'pointer', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', minWidth: '30px' }}
                                    >
                                      -
                                    </button>
                                  </div>

                                  {currentProjectedWork.sections.map((sectionVal, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 5, marginLeft: '10px' }}>
                                      <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Участок {idx + 1}:</label>
                                      <input
                                        type="number"
                                        value={sectionVal}
                                        onChange={e => handleUpdateProjectedSection(cable.id, label, idx, parseFloat(e.target.value) || 0)}
                                        style={{ flexGrow: 1 }}
                                      />
                                      <button
                                        onClick={() => handleRemoveProjectedSection(cable.id, label, idx)}
                                        style={{ marginLeft: '10px', padding: '5px 8px', cursor: 'pointer', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', minWidth: '30px' }}
                                      >
                                        -
                                      </button>
                                    </div>
                                  ))}

                                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5, marginLeft: '10px' }}>
                                      <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Добавить участок:</label>
                                      <button
                                          onClick={() => handleAddProjectedSection(cable.id, label)}
                                          style={{ marginLeft: '10px', padding: '5px 8px', cursor: 'pointer', minWidth: '30px' }}
                                      >
                                          +
                                      </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>

                  {/* НОВЫЙ РАЗДЕЛ: Работы по кабелю */}
                  <div style={{
                    marginTop: 20,
                    borderTop: '1px dashed #eee',
                    paddingTop: 15,
                    marginBottom: 15 // Добавляем отступ снизу для секции
                  }}>
                    {/* ОБНОВЛЕННЫЙ БЛОК: Заголовок для списка фактических работ и кнопка сворачивания */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '10px', // Немного уменьшил отступ
                      justifyContent: 'center', // Центрируем содержимое заголовка
                    }}>
                      <h4 
                        style={{ 
                          margin: '0', 
                          cursor: 'pointer', 
                          width: '100%', // Убедимся, что h4 занимает всю ширину для кликабельности
                        }} 
                        onClick={() => setShowActualWorks(!showActualWorks)}
                      >
                        Работы по кабелю (факт) {showActualWorks ? '▼' : '►'}
                      </h4>
                    </div>
                    
                    {/* Условное отображение полей фактических работ */}
                    {showActualWorks && (
                      <>
                        {/* ФАКТИЧЕСКОЕ ПОЛЕ: Длина кабеля (теперь вычисляемое) */}
                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                          <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Длина (факт):</label>
                          <input
                            type="text" // Изменено на text, так как это теперь отображаемое поле с " м"
                            value={`${((cable.actualWorkMetConst || 0) +
                                      (cable.actualWorkTK || 0) +
                                      (cable.actualWorkInGround || 0) +
                                      (cable.actualWorkExitLKS || 0) +
                                      (cable.actualWorkSuspension || 0) +
                                      (cable.actualWorkOnWall || 0) +
                                      (cable.actualWorkOnRiser || 0)).toFixed(2)} м`}
                            readOnly // Теперь только для чтения
                            style={{ flexGrow: 1, color: '#888', fontWeight: 'bold' }} // Добавим bold, чтобы подчеркнуть, что это итоговое значение
                          />
                        </div>

                        {/* ФАКТИЧЕСКОЕ ПОЛЕ: Метка А */}
                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                          <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Метка А:</label>
                          <input
                            type="number" // Изменено на number
                            value={cable.actualMarkA || 0} // Убедитесь, что значение по умолчанию 0, если undefined
                            onChange={e => setCables(cables => cables.map(c => 
                              c.id === cable.id ? { ...c, actualMarkA: parseFloat(e.target.value) || 0 } : c
                            ))}
                            style={{ flexGrow: 1 }}
                          />
                        </div>

                        {/* ФАКТИЧЕСКОЕ ПОЛЕ: Метка Б */}
                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                          <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>Метка Б:</label>
                          <input
                            type="number" // Изменено на number
                            value={cable.actualMarkB || 0} // Убедитесь, что значение по умолчанию 0, если undefined
                            onChange={e => setCables(cables => cables.map(c => 
                              c.id === cable.id ? { ...c, actualMarkB: parseFloat(e.target.value) || 0 } : c
                            ))}
                            style={{ flexGrow: 1 }}
                          />
                        </div>

                        {/* НОВЫЕ ФАКТИЧЕСКИЕ ПОЛЯ ДЛЯ ВИДОВ РАБОТ */}
                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                          <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>по мет. конст.:</label>
                          <input
                            type="number"
                            value={cable.actualWorkMetConst || 0}
                            onChange={e => setCables(cables => cables.map(c => 
                              c.id === cable.id ? { ...c, actualWorkMetConst: parseFloat(e.target.value) || 0 } : c
                            ))}
                            style={{ flexGrow: 1 }}
                          />
                        </div>

                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                          <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>по т/к:</label>
                          <input
                            type="number"
                            value={cable.actualWorkTK || 0}
                            onChange={e => setCables(cables => cables.map(c => 
                              c.id === cable.id ? { ...c, actualWorkTK: parseFloat(e.target.value) || 0 } : c
                            ))}
                            style={{ flexGrow: 1 }}
                          />
                        </div>

                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                          <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>в грунте:</label>
                          <input
                            type="number"
                            value={cable.actualWorkInGround || 0}
                            onChange={e => setCables(cables => cables.map(c => 
                              c.id === cable.id ? { ...c, actualWorkInGround: parseFloat(e.target.value) || 0 } : c
                            ))}
                            style={{ flexGrow: 1 }}
                          />
                        </div>

                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                          <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>выход из ЛКС:</label>
                          <input
                            type="number"
                            value={cable.actualWorkExitLKS || 0}
                            onChange={e => setCables(cables => cables.map(c => 
                              c.id === cable.id ? { ...c, actualWorkExitLKS: parseFloat(e.target.value) || 0 } : c
                            ))}
                            style={{ flexGrow: 1 }}
                          />
                        </div>

                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                          <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>подвес:</label>
                          <input
                            type="number"
                            value={cable.actualWorkSuspension || 0}
                            onChange={e => setCables(cables => cables.map(c => 
                              c.id === cable.id ? { ...c, actualWorkSuspension: parseFloat(e.target.value) || 0 } : c
                            ))}
                            style={{ flexGrow: 1 }}
                          />
                        </div>

                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                          <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>по стене:</label>
                          <input
                            type="number"
                            value={cable.actualWorkOnWall || 0}
                            onChange={e => setCables(cables => cables.map(c => 
                              c.id === cable.id ? { ...c, actualWorkOnWall: parseFloat(e.target.value) || 0 } : c
                            ))}
                            style={{ flexGrow: 1 }}
                          />
                        </div>

                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                          <label style={{ flexShrink: 0, width: '90px', textAlign: 'right', marginRight: '10px' }}>по стояку:</label>
                          <input
                            type="number"
                            value={cable.actualWorkOnRiser || 0}
                            onChange={e => setCables(cables => cables.map(c => 
                              c.id === cable.id ? { ...c, actualWorkOnRiser: parseFloat(e.target.value) || 0 } : c
                            ))}
                            style={{ flexGrow: 1 }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Кнопка "Удалить кабель" */}
                  <button
                    onClick={() => handleDeleteCable(cable.id)}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      marginTop: '20px',
                      width: '100%'
                    }}
                  >
                    Удалить кабель
                  </button>
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
{selectedElement?.type === 'spliceClosure' && (() => {
              const spliceClosure = spliceClosures.find(sc => sc.id === selectedElement.id);
              if (!spliceClosure) return null;

              const spliceClosureModels: SpliceClosure['model'][] = [
                'FOSC-A4-S08', 'FOSC-A4-S12', 'FOSC-A4-S16', 'FOSC-A4-S24', 
                'FOSC-A8-S08', 'FOSC-A8-S12', 'FOSC-A8-S24', 'FOSC-B4-S24', 
    'FOSC-B8-S24', 'FOSC-C-S12', 'FOSC-AM-04'
              ];

              return (
    <div style={{ padding: '0 0 0 0' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '20px', textAlign: 'center' }}>Свойства муфты</h3>
      {/* FLEXBOX-СТИЛЬ ДЛЯ ВСЕХ ПОЛЕЙ */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Состояние:</label>
                    <select
                      value={spliceClosure.status}
            onChange={e => handleSpliceClosurePropertyChange('status', e.target.value)}
            style={{ flexGrow: 1 }}
                    >
                      <option value="projected">Проектируемый</option>
                      <option value="existing">Существующий</option>
                    </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Номер муфты:</label>
                    <input
                      type="text"
                      value={spliceClosure.number}
            onChange={e => handleSpliceClosurePropertyChange('number', e.target.value)}
            style={{ flexGrow: 1 }}
                    />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Модель муфты:</label>
                    <select
                        value={spliceClosure.model}
            onChange={e => handleSpliceClosurePropertyChange('model', e.target.value)}
            style={{ flexGrow: 1 }}
                    >
                        {spliceClosureModels.map(model => (
                            <option key={model} value={model}>{model}</option>
                        ))}
                    </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>№ терминала (OLT):</label>
                    <input
                      type="text"
                      value={spliceClosure.oltTerminalNo}
            onChange={e => handleSpliceClosurePropertyChange('oltTerminalNo', e.target.value)}
            style={{ flexGrow: 1 }}
                    />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>№ порта (OLT Port):</label>
                    <input
                      type="text"
                      value={spliceClosure.oltPortNo}
            onChange={e => handleSpliceClosurePropertyChange('oltPortNo', e.target.value)}
            style={{ flexGrow: 1 }}
                    />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Адрес:</label>
                    <input
                      type="text"
                      value={spliceClosure.address}
            onChange={e => handleSpliceClosurePropertyChange('address', e.target.value)}
            style={{ flexGrow: 1 }}
                    />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Место установки:</label>
                    <input
                      type="text"
                      value={spliceClosure.place}
            onChange={e => handleSpliceClosurePropertyChange('place', e.target.value)}
            style={{ flexGrow: 1 }}
          />
                  </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Широта:</label>
          <input type="text" value={spliceClosure.position[0].toFixed(6)} readOnly style={{ flexGrow: 1, color: '#888' }}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Долгота:</label>
          <input type="text" value={spliceClosure.position[1].toFixed(6)} readOnly style={{ flexGrow: 1, color: '#888' }}/>
        </div>
      </div>
      {/* Секция сплиттеров */}
      <div style={{ marginTop: 20, borderTop: '1px dashed #eee', paddingTop: 15 }}>
        <h4 style={{ marginTop: 0, marginBottom: 10 }}>Установленные сплиттеры:</h4>
                    {spliceClosure.splitters.length === 0 ? (
                      <p style={{color: '#666'}}>Сплиттеры не установлены</p>
                    ) : (
                      <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                        {spliceClosure.splitters.map((splitter, index) => (
                          <li key={splitter.id}>
                            {`Сплиттер ${index + 1}: ${splitter.type}, Номер: ${splitter.number || 'не задан'}`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button 
                    onClick={() => handleDeleteSpliceClosure(spliceClosure.id)}
                    style={{ width: '100%', padding: '10px', marginTop: '20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Удалить муфту
                  </button>
                </div>
              );
})()}
{selectedElement?.type === 'ats' && (() => {
  const ats = atsList.find(a => a.id === selectedElement.id);
  if (!ats) return null;

  return (
    <div style={{ padding: '0 0 0 0' }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px', textAlign: 'center' }}>Свойства АТС</h3>
      {/* FLEXBOX-СТИЛЬ ДЛЯ ВСЕХ ПОЛЕЙ */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Номер АТС:</label>
          <input
            type="text"
            value={ats.number}
            onChange={e => handleAtsPropertyChange('number', e.target.value)}
            style={{ flexGrow: 1 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Адрес:</label>
          <input
            type="text"
            value={ats.address}
            onChange={e => handleAtsPropertyChange('address', e.target.value)}
            style={{ flexGrow: 1 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Широта:</label>
          <input type="text" value={ats.position[0].toFixed(6)} readOnly style={{ flexGrow: 1, color: '#888' }}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ flexShrink: 0, width: '130px', textAlign: 'right', marginRight: '10px' }}>Долгота:</label>
          <input type="text" value={ats.position[1].toFixed(6)} readOnly style={{ flexGrow: 1, color: '#888' }}/>
        </div>
      </div>
      {/* Секция терминалов */}
      <div style={{ marginTop: 20, borderTop: '1px dashed #eee', paddingTop: 15 }}>
        <h4 style={{ marginTop: 0, marginBottom: 10 }}>Установленные терминалы:</h4>
        {ats.terminals.length === 0 ? (
          <p style={{color: '#666'}}>Терминалы не установлены</p>
        ) : (
          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
            {ats.terminals.map((terminal, index) => (
              <li key={terminal.id}>
                {`Терминал ${index + 1}: ${terminal.model}, Портов: ${terminal.portCount}, Номер: ${terminal.number || 'не задан'}, Статус: ${terminal.status === 'existing' ? 'Существующий' : 'Проектируемый'}`}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Секция сплиттеров */}
      <div style={{ marginTop: 20, borderTop: '1px dashed #eee', paddingTop: 15 }}>
        <h4 style={{ marginTop: 0, marginBottom: 10 }}>Установленные сплиттеры:</h4>
        {ats.splitters.length === 0 ? (
          <p style={{color: '#666'}}>Сплиттеры не установлены</p>
        ) : (
          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
            {ats.splitters.map((splitter, index) => (
              <li key={splitter.id}>
                {`Сплиттер ${index + 1}: ${splitter.type}, Номер: ${splitter.number || 'не задан'}`}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button 
        onClick={() => handleDeleteAts(ats.id)}
        style={{ width: '100%', padding: '10px', marginTop: '20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        Удалить АТС
      </button>
    </div>
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
      
      {/* Добавить отображение деталей муфты */}
      {showSpliceClosureDetails && selectedElement?.type === 'spliceClosure' && (
        <SpliceClosureDetailDialog
          spliceClosure={spliceClosures.find(sc => sc.id === selectedElement.id) || null}
          onClose={() => setShowSpliceClosureDetails(false)}
          cables={cables}
          spliceClosures={spliceClosures}
          fiberConnections={fiberConnections}
          selectedConnectionPoint={selectedConnectionPoint}
          onConnectionPointClick={handleConnectionPointClick}
          onRemoveFiberConnection={handleRemoveFiberConnection}
          onUpdateSpliceClosureSplitters={handleUpdateSpliceClosureSplitters}
          onUpdateSpliceClosureInternalConnections={handleUpdateSpliceClosureInternalConnections}
        />
      )}

      {/* Добавить отображение деталей АТС */}
      {showAtsDetails && selectedElement?.type === 'ats' && (
        <AtsDetailDialog
          ats={atsList.find(ats => ats.id === selectedElement.id) || null}
          onClose={() => setShowAtsDetails(false)}
          cables={cables}
          atsList={atsList}
          fiberConnections={fiberConnections}
          selectedConnectionPoint={selectedConnectionPoint}
          onConnectionPointClick={handleConnectionPointClick}
          onRemoveFiberConnection={handleRemoveFiberConnection}
          onUpdateAtsSplitters={handleUpdateAtsSplitters}
          onUpdateAtsInternalConnections={handleUpdateAtsInternalConnections}
          onUpdateAtsTerminals={handleUpdateAtsTerminals}
        />
      )}

      {/* Добавить диалог для создания муфты */}
      {newSpliceClosurePosition && addSpliceClosureMode && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '20px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 4000
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Параметры муфты</h3>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Номер муфты: <input value={spliceClosureParams.number} onChange={e => setSpliceClosureParams({ ...spliceClosureParams, number: e.target.value })} />
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Адрес установки: <input value={spliceClosureParams.address} onChange={e => setSpliceClosureParams({ ...spliceClosureParams, address: e.target.value })} />
            </label>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>
              Место установки: <input value={spliceClosureParams.place} onChange={e => setSpliceClosureParams({ ...spliceClosureParams, place: e.target.value })} />
            </label>
          </div>
          <button onClick={handleSaveSpliceClosure} style={{ padding: '8px 15px', cursor: 'pointer' }}>Сохранить</button>
          <button onClick={() => {
            setNewSpliceClosurePosition(null);
            setAddSpliceClosureMode(false);
            setSpliceClosureParams({ number: "", address: "", place: "" });
          }} style={{ marginLeft: '10px', padding: '8px 15px', cursor: 'pointer', background: '#ccc' }}>Отмена</button>
        </div>
      )}

      {/* НОВЫЙ ДИАЛОГ: для создания АТС */}
      {newAtsPosition && addAtsMode && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '20px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 4000
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Параметры АТС</h3>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Номер АТС: <input value={atsParams.number} onChange={e => setAtsParams({ ...atsParams, number: e.target.value })} />
            </label>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>
              Адрес: <input value={atsParams.address} onChange={e => setAtsParams({ ...atsParams, address: e.target.value })} />
            </label>
          </div>
          <button onClick={handleSaveAts} style={{ padding: '8px 15px', cursor: 'pointer' }}>Сохранить</button>
          <button onClick={() => {
            setNewAtsPosition(null);
            setAddAtsMode(false);
            setAtsParams({ number: "", address: "" });
          }} style={{ marginLeft: '10px', padding: '8px 15px', cursor: 'pointer', background: '#ccc' }}>Отмена</button>
        </div>
      )}
    </div>
  );
}

export default App;
