import React, { useState } from 'react';
import { toast } from 'react-toastify';
import YouSignWizard from './YouSignWizard';
import '../styles/YouSignButton.css'; // Asegúrate de que la ruta sea correcta

// Componente funcional que recibe pdfId y title como props
const YouSignButton = ({ pdfId, title }) => {
    // Estado para controlar el estado de carga
    const [loading, setLoading] = useState(false);
    // Estado para mostrar/ocultar el wizard
    const [showWizard, setShowWizard] = useState(false);

    // Función que maneja el envío del formulario
    const handleSubmit = async (e) => {
        e.preventDefault(); // Previene el comportamiento por defecto del formulario
        setLoading(true); // Activa el estado de carga

        const formData = new FormData(e.target);
        const data = {
            pdfId,
            title,
            signerEmail: formData.get('signerEmail'),
            signerName: formData.get('signerName')
        };

        try {
            // Envía los datos a la API de electron
            const result = await window.electronAPI.sendToYouSign(data);

            // Si no hay éxito, lanza un error
            if (!result.success) {
                throw new Error(result.error || 'Error desconocido');
            }

            // Muestra notificación de éxito
            toast.success('Documento enviado para firma con YouSign');
            
            // Si hay URL de firma, abre en nueva pestaña
            if (result.signingUrl) {
                window.open(result.signingUrl, '_blank');
            }
            
            setShowWizard(false); // Oculta el wizard
        } catch (error) {
            console.error('Error:', error);
            // Muestra notificación de error
            toast.error(error.message || 'Error al enviar documento para firma');
        } finally {
            setLoading(false); // Desactiva el estado de carga
        }
    };

    return (
        // Contenedor principal
        <>
            {/* Botón para abrir el wizard */}
            <button
                onClick={() => setShowWizard(true)}
                className="btn-action"
                title="Firmar con YouSign"
            >
                <i className="fas fa-signature"></i> YouSign
            </button>
            
            {/* Wizard para firma con YouSign */}
            <YouSignWizard
                isOpen={showWizard}
                onClose={() => setShowWizard(false)}
                onSubmit={handleSubmit}
                title={title}
                loading={loading}
            />
        </>
    );
};

export default YouSignButton; // Exporta el componente