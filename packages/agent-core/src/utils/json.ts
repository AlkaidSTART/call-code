export const parseJson = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

export const stringifyJson = (value: unknown, fallback = ''): string => {
  try {
    return JSON.stringify(value) ?? fallback;
  } catch {
    return fallback;
  }
};
