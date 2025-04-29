import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import '../styles/Sidebar.css';

const Sidebar = ({ onNavigate, currentView }) => {
  const { signOut } = useAuth();
  const { darkMode, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const menuItems = [
    { id: 'home', icon: 'home', label: 'Inicio' },
    { id: 'gallery', icon: 'images', label: 'Galería PDF' },
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
        <div className="theme-toggle">
          <button onClick={toggleTheme} className="btn-theme">
            <i className={`fas fa-${darkMode ? 'sun' : 'moon'}`}></i>
            <span>{darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        </div>
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