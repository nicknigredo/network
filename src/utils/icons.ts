import L, { DivIcon } from 'leaflet';
import { Box, SpliceClosure, Pole, ATS } from '../types';

// Функция для создания иконки бокса
export function getBoxIcon(number: string, status: Box['status']): DivIcon {
  let fillColor = 'blue'; // По умолчанию проектируемый - синий
  if (status === 'existing') {
    fillColor = 'red'; // Существующий - красный
  }

  return new L.DivIcon({
    className: '',
    html: `
      <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="20" height="20" rx="4" fill="${fillColor}" fill-opacity="0.7" stroke="black" stroke-width="2" />
        <text x="15" y="18" font-size="14" text-anchor="middle" fill="white">${number}</text>
      </svg>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Функция для создания иконки муфты (SVG круг 30x30)
export function getSpliceClosureIcon(number: string, status: SpliceClosure['status']): DivIcon {
  let fillColor = 'purple'; // Проектируемая - фиолетовая
  if (status === 'existing') {
    fillColor = 'red'; // Существующая - красная
  }

  return new L.DivIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `
      <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="14" fill="${fillColor}" stroke="black" stroke-width="1.5"/> <text 
          x="15" y="15" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="14px" font-weight="bold">
          ${number} </text> </svg>
           `
  });
}

// Функция для создания иконки точки кабеля
export function getCablePointIcon(selected: boolean): DivIcon {
  return new L.DivIcon({
    className: '',
    html: `
      <svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="6" r="5" fill="${selected ? 'orange' : 'white'}" stroke="green" stroke-width="2" />
      </svg>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

// Функция для создания иконки опоры
export function getPoleIcon(purpose: '0,4кВт' | '10кВт' | 'УТК' | 'Освещение'): DivIcon {
  let fillColor = 'grey'; // По умолчанию
  switch (purpose) {
    case '0,4кВт': fillColor = 'yellow'; break;
    case '10кВт': fillColor = 'red'; break;
    case 'УТК': fillColor = 'blue'; break;
    case 'Освещение': fillColor = 'green'; break;
  }
  return new L.DivIcon({
    className: '',
    html: `
      <svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="6" r="6" fill="${fillColor}" stroke="black" stroke-width="1" />
      </svg>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

// Функция для создания иконки колодца
export function getWellIcon(): DivIcon {
  const r = 8;
  const cx = 12, cy = 12;
  const point = (angleDeg: number) => {
    const rad = (angleDeg - 90) * Math.PI / 180; // -90 чтобы 0° было вверх
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x1, y1] = point(0);   // вверх
  const [x2, y2] = point(135); // влево-вниз
  const [x3, y3] = point(225); // вправо-вниз

  return new L.DivIcon({
    className: '',
    html: `
      <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="8" fill="#fff" stroke="black" stroke-width="1.5" />
        <line x1="12" y1="12" x2="${x1}" y2="${y1}" stroke="black" stroke-width="1.5" />
        <line x1="12" y1="12" x2="${x2}" y2="${y2}" stroke="black" stroke-width="1.5" />
        <line x1="12" y1="12" x2="${x3}" y2="${y3}" stroke="black" stroke-width="1.5" />
      </svg>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// Функция для создания иконки АТС (равнобедренный треугольник)
export function getAtsIcon(number: string, status: ATS['status']): DivIcon {
  let fillColor = 'red'; // По умолчанию красный
  if (status === 'existing') {
    fillColor = 'darkred'; // Существующий - темно-красный
  }

  return new L.DivIcon({
    className: '',
    html: `
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <polygon points="20,5 35,35 5,35" fill="${fillColor}" stroke="black" stroke-width="2" />
        <text x="20" y="28" font-size="12" text-anchor="middle" fill="white" font-weight="bold">${number}</text>
      </svg>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 35], // Якорь в нижней точке треугольника
  });
} 