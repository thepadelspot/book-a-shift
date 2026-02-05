import React from 'react';

export default function ConfirmModal({ open, onClose, onConfirm, message, darkMode }) {
  if (!open) return null;
  return (
    <div className={`modal-backdrop${darkMode ? ' dark-mode' : ''}`}>
      <div className={`modal${darkMode ? ' dark-mode' : ''}`}>
        <div style={{ marginBottom: 16 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
