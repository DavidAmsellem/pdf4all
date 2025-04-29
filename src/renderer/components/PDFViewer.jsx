import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import '../styles/PDFViewer.css';

// Configurar worker de PDF.js con versión específica
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;

const PDFViewer = ({ pdfUrl }) => {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setIsLoading(false);
        setNumPages(numPages);
        setError(null);
    };

    const onDocumentLoadError = (error) => {
        setIsLoading(false);
        console.error('Error al cargar PDF:', error);
        setError('No se pudo cargar el PDF. Por favor, inténtalo de nuevo.');
    };

    useEffect(() => {
        if (pdfUrl) {
            setIsLoading(true);
            setError(null);
            setPageNumber(1);
        }
    }, [pdfUrl]);

    const changePage = (offset) => {
        setPageNumber(prevPageNumber => Math.min(Math.max(1, prevPageNumber + offset), numPages));
    };

    const adjustZoom = (factor) => {
        setScale(prevScale => Math.min(Math.max(0.5, prevScale + factor), 2.0));
    };

    if (error) {
        return (
            <div className="pdf-error">
                <i className="fas fa-exclamation-triangle"></i>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="pdf-viewer-container">
            {pdfUrl && (
                <>
                    <div className="pdf-controls">
                        <div className="page-controls">
                            <button 
                                onClick={() => changePage(-1)}
                                disabled={pageNumber <= 1}
                            >
                                <i className="fas fa-chevron-left"></i>
                            </button>
                            <span>
                                Página {pageNumber} de {numPages || '--'}
                            </span>
                            <button 
                                onClick={() => changePage(1)}
                                disabled={pageNumber >= numPages}
                            >
                                <i className="fas fa-chevron-right"></i>
                            </button>
                        </div>
                        <div className="zoom-controls">
                            <button onClick={() => adjustZoom(-0.1)}>
                                <i className="fas fa-search-minus"></i>
                            </button>
                            <span>{Math.round(scale * 100)}%</span>
                            <button onClick={() => adjustZoom(0.1)}>
                                <i className="fas fa-search-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div className="pdf-document">
                        <Document
                            file={pdfUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={
                                <div className="loading">
                                    <i className="fas fa-spinner fa-spin"></i>
                                    <span>Cargando PDF...</span>
                                </div>
                            }
                        >
                            <Page
                                pageNumber={pageNumber}
                                scale={scale}
                                loading={
                                    <div className="loading">
                                        <i className="fas fa-spinner fa-spin"></i>
                                    </div>
                                }
                            />
                        </Document>
                    </div>
                </>
            )}
            {!pdfUrl && (
                <div className="no-pdf">
                    <i className="fas fa-file-pdf"></i>
                    <p>Selecciona un PDF para visualizar</p>
                </div>
            )}
        </div>
    );
};

export default PDFViewer;