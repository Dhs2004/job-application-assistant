function write(level: string, message: string, details?: Record<string, unknown>): void {
  const safeDetails = details ? JSON.stringify(details, (_key, value) => {
    if (typeof value !== 'string') return value;
    return value.replace(/([\w.+-]{2})[\w.+-]*(@[^\s]+)/g, '$1***$2');
  }) : '';
  process.stdout.write(`${new Date().toISOString()} ${level} ${message}${safeDetails ? ` ${safeDetails}` : ''}\n`);
}

export const logger = {
  info: (message: string, details?: Record<string, unknown>) => write('INFO', message, details),
  error: (message: string, details?: Record<string, unknown>) => write('ERROR', message, details),
};
