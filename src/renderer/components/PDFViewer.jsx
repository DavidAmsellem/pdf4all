import React from 'react';

const PDFViewer = ({ pdfFile }) => {
    return (
        <div className="pdf-viewer">
            {pdfFile ? (
                <iframe
                    src={pdfFile}
                    title="PDF Viewer"
                    width="100%"
                    height="600px"
                />
            ) : (
                <p>No PDF file selected.</p>
            )}
        </div>
    );
};

export default PDFViewer;