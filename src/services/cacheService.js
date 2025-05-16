const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class CacheService {
    constructor() {
        this.cachePath = path.join(app.getPath('userData'), 'pdf-cache');
        this.init();
    }

    async init() {
        try {
            await fs.mkdir(this.cachePath, { recursive: true });
            console.log('Directorio de caché creado en:', this.cachePath);
        } catch (error) {
            console.error('Error al crear directorio de caché:', error);
        }
    }

    async saveToCache(pdfId, data, metadata) {
        try {
            const pdfPath = path.join(this.cachePath, `${pdfId}.pdf`);
            const metadataPath = path.join(this.cachePath, `${pdfId}.json`);

            await Promise.all([
                fs.writeFile(pdfPath, data),
                fs.writeFile(metadataPath, JSON.stringify({
                    ...metadata,
                    cachedAt: Date.now()
                }))
            ]);

            return true;
        } catch (error) {
            console.error('Error al guardar en caché:', error);
            return false;
        }
    }

    async getFromCache(pdfId) {
        try {
            const pdfPath = path.join(this.cachePath, `${pdfId}.pdf`);
            const metadataPath = path.join(this.cachePath, `${pdfId}.json`);

            const [pdfData, metadataRaw] = await Promise.all([
                fs.readFile(pdfPath),
                fs.readFile(metadataPath, 'utf-8')
            ]);

            const metadata = JSON.parse(metadataRaw);
            
            // Verificar si el caché es válido (24 horas)
            if (Date.now() - metadata.cachedAt > 24 * 60 * 60 * 1000) {
                await this.removeFromCache(pdfId);
                return null;
            }

            return { data: pdfData, metadata };
        } catch (error) {
            return null;
        }
    }

    async removeFromCache(pdfId) {
        try {
            const pdfPath = path.join(this.cachePath, `${pdfId}.pdf`);
            const metadataPath = path.join(this.cachePath, `${pdfId}.json`);

            await Promise.all([
                fs.unlink(pdfPath).catch(() => {}),
                fs.unlink(metadataPath).catch(() => {})
            ]);

            return true;
        } catch (error) {
            return false;
        }
    }
}

const cacheService = new CacheService();
module.exports = cacheService;