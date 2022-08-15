## b2mpatch

Converts patches from [BemaniPatcher](https://github.com/mon/BemaniPatcher) to mempatch-hook format

### Usage

A pre-built image is available on Docker Hub.

```bash
# convert iidx 25, 26, 27 & 28 patches
docker run --rm -it -u $(id -u):$(id -g) -v $(pwd):/data aixxe/b2mpatch --output=/data/patches/     \
  --dir=/data/bin/2018091900 --url=https://github.com/mon/BemaniPatcher/raw/master/ballerz.html     \
  --dir=/data/bin/2019090200 --url=https://github.com/mon/BemaniPatcher/raw/master/rootage.html     \
  --dir=/data/bin/2020092900 --url=https://github.com/mon/BemaniPatcher/raw/master/heroicverse.html \
  --dir=/data/bin/2021091500 --url=https://github.com/mon/BemaniPatcher/raw/master/bistrover.html
```

A pair of `--dir` and `--url` arguments must be provided for each patcher.

- The `--dir` argument should contain all executable files required by the patcher.
- The `--url` argument should contain a full URL to a patcher page.

If the `--output` option is not defined, all converted files will be saved to the current directory.

All patches are disabled by default.

To enable a patch, remove the `#` prefix from the line containing the offset and bytes.

```bash
# Disabled patch
# example.exe 7E6B5 909090 33C055

# Enabled patch
example.exe CF683 9090 4DA8
```

Options for union-type patches are denoted by a `##` prefix. Only one should be enabled at a time.
```bash
# Patch with multiple options
## Option 1 (disabled)
# example.exe 447A0B 45540F94C0 4AD3FF80F8
## Option 2 (enabled)
example.exe 447A0B 4584ED750E 4AD3FF80F8
## Option 3 (disabled)
# example.exe 447A0B 40488B00FF 4AD3FF80F8
```