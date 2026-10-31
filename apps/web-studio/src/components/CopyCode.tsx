'use client';

import { useState } from 'react';

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked: the code is visible to copy manually */
        }
      }}
    >
      {copied ? 'Copied' : 'Copy code'}<span className="visually-hidden"> {code}</span>
    </button>
  );
}
