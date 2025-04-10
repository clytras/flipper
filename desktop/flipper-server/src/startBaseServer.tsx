/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import express, {Express} from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs-extra';
import socketio from 'socket.io';
import {WEBSOCKET_MAX_MESSAGE_SIZE} from 'flipper-server-core';

type Config = {
  port: number;
  staticDir: string;
  entry: string;
};

export async function startBaseServer(config: Config): Promise<{
  app: Express;
  server: http.Server;
  socket: socketio.Server;
}> {
  const {app, server} = await startAssetServer(config);
  const socket = addWebsocket(server, config);
  return {
    app,
    server,
    socket,
  };
}

function startAssetServer(
  config: Config,
): Promise<{app: Express; server: http.Server}> {
  const app = express();

  app.use((_req, res, next) => {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
  });

  app.get('/', (_req, res) => {
    fs.readFile(path.join(config.staticDir, config.entry), (_err, content) => {
      res.end(content);
    });
  });

  app.use(express.static(config.staticDir));

  const server = http.createServer(app);

  return new Promise((resolve) => {
    server.listen(config.port, 'localhost', () => resolve({app, server}));
  });
}

function addWebsocket(server: http.Server, config: Config) {
  const validHost = `localhost:${config.port}`;
  const io = new socketio.Server(server, {
    maxHttpBufferSize: WEBSOCKET_MAX_MESSAGE_SIZE,
    allowRequest(req, callback) {
      const noOriginHeader = req.headers.origin === undefined;
      if (noOriginHeader && req.headers.host === validHost) {
        callback(null, true);
      } else {
        console.warn(
          `Refused sockect connection from cross domain request, origin: ${req.headers.origin}, host: ${req.headers.host}. Expected: ${validHost}`,
        );
        callback(null, false);
      }
    },
  });
  return io;
}
