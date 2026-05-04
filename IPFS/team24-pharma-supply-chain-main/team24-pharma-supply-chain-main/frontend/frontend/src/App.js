import React from 'react';
import RegisterBatch from './components/RegisterBatch';
import TransferOwnership from './components/TransferOwnership';
import BatchViewer from './components/BatchViewer';

function App() {
  const [page, setPage] = React.useState('register');

  const navStyle = {
    padding: '10px 20px',
    marginRight: 10,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  };

  const activeStyle = { ...navStyle, background: '#4f46e5', color: '#fff' };
  const inactiveStyle = { ...navStyle, background: '#e5e7eb', color: '#333' };

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 820, margin: '0 auto', padding: 30 }}>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>🏥 Pharma Supply Chain</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>Blockchain + IPFS Traceability System — Team 24</p>

      <nav style={{ marginBottom: 30, borderBottom: '2px solid #e5e7eb', paddingBottom: 16 }}>
        <button style={page === 'register' ? activeStyle : inactiveStyle} onClick={() => setPage('register')}>
          Register Batch
        </button>
        <button style={page === 'transfer' ? activeStyle : inactiveStyle} onClick={() => setPage('transfer')}>
          Transfer Ownership
        </button>
        <button style={page === 'view' ? activeStyle : inactiveStyle} onClick={() => setPage('view')}>
          View Batch
        </button>
      </nav>

      {page === 'register' && <RegisterBatch />}
      {page === 'transfer' && <TransferOwnership />}
      {page === 'view'     && <BatchViewer />}
    </div>
  );
}

export default App;