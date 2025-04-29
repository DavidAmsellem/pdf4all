import React from 'react';
import './styles/App.css';
import UploadPDF from './components/UploadPDF';
import PDFList from './components/PDFList';

function App() {
  return (
    <div className="container">
      <nav className="navbar">
        <h1>PDF Biblioteca</h1>
      </nav>
      <main className="pdf-container">
        <UploadPDF />
        <PDFList />
      </main>
    </div>
  );
}

export default App;