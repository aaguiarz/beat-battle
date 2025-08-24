import React from 'react';

interface CardProps {
  title?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, icon, children, className = '' }: CardProps) {
  return (
    <div className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-xl ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          {icon && <span className="text-2xl mr-2">{icon}</span>}
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}