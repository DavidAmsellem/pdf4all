import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useAuth, AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import './styles/App.css';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import Home from './components/Home';
import PDFLibrary from './components/PDFLibrary';
import Settings from './components/Settings';
import Auth from './components/Auth';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import PDFPreloader from './components/PDFPreloader';



function App() {
    const [currentView, setCurrentView] = useState('home');
    const { user } = useAuth();
    const [darkMode, setDarkMode] = useState(false);

    // Cuando user sea null (después del logout), 
    // automáticamente se mostrará el componente Auth
    if (!user) {
        return <Auth />;
    }

    const renderContent = () => {
        switch(currentView) {
            case 'home':
                return <Home />;
            case 'library':
                return <PDFLibrary />;
            case 'settings':
                return <Settings />;
            default:
                return <Home />;
        }
    };

    return (
        <AuthProvider>
            <ThemeProvider>
                <div className="app" data-theme={darkMode ? 'dark' : 'light'}>
                    <PDFPreloader />
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
                    <ToastContainer 
                        position="bottom-right"
                        autoClose={3000}
                        hideProgressBar={false}
                        newestOnTop
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                    />
                </div>
            </ThemeProvider>
        </AuthProvider>
    );
}

export default App;