import React from 'react';

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'green' | 'blue' | 'purple' | 'red';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  children: React.ReactNode;
}

export function GradientButton({
  variant = 'green',
  size = 'md',
  icon,
  children,
  className = '',
  disabled,
  ...props
}: GradientButtonProps) {
  const variants = {
    green: 'from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 hover:shadow-green-500/25',
    blue: 'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-500/25',
    purple: 'from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 hover:shadow-purple-500/25',
    red: 'from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 hover:shadow-red-500/25'
  };

  const sizes = {
    sm: 'py-1.5 px-3 text-sm',
    md: 'py-3 px-6 text-base',
    lg: 'py-3 px-8 text-lg'
  };

  const baseClasses = `
    bg-gradient-to-r text-white font-semibold rounded-xl 
    transition-all duration-200 transform hover:scale-105 
    shadow-lg
    ${disabled ? 'from-gray-600 to-gray-500 cursor-not-allowed transform-none' : variants[variant]}
    ${sizes[size]}
    ${className}
  `.trim();

  return (
    <button
      className={baseClasses}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
}