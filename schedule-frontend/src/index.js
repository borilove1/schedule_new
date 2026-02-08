import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 글로벌 포커스 스타일 (탭 이동 시 입력 필드 강조)
const focusStyle = document.createElement('style');
focusStyle.textContent = `
  input:focus, select:focus, textarea:focus {
    border-color: #3B82F6 !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.15) !important;
  }
`;
document.head.appendChild(focusStyle);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker 등록 (PWA + Push)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[SW] Registered:', registration.scope);
      })
      .catch(err => console.error('[SW] Registration failed:', err));
  });
}
