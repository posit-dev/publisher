
import api from '../api';

export async function untitledConfigurationName(): Promise<string> {
  const existingConfigurations = (await api.configurations.getAll()).data;

  if (existingConfigurations.length === 0) {
    return "default";
  }

  let id = 0;
  let defaultName = '';
  do {
    id += 1;
    const trialName = `Untitled-${id}`;

    if (!existingConfigurations.find(
      config => {
        return config.configurationName.toLowerCase() === trialName.toLowerCase();
      }
    )) {
      defaultName = trialName;
    }
  } while (!defaultName);
  return defaultName;
}

export function untitledDeploymentName(existingDeploymentNames: string[]): string {

  if (existingDeploymentNames.length === 0) {
    return "Untitled-1";
  }

  let id = 0;
  let defaultName = '';
  do {
    id += 1;
    const trialName = `Untitled-${id}`;

    if (uniqueDeploymentName(trialName, existingDeploymentNames)) {
      defaultName = trialName;
    }
  } while (!defaultName);
  return defaultName;
}

export function uniqueDeploymentName(nameToTest: string, existingNames: string[]) {
  return !existingNames.find(
    existingName => {
      return existingName.toLowerCase() === nameToTest.toLowerCase();
    }
  );
}