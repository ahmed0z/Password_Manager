'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, Info, Check, X } from 'lucide-react';
import { signUp, estimateStrength, uint8ArrayToBase64 } from '@vaultsync/core';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = estimateStrength(masterPassword);
  const strengthColors = ['var(--strength-0)', 'var(--strength-1)', 'var(--strength-2)', 'var(--strength-3)', 'var(--strength-4)'];

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const passwordRules = [
    { label: 'At least 8 characters', met: masterPassword.length >= 8 },
    { label: 'Contains a letter', met: /[a-zA-Z]/.test(masterPassword) },
    { label: 'Contains a number', met: /[0-9]/.test(masterPassword) },
    { label: 'Contains a symbol', met: /[^a-zA-Z0-9]/.test(masterPassword) },
  ];
  const allRulesMet = passwordRules.every((r) => r.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!allRulesMet) {
      setError('Password must contain at least 8 characters, a letter, a number, and a symbol.');
      return;
    }

    if (masterPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { vaultKey } = await signUp({ email, masterPassword });

      // Store vault key in localStorage
      const keyBase64 = uint8ArrayToBase64(vaultKey.key);
      localStorage.setItem('vaultsync-vault-key', keyBase64);
      localStorage.setItem('vaultsync-vault-salt', vaultKey.salt);

      router.push('/vault');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed. Please try again.');
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
              Create your secure vault
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--info-soft)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
            fontSize: '0.8125rem',
            color: 'var(--info)',
            lineHeight: 1.5,
          }}
        >
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Your master password creates a local encryption key. All data is encrypted on your device
            before syncing. Recovery is available via email confirmation.
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email Address</label>
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
                id="signup-email"
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
            <label className="form-label" htmlFor="signup-password">Master Password</label>
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
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                className="vs-input vs-input-password"
                style={{ paddingLeft: 40, paddingRight: 44 }}
                placeholder="Create a strong master password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
                minLength={8}
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

            {/* Password Requirements Guide */}
            {(passwordFocused || masterPassword) && (
              <div
                style={{
                  marginTop: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)',
                  animation: 'fadeInUp 0.2s var(--ease-out-expo)',
                }}
              >
                {passwordRules.map((rule) => (
                  <div
                    key={rule.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      color: rule.met ? 'var(--success)' : 'var(--text-tertiary)',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {rule.met ? <Check size={12} /> : <X size={12} />}
                    {rule.label}
                  </div>
                ))}
              </div>
            )}

            {/* Password Strength */}
            {masterPassword && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <div className="strength-bar">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`strength-segment ${i <= strength.score ? 'active' : ''}`}
                      style={{
                        '--strength-color': strengthColors[strength.score],
                      } as React.CSSProperties}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 'var(--space-1)',
                    fontSize: '0.6875rem',
                  }}
                >
                  <span style={{ color: strengthColors[strength.score], fontWeight: 600 }}>
                    {strength.label}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {strength.entropy} bits · {strength.crackTime}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm">Confirm Master Password</label>
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
                id="signup-confirm"
                type="password"
                className="vs-input vs-input-password"
                style={{ paddingLeft: 40 }}
                placeholder="Confirm your master password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {confirmPassword && masterPassword !== confirmPassword && (
              <p className="form-error" style={{ marginTop: 'var(--space-1)' }}>
                Passwords do not match
              </p>
            )}
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
                Creating Vault...
              </>
            ) : (
              <>
                Create Secure Vault
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="vs-divider" style={{ margin: 'var(--space-6) 0' }} />

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link
            href="/auth/login"
            style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 500 }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
