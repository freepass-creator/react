import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // 사용자님의 App.js를 불러옴

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
