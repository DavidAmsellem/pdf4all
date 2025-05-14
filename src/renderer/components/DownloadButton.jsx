import React, { useState } from 'react';
import { supabase } from '../../supabase/client';
import { encryptionService } from '../../services/encryptionService';
import { toast } from 'react-toastify';
import '../styles/DownloadButton.css';

const DownloadButton = ({ pdfData }) => {
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        try {
            setDownloading(true);

            // Verificar que tenemos los datos necesarios
            if (!pdfData || !pdfData.storage_path) {
                throw new Error('Información del PDF no disponible');
            }

            // Descifrar el nombre del archivo
            const decryptedTitle = pdfData.title_encrypted ? 
                encryptionService.decrypt(pdfData.title_encrypted) : 
                pdfData.title;

            // Obtener el archivo usando la ruta de almacenamiento
            const { data, error } = await supabase.storage
                .from('pdfs')
                .download(pdfData.storage_path);

            if (error) {
                console.error('Error de Supabase:', error);
                throw error;
            }

            // Crear el blob y descargar
            const blob = new Blob([data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            link.href = url;
            link.download = `${decryptedTitle}.pdf`;
            document.body.appendChild(link);
            link.click();
            
            // Limpieza
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
            
            toast.success('Archivo descargado correctamente');

        } catch (error) {
            console.error('Error al descargar:', error);
            toast.error('Error al descargar el archivo');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <button 
            onClick={handleDownload}
            disabled={downloading}
            className="download-button"
            title="Descargar PDF"
        >
            {downloading ? (
                <span className="loading-icon">⏳</span>
            ) : (
                <span className="download-icon">⬇️</span>
            )}
        </button>
    );
};

export default DownloadButton;