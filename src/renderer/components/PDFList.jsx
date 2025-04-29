import React, { useEffect, useState } from 'react';
import '../styles/PDFList.css';

const PDFList = () => {
  const [pdfs, setPdfs] = useState([]);

  const loadPDFs = async () => {
    try {
      const pdfList = await window.electron.getPDFs();
      setPdfs(pdfList);
    } catch (error) {
      console.error('Error al cargar PDFs:', error);
    }
  };

  const handleOpenPDF = async (fileName) => {
    try {
      await window.electron.openPDF(fileName);
    } catch (error) {
      console.error('Error al abrir PDF:', error);
    }
  };

  const handleDeletePDF = async (fileName) => {
    if (window.confirm(`¿Estás seguro de que quieres borrar ${fileName}?`)) {
      try {
        await window.electron.deletePDF(fileName);
        await loadPDFs(); // Recargar la lista
      } catch (error) {
        console.error('Error al borrar PDF:', error);
      }
    }
  };

  useEffect(() => {
    loadPDFs();
    const handleUpdate = () => loadPDFs();
    window.addEventListener('pdfsUpdated', handleUpdate);
    return () => window.removeEventListener('pdfsUpdated', handleUpdate);
  }, []);

  return (
    <div className="pdf-list">
      <h2>PDFs Guardados</h2>
      {pdfs.length === 0 ? (
        <p>No hay PDFs guardados</p>
      ) : (
        <div className="pdf-grid">
          {pdfs.map((pdf, index) => (
            <div key={index} className="pdf-card">
              <div className="pdf-icon">📄</div>
              <div className="pdf-info">
                <h3>{pdf.name}</h3>
                <p>Tamaño: {(pdf.size / 1024 / 1024).toFixed(2)} MB</p>
                <p>Fecha: {new Date(pdf.addedAt).toLocaleDateString()}</p>
                <div className="pdf-actions">
                  <button 
                    className="btn-open"
                    onClick={() => handleOpenPDF(pdf.name)}
                  >
                    Abrir
                  </button>
                  <button 
                    className="btn-delete"
                    onClick={() => handleDeletePDF(pdf.name)}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PDFList;