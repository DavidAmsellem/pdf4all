import { supabase } from '../supabase/client';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const databaseService = {
    // Servicios para bibliotecas
    getUserLibraries: async (userId) => {
        try {
            // Primero obtenemos las bibliotecas
            const { data: libraries, error: librariesError } = await supabase
                .from('libraries')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (librariesError) throw librariesError;

            // Luego obtenemos el conteo de PDFs para cada biblioteca
            const { data: pdfCounts, error: countError } = await supabase
                .from('library_pdf_counts')
                .select('*');

            if (countError) throw countError;

            // Combinamos la información
            const librariesWithCounts = libraries.map(library => ({
                ...library,
                pdf_count: pdfCounts.find(count => count.library_id === library.id)?.pdf_count || 0
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
            // 1. Subir el PDF
            const pdfFileName = `pdfs/${Date.now()}-${fileData.fileName}`;
            const { data: fileUpload, error: uploadError } = await supabase.storage
                .from('pdfs')
                .upload(pdfFileName, fileData.file);

            if (uploadError) throw uploadError;

            // Obtener la URL pública del PDF
            const { data: { publicUrl } } = supabase.storage
                .from('pdfs')
                .getPublicUrl(fileUpload.path);

            // 2. Crear el registro en la base de datos
            const pdfData = {
                title: fileData.title,
                file_name: fileData.fileName,
                library_id: fileData.libraryId,
                user_id: fileData.userId,
                file_size: fileData.fileSize,
                public_url: publicUrl,
                storage_path: fileUpload.path
            };

            // Añadir campos opcionales si existen
            if (fileData.coverUrl) pdfData.cover_url = fileData.coverUrl;
            if (fileData.coverPath) pdfData.cover_path = fileData.coverPath;

            const { data, error } = await supabase
                .from('pdfs')
                .insert([pdfData])
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error en createPDF:', error);
            return { data: null, error };
        }
    },

    getPDFsByLibrary: async (libraryId) => {
        try {
            const { data, error } = await supabase
                .from('pdfs')
                .select(`
                    *,
                    libraries!inner (
                        id,
                        name
                    )
                `)
                .eq('library_id', libraryId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { data, error: null };
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
            // 1. Obtener información del PDF
            const { data: pdf } = await supabase
                .from('pdfs')
                .select('storage_path')
                .eq('id', pdfId)
                .single();

            if (pdf?.storage_path) {
                // 2. Eliminar archivo del storage
                await supabase.storage
                    .from('pdfs')
                    .remove([pdf.storage_path]);
            }

            // 3. Eliminar registro de la base de datos
            const { error } = await supabase
                .from('pdfs')
                .delete()
                .eq('id', pdfId);

            if (error) throw error;

            return { error: null };
        } catch (error) {
            console.error('Error en deletePDF:', error);
            return { error: error.message };
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