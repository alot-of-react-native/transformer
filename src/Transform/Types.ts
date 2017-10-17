/**
 *
 */
import { Node } from 'babel-core';

// TODO: Better typings?
// Called MappingsMap here:
//   https://github.com/facebook/metro-bundler/blob/master/packages/metro-bundler/src/JSTransformer/worker/index.js
// MappingsMap defined as SourceMap from babel-core here:
//   https://github.com/facebook/metro-bundler/blob/master/packages/metro-bundler/src/lib/SourceMap.js
// TypeScript typings for SourceMap are absent. May use 'source-map'?
// tslint:disable-next-line:no-any
export type MappingsMap = any;

// tslint:disable-next-line:no-any
export type LogEntry = any;

export interface TransformedCode {
  code: string;
  dependencies: string[];
  dependencyOffsets: number[];
  map?: MappingsMap;
}

export interface TransformResult {
  ast: Node;
  code: string;
  map: MappingsMap;
  // used in metro-bundler/src/transformer.js
  // but not in typings (metro-bundler/src/JSTransformer/worker/index.js)
  filename?: string;
}

// type ExtraOptions = {};

export interface Options {
  enableBabelRCLookup?: boolean;
  dev?: boolean;
  generateSourceMaps?: boolean;
  hot?: boolean;
  inlineRequires?: {blacklist: { [key: string]: true }} | boolean;
  platform?: string;
  projectRoot: string;
}

export interface Params<ExtraOptions> {
  filename: string;
  localPath?: string;
  options: ExtraOptions & Options;
  plugins?: {};
  src: string;
}

export interface Data {
  result: TransformedCode;
  transformFileStartLogEntry: LogEntry;
  trasnformFileEndLogEntry: LogEntry;
}

export type TransformFn<ExtraOptions = {}> = (Params: Params<ExtraOptions>) => TransformResult;
export type CacheKeyFn = () => string;

export interface Transformer<ExtraOptions = {}> {
  transform: TransformFn<ExtraOptions>;
  getCacheKey?: CacheKeyFn;
}
