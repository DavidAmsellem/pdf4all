const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Agrega un log para verificar que la API key se está cargando
console.log('YouSign API Key configurada:', process.env.YOUSIGN_API_KEY ? 'Sí' : 'No');

const fs = require('fs').promises;
const https = require('https');
const http = require('http');
const cacheService = require('../services/cacheService');
const fetch = require('node-fetch');

// Importar el servicio de YouSign
const { youSignService } = require('../services/youSignService');

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
app.whenReady().then(() => {
    console.log('Variables de entorno cargadas:', {
        YOUSIGN_API_KEY: process.env.YOUSIGN_API_KEY ? 'Presente' : 'No encontrada',
        NODE_ENV: process.env.NODE_ENV,
        // Otras variables relevantes...
    });
    createWindow();
});

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

// Manejadores de caché
ipcMain.handle('save-to-cache', async (event, pdfId, data, metadata) => {
    return await cacheService.saveToCache(pdfId, data, metadata);
});

ipcMain.handle('get-from-cache', async (event, pdfId) => {
    return await cacheService.getFromCache(pdfId);
});

ipcMain.handle('remove-from-cache', async (event, pdfId) => {
    return await cacheService.removeFromCache(pdfId);
});

// Manejador para descargar y cachear
ipcMain.handle('download-and-cache', async (event, { id, url, metadata }) => {
    try {
        // Intentar obtener del caché primero
        const cached = await cacheService.getFromCache(id);
        if (cached) {
            console.log('Usando archivo cacheado:', id);
            return {
                success: true,
                data: Array.from(cached.data)
            };
        }

        // Asegurarnos de que la URL sea absoluta
        const fullUrl = new URL(url).toString();
        console.log('Descargando desde URL:', fullUrl);

        // Descargar el archivo
        const response = await fetch(fullUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const buffer = await response.buffer();
        console.log('Archivo descargado, tamaño:', buffer.length);

        // Guardar en caché
        await cacheService.saveToCache(id, buffer, metadata);
        console.log('Archivo guardado en caché:', id);

        return {
            success: true,
            data: Array.from(buffer)
        };
    } catch (error) {
        console.error('Error en download-and-cache:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// Manejador para precargar PDFs
ipcMain.handle('preload-pdfs', async (event, pdfsData) => {
    try {
        console.log('Iniciando precarga de PDFs...');
        const results = await Promise.allSettled(
            pdfsData.map(async pdf => {
                try {
                    // Verificar si ya está en caché
                    const cached = await cacheService.getFromCache(pdf.id);
                    if (cached) {
                        console.log(`PDF ${pdf.id} ya está en caché`);
                        return { id: pdf.id, status: 'cached' };
                    }

                    // Obtener URL firmada
                    const { data: { signedUrl }, error: urlError } = await supabase.storage
                        .from('pdfs')
                        .createSignedUrl(pdf.storage_path, 60);

                    if (urlError) throw urlError;

                    // Descargar el archivo
                    const response = await fetch(signedUrl);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    
                    const buffer = await response.buffer();

                    // Guardar en caché
                    await cacheService.saveToCache(pdf.id, buffer, {
                        title: pdf.title,
                        storage_path: pdf.storage_path
                    });

                    console.log(`PDF ${pdf.id} precargado correctamente`);
                    return { id: pdf.id, status: 'downloaded' };
                } catch (error) {
                    console.error(`Error al precargar PDF ${pdf.id}:`, error);
                    return { id: pdf.id, status: 'error', error: error.message };
                }
            })
        );

        return {
            success: true,
            results: results.map(r => r.value || r.reason)
        };
    } catch (error) {
        console.error('Error en precarga:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('refresh-cache', async () => {
    try {
        // Obtener todos los PDFs de Supabase
        const { data: pdfs, error } = await supabase
            .from('pdfs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Procesar cada PDF
        const results = await Promise.allSettled(
            pdfs.map(async pdf => {
                try {
                    // Obtener URL firmada
                    const { data: { signedUrl }, error: urlError } = await supabase.storage
                        .from('pdfs')
                        .createSignedUrl(pdf.storage_path, 60);

                    if (urlError) throw urlError;

                    // Descargar y guardar en caché
                    const response = await fetch(signedUrl);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    
                    const buffer = await response.buffer();
                    await cacheService.saveToCache(pdf.id, buffer, {
                        title: pdf.title,
                        storage_path: pdf.storage_path
                    });

                    return { id: pdf.id, status: 'success' };
                } catch (error) {
                    console.error(`Error al actualizar caché para ${pdf.id}:`, error);
                    return { id: pdf.id, status: 'error', error: error.message };
                }
            })
        );

        const stats = {
            total: pdfs.length,
            success: results.filter(r => r.value?.status === 'success').length,
            errors: results.filter(r => r.value?.status === 'error').length
        };

        console.log('Estadísticas de actualización:', stats);
        return { success: true, stats };

    } catch (error) {
        console.error('Error al actualizar caché:', error);
        return { success: false, error: error.message };
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

ipcMain.handle('open-cache-folder', async () => {
    try {
        const cachePath = path.join(app.getPath('userData'), 'pdf-cache');
        await shell.openPath(cachePath);
        return { success: true };
    } catch (error) {
        console.error('Error al abrir carpeta de caché:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('clear-cache', async () => {
    try {
        const cachePath = path.join(app.getPath('userData'), 'pdf-cache');
        const files = await fs.readdir(cachePath);
        
        await Promise.all(
            files.map(file => fs.unlink(path.join(cachePath, file)))
        );
        
        return { success: true };
    } catch (error) {
        console.error('Error al limpiar caché:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-cache-stats', async () => {
    try {
        const cachePath = path.join(app.getPath('userData'), 'pdf-cache');
        const files = await fs.readdir(cachePath);
        
        const pdfFiles = files.filter(f => f.endsWith('.pdf'));
        const totalSize = await Promise.all(
            pdfFiles.map(async f => {
                const stats = await fs.stat(path.join(cachePath, f));
                return stats.size;
            })
        ).then(sizes => sizes.reduce((a, b) => a + b, 0));

        return {
            success: true,
            stats: {
                count: pdfFiles.length,
                size: totalSize
            }
        };
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        return { success: false, error: error.message };
    }
});

// Manejador para enviar a YouSign
ipcMain.handle('send-to-yousign', async (event, data) => {
    try {
        console.log('Procesando solicitud de firma para:', data.pdfId);
        
        // Obtener el PDF de la caché
        const cached = await cacheService.getFromCache(data.pdfId);
        if (!cached || !cached.data) {
            throw new Error('PDF no encontrado en caché');
        }

        // Enviar a YouSign
        const result = await youSignService.createSignatureProcedure(
            cached.data,
            {
                title: data.title || 'Documento para firmar',
                signerEmail: data.signerEmail,
                signerName: data.signerName
            }
        );

        console.log('Resultado de YouSign:', result);
        return result;
    } catch (error) {
        console.error('Error en send-to-yousign:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// Opcional: manejador para consultar estado
ipcMain.handle('get-yousign-status', async (event, procedureId) => {
    try {
        const status = await youSignService.getProcedureStatus(procedureId);
        return {
            success: true,
            status
        };
    } catch (error) {
        console.error('Error al obtener estado:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// Añadir manejador para obtener la API key
ipcMain.handle('get-yousign-api-key', () => {
    const apiKey = process.env.VITE_YOUSIGN_API_KEY;
    if (!apiKey) {
        console.error('VITE_YOUSIGN_API_KEY no encontrada');
        throw new Error('API key de YouSign no configurada');
    }
    return apiKey;
});

// Add handler for getting API URL
ipcMain.handle('get-yousign-api-url', () => {
    const apiUrl = process.env.VITE_YOUSIGN_API_URL;
    if (!apiUrl) {
        console.error('VITE_YOUSIGN_API_URL no encontrada');
        throw new Error('URL de YouSign API no configurada');
    }
    return apiUrl;
});

// Añadir manejador para descargar documento firmado
ipcMain.handle('download-signed-document', async (event, procedureId) => {
    try {
        const apiKey = process.env.VITE_YOUSIGN_API_KEY;
        if (!apiKey) {
            throw new Error('API key de YouSign no configurada');
        }

        const response = await fetch(
            `https://api-sandbox-d3e68ba0cf.yousign.app/recipient/signature_requests/${procedureId}/documents/download`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/pdf'
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Error ${response.status}: ${errorText}`);
        }

        const buffer = await response.buffer();
        return {
            success: true,
            data: Array.from(buffer),
            fileName: `documento_firmado_${procedureId}.pdf`
        };
    } catch (error) {
        console.error('Error downloading document:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

ipcMain.handle('open-external', async (event, url) => {
    try {
        await shell.openExternal(url);
        return { success: true };
    } catch (error) {
        console.error('Error opening URL:', error);
        return { success: false, error: error.message };
    }
});

