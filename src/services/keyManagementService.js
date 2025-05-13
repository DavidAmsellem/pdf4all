import { supabase } from '../supabase/client';
import { encryptionService } from './encryptionService';

export const keyManagementService = {
    generateKey: () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },

    rotateKeys: async (oldKey, newKey) => {
        try {
            // 1. Obtener todos los PDFs
            const { data: pdfs, error: fetchError } = await supabase
                .from('pdfs')
                .select('*');

            if (fetchError) throw fetchError;

            // 2. Re-cifrar datos con la nueva clave
            for (const pdf of pdfs) {
                const decryptedTitle = encryptionService.decrypt(pdf.title_encrypted);
                const decryptedFileName = encryptionService.decrypt(pdf.file_name_encrypted);

                const newEncryptedTitle = encryptionService.encrypt(decryptedTitle);
                const newEncryptedFileName = encryptionService.encrypt(decryptedFileName);

                // 3. Actualizar registro con nuevos datos cifrados
                const { error: updateError } = await supabase
                    .from('pdfs')
                    .update({
                        title_encrypted: newEncryptedTitle,
                        file_name_encrypted: newEncryptedFileName
                    })
                    .eq('id', pdf.id);

                if (updateError) throw updateError;
            }

            return { success: true };
        } catch (error) {
            console.error('Error en la rotación de claves:', error);
            return { success: false, error };
        }
    }
};