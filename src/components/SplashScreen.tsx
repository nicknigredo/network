import React from 'react';

interface SplashScreenProps {
  onClose: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#094961', // Цвет фона, соответствующий верхней панели
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999, // Высокий z-index, чтобы быть поверх всего
      }}
    >
      <img
        src="/logo.png" // Путь к вашему логотипу
        alt="Логотип"
        style={{
          width: '200px', // Рекомендуемый размер
          height: 'auto',
        }}
      />
    </div>
  );
};

export default SplashScreen; 