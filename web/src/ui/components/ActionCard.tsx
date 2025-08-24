import React from 'react';
import { GradientButton } from './GradientButton';

interface ActionCardProps {
  icon: string;
  title: string;
  description: string;
  color: 'green' | 'blue' | 'purple' | 'red';
  onClick?: () => void;
  buttonText: string;
  buttonIcon?: string;
  children?: React.ReactNode;
  hideButton?: boolean;
}

export function ActionCard({
  icon,
  title,
  description,
  color,
  onClick,
  buttonText,
  buttonIcon,
  children,
  hideButton = false
}: ActionCardProps) {
  const hoverColors = {
    green: 'hover:border-green-500/50',
    blue: 'hover:border-blue-500/50',
    purple: 'hover:border-purple-500/50',
    red: 'hover:border-red-500/50'
  };

  const iconBgColors = {
    green: 'bg-green-500/20 group-hover:bg-green-500/30',
    blue: 'bg-blue-500/20 group-hover:bg-blue-500/30',
    purple: 'bg-purple-500/20 group-hover:bg-purple-500/30',
    red: 'bg-red-500/20 group-hover:bg-red-500/30'
  };

  return (
    <div className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl ${hoverColors[color]} transition-all duration-300 group`}>
      <div className="text-center">
        <div className={`w-16 h-16 ${iconBgColors[color]} rounded-full flex items-center justify-center mx-auto mb-4 transition-colors`}>
          <span className="text-3xl">{icon}</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-slate-400 text-sm mb-6">{description}</p>
        
        {children && <div className="mb-6">{children}</div>}
        
        {!hideButton && onClick && (
          <GradientButton
            variant={color}
            icon={buttonIcon}
            onClick={onClick}
            className="w-full"
          >
            {buttonText}
          </GradientButton>
        )}
      </div>
    </div>
  );
}