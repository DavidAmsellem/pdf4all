// Importaciones necesarias de React y otras bibliotecas/servicios.
import React, { useState, useEffect } from 'react'; // Hooks básicos de React para estado y efectos secundarios.
import { useAuth } from '../../context/AuthContext'; // Hook personalizado para acceder al contexto de autenticación (usuario current).
import { databaseService } from '../../services/databaseService'; // Servicio para interactuar con la base de datos (Supabase).
import { toast } from 'react-toastify'; // Librería para mostrar notificaciones (toasts).
import '../styles/PDFLibrary.css'; // Estilos CSS específicos para este componente.
import { supabase } from '../../supabase/client';  // Cliente Supabase para operaciones directas (ej. storage).
import * as pdfjsLib from 'pdfjs-dist'; // Librería PDF.js para trabajar con archivos PDF (actualmente no se usa directamente en este componente, pero sí su worker).
import DownloadButton from './DownloadButton'; // Componente para el botón de descarga.
import YouSignButton from './YouSignButton'; // Componente para el botón de firma con YouSign.

// Configuración global para el worker de PDF.js, necesario para que la librería funcione correctamente en el navegador.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Definición del componente funcional PDFLibrary.
const PDFLibrary = () => {
    // --- ESTADOS DEL COMPONENTE ---
    const { user } = useAuth(); // Obtiene el usuario actual del contexto de autenticación.
    const [showForm, setShowForm] = useState(false); // Controla la visibilidad del modal/formulario para crear una nueva biblioteca.
    const [libraries, setLibraries] = useState([]); // Almacena la lista de bibliotecas del usuario.
    const [formData, setFormData] = useState({ // Estado para los datos del formulario de creación de biblioteca.
        name: '',
        description: ''
    });
    const [loading, setLoading] = useState(false); // Estado de carga para operaciones específicas (ej. crear biblioteca, asignar PDF).
    const [error, setError] = useState(null); // Almacena mensajes de error para mostrar en el formulario o UI.
    const [isLoading, setIsLoading] = useState(true); // Estado de carga general para la carga inicial de bibliotecas.
    const [showPdfModal, setShowPdfModal] = useState(false); // Controla la visibilidad del modal para asignar un PDF a una biblioteca.
    const [selectedFile, setSelectedFile] = useState(null); // Almacena el archivo PDF seleccionado para subir.
    const [selectedLibrary, setSelectedLibrary] = useState(''); // Almacena el ID de la biblioteca seleccionada para asignar un PDF.
    const [libraryPdfs, setLibraryPdfs] = useState({}); // Objeto para almacenar los PDFs de cada biblioteca (clave: libraryId, valor: array de PDFs).
    const [uploadingImage, setUploadingImage] = useState(null); // Almacena el ID de la biblioteca cuya imagen de portada se está subiendo.
    const [stats, setStats] = useState(null); // Almacena estadísticas del usuario (ej. total PDFs, espacio usado).
    const [expandedLibrary, setExpandedLibrary] = useState(null); // Almacena el ID de la biblioteca que está actualmente expandida para mostrar sus PDFs.

    // --- FUNCIONES DE CARGA DE DATOS ---

    /**
     * Carga las bibliotecas del usuario actual y, para cada una, carga sus PDFs asociados.
     * Se ejecuta al montar el componente o cuando cambia el usuario.
     */
    const loadLibraries = async () => {
        setIsLoading(true); // Activa el estado de carga general.
        try {
            // Obtiene las bibliotecas del usuario desde el servicio de base de datos.
            const { data: libs, error: libsError } = await databaseService.getUserLibraries(user.id);
            if (libsError) throw libsError; // Si hay error, lo lanza para ser capturado por el catch.
            
            setLibraries(libs || []); // Actualiza el estado con las bibliotecas obtenidas (o un array vacío si no hay).
            
            // Para cada biblioteca cargada, carga sus PDFs.
            // Consideración: Si hay muchas bibliotecas, esto podría generar muchas llamadas secuenciales.
            // Se podría optimizar con Promise.all si las llamadas a loadPDFsForLibrary son independientes.
            const pdfLoadPromises = (libs || []).map(library => loadPDFsForLibrary(library.id));
            await Promise.all(pdfLoadPromises);

        } catch (error) {
            console.error('Error al cargar bibliotecas:', error);
            toast.error('Error al cargar las bibliotecas');
        } finally {
            setIsLoading(false); // Desactiva el estado de carga general.
        }
    };

    /**
     * Carga los PDFs para una biblioteca específica y actualiza el estado `libraryPdfs`.
     * @param {string} libraryId - El ID de la biblioteca cuyos PDFs se van a cargar.
     */
    const loadPDFsForLibrary = async (libraryId) => {
        try {
            const { data, error } = await databaseService.getPDFsByLibrary(libraryId);
            if (error) throw error;
            
            // Actualiza el estado `libraryPdfs` con los PDFs de la biblioteca específica.
            setLibraryPdfs(prev => ({
                ...prev,
                [libraryId]: data || [] // Asegura que sea un array
            }));
            
            // console.log('PDFs cargados para biblioteca:', libraryId, data); // Debug
        } catch (error) {
            console.error(`Error al cargar PDFs para la biblioteca ${libraryId}:`, error);
            // No se muestra toast aquí para no saturar si falla la carga de PDFs de múltiples bibliotecas.
            // El error general se maneja en loadLibraries.
        }
    };
    
    /**
     * Carga las estadísticas del usuario (total de PDFs, tamaño total).
     */
    const loadStats = async () => {
        try {
            const { data, error } = await databaseService.getStats(user.id);
            if (error) throw error;
            setStats(data);
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
            toast.error('Error al cargar estadísticas');
        }
    };

    // --- MANEJADORES DE EVENTOS Y ACCIONES ---

    /**
     * Maneja la creación de una nueva biblioteca.
     * Se dispara al enviar el formulario de creación de biblioteca.
     * @param {Event} e - El evento del formulario.
     */
    const handleCreateLibrary = async (e) => {
        e.preventDefault(); // Previene el comportamiento por defecto del formulario (recarga de página).
        setLoading(true); // Activa el estado de carga específico de la acción.
        setError(null); // Limpia errores previos.

        try {
            // Llama al servicio para crear la biblioteca en la base de datos.
            const { data: newLibrary, error: createError } = await databaseService.createLibrary({
                name: formData.name,
                description: formData.description,
                userId: user.id
            });

            if (createError) throw createError;

            // Actualiza la lista de bibliotecas en el estado local añadiendo la nueva.
            // Se usa un callback en setLibraries para asegurar que se basa en el estado más reciente.
            setLibraries(prev => [...prev, newLibrary]); 
            
            // Resetea el formulario y cierra el modal.
            setFormData({ name: '', description: '' });
            setShowForm(false);
            
            toast.success('Biblioteca creada correctamente');
            
            // Recarga las estadísticas y la lista de bibliotecas para reflejar los cambios (ej. conteos).
            // Consideración: loadLibraries recarga todo. Podría ser más eficiente solo actualizar stats
            // y la nueva biblioteca ya está añadida localmente. Sin embargo, recargar asegura consistencia.
            await loadStats(); 
            // No es necesario llamar a loadLibraries() aquí si la nueva biblioteca ya se añadió
            // y no hay otros datos que necesiten ser recargados de todas las bibliotecas.
            // Si `pdf_count` se actualiza en el backend y se quiere mostrar inmediatamente,
            // se podría refactorizar `loadLibraries` o hacer una carga más específica.

        } catch (err) {
            console.error('Error al crear biblioteca:', err);
            setError(err.message || 'Error desconocido al crear la biblioteca.'); // Muestra el error en el formulario.
            toast.error('Error al crear la biblioteca');
        } finally {
            setLoading(false); // Desactiva el estado de carga específico.
        }
    };

    /**
     * Actualiza el estado `formData` cuando el usuario escribe en los campos del formulario.
     * @param {Event} e - El evento de cambio del input.
     */
    const handleChange = (e) => {
        const { name, value } = e.target; // Obtiene el nombre y valor del campo que cambió.
        setFormData(prev => ({ // Actualiza el estado del formulario.
            ...prev, // Mantiene los valores previos.
            [name]: value // Actualiza el campo específico.
        }));
    };

    /**
     * Maneja la selección de un archivo PDF desde el input de tipo "file".
     * Valida el archivo y muestra el modal para asignarlo a una biblioteca.
     * @param {Event} e - El evento de cambio del input file.
     */
    const handlePdfUpload = async (e) => {
        const file = e.target.files[0]; // Obtiene el primer archivo seleccionado.
        // console.log('Archivo seleccionado:', file); // Debug
        
        if (file && file.type === 'application/pdf') { // Verifica que sea un PDF.
            if (file.size === 0) { // Verifica que no esté vacío.
                toast.error('El archivo PDF está vacío');
                e.target.value = null; // Resetea el input file
                return;
            }
            setSelectedFile(file); // Guarda el archivo en el estado.
            setShowPdfModal(true); // Muestra el modal de asignación.
        } else if (file) { // Si se seleccionó un archivo pero no es PDF.
            toast.error('Por favor, selecciona un archivo PDF válido');
            e.target.value = null; // Resetea el input file
        }
        // Si no se selecciona archivo, no hace nada.
    };


    /**
     * Maneja la asignación de un PDF (previamente seleccionado) a una biblioteca.
     * Se dispara al enviar el formulario del modal de asignación.
     * @param {Event} e - El evento del formulario.
     */
    const handleAssignPdf = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!selectedFile || !selectedLibrary) { // Validación básica.
                throw new Error('Selecciona un archivo y una biblioteca');
            }

            // Prepara los datos del archivo para enviar al servicio.
            const fileData = {
                title: selectedFile.name.replace(/\.pdf$/i, ''), // Quita la extensión .pdf del título.
                fileName: selectedFile.name,
                libraryId: selectedLibrary,
                userId: user.id,
                fileSize: selectedFile.size,
                file: selectedFile // El objeto File en sí.
            };

            // Llama al servicio para crear el registro del PDF y subir el archivo.
            const { data: newPdf, error: createPdfError } = await databaseService.createPDF(fileData);
            
            if (createPdfError) {
                console.error('Error detallado al crear PDF:', createPdfError);
                throw new Error(createPdfError.message || 'Error al subir el PDF.');
            }

            // Actualiza el estado local de los PDFs para la biblioteca afectada.
            setLibraryPdfs(prev => ({
                ...prev,
                [selectedLibrary]: [...(prev[selectedLibrary] || []), newPdf]
            }));
            
            toast.success('PDF añadido correctamente');
            setShowPdfModal(false); // Cierra el modal.
            setSelectedFile(null); // Limpia el archivo seleccionado.
            setSelectedLibrary(''); // Limpia la biblioteca seleccionada.
            document.getElementById('pdf-upload').value = null; // Resetea el input file.

            // Recarga las estadísticas y la lista de bibliotecas para actualizar conteos.
            // Consideración: Similar a handleCreateLibrary, loadLibraries() recarga todo.
            // Podría ser más eficiente actualizar solo los contadores de la biblioteca afectada.
            await loadStats();
            await loadLibraries(); // Para actualizar el `pdf_count` en la tarjeta de la biblioteca.

        } catch (err) {
            toast.error(err.message || 'Error al asignar el PDF');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Maneja la subida de una imagen de portada para una biblioteca.
     * @param {Event} e - El evento de cambio del input file de imagen.
     * @param {string} libraryId - El ID de la biblioteca para la cual se sube la imagen.
     */
    const handleImageUpload = async (e, libraryId) => {
        const file = e.target.files[0];
        if (!file) return; // Si no se selecciona archivo, no hace nada.

        if (!file.type.startsWith('image/')) { // Valida que sea una imagen.
            toast.error('Por favor, selecciona una imagen válida');
            return;
        }

        setUploadingImage(libraryId); // Indica que se está subiendo una imagen para esta biblioteca (para UI).
        try {
            // Genera un nombre de archivo único para evitar colisiones en el storage.
            const fileName = `library-covers/user_${user.id}/${libraryId}-${Date.now()}-${file.name}`;
            
            // Sube la imagen al bucket 'library-covers' de Supabase Storage.
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('library-covers') // Nombre del bucket.
                .upload(fileName, file, { upsert: true }); // `upsert: true` sobrescribe si ya existe con el mismo path.

            if (uploadError) throw uploadError;

            // Obtiene la URL pública (o firmada si el bucket no es público) del archivo subido.
            // Es mejor usar la URL pública directamente si el bucket está configurado para acceso público.
            // Si se usan URLs firmadas, tienen caducidad y necesitarían regenerarse.
            // Aquí se asume que se quiere una URL persistente.
            const { data: { publicUrl } } = supabase.storage
                .from('library-covers')
                .getPublicUrl(uploadData.path);

            // Actualiza la tabla 'libraries' en la base de datos con la nueva URL de la imagen y la ruta.
            const { error: updateError } = await supabase
                .from('libraries')
                .update({ 
                    cover_image: publicUrl, // URL para mostrar la imagen.
                    cover_path: uploadData.path // Ruta en el storage, útil para eliminarla después.
                })
                .eq('id', libraryId); // Para la biblioteca específica.

            if (updateError) throw updateError;

            // Actualiza el estado local de `libraries` para reflejar el cambio de imagen inmediatamente.
            setLibraries(prevLibraries => prevLibraries.map(lib => 
                lib.id === libraryId 
                    ? { ...lib, cover_image: publicUrl } // Actualiza la imagen de la biblioteca modificada.
                    : lib // Devuelve las otras bibliotecas sin cambios.
            ));

            toast.success('Imagen actualizada correctamente');
        } catch (error) {
            console.error('Error al subir imagen:', error);
            toast.error('Error al actualizar la imagen. Detalles: ' + error.message);
        } finally {
            setUploadingImage(null); // Termina el estado de subida de imagen.
            e.target.value = null; // Resetea el input file.
        }
    };

    /**
     * Abre un PDF en una nueva pestaña del navegador usando su URL pública.
     * @param {object} pdf - El objeto PDF que contiene `public_url`.
     */
    const handleOpenPdf = async (pdf) => {
        try {
            if (!pdf.public_url) { // Verifica que la URL exista.
                toast.error('No se puede abrir el PDF: URL no disponible');
                return;
            }
            window.open(pdf.public_url, '_blank'); // Abre la URL en una nueva pestaña.
        } catch (error) {
            console.error('Error al abrir PDF:', error);
            toast.error('Error al abrir el PDF');
        }
    };

    /**
     * Elimina un PDF de la base de datos y actualiza el estado local.
     * @param {string} pdfId - El ID del PDF a eliminar.
     * @param {string} libraryId - El ID de la biblioteca a la que pertenece el PDF (para actualizar UI).
     */
    const handleDeletePdf = async (pdfId, libraryId) => {
        // Pide confirmación al usuario antes de eliminar.
        if (!window.confirm('¿Estás seguro de que quieres eliminar este PDF? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            // Llama al servicio para eliminar el PDF (esto debería manejar la eliminación del archivo en storage y el registro en DB).
            const { error } = await databaseService.deletePDF(pdfId); 
            if (error) throw error;

            // Actualiza el estado local `libraryPdfs` filtrando el PDF eliminado.
            setLibraryPdfs(prev => ({
                ...prev,
                [libraryId]: (prev[libraryId] || []).filter(pdf => pdf.id !== pdfId)
            }));

            toast.success('PDF eliminado correctamente');
            
            // Recarga las estadísticas y las bibliotecas para actualizar los contadores.
            await loadStats();
            await loadLibraries(); // Para actualizar el `pdf_count` en la tarjeta de la biblioteca.

        } catch (error) {
            console.error('Error al eliminar PDF:', error);
            toast.error('Error al eliminar el PDF. Detalles: ' + error.message);
        }
    };

    /**
     * Formatea un número de bytes a un string legible (KB, MB, GB).
     * @param {number} bytes - El número de bytes.
     * @returns {string} - El tamaño formateado.
     */
    const formatBytes = (bytes, decimals = 2) => { // Añadido parámetro decimals
        if (bytes === null || typeof bytes === 'undefined' || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; // Añadido TB por si acaso
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // --- EFECTOS SECUNDARIOS (useEffect) ---

    /**
     * Efecto para cargar las bibliotecas y estadísticas cuando el componente se monta
     * o cuando el objeto `user` cambia (ej. inicio/cierre de sesión).
     */
    useEffect(() => {
        if (user && user.id) { // Asegura que user y user.id existan.
            loadLibraries();
            loadStats();
        } else {
            // Si no hay usuario, limpiar datos o redirigir (si aplica).
            setLibraries([]);
            setLibraryPdfs({});
            setStats(null);
            setIsLoading(false); // Para evitar que se quede en estado de carga si no hay usuario.
        }
    }, [user]); // Dependencia: se ejecuta cuando `user` cambia.

    // --- OTRAS FUNCIONES AUXILIARES --- (handlePdfSelect no se usa, toggleLibrary sí)

    // handlePdfSelect no parece estar siendo utilizada en el JSX proporcionado.
    // Si es para otra funcionalidad, mantenerla. Si no, se puede eliminar.
    // const handlePdfSelect = (pdf) => {
    //     if (pdf.public_url) {
    //         window.open(pdf.public_url, '_blank');
    //     } else {
    //         toast.error('URL del PDF no disponible');
    //     }
    // };

    /**
     * Maneja la expansión o contracción de una biblioteca para mostrar/ocultar sus PDFs.
     * @param {string} libraryId - El ID de la biblioteca a expandir/contraer.
     */
    const toggleLibrary = (libraryId) => {
        // Si la biblioteca ya está expandida, la contrae (null). Si no, la expande.
        setExpandedLibrary(prevExpandedId => (prevExpandedId === libraryId ? null : libraryId));
    };

    // --- RENDERIZADO DEL COMPONENTE (JSX) ---
    return (
        <> {/* Fragmento React para agrupar elementos sin añadir un nodo extra al DOM. */}
            
            <div className="pdf-library-container">
                {/* Cabecera de la sección de bibliotecas */}
                <div className="library-header">
                    <h1>Mis Bibliotecas</h1>
                    <div className="header-buttons">
                        {/* Botón para mostrar el formulario de creación de nueva biblioteca */}
                        <button 
                            className="create-library-button"
                            onClick={() => setShowForm(true)}
                            title="Crear una nueva biblioteca de PDFs"
                        >
                            <i className="fas fa-plus"></i> {/* Icono de FontAwesome */}
                            Nueva Biblioteca
                        </button>
                        {/* Sección para el botón de subida de PDF */}
                        <div className="pdf-upload-button">
                            {/* Input real de tipo file, oculto visualmente */}
                            <input
                                type="file"
                                id="pdf-upload" // ID para asociar con el label
                                accept=".pdf" // Aceptar solo archivos PDF
                                onChange={handlePdfUpload} // Manejador cuando se selecciona un archivo
                                style={{ display: 'none' }} // Oculta el input
                            />
                            {/* Label estilizado como botón que activa el input file */}
                            <label htmlFor="pdf-upload" className="upload-button" title="Subir un nuevo archivo PDF">
                                <i className="fas fa-file-pdf"></i>
                                Subir PDF
                            </label>
                        </div>
                    </div>
                </div>

                {/* Panel de Estadísticas */}
                <div className="stats-panel">
                    <div className="stat-card">
                        <i className="fas fa-file-pdf"></i>
                        <div className="stat-info">
                            <h3>PDFs Totales</h3>
                            {/* Muestra el total de PDFs o 0 si no hay estadísticas */}
                            <p>{stats?.totalPdfs || 0}</p> 
                        </div>
                    </div>
                    <div className="stat-card">
                        <i className="fas fa-database"></i>
                        <div className="stat-info">
                            <h3>Espacio Usado</h3>
                            {/* Muestra el espacio total usado formateado, o '0 B' si no hay estadísticas */}
                            <p>{stats?.totalSize ? formatBytes(stats.totalSize) : '0 Bytes'}</p>
                        </div>
                    </div>
                </div>

                {/* Modal para Crear Nueva Biblioteca (se muestra si showForm es true) */}
                {showForm && (
                    <div className="modal-overlay"> {/* Overlay para el fondo del modal */}
                        <div className="modal-content"> {/* Contenido del modal */}
                            {/* Botón para cerrar el modal */}
                            <button 
                                className="close-button"
                                onClick={() => {
                                    setShowForm(false);
                                    setError(null); // Limpiar errores al cerrar
                                    setFormData({ name: '', description: '' }); // Limpiar formulario al cerrar
                                }}
                                title="Cerrar formulario"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                            
                            {/* Formulario de creación de biblioteca */}
                            <form onSubmit={handleCreateLibrary} className="library-form">
                                <h2>Crear Nueva Biblioteca</h2>
                                
                                {/* Muestra mensajes de error del formulario si existen */}
                                {error && (
                                    <div className="form-error"> 
                                        {error}
                                    </div>
                                )}

                                {/* Campo para el nombre de la biblioteca */}
                                <div className="form-group">
                                    <label htmlFor="name">Nombre*</label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name" // Importante para que handleChange funcione
                                        value={formData.name}
                                        onChange={handleChange}
                                        required // Campo obligatorio
                                        disabled={loading} // Deshabilitado mientras se procesa
                                        placeholder="Ej: Facturas 2024"
                                    />
                                </div>

                                {/* Campo para la descripción de la biblioteca */}
                                <div className="form-group">
                                    <label htmlFor="description">Descripción</label>
                                    <textarea
                                        id="description"
                                        name="description" // Importante para que handleChange funcione
                                        value={formData.description}
                                        onChange={handleChange}
                                        rows="4"
                                        disabled={loading}
                                        placeholder="Ej: Todos los documentos fiscales del año 2024"
                                    />
                                </div>

                                {/* Botón para enviar el formulario */}
                                <button 
                                    type="submit" 
                                    className="submit-button"
                                    disabled={loading} // Deshabilitado mientras se procesa
                                >
                                    {loading ? 'Creando...' : 'Crear Biblioteca'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Sección de visualización de bibliotecas */}
                {isLoading ? ( // Si está cargando las bibliotecas, muestra un spinner
                    <div className="loading-state">
                        <i className="fas fa-spinner fa-spin"></i>
                        <p>Cargando bibliotecas...</p>
                    </div>
                ) : ( // Si no está cargando
                    <div className="libraries-grid">
                        {libraries.length === 0 ? ( // Si no hay bibliotecas, muestra un estado vacío
                            <div className="empty-state">
                                <i className="fas fa-book"></i>
                                <p>No tienes bibliotecas creadas.</p>
                                <p>Empieza por crear tu primera biblioteca para organizar tus documentos.</p>
                                <button 
                                    className="create-first-library"
                                    onClick={() => setShowForm(true)}
                                >
                                    Crear mi primera biblioteca
                                </button>
                            </div>
                        ) : ( // Si hay bibliotecas, las mapea y muestra cada una
                            libraries.map(library => (
                                // Contenedor de cada tarjeta de biblioteca
                                <div key={library.id} className="library-card animate-scale-in">
                                    {/* Cabecera de la tarjeta de biblioteca, clickeable para expandir/contraer */}
                                    <div 
                                        className="library-header-card"
                                        onClick={() => toggleLibrary(library.id)}
                                        role="button" // Para accesibilidad
                                        tabIndex={0} // Para accesibilidad
                                        onKeyPress={(e) => e.key === 'Enter' && toggleLibrary(library.id)} // Para accesibilidad
                                        aria-expanded={expandedLibrary === library.id} // Para accesibilidad
                                        aria-controls={`library-content-${library.id}`} // Para accesibilidad
                                    >
                                        {/* Sección de la imagen de portada de la biblioteca */}
                                        <div className="library-cover">
                                            {library.cover_image ? ( // Si hay imagen de portada
                                                <img 
                                                    src={library.cover_image} 
                                                    alt={`Portada de ${library.name}`}
                                                    // Clase condicional si se está subiendo una imagen para esta biblioteca
                                                    className={uploadingImage === library.id ? 'image-loading' : ''} 
                                                    onError={(e) => { // Fallback si la imagen no carga
                                                        e.target.onerror = null; // Previene bucles de error
                                                        e.target.style.display = 'none'; // Oculta la imagen rota
                                                        // Podrías mostrar un placeholder aquí dentro del div .library-cover
                                                        const placeholder = e.target.parentElement.querySelector('.cover-placeholder-icon');
                                                        if(placeholder) placeholder.style.display = 'flex';
                                                    }}
                                                />
                                            ) : ( // Si no hay imagen de portada, muestra un icono
                                                <i className="fas fa-book-open cover-placeholder-icon" style={{display: 'flex'}}></i>
                                            )}
                                            {/* Input oculto para subir imagen de portada */}
                                            <input
                                                type="file"
                                                id={`cover-upload-${library.id}`}
                                                accept="image/*"
                                                onChange={(e) => handleImageUpload(e, library.id)}
                                                style={{ display: 'none' }}
                                                onClick={(e) => e.stopPropagation()} // Evita que el click propague al div padre (toggleLibrary)
                                            />
                                            {/* Label estilizado como botón para cambiar la imagen */}
                                            <label 
                                                htmlFor={`cover-upload-${library.id}`}
                                                className="upload-image-button"
                                                onClick={(e) => e.stopPropagation()} // Evita que el click propague al div padre
                                                title="Cambiar imagen de portada"
                                            >
                                                <i className="fas fa-camera"></i>
                                            </label>
                                        </div>
                                        {/* Información de la biblioteca (nombre, descripción, estadísticas) */}
                                        <div className="library-info">
                                            <h3>{library.name}</h3>
                                            <p>{library.description || 'Sin descripción'}</p>
                                            <div className="library-stats">
                                                <small>PDFs: {library.pdf_count || 0}</small>
                                                <small>Creada: {new Date(library.created_at).toLocaleDateString()}</small>
                                            </div>
                                        </div>
                                        {/* Icono para indicar si la biblioteca está expandida o contraída */}
                                        <div className="library-expand-icon">
                                            <i className={`fas fa-chevron-${expandedLibrary === library.id ? 'up' : 'down'}`}></i>
                                        </div>
                                    </div>

                                    {/* Contenido de la biblioteca (lista de PDFs), se muestra si está expandida */}
                                    <div 
                                        id={`library-content-${library.id}`} // Para aria-controls
                                        className={`library-content ${expandedLibrary === library.id ? 'expanded' : ''}`}
                                    >
                                        <div className="pdf-list">
                                            <h4>PDFs en esta biblioteca:</h4>
                                            {/* Verifica si hay PDFs cargados para esta biblioteca y si la lista tiene elementos */}
                                            {(libraryPdfs[library.id]?.length ?? 0) > 0 ? (
                                                <div className="pdf-grid"> {/* Grid para mostrar los PDFs */}
                                                    {libraryPdfs[library.id].map(pdf => (
                                                        // Tarjeta individual para cada PDF
                                                        <div key={pdf.id} className="pdf-card">
                                                            {/* Sección de la miniatura/portada del PDF */}
                                                            <div className="pdf-cover">
                                                                {pdf.cover_url ? ( // Si el PDF tiene una URL de portada
                                                                    <img 
                                                                        src={pdf.cover_url} 
                                                                        alt={`Portada de ${pdf.title}`}
                                                                        className="pdf-thumbnail"
                                                                        onError={(e) => { // Fallback si la imagen no carga
                                                                            e.target.onerror = null; // Previene bucles
                                                                            e.target.src = '/placeholder.png'; // Imagen placeholder genérica
                                                                        }}
                                                                    />
                                                                ) : ( // Si no, muestra un icono placeholder
                                                                    <div className="pdf-thumbnail-placeholder">
                                                                        <i className="fas fa-file-pdf"></i>
                                                                    </div>
                                                                )}
                                                                {/* Acciones disponibles para el PDF (descargar, abrir, firmar, eliminar) */}
                                                                <div className="pdf-actions">
                                                                    <DownloadButton pdfData={pdf} />
                                                                    <button 
                                                                        className="btn-action btn-open" // Clase específica para abrir
                                                                        onClick={() => handleOpenPdf(pdf)}
                                                                        title="Abrir PDF"
                                                                    >
                                                                        <i className="fas fa-external-link-alt"></i>
                                                                    </button>
                                                                    
                                                                    <YouSignButton 
                                                                        pdfId={pdf.id} 
                                                                        title={pdf.title || 'Documento sin título'}
                                                                    />
                                                                    
                                                                    <button 
                                                                        className="btn-action btn-delete"
                                                                        onClick={() => handleDeletePdf(pdf.id, library.id)}
                                                                        title="Eliminar PDF"
                                                                    >
                                                                        <i className="fas fa-trash-alt"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {/* Información del PDF (título, tamaño, fecha) */}
                                                            <div className="pdf-info">
                                                                <h5 className="pdf-title" title={pdf.title || 'Sin título'}>{pdf.title || 'Sin título'}</h5>
                                                                <div className="pdf-meta">
                                                                    <span>
                                                                        <i className="fas fa-hdd"></i>
                                                                        {/* Muestra el tamaño del archivo formateado */}
                                                                        {formatBytes(pdf.file_size)} 
                                                                    </span>
                                                                    <span>
                                                                        <i className="fas fa-calendar-alt"></i>
                                                                        {/* Muestra la fecha de creación formateada */}
                                                                        {new Date(pdf.created_at).toLocaleDateString()} 
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : ( // Si no hay PDFs en esta biblioteca
                                                <p className="no-pdfs">No hay PDFs en esta biblioteca. Sube algunos para empezar.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Modal para Asignar PDF a Biblioteca (se muestra si showPdfModal es true) */}
                {showPdfModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <button 
                                className="close-button"
                                onClick={() => { // Lógica para cerrar y limpiar el modal
                                    setShowPdfModal(false);
                                    setSelectedFile(null);
                                    setSelectedLibrary('');
                                    setError(null); // Limpiar errores del modal
                                    document.getElementById('pdf-upload').value = null; // Resetea el input file
                                }}
                                title="Cerrar asignación de PDF"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                            
                            <form onSubmit={handleAssignPdf} className="library-form">
                                <h2>Asignar PDF a Biblioteca</h2>
                                
                                {/* Muestra el nombre del archivo seleccionado */}
                                <div className="form-group">
                                    <p className="selected-file">
                                        Archivo seleccionado: <strong>{selectedFile?.name || 'Ninguno'}</strong>
                                    </p>
                                </div>

                                {/* Selector para elegir la biblioteca */}
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
                                        {/* Mapea las bibliotecas disponibles para las opciones del select */}
                                        {libraries.map(library => (
                                            <option key={library.id} value={library.id}>
                                                {library.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Muestra mensajes de error del formulario si existen */}
                                {error && ( // Este error es el general del componente, podría ser específico del modal
                                    <div className="form-error">
                                        {error}
                                    </div>
                                )}

                                <button 
                                    type="submit" 
                                    className="submit-button"
                                    // Deshabilitado si está cargando o si no se ha seleccionado una biblioteca
                                    disabled={loading || !selectedLibrary} 
                                >
                                    {loading ? 'Asignando...' : 'Asignar PDF'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default PDFLibrary;