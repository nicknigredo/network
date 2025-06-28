// Тип для структуры волокна и модуля
export interface FiberStructure {
  module: number;
  moduleColor: { name: string; color: string; border?: string };
  fiber: number;
  fiberColor: { name: string; color: string; border?: string };
}

// Тип для сплиттера
export interface Splitter {
  id: string; // Уникальный ID для сплиттера внутри бокса (например, 'splitter-1-level1', 'splitter-2-level2-a')
  type: '1x2' | '1x4' | '1x8' | '1x16'; // Тип сплиттера
  connectorType: 'SC/UPC' | 'SC/APC' | null; // НОВОЕ ПОЛЕ: null означает отсутствие коннектора
  level: 1 | 2 | 3; // Уровень сплиттера: 1-й, 2-й, 3-й
  number: string; // НОВОЕ ПОЛЕ: номер сплиттера для отображения (вручную)
}

// Тип для точки соединения (волокно кабеля или порт сплиттера)
export type ConnectionPoint =
  | { type: 'cableFiber'; cableId: string; fiberIdx: number; direction: 'in' | 'out' }
  | { type: 'splitterPort'; splitterId: string; portType: 'input' | 'output'; portIdx: number }
  | { type: 'terminalPort'; terminalId: string; portIdx: number };

// Тип для внутреннего соединения в боксе
export interface InternalConnection {
  end1: ConnectionPoint;
  end2: ConnectionPoint;
}

// Тип для бокса
export interface Box {
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

// НОВЫЙ ИНТЕРФЕЙС: Муфта сращивания
export interface SpliceClosure {
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
  status: 'existing' | 'projected';
  oltTerminalNo: string;
  oltPortNo: string;
  model: 'FOSC-A4-S08' | 'FOSC-A4-S12' | 'FOSC-A4-S16' | 'FOSC-A4-S24' | 
         'FOSC-A8-S08' | 'FOSC-A8-S12' | 'FOSC-A8-S24' | 'FOSC-B4-S24' | 
         'FOSC-B8-S24' | 'FOSC-C-S12' | 'FOSC-AM-04';
}

// Тип для кабеля
export interface Cable {
  id: number;
  points: [number, number][];
  sourceElement: { type: 'box' | 'coupler' | 'spliceClosure' | 'ats', id: number };
  targetElement: { type: 'box' | 'coupler' | 'spliceClosure' | 'ats', id: number } | null;
  fiberCount: number;
  layingType: 'подвес' | 'канализация';
  status: 'existing' | 'projected'; // НОВОЕ ПОЛЕ
  model: string; // НОВОЕ ПОЛЕ: Марка кабеля
  sewerageWorkDetails?: {
    reserve: number;
    sections: number[];
  };
  oltTerminalNo?: string; // НОВОЕ ПОЛЕ: Номер терминала OLT для кабеля
  oltPortNo?: string;     // НОВОЕ ПОЛЕ: Номер порта OLT для кабеля

  // НОВЫЕ ФАКТИЧЕСКИЕ ПОЛЯ ДЛЯ РАБОТ ПО КАБЕЛЮ (для монтажников, сохраняются)
  actualCableLength?: number;    // Фактическая длина кабеля
  actualMarkA?: number;         // Фактическая метка А (изменено на number)
  actualMarkB?: number;         // Фактическая метка Б (изменено на number)

  actualWorkMetConst?: number; // по мет. конст.
  actualWorkTK?: number;       // по т/к
  actualWorkInGround?: number; // в грунте
  actualWorkExitLKS?: number;  // выход из ЛКС
  actualWorkSuspension?: number; // подвес
  actualWorkOnWall?: number;   // по стене
  actualWorkOnRiser?: number;  // по стояку
}

// НОВЫЙ ТИП: Для временных проектных расчетов (не сохраняется)
export interface ProjectedWorkDetails {
  reserve: number;
  sections: number[];
  showDetails: boolean; // НОВОЕ: для сворачивания/разворачивания деталей по каждому виду работ
}

// НОВЫЙ ТИП: Карта временных проектных данных для одного кабеля
export type CableProjectedWork = Record<string, ProjectedWorkDetails>; // Key: work type label, Value: details

// Тип для компонента CableDetailDialog
export interface CableDetailDialogProps {
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
export interface OdesaColor {
  name: string;
  color: string;
  border?: string;
}

// === Тип для опоры ===
export interface Pole {
  id: number;
  position: [number, number];
  number: string;
  tpNumber: string;
  purpose: '0,4кВт' | '10кВт' | 'УТК' | 'Освещение';
  labelOffset: [number, number]; // смещение подписи
}

// === Тип для колодца ===
export interface Well {
  id: number;
  position: [number, number];
  number: string;
  labelOffset: [number, number];
}

// === Универсальный тип выбранного элемента ===
export type SelectedElement =
  | { type: 'box'; id: number }
  | { type: 'spliceClosure'; id: number }
  | { type: 'ats'; id: number }
  | { type: 'cable'; id: number }
  | { type: 'pole'; id: number }
  | { type: 'well'; id: number }
  | null;

export interface CableEndpoint {
  elementId: number;
  elementType: 'box' | 'spliceClosure' | 'ats';
  position: [number, number];
}

// Интерфейсы для спецификации материалов
export interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface MaterialCategory {
  id: string;
  name: string;
  items: MaterialItem[];
}

// Интерфейсы для спецификации работ
export interface WorkItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface WorkCategory {
  id: string;
  name: string;
  items: WorkItem[];
}

// === НОВЫЕ ТИПЫ ДЛЯ АТС ===

// Тип для порта терминала
export interface TerminalPort {
  portIdx: number; // номер порта (0, 1, 2, 3...)
  attenuation: number; // затухание в дБ (по умолчанию 7)
  powerMode: 'default7' | 'default4' | 'manual'; // режим мощности: 7 дБ, 4 дБ или ручной ввод
}

// Тип для терминала OLT
export interface Terminal {
  id: string;
  model: string;
  portCount: 4 | 8 | 16;
  number: string; // номер терминала (для отображения)
  oltNumber: string; // номер OLT (сквозная нумерация или ручной ввод)
  status: 'existing' | 'projected';
  ports: TerminalPort[]; // массив портов с затуханиями
}

// Тип для АТС (автоматической телефонной станции)
export interface ATS {
  id: number;
  position: [number, number];
  number: string;
  address: string;
  status: 'existing' | 'projected';
  connections: {
    input: { cableId: number } | null;
    outputs: Array<{ cableId: number } | null>;
  };
  splitters: Splitter[];
  terminals: Terminal[];
  internalFiberConnections: InternalConnection[];
} 