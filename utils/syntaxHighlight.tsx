import React from 'react';

export const highlightCode = (input: string) => {
  if (!input) return '';
  
  // Escaping HTML entities
  let text = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Syntax Rules (Order matters)
  return text.split(/([a-zA-Z0-9_$]+|['"`].*?['"`]|\/\/.*|\s+|[{}()[\]<>=!+\-*/.,:;])/g).map((token, i) => {
      if (!token) return null;
      if (token.startsWith('//')) return <span key={i} className="text-gray-500">{token}</span>;
      if (token.match(/^['"`]/)) return <span key={i} className="text-green-400">{token}</span>;
      if (token.match(/^\d+$/)) return <span key={i} className="text-orange-400">{token}</span>;
      if (['import','export','const','let','var','function','return','if','else','for','while','switch','case','default','break','continue','true','false','null','undefined','new','this','class','extends','interface','type','from','default'].includes(token)) return <span key={i} className="text-purple-400 italic">{token}</span>;
      if (['React','useState','useEffect','useRef','useMemo','useCallback','console','window','document','localStorage','JSON','Math','Date'].includes(token)) return <span key={i} className="text-yellow-200">{token}</span>;
      if (token.match(/^[A-Z][a-zA-Z0-9]*$/)) return <span key={i} className="text-blue-300">{token}</span>; // Component-like
      if (['{','}','(',')','[',']'].includes(token)) return <span key={i} className="text-yellow-600">{token}</span>;
      return token;
  });
};