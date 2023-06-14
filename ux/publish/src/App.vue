<template>
  <v-app>
    <v-app-bar>
      <v-app-bar-title>
        Posit Publisher
      </v-app-bar-title>
    </v-app-bar>
    <v-main>
       <v-expansion-panels multiple variant="accordion">
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-row no-gutters>
              <v-col cols="2" class="d-flex justify-start">
                Destination
              </v-col>
              <v-col
                cols="10"
                class="text-grey"
              >
              Colorado, updating "Quarterly Report"
              </v-col>
            </v-row>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            Server: https://colorado.posit.co/rsc<br>
            Destination: update "<a href="https://colorado.posit.co/rsc/connect/#/apps/16062035-d16c-493b-99db-c951915f6034">Quarterly Report</a>"
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-row no-gutters>
              <v-col cols="2" class="d-flex justify-start">
                Files
              </v-col>
              <v-col
                cols="10"
                class="text-grey"
              >
              Report.qmd and 2 other files totaling 2.3 MB
              </v-col>
            </v-row>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-left" width="25%">
                    Name
                  </th>
                  <th class="text-left" width="75%">
                    Size
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Report.qmd</td>
                  <td>18 KB</td>
                </tr>
                <tr>
                  <td>data.csv</td>
                  <td>2.3 MB</td>
                </tr>
                <tr>
                  <td>requirements.txt</td>
                  <td>1 KB</td>
                </tr>
              </tbody>
            </v-table>
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-row no-gutters>
              <v-col cols="2" class="d-flex justify-start">
                Python
              </v-col>
              <v-col
                cols="10"
                class="text-grey"
              >
              Python 3.11 and 18 package dependencies
              </v-col>
            </v-row>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-left" width="25%">
                    Package
                  </th>
                  <th class="text-left" width="75%">
                    Version
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>click</td>
                  <td>8.0.1</td>
                </tr>
                <tr>
                  <td>numpy</td>
                  <td>1.24.0</td>
                </tr>
                <tr>
                  <td>pandas</td>
                  <td>2.0.4</td>
                </tr>
              </tbody>
            </v-table>
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel>
          <v-expansion-panel-title>
            Advanced Settings
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            There would be a lot of components in here!
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
      <v-toolbar>
        <v-spacer />
        <v-btn>
          Cancel
        </v-btn>
        <v-btn>
          Publish
        </v-btn>
      </v-toolbar>
      <v-expansion-panels>
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-row no-gutters>
              <v-col cols="2" class="d-flex justify-start">
                Restore Environment
              </v-col>
              <v-col
                cols="4"
                class="text-grey"
              >
              <v-progress-linear model-value="20" height="18">
                <template v-slot:default="{ value }">
                  <strong>{{ Math.ceil(value) }}%</strong>
                </template>
              </v-progress-linear>
              </v-col>
            </v-row>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <pre>2023/05/18 12:07:52 PM: [rsc-session] Content GUID: 3757f57a-f147-49d5-996b-9abec2ba22a5
2023/05/18 12:07:52 PM: [rsc-session] Content ID: 29
2023/05/18 12:07:52 PM: [rsc-session] Bundle ID: 54
2023/05/18 12:07:52 PM: Running on host: dev-password-postgres
2023/05/18 12:07:52 PM: Linux distribution: Ubuntu 22.04.2 LTS (jammy)
2023/05/18 12:07:52 PM: Running as user: uid=998(rstudio-connect) gid=998(rstudio-connect) groups=998(rstudio-connect),1000(data-scientists)
2023/05/18 12:07:52 PM: Connect version: 2023.04.0-dev+1516-dirty
2023/05/18 12:07:52 PM: LANG: en_US.UTF-8
2023/05/18 12:07:52 PM: Working directory: /connect/mnt/app
2023/05/18 12:07:52 PM: Building environment using Python 3.11.3 | packaged by conda-forge | (main, Apr 6 2023, 08:57:19) [GCC 11.3.0] at /opt/python/3.11.3/bin/python3.11
2023/05/18 12:07:52 PM: Skipped packages: appnope==0.1.3
2023/05/18 12:07:52 PM: Creating environment: 84B5EYBF_SsLhaXGJyBs_w
2023/05/18 12:07:56 PM: Requirement already satisfied: pip in ./python/env/lib/python3.11/site-packages (22.3.1)
2023/05/18 12:07:56 PM: Collecting pip
2023/05/18 12:07:56 PM: Downloading pip-23.1.2-py3-none-any.whl (2.1 MB)
2023/05/18 12:07:57 PM: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.1/2.1 MB 8.5 MB/s eta 0:00:00
2023/05/18 12:07:57 PM: Requirement already satisfied: setuptools in ./python/env/lib/python3.11/site-packages (65.5.0)
2023/05/18 12:07:57 PM: Collecting setuptools
2023/05/18 12:07:57 PM: Downloading setuptools-67.7.2-py3-none-any.whl (1.1 MB)
2023/05/18 12:07:57 PM: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.1/1.1 MB 22.8 MB/s eta 0:00:00
2023/05/18 12:07:57 PM: Requirement already satisfied: wheel in /opt/python/3.11.3/lib/python3.11/site-packages (0.40.0)
2023/05/18 12:07:58 PM: Installing collected packages: setuptools, pip
2023/05/18 12:07:58 PM: Attempting uninstall: setuptools
2023/05/18 12:07:58 PM: Found existing installation: setuptools 65.5.0
2023/05/18 12:07:58 PM: Uninstalling setuptools-65.5.0:
2023/05/18 12:07:58 PM: Successfully uninstalled setuptools-65.5.0
2023/05/18 12:07:59 PM: Attempting uninstall: pip
2023/05/18 12:07:59 PM: Found existing installation: pip 22.3.1
2023/05/18 12:07:59 PM: Uninstalling pip-22.3.1:
2023/05/18 12:07:59 PM: Successfully uninstalled pip-22.3.1
2023/05/18 12:08:00 PM: Successfully installed pip-23.1.2 setuptools-67.7.2
2023/05/18 12:08:01 PM: Requirement already satisfied: anyio==3.6.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 1)) (3.6.2)
2023/05/18 12:08:01 PM: Requirement already satisfied: argon2-cffi==21.3.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 2)) (21.3.0)
2023/05/18 12:08:01 PM: Requirement already satisfied: argon2-cffi-bindings==21.2.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 3)) (21.2.0)
2023/05/18 12:08:01 PM: Collecting arrow==1.2.3 (from -r python/requirements.txt (line 4))
2023/05/18 12:08:01 PM: Downloading arrow-1.2.3-py3-none-any.whl (66 kB)
2023/05/18 12:08:01 PM: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 66.4/66.4 kB 557.0 kB/s eta 0:00:00
2023/05/18 12:08:01 PM: Requirement already satisfied: asttokens==2.2.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 5)) (2.2.1)
2023/05/18 12:08:01 PM: Requirement already satisfied: attrs==23.1.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 6)) (23.1.0)
2023/05/18 12:08:01 PM: Requirement already satisfied: backcall==0.2.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 7)) (0.2.0)
2023/05/18 12:08:01 PM: Requirement already satisfied: beautifulsoup4==4.12.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 8)) (4.12.2)
2023/05/18 12:08:01 PM: Requirement already satisfied: bleach==6.0.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 9)) (6.0.0)
2023/05/18 12:08:01 PM: Requirement already satisfied: cffi==1.15.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 10)) (1.15.1)
2023/05/18 12:08:01 PM: Requirement already satisfied: comm==0.1.3 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 11)) (0.1.3)
2023/05/18 12:08:01 PM: Collecting contourpy==1.0.7 (from -r python/requirements.txt (line 12))
2023/05/18 12:08:01 PM: Using cached contourpy-1.0.7-cp311-cp311-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (299 kB)
2023/05/18 12:08:02 PM: Collecting cycler==0.11.0 (from -r python/requirements.txt (line 13))
2023/05/18 12:08:02 PM: Downloading cycler-0.11.0-py3-none-any.whl (6.4 kB)
2023/05/18 12:08:02 PM: Requirement already satisfied: debugpy==1.6.7 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 14)) (1.6.7)
2023/05/18 12:08:02 PM: Requirement already satisfied: decorator==5.1.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 15)) (5.1.1)
2023/05/18 12:08:02 PM: Requirement already satisfied: defusedxml==0.7.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 16)) (0.7.1)
2023/05/18 12:08:02 PM: Requirement already satisfied: executing==1.2.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 17)) (1.2.0)
2023/05/18 12:08:02 PM: Requirement already satisfied: fastjsonschema==2.16.3 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 18)) (2.16.3)
2023/05/18 12:08:02 PM: Collecting fonttools==4.39.4 (from -r python/requirements.txt (line 19))
2023/05/18 12:08:02 PM: Downloading fonttools-4.39.4-py3-none-any.whl (1.0 MB)
2023/05/18 12:08:02 PM: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.0/1.0 MB 3.0 MB/s eta 0:00:00
2023/05/18 12:08:02 PM: Collecting fqdn==1.5.1 (from -r python/requirements.txt (line 20))
2023/05/18 12:08:02 PM: Downloading fqdn-1.5.1-py3-none-any.whl (9.1 kB)
2023/05/18 12:08:02 PM: Requirement already satisfied: idna==3.4 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 21)) (3.4)
2023/05/18 12:08:02 PM: Collecting ipykernel==6.23.1 (from -r python/requirements.txt (line 22))
2023/05/18 12:08:02 PM: Downloading ipykernel-6.23.1-py3-none-any.whl (152 kB)
2023/05/18 12:08:02 PM: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 152.2/152.2 kB 12.6 MB/s eta 0:00:00
2023/05/18 12:08:02 PM: Requirement already satisfied: ipython==8.13.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 23)) (8.13.2)
2023/05/18 12:08:02 PM: Requirement already satisfied: ipython-genutils==0.2.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 24)) (0.2.0)
2023/05/18 12:08:02 PM: Requirement already satisfied: ipywidgets==8.0.6 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 25)) (8.0.6)
2023/05/18 12:08:02 PM: Collecting isoduration==20.11.0 (from -r python/requirements.txt (line 26))
2023/05/18 12:08:03 PM: Downloading isoduration-20.11.0-py3-none-any.whl (11 kB)
2023/05/18 12:08:03 PM: Requirement already satisfied: jedi==0.18.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 27)) (0.18.2)
2023/05/18 12:08:03 PM: Requirement already satisfied: jinja2==3.1.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 28)) (3.1.2)
2023/05/18 12:08:03 PM: Collecting jsonpointer==2.3 (from -r python/requirements.txt (line 29))
2023/05/18 12:08:03 PM: Downloading jsonpointer-2.3-py2.py3-none-any.whl (7.8 kB)
2023/05/18 12:08:03 PM: Requirement already satisfied: jsonschema[format-nongpl]==4.17.3 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 30)) (4.17.3)
2023/05/18 12:08:03 PM: Requirement already satisfied: jupyter==1.0.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 31)) (1.0.0)
2023/05/18 12:08:03 PM: Requirement already satisfied: jupyter-client==8.2.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 32)) (8.2.0)
2023/05/18 12:08:03 PM: Requirement already satisfied: jupyter-console==6.6.3 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 33)) (6.6.3)
2023/05/18 12:08:03 PM: Requirement already satisfied: jupyter-core==5.3.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 34)) (5.3.0)
2023/05/18 12:08:03 PM: Requirement already satisfied: jupyter-events==0.6.3 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 35)) (0.6.3)
2023/05/18 12:08:03 PM: Requirement already satisfied: jupyter-server==2.5.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 36)) (2.5.0)
2023/05/18 12:08:03 PM: Requirement already satisfied: jupyter-server-terminals==0.4.4 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 37)) (0.4.4)
2023/05/18 12:08:03 PM: Requirement already satisfied: jupyterlab-pygments==0.2.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 38)) (0.2.2)
2023/05/18 12:08:03 PM: Requirement already satisfied: jupyterlab-widgets==3.0.7 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 39)) (3.0.7)
2023/05/18 12:08:03 PM: Collecting kiwisolver==1.4.4 (from -r python/requirements.txt (line 40))
2023/05/18 12:08:03 PM: Downloading kiwisolver-1.4.4-cp311-cp311-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (1.4 MB)
2023/05/18 12:08:03 PM: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.4/1.4 MB 5.8 MB/s eta 0:00:00
2023/05/18 12:08:03 PM: Requirement already satisfied: markupsafe==2.1.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 41)) (2.1.2)
2023/05/18 12:08:03 PM: Collecting matplotlib==3.7.1 (from -r python/requirements.txt (line 42))
2023/05/18 12:08:03 PM: Downloading matplotlib-3.7.1-cp311-cp311-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (11.6 MB)
2023/05/18 12:08:05 PM: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 11.6/11.6 MB 7.5 MB/s eta 0:00:00
2023/05/18 12:08:05 PM: Requirement already satisfied: matplotlib-inline==0.1.6 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 43)) (0.1.6)
2023/05/18 12:08:05 PM: Collecting mistune==2.0.5 (from -r python/requirements.txt (line 44))
2023/05/18 12:08:05 PM: Downloading mistune-2.0.5-py2.py3-none-any.whl (24 kB)
2023/05/18 12:08:05 PM: Requirement already satisfied: nbclassic==1.0.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 45)) (1.0.0)
2023/05/18 12:08:05 PM: Requirement already satisfied: nbclient==0.7.4 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 46)) (0.7.4)
2023/05/18 12:08:05 PM: Collecting nbconvert==7.4.0 (from -r python/requirements.txt (line 47))
2023/05/18 12:08:05 PM: Using cached nbconvert-7.4.0-py3-none-any.whl (285 kB)
2023/05/18 12:08:05 PM: Requirement already satisfied: nbformat==5.8.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 48)) (5.8.0)
2023/05/18 12:08:05 PM: Requirement already satisfied: nest-asyncio==1.5.6 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 49)) (1.5.6)
2023/05/18 12:08:05 PM: Requirement already satisfied: notebook==6.5.4 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 50)) (6.5.4)
2023/05/18 12:08:05 PM: Requirement already satisfied: notebook-shim==0.2.3 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 51)) (0.2.3)
2023/05/18 12:08:06 PM: Collecting numpy==1.24.3 (from -r python/requirements.txt (line 52))
2023/05/18 12:08:06 PM: Using cached numpy-1.24.3-cp311-cp311-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (17.3 MB)
2023/05/18 12:08:06 PM: Requirement already satisfied: packaging==23.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 53)) (23.1)
2023/05/18 12:08:06 PM: Collecting pandas==2.0.1 (from -r python/requirements.txt (line 54))
2023/05/18 12:08:06 PM: Using cached pandas-2.0.1-cp311-cp311-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (12.2 MB)
2023/05/18 12:08:06 PM: Requirement already satisfied: pandocfilters==1.5.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 55)) (1.5.0)
2023/05/18 12:08:06 PM: Requirement already satisfied: parso==0.8.3 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 56)) (0.8.3)
2023/05/18 12:08:06 PM: Requirement already satisfied: pexpect==4.8.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 57)) (4.8.0)
2023/05/18 12:08:06 PM: Requirement already satisfied: pickleshare==0.7.5 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 58)) (0.7.5)
2023/05/18 12:08:06 PM: Collecting pillow==9.5.0 (from -r python/requirements.txt (line 59))
2023/05/18 12:08:06 PM: Using cached Pillow-9.5.0-cp311-cp311-manylinux_2_28_x86_64.whl (3.4 MB)
2023/05/18 12:08:07 PM: Requirement already satisfied: platformdirs==3.5.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 60)) (3.5.1)
2023/05/18 12:08:07 PM: Requirement already satisfied: prometheus-client==0.16.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 61)) (0.16.0)
2023/05/18 12:08:07 PM: Requirement already satisfied: prompt-toolkit==3.0.38 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 62)) (3.0.38)
2023/05/18 12:08:07 PM: Requirement already satisfied: psutil==5.9.5 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 63)) (5.9.5)
2023/05/18 12:08:07 PM: Requirement already satisfied: ptyprocess==0.7.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 64)) (0.7.0)
2023/05/18 12:08:07 PM: Requirement already satisfied: pure-eval==0.2.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 65)) (0.2.2)
2023/05/18 12:08:07 PM: Requirement already satisfied: pycparser==2.21 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 66)) (2.21)
2023/05/18 12:08:07 PM: Requirement already satisfied: pygments==2.15.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 67)) (2.15.1)
2023/05/18 12:08:07 PM: Collecting pyparsing==3.0.9 (from -r python/requirements.txt (line 68))
2023/05/18 12:08:07 PM: Downloading pyparsing-3.0.9-py3-none-any.whl (98 kB)
2023/05/18 12:08:07 PM: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 98.3/98.3 kB 39.2 MB/s eta 0:00:00
2023/05/18 12:08:07 PM: Requirement already satisfied: pyrsistent==0.19.3 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 69)) (0.19.3)
2023/05/18 12:08:07 PM: Requirement already satisfied: python-dateutil==2.8.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 70)) (2.8.2)
2023/05/18 12:08:07 PM: Requirement already satisfied: python-json-logger==2.0.7 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 71)) (2.0.7)
2023/05/18 12:08:07 PM: Collecting pytz==2023.3 (from -r python/requirements.txt (line 72))
2023/05/18 12:08:07 PM: Using cached pytz-2023.3-py2.py3-none-any.whl (502 kB)
2023/05/18 12:08:07 PM: Requirement already satisfied: pyyaml==6.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 73)) (6.0)
2023/05/18 12:08:07 PM: Requirement already satisfied: pyzmq==25.0.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 74)) (25.0.2)
2023/05/18 12:08:07 PM: Requirement already satisfied: qtconsole==5.4.3 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 75)) (5.4.3)
2023/05/18 12:08:07 PM: Requirement already satisfied: qtpy==2.3.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 76)) (2.3.1)
2023/05/18 12:08:07 PM: Requirement already satisfied: rfc3339-validator==0.1.4 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 77)) (0.1.4)
2023/05/18 12:08:07 PM: Requirement already satisfied: rfc3986-validator==0.1.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 78)) (0.1.1)
2023/05/18 12:08:07 PM: Requirement already satisfied: send2trash==1.8.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 79)) (1.8.2)
2023/05/18 12:08:07 PM: Requirement already satisfied: six==1.16.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 80)) (1.16.0)
2023/05/18 12:08:07 PM: Requirement already satisfied: sniffio==1.3.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 81)) (1.3.0)
2023/05/18 12:08:07 PM: Collecting soupsieve==2.4.1 (from -r python/requirements.txt (line 82))
2023/05/18 12:08:07 PM: Downloading soupsieve-2.4.1-py3-none-any.whl (36 kB)
2023/05/18 12:08:07 PM: Requirement already satisfied: stack-data==0.6.2 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 83)) (0.6.2)
2023/05/18 12:08:07 PM: Requirement already satisfied: terminado==0.17.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 84)) (0.17.1)
2023/05/18 12:08:07 PM: Requirement already satisfied: tinycss2==1.2.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 85)) (1.2.1)
2023/05/18 12:08:07 PM: Collecting tornado==6.3.2 (from -r python/requirements.txt (line 86))
2023/05/18 12:08:07 PM: Using cached tornado-6.3.2-cp38-abi3-manylinux_2_5_x86_64.manylinux1_x86_64.manylinux_2_17_x86_64.manylinux2014_x86_64.whl (426 kB)
2023/05/18 12:08:07 PM: Requirement already satisfied: traitlets==5.9.0 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 87)) (5.9.0)
2023/05/18 12:08:07 PM: Collecting tzdata==2023.3 (from -r python/requirements.txt (line 88))
2023/05/18 12:08:07 PM: Using cached tzdata-2023.3-py2.py3-none-any.whl (341 kB)
2023/05/18 12:08:07 PM: Collecting uri-template==1.2.0 (from -r python/requirements.txt (line 89))
2023/05/18 12:08:07 PM: Downloading uri_template-1.2.0-py3-none-any.whl (10 kB)
2023/05/18 12:08:07 PM: Requirement already satisfied: wcwidth==0.2.6 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 90)) (0.2.6)
2023/05/18 12:08:07 PM: Collecting webcolors==1.13 (from -r python/requirements.txt (line 91))
2023/05/18 12:08:07 PM: Downloading webcolors-1.13-py3-none-any.whl (14 kB)
2023/05/18 12:08:07 PM: Requirement already satisfied: webencodings==0.5.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 92)) (0.5.1)
2023/05/18 12:08:07 PM: Requirement already satisfied: websocket-client==1.5.1 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 93)) (1.5.1)
2023/05/18 12:08:07 PM: Requirement already satisfied: widgetsnbextension==4.0.7 in /opt/python/3.11.3/lib/python3.11/site-packages (from -r python/requirements.txt (line 94)) (4.0.7)
2023/05/18 12:08:07 PM: Collecting papermill (from -r python/requirements.txt (line 95))
2023/05/18 12:08:07 PM: Using cached papermill-2.4.0-py3-none-any.whl (38 kB)
2023/05/18 12:08:15 PM: Collecting ansiwrap (from papermill-&gt;-r python/requirements.txt (line 95))
2023/05/18 12:08:15 PM: Using cached ansiwrap-0.8.4-py2.py3-none-any.whl (8.5 kB)
2023/05/18 12:08:15 PM: Collecting click (from papermill-&gt;-r python/requirements.txt (line 95))
2023/05/18 12:08:15 PM: Using cached click-8.1.3-py3-none-any.whl (96 kB)
2023/05/18 12:08:15 PM: Collecting tqdm&gt;=4.32.2 (from papermill-&gt;-r python/requirements.txt (line 95))
2023/05/18 12:08:15 PM: Using cached tqdm-4.65.0-py3-none-any.whl (77 kB)
2023/05/18 12:08:15 PM: Collecting requests (from papermill-&gt;-r python/requirements.txt (line 95))
2023/05/18 12:08:15 PM: Using cached requests-2.30.0-py3-none-any.whl (62 kB)
2023/05/18 12:08:15 PM: Requirement already satisfied: entrypoints in /opt/python/3.11.3/lib/python3.11/site-packages (from papermill-&gt;-r python/requirements.txt (line 95)) (0.4)
2023/05/18 12:08:15 PM: Collecting tenacity (from papermill-&gt;-r python/requirements.txt (line 95))
2023/05/18 12:08:15 PM: Using cached tenacity-8.2.2-py3-none-any.whl (24 kB)
2023/05/18 12:08:15 PM: Collecting textwrap3&gt;=0.9.2 (from ansiwrap-&gt;papermill-&gt;-r python/requirements.txt (line 95))
2023/05/18 12:08:15 PM: Using cached textwrap3-0.9.2-py2.py3-none-any.whl (12 kB)
2023/05/18 12:08:16 PM: Collecting charset-normalizer&lt;4,&gt;=2 (from requests-&gt;papermill-&gt;-r python/requirements.txt (line 95))
2023/05/18 12:08:16 PM: Using cached charset_normalizer-3.1.0-cp311-cp311-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (197 kB)
2023/05/18 12:08:16 PM: Collecting urllib3&lt;3,&gt;=1.21.1 (from requests-&gt;papermill-&gt;-r python/requirements.txt (line 95))
2023/05/18 12:08:16 PM: Using cached urllib3-2.0.2-py3-none-any.whl (123 kB)
2023/05/18 12:08:16 PM: Collecting certifi&gt;=2017.4.17 (from requests-&gt;papermill-&gt;-r python/requirements.txt (line 95))
2023/05/18 12:08:16 PM: Using cached certifi-2023.5.7-py3-none-any.whl (156 kB)
2023/05/18 12:08:18 PM: Installing collected packages: textwrap3, pytz, mistune, webcolors, urllib3, uri-template, tzdata, tqdm, tornado, tenacity, soupsieve, pyparsing, pillow, numpy, kiwisolver, jsonpointer, fqdn, fonttools, cycler, click, charset-normalizer, certifi, ansiwrap, requests, pandas, contourpy, arrow, matplotlib, isoduration, papermill, nbconvert, ipykernel
2023/05/18 12:08:18 PM: Attempting uninstall: mistune
2023/05/18 12:08:18 PM: Found existing installation: mistune 0.8.4
2023/05/18 12:08:18 PM: Not uninstalling mistune at /opt/python/3.11.3/lib/python3.11/site-packages, outside environment /connect/mnt/app/python/env
2023/05/18 12:08:18 PM: Can&#39;t uninstall &#39;mistune&#39;. No files were found to uninstall.
2023/05/18 12:08:19 PM: Attempting uninstall: tornado
2023/05/18 12:08:19 PM: Found existing installation: tornado 6.3
2023/05/18 12:08:19 PM: Not uninstalling tornado at /opt/python/3.11.3/lib/python3.11/site-packages, outside environment /connect/mnt/app/python/env
2023/05/18 12:08:19 PM: Can&#39;t uninstall &#39;tornado&#39;. No files were found to uninstall.
2023/05/18 12:08:19 PM: Attempting uninstall: soupsieve
2023/05/18 12:08:19 PM: Found existing installation: soupsieve 2.3.2.post1
2023/05/18 12:08:19 PM: Not uninstalling soupsieve at /opt/python/3.11.3/lib/python3.11/site-packages, outside environment /connect/mnt/app/python/env
2023/05/18 12:08:19 PM: Can&#39;t uninstall &#39;soupsieve&#39;. No files were found to uninstall.
2023/05/18 12:08:26 PM: Attempting uninstall: nbconvert
2023/05/18 12:08:27 PM: Found existing installation: nbconvert 6.5.3
2023/05/18 12:08:27 PM: Not uninstalling nbconvert at /opt/python/3.11.3/lib/python3.11/site-packages, outside environment /connect/mnt/app/python/env
2023/05/18 12:08:27 PM: Can&#39;t uninstall &#39;nbconvert&#39;. No files were found to uninstall.
2023/05/18 12:08:27 PM: Attempting uninstall: ipykernel
2023/05/18 12:08:27 PM: Found existing installation: ipykernel 6.23.0
2023/05/18 12:08:27 PM: Not uninstalling ipykernel at /opt/python/3.11.3/lib/python3.11/site-packages, outside environment /connect/mnt/app/python/env
2023/05/18 12:08:27 PM: Can&#39;t uninstall &#39;ipykernel&#39;. No files were found to uninstall.
2023/05/18 12:08:27 PM: Successfully installed ansiwrap-0.8.4 arrow-1.2.3 certifi-2023.5.7 charset-normalizer-3.1.0 click-8.1.3 contourpy-1.0.7 cycler-0.11.0 fonttools-4.39.4 fqdn-1.5.1 ipykernel-6.23.1 isoduration-20.11.0 jsonpointer-2.3 kiwisolver-1.4.4 matplotlib-3.7.1 mistune-2.0.5 nbconvert-7.4.0 numpy-1.24.3 pandas-2.0.1 papermill-2.4.0 pillow-9.5.0 pyparsing-3.0.9 pytz-2023.3 requests-2.30.0 soupsieve-2.4.1 tenacity-8.2.2 textwrap3-0.9.2 tornado-6.3.2 tqdm-4.65.0 tzdata-2023.3 uri-template-1.2.0 urllib3-2.0.2 webcolors-1.13
2023/05/18 12:08:28 PM: Packages in the environment: ansiwrap==0.8.4, anyio, argon2-cffi, argon2-cffi-bindings, arrow==1.2.3, asttokens, attrs, backcall, backports.functools-lru-cache, beautifulsoup4, bjoern==3.1.0, bleach, certifi==2023.5.7, cffi, charset-normalizer==3.1.0, click==8.1.3, comm, contourpy==1.0.7, cycler==0.11.0, debugpy, decorator, defusedxml, entrypoints, executing, fastapi, fastjsonschema, flit_core, fonttools==4.39.4, fqdn==1.5.1, idna, importlib-metadata, importlib-resources, ipykernel==6.23.1, ipython, ipython-genutils==0.2.0, ipywidgets, isoduration==20.11.0, jedi, Jinja2, jsonpointer==2.3, jsonschema, jupyter, jupyter-console, jupyter-events, jupyter_client, jupyter_core, jupyter_server, jupyter_server_terminals, jupyterlab-pygments, jupyterlab-widgets, kiwisolver==1.4.4, lxml, MarkupSafe, matplotlib==3.7.1, matplotlib-inline, mistune==2.0.5, nbclassic, nbclient, nbconvert==7.4.0, nbformat, nest-asyncio, notebook, notebook_shim, numpy==1.24.3, packaging, pandas==2.0.1, pandocfilters, papermill==2.4.0, parso, pexpect, pickleshare, Pillow==9.5.0, pkgutil_resolve_name, platformdirs, ply==3.11, prometheus-client, prompt-toolkit, psutil, ptyprocess, pure-eval, pycparser, pydantic, Pygments, pyparsing==3.0.9, PyQt5==5.15.7, PyQt5-sip==12.11.0, pyrsistent, python-dateutil, python-json-logger, pytz==2023.3, PyYAML, pyzmq, qtconsole, QtPy, requests==2.30.0, rfc3339-validator, rfc3986-validator, Send2Trash, sip, six, sniffio, soupsieve==2.4.1, stack-data, starlette, tenacity==8.2.2, terminado, textwrap3==0.9.2, tinycss2, toml, tomli, tornado==6.3.2, tqdm==4.65.0, traitlets, typing_extensions, tzdata==2023.3, uri-template==1.2.0, urllib3==2.0.2, waitress==1.4.3, wcwidth, webcolors==1.13, webencodings==0.5.1, websocket-client, widgetsnbextension, zipp,
2023/05/18 12:08:28 PM: Creating kernel spec: python3
2023/05/18 12:08:28 PM: 0.00s - Debugger warning: It seems that frozen modules are being used, which may
2023/05/18 12:08:28 PM: 0.00s - make the debugger miss breakpoints. Please pass -Xfrozen_modules=off
2023/05/18 12:08:28 PM: 0.00s - to python to disable frozen modules.
2023/05/18 12:08:28 PM: 0.00s - Note: Debugging will proceed. Set PYDEVD_DISABLE_FILE_VALIDATION=1 to disable this validation.
2023/05/18 12:08:28 PM: Installed kernelspec python3 in /connect/mnt/app/python/env/share/jupyter/kernels/python3
2023/05/18 12:08:29 PM: Creating lockfile: python/requirements.txt.lock
            </pre>
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel>
          <v-expansion-panel-title readonly>
            <v-row no-gutters>
              <v-col cols="2" class="d-flex justify-start">
                Render Report
              </v-col>
              <v-col
                cols="10"
                class="text-grey"
              >
              </v-col>
            </v-row>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-main>
  </v-app>
</template>

<script setup>
</script>
