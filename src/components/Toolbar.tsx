import React from 'react';

interface ToolbarProps {
  onAddAts: () => void;
  atsMode: boolean;
  onAddBox: () => void;
  addBoxMode: boolean;
  onAddCable: () => void;
  cableMode: boolean;
  onAddPole: () => void;
  poleMode: boolean;
  onAddWell: () => void;
  wellMode: boolean;
  onAddSpliceClosure: () => void;
  spliceClosureMode: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onAddAts, atsMode,
  onAddBox, addBoxMode,
  onAddCable, cableMode,
  onAddPole, poleMode,
  onAddWell, wellMode,
  onAddSpliceClosure, spliceClosureMode
}) => {
  const toolbarStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    left: '60px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: '5px',
    borderRadius: '5px',
    gap: '5px',
    border: '1px solid #ccc'
  };

  const getButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    border: '1px solid #ccc',
    backgroundColor: isActive ? '#3388ff' : 'white',
    color: isActive ? 'white' : 'black',
    cursor: 'pointer',
    borderRadius: '4px',
    width: '100%',
    textAlign: 'left'
  });

  return (
    <div style={toolbarStyle}>
      <button onClick={onAddAts} style={getButtonStyle(atsMode)}>АТС</button>
      <button onClick={onAddBox} style={getButtonStyle(addBoxMode)}>Бокс</button>
      <button onClick={onAddSpliceClosure} style={getButtonStyle(spliceClosureMode)}>Муфта</button>
      <button onClick={onAddCable} style={getButtonStyle(cableMode)}>Кабель</button>
      <button onClick={onAddPole} style={getButtonStyle(poleMode)}>Опора</button>
      <button onClick={onAddWell} style={getButtonStyle(wellMode)}>Колодец</button>
    </div>
  );
};

export default Toolbar;