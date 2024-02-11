'use strict';

const PE = require('pe-parser');
const fs = require('node:fs');
const log = require('npmlog');
const path = require('node:path');
const sanitize = require('sanitize-filename');

/**
 * Convert file offset to a relative virtual address.
 *
 * @param pe Parsed portable executable.
 * @param offset File offset to convert.
 * @returns {string|void}
 */
const fileOffsetToRva = (pe, offset) =>
{
    for (const section of pe.sections)
    {
        if (offset < section.PointerToRawData || offset >= section.PointerToRawData + section.SizeOfRawData)
            continue;

        return (offset - section.PointerToRawData + section.VirtualAddress).toString(16).toUpperCase();
    }
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
    // Try to use the description of the Patcher as the initial filename.
    let exe = path.resolve(dir, sanitize(container.description) + path.extname(container.fname));

    if (!fs.existsSync(exe))
    {
        log.warn('convert', 'target file "%s" does not exist, falling back to "%s"...', exe, container.fname);
        exe = path.resolve(dir, container.fname);
    }

    if (!fs.existsSync(exe))
        return log.error('convert', 'target file "%s" does not exist', exe);

    let data = fs.readFileSync(exe);
    let pe = await PE.Parse(data);

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
            const offset = fileOffsetToRva(pe, is_union ? item.offset: patch.offset);

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

module.exports = { fileOffsetToRva, formatBytes, convert };