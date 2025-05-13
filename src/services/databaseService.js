import { supabase } from '../supabase/client';
import * as pdfjsLib from 'pdfjs-dist';
import { encryptionService } from './encryptionService';
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const getSignedUrl = async (path, expiresIn = 3600) => {
    const { data, error } = await supabase.storage
        .from('pdfs')
        .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
};

export const databaseService = {
    // Servicios para bibliotecas
    getUserLibraries: async (userId) => {
        try {
            // Consulta para obtener bibliotecas con conteo de PDFs
            const { data, error } = await supabase
                .from('libraries')
                .select(`
                    *,
                    pdfs:pdfs(count)
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Procesar los resultados para incluir el conteo
            const librariesWithCounts = data.map(library => ({
                ...library,
                pdf_count: library.pdfs?.[0]?.count || 0
            }));

            return { data: librariesWithCounts, error: null };
        } catch (error) {
            console.error('Error en getUserLibraries:', error);
            return { data: null, error };
        }
    },

    createLibrary: async (libraryData) => {
        try {
            const { data, error } = await supabase
                .from('libraries')
                .insert([{
                    name: libraryData.name,
                    description: libraryData.description,
                    user_id: libraryData.userId
                }])
                .select()
                .single();

            if (error) {
                console.error('Error en createLibrary:', error);
                throw error;
            }

            return { data, error: null };
        } catch (error) {
            console.error('Error en createLibrary:', error);
            return { data: null, error };
        }
    },

    // Servicios para PDFs
    getPDFs: async (userId, libraryId = null) => {
        try {
            let query = supabase
                .from('pdfs')
                .select('*')
                .eq('user_id', userId);

            if (libraryId) {
                query = query.eq('library_id', libraryId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error en getPDFs:', error);
            return { data: null, error };
        }
    },

    createPDF: async (fileData) => {
        try {
            if (!fileData.title || !fileData.file || !fileData.libraryId || !fileData.userId) {
                throw new Error('Faltan datos requeridos para crear el PDF');
            }

            // 1. Subir el PDF
            const pdfFileName = `${Date.now()}-${fileData.fileName}`;
            const { data: fileUpload, error: uploadError } = await supabase.storage
                .from('pdfs')
                .upload(pdfFileName, fileData.file);

            if (uploadError) {
                console.error('Error en la subida:', uploadError);
                throw uploadError;
            }

            // 2. Obtener URL firmada para el PDF
            const { data: urlData, error: urlError } = await supabase.storage
                .from('pdfs')
                .createSignedUrl(fileUpload.path, 3600);

            if (urlError) {
                console.error('Error al crear URL:', urlError);
                throw urlError;
            }

            // 3. Generar portada del PDF
            let coverUrl = null;
            let coverPath = null;

            try {
                // Cargar el PDF para generar la portada
                const pdfData = await pdfjsLib.getDocument(urlData.signedUrl).promise;
                const page = await pdfData.getPage(1);
                const viewport = page.getViewport({ scale: 1.0 });

                // Crear un canvas para renderizar la portada
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                // Convertir el canvas a Blob
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.75));
                const coverFileName = `covers/${Date.now()}-${fileData.fileName.replace('.pdf', '.jpg')}`;

                // Subir la portada
                const { data: coverUpload, error: coverError } = await supabase.storage
                    .from('pdfs')
                    .upload(coverFileName, blob);

                if (coverError) throw coverError;

                // Obtener URL firmada para la portada
                const { data: coverUrlData } = await supabase.storage
                    .from('pdfs')
                    .createSignedUrl(coverUpload.path, 3600);

                coverUrl = coverUrlData.signedUrl;
                coverPath = coverUpload.path;

            } catch (coverError) {
                console.warn('No se pudo generar la portada:', coverError);
            }

            // 4. Cifrar todos los datos sensibles
            const title_encrypted = encryptionService.encrypt(fileData.title);
            const file_name_encrypted = encryptionService.encrypt(fileData.fileName);
            const public_url_encrypted = encryptionService.encrypt(urlData.signedUrl);
            const cover_url_encrypted = coverUrl ? encryptionService.encrypt(coverUrl) : null;
            const storage_path_encrypted = encryptionService.encrypt(fileUpload.path);
            const cover_path_encrypted = coverPath ? encryptionService.encrypt(coverPath) : null;

            // 5. Preparar datos para inserción
            const pdfData = {
                // Versiones cifradas
                title_encrypted,
                file_name_encrypted,
                public_url_encrypted,
                cover_url_encrypted,
                storage_path_encrypted,
                cover_path_encrypted,
                // Datos no sensibles
                library_id: fileData.libraryId,
                user_id: fileData.userId,
                file_size: fileData.fileSize,
                // Mantener versiones sin cifrar para búsquedas
                title: fileData.title,
                file_name: fileData.fileName,
                // Rutas originales para manejo interno
                storage_path: fileUpload.path,
                cover_path: coverPath
            };

            // 6. Insertar en la base de datos
            const { data, error: insertError } = await supabase
                .from('pdfs')
                .insert([pdfData])
                .select('*')
                .single();

            if (insertError) {
                console.error('Error de inserción:', insertError);
                // Limpiar archivos subidos si falla la inserción
                await supabase.storage.from('pdfs').remove([fileUpload.path]);
                if (coverPath) {
                    await supabase.storage.from('pdfs').remove([coverPath]);
                }
                throw insertError;
            }

            return { 
                data: {
                    ...data,
                    title: data.title,
                    file_name: data.file_name,
                    cover_url: coverUrl
                }, 
                error: null 
            };

        } catch (error) {
            console.error('Error completo:', error);
            return { data: null, error };
        }
    },

    getPDFsByLibrary: async (libraryId) => {
        try {
            const { data: encryptedPdfs, error } = await supabase
                .from('pdfs')
                .select('*')
                .eq('library_id', libraryId);

            if (error) throw error;

            // Descifrar todos los datos sensibles
            const decryptedPdfs = encryptedPdfs.map(pdf => ({
                ...pdf,
                title: pdf.title_encrypted ? encryptionService.decrypt(pdf.title_encrypted) : pdf.title,
                file_name: pdf.file_name_encrypted ? encryptionService.decrypt(pdf.file_name_encrypted) : pdf.file_name,
                public_url: pdf.public_url_encrypted ? encryptionService.decrypt(pdf.public_url_encrypted) : pdf.public_url,
                cover_url: pdf.cover_url_encrypted ? encryptionService.decrypt(pdf.cover_url_encrypted) : pdf.cover_url
            }));

            // Generar nuevas URLs firmadas
            const pdfsWithSignedUrls = await Promise.all(decryptedPdfs.map(async (pdf) => {
                const [fileUrl, coverUrl] = await Promise.all([
                    getSignedUrl(pdf.storage_path),
                    pdf.cover_path ? getSignedUrl(pdf.cover_path) : null
                ]);

                return {
                    ...pdf,
                    public_url: fileUrl,
                    cover_url: coverUrl
                };
            }));

            return { data: pdfsWithSignedUrls, error: null };
        } catch (error) {
            console.error('Error en getPDFsByLibrary:', error);
            return { data: null, error };
        }
    },

    moveToLibrary: async (pdfId, newLibraryId) => {
        try {
            const { data, error } = await supabase
                .from('pdfs')
                .update({ library_id: newLibraryId })
                .eq('id', pdfId)
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error en moveToLibrary:', error);
            return { data: null, error };
        }
    },

    // Añadir método para eliminar PDF
    deletePDF: async (pdfId) => {
        try {
            // Obtener información del PDF antes de eliminarlo
            const { data: pdf } = await supabase
                .from('pdfs')
                .select('*')
                .eq('id', pdfId)
                .single();

            if (!pdf) throw new Error('PDF no encontrado');

            // Eliminar archivos de almacenamiento
            await Promise.all([
                supabase.storage.from('pdfs').remove([pdf.storage_path]),
                pdf.cover_path ? supabase.storage.from('pdfs').remove([pdf.cover_path]) : Promise.resolve()
            ]);

            // Eliminar registro de la base de datos
            const { error } = await supabase
                .from('pdfs')
                .delete()
                .eq('id', pdfId);

            if (error) throw error;

            return { error: null };
        } catch (error) {
            console.error('Error en deletePDF:', error);
            return { error };
        }
    },

    getStats: async (userId) => {
        try {
            const { data: encryptedPdfs, error: pdfError } = await supabase
                .from('pdfs')
                .select(`
                    id, 
                    file_size,
                    title_encrypted,
                    updated_at,
                    libraries(name)
                `)
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            if (pdfError) throw pdfError;

            const stats = {
                totalPdfs: encryptedPdfs.length,
                totalSize: encryptedPdfs.reduce((acc, pdf) => acc + (pdf.file_size || 0), 0),
                lastUpdated: encryptedPdfs[0] ? {
                    title: encryptedPdfs[0].title_encrypted ? 
                        encryptionService.decrypt(encryptedPdfs[0].title_encrypted) : 
                        encryptedPdfs[0].title,
                    library: encryptedPdfs[0].libraries?.name,
                    date: new Date(encryptedPdfs[0].updated_at).toLocaleDateString()
                } : null
            };

            return { data: stats, error: null };
        } catch (error) {
            console.error('Error en getStats:', error);
            return { data: null, error };
        }
    },

    getAllPDFs: async (userId) => {
        try {
            const { data: encryptedPdfs, error } = await supabase
                .from('pdfs')
                .select(`
                    *,
                    libraries (
                        id,
                        name
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Descifrar los datos
            const decryptedPdfs = await Promise.all(encryptedPdfs.map(async (pdf) => {
                const [fileUrl, coverUrl] = await Promise.all([
                    getSignedUrl(pdf.storage_path),
                    pdf.cover_path ? getSignedUrl(pdf.cover_path) : null
                ]);

                return {
                    ...pdf,
                    title: pdf.title_encrypted ? encryptionService.decrypt(pdf.title_encrypted) : pdf.title,
                    file_name: pdf.file_name_encrypted ? encryptionService.decrypt(pdf.file_name_encrypted) : pdf.file_name,
                    public_url: fileUrl,
                    cover_url: coverUrl
                };
            }));
            
            return { data: decryptedPdfs, error: null };
        } catch (error) {
            console.error('Error en getAllPDFs:', error);
            return { data: null, error };
        }
    }
};