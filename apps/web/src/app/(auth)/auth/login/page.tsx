'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { signIn, uint8ArrayToBase64 } from '@vaultsync/core';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const { vaultKey } = await signIn({ email, masterPassword });

      // Store vault key in localStorage
      const keyBase64 = uint8ArrayToBase64(vaultKey.key);
      localStorage.setItem('vaultsync-vault-key', keyBase64);
      localStorage.setItem('vaultsync-vault-salt', vaultKey.salt);

      router.push('/vault');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="vs-card-static auth-card" style={{ animation: 'fadeInScale 0.4s var(--ease-out-expo)' }}>
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Shield size={24} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              VaultSync
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
              Sign in to your vault
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                }}
              />
              <input
                id="login-email"
                type="email"
                className="vs-input"
                style={{ paddingLeft: 40 }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Master Password</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                }}
              />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="vs-input vs-input-password"
                style={{ paddingLeft: 40, paddingRight: 44 }}
                placeholder="Enter your master password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  padding: 4,
                  display: 'flex',
                }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="vs-btn vs-btn-primary"
            style={{ width: '100%', padding: 'var(--space-3)', marginTop: 'var(--space-4)', fontSize: '0.9375rem' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                Unlocking Vault...
              </>
            ) : (
              <>
                Unlock Vault
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Links */}
        <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
          <Link
            href="/auth/recover"
            style={{
              fontSize: '0.8125rem',
              color: 'var(--accent-text)',
              textDecoration: 'none',
            }}
          >
            Forgot your master password?
          </Link>
        </div>

        <div className="vs-divider" style={{ margin: 'var(--space-6) 0' }} />

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Don&apos;t have an account?{' '}
          <button
            type="button"
            id="goto-signup"
            onClick={() => router.push('/auth/signup')}
            style={{
              color: 'var(--accent-text)',
              textDecoration: 'none',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              padding: 0,
            }}
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}
