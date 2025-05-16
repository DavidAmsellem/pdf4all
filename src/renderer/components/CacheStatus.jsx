import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import PDFPreloader from './PDFPreloader';
import '../styles/CacheStatus.css';

const CacheStatus = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [key, setKey] = useState(0); // Añadimos una key para forzar el re-render

    const loadStats = async () => {
        try {
            const result = await window.electronAPI.getCacheStats();
            if (!result.success) throw new Error(result.error);
            setStats(result.stats);
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
            toast.error('Error al cargar estadísticas de caché');
        }
    };

    const handleClearCache = async () => {
        if (!confirm('¿Estás seguro de que quieres borrar todo el caché?')) return;
        
        setLoading(true);
        try {
            const result = await window.electronAPI.clearCache();
            if (!result.success) throw new Error(result.error);
            
            toast.success('Caché borrado correctamente');
            loadStats();
        } catch (error) {
            console.error('Error al borrar caché:', error);
            toast.error('Error al borrar caché');
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshCache = () => {
        setLoading(true);
        // Forzar re-render del PDFPreloader cambiando su key
        setKey(prevKey => prevKey + 1);
        // El loading se desactivará cuando termine la precarga
    };

    useEffect(() => {
        loadStats();
    }, []);

    if (!stats) return null;

    const formatSize = (bytes) => {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    return (
        <div className="cache-status">
            {/* Añadimos el PDFPreloader con key */}
            <PDFPreloader key={key} onFinish={() => setLoading(false)} />
            
            <div className="cache-info">
                <h3>Estado del Caché</h3>
                <div className="cache-stats">
                    <div className="stat-item">
                        <span>PDFs en caché:</span>
                        <span>{stats?.count}</span>
                    </div>
                    <div className="stat-item">
                        <span>Tamaño total:</span>
                        <span>{formatSize(stats?.size || 0)}</span>
                    </div>
                </div>
            </div>
            <div className="cache-actions">
                <button 
                    onClick={handleRefreshCache}
                    disabled={loading}
                    className="cache-button refresh"
                >
                    🔄 Actualizar
                </button>
                <button 
                    onClick={handleClearCache}
                    disabled={loading}
                    className="cache-button clear"
                >
                    🗑️ Borrar caché
                </button>
            </div>
        </div>
    );
};

export default CacheStatus;