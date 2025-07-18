export interface NetworkErrorInfo {
  code: string;
  message: string;
  hostname?: string;
  originalError?: any;
}

export class NetworkError extends Error {
  public code: string;
  public hostname?: string;
  public originalError?: any;

  constructor(info: NetworkErrorInfo) {
    super(info.message);
    this.name = 'NetworkError';
    this.code = info.code;
    this.hostname = info.hostname;
    this.originalError = info.originalError;
  }
}

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  // Check for common network error codes
  const networkErrorCodes = [
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ECONNRESET',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'EPIPE',
    'ECONNABORTED'
  ];
  
  // Check direct error code
  if (networkErrorCodes.includes(error.code)) {
    return true;
  }
  
  // Check nested cause
  if (error.cause && networkErrorCodes.includes(error.cause?.code)) {
    return true;
  }
  
  // Check for fetch failures
  if (error.message?.includes('fetch failed') || error.message?.includes('getaddrinfo')) {
    return true;
  }
  
  return false;
}

export function parseNetworkError(error: any): NetworkError {
  // Handle fetch errors with nested causes
  if (error.cause && error.cause.code) {
    const cause = error.cause;
    let message = 'Network connection failed';
    
    switch (cause.code) {
      case 'ENOTFOUND':
        message = 'Unable to connect to MNEE network. Please check your internet connection.';
        break;
      case 'ECONNREFUSED':
        message = 'Connection refused by MNEE server. The service may be temporarily unavailable.';
        break;
      case 'ETIMEDOUT':
        message = 'Request timed out. Please check your internet connection and try again.';
        break;
      case 'ECONNRESET':
        message = 'Connection was reset. Please try again.';
        break;
      case 'ENETUNREACH':
      case 'EHOSTUNREACH':
        message = 'Network unreachable. Please check your internet connection.';
        break;
      default:
        message = `Network error: ${cause.code}. Please check your connection and try again.`;
    }
    
    return new NetworkError({
      code: cause.code,
      message,
      hostname: cause.hostname,
      originalError: error
    });
  }
  
  // Handle direct network errors
  if (error.code) {
    let message = 'Network error occurred';
    
    switch (error.code) {
      case 'ENOTFOUND':
        message = 'Unable to connect to MNEE network. Please check your internet connection.';
        break;
      case 'ECONNREFUSED':
        message = 'Connection refused by MNEE server. The service may be temporarily unavailable.';
        break;
      case 'ETIMEDOUT':
        message = 'Request timed out. Please check your internet connection and try again.';
        break;
      default:
        message = `Network error: ${error.code}. Please check your connection and try again.`;
    }
    
    return new NetworkError({
      code: error.code,
      message,
      hostname: error.hostname,
      originalError: error
    });
  }
  
  // Generic network error
  return new NetworkError({
    code: 'NETWORK_ERROR',
    message: 'Network error occurred. Please check your internet connection and try again.',
    originalError: error
  });
}

export function logNetworkError(error: any, operation: string): string | undefined {
  if (isNetworkError(error)) {
    const networkError = parseNetworkError(error);
    console.error(`Network error during ${operation}: ${networkError.message}`);
    return networkError.message;
  } else {
    console.error(`Failed to ${operation}:`, error);
    return undefined;
  }
}