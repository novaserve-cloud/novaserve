export async function gcpRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  initialDelayMs = 1000
): Promise<T> {
  let attempt = 0;
  
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      
      const isRetriable = 
        error?.code === 429 || 
        (error?.code >= 500 && error?.code < 600) ||
        error?.message?.includes("Rate Exceeded") ||
        error?.message?.includes("Quota exceeded");
        
      if (!isRetriable || attempt >= maxRetries) {
        throw error;
      }
      
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
