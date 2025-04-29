import React from 'react';

const Sidebar = ({ pdfFiles, onSelectFile }) => {
    return (
        <div className="sidebar">
            <h2>Biblioteca de PDF</h2>
            <ul>
                {pdfFiles.map((file, index) => (
                    <li key={index} onClick={() => onSelectFile(file)}>
                        {file.name}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Sidebar;