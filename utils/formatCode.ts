
export const formatCode = (code: string): string => {
  let formatted = '';
  let indentLevel = 0;
  const indentString = '  ';

  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Adjust indent for closing braces
    if (line.startsWith('}') || line.startsWith(']') || line.startsWith(')')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    if (line !== '') {
      formatted += indentString.repeat(indentLevel) + line + '\n';
    } else {
       // Preserve empty lines but max 1
       if (i > 0 && lines[i-1].trim() !== '') formatted += '\n';
    }

    // Adjust indent for opening braces
    const openBraces = (line.match(/[{([]/g) || []).length;
    const closeBraces = (line.match(/[})\]]/g) || []).length;
    
    // Simple heuristic: net gain in braces increases indent
    // Exclude self-closing tags or one-liners might need better regex, but this is a basic prettifier
    indentLevel += openBraces - closeBraces;
    
    if (indentLevel < 0) indentLevel = 0;
  }

  return formatted.trim();
};
