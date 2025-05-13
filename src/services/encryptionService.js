import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY;

if (!SECRET_KEY) {
    console.error('⚠️ VITE_ENCRYPTION_KEY no está definida en las variables de entorno');
}

export const encryptionService = {
    encrypt: (data) => {
        if (!data) return null;
        try {
            const stringData = typeof data === 'object' ? JSON.stringify(data) : String(data);
            return CryptoJS.AES.encrypt(stringData, SECRET_KEY).toString();
        } catch (error) {
            console.error('Error al cifrar:', error);
            return null;
        }
    },

    decrypt: (encryptedData) => {
        if (!encryptedData) return null;
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
            const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            try {
                return JSON.parse(decryptedString);
            } catch {
                return decryptedString;
            }
        } catch (error) {
            console.error('Error al descifrar:', error);
            return null;
        }
    }
};