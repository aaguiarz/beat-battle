import React from 'react';
import { Card } from './Card';
import { REQUIREMENTS } from '../../utils/constants';

interface RequirementItemProps {
  requirement: typeof REQUIREMENTS.HOST | typeof REQUIREMENTS.PLAYERS;
}

function RequirementItem({ requirement }: RequirementItemProps) {
  const colorClasses = {
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
  };

  return (
    <div className={`${colorClasses[requirement.color]} border rounded-xl p-4`}>
      <div className="flex items-center mb-2">
        <span className="text-xl mr-2">{requirement.icon}</span>
        <strong className={requirement.color === 'green' ? 'text-green-400' : 'text-blue-400'}>
          {requirement.title}
        </strong>
      </div>
      <p className="text-slate-300 text-sm">{requirement.description}</p>
    </div>
  );
}

export function RequirementsCard() {
  return (
    <Card title="Requirements" icon="📋" className="mb-8">
      <div className="grid md:grid-cols-2 gap-4">
        <RequirementItem requirement={REQUIREMENTS.HOST} />
        <RequirementItem requirement={REQUIREMENTS.PLAYERS} />
      </div>
    </Card>
  );
}