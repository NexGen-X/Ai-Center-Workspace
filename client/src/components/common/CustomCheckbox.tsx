import React from 'react';
import { Check } from 'lucide-react';

export interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: string;
  disabled?: boolean;
  variant?: 'checkbox' | 'switch';
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  variant = 'checkbox',
  className = '',
  id,
  name,
  'aria-label': ariaLabel
}) => {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      onChange(!checked);
    }
  };

  if (variant === 'switch') {
    return (
      <div
        className={`flex items-start gap-3 cursor-pointer select-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${className}`}
        onClick={handleToggle}
      >
        {/* Hidden input for form support */}
        {name && <input type="hidden" name={name} value={checked ? 'true' : 'false'} />}

        {/* Switch Track */}
        <div
          role="switch"
          tabIndex={disabled ? -1 : 0}
          id={id}
          aria-checked={checked}
          aria-label={typeof label === 'string' ? label : ariaLabel}
          onKeyDown={handleKeyDown}
          className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
            checked ? 'bg-cyan-500 shadow-md shadow-cyan-500/30' : 'bg-slate-800 border border-slate-700'
          }`}
        >
          {/* Switch Thumb */}
          <span
            className={`inline-block w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out mt-0.5 ml-0.5 ${
              checked ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </div>

        {/* Label & Description */}
        {(label || description) && (
          <div className="flex-1 min-w-0 text-xs">
            {label && <div className="font-semibold text-white leading-tight">{label}</div>}
            {description && <div className="text-[11px] text-slate-400 mt-0.5 leading-normal">{description}</div>}
          </div>
        )}
      </div>
    );
  }

  // Checkbox Variant
  return (
    <div
      className={`flex items-start gap-2.5 cursor-pointer select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      onClick={handleToggle}
    >
      {/* Hidden input */}
      {name && <input type="hidden" name={name} value={checked ? 'true' : 'false'} />}

      {/* Custom Checkbox Box */}
      <div
        role="checkbox"
        tabIndex={disabled ? -1 : 0}
        id={id}
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : ariaLabel}
        onKeyDown={handleKeyDown}
        className={`w-4 h-4 rounded-md flex items-center justify-center transition-all shrink-0 mt-0.5 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
          checked
            ? 'bg-cyan-600 border-cyan-400 text-white shadow-sm shadow-cyan-500/30'
            : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-transparent'
        }`}
      >
        {checked && <Check className="w-3 h-3 stroke-[3]" />}
      </div>

      {/* Label & Description */}
      {(label || description) && (
        <div className="flex-1 min-w-0 text-xs">
          {label && <div className="font-medium text-slate-200 leading-tight">{label}</div>}
          {description && <div className="text-[11px] text-slate-400 mt-0.5 leading-normal">{description}</div>}
        </div>
      )}
    </div>
  );
};
