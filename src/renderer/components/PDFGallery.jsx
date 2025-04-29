import React from 'react';
import PDFThumbnail from './PDFThumbnail';
import './PDFGallery.css';

const PDFGallery = ({ pdfs, onPdfSelect }) => {
    return (
        <div className="pdf-gallery">
            {pdfs.map((pdf) => (
                <div key={pdf.id} className="pdf-item">
                    <PDFThumbnail 
                        pdf={pdf}
                        onClick={() => onPdfSelect(pdf)}
                    />
                </div>
            ))}
        </div>
    );
};

export default PDFGallery;