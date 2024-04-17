#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const log = require('npmlog');
const axios = require('axios');
const PE = require('pe-parser');
const path = require('node:path');
const parse = require('./src/parser');
const Sandbox = require('./src/sandbox');
const { program } = require('commander');
const sanitize = require('sanitize-filename');
const { formatBytes } = require('./src/converter');

program.name('b2spice')
    .description('Converts patches from BemaniPatcher to spice2x format')
    .requiredOption('--prefix <prefix>', 'game code prefix (e.g. LDJ, KFC, etc.)')
    .requiredOption('--dir <dir...>', 'directory containing executables to patch')
    .requiredOption('--url <url...>', 'full URL to a BemaniPatcher page')
    .option('-o, --output <dir>', 'directory to write output files to', '.')
    .parse();

const convertPatch = (patch, prefix, dll) =>
{
    if ('type' in patch && patch.type === 'number')
    {
        log.warn('convert', 'number patch not supported, skipping "%s"...', patch.name);
        return;
    }

    const result = {
        name: patch.name,
        description: patch.tooltip || '',
        gameCode: prefix
    };

    const is_union = ('type' in patch && patch.type === 'union');

    if (is_union)
    {
        result.type = 'union';
        result.patches = [];

        for (const item of patch.patches)
        {
            result.patches.push({
                name: item.name,
                type: 'union',
                patch: {
                    dllName: dll,
                    data: formatBytes(item.patch),
                    offset: patch.offset,
                }
            });
        }

        return result;
    }
    else
    {
        result.type = 'memory';
        result.patches = [];

        for (const item of patch.patches)
        {
            result.patches.push({
                offset: item.offset,
                dllName: dll,
                dataDisabled: formatBytes(item.off),
                dataEnabled: formatBytes(item.on),
            });
        }
    }

    return result;
};

(async () => {
    const sandbox = new Sandbox();
    const options = program.opts();

    if (options.url.length !== options.dir.length)
        return log.error('init', '--url and --dir must have the same number of arguments');

    if (!fs.existsSync(options.output))
        fs.mkdirSync(options.output, { recursive: true });

    for (let i = 0; i < options.url.length; ++i)
    {
        const url = options.url[i];
        const dir = options.dir[i];

        log.info('query', 'querying patches from %s', url);

        const response = await axios.get(url)
            .catch(error => log.error('query', 'get url "%s" failed: %s', url, error.message));

        if (!response)
            continue;

        const script = parse(response.data);

        for (const patch of sandbox.run(script))
        {
            // Try to use the description of the Patcher as the initial filename.
            let exe = path.resolve(dir, sanitize(patch.description) + path.extname(patch.fname));

            if (!fs.existsSync(exe))
            {
                log.warn('convert', 'target file "%s" does not exist, falling back to "%s"...', exe, patch.fname);
                exe = path.resolve(dir, patch.fname);
            }

            if (!fs.existsSync(exe))
                return log.error('convert', 'target file "%s" does not exist', exe);

            let data = fs.readFileSync(exe);
            let pe = await PE.Parse(data);

            // Build output filename from PE header values.
            const timeDateStamp = pe.nt_headers.FileHeader.TimeDateStamp.toString();
            const addressOfEntryPoint = pe.nt_headers.OptionalHeader.AddressOfEntryPoint.toString();

            // Convert all patches to spice2x format.
            let result = [];

            for (const item of patch.args)
            {
                const converted = convertPatch(item, options.prefix, patch.fname);

                if (converted)
                    result.push(converted);
            }

            const filename = sanitize(`${timeDateStamp}${addressOfEntryPoint}.json`);
            const output = path.resolve(options.output, filename);

            log.info('convert', 'writing patch file "%s"...', output);
            fs.writeFileSync(output, JSON.stringify(result, null, 4));
        }
    }
})();