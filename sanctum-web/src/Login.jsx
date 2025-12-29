import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // <--- Added this
import useAuthStore from './store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate(); // <--- Initialize hook

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      // No alert needed, just move
      navigate('/'); // Redirects to Dashboard (Protected Route)
    } else {
      alert("Access Denied.");
    }
  };

  return (
    <div className="flex h-screen w-screen bg-sanctum-dark">
      {/* LEFT: Digital Sanctum Branding */}
      <div className="w-1/2 flex flex-col justify-center items-center border-r border-sanctum-gold/20">
        <h1 className="text-4xl font-bold text-white mb-2">Digital Sanctum</h1>
        <p className="text-sanctum-gold tracking-widest uppercase text-sm">Sovereign Architecture</p>
      </div>

      {/* RIGHT: Login Form */}
      <div className="w-1/2 flex flex-col justify-center items-center bg-black/20">
        <form onSubmit={handleSubmit} className="w-80 flex flex-col gap-4">
          <input
            type="email"
            placeholder="Identity"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 bg-slate-800 text-white border border-slate-700 rounded focus:border-sanctum-blue outline-none"
          />
          <input
            type="password"
            placeholder="Cipher"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-3 bg-slate-800 text-white border border-slate-700 rounded focus:border-sanctum-blue outline-none"
          />
          <button
            type="submit"
            className="p-3 bg-sanctum-blue hover:bg-blue-600 text-white font-bold rounded transition-colors"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
