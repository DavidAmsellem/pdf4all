const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Crear una carpeta 'pdfs' en el directorio de datos de la aplicación
const getPDFDirectory = () => {
    const userDataPath = app.getPath('userData');
    const pdfDirectory = path.join(userDataPath, 'pdfs');
    
    if (!fs.existsSync(pdfDirectory)) {
        fs.mkdirSync(pdfDirectory, { recursive: true });
    }
    
    return pdfDirectory;
};

module.exports = { getPDFDirectory };