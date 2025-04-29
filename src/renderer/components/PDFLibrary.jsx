import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { databaseService } from '../../services/databaseService';
import { toast } from 'react-toastify';
import './PDFLibrary.css'; // Asegúrate de que esta línea existe

const PDFLibrary = () => {
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [libraries, setLibraries] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedLibrary, setSelectedLibrary] = useState('');
    const [libraryPdfs, setLibraryPdfs] = useState({});

    // Cargar bibliotecas y sus PDFs
    const loadLibraries = async () => {
        setIsLoading(true);
        try {
            const { data: libs, error } = await databaseService.getUserLibraries(user.id);
            if (error) throw error;
            
            setLibraries(libs);
            
            // Cargar PDFs para cada biblioteca
            for (const library of libs) {
                await loadPDFsForLibrary(library.id);
            }
        } catch (error) {
            console.error('Error al cargar bibliotecas:', error);
            toast.error('Error al cargar las bibliotecas');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateLibrary = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await databaseService.createLibrary({
                name: formData.name,
                description: formData.description,
                userId: user.id
            });

            if (error) throw error;

            // Actualizar la lista de bibliotecas
            setLibraries(prev => [...prev, data]);
            
            // Resetear formulario y cerrar modal
            setFormData({ name: '', description: '' });
            setShowForm(false);
            
            toast.success('Biblioteca creada correctamente');
            
            // Recargar bibliotecas para obtener los conteos actualizados
            await loadLibraries();

        } catch (err) {
            console.error('Error al crear biblioteca:', err);
            setError(err.message);
            toast.error('Error al crear la biblioteca');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Añadir esta función para manejar la subida de PDF
    const handlePdfUpload = async (e) => {
        const file = e.target.files[0];
        console.log('Archivo seleccionado:', file); // Debug
        
        if (file && file.type === 'application/pdf') {
            if (file.size === 0) {
                toast.error('El archivo PDF está vacío');
                return;
            }
            setSelectedFile(file);
            setShowPdfModal(true);
        } else {
            toast.error('Por favor, selecciona un archivo PDF válido');
        }
    };

    // Cargar PDFs de una biblioteca específica
    const loadPDFsForLibrary = async (libraryId) => {
        try {
            const { data, error } = await databaseService.getPDFsByLibrary(libraryId);
            if (error) throw error;
            
            setLibraryPdfs(prev => ({
                ...prev,
                [libraryId]: data
            }));
            
            console.log('PDFs cargados para biblioteca:', libraryId, data); // Debug
        } catch (error) {
            console.error('Error al cargar PDFs:', error);
            toast.error('Error al cargar los PDFs de la biblioteca');
        }
    };

    // Modificar handleAssignPdf para recargar los PDFs después de asignar uno nuevo
    const handleAssignPdf = async (e) => {
        e.preventDefault();
        if (!selectedLibrary) {
            toast.error('Por favor, selecciona una biblioteca');
            return;
        }

        setLoading(true);
        try {
            if (!selectedFile) {
                throw new Error('No se ha seleccionado ningún archivo');
            }

            const fileData = {
                title: selectedFile.name.replace('.pdf', ''),
                fileName: selectedFile.name,
                libraryId: selectedLibrary,
                userId: user.id,
                fileSize: selectedFile.size || 0,
                file: selectedFile  // Añadir el archivo aquí
            };

            console.log('Datos a enviar:', fileData); // Debug
            console.log('Tamaño del archivo:', selectedFile.size); // Debug

            const { data, error } = await databaseService.createPDF(fileData);
            
            if (error) {
                throw new Error(error);
            }

            // Recargar los PDFs de la biblioteca específica
            await loadPDFsForLibrary(selectedLibrary);
            
            toast.success('PDF añadido correctamente');
            setShowPdfModal(false);
            setSelectedFile(null);
            setSelectedLibrary('');
            
        } catch (err) {
            console.error('Error al asignar PDF:', err);
            toast.error(err.message || 'Error al asignar el PDF');
        } finally {
            setLoading(false);
        }
    };

    // Cargar bibliotecas cuando el componente se monta
    useEffect(() => {
        if (user) {
            loadLibraries();
        }
    }, [user]);

    return (
        <div className="pdf-library-container">
            <div className="library-header">
                <h1>Mis Bibliotecas</h1>
                <div className="header-buttons">
                    <button 
                        className="create-library-button"
                        onClick={() => setShowForm(true)}
                    >
                        <i className="fas fa-plus"></i>
                        Nueva Biblioteca
                    </button>
                    <div className="pdf-upload-button">
                        <input
                            type="file"
                            id="pdf-upload"
                            accept=".pdf"
                            onChange={handlePdfUpload}
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="pdf-upload" className="upload-button">
                            <i className="fas fa-file-pdf"></i>
                            Subir PDF
                        </label>
                    </div>
                </div>
            </div>

            {showForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button 
                            className="close-button"
                            onClick={() => setShowForm(false)}
                        >
                            <i className="fas fa-times"></i>
                        </button>
                        
                        <form onSubmit={handleCreateLibrary} className="library-form">
                            <h2>Crear Nueva Biblioteca</h2>
                            
                            {error && (
                                <div className="form-error">
                                    {error}
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="name">Nombre*</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="description">Descripción</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows="4"
                                    disabled={loading}
                                />
                            </div>

                            <button 
                                type="submit" 
                                className="submit-button"
                                disabled={loading}
                            >
                                {loading ? 'Creando...' : 'Crear Biblioteca'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="loading-state">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Cargando bibliotecas...</p>
                </div>
            ) : (
                <div className="libraries-grid">
                    {libraries.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-book"></i>
                            <p>No tienes bibliotecas creadas</p>
                            <button 
                                className="create-first-library"
                                onClick={() => setShowForm(true)}
                            >
                                Crear mi primera biblioteca
                            </button>
                        </div>
                    ) : (
                        libraries.map(library => (
                            <div key={library.id} className="library-card animate-scale-in">
                                <div className="library-cover">
                                    <i className="fas fa-book-open"></i>
                                </div>
                                <div className="library-info">
                                    <h3>{library.name}</h3>
                                    <p>{library.description || 'Sin descripción'}</p>
                                    <div className="library-stats">
                                        <small>PDFs: {library.pdf_count || 0}</small>
                                        <small>Creada: {new Date(library.created_at).toLocaleDateString()}</small>
                                    </div>
                                    
                                    {/* Lista de PDFs */}
                                    <div className="pdf-list">
                                        <h4>PDFs en esta biblioteca:</h4>
                                        {libraryPdfs[library.id]?.length > 0 ? (
                                            libraryPdfs[library.id].map(pdf => (
                                                <div key={pdf.id} className="pdf-item">
                                                    <i className="fas fa-file-pdf"></i>
                                                    <span className="pdf-title">{pdf.title}</span>
                                                    <div className="pdf-actions">
                                                        <button className="btn-open" title="Abrir PDF">
                                                            <i className="fas fa-external-link-alt"></i>
                                                        </button>
                                                        <button className="btn-delete" title="Eliminar PDF">
                                                            <i className="fas fa-trash-alt"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="no-pdfs">No hay PDFs en esta biblioteca</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Modal de selección de biblioteca */}
            {showPdfModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button 
                            className="close-button"
                            onClick={() => {
                                setShowPdfModal(false);
                                setSelectedFile(null);
                                setSelectedLibrary('');
                            }}
                        >
                            <i className="fas fa-times"></i>
                        </button>
                        
                        <form onSubmit={handleAssignPdf} className="library-form">
                            <h2>Asignar PDF a Biblioteca</h2>
                            
                            <div className="form-group">
                                <p className="selected-file">
                                    Archivo seleccionado: {selectedFile?.name}
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="library">Seleccionar Biblioteca*</label>
                                <select
                                    id="library"
                                    value={selectedLibrary}
                                    onChange={(e) => setSelectedLibrary(e.target.value)}
                                    required
                                    disabled={loading}
                                >
                                    <option value="">Selecciona una biblioteca</option>
                                    {libraries.map(library => (
                                        <option key={library.id} value={library.id}>
                                            {library.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button 
                                type="submit" 
                                className="submit-button"
                                disabled={loading || !selectedLibrary}
                            >
                                {loading ? 'Asignando...' : 'Asignar PDF'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PDFLibrary;