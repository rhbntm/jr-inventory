const isDev = process.env.NODE_ENV === "development";

export const logger = {
  error: (context: string, error: unknown) => {
    console.error(`[${context}]`, error);
  },

  info: (context: string, message: string) => {
    if (isDev) console.log(`[${context}]`, message);
  },

  warn: (context: string, message: string) => {
    console.warn(`[${context}]`, message);
  },
};
