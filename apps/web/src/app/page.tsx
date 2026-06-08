import Link from 'next/link';
import { Shield, Lock, RefreshCw, Smartphone, Chrome, Globe, ArrowRight, Fingerprint, FolderKey, BookmarkPlus } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="hero-gradient" style={{ minHeight: '100vh' }}>
      {/* Glow orbs */}
      <div
        className="hero-glow-orb"
        style={{
          width: 500,
          height: 500,
          top: -100,
          left: '20%',
          background: 'hsla(190, 95%, 60%, 0.12)',
        }}
      />
      <div
        className="hero-glow-orb"
        style={{
          width: 400,
          height: 400,
          bottom: '10%',
          right: '10%',
          background: 'hsla(270, 80%, 65%, 0.08)',
          animationDelay: '3s',
        }}
      />

      {/* Navigation */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-8)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={20} color="white" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            VaultSync
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link href="/auth/login" className="vs-btn vs-btn-ghost">
            Sign In
          </Link>
          <Link href="/auth/signup" className="vs-btn vs-btn-primary">
            Get Started
            <ArrowRight size={16} />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 'var(--space-20) var(--space-8)',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-4)',
            background: 'var(--accent-soft)',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--accent-text)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <Lock size={14} />
          Zero-Knowledge Encryption
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: 'var(--space-6)',
            color: 'var(--text-primary)',
          }}
        >
          Your passwords.{' '}
          <span className="hero-title-gradient">Your control.</span>
          <br />
          Everywhere you go.
        </h1>

        <p
          style={{
            fontSize: '1.125rem',
            color: 'var(--text-secondary)',
            maxWidth: 600,
            margin: '0 auto var(--space-8)',
            lineHeight: 1.6,
          }}
        >
          VaultSync encrypts everything on your device before it ever touches the cloud.
          Sync across web, mobile, and browser — with zero-knowledge security.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/auth/signup"
            className="vs-btn vs-btn-primary"
            style={{ padding: 'var(--space-3) var(--space-8)', fontSize: '1rem' }}
          >
            Start Free
            <ArrowRight size={18} />
          </Link>
          <Link
            href="#features"
            className="vs-btn vs-btn-secondary"
            style={{ padding: 'var(--space-3) var(--space-8)', fontSize: '1rem' }}
          >
            Learn More
          </Link>
        </div>

        {/* Platform pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-6)',
            marginTop: 'var(--space-10)',
            color: 'var(--text-tertiary)',
            fontSize: '0.8125rem',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Globe size={16} /> Web App
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Smartphone size={16} /> Mobile
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Chrome size={16} /> Extension
          </span>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 'var(--space-16) var(--space-8)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Security-first, everywhere
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto' }}>
            Built with production-grade cryptography and zero-knowledge architecture.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          {[
            {
              icon: <Fingerprint size={24} />,
              title: 'Zero-Knowledge Vault',
              description:
                'Your master password derives an encryption key locally. We never see your passwords — only encrypted blobs.',
            },
            {
              icon: <RefreshCw size={24} />,
              title: 'Real-Time Sync',
              description:
                'Add a password on your phone and it appears on your laptop instantly. Powered by encrypted realtime channels.',
            },
            {
              icon: <Chrome size={24} />,
              title: 'Smart Autofill',
              description:
                'Our Chrome extension detects login forms across any website and fills credentials with one click.',
            },
            {
              icon: <FolderKey size={24} />,
              title: 'Organized Folders',
              description:
                'Create custom folders and organize your passwords exactly how you want. Folder names are encrypted too.',
            },
            {
              icon: <BookmarkPlus size={24} />,
              title: 'Bookmark Sync',
              description:
                'Sync your browser bookmarks securely. Access and manage them from any device, even your phone.',
            },
            {
              icon: <Shield size={24} />,
              title: 'Recovery Protection',
              description:
                'Set up email-based vault recovery during signup. If you forget your password, your data isn\'t lost.',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="vs-card"
              style={{
                padding: 'var(--space-6)',
                animation: `fadeInUp 0.5s ${0.1 * i}s var(--ease-out-expo) both`,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-text)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                {feature.icon}
              </div>
              <h3
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                {feature.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: 'var(--space-8)',
          color: 'var(--text-tertiary)',
          fontSize: '0.8125rem',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <p>&copy; {new Date().getFullYear()} VaultSync. Your data, encrypted, everywhere.</p>
      </footer>
    </div>
  );
}
