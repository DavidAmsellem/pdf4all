import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import '../styles/Auth.css';

const Auth = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState(null);
    const { signIn, signUp } = useAuth();

    const validateEmail = (email) => {
        const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        return re.test(email);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        // Validar email
        if (!validateEmail(email)) {
            setError('Por favor, introduce un email válido');
            return;
        }

        // Validar contraseña
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            if (isLogin) {
                await signIn(email, password);
            } else {
                await signUp(email, password);
            }
        } catch (error) {
            console.error('Error:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <i className="fas fa-book"></i>
                    <h2>PDF Biblioteca</h2>
                    <p>{isLogin ? 'Iniciar Sesión' : 'Registro'}</p>
                </div>

                {error && (
                    <div className="auth-error">
                        <i className="fas fa-exclamation-circle"></i>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={error && !validateEmail(email) ? 'input-error' : ''}
                            placeholder="ejemplo@correo.com"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={error && password.length < 6 ? 'input-error' : ''}
                            placeholder="Mínimo 6 caracteres"
                            required
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="btn-auth"
                        disabled={loading}
                    >
                        {loading ? (
                            <i className="fas fa-spinner fa-spin"></i>
                        ) : isLogin ? 'Iniciar Sesión' : 'Registrarse'}
                    </button>
                </form>

                <div className="auth-footer">
                    <button 
                        className="btn-switch"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError(null);
                        }}
                    >
                        {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Auth;