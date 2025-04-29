import React, { useState } from 'react';
import './styles/App.css';
import Sidebar from './components/Sidebar';
import UploadPDF from './components/UploadPDF';
import PDFLibrary from './components/PDFLibrary';
import Settings from './components/Settings';

function App() {
  const [currentView, setCurrentView] = useState('home');

  const renderContent = () => {
    switch(currentView) {
      case 'upload':
        return <UploadPDF />;
      case 'library':
        return <PDFLibrary />;
      case 'settings':
        return <Settings />;
      default:
        return <UploadPDF />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar onNavigate={setCurrentView} currentView={currentView} />
      <main className="main-content">
        <div className="content-wrapper">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;