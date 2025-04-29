import React from 'react';
import { useAuth } from '../../context/AuthContext';
import '../styles/Sidebar.css';

const Sidebar = ({ onNavigate, currentView }) => {
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      // No necesitamos hacer nada más aquí, el AuthContext 
      // se encargará de redirigir a la pantalla de login
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const menuItems = [
    { id: 'home', icon: 'home', label: 'Inicio' },
    { id: 'upload', icon: 'upload', label: 'Subir PDF' },
    { id: 'library', icon: 'folder', label: 'Mis PDFs' },
    { id: 'settings', icon: 'cog', label: 'Ajustes' }
  ];

  return (
    <div className="sidebar animate-slide-in">
      <div className="sidebar-header">
        <h2><i className="fas fa-book"></i> PDF Biblioteca</h2>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map(item => (
            <li 
              key={item.id}
              className={currentView === item.id ? 'active' : ''}
              onClick={() => onNavigate(item.id)}
            >
              <i className={`fas fa-${item.icon}`}></i>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-footer">
        <button className="btn-logout" onClick={handleLogout}>
          <i className="fas fa-sign-out-alt"></i>
          <span>Cerrar Sesión</span>
        </button>
        <span className="version-info">
          <i className="fas fa-info-circle"></i> v1.2.0
        </span>
      </div>
    </div>
  );
};

export default Sidebar;