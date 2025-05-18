import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { formatRelativeTime } from '../../utils/dateUtils';
import { supabase } from '../../../supabase/client';
import '../../styles/sign/DocumentSigningLog.css';

const DocumentSigningLog = () => {
    const [signatureEvents, setSignatureEvents] = useState({});    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('kanban');
    const [searchTerm, setSearchTerm] = useState('');
    const [columns, setColumns] = useState({
        inProgress: {
            id: 'inProgress',
            title: 'En Proceso',
            items: []
        },
        completed: {
            id: 'completed',
            title: 'Completados',
            items: []
        },
        rejected: {
            id: 'rejected',
            title: 'Rechazados',
            items: []
        }
    });

    useEffect(() => {
        loadSignatureEvents();
        
        const channel = supabase
            .channel('email-status-changes')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'yousign_events' },
                () => loadSignatureEvents()
            )
            .subscribe();

        return () => channel.unsubscribe();
    }, []);

    const getSignerStatusIcon = (status) => {
        const iconMap = {
            'notified': 'fa-envelope',
            'activated': 'fa-check-circle',
            'signed': 'fa-signature',
            'link_opened': 'fa-external-link-alt',
            'done': 'fa-check-double',
            'refused': 'fa-times-circle',
            'expired': 'fa-clock'
        };
        return iconMap[status?.toLowerCase()] || 'fa-question-circle';
    };

    const getSignerStatusText = (status) => {
        const statusMap = {
            'notified': 'Notificado | Notified',
            'activated': 'Activado | Activated',
            'signed': 'Firmado | Signed',
            'link_opened': 'Enlace abierto | Link opened',
            'done': 'Completado | Done',
            'refused': 'Rechazado | Refused',
            'expired': 'Expirado | Expired'
        };
        return statusMap[status?.toLowerCase()] || 'Desconocido | Unknown';
    };

    const loadSignatureEvents = async () => {
        try {
            setLoading(true);
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

            setSignatureEvents(grouped);
            updateColumns(grouped);
        } catch (error) {
            console.error('Error loading signature events:', error);
        } finally {
            setLoading(false);
        }
    };    const updateColumns = (events) => {
        const newColumns = {
            inProgress: { ...columns.inProgress, items: [] },
            completed: { ...columns.completed, items: [] },
            rejected: { ...columns.rejected, items: [] }
        };

        Object.entries(events).forEach(([procedureId, procedure]) => {
            const status = procedure.currentStatus?.toLowerCase();
            const item = {
                id: procedureId,
                title: procedure.documentName,
                documentName: procedure.documentName,
                status: status,
                date: procedure.events[procedure.events.length - 1]?.created_at,
                recipients: procedure.signers.map(signer => ({
                    name: `${signer.firstName} ${signer.lastName}`,
                    status: signer.status,
                    email: signer.email
                })),
                history: procedure.events.map(event => ({
                    type: event.metadata.event_name,
                    description: getEventName(event.metadata.event_name),
                    date: event.created_at
                }))
            };

            // Mapear los estados de YouSign a nuestras columnas
            switch(status) {
                case 'pending':
                case 'initiated':
                    newColumns.pending.items.push(item);
                    break;
                case 'ongoing':
                    newColumns.inProgress.items.push(item);
                    break;
                case 'done':
                case 'completed':
                    newColumns.completed.items.push(item);
                    break;
                case 'refused':
                case 'expired':
                    newColumns.rejected.items.push(item);
                    break;
                default:
                    newColumns.pending.items.push(item);
            }
        });

        setColumns(newColumns);
    };

    const onDragEnd = (result) => {
        if (!result.destination) return;
        
        const { source, destination } = result;
        
        if (source.droppableId !== destination.droppableId) {
            const sourceColumn = columns[source.droppableId];
            const destColumn = columns[destination.droppableId];
            const sourceItems = [...sourceColumn.items];
            const destItems = [...destColumn.items];
            const [removed] = sourceItems.splice(source.index, 1);
            destItems.splice(destination.index, 0, removed);
            
            setColumns({
                ...columns,
                [source.droppableId]: {
                    ...sourceColumn,
                    items: sourceItems
                },
                [destination.droppableId]: {
                    ...destColumn,
                    items: destItems
                }
            });
        } else {
            const column = columns[source.droppableId];
            const copiedItems = [...column.items];
            const [removed] = copiedItems.splice(source.index, 1);
            copiedItems.splice(destination.index, 0, removed);
            
            setColumns({
                ...columns,
                [source.droppableId]: {
                    ...column,
                    items: copiedItems
                }
            });
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
            'done': { class: 'status-completed', text: 'Completado | Done' },
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
    };    const renderKanbanItem = (item, provided, snapshot) => (
        <div
            className={`kanban-item ${snapshot.isDragging ? 'dragging' : ''}`}
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
        >
            <div className="document-header">
                <div className="document-info">
                    <h4 className="document-title">{item.documentName}</h4>
                    <span className={`status-badge ${getStatusBadge(item.status).class}`}>
                        <i className="fas fa-circle"></i>
                        {getStatusBadge(item.status).text}
                    </span>
                </div>
                <button 
                    className="delete-button" 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteSignatureRecord(item.id);
                    }}
                >
                    <i className="fas fa-trash"></i>
                </button>
            </div>

            <div className="document-meta">
                <span>
                    <i className="fas fa-calendar"></i>
                    {formatDate(item.date)}
                </span>
            </div>

            <div className="document-recipients">
                <h5>Firmantes:</h5>
                {item.recipients.map((recipient, index) => (
                    <span key={index} className="recipient">
                        <i className="fas fa-user"></i>
                        <div className="recipient-info">
                            <span>{recipient.name}</span>
                            <small>{recipient.email}</small>
                        </div>
                        <span className={`status-dot status-${recipient.status}`}></span>
                    </span>
                ))}
            </div>

            {item.history && (
                <div className="document-history">
                    <h5>Historial:</h5>
                    {item.history.map((event, index) => (
                        <div key={index} className="history-event">
                            <i className="fas fa-clock"></i>
                            <span>{event.description}</span>
                            <small>{formatDate(event.date)}</small>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // Renderizado de la vista de lista
    const renderListView = () => (
        <div className="email-status-list">
            {Object.entries(columns.inProgress.items.concat(columns.completed.items, columns.rejected.items))
                .map(([_, item]) => (
                    <div key={item.id} className="email-card">
                        <div className="email-header">                            <div className="document-info">
                                <h4>{item.documentName}</h4>
                                <span className={`status-badge ${getStatusBadge(item.status).class}`}>
                                    <i className="fas fa-circle"></i>
                                    {getStatusBadge(item.status).text}
                                </span>
                            </div>
                            <div className="document-actions">
                                <button 
                                    className="delete-button" 
                                    onClick={() => deleteSignatureRecord(item.id)}
                                >
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                            <div className="document-meta">
                                <span>
                                    <i className="fas fa-calendar"></i>
                                    {formatDate(item.date)}
                                </span>
                            </div>
                        </div>

                        <div className="document-recipients">
                            <h5>
                                <i className="fas fa-users"></i>
                                Firmantes ({item.recipients.length})
                            </h5>
                            {item.recipients.map((recipient, index) => (
                                <div key={index} className="recipient">
                                    <i className="fas fa-user"></i>
                                    <div className="recipient-info">
                                        <span>{recipient.name}</span>
                                        <small>{recipient.email}</small>
                                    </div>
                                    <div className={`recipient-status status-${recipient.lastEvent}`}>
                                        <i className={getSignerStatusIcon(recipient.lastEvent)}></i>
                                        {getSignerStatusText(recipient.lastEvent)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {item.history && (
                            <div className="document-history">
                                <h5>
                                    <i className="fas fa-history"></i>
                                    Historial
                                </h5>
                                {item.history.map((event, index) => (
                                    <div key={index} className="history-event">
                                        <i className={getSignerStatusIcon(event.type)}></i>
                                        <span>
                                            {event.description}
                                            {event.signer && ` - ${event.signer.first_name} ${event.signer.last_name}`}
                                        </span>
                                        <small>{formatDate(event.date)}</small>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
        </div>
    );

    // Vista Kanban existente
    const renderKanbanView = () => (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="kanban-board">
                {Object.entries(columns).map(([columnId, column]) => (
                    <div className="kanban-column" key={columnId}>
                        <h3 className="kanban-column-title">
                            {column.title}
                            <span className="document-count">{column.items.length}</span>
                        </h3>
                        <Droppable droppableId={columnId}>
                            {(provided, snapshot) => (
                                <div
                                    className={`kanban-items ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                >
                                    {column.items.map((item, index) => (
                                        <Draggable 
                                            key={item.id} 
                                            draggableId={item.id.toString()} 
                                            index={index}
                                        >
                                            {(provided, snapshot) => renderKanbanItem(item, provided, snapshot)}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </div>
        </DragDropContext>
    );

    const filterItems = (items) => {
        if (!searchTerm) return items;
        
        return items.filter(item => {
            const searchTermLower = searchTerm.toLowerCase();
            // Buscar en el nombre del documento
            if (item.documentName.toLowerCase().includes(searchTermLower)) return true;
            // Buscar en los firmantes
            if (item.recipients.some(recipient => 
                recipient.name.toLowerCase().includes(searchTermLower) ||
                recipient.email.toLowerCase().includes(searchTermLower)
            )) return true;
            // Buscar en el historial
            if (item.history.some(event => 
                event.description.toLowerCase().includes(searchTermLower)
            )) return true;
            return false;
        });
    };    const deleteSignatureRecord = async (procedureId) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este registro de firma?')) {
            return;
        }

        try {
            setLoading(true);
            
            // Primero obtenemos los IDs de los registros a eliminar
            const { data: eventsToDelete, error: fetchError } = await supabase
                .from('yousign_events')
                .select('id, metadata')
                .not('metadata', 'is', null);

            if (fetchError) {
                console.error('Error al buscar registros:', fetchError);
                throw fetchError;
            }

            // Filtramos los eventos que corresponden a este procedimiento
            const eventIds = eventsToDelete
                .filter(event => 
                    event.metadata?.data?.signature_request?.id === procedureId
                )
                .map(event => event.id);

            if (eventIds.length === 0) {
                throw new Error('No se encontraron registros para eliminar');
            }

            // Eliminamos los eventos usando sus IDs
            const { error: deleteError } = await supabase
                .from('yousign_events')
                .delete()
                .in('id', eventIds);

            if (deleteError) {
                console.error('Error al eliminar registros:', deleteError);
                throw deleteError;
            }

            // Actualizamos el estado local
            const newColumns = Object.entries(columns).reduce((acc, [columnId, column]) => {
                acc[columnId] = {
                    ...column,
                    items: column.items.filter(item => item.id !== procedureId)
                };
                return acc;
            }, {});

            setColumns(newColumns);
            
            // Actualizar también el estado de signatureEvents
            const updatedEvents = { ...signatureEvents };
            delete updatedEvents[procedureId];
            setSignatureEvents(updatedEvents);

            alert('Registro eliminado correctamente');
        } catch (error) {
            console.error('Error al eliminar el registro:', error);
            alert(`Error al eliminar el registro: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <i className="fas fa-spinner fa-spin"></i>
                <span>Cargando estados de firmas...</span>
            </div>
        );
    }    return (
        <div className="signing-log-container">
            <header className="signing-log-header">
                <h2>
                    <i className="fas fa-history"></i>
                    Registro de Firmas
                </h2>
            </header>

            <div className="signing-log-content">
                {/* Panel principal con selector de vista y contenido */}
                <div className="signing-log-main full-width">
                    <div className="view-selector">
                        <button 
                            className={`view-tab ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                        >
                            <i className="fas fa-list"></i>
                            Vista Lista
                        </button>
                        <button 
                            className={`view-tab ${viewMode === 'kanban' ? 'active' : ''}`}
                            onClick={() => setViewMode('kanban')}
                        >
                            <i className="fas fa-columns"></i>
                            Vista Kanban
                        </button>
                    </div>

                    {viewMode === 'list' ? renderListView() : renderKanbanView()}
                </div>
            </div>
        </div>
    );
};

export default DocumentSigningLog;