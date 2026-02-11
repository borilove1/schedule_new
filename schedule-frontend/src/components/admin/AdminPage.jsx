import React, { useState } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { ArrowLeft, Users, Building2, Settings } from 'lucide-react';
import UserManagement from './UserManagement';
import OrganizationManagement from './OrganizationManagement';
import SystemSettings from './SystemSettings';

const tabs = [
  { id: 'users', label: '사용자 관리', icon: Users },
  { id: 'organization', label: '조직 관리', icon: Building2 },
  { id: 'settings', label: '시스템 설정', icon: Settings },
];

export default function AdminPage({ onBack }) {
  const [activeTab, setActiveTab] = useState('users');
  const { textColor, secondaryTextColor, borderColor } = useThemeColors();

  return (
    <div>
      {/* 뒤로가기 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '24px',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: secondaryTextColor,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            padding: '4px', borderRadius: '8px',
          }}
          title="설정으로 돌아가기"
        >
          <ArrowLeft size={22} />
        </button>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: textColor, margin: 0 }}>
          관리자
        </h2>
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '24px',
        borderBottom: `2px solid ${borderColor}`, paddingBottom: '0',
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 20px', border: 'none',
                borderBottom: isActive ? '2px solid #3B82F6' : '2px solid transparent',
                marginBottom: '-2px', background: 'none',
                color: isActive ? '#3B82F6' : secondaryTextColor,
                cursor: 'pointer', fontSize: '14px',
                fontWeight: isActive ? '600' : '400', transition: 'all 0.2s',
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'organization' && <OrganizationManagement />}
      {activeTab === 'settings' && <SystemSettings />}
    </div>
  );
}
