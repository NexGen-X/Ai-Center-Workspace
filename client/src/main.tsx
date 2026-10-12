import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { FeedbackProvider } from './components/common/FeedbackContext.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallbackTitle="AI Agent Command Center Mengalami Kendala"
      fallbackDescription="Terjadi galat pada antarmuka pengguna. Klik tombol di bawah untuk memulihkan sesi Anda."
    >
      <FeedbackProvider>
        <App />
      </FeedbackProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
