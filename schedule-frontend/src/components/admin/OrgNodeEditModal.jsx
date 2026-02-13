import React, { useState } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import ErrorAlert from '../common/ErrorAlert';
import { X } from 'lucide-react';
import api from '../../utils/api';

const TYPE_LABELS = { division: '본부', office: '처/실', department: '부서' };

export default function OrgNodeEditModal({ type, mode, data, parentId, parentName, divisions, onClose, onSaved }) {
  const { cardBg, textColor, secondaryTextColor, borderColor, inputBg } = useThemeColors();
  const [name, setName] = useState(data?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${borderColor}`,
    borderRadius: '6px',
    backgroundColor: inputBg,
    color: textColor,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('이름을 입력하세요.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (type === 'division') {
        if (mode === 'create') await api.createDivision(name.trim());
        else await api.updateDivision(data.id, name.trim());
      } else if (type === 'office') {
        if (mode === 'create') await api.createOffice(name.trim(), parentId);
        else await api.updateOffice(data.id, { name: name.trim(), divisionId: parentId || undefined });
      } else if (type === 'department') {
        if (mode === 'create') await api.createDepartment(name.trim(), parentId);
        else await api.updateDepartment(data.id, { name: name.trim(), officeId: parentId || undefined });
      }
      onSaved();
    } catch (err) {
      setError(err.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'create' ? `${TYPE_LABELS[type]} 추가` : `${TYPE_LABELS[type]} 수정`;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1001,
    }}>
      <div style={{
        backgroundColor: cardBg, borderRadius: '12px', padding: '24px',
        maxWidth: '420px', width: '90%',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: textColor }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: secondaryTextColor, cursor: 'pointer', padding: '4px',
          }}>
            <X size={20} />
          </button>
        </div>

        <ErrorAlert message={error} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mode === 'create' && type !== 'division' && parentName && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: secondaryTextColor, marginBottom: '4px' }}>
                상위 조직
              </label>
              <input type="text" value={parentName} disabled style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: secondaryTextColor, marginBottom: '4px' }}>
              {TYPE_LABELS[type]} 이름
            </label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder={`${TYPE_LABELS[type]} 이름을 입력하세요`}
              style={inputStyle} autoFocus={!('ontouchstart' in window || navigator.maxTouchPoints > 0)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', border: `1px solid ${borderColor}`, borderRadius: '6px',
            backgroundColor: 'transparent', color: textColor, cursor: 'pointer', fontSize: '14px',
          }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 20px', border: 'none', borderRadius: '6px',
            backgroundColor: '#3B82F6', color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: saving ? 0.7 : 1,
          }}>{saving ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}
