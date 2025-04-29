import React, { useState } from 'react';
import { generateUniqueName } from '../../utils/fileUtils';
import '../styles/UploadPDF.css';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_SIZE_MB = 50;

const UploadPDF = () => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [editingFile, setEditingFile] = useState(null);
  const [newFileName, setNewFileName] = useState('');

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

  const validateFile = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`El archivo ${file.name} excede el tamaño máximo permitido de ${MAX_FILE_SIZE_MB}MB`);
    }
    return true;
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
        validateFile(file);
        await savePDF(file);
      } catch (error) {
        console.error(`Error al procesar ${file.name}:`, error);
        alert(error.message);
      }
    }
    
    setFiles(pdfFiles.filter(file => file.size <= MAX_FILE_SIZE));
    window.dispatchEvent(new Event('pdfsUpdated'));
  };

  const handleFileInput = async (e) => {
    const uploadedFiles = [...e.target.files];
    const pdfFiles = uploadedFiles.filter(file => file.type === 'application/pdf');
    
    for (const file of pdfFiles) {
      try {
        validateFile(file);
        await savePDF(file);
      } catch (error) {
        console.error(`Error al procesar ${file.name}:`, error);
        alert(error.message);
      }
    }
    
    setFiles(pdfFiles.filter(file => file.size <= MAX_FILE_SIZE));
    window.dispatchEvent(new Event('pdfsUpdated'));
  };

  const handleRename = (file) => {
    setEditingFile(file);
    setNewFileName(file.name);
  };

  const handleSaveRename = async (originalFile) => {
    try {
      const ext = '.pdf';
      let finalName = newFileName;
      if (!finalName.toLowerCase().endsWith(ext)) {
        finalName += ext;
      }

      const existingPdfs = await window.electron.getPDFs();
      const existingNames = existingPdfs.map(pdf => pdf.name);
      const uniqueName = generateUniqueName(finalName, existingNames);

      await window.electron.savePDF({
        ...originalFile,
        name: uniqueName
      });

      setEditingFile(null);
      setNewFileName('');
      window.dispatchEvent(new Event('pdfsUpdated'));
    } catch (error) {
      console.error('Error al renombrar:', error);
      alert(error.message);
    }
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
          <span className="file-size-warning">
            Tamaño máximo por archivo: {MAX_FILE_SIZE_MB}MB
          </span>
        </div>
      </div>

      {files.length > 0 && (
        <div className="files-list">
          <h3>Archivos seleccionados:</h3>
          <ul>
            {files.map((file, index) => (
              <li key={index}>
                {editingFile === file ? (
                  <div className="rename-container">
                    <input
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="rename-input"
                    />
                    <button 
                      onClick={() => handleSaveRename(file)}
                      className="btn-save"
                    >
                      Guardar
                    </button>
                    <button 
                      onClick={() => setEditingFile(null)}
                      className="btn-cancel"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    <button 
                      onClick={() => handleRename(file)}
                      className="btn-rename"
                    >
                      Renombrar
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UploadPDF;