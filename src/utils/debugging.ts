/**
 * Recursively scans an object for undefined values
 * @returns Array of paths with undefined values
 */
export function findUndefinedValues(obj: any, path = ''): string[] {
  if (obj === undefined) {
    return [path];
  }
  
  if (obj === null || typeof obj !== 'object') {
    return [];
  }
  
  let results: string[] = [];
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      results = results.concat(findUndefinedValues(item, `${path}[${index}]`));
    });
  } else {
    Object.entries(obj).forEach(([key, value]) => {
      results = results.concat(findUndefinedValues(value, path ? `${path}.${key}` : key));
    });
  }
  
  return results;
}

// Example usage (as a comment, not actual code):
/*
// Example usage in useSaveBoard before sending to Firebase:
const undefinedPaths = findUndefinedValues(boardToSave);
if (undefinedPaths.length > 0) {
  console.error('Found undefined values at these paths:', undefinedPaths);
}
*/ 