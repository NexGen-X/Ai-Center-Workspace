import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  description?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | string)[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  required?: boolean;
  fullWidth?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi...',
  searchable,
  disabled = false,
  className = '',
  triggerClassName = '',
  dropdownClassName = '',
  id,
  name,
  'aria-label': ariaLabel,
  required
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  // Normalize options to SelectOption objects
  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === 'string'
      ? { value: opt, label: opt }
      : opt
  );

  // Filter options if searchable
  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q) ||
      (opt.description && opt.description.toLowerCase().includes(q))
    );
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Auto-enable search if options count is greater than 7
  const isSearchEnabled = searchable ?? (normalizedOptions.length > 7);

  // Close on outside click (mouse + touch)
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDownCapture, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDownCapture, true);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && isSearchEnabled && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, isSearchEnabled]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        const currentIndex = filteredOptions.findIndex((opt) => opt.value === value);
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const selected = filteredOptions[highlightedIndex];
          if (!selected.disabled) {
            onChange(selected.value);
            setIsOpen(false);
            setSearchQuery('');
            setHighlightedIndex(-1);
          }
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleSelect = (optionValue: string, optionDisabled?: boolean) => {
    if (optionDisabled) return;
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left font-sans select-none ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden input for form submission compatibility */}
      {name && <input type="hidden" name={name} value={value} required={required} />}

      {/* Main Trigger Button */}
      <button
        type="button"
        id={selectId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) {
              const currentIndex = filteredOptions.findIndex((opt) => opt.value === value);
              setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
            }
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 sm:py-2.5 rounded-xl border transition-all text-xs outline-none ${
          disabled
            ? 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
            : isOpen
            ? 'bg-slate-900 border-cyan-400 ring-2 ring-cyan-500/20 text-white shadow-lg shadow-cyan-950/20'
            : 'bg-slate-900 hover:bg-slate-850 border-slate-700 hover:border-slate-600 text-white cursor-pointer'
        } ${triggerClassName}`}
      >
        {/* Selected value or placeholder */}
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate text-left">
          {selectedOption?.icon && (
            <span className="shrink-0 text-slate-300">{selectedOption.icon}</span>
          )}
          <span className={`truncate font-medium ${selectedOption ? 'text-white' : 'text-slate-400'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border leading-none ${
                selectedOption.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        {/* Chevron Icon */}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-cyan-400' : ''
          }`}
        />
      </button>

      {/* Custom Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={`absolute left-0 right-0 mt-1.5 z-50 bg-[#0C1019] border border-slate-700/90 rounded-xl shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${dropdownClassName}`}
        >
          {/* Search bar inside dropdown if enabled */}
          {isSearchEnabled && (
            <div className="p-2 border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="Cari opsi..."
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none py-1 px-1"
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div
            ref={optionsListRef}
            className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 divide-y-0 text-xs custom-scrollbar"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-3 text-center text-slate-500 text-xs font-mono">
                Tidak ada opsi yang cocok
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value, opt.disabled)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed bg-transparent text-slate-600'
                        : isSelected
                        ? 'bg-cyan-500/15 text-cyan-300 font-semibold'
                        : isHighlighted
                        ? 'bg-slate-800/90 text-white'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{opt.label}</div>
                        {opt.description && (
                          <div className="text-[10px] text-slate-400 truncate leading-tight font-normal">
                            {opt.description}
                          </div>
                        )}
                      </div>
                      {opt.badge && (
                        <span
                          className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border leading-none ${
                            opt.badgeColor || 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
