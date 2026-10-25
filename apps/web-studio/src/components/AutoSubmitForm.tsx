'use client';

import type { FormHTMLAttributes } from 'react';

/** GET form that re-submits when a filter changes (still works as a plain form without JavaScript). */
export function AutoSubmitForm(props: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      method="get"
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        // Typed fields submit on Enter / blur instead of on every keystroke.
        if (t.type === 'text' || t.type === 'search' || t.type === 'number') return;
        e.currentTarget.requestSubmit();
      }}
      onSubmit={(e) => {
        // Drop empty fields so URLs stay short and shareable.
        const form = e.currentTarget;
        for (const el of Array.from(form.elements) as HTMLInputElement[]) {
          if (el.name && !el.value && el.name !== 'city') el.disabled = true;
        }
        setTimeout(() => (Array.from(form.elements) as HTMLInputElement[]).forEach((el) => (el.disabled = false)), 0);
      }}
    />
  );
}
