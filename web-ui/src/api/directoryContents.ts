export type NodeType = 'directory' | 'file'

export const SampleIncomingRules = {
  excluding: ['/my-project/**/rsconnect-python/'],
  including: ['!/my-project/rsconnect-python/choice-objects.json']
};

// also need:
// - entryPoint

export type DirectoryNode = {
  type: NodeType;
  name: string;
  key: number; // to be added locally
  path: string; // used as identifier back to server
  size: number;
  excluded?: boolean; // filtered out by filter, but able to be overriden
  possibleEntryPoint?: boolean;
  contents?: DirectoryNode[];
  childrenKeys?: number[]; // to be added locally
  new?: boolean; // new file detection since last deployment
  deleted?: boolean; // no longer there but included in last deployment
}

export const baseDir = '/my-project';

// add key before converting to DirectoryNode type
export const directoryData: DirectoryNode[] = [
  {
    type: 'directory',
    name: 'python-bokeh',
    key: 0,
    size: 256,
    path: '/my-project/python-bokeh',
    childrenKeys: [1, 2, 100, 3, 4, 5, 8],
    contents: [
      {
        type: 'file',
        name: 'manifest.json',
        key: 1,
        size: 637,
        path: '/my-project/python-bokeh/manifest.json',
        excluded: true
      },
      {
        type: 'file',
        name: 'meta.yaml',
        key: 2,
        size: 75,
        path: '/my-project/python-bokeh/meta.yaml',
      },
      {
        type: 'file',
        name: 'debug.log',
        key: 100,
        size: 75,
        new: true,
        path: '/my-project/python-bokeh/debug.log',
      },
      {
        type: 'file',
        name: 'saved.log',
        key: 101,
        size: 75,
        deleted: true,
        path: '/my-project/python-bokeh/saved.log',
      },
      {
        type: 'file',
        name: 'requirements.in',
        key: 3,
        size: 125,
        path: '/my-project/python-bokeh/requirements.in',
      },
      {
        type: 'file',
        name: 'requirements.txt',
        key: 4,
        size: 257,
        path: '/my-project/python-bokeh/requirements.txt',
      },
      {
        type: 'directory',
        name: 'rsconnect-python',
        key: 5,
        size: 128,
        path: '/my-project/python-bokeh/rsconnect-python',
        excluded: true,
        childrenKeys: [6, 7, 17, 103],
        contents: [
          {
            type: 'file',
            name: 'manifest.json',
            key: 6,
            size: 3064,
            excluded: true,
            path: '/my-project/python-bokeh/rsconnect-python/manifest.json',
          },
          {
            type: 'file',
            name: 'python-bokeh.json',
            key: 7,
            size: 413,
            excluded: true,
            path: '/my-project/python-bokeh/rsconnect-python/python-bokeh.json',
          },
          {
            type: 'file',
            name: 'choice-objects.json',
            key: 17,
            size: 413,
            excluded: false,
            path: '/my-project/python-bokeh/rsconnect-python/choice-objects.json',
          },
          {
            type: 'file',
            name: 'choice-objects-advanced.json',
            key: 103,
            size: 413,
            excluded: true,
            new: true,
            path: '/my-project/python-bokeh/rsconnect-python/choice-objects-advanced.json',
          }
        ]
      },
      {
        type: 'file',
        name: 'sliders.py',
        key: 8,
        size: 2048,
        path: '/my-project/python-bokeh/sliders.py',
        possibleEntryPoint: true,
      },
      {
        type: 'directory',
        name: 'backup',
        key: 9,
        size: 256,
        path: '/my-project/python-bokeh/backup',
        childrenKeys: [10, 11, 12, 13, 14, 16],
        contents: [
          {
            type: 'file',
            name: 'manifest.json',
            key: 10,
            size: 5524,
            path: '/my-project/python-bokeh/backup/manifest.json',
            excluded: true
          },
          {
            type: 'file',
            name: 'meta.yaml',
            key: 11,
            size: 8622,
            path: '/my-project/python-bokeh/backup/meta.yaml',
          },
          {
            type: 'file',
            name: 'requirements.in',
            key: 12,
            size: 14,
            path: '/my-project/python-bokeh/backup/requirements.in',
          },
          {
            type: 'file',
            name: 'requirements.txt',
            key: 13,
            size: 2570,
            path: '/my-project/python-bokeh/backup/requirements.txt',
          },
          {
            type: 'directory',
            name: 'rsconnect-python',
            key: 14,
            size: 96,
            path: '/my-project/python-bokeh/backup/rsconnect-python',
            excluded: true,
            childrenKeys: [15],
            contents: [
              {
                type: 'file',
                name: 'manifest.json',
                key: 15,
                size: 5170,
                excluded: true,
                path: '/my-project/python-bokeh/backup/rsconnect-python/manifest.json',
              }
            ]
          },
          {
            type: 'file',
            name: 'sliders.py',
            key: 16,
            size: 2090,
            path: '/my-project/python-bokeh/backup/sliders.py',
            possibleEntryPoint: true,
          }
        ]
      },
      {
        type: 'file',
        name: 'main.py',
        key: 18,
        size: 3072,
        path: '/my-project/python-bokeh/main.py',
        possibleEntryPoint: true,
      },
      {
        type: 'file',
        name: 'util.py',
        key: 19,
        size: 4096,
        path: '/my-project/python-bokeh/util.py',
        possibleEntryPoint: true,
      },
    ]
  }
];
