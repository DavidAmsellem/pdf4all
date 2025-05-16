import React, { useState } from 'react';
import { toast } from 'react-toastify';
import '../styles/YouSignButton.css';

const YouSignButton = ({ pdfId, title }) => {
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        signerEmail: '',
        signerName: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await window.electronAPI.sendToYouSign({
                pdfId,
                title,
                signerEmail: formData.signerEmail,
                signerName: formData.signerName
            });

            if (!result.success) {
                throw new Error(result.error || 'Error desconocido');
            }

            toast.success('Documento enviado para firma con YouSign');
            
            if (result.signingUrl) {
                window.open(result.signingUrl, '_blank');
            }
            
            setShowForm(false);
        } catch (error) {
            console.error('Error:', error);
            toast.error(error.message || 'Error al enviar documento para firma');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="yousign-container">
            {!showForm ? (
                <button
                    onClick={() => setShowForm(true)}
                    className="btn-action"
                    title="Firmar con YouSign"
                >
                    <i className="fas fa-signature"></i> YouSign
                </button>
            ) : (
                <form onSubmit={handleSubmit} className="yousign-form">
                    <div className="form-header">
                        <h3>Firmar con YouSign: {title}</h3>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="close-button"
                        >
                            ×
                        </button>
                    </div>
                    <div className="form-body">
                        <input
                            type="email"
                            placeholder="Email del firmante"
                            value={formData.signerEmail}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                signerEmail: e.target.value
                            }))}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Nombre del firmante"
                            value={formData.signerName}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                signerName: e.target.value
                            }))}
                            required
                        />
                    </div>
                    <div className="form-actions">
                        <button
                            type="submit"
                            disabled={loading}
                            className="submit-button"
                        >
                            {loading ? 'Enviando...' : 'Enviar para firma'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default YouSignButton;