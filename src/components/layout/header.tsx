'use client';

import { Home, ChevronRight } from 'lucide-react';

interface HeaderProps {
  title: string;
  description?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  onHomeClick?: () => void;
}

export function Header({ title, description, breadcrumb, actions, onHomeClick }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-2">
          <button
            onClick={onHomeClick}
            className="hover:text-[#1877F2] transition-colors"
            title="Back to Dashboard"
          >
            <Home className="w-4 h-4" />
          </button>
          {breadcrumb.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5" />
              {item.href ? (
                <button
                  onClick={onHomeClick}
                  className="hover:text-[#1877F2] transition-colors"
                >
                  {item.label}
                </button>
              ) : (
                <span className="text-[#1877F2] font-medium">{item.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">{title}</h1>
          {description && <p className="text-gray-500 mt-0.5 text-sm">{description}</p>}
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
