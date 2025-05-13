import { supabase } from '../supabase/client';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

            // Actualizar el contador de la biblioteca
            const { error: updateError } = await supabase.rpc('increment_library_pdf_count', {
                library_id: fileData.libraryId
            });

            if (updateError) throw updateError;

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