import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { databaseService } from '../../services/databaseService';
import { toast } from 'react-toastify';
import PDFThumbnail from './PDFThumbnail';
import './AllPDFsGallery.css';

const AllPDFsGallery = () => {
    const { user } = useAuth();
    const [pdfs, setPdfs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (user) {
            loadAllPDFs();
        }
    }, [user]);

    const loadAllPDFs = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await databaseService.getAllPDFs(user.id);
            if (error) throw error;
            setPdfs(data || []);
        } catch (error) {
            console.error('Error al cargar PDFs:', error);
            toast.error('Error al cargar los PDFs');
            setPdfs([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePdfSelect = (pdf) => {
        if (pdf.public_url) {
            window.open(pdf.public_url, '_blank');
        } else {
            toast.error('URL del PDF no disponible');
        }
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const filteredPdfs = pdfs.filter(pdf => 
        pdf.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="all-pdfs-container">
            <div className="gallery-header">
                <h1>Galería de PDFs</h1>
                <div className="search-bar">
                    <label htmlFor="pdf-search" className="sr-only">Buscar PDFs</label>
                    <i className="fas fa-search" aria-hidden="true"></i>
                    <input
                        type="text"
                        id="pdf-search"
                        name="pdf-search"
                        placeholder="Buscar PDFs..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        aria-label="Buscar PDFs por título"
                    />
                </div>
            </div>

            <div className="pdf-gallery-grid">
                {isLoading ? (
                    <div className="loading-state">
                        <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                        <p>Cargando PDFs...</p>
                    </div>
                ) : filteredPdfs.length > 0 ? (
                    filteredPdfs.map(pdf => (
                        <PDFThumbnail 
                            key={pdf.id}
                            pdf={pdf}
                            onClick={() => handlePdfSelect(pdf)}
                        />
                    ))
                ) : (
                    <div className="empty-state">
                        <i className="fas fa-file-pdf" aria-hidden="true"></i>
                        <p>No hay PDFs disponibles</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AllPDFsGallery;