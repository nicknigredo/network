import React, { useState, useMemo } from 'react';
import { 
  Terminal, 
  Splitter, 
  InternalConnection, 
  ConnectionPoint, 
  Cable,
  Box,
  SpliceClosure,
  ATS
} from '../types';
import { 
  SPLITTER_LOSSES, 
  CABLE_ATTENUATION_BY_WAVELENGTH, 
  SPLICE_ATTENUATION, 
  CONNECTOR_ATTENUATION_VALUE,
  ATTENUATION_COLOR_LIMITS,
  ATTENUATION_COLORS
} from '../constants';
import { isSplitterPort, isTerminalPort, isCableFiber, getSplitterPortCounts, calculateCableLength, traceFiberPath } from '../utils';

interface AttenuationTableProps {
  atsList: ATS[];
  boxes: Box[];
  spliceClosures: SpliceClosure[];
  cables: Cable[];
  fiberConnections: InternalConnection[];
}

interface AttenuationRow {
  terminalNumber: string;
  terminalPort: number;
  splitterLocation: string;
  splitterNumber: string;
  cableLength: number;
  spliceCount: number;
  connectorCount: number;
  attenuation1310: number;
  attenuation1490: number;
  attenuation1550: number;
}

export default function AttenuationTable({
  atsList,
  boxes,
  spliceClosures,
  cables,
  fiberConnections
}: AttenuationTableProps) {
  const [selectedTerminal, setSelectedTerminal] = useState<string>('all');

  // Функция для расчета затухания
  const calculateAttenuation = (
    terminalPower: number,
    fiberPath: {
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
  ): { 1310: number; 1490: number; 1550: number } => {
    // Затухание сплиттеров
    const splitterAttenuation = fiberPath.splitters.reduce((sum, splitterData) => {
      return sum + SPLITTER_LOSSES[splitterData.splitter.type];
    }, 0);

    // Затухание кабеля на разных длинах волн (переводим в километры)
    const cableLengthKm = fiberPath.totalCableLength / 1000;
    const cableAttenuation1310 = cableLengthKm * CABLE_ATTENUATION_BY_WAVELENGTH['1310nm'];
    const cableAttenuation1490 = cableLengthKm * CABLE_ATTENUATION_BY_WAVELENGTH['1490nm'];
    const cableAttenuation1550 = cableLengthKm * CABLE_ATTENUATION_BY_WAVELENGTH['1550nm'];

    // Затухание сварных соединений
    const spliceAttenuation = fiberPath.totalSpliceCount * SPLICE_ATTENUATION;

    // Затухание коннекторов
    const connectorAttenuation = fiberPath.totalConnectorCount * CONNECTOR_ATTENUATION_VALUE;

    // Общее затухание
    const totalAttenuation1310 = splitterAttenuation + cableAttenuation1310 + spliceAttenuation + connectorAttenuation;
    const totalAttenuation1490 = splitterAttenuation + cableAttenuation1490 + spliceAttenuation + connectorAttenuation;
    const totalAttenuation1550 = splitterAttenuation + cableAttenuation1550 + spliceAttenuation + connectorAttenuation;

    return {
      1310: terminalPower - totalAttenuation1310,
      1490: terminalPower - totalAttenuation1490,
      1550: terminalPower - totalAttenuation1550
    };
  };

  // Функция для получения цвета ячейки затухания
  const getAttenuationColor = (attenuation: number): string => {
    if (attenuation >= ATTENUATION_COLOR_LIMITS.GOOD) {
      return ATTENUATION_COLORS.GOOD;
    } else if (attenuation >= ATTENUATION_COLOR_LIMITS.WARNING) {
      return ATTENUATION_COLORS.WARNING;
    } else {
      return ATTENUATION_COLORS.CRITICAL;
    }
  };

  // Функция для получения места установки сплиттера
  const getSplitterLocation = (splitterId: string): string => {
    // Ищем в АТС
    for (const ats of atsList) {
      if (ats.splitters.some(s => s.id === splitterId)) {
        return `АТС ${ats.number || ats.id}`;
      }
    }
    
    // Ищем в боксах
    for (const box of boxes) {
      if (box.splitters.some(s => s.id === splitterId)) {
        return `Бокс ${box.number || box.id}`;
      }
    }
    
    // Ищем в муфтах
    for (const spliceClosure of spliceClosures) {
      if (spliceClosure.splitters.some(s => s.id === splitterId)) {
        return `Муфта ${spliceClosure.number || spliceClosure.id}`;
      }
    }
    
    return 'Неизвестно';
  };

  // Генерируем данные для таблицы
  const tableData = useMemo((): AttenuationRow[] => {
    const rows: AttenuationRow[] = [];

    for (const ats of atsList) {
      for (const terminal of ats.terminals) {
        // Пропускаем если выбран конкретный терминал
        if (selectedTerminal !== 'all' && terminal.id !== selectedTerminal) {
          continue;
        }

        for (const port of terminal.ports) {
          // Используем новую функцию трассировки
          const fiberPaths = traceFiberPath(
            terminal.id,
            port.portIdx,
            atsList,
            boxes,
            spliceClosures,
            cables
          );

          // Для каждого найденного пути создаем строки
          for (const fiberPath of fiberPaths) {
            for (const splitterData of fiberPath.splitters) {
              const attenuation = calculateAttenuation(port.attenuation, fiberPath);

              rows.push({
                terminalNumber: terminal.number || `Терминал ${terminal.id}`,
                terminalPort: port.portIdx + 1,
                splitterLocation: getSplitterLocation(splitterData.splitter.id),
                splitterNumber: splitterData.splitter.number || `Сплиттер ${splitterData.splitter.id}`,
                cableLength: Math.round(fiberPath.totalCableLength * 100) / 100,
                spliceCount: fiberPath.totalSpliceCount,
                connectorCount: fiberPath.totalConnectorCount,
                attenuation1310: Math.round(attenuation[1310] * 100) / 100,
                attenuation1490: Math.round(attenuation[1490] * 100) / 100,
                attenuation1550: Math.round(attenuation[1550] * 100) / 100
              });
            }
          }
        }
      }
    }

    return rows;
  }, [atsList, boxes, spliceClosures, cables, fiberConnections, selectedTerminal]);

  // Получаем список терминалов для фильтра
  const terminals = useMemo(() => {
    const terminalList: Array<{ id: string; name: string }> = [];
    for (const ats of atsList) {
      for (const terminal of ats.terminals) {
        terminalList.push({
          id: terminal.id,
          name: terminal.number || `Терминал ${terminal.id}`
        });
      }
    }
    return terminalList;
  }, [atsList]);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Расчет затуханий</h2>
      
      {/* Фильтр по терминалу */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '10px' }}>Фильтр по терминалу:</label>
        <select 
          value={selectedTerminal} 
          onChange={(e) => setSelectedTerminal(e.target.value)}
          style={{ padding: '5px', minWidth: '200px' }}
        >
          <option value="all">Все терминалы</option>
          {terminals.map(terminal => (
            <option key={terminal.id} value={terminal.id}>
              {terminal.name}
            </option>
          ))}
        </select>
      </div>

      {/* Таблица затуханий */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          fontSize: '12px',
          border: '1px solid #ddd'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Терминал</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Порт</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Место установки</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Сплиттер</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Длина, км</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Сварки</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Коннекторы</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>1310 нм, дБ</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>1490 нм, дБ</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>1550 нм, дБ</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                  {row.terminalNumber}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                  {row.terminalPort}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                  {row.splitterLocation}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                  {row.splitterNumber}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                  {row.cableLength}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                  {row.spliceCount}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                  {row.connectorCount}
                </td>
                <td style={{ 
                  border: '1px solid #ddd', 
                  padding: '6px', 
                  textAlign: 'center',
                  backgroundColor: getAttenuationColor(row.attenuation1310)
                }}>
                  {row.attenuation1310}
                </td>
                <td style={{ 
                  border: '1px solid #ddd', 
                  padding: '6px', 
                  textAlign: 'center',
                  backgroundColor: getAttenuationColor(row.attenuation1490)
                }}>
                  {row.attenuation1490}
                </td>
                <td style={{ 
                  border: '1px solid #ddd', 
                  padding: '6px', 
                  textAlign: 'center',
                  backgroundColor: getAttenuationColor(row.attenuation1550)
                }}>
                  {row.attenuation1550}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Легенда */}
      <div style={{ marginTop: '20px', fontSize: '12px' }}>
        <h4>Легенда:</h4>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ 
              width: '20px', 
              height: '20px', 
              backgroundColor: ATTENUATION_COLORS.GOOD,
              border: '1px solid #ddd'
            }}></div>
            <span>До -23 дБ (норма)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ 
              width: '20px', 
              height: '20px', 
              backgroundColor: ATTENUATION_COLORS.WARNING,
              border: '1px solid #ddd'
            }}></div>
            <span>От -23 до -25 дБ (предупреждение)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ 
              width: '20px', 
              height: '20px', 
              backgroundColor: ATTENUATION_COLORS.CRITICAL,
              border: '1px solid #ddd'
            }}></div>
            <span>От -26 дБ и ниже (критично)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
