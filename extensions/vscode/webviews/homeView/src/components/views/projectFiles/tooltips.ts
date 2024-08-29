import { ContentRecordFile, FileMatchSource } from "../../../../../../src/api";

export function includedFileTooltip(file: ContentRecordFile) {
  let tooltip = `${file.rel} will be included in the next deployment.`;
  if (file.reason) {
    tooltip += `\nThe configuration file ${file.reason?.fileName} is including it with the pattern '${file.reason?.pattern}'`;
  }
  return tooltip;
}

export function excludedFileTooltip(file: ContentRecordFile) {
  let tooltip = `${file.rel} will be excluded in the next deployment.`;
  if (file.reason) {
    if (file.reason.source === FileMatchSource.BUILT_IN) {
      tooltip += `\nThis is a built-in exclusion for the pattern: '${file.reason.pattern}' and cannot be overridden.`;
    } else if (file.reason.source === FileMatchSource.PERMISSIONS_ERROR) {
      tooltip += "\nYou don't have permission to access this directory.";
    } else {
      tooltip += `\nThe configuration file ${file.reason?.fileName} is excluding it with the pattern '${file.reason?.pattern}'`;
    }
  } else {
    tooltip += `\nIt did not match any pattern in the configuration 'files' list.`;
  }
  return tooltip;
}
