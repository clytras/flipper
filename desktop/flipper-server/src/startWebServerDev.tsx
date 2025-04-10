/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import chalk from 'chalk';
import {Express} from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs-extra';
import socketio from 'socket.io';
import pFilter from 'p-filter';
import {homedir} from 'os';

// This file is heavily inspired by scripts/start-dev-server.ts!
// part of that is done by start-flipper-server-dev (compiling "main"),
// the other part ("renderer") here.

const uiSourceDirs = [
  'flipper-ui-browser',
  'flipper-ui-core',
  'flipper-plugin',
  'flipper-common',
];

// copied from plugin-lib/src/pluginPaths
export async function getPluginSourceFolders(): Promise<string[]> {
  const pluginFolders: string[] = [];
  if (process.env.FLIPPER_NO_DEFAULT_PLUGINS) {
    console.log(
      '🥫  Skipping default plugins because "--no-default-plugins" flag provided',
    );
    return pluginFolders;
  }
  const flipperConfigPath = path.join(homedir(), '.flipper', 'config.json');
  if (await fs.pathExists(flipperConfigPath)) {
    const config = await fs.readJson(flipperConfigPath);
    if (config.pluginPaths) {
      pluginFolders.push(...config.pluginPaths);
    }
  }
  pluginFolders.push(path.resolve(__dirname, '..', '..', 'plugins', 'public'));
  pluginFolders.push(path.resolve(__dirname, '..', '..', 'plugins', 'fb'));
  return pFilter(pluginFolders, (p) => fs.pathExists(p));
}

export async function startWebServerDev(
  app: Express,
  server: http.Server,
  socket: socketio.Server,
  rootDir: string,
) {
  // prevent bundling!
  const Metro = electronRequire('metro');
  const MetroResolver = electronRequire('metro-resolver');
  const {getWatchFolders} = electronRequire('flipper-pkg-lib');

  const babelTransformationsDir = path.resolve(
    rootDir,
    'babel-transformer',
    'lib', // Note: required pre-compiled!
  );

  const electronRequires = path.join(
    babelTransformationsDir,
    'electron-requires.js',
  );
  const stubModules = new Set<string>(
    electronRequire(electronRequires).BUILTINS,
  );
  if (!stubModules.size) {
    throw new Error('Failed to load list of Node builtins');
  }

  const watchFolders = await dedupeFolders([
    ...(
      await Promise.all(
        uiSourceDirs.map((dir) => getWatchFolders(path.resolve(rootDir, dir))),
      )
    ).flat(),
    ...(await getPluginSourceFolders()),
  ]);

  const baseConfig = await Metro.loadConfig();
  const config = Object.assign({}, baseConfig, {
    projectRoot: rootDir,
    watchFolders,
    transformer: {
      ...baseConfig.transformer,
      babelTransformerPath: path.join(
        babelTransformationsDir,
        'transform-browser',
      ),
    },
    resolver: {
      ...baseConfig.resolver,
      resolverMainFields: ['flipperBundlerEntry', 'browser', 'module', 'main'],
      blacklistRE: [/\.native\.js$/],
      sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'mjs', 'cjs'],
      resolveRequest(context: any, moduleName: string, ...rest: any[]) {
        // flipper is special cased, for plugins that we bundle,
        // we want to resolve `impoSrt from 'flipper'` to 'flipper-ui-core', which
        // defines all the deprecated exports
        if (moduleName === 'flipper') {
          return MetroResolver.resolve(context, 'flipper-ui-core', ...rest);
        }
        if (stubModules.has(moduleName)) {
          console.warn(
            `Found a reference to built-in module '${moduleName}', which will be stubbed out. Referer: ${context.originModulePath}`,
          );
          return {
            type: 'empty',
          };
        }
        return MetroResolver.resolve(
          {
            ...context,
            resolveRequest: null,
          },
          moduleName,
          ...rest,
        );
      },
    },
    watch: true,
  });
  const connectMiddleware = await Metro.createConnectMiddleware(config);
  app.use(connectMiddleware.middleware);
  connectMiddleware.attachHmrServer(server);
  app.use(function (err: any, _req: any, _res: any, next: any) {
    console.error(chalk.red('\n\nCompile error in client bundle\n'), err);
    socket.local.emit('hasErrors', err.toString());
    next();
  });

  console.log('DEV webserver started.');
}

async function dedupeFolders(paths: string[]): Promise<string[]> {
  return pFilter(
    paths.filter((value, index, self) => self.indexOf(value) === index),
    (f) => fs.pathExists(f),
  );
}
