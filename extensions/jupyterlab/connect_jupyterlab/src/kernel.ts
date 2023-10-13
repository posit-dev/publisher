import { NotebookPanel } from '@jupyterlab/notebook';
import { KernelMessage } from '@jupyterlab/services';
import { IKernelConnection } from '@jupyterlab/services/lib/kernel/kernel';
import { JSONObject } from '@lumino/coreutils';

export async function runPython(
  toRun: string,
  toEvaluate: string,
  kernel: IKernelConnection
): Promise<string> {
  const requestContent: KernelMessage.IExecuteRequestMsg['content'] = {
    code: toRun,
    user_expressions: {
      value: toEvaluate
    },
    stop_on_error: false
  };

  const future = kernel.requestExecute(requestContent, false);
  const replyMessage = await future.done;
  const content = replyMessage.content;

  if (!content) {
    throw new Error('Running python code: no content returned.');
  }
  if (content.status !== 'ok') {
    throw new Error('Running python code: status = ' + content.status);
  }
  const value = content.user_expressions['value'] as JSONObject;
  if (value['status'] !== 'ok') {
    throw new Error('Running python code: value status = ' + value['status']);
  }
  const data = value['data'] as JSONObject;
  const actualExpressionValue = data['text/plain'] as string;
  // remove quotes enclosing the string
  return actualExpressionValue.slice(1, -1);
}

async function sleep(seconds: number) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export async function getKernel(
  notebookPanel: NotebookPanel,
  maxRetries: number
): Promise<IKernelConnection> {
  const sessionContext = notebookPanel.sessionContext;
  let kernel = sessionContext.session?.kernel;
  let retries = 0;
  while (!kernel && retries < maxRetries) {
    console.debug('No kernel yet; retrying');
    retries++;
    await sleep(0.2);
    kernel = sessionContext.session?.kernel;
  }
  if (!kernel) {
    throw new Error('Session has no kernel.');
  }
  console.info('Using kernel', kernel.id);
  const kernelLanguage = (await kernel.info).language_info.name;
  console.info('Kernel language:', kernelLanguage);
  if (kernelLanguage !== 'python') {
    throw new Error(
      "Can't publish this notebook because it doesn't use the Python kernel"
    );
  }
  return kernel;
}

export async function getKernelPythonPath(
  kernel: IKernelConnection
): Promise<string> {
  return await runPython('import sys', 'sys.executable', kernel);
}

export async function getKernelPythonVersion(
  kernel: IKernelConnection
): Promise<string> {
  return await runPython(
    'import sys',
    '".".join(map(str, sys.version_info[:3]))',
    kernel
  );
}
