import React from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useIsMobile } from '../../hooks/useIsMobile';

export default function MainLayout({ children }) {
  const { bgColor, textColor } = useThemeColors();
  const isMobile = useIsMobile();

  return (
    <div className="app-shell" style={{ backgroundColor: bgColor, color: textColor, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px', paddingTop: `calc(env(safe-area-inset-top, 0px) + ${isMobile ? '16px' : '24px'})` }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
