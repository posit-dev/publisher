import * as fs from 'fs';
import * as path from 'path';

function getConfigFile(configFilePath: string): string | null {
  const configDirs = process.env.XDG_CONFIG_DIRS ? 
         process.env.XDG_CONFIG_DIRS.split(':') : 
         ['/etc'];

  // Iterate over the directories and check if the file exists
  for (const dir of configDirs) {
    const filePath = path.join(dir, configFilePath);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}


export function getXDGConfigProperty(configFilePath: string, propertyName: string): string | null {
  console.log("In getXDGConfigProperty with: " + configFilePath + " and: " + propertyName);
  let filePath = getConfigFile(configFilePath);
  if (!filePath) {
    console.log("No file path with path found");
    return null;
  }
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  const lines = fileContent.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('#')) {
        continue;
    }

    const [name, value] = trimmedLine.split('=', 2);

    if (name && name.trim() === propertyName) {
      return value ? value.trim() : '';
    }
  }
  return null;
}

