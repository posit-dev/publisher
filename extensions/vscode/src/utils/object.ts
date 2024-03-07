/**
 * Converts the keys of an object to camel case recursively.
 * @param object - The object to convert.
 * @returns The object with camel case keys.
 */
export const convertKeysToCamelCase = (object: any): any => {
  if (typeof object !== 'object' || object === null) {
    return object;
  }

  if (Array.isArray(object)) {
    // Recursively convert keys for each item in the array
    return object.map(item => convertKeysToCamelCase(item));
  }

  const newObject: any = {};
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      // Convert the key to camel case
      const newKey = key.charAt(0).toLowerCase() + key.slice(1);
      // Recursively convert keys for nested objects
      newObject[newKey] = convertKeysToCamelCase(object[key]);
    }
  }
  return newObject;
};