import React from 'react';
import '../styles/Home.css';

const Home = () => {
  return (
    <div className="home-container animate-fade-in">
      <div className="welcome-section">
        <i className="fas fa-book-reader"></i>
        <h1>Bienvenido a PDF Biblioteca</h1>
        <p>Tu gestor personal de documentos PDF</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <i className="fas fa-file-pdf"></i>
          <h3>PDFs Totales</h3>
          <p className="stat-number">0</p>
        </div>
        <div className="stat-card">
          <i className="fas fa-calendar-alt"></i>
          <h3>Último PDF</h3>
          <p>No hay PDFs</p>
        </div>
        <div className="stat-card">
          <i className="fas fa-hdd"></i>
          <h3>Espacio Usado</h3>
          <p>0 MB</p>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Acciones Rápidas</h2>
        <div className="actions-grid">
          <button onClick={() => window.electron.openDirectory()}>
            <i className="fas fa-folder-open"></i>
            Abrir Carpeta
          </button>
          <button onClick={() => window.location.href = '#upload'}>
            <i className="fas fa-upload"></i>
            Subir PDF
          </button>
          <button onClick={() => window.location.href = '#library'}>
            <i className="fas fa-books"></i>
            Ver Biblioteca
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;