'use strict';

const fs = require('node:fs');
const log = require('npmlog');
const path = require('node:path');
const child_process = require('node:child_process');

/**
 * Invoke ofs2rva to convert a file offset to a relative virtual address.
 *
 * @param exe Path to the target executable.
 * @param offset File offset to convert.
 * @returns {string|void}
 */
const fileOffsetToRva = (exe, offset) =>
{
    offset = '0x' + offset.toString(16).toUpperCase();

    const result = child_process.execSync('ofs2rva ' + offset + ' "' + exe + '"').toString();

    if (!result.startsWith('0x'))
        return log.error('convert', 'failed to convert offset %s to rva using file %s', offset, exe);

    return result.substring(2).trim().toUpperCase();
}

/**
 * Convert array of bytes to a mempatch-hook hex string.
 *
 * @param bytes An array of integers.
 * @returns {string}
 */
const formatBytes = (bytes) =>
    bytes.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

/**
 * Adapt patches from BemaniPatcher to mempatch-hook format.
 *
 * @param dir Path to a directory containing target executables.
 * @param container Object of arguments captured from the `Patcher` class constructor.
 * @returns {Promise<string|void>}
 */
const convert = async (dir, container) =>
{
    // Ensure the file this patcher is targeting exists.
    const exe = path.resolve(dir, container.fname);

    if (!fs.existsSync(exe))
        return log.error('convert', 'target executable "%s" does not exist', exe);

    // Start building the output string.
    let result = [];

    // Convert each patch to mempatch-hook format.
    container.args.forEach(item =>
    {
        // Skip number patches as they can't easily be converted.
        if ('type' in item && item.type === 'number')
            return log.warn('convert', 'number patch not supported, skipping "%s"...', item.name);

        const is_union = ('type' in item && item.type === 'union');

        let output = `# ${item.name}\n`;

        for (let i = 0; i < item.patches.length; ++i)
        {
            // First entry in a union is always the default.
            if (is_union && i === 0)
                continue;

            // Convert file offsets to relative virtual addresses used by mempatch-hook.
            const patch = item.patches[i];
            const offset = fileOffsetToRva(exe, is_union ? item.offset: patch.offset);

            if (!offset)
                continue;

            // Format patch bytes in the expected mempatch-hook format.
            const on_bytes = formatBytes(is_union ? patch.patch: patch.on);
            const off_bytes = formatBytes(is_union ? item.patches[0].patch: patch.off);

            // Prefix union options with '##' characters.
            if (is_union)
                output += `## ${patch.name}\n`;

            output += `# ${container.fname} ${offset} ${on_bytes} ${off_bytes}\n`;
        }

        result.push(output);
    });

    log.info('convert', 'successfully converted %d patches for "%s" version "%s"',
        result.length, container.fname, container.description);

    return result.join('\n');
}

module.exports = convert;