import React from 'react';
import { toast } from 'react-toastify';
import '../styles/Settings.css';

const Settings = () => {
    const handleOpenCache = async () => {
        try {
            const result = await window.electronAPI.openCacheFolder();
            if (!result.success) {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error al abrir carpeta de caché:', error);
            toast.error('No se pudo abrir la carpeta de caché');
        }
    };

    return (
        <div className="settings-container animate-fade-in">
            <h2><i className="fas fa-cog"></i> Ajustes</h2>
            <div className="settings-grid">
                <div className="settings-card">
                    <h3>Apariencia</h3>
                    <div className="setting-item">
                        <label>Tema</label>
                        <select defaultValue="light">
                            <option value="light">Claro</option>
                            <option value="dark">Oscuro</option>
                        </select>
                    </div>
                </div>
                <div className="settings-card">
                    <h3>Almacenamiento</h3>
                    <div className="setting-item">
                        <label>Directorio de PDFs</label>
                        <button className="btn-change-dir">
                            <i className="fas fa-folder-open"></i> Cambiar
                        </button>
                    </div>
                    <div className="setting-item">
                        <label>Caché de PDFs</label>
                        <button 
                            onClick={handleOpenCache}
                            className="open-folder-button"
                        >
                            Abrir carpeta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;