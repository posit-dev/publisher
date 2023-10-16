import { Quasar } from 'quasar';
import { describe, expect, test, vi } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';

import api, { AppMode, DeploymentFile, DeploymentFileType, ExclusionMatchSource, ServerType, useApi } from 'src/api';
import FilesToPublish from 'src/components/configurePublish/FilesToPublish.vue';
import { useDeploymentStore } from 'src/stores/deployment';

const fakeResponse: DeploymentFile = {
  id: '.',
  fileType: DeploymentFileType.DIRECTORY,
  base: 'fastapi-simple',
  exclusion: null,
  files: [
    {
      id: '.gitignore',
      fileType: DeploymentFileType.REGULAR,
      base: '.gitignore',
      exclusion: {
        source: ExclusionMatchSource.BUILT_IN,
        pattern: '.gitignore',
        filePath: '',
        line: 0
      },
      files: [],
      isDir: false,
      isEntrypoint: false,
      isFile: true,
      modifiedDatetime: '2023-09-19T10:20:06-07:00',
      rel: '.gitignore',
      size: 6,
      abs: '/Users/jordan/development/publishing-client/test/sample-content/fastapi-simple/.gitignore'
    },
    {
      id: 'manifest.json',
      fileType: DeploymentFileType.REGULAR,
      base: 'manifest.json',
      exclusion: {
        source: ExclusionMatchSource.BUILT_IN,
        pattern: 'manifest.json',
        filePath: '',
        line: 0
      },
      files: [],
      isDir: false,
      isEntrypoint: false,
      isFile: true,
      modifiedDatetime: '2023-08-18T11:56:15-07:00',
      rel: 'manifest.json',
      size: 552,
      abs: '/Users/jordan/development/publishing-client/test/sample-content/fastapi-simple/manifest.json'
    },
    {
      id: 'meta.yaml',
      fileType: DeploymentFileType.REGULAR,
      base: 'meta.yaml',
      exclusion: null,
      files: [],
      isDir: false,
      isEntrypoint: false,
      isFile: true,
      modifiedDatetime: '2023-08-02T15:41:24-07:00',
      rel: 'meta.yaml',
      size: 63,
      abs: '/Users/jordan/development/publishing-client/test/sample-content/fastapi-simple/meta.yaml'
    },
    {
      id: 'requirements.in',
      fileType: DeploymentFileType.REGULAR,
      base: 'requirements.in',
      exclusion: null,
      files: [],
      isDir: false,
      isEntrypoint: false,
      isFile: true,
      modifiedDatetime: '2023-08-02T15:41:24-07:00',
      rel: 'requirements.in',
      size: 124,
      abs: '/Users/jordan/development/publishing-client/test/sample-content/fastapi-simple/requirements.in'
    },
    {
      id: 'requirements.txt',
      fileType: DeploymentFileType.REGULAR,
      base: 'requirements.txt',
      exclusion: null,
      files: [],
      isDir: false,
      isEntrypoint: false,
      isFile: true,
      modifiedDatetime: '2023-08-02T15:41:24-07:00',
      rel: 'requirements.txt',
      size: 235,
      abs: '/Users/jordan/development/publishing-client/test/sample-content/fastapi-simple/requirements.txt'
    },
    {
      id: 'simple.py',
      fileType: DeploymentFileType.REGULAR,
      base: 'simple.py',
      exclusion: null,
      files: [],
      isDir: false,
      isEntrypoint: false,
      isFile: true,
      modifiedDatetime: '2023-08-02T15:41:24-07:00',
      rel: 'simple.py',
      size: 369,
      abs: '/Users/jordan/development/publishing-client/test/sample-content/fastapi-simple/simple.py'
    }
  ],
  isDir: true,
  isEntrypoint: false,
  isFile: false,
  modifiedDatetime: '2023-09-19T10:20:06-07:00',
  rel: '.',
  size: 256,
  abs: '/Users/jordan/development/publishing-client/test/sample-content/fastapi-simple'
};

vi.mock('src/api');
vi.mocked(useApi).mockReturnValue(api);

describe('description', () => {
  test('some test description', async() => {
    vi.mocked(api.files.get, { partial: true }).mockResolvedValue({ data: fakeResponse });

    const wrapper = mount(FilesToPublish, {
      global: {
        plugins: [Quasar, createTestingPinia({ createSpy: vi.fn })]
      }
    });

    const deploymentStore = useDeploymentStore();
    deploymentStore.deployment = {
      sourcePath: 'test/sample-content/fastapi-simple',
      target: {
        accountName: 'dogfood',
        serverType: ServerType.CONNECT,
        serverUrl: '',
        contentId: '',
        contentName: '',
        username: '',
        bundleId: null,
        deployedAt: null
      },
      manifest: {
        version: 1,
        locale: '',
        metadata: {
          appmode: AppMode.PYTHON_FASTAPI,
          entrypoint: 'simple.py',
          primaryHtml: '',
        },
        python: {
          version: '3.11.5',
          packageManager: {
            name: 'pip',
            packageFile: 'requirements.txt'
          }
        },
        packages: {},
        files: {
          '.': { checksum: '' },
          'meta.yaml': { checksum: '' },
          'requirements.in': { checksum: '' },
          'requirements.txt': { checksum: '' },
          'simple.py': { checksum: '' }
        }
      },
      connect: {
        content: {
          name: '',
        },
        environment: [
          {
            name: '',
            value: '',
            fromEnvironment: false,
          }
        ]
      },
      pythonRequirements: ['YW55aW89PTMuNi4yCmFzZ2lyZWY9PTMuNi4wCmNsaWNrPT04LjEuMwpmYXN0YXBpPT0wLjk1LjIKaDExPT0wLjE0LjAKaWRuYT09My40CnB5ZGFudGljPT0xLjEwLjcKcHlqd3Q9PTIuNy4wCnJzY29ubmVjdC1weXRob249PTEuMTcuMApzZW12ZXI9PTIuMTMuMApzaXg9PTEuMTYuMApzbmlmZmlvPT0xLjMuMApzdGFybGV0dGU9PTAuMjcuMAp0eXBpbmctZXh0ZW5zaW9ucz09NC41LjAKdXZpY29ybj09MC4yMi4wCg==']
    };
    await flushPromises();

    expect(api.files.get).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('4 files selected from test/sample-content/fastapi-simple (total = 1.0 KB)');
  });
});
