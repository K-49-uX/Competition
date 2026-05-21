import { useState, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Password input with show/hide toggle. Forwards all standard input props.
 */
export const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        {...props}
        type={show ? 'text' : 'password'}
        className={`input pe-12 ${props.className || ''}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
        aria-pressed={show}
        className="absolute end-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {show ? t('auth.hide') : t('auth.show')}
      </button>
    </div>
  );
});
