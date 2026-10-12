import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, X, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

export interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD or ISO string
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Pilih tenggat waktu...',
  disabled = false,
  className = '',
  id,
  name,
  'aria-label': ariaLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputDateRef = useRef<HTMLInputElement>(null);

  // Normalize date string (YYYY-MM-DD)
  const normalizedValue = value ? value.split('T')[0] : '';

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return placeholder;
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return dateStr;
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const applyOffsetDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={containerRef} className={`relative inline-block w-full font-sans select-none ${className}`}>
      {/* Hidden input for form submission */}
      {name && <input type="hidden" name={name} value={normalizedValue} />}

      {/* Main Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        aria-label={ariaLabel || placeholder}
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 sm:py-2.5 rounded-xl border transition-all text-xs outline-none ${
          disabled
            ? 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
            : isOpen
            ? 'bg-slate-900 border-cyan-400 ring-2 ring-cyan-500/20 text-white shadow-lg shadow-cyan-950/20'
            : 'bg-slate-900 hover:bg-slate-850 border-slate-700 hover:border-slate-600 text-white cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate text-left">
          <CalendarIcon className={`w-3.5 h-3.5 shrink-0 ${normalizedValue ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span className={`truncate font-medium ${normalizedValue ? 'text-white' : 'text-slate-400'}`}>
            {formatDateDisplay(normalizedValue)}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {normalizedValue && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="Hapus tanggal"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </div>
      </button>

      {/* Custom Date Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:w-72 mt-1.5 z-50 bg-[#0C1019] border border-slate-700 rounded-xl shadow-2xl shadow-black/80 p-3 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 space-y-3">
          {/* Quick Preset Buttons */}
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400 mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>Preset Cepat</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => applyOffsetDays(0)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-left transition font-medium text-[11px]"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => applyOffsetDays(1)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-left transition font-medium text-[11px]"
              >
                Besok
              </button>
              <button
                type="button"
                onClick={() => applyOffsetDays(3)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-left transition font-medium text-[11px]"
              >
                3 Hari Lagi
              </button>
              <button
                type="button"
                onClick={() => applyOffsetDays(7)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-left transition font-medium text-[11px]"
              >
                1 Minggu Lagi
              </button>
              <button
                type="button"
                onClick={() => applyOffsetDays(14)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-left transition font-medium text-[11px]"
              >
                2 Minggu Lagi
              </button>
              <button
                type="button"
                onClick={() => applyOffsetDays(30)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-left transition font-medium text-[11px]"
              >
                1 Bulan Lagi
              </button>
            </div>
          </div>

          {/* Manual Date Input Picker */}
          <div className="pt-2 border-t border-slate-800">
            <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
              Pilih Tanggal Spesifik
            </label>
            <input
              ref={inputDateRef}
              type="date"
              value={normalizedValue}
              onChange={(e) => {
                onChange(e.target.value);
                setIsOpen(false);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      )}
    </div>
  );
};
