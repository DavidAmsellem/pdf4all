import React, { useState, useEffect } from 'react';
import PDFViewer from './PDFViewer';
import { generateUniqueName } from '../../utils/fileUtils';
import '../styles/PDFLibrary.css';

const PDFLibrary = () => {
  const [pdfs, setPdfs] = useState([]);
  const [editingFile, setEditingFile] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [selectedPdf, setSelectedPdf] = useState(null);

  useEffect(() => {
    loadPDFs();
    window.addEventListener('pdfsUpdated', loadPDFs);
    return () => window.removeEventListener('pdfsUpdated', loadPDFs);
  }, []);

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
        const pdfData = await window.electron.getPdfUrl(fileName);
        setSelectedPdf(pdfData);
    } catch (error) {
        console.error('Error al abrir PDF:', error);
        alert('Error al cargar el PDF');
    }
  };

  const handleRename = (pdf) => {
    setEditingFile(pdf);
    setNewFileName(pdf.name);
  };

  const handleSaveRename = async (originalPdf) => {
    try {
      const ext = '.pdf';
      let finalName = newFileName;
      if (!finalName.toLowerCase().endsWith(ext)) {
        finalName += ext;
      }

      const existingNames = pdfs.map(pdf => pdf.name);
      const uniqueName = generateUniqueName(finalName, existingNames);

      await window.electron.renamePDF(originalPdf.name, uniqueName);
      
      setEditingFile(null);
      setNewFileName('');
      loadPDFs();
    } catch (error) {
      console.error('Error al renombrar:', error);
      alert(error.message);
    }
  };

  const handleDelete = async (pdf) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar ${pdf.name}?`)) {
      try {
        await window.electron.deletePDF(pdf.name);
        loadPDFs();
      } catch (error) {
        console.error('Error al eliminar PDF:', error);
        alert('Error al eliminar el archivo');
      }
    }
  };

  return (
    <div className="pdf-library-container">
        <div className="pdf-list">
            <h2><i className="fas fa-folder"></i> Mis PDFs</h2>
            {pdfs.length === 0 ? (
                <div className="empty-state">
                    <i className="fas fa-file-pdf"></i>
                    <p>No hay PDFs guardados</p>
                </div>
            ) : (
                <div className="pdf-grid">
                    {pdfs.map((pdf, index) => (
                        <div key={index} className="pdf-card animate-scale-in">
                            <div className="pdf-icon">
                                <i className="fas fa-file-pdf"></i>
                            </div>
                            <div className="pdf-info">
                                {editingFile === pdf ? (
                                    <div className="rename-container">
                                        <input
                                            type="text"
                                            value={newFileName}
                                            onChange={(e) => setNewFileName(e.target.value)}
                                            className="rename-input"
                                        />
                                        <div className="rename-actions">
                                            <button 
                                                onClick={() => handleSaveRename(pdf)}
                                                className="btn-save"
                                            >
                                                <i className="fas fa-check"></i>
                                            </button>
                                            <button 
                                                onClick={() => setEditingFile(null)}
                                                className="btn-cancel"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h3>{pdf.name}</h3>
                                        <p>Tamaño: {(pdf.size / 1024 / 1024).toFixed(2)} MB</p>
                                        <p>Fecha: {new Date(pdf.addedAt).toLocaleDateString()}</p>
                                    </>
                                )}
                            </div>
                            <div className="pdf-actions">
                                <button 
                                    className="btn-open"
                                    onClick={() => handleOpenPDF(pdf.name)}
                                >
                                    <i className="fas fa-external-link-alt"></i> Abrir
                                </button>
                                {!editingFile && (
                                    <>
                                        <button 
                                            className="btn-rename"
                                            onClick={() => handleRename(pdf)}
                                        >
                                            <i className="fas fa-edit"></i> Renombrar
                                        </button>
                                        <button 
                                            className="btn-delete"
                                            onClick={() => handleDelete(pdf)}
                                        >
                                            <i className="fas fa-trash"></i> Borrar
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <div className="pdf-preview">
            <PDFViewer pdfUrl={selectedPdf} />
        </div>
    </div>
  );
};

export default PDFLibrary;