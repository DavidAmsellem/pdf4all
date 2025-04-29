const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { getPDFDirectory } = require('./fileSystem');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 900,
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // En desarrollo, carga la URL del servidor de Vite
    if (process.env.NODE_ENV !== 'production') {
        win.loadURL('http://localhost:3000');
    } else {
        win.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Manejador para guardar PDFs
ipcMain.handle('save-pdf', async (event, fileData) => {
  try {
    const pdfDirectory = getPDFDirectory();
    const destPath = path.join(pdfDirectory, fileData.name);
    
    // Copiar el archivo a la carpeta de destino
    await fs.promises.copyFile(fileData.path, destPath);
    
    // Guardar metadata del archivo
    const metadata = {
      name: fileData.name,
      size: fileData.size,
      type: fileData.type,
      addedAt: new Date().toISOString()
    };
    
    // Guardar metadata en un archivo JSON
    const metadataPath = path.join(pdfDirectory, 'metadata.json');
    let existingMetadata = [];
    
    if (fs.existsSync(metadataPath)) {
      existingMetadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
    }
    
    existingMetadata.push(metadata);
    await fs.promises.writeFile(metadataPath, JSON.stringify(existingMetadata, null, 2));
    
    return { success: true, path: destPath };
  } catch (error) {
    console.error('Error al guardar PDF:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para obtener PDFs guardados
ipcMain.handle('get-pdfs', async () => {
  try {
    const pdfDirectory = getPDFDirectory();
    const metadataPath = path.join(pdfDirectory, 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return [];
    }
    
    const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
    console.log('Metadata leída:', metadata); // Debug
    return metadata;
  } catch (error) {
    console.error('Error al obtener PDFs:', error);
    return [];
  }
});

// Manejador para abrir PDF
ipcMain.handle('open-pdf', async (event, fileName) => {
  try {
    const pdfDirectory = getPDFDirectory();
    const pdfPath = path.join(pdfDirectory, fileName);
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error('El archivo PDF no existe');
    }
    
    await shell.openPath(pdfPath);
    return { success: true };
  } catch (error) {
    console.error('Error al abrir PDF:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para borrar PDF
ipcMain.handle('delete-pdf', async (event, fileName) => {
  try {
    const pdfDirectory = getPDFDirectory();
    const pdfPath = path.join(pdfDirectory, fileName);
    const metadataPath = path.join(pdfDirectory, 'metadata.json');
    
    // Borrar el archivo PDF
    if (fs.existsSync(pdfPath)) {
      await fs.promises.unlink(pdfPath);
    }
    
    // Actualizar metadata
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
      const updatedMetadata = metadata.filter(pdf => pdf.name !== fileName);
      await fs.promises.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2));
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error al borrar PDF:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rename-pdf', async (event, oldName, newName) => {
  try {
    const pdfDirectory = getPDFDirectory();
    const oldPath = path.join(pdfDirectory, oldName);
    const newPath = path.join(pdfDirectory, newName);

    // Renombrar el archivo
    await fs.promises.rename(oldPath, newPath);

    // Actualizar metadata
    const metadataPath = path.join(pdfDirectory, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
      const updatedMetadata = metadata.map(pdf => 
        pdf.name === oldName 
          ? { ...pdf, name: newName }
          : pdf
      );
      await fs.promises.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2));
    }

    return { success: true };
  } catch (error) {
    console.error('Error al renombrar PDF:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('close-app', () => {
  app.quit();
});

// Añadir manejadores para las acciones de la ventana
ipcMain.handle('minimize-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.minimize();
});

ipcMain.handle('maximize-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) {
        win.restore();
    } else {
        win?.maximize();
    }
});

ipcMain.handle('close-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.close();
});

ipcMain.handle('get-pdf-url', async (event, fileName) => {
    try {
        const pdfDirectory = getPDFDirectory();
        const pdfPath = path.join(pdfDirectory, fileName);
        
        // Verificar que el archivo existe
        if (!fs.existsSync(pdfPath)) {
            throw new Error('El archivo PDF no existe');
        }

        // Leer el archivo como buffer
        const buffer = await fs.promises.readFile(pdfPath);
        
        // Convertir el buffer a base64
        const base64 = buffer.toString('base64');
        
        // Crear data URL
        return `data:application/pdf;base64,${base64}`;
    } catch (error) {
        console.error('Error al obtener PDF:', error);
        throw error;
    }
});