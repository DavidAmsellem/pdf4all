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
            // Verificar que tenemos el archivo
            if (!pdfData.file) {
                throw new Error('No se ha proporcionado ningún archivo');
            }

            // 1. Primero subimos el archivo al storage
            const fileExt = pdfData.fileName.split('.').pop();
            const filePath = `${pdfData.userId}/${pdfData.libraryId}/${Date.now()}.${fileExt}`;

            // Subir el archivo al bucket 'pdfs'
            const { data: fileData, error: uploadError } = await supabase.storage
                .from('pdfs')
                .upload(filePath, pdfData.file, {
                    contentType: 'application/pdf',
                    cacheControl: '3600'
                });

            if (uploadError) {
                console.error('Error al subir:', uploadError);
                throw new Error('Error al subir el archivo: ' + uploadError.message);
            }

            // 2. Obtener la URL pública del archivo
            const { data: { publicUrl } } = supabase.storage
                .from('pdfs')
                .getPublicUrl(filePath);

            // 3. Crear el registro en la base de datos
            const { data: pdf, error: pdfError } = await supabase
                .from('pdfs')
                .insert({
                    title: pdfData.title,
                    file_name: pdfData.fileName,
                    library_id: pdfData.libraryId,
                    user_id: pdfData.userId,
                    file_size: parseInt(pdfData.fileSize) || 0,
                    storage_path: filePath,
                    public_url: publicUrl
                })
                .select()
                .single();

            if (pdfError) {
                // Si hay error, eliminamos el archivo subido
                await supabase.storage
                    .from('pdfs')
                    .remove([filePath]);
                throw pdfError;
            }

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
                // 2. Eliminar el archivo del storage
                await supabase.storage
                    .from('pdfs')
                    .remove([pdf.storage_path]);
            }

            // 3. Eliminar el registro de la base de datos
            const { error } = await supabase
                .from('pdfs')
                .delete()
                .eq('id', pdfId);

            if (error) throw error;

            await supabase.rpc('refresh_library_pdf_counts');

            return { success: true, error: null };
        } catch (error) {
            console.error('Error en deletePDF:', error);
            return { success: false, error: error.message };
        }
    }
};