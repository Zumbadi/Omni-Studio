
import React from 'react';
import { Cpu, Database } from 'lucide-react';

interface MemoryGaugeProps {
  filesCount: number;
  totalChars: number;
  maxContext?: number;
}

export const MemoryGauge: React.FC<MemoryGaugeProps> = ({ filesCount, totalChars, maxContext = 128000 }) => {
  // Rough estimation: 1 token ~= 4 chars
  const estimatedTokens = Math.ceil(totalChars / 4);
  const percentage = Math.min(100, (estimatedTokens / maxContext) * 100);
  
  let statusColor = 'bg-blue-500';
  if (percentage > 60) statusColor = 'bg-yellow-500';
  if (percentage > 90) statusColor = 'bg-red-500';

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-full shadow-lg group hover:border-gray-700 transition-colors cursor-help" title={`Estimated usage: ${estimatedTokens.toLocaleString()} tokens`}>
      <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <Cpu size={10} className={percentage > 80 ? 'text-red-400 animate-pulse' : 'text-blue-400'}/>
              <span>Context</span>
          </div>
          <div className="w-20 h-1 bg-gray-800 rounded-full mt-1 overflow-hidden">
              <div 
                className={`h-full ${statusColor} transition-all duration-500`} 
                style={{ width: `${percentage}%` }}
              ></div>
          </div>
      </div>
      <div className="text-[10px] font-mono text-gray-500 border-l border-gray-800 pl-2">
          {percentage.toFixed(0)}%
      </div>
    </div>
  );
};
