import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase/client';
import '../styles/EmailStatusList.css';

const EmailStatusList = () => {
    const [signatureProcedures, setSignatureProcedures] = useState({});
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        loadEmails();
        
        const channel = supabase
            .channel('email-status-changes')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'yousign_events' },
                () => loadEmails()
            )
            .subscribe();

        return () => channel.unsubscribe();
    }, []);

    const loadEmails = async () => {
        try {
            const { data, error } = await supabase
                .from('yousign_events')
                .select('*, metadata')
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Agrupar por ID de procedimiento
            const grouped = data.reduce((acc, event) => {
                const procedureId = event.metadata?.data?.signature_request?.id;
                if (!procedureId) return acc;

                if (!acc[procedureId]) {
                    acc[procedureId] = {
                        events: [],
                        currentStatus: '',
                        documentName: '',
                        expiration_date: null,
                        workspace_id: '',
                        signers: []
                    };
                }

                const signatureRequest = event.metadata?.data?.signature_request;
                const signerInfo = event.metadata?.data?.signer?.info;
                
                // Actualizar información del procedimiento
                acc[procedureId].events.push(event);
                acc[procedureId].currentStatus = signatureRequest?.status || acc[procedureId].currentStatus;
                acc[procedureId].documentName = signatureRequest?.name || acc[procedureId].documentName;

                // Actualizar información del firmante si está presente
                if (signerInfo) {
                    const signer = {
                        id: event.metadata?.data?.signer?.id,
                        email: signerInfo.email,
                        firstName: signerInfo.first_name,
                        lastName: signerInfo.last_name,
                        status: event.metadata?.data?.signer?.status
                    };
                    
                    // Actualizar o añadir firmante
                    const existingSignerIndex = acc[procedureId].signers.findIndex(s => s.id === signer.id);
                    if (existingSignerIndex >= 0) {
                        acc[procedureId].signers[existingSignerIndex] = signer;
                    } else {
                        acc[procedureId].signers.push(signer);
                    }
                }

                return acc;
            }, {});

            setSignatureProcedures(grouped);
        } catch (error) {
            console.error('Error cargando emails:', error);
        } finally {
            setLoading(false);
        }
    };

    const getEventName = (eventName) => {
        const eventMap = {
            // Eventos de firma
            'signature_request.activated': 'Solicitud de firma activada | Signature request activated',
            'signature_request.completed': 'Solicitud de firma completada | Signature request completed',
            'signature_request.expired': 'Solicitud de firma expirada | Signature request expired',
            'signature_request.refused': 'Solicitud de firma rechazada | Signature request refused',
            'signature_request.done': 'Firma completada | Signature completed',
            
            // Eventos del firmante
            'signer.notified': 'Firmante notificado | Signer notified',
            'signer.signed': 'Firmante ha firmado | Signer has signed',
            'signer.link_opened': 'Enlace abierto | Link opened',
            'signer.done': 'Firmante completado | Signer completed',
            
            // Estado general
            'completed': 'Completado | Completed',
            'ongoing': 'En proceso | Ongoing',
            'expired': 'Expirado | Expired',
            'refused': 'Rechazado | Refused'
        };
        return eventMap[eventName] || eventName;
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            'ongoing': { class: 'status-ongoing', text: 'En Proceso | Ongoing' },
            'completed': { class: 'status-completed', text: 'Completado | Completed' },
            'refused': { class: 'status-refused', text: 'Rechazado | Refused' },
            'expired': { class: 'status-expired', text: 'Expirado | Expired' },
            'initiated': { class: 'status-initiated', text: 'Iniciado | Initiated' }
        };
        return statusMap[status?.toLowerCase()] || { class: 'status-unknown', text: status || 'Desconocido | Unknown' };
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const downloadSignedDocument = async (procedureId) => {
        try {
            setDownloading(true);
            const response = await fetch(`${process.env.YOUSIGN_API_URL}/procedures/${procedureId}/files`, {
                headers: {
                    'Authorization': `Bearer ${process.env.YOUSIGN_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Error al obtener el documento');

            const data = await response.json();
            const downloadUrl = data[0]?.download_url;

            if (downloadUrl) {
                const documentResponse = await fetch(downloadUrl);
                const blob = await documentResponse.blob();
                
                // Crear URL para descarga
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `documento_firmado_${procedureId}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('Error descargando documento:', error);
            toast.error('Error al descargar el documento firmado');
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <i className="fas fa-spinner fa-spin"></i>
                <span>Cargando estados de firmas...</span>
            </div>
        );
    }

    return (
        <div className="email-status-list">
            {Object.entries(signatureProcedures).map(([procedureId, procedure]) => (
                <div key={procedureId} className="email-card">
                    <div className="email-header">
                        <div className="document-info">
                            <h4>{procedure.documentName}</h4>
                            <span className={`status-badge ${getStatusBadge(procedure.currentStatus).class}`}>
                                {getStatusBadge(procedure.currentStatus).text}
                            </span>
                        </div>
                        <div className="document-actions">
                            {procedure.currentStatus === 'completed' && (
                                <button 
                                    className="download-button"
                                    onClick={() => downloadSignedDocument(procedureId)}
                                    disabled={downloading}
                                >
                                    <i className="fas fa-download"></i>
                                    {downloading ? 'Descargando...' : 'Descargar PDF'}
                                </button>
                            )}
                            <span className="email-date">
                                {formatDate(procedure.events[procedure.events.length - 1]?.created_at)}
                            </span>
                        </div>
                    </div>
                    <div className="email-details">
                        <div className="signers-list">
                            <h5>Firmantes:</h5>
                            {procedure.signers.map(signer => (
                                <p key={signer.id} className="signer-info">
                                    <i className="fas fa-user"></i>
                                    <div className="signer-details">
                                        <span className="signer-name">
                                            {signer.firstName} {signer.lastName}
                                        </span>
                                        <span className="signer-email">{signer.email || 'Sin correo'}</span>
                                        <span className="signer-status">Estado: {signer.status}</span>
                                    </div>
                                </p>
                            ))}
                        </div>
                        <div className="events-timeline">
                            <h5>Historial:</h5>
                            {procedure.events.map(event => (
                                <p key={event.id} className="event-info">
                                    <i className="fas fa-clock"></i>
                                    <span>{formatDate(event.created_at)}: {getEventName(event.metadata.event_name)}</span>
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default EmailStatusList;