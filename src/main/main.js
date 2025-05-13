const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const https = require('https');
const http = require('http');

// Configuración de almacenamiento local
function getLocalStoragePath() {
    return path.join(app.getPath('userData'), 'local_storage');
}

function getLocalPDFsPath() {
    return path.join(getLocalStoragePath(), 'pdfs');
}

function getLocalMetadataPath() {
    return path.join(getLocalStoragePath(), 'metadata');
}

// Función para crear ventana principal
function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        frame: false, // Quita el marco de Windows
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#1a1b1e',
        show: false
    });

    if (process.env.OPEN_DEVTOOLS === 'true') {
        win.webContents.openDevTools();
    }

    win.once('ready-to-show', () => {
        win.show();
    });

    if (process.env.NODE_ENV !== 'production') {
        win.loadURL('http://localhost:3000');
    } else {
        win.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    return win;
}

// Función auxiliar para crear directorios
async function createDirectoryIfNotExists(dirPath) {
    try {
        await fs.access(dirPath);
        console.log(`Directorio existente: ${dirPath}`);
    } catch (error) {
        console.log(`Creando directorio: ${dirPath}`);
        await fs.mkdir(dirPath, { recursive: true });
    }
}

// Función auxiliar para descargar archivos
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);
        
        const request = protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Error al descargar: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
        });
        
        file.on('finish', () => {
            file.close();
            resolve();
        });
        
        request.on('error', (err) => {
            fs.unlink(destPath).catch(() => {});
            reject(err);
        });
        
        file.on('error', (err) => {
            fs.unlink(destPath).catch(() => {});
            reject(err);
        });
    });
}

// Inicialización de la aplicación
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Manejadores IPC
ipcMain.handle('prepare-local-storage', async () => {
    try {
        const paths = [
            getLocalStoragePath(),
            getLocalPDFsPath(),
            getLocalMetadataPath()
        ];

        for (const dirPath of paths) {
            await createDirectoryIfNotExists(dirPath);
        }

        return { success: true };
    } catch (error) {
        console.error('Error preparando almacenamiento:', error);
        return { 
            success: false, 
            error: error.message,
            details: { code: error.code, stack: error.stack }
        };
    }
});

ipcMain.handle('download-pdf-from-supabase', async (event, { url, pdfId, metadata }) => {
    try {
        if (!url || !pdfId) throw new Error('Datos incompletos');

        const pdfPath = path.join(getLocalPDFsPath(), `${pdfId}.pdf`);
        const metadataPath = path.join(getLocalMetadataPath(), `${pdfId}.json`);

        // Verificar si ya existe
        try {
            await fs.access(pdfPath);
            return { success: true, path: pdfPath };
        } catch (_) {
            // Continuar con la descarga
        }

        // Descargar PDF
        await downloadFile(url, pdfPath);

        // Guardar metadata
        const extendedMetadata = {
            ...metadata,
            local_path: pdfPath,
            downloaded_at: new Date().toISOString()
        };
        await fs.writeFile(metadataPath, JSON.stringify(extendedMetadata, null, 2));

        return { success: true, path: pdfPath };
    } catch (error) {
        console.error('Error descargando PDF:', error);
        return { 
            success: false, 
            error: error.message,
            details: { code: error.code || 'UNKNOWN', stack: error.stack }
        };
    }
});

// Manejadores de ventana
ipcMain.handle('minimize-window', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
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
    BrowserWindow.getFocusedWindow()?.close();
});

