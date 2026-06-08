import { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { getSupabaseClient } from '@vaultsync/core';
import { SidePanel } from './App';

// Initialize Supabase client for the Side Panel environment
getSupabaseClient(
  'https://nbzrgenezurnecdmikxl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ienJnZW5lenVybmVjZG1pa3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Mjc1NzksImV4cCI6MjA5NjMwMzU3OX0.y1tmfWvIWXaeLbCFJHMJk7fggQhSrCcbXyqWxLWHj1w'
);
// Global error display for non-React uncaught errors
if (typeof window !== 'undefined') {
  window.onerror = function (message, source, lineno, colno, error) {
    const rootEl = document.getElementById('root');
    if (rootEl) {
      rootEl.innerHTML = `
        <div style="padding: 24px; font-family: sans-serif; background: #0a0f1e; color: #ef4444; height: 100vh; display: flex; flex-direction: column; justify-content: center;">
          <h3 style="margin-bottom: 8px; color: #ef4444;">Extension Load Error</h3>
          <p style="font-size: 13px; color: #8a8f9e; margin-bottom: 16px;">${message}</p>
          <pre style="font-size: 11px; color: #f2f2f2; background: #141928; padding: 12px; border-radius: 8px; overflow: auto; max-height: 60%;">${error?.stack || `${source}:${lineno}:${colno}`}</pre>
        </div>
      `;
    }
  };
}

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in SidePanel:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif', background: '#0a0f1e', color: '#ef4444', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ marginBottom: 8, color: '#ef4444' }}>Render Crash</h3>
          <p style={{ fontSize: 13, color: '#8a8f9e', marginBottom: 16 }}>{this.state.error?.message}</p>
          <pre style={{ fontSize: 11, color: '#f2f2f2', background: '#141928', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: '60%' }}>
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <ErrorBoundary>
    <SidePanel />
  </ErrorBoundary>
);
