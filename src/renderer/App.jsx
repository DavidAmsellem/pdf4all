import React, { useState } from 'react';
import './styles/App.css';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import Home from './components/Home';
import UploadPDF from './components/UploadPDF';
import PDFLibrary from './components/PDFLibrary';
import Settings from './components/Settings';

function App() {
    const [currentView, setCurrentView] = useState('home');

    const renderContent = () => {
        switch(currentView) {
            case 'home':
                return <Home />;
            case 'upload':
                return <UploadPDF />;
            case 'library':
                return <PDFLibrary />;
            case 'settings':
                return <Settings />;
            default:
                return <Home />;
        }
    };

    return (
        <div className="app-container">
            <TitleBar />
            <div className="app-content">
                <Sidebar onNavigate={setCurrentView} currentView={currentView} />
                <main className="main-content">
                    <div className="content-wrapper">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default App;