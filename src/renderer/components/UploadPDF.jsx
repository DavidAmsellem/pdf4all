import React, { useState } from 'react';
import '../styles/UploadPDF.css';

const UploadPDF = () => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);

  const savePDF = async (file) => {
    try {
      // Usando la API de Electron para comunicarse con el proceso principal
      const result = await window.electron.savePDF({
        name: file.name,
        path: file.path,
        size: file.size,
        type: file.type
      });
      
      console.log('PDF guardado:', result);
      return result;
    } catch (error) {
      console.error('Error al guardar PDF:', error);
      throw error;
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const uploadedFiles = [...e.dataTransfer.files];
    const pdfFiles = uploadedFiles.filter(file => file.type === 'application/pdf');
    
    for (const file of pdfFiles) {
      try {
        await savePDF(file);
      } catch (error) {
        console.error(`Error al procesar ${file.name}:`, error);
      }
    }
    
    setFiles(pdfFiles);
    
    // Después de guardar los archivos, emitir un evento para actualizar la lista
    window.dispatchEvent(new Event('pdfsUpdated'));
  };

  const handleFileInput = async (e) => {
    const uploadedFiles = [...e.target.files];
    const pdfFiles = uploadedFiles.filter(file => file.type === 'application/pdf');
    
    for (const file of pdfFiles) {
      try {
        await savePDF(file);
      } catch (error) {
        console.error(`Error al procesar ${file.name}:`, error);
      }
    }
    
    setFiles(pdfFiles);
    
    // Después de guardar los archivos, emitir un evento para actualizar la lista
    window.dispatchEvent(new Event('pdfsUpdated'));
  };

  return (
    <div className="upload-container">
      <div 
        className={`upload-area ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          accept=".pdf"
          multiple
          onChange={handleFileInput}
          className="file-input"
        />
        <div className="upload-message">
          <i className="fas fa-file-pdf"></i>
          <p>Arrastra y suelta tus PDFs aquí o haz clic para seleccionar</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="files-list">
          <h3>Archivos seleccionados:</h3>
          <ul>
            {files.map((file, index) => (
              <li key={index}>
                {file.name}
                <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UploadPDF;