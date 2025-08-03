/**
 * SQL Statement Parser
 * Splits SQL text into individual executable statements
 */

/**
 * Splits a SQL text into individual statements
 * Handles semicolon-separated statements, string literals, and comments
 */
export function splitSqlStatements(sql) {
  if (!sql || typeof sql !== 'string') {
    return [];
  }

  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inMultiLineComment = false;
  let inSingleLineComment = false;
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Handle single line comments
    if (!inSingleQuote && !inDoubleQuote && !inMultiLineComment && char === '-' && nextChar === '-') {
      inSingleLineComment = true;
      current += char;
      i++;
      continue;
    }

    // End single line comment at newline
    if (inSingleLineComment && (char === '\n' || char === '\r')) {
      inSingleLineComment = false;
      current += char;
      i++;
      continue;
    }

    // Handle multi-line comments
    if (!inSingleQuote && !inDoubleQuote && !inSingleLineComment && char === '/' && nextChar === '*') {
      inMultiLineComment = true;
      current += char;
      i++;
      continue;
    }

    // End multi-line comment
    if (inMultiLineComment && char === '*' && nextChar === '/') {
      inMultiLineComment = false;
      current += char + nextChar;
      i += 2;
      continue;
    }

    // Handle string literals
    if (!inMultiLineComment && !inSingleLineComment) {
      if (char === "'" && !inDoubleQuote) {
        // Handle escaped single quotes
        if (sql[i + 1] === "'") {
          current += char + nextChar;
          i += 2;
          continue;
        }
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        // Handle escaped double quotes
        if (sql[i + 1] === '"') {
          current += char + nextChar;
          i += 2;
          continue;
        }
        inDoubleQuote = !inDoubleQuote;
      }
    }

    // Handle statement separator (semicolon)
    if (!inSingleQuote && !inDoubleQuote && !inMultiLineComment && !inSingleLineComment && char === ';') {
      current += char;
      const trimmed = current.trim();
      if (trimmed && !isCommentOnly(trimmed)) {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  // Add the last statement if it exists
  const trimmed = current.trim();
  if (trimmed && !isCommentOnly(trimmed)) {
    statements.push(trimmed);
  }

  // Filter out comment-only statements and lines that start with --
  return statements.filter(stmt => {
    const cleanStmt = stmt.trim();
    return cleanStmt.length > 0 && 
           !isCommentOnly(cleanStmt) && 
           !cleanStmt.startsWith('--');
  });
}

/**
 * Checks if a statement contains only comments and whitespace
 */
function isCommentOnly(statement) {
  // Remove all whitespace and check if only comments remain
  const withoutWhitespace = statement.replace(/\s+/g, ' ').trim();
  
  // Check if it's only single-line comments
  const singleLineCommentOnly = /^(--.*(\n|$))*$/.test(withoutWhitespace);
  
  // Check if it's only multi-line comments
  const multiLineCommentOnly = /^(\/\*.*?\*\/)*$/.test(withoutWhitespace.replace(/\s/g, ''));
  
  return singleLineCommentOnly || multiLineCommentOnly || withoutWhitespace === '';
}

/**
 * Checks if a SQL statement is likely a query (SELECT) or a command (DDL/DML)
 */
export function getStatementType(statement) {
  const trimmed = statement.trim().toUpperCase();
  
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
    return 'QUERY';
  } else if (trimmed.startsWith('CREATE') || trimmed.startsWith('ALTER') || trimmed.startsWith('DROP')) {
    return 'DDL';
  } else if (trimmed.startsWith('INSERT') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
    return 'DML';
  } else if (trimmed.startsWith('SHOW') || trimmed.startsWith('DESCRIBE') || trimmed.startsWith('EXPLAIN')) {
    return 'SHOW';
  } else if (trimmed.startsWith('USE') || trimmed.startsWith('SET')) {
    return 'COMMAND';
  } else {
    return 'OTHER';
  }
}

/**
 * Formats a statement for display (truncates if too long)
 */
export function formatStatementForDisplay(statement, maxLength = 100) {
  const cleaned = statement.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.substring(0, maxLength - 3) + '...';
}
