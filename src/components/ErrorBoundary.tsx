/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Filet anti white-screen : capture les erreurs de rendu / d'effet de tout l'arbre
 * et affiche le message + la stack à l'écran (au lieu d'une page blanche), pour
 * pouvoir diagnostiquer sur mobile. Bouton « recharger ».
 */

import React from 'react';

type State = { error: Error | null; info: string };

// NB : @types/react n'est pas installé dans ce repo → React est typé `any`. On
// déclare `state` comme champ et on caste `this` pour setState/props (sinon TS ne
// voit pas les membres hérités d'une classe à base `any`).
export default class ErrorBoundary extends React.Component {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
    (this as any).setState({ info: info?.componentStack ?? '' });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return (this as any).props.children;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          background: '#0B0C10',
          color: '#EFF0F2',
          padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 16px',
          overflow: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <h1 style={{ fontSize: 15, fontWeight: 800, color: '#FF6A4A', margin: '0 0 8px' }}>
          Erreur — l'app a planté
        </h1>
        <p style={{ color: '#9A9CA4', margin: '0 0 12px' }}>
          Copie ce message au développeur, puis recharge.
        </p>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: 'rgba(255,255,255,.05)',
            border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 10,
            padding: 12,
            margin: '0 0 12px',
          }}
        >
          {String(error.stack || error.message || error)}
          {info ? `\n\n— Composant —${info}` : ''}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            background: '#EA4423',
            color: '#fff',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Recharger
        </button>
      </div>
    );
  }
}
