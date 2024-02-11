#!/usr/bin/env node
'use strict';

const PE = require('pe-parser');
const fs = require('node:fs');
const log = require('npmlog');
const path = require('node:path');
const { program } = require('commander');
const { fileOffsetToRva, formatBytes } = require('./src/converter');

program.name('diff2patch')
    .description('Creates a mempatch file from differences in two binaries')
    .requiredOption('-o, --original <file>', 'original binary')
    .requiredOption('-m, --modified <file>', 'modified binary')
    .requiredOption('-p, --patch <file>', 'output patch file')
    .parse();

const options = program.opts();

const original = fs.readFileSync(options.original);
const modified = fs.readFileSync(options.modified);

if (original.length !== modified.length)
    return log.error('init', 'original and modified binaries must be the same size');

let patches = [];

for (let offset = 0; offset < original.length; ++offset)
{
    const on = modified[offset];
    const off = original[offset];

    if (on === off)
        continue;

    const patch = patches[patches.length - 1];

    if (patch && (offset - patch.off.length) === patch.offset)
    {
        // Continue appending bytes to the last patch.
        patch.off.push(off);
        patch.on.push(on);
    }
    else
    {
        // Create a new patch.
        patches.push({ offset: offset, on: [on], off: [off] });
    }
}

if (patches.length === 0)
    return log.error('diff', 'no differences found');

log.info('convert', 'writing %d patches to file "%s"...', patches.length, options.patch);

const basename = path.basename(options.original);
const output = fs.createWriteStream(options.patch);

(async () =>
{
    for (const patch of patches)
    {
        let data = fs.readFileSync(options.original);
        let pe = await PE.Parse(data);

        const offset = fileOffsetToRva(pe, patch.offset);

        const on_bytes = formatBytes(patch.on);
        const off_bytes = formatBytes(patch.off);

        output.write(`${basename} ${offset} ${on_bytes} ${off_bytes}\n`);
    }
}) ();