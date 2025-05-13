# PDF Biblioteca

Una aplicación de escritorio para gestionar y organizar archivos PDF, construida con Electron y React.

## 🚀 Características

- Interfaz moderna construida con React
- Aplicación de escritorio multiplataforma
- Gestión de archivos PDF
- [Más características por venir]

## 📋 Prerequisitos

- Node.js >= 14.0.0
- npm >= 6.0.0

## 🔧 Instalación

1. Clona el repositorio
```bash
git clone https://github.com/DavidAmsellem/pdf4all.git
```

2. Instala las dependencias
```bash
npm install
```

3. Inicia la aplicación en modo desarrollo
```bash
npm run dev
```

## Configuración de la Base de Datos

### 1. Estructura de Tablas

Ejecuta estos comandos SQL en el Editor SQL de Supabase:

```sql
-- Tabla de PDFs
CREATE TABLE IF NOT EXISTS public.pdfs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    title_encrypted text,
    file_name_encrypted text,
    public_url_encrypted text,
    cover_url_encrypted text,
    storage_path_encrypted text,
    cover_path_encrypted text,
    library_id uuid REFERENCES public.libraries(id),
    user_id uuid,
    file_size bigint,
    storage_path text,
    cover_path text,
    title text,
    file_name text
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_pdfs_user_library ON pdfs(user_id, library_id);
CREATE INDEX IF NOT EXISTS idx_pdfs_title ON pdfs(title);
CREATE INDEX IF NOT EXISTS idx_pdfs_updated ON pdfs(updated_at DESC);
```

### 2. Políticas de Seguridad (RLS)

```sql
-- Habilitar RLS
ALTER TABLE pdfs ENABLE ROW LEVEL SECURITY;

-- Políticas para PDFs
CREATE POLICY "Usuarios pueden ver sus propios PDFs"
ON pdfs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden crear sus propios PDFs"
ON pdfs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden actualizar sus propios PDFs"
ON pdfs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden eliminar sus propios PDFs"
ON pdfs FOR DELETE
USING (auth.uid() = user_id);
```

### 3. Configuración de Storage

1. Crear los siguientes buckets en Supabase Storage:
   - `pdfs`: Para almacenar los archivos PDF
   - `library-covers`: Para las imágenes de portada de las bibliotecas

2. Configurar políticas de storage:

```sql
-- Políticas para el bucket 'pdfs'
CREATE POLICY "Acceso autenticado a PDFs"
ON storage.objects FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Subida autenticada de PDFs"
ON storage.objects FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Eliminación autenticada de PDFs"
ON storage.objects FOR DELETE
USING (auth.role() = 'authenticated');
```

### 4. Variables de Entorno

Crear archivo `.env.local` en la raíz del proyecto:

```bash
VITE_ENCRYPTION_KEY=tu-clave-secreta-aquí
VITE_SUPABASE_URL=tu-url-de-supabase
VITE_SUPABASE_ANON_KEY=tu-clave-anon-de-supabase
```

Para generar una clave de cifrado segura:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Mantenimiento

- Las URLs firmadas expiran cada hora (3600 segundos)
- Los archivos cifrados requieren la clave de cifrado para ser descifrados
- La rotación de claves requerirá re-cifrar todos los datos
- Mantener copias de seguridad regulares de la base de datos

### 6. Consideraciones de Seguridad

- No compartir la clave de cifrado
- Mantener las variables de entorno seguras
- Usar HTTPS para todas las comunicaciones
- Rotar las claves periódicamente
- Mantener copias de seguridad cifradas
- Monitorear los logs de acceso

### 📦 Dependencias Principales

- `crypto-js`: Cifrado y seguridad
- `pdfjs-dist`: Manejo de PDFs y generación de portadas
- `@supabase/supabase-js`: Cliente de base de datos
- `react-hot-toast`: Sistema de notificaciones
- `react-icons`: Iconografía
- `react-router-dom`: Enrutamiento

## 🛠️ Construido con

- [Electron](https://www.electronjs.org/) - Framework para crear aplicaciones de escritorio
- [React](https://reactjs.org/) - Biblioteca de JavaScript para interfaces de usuario
- [Vite](https://vitejs.dev/) - Herramienta de desarrollo frontend

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - mira el archivo [LICENSE.md](LICENSE.md) para detalles

## ✒️ Autor

* **David Amsellem** - *Trabajo Inicial* - [DavidAmsellem](https://github.com/DavidAmsellem)