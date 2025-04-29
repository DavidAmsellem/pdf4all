import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../context/AuthContext';
import './styles/App.css';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import Home from './components/Home';
import UploadPDF from './components/UploadPDF';
import PDFLibrary from './components/PDFLibrary';
import Settings from './components/Settings';
import Auth from './components/Auth';

function App() {
    const [currentView, setCurrentView] = useState('home');
    const { user } = useAuth();

    // Cuando user sea null (después del logout), 
    // automáticamente se mostrará el componente Auth
    if (!user) {
        return <Auth />;
    }

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
                <Sidebar 
                    onNavigate={setCurrentView} 
                    currentView={currentView}
                    user={user}
                />
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