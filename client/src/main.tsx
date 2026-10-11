import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { FeedbackProvider } from './components/common/FeedbackContext.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </React.StrictMode>
);
