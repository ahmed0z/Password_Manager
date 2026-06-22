'use client';

import { useState, useCallback } from 'react';
import { Wand2, Copy, RefreshCw, Check, Settings2 } from 'lucide-react';
import { generatePassword, estimateStrength, type PasswordGeneratorOptions } from '@vaultsync/core';

export default function GeneratorPage() {
  const [options, setOptions] = useState<PasswordGeneratorOptions>({
    length: 20,
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: false,
  });

  const [password, setPassword] = useState(() => generatePassword(options));
  const [copied, setCopied] = useState(false);
  const strength = estimateStrength(password);

  const strengthColors = ['var(--strength-0)', 'var(--strength-1)', 'var(--strength-2)', 'var(--strength-3)', 'var(--strength-4)'];

  const regenerate = useCallback(() => {
    setPassword(generatePassword(options));
    setCopied(false);
  }, [options]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateOption = <K extends keyof PasswordGeneratorOptions>(
    key: K,
    value: PasswordGeneratorOptions[K]
  ) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
    setPassword(generatePassword(newOptions));
    setCopied(false);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Password Generator</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Generate cryptographically secure passwords
          </p>
        </div>
      </div>

      <div>
        {/* Generated Password Display */}
        <div
          className="vs-card-static"
          style={{
            padding: 'var(--space-6)',
            marginBottom: 'var(--space-6)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 'clamp(1rem, 3vw, 1.5rem)',
              fontWeight: 500,
              color: 'var(--text-primary)',
              letterSpacing: '0.05em',
              wordBreak: 'break-all',
              lineHeight: 1.6,
              padding: 'var(--space-4)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
              userSelect: 'all',
            }}
          >
            {password}
          </div>

          {/* Strength Bar */}
          <div className="strength-bar" style={{ marginBottom: 'var(--space-3)' }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`strength-segment ${i <= strength.score ? 'active' : ''}`}
                style={{ '--strength-color': strengthColors[strength.score] } as React.CSSProperties}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
            <span style={{ color: strengthColors[strength.score], fontWeight: 600 }}>
              {strength.label}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>
              {strength.entropy} bits entropy · {strength.crackTime}
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-5)' }}>
            <button className="vs-btn vs-btn-primary" onClick={handleCopy} style={{ padding: 'var(--space-2) var(--space-6)' }}>
              {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
            </button>
            <button className="vs-btn vs-btn-secondary" onClick={regenerate}>
              <RefreshCw size={16} /> Regenerate
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="vs-card-static" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
            <Settings2 size={18} style={{ color: 'var(--text-secondary)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Options</h2>
          </div>

          {/* Length Slider */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Length
              </label>
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--accent-text)',
                  fontFamily: 'var(--font-mono), monospace',
                }}
              >
                {options.length}
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={64}
              value={options.length}
              onChange={(e) => updateOption('length', Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
              <span>4</span>
              <span>64</span>
            </div>
          </div>

          {/* Toggle Options */}
          {[
            { key: 'uppercase' as const, label: 'Uppercase (A-Z)' },
            { key: 'lowercase' as const, label: 'Lowercase (a-z)' },
            { key: 'digits' as const, label: 'Digits (0-9)' },
            { key: 'symbols' as const, label: 'Symbols (!@#$...)' },
            { key: 'excludeAmbiguous' as const, label: 'Exclude ambiguous (0/O, 1/l/I)' },
          ].map(({ key, label }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3) 0',
                borderBottom: '1px solid var(--surface-border)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
              }}
            >
              {label}
              <div
                onClick={() => updateOption(key, !options[key])}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 'var(--radius-full)',
                  background: options[key] ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background var(--transition-normal) ease',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: 3,
                    left: options[key] ? 23 : 3,
                    transition: 'left var(--transition-normal) var(--ease-spring)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                />
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
