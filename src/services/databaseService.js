import { supabase } from '../supabase/client';

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

    createPDF: async (pdfData) => {
        try {
            const { data: pdf, error: pdfError } = await supabase
                .from('pdfs')
                .insert({
                    title: pdfData.title,
                    file_name: pdfData.fileName,
                    library_id: pdfData.libraryId,
                    user_id: pdfData.userId,
                    file_size: parseInt(pdfData.fileSize) || 0  // Cambiado de size a file_size
                })
                .select()
                .single();

            if (pdfError) {
                console.error('Error Supabase:', pdfError);
                throw pdfError;
            }

            // Refrescar la vista materializada después de insertar
            await supabase.rpc('refresh_library_pdf_counts');

            return { data: pdf, error: null };
        } catch (error) {
            console.error('Error en createPDF:', error);
            return { 
                data: null, 
                error: error.message || 'Error al crear el PDF' 
            };
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
    }
};