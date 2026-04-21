#!/usr/bin/env bun
// Flattens .homeycompose/* into a top-level app.json, like the Homey CLI's
// built-in composer. Useful for validate/build without spinning up `homey app run`.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function listJson(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  return entries.filter((e) => e.endsWith('.json')).map((e) => join(dir, e));
}

async function main(): Promise<void> {
  const base = await readJson(join(root, '.homeycompose', 'app.json'));
  const out: any = {
    _comment: 'This file is generated. Edit .homeycompose/app.json instead.',
    ...base,
  };

  // Drivers
  const driversDir = join(root, 'drivers');
  const drivers: any[] = [];
  for (const name of await readdir(driversDir)) {
    const composePath = join(driversDir, name, 'driver.compose.json');
    if (!existsSync(composePath)) continue;
    const compose = await readJson(composePath);
    drivers.push({ id: name, ...compose });
  }
  if (drivers.length > 0) out.drivers = drivers;

  // Flow
  const flow: Record<string, any[]> = {};
  for (const kind of ['triggers', 'conditions', 'actions']) {
    const files = await listJson(join(root, '.homeycompose', 'flow', kind));
    const arr: any[] = [];
    for (const f of files) arr.push(await readJson(f));
    if (arr.length > 0) flow[kind] = arr;
  }
  if (Object.keys(flow).length > 0) out.flow = flow;

  // Capabilities
  const capFiles = await listJson(join(root, '.homeycompose', 'capabilities'));
  const capabilities: Record<string, any> = {};
  for (const f of capFiles) {
    const name = f.split('/').pop()!.replace('.json', '');
    capabilities[name] = await readJson(f);
  }
  if (Object.keys(capabilities).length > 0) out.capabilities = capabilities;

  // Discovery
  const discFiles = await listJson(join(root, '.homeycompose', 'discovery'));
  const discovery: Record<string, any> = {};
  for (const f of discFiles) {
    const name = f.split('/').pop()!.replace('.json', '');
    discovery[name] = await readJson(f);
  }
  if (Object.keys(discovery).length > 0) out.discovery = discovery;

  await writeFile(join(root, 'app.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('wrote app.json');
}

void main();
