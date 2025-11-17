import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import './index.css';

// Import your components
import Dashboard from './components/StudentDashboard.tsx';
import { TeacherDashboard } from './components/TeacherDashboard.tsx';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<TeacherDashboard/>}  >
          {/* <Route path="settings" element={<Settings />} /> */}
        </Route>
      </Routes>
    </HashRouter>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
