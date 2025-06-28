import { Splitter, FiberStructure, Box, ConnectionPoint, InternalConnection, OdesaColor, ATS, SpliceClosure, Cable } from '../types';
import { SPLITTER_LOSSES, ODESA_COLORS, CABLE_ATTENUATION, CONNECTOR_ATTENUATION, ATTENUATION_LIMITS } from '../constants';

// Функция для определения количества портов сплиттера
export function getSplitterPortCounts(type: Splitter['type']): { input: number; outputs: number } {
  switch (type) {
    case '1x2': return { input: 1, outputs: 2 };
    case '1x4': return { input: 1, outputs: 4 };
    case '1x8': return { input: 1, outputs: 8 };
    case '1x16': return { input: 1, outputs: 16 };
    default: return { input: 0, outputs: 0 }; // Должен быть недостижим с типизацией
  }
}

// Функция для расчета длины кабеля
export function calculateCableLength(points: [number, number][]): number {
  if (points.length < 2) return 0;
  
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [lat1, lon1] = points[i];
    const [lat2, lon2] = points[i + 1];
    
    // Формула гаверсинуса для расчета расстояния между двумя точками на сфере
    const R = 6371000; // Радиус Земли в метрах
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    totalLength += R * c;
  }
  
  return totalLength;
}

// Функция для получения средней точки полилинии
export function getPolylineMiddlePoint(points: [number, number][]): [number, number] {
  if (points.length === 0) return [0, 0];
  if (points.length === 1) return points[0];
  
  const totalLength = calculateCableLength(points);
  let currentLength = 0;
  const targetLength = totalLength / 2;
  
  for (let i = 0; i < points.length - 1; i++) {
    const [lat1, lon1] = points[i];
    const [lat2, lon2] = points[i + 1];
    
    // Расчет длины текущего сегмента
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const segmentLength = R * c;
    
    if (currentLength + segmentLength >= targetLength) {
      // Средняя точка находится в этом сегменте
      const ratio = (targetLength - currentLength) / segmentLength;
      const lat = lat1 + (lat2 - lat1) * ratio;
      const lon = lon1 + (lon2 - lon1) * ratio;
      return [lat, lon];
    }
    
    currentLength += segmentLength;
  }
  
  // Если не нашли, возвращаем последнюю точку
  return points[points.length - 1];
}

// Функция для получения структуры кабеля
export function getCableStructure(fiberCount: number): FiberStructure[] {
  const structure: FiberStructure[] = [];
  
  // Определяем количество модулей и волокон в каждом модуле
  let modulesCount: number;
  let fibersPerModule: number;
  
  if (fiberCount <= 12) {
    modulesCount = 1;
    fibersPerModule = fiberCount;
  } else if (fiberCount <= 24) {
    modulesCount = 2;
    fibersPerModule = fiberCount / 2;
  } else if (fiberCount <= 48) {
    modulesCount = 4;
    fibersPerModule = fiberCount / 4;
  } else if (fiberCount <= 96) {
    modulesCount = 8;
    fibersPerModule = fiberCount / 8;
  } else if (fiberCount <= 144) {
    modulesCount = 12;
    fibersPerModule = fiberCount / 12;
  } else {
    modulesCount = Math.ceil(fiberCount / 12);
    fibersPerModule = 12;
  }
  
  let fiberIndex = 1;
  for (let moduleIndex = 1; moduleIndex <= modulesCount; moduleIndex++) {
    // Для кабелей с 4, 8, 12 волокнами (один модуль) - белый цвет
    // Для остальных кабелей - цвета ODESA с номерами в скобках
    let moduleColor: OdesaColor;
    if (fiberCount <= 12) {
      // Белый модуль для кабелей с одним модулем
      moduleColor = { name: 'білий', color: '#ffffff', border: '#bbb' };
    } else {
      // Цвета ODESA с номерами в скобках для остальных кабелей
      const odesaColor = ODESA_COLORS[(moduleIndex - 1) % ODESA_COLORS.length];
      moduleColor = {
        name: `${odesaColor.name} (${moduleIndex})`,
        color: odesaColor.color,
        border: odesaColor.border
      };
    }
    
    for (let fiberInModule = 1; fiberInModule <= fibersPerModule && fiberIndex <= fiberCount; fiberInModule++) {
      const fiberColor = ODESA_COLORS[(fiberInModule - 1) % ODESA_COLORS.length];
      
      structure.push({
        module: moduleIndex,
        moduleColor,
        fiber: fiberIndex,
        fiberColor,
      });
      
      fiberIndex++;
    }
  }
  
  return structure;
}

// Функция для получения центра бокса
export function getBoxCenter(box: Box): [number, number] {
  return box.position;
}

// Функция для проверки занятости точки соединения глобально
export function isConnectionPointBusyGlobal(
  point: ConnectionPoint,
  boxes: Box[],
  fiberConnections: InternalConnection[]
): boolean {
  // Разрешаем соединение волокна в любом элементе
  // Это позволяет создавать цепочки соединений от АТС через муфты к боксам
  return false;
}

// Type guards для ConnectionPoint
export function isSplitterPort(point: ConnectionPoint): point is { type: 'splitterPort'; splitterId: string; portType: 'input' | 'output'; portIdx: number } {
  return point.type === 'splitterPort';
}

export function isCableFiber(point: ConnectionPoint): point is { type: 'cableFiber'; cableId: string; fiberIdx: number; direction: 'in' | 'out' } {
  return point.type === 'cableFiber';
}

export function isTerminalPort(point: ConnectionPoint): point is { type: 'terminalPort'; terminalId: string; portIdx: number } {
  return point.type === 'terminalPort';
}

// Функция для валидации соединений бокса
export function validateBoxConnections(box: Box): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Проверяем, что у бокса есть входящий кабель
  if (!box.connections.input) {
    errors.push(`Бокс ${box.number}: отсутствует входящий кабель`);
  }
  
  // Проверяем, что количество исходящих кабелей соответствует количеству выходов
  const outputConnections = box.connections.outputs.filter(conn => conn !== null);
  if (outputConnections.length === 0) {
    errors.push(`Бокс ${box.number}: отсутствуют исходящие кабели`);
  }
  
  // Проверяем сплиттеры
  if (box.splitters.length === 0) {
    errors.push(`Бокс ${box.number}: отсутствуют сплиттеры`);
  }
  
  // Проверяем внутренние соединения
  if (box.internalFiberConnections.length === 0) {
    errors.push(`Бокс ${box.number}: отсутствуют внутренние соединения волокон`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Функция для расчета общего затухания сплиттера
export function getSplitterTotalAttenuation(splitter: Splitter): number {
  return SPLITTER_LOSSES[splitter.type];
}

// Экспортируем константы для использования в других компонентах
export { SPLITTER_LOSSES, ODESA_COLORS };

// НОВЫЕ ФУНКЦИИ ДЛЯ РАСЧЕТА ЗАТУХАНИЙ

// Функция для получения затухания кабеля
export function getCableAttenuation(cableModel: string, lengthKm: number): number {
  const attenuationPerKm = CABLE_ATTENUATION[cableModel] || CABLE_ATTENUATION.default;
  return attenuationPerKm * lengthKm;
}

// Функция для получения затухания соединителя
export function getConnectorAttenuation(connectorType: string | null): number {
  if (!connectorType) return 0;
  return CONNECTOR_ATTENUATION[connectorType] || CONNECTOR_ATTENUATION.default;
}

// Функция для расчета общего затухания сплиттера
export function calculateSplitterTotalAttenuation(
  splitter: Splitter,
  cableLengthKm: number = 0,
  cableModel: string = 'default'
): number {
  // Затухание самого сплиттера
  const splitterAttenuation = SPLITTER_LOSSES[splitter.type];
  
  // Затухание кабеля
  const cableAttenuation = getCableAttenuation(cableModel, cableLengthKm);
  
  // Затухание соединителей (вход + выход)
  const connectorAttenuation = getConnectorAttenuation(splitter.connectorType) * 2;
  
  return splitterAttenuation + cableAttenuation + connectorAttenuation;
}

// Функция для определения статуса затухания
export function getAttenuationStatus(totalAttenuation: number): 'normal' | 'warning' | 'critical' {
  if (totalAttenuation <= ATTENUATION_LIMITS.NORMAL) return 'normal';
  if (totalAttenuation <= ATTENUATION_LIMITS.WARNING) return 'warning';
  return 'critical';
}

// Функция для получения цвета статуса
export function getAttenuationStatusColor(status: 'normal' | 'warning' | 'critical'): string {
  switch (status) {
    case 'normal': return '#28a745'; // зеленый
    case 'warning': return '#ffc107'; // желтый
    case 'critical': return '#dc3545'; // красный
    default: return '#6c757d'; // серый
  }
}

// Функция для получения иконки статуса
export function getAttenuationStatusIcon(status: 'normal' | 'warning' | 'critical'): string {
  switch (status) {
    case 'normal': return '✅';
    case 'warning': return '⚠️';
    case 'critical': return '❌';
    default: return '❓';
  }
}

// Функция для трассировки волокна от порта терминала до всех подключенных сплиттеров
export interface FiberPath {
  terminalId: string;
  terminalPort: number;
  splitters: Array<{
    splitter: Splitter;
    level: number;
    path: Array<{
      elementType: 'ats' | 'box' | 'spliceClosure';
      elementId: number;
      cableId: number;
      fiberIdx: number;
      cableLength: number;
    }>;
  }>;
  totalCableLength: number;
  totalSpliceCount: number;
  totalConnectorCount: number;
}

export function traceFiberPath(
  terminalId: string,
  terminalPort: number,
  atsList: ATS[],
  boxes: Box[],
  spliceClosures: SpliceClosure[],
  cables: Cable[]
): FiberPath[] {
  const paths: Array<{
    splitters: Array<{
      splitter: Splitter;
      level: number;
      path: Array<{
        elementType: 'ats' | 'box' | 'spliceClosure';
        elementId: number;
        cableId: number;
        fiberIdx: number;
        cableLength: number;
      }>;
    }>;
  }> = [];
  const visited = new Set<string>();

  // Находим АТС с терминалом
  const ats = atsList.find(a => a.terminals.some(t => t.id === terminalId));
  if (!ats) return [];

  const terminal = ats.terminals.find(t => t.id === terminalId);
  if (!terminal) return [];

  // Начинаем трассировку с порта терминала
  const startPoint: ConnectionPoint = {
    type: 'terminalPort',
    terminalId,
    portIdx: terminalPort
  };

  // Рекурсивная функция для поиска всех путей
  const traceRecursive = (
    currentPoint: ConnectionPoint,
    currentPath: Array<{
      elementType: 'ats' | 'box' | 'spliceClosure';
      elementId: number;
      cableId: number;
      fiberIdx: number;
      cableLength: number;
    }>,
    currentSplitters: Array<{
      splitter: Splitter;
      level: number;
      path: Array<{
        elementType: 'ats' | 'box' | 'spliceClosure';
        elementId: number;
        cableId: number;
        fiberIdx: number;
        cableLength: number;
      }>;
    }>,
    currentLevel: number
  ) => {
    const pointKey = `${currentPoint.type}-${JSON.stringify(currentPoint)}`;
    if (visited.has(pointKey)) return;
    visited.add(pointKey);

    // Ищем соединения в АТС
    if (ats) {
      for (const connection of ats.internalFiberConnections) {
        if (connection.end1.type === currentPoint.type && 
            JSON.stringify(connection.end1) === JSON.stringify(currentPoint)) {
          processConnection(connection.end2, connection.end1);
        }
        if (connection.end2.type === currentPoint.type && 
            JSON.stringify(connection.end2) === JSON.stringify(currentPoint)) {
          processConnection(connection.end1, connection.end2);
        }
      }
    }

    // Ищем соединения в боксах
    for (const box of boxes) {
      for (const connection of box.internalFiberConnections) {
        if (connection.end1.type === currentPoint.type && 
            JSON.stringify(connection.end1) === JSON.stringify(currentPoint)) {
          processConnection(connection.end2, connection.end1, 'box', box.id);
        }
        if (connection.end2.type === currentPoint.type && 
            JSON.stringify(connection.end2) === JSON.stringify(currentPoint)) {
          processConnection(connection.end1, connection.end2, 'box', box.id);
        }
      }
    }

    // Ищем соединения в муфтах
    for (const spliceClosure of spliceClosures) {
      for (const connection of spliceClosure.internalFiberConnections) {
        if (connection.end1.type === currentPoint.type && 
            JSON.stringify(connection.end1) === JSON.stringify(currentPoint)) {
          processConnection(connection.end2, connection.end1, 'spliceClosure', spliceClosure.id);
        }
        if (connection.end2.type === currentPoint.type && 
            JSON.stringify(connection.end2) === JSON.stringify(currentPoint)) {
          processConnection(connection.end1, connection.end2, 'spliceClosure', spliceClosure.id);
        }
      }
    }

    function processConnection(
      nextPoint: ConnectionPoint,
      prevPoint: ConnectionPoint,
      elementType?: 'ats' | 'box' | 'spliceClosure',
      elementId?: number
    ) {
      // Если это сплиттер
      if (isSplitterPort(nextPoint)) {
        const splitter = findSplitterById(nextPoint.splitterId);
        if (splitter) {
          const newSplitters = [...currentSplitters, {
            splitter,
            level: currentLevel,
            path: [...currentPath]
          }];

          // Добавляем путь в результат
          paths.push({
            splitters: newSplitters
          });

          // Если это входной порт сплиттера, продолжаем поиск от выходных портов
          if (nextPoint.portType === 'input') {
            const portCounts = getSplitterPortCounts(splitter.type);
            for (let i = 0; i < portCounts.outputs; i++) {
              const outputPoint: ConnectionPoint = {
                type: 'splitterPort',
                splitterId: splitter.id,
                portType: 'output',
                portIdx: i
              };
              traceRecursive(outputPoint, currentPath, newSplitters, currentLevel + 1);
            }
          }
        }
      }

      // Если это волокно кабеля
      if (isCableFiber(nextPoint)) {
        const cable = cables.find(c => String(c.id) === nextPoint.cableId);
        if (cable) {
          const newPath = [...currentPath, {
            elementType: elementType || 'ats',
            elementId: elementId || (ats?.id || 0),
            cableId: parseInt(nextPoint.cableId),
            fiberIdx: nextPoint.fiberIdx,
            cableLength: calculateCableLength(cable.points)
          }];
          traceRecursive(nextPoint, newPath, currentSplitters, currentLevel);
        }
      }
    }
  };

  // Вспомогательная функция для поиска сплиттера по ID
  const findSplitterById = (splitterId: string): Splitter | null => {
    // Ищем в АТС
    for (const ats of atsList) {
      const splitter = ats.splitters.find(s => s.id === splitterId);
      if (splitter) return splitter;
    }
    
    // Ищем в боксах
    for (const box of boxes) {
      const splitter = box.splitters.find(s => s.id === splitterId);
      if (splitter) return splitter;
    }
    
    // Ищем в муфтах
    for (const spliceClosure of spliceClosures) {
      const splitter = spliceClosure.splitters.find(s => s.id === splitterId);
      if (splitter) return splitter;
    }
    
    return null;
  };

  // Запускаем трассировку
  traceRecursive(startPoint, [], [], 1);

  // Формируем результат
  const result: FiberPath[] = [];
  for (const pathData of paths) {
    const totalCableLength = pathData.splitters.reduce((sum, s) => 
      sum + s.path.reduce((pathSum, p) => pathSum + p.cableLength, 0), 0);
    
    const totalSpliceCount = pathData.splitters.length + 1; // +1 для терминала
    const totalConnectorCount = pathData.splitters.length * 2; // Вход и выход для каждого сплиттера

    result.push({
      terminalId,
      terminalPort,
      splitters: pathData.splitters,
      totalCableLength,
      totalSpliceCount,
      totalConnectorCount
    });
  }

  return result;
} 