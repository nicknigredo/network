import React, { useState } from 'react';

interface TabsProps {
  tabs: { id: string; label: string }[];
  onTabChange: (tabId: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, onTabChange }) => {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange(tabId);
  };

  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: 20 }}>
      {tabs.map(tab => (
        <div
          key={tab.id}
          onClick={() => handleTabClick(tab.id)}
          style={{
            padding: '10px 20px',
            cursor: 'pointer',
            borderBottom: activeTab === tab.id ? '2px solid #0070c0' : 'none',
            color: activeTab === tab.id ? '#0070c0' : '#333',
            fontWeight: activeTab === tab.id ? 'bold' : 'normal',
          }}
        >
          {tab.label}
        </div>
      ))}
    </div>
  );
};

export default Tabs;