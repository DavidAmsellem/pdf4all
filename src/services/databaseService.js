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

            // 4. Cifrar datos sensibles
            const title_encrypted = encryptionService.encrypt(fileData.title);
            const file_name_encrypted = encryptionService.encrypt(fileData.fileName);

            // 5. Preparar datos para inserción
            const pdfData = {
                title: fileData.title,
                file_name: fileData.fileName,
                title_encrypted,
                file_name_encrypted,
                library_id: fileData.libraryId,
                user_id: fileData.userId,
                file_size: fileData.fileSize,
                storage_path: fileUpload.path,
                public_url: urlData.signedUrl,
                cover_url: coverUrl,
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

            // Descifrar los datos
            const decryptedPdfs = encryptedPdfs.map(pdf => ({
                ...pdf,
                title: pdf.title_encrypted ? encryptionService.decrypt(pdf.title_encrypted) : pdf.title,
                file_name: pdf.file_name_encrypted ? encryptionService.decrypt(pdf.file_name_encrypted) : pdf.file_name
            }));

            // Actualizar URLs firmadas para cada PDF
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
            // Primero obtener el library_id del PDF
            const { data: pdf } = await supabase
                .from('pdfs')
                .select('library_id')
                .eq('id', pdfId)
                .single();

            // Eliminar el PDF
            const { error } = await supabase
                .from('pdfs')
                .delete()
                .eq('id', pdfId);

            if (error) throw error;

            // Actualizar el contador de la biblioteca
            if (pdf?.library_id) {
                const { error: updateError } = await supabase.rpc('decrement_library_pdf_count', {
                    library_id: pdf.library_id
                });

                if (updateError) throw updateError;
            }

            return { error: null };
        } catch (error) {
            console.error('Error en deletePDF:', error);
            return { error };
        }
    },

    getStats: async (userId) => {
        try {
            // Obtener conteo y último PDF actualizado
            const { data: pdfs, error: pdfError } = await supabase
                .from('pdfs')
                .select(`
                    id, 
                    file_size,
                    title,
                    updated_at,
                    libraries(name)
                `)
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            if (pdfError) throw pdfError;

            const stats = {
                totalPdfs: pdfs.length,
                totalSize: pdfs.reduce((acc, pdf) => acc + (pdf.file_size || 0), 0),
                lastUpdated: pdfs[0] ? {
                    title: pdfs[0].title,
                    library: pdfs[0].libraries?.name,
                    date: new Date(pdfs[0].updated_at).toLocaleDateString()
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
            const { data, error } = await supabase
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
            
            return { data, error: null };
        } catch (error) {
            console.error('Error en getAllPDFs:', error);
            return { data: null, error };
        }
    }
};