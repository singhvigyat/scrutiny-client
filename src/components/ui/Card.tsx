import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = "", title, description, footer }) => {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${className}`}>
      {(title || description) && (
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50">
          {title && <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>}
          {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
        </div>
      )}
      <div className="p-6">{children}</div>
      {footer && (
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/50">
          {footer}
        </div>
      )}
    </div>
  );
};
