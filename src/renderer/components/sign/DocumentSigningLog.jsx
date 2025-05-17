import React from 'react';
import EmailStatusList from './EmailStatusList';
import '../../styles/sign/DocumentSigningLog.css';

const DocumentSigningLog = () => {
    return (
        <div className="signing-log-container animate-fade-in">
            <header className="signing-log-header">
                <h2>
                    <i className="fas fa-history"></i>
                    Registro de Firmas
                </h2>
            </header>
            <div className="signing-log-content">
                <EmailStatusList />
            </div>
        </div>
    );
};

export default DocumentSigningLog;