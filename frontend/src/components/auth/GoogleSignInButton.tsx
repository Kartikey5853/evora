import { useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: any;
  }
}

type Props = {
  clientId: string;
  onCredential: (credential: string) => Promise<void> | void;
  className?: string;
  text?: string;
};

const GOOGLE_SCRIPT_ID = 'google-identity-services';

function loadGoogleIdentityScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(GOOGLE_SCRIPT_ID)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

export default function GoogleSignInButton({ clientId, onCredential, className, text }: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  const buttonConfig = useMemo(
    () => ({
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: divRef.current?.clientWidth ? String(divRef.current.clientWidth) : undefined,
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleIdentityScript();
        if (cancelled) return;
        if (!window.google?.accounts?.id) throw new Error('Google Identity Services unavailable');

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp: any) => {
            const credential = resp?.credential;
            if (credential) await onCredential(credential);
          },
        });

        // Render Google-managed button
        if (divRef.current) {
          divRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(divRef.current, buttonConfig);
        }

        setReady(true);
      } catch {
        setReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential, buttonConfig]);

  // Optional text shown if you want a custom fallback (not used by default)
  const fallback = text || 'Continue with Google';

  return (
    <div className={className}>
      <div ref={divRef} />
      {!ready ? (
        <button type="button" disabled className="btn-secondary w-full mt-3 opacity-60">
          {fallback}
        </button>
      ) : null}
    </div>
  );
}
