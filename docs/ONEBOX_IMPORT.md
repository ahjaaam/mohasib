# Onebox local document archive

This command discovers Onebox document pages from the site's public product
sitemap and downloads only items that expose the site's public free-download
form:

```bash
npm run resources:download-onebox
```

Output is written to `imports/onebox/`:

- `files/` contains unique downloaded files.
- `manifest.json` is the machine-readable import manifest for the Mohasib hub.
- `manifest.csv` is a spreadsheet-friendly copy of the manifest.

The command is resumable. Run it again after an interruption; completed URLs
are skipped. Files are deduplicated by SHA-256 content hash, so differently
named copies of the same document are stored once.

Onebox asks browsers to wait 32 seconds while each free file is generated. The
downloader honors that interval, so a complete first run can take several
hours. It is safe to leave running or stop with Ctrl-C and resume later.

Onebox also enforces a server-side daily download limit. When reached, the
command stops cleanly and retains its manifest. Run the same command after 24
hours to resume from the remaining entries. The downloader does not attempt to
bypass this restriction.

Useful options are passed after `--`:

```bash
# Inspect the first 10 sitemap entries without downloading files
npm run resources:download-onebox -- --dry-run --limit 10

# Save elsewhere and use a slower request interval
npm run resources:download-onebox -- --output "$HOME/Downloads/onebox-documents" --delay 2500
```

The downloader checks `robots.txt`, waits between requests, never attempts to
bypass bot challenges, and records failures in the manifest for inspection.
Premium products and pages without a public free-download form are marked
`not_free` and are not downloaded.
