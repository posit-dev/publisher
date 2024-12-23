import {
  ContentRecordFile,
  FileMatchSource,
} from "../../../../../../src/api/types/files";

export function includedFileTooltip(
  file: Pick<ContentRecordFile, "rel" | "reason">,
  isEntrypoint: boolean = false,
) {
  let tooltip = `${file.rel} will be included in the next deployment.`;
  if (file.reason) {
    tooltip += `\nThe configuration file ${file.reason?.fileName} is including it with the pattern '${file.reason?.pattern}'`;
  }
  if (isEntrypoint) {
    tooltip += `\n${file.rel} is the entrypoint. Entrypoints must be included in the configuration 'files' list.`;
  }
  return tooltip;
}

export function excludedFileTooltip(
  file: Pick<ContentRecordFile, "rel" | "reason">,
) {
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
