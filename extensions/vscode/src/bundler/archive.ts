// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import { pack as tarPack } from "tar-stream";
import { createGzip } from "zlib";
import { finished, pipeline } from "stream/promises";
import { Transform } from "stream";

import { FileEntry, Manifest, BundleProgressCallback } from "./types";
import { addFile, cloneManifest, manifestToJSON } from "./manifest";

const RENV_LOCK_STAGED_PATH = ".posit/publish/deployments/renv.lock";

/**
 * Create a tar.gz archive from collected files and a manifest.
 *
 * The archive is streamed to a temporary file on disk (never buffered whole
 * in memory) so bundles of arbitrary size can be created. The whole-bundle
 * MD5 checksum is computed in the same streaming pass.
 *
 * Returns the path to the tar.gz file, its size, its base64-encoded MD5
 * checksum, and the updated manifest with the `files` section populated
 * (including per-file checksums). The caller owns the temporary file and is
 * responsible for deleting it (and its containing temp directory) once it has
 * been uploaded.
 *
 * The staged renv.lock path (.posit/publish/deployments/renv.lock) is
 * remapped to the bundle root as renv.lock.
 */
export async function createArchive(
  files: FileEntry[],
  manifest: Manifest,
  onProgress?: BundleProgressCallback,
  syntheticFiles?: Map<string, Buffer>,
): Promise<{
  bundlePath: string;
  bundleSize: number;
  bundleChecksum: string;
  manifest: Manifest;
  fileCount: number;
  totalSize: number;
}> {
  const updatedManifest = cloneManifest(manifest);

  // Stream the archive to a temporary file rather than buffering it in memory.
  // The caller is responsible for removing this directory after upload.
  const tmpDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "posit-publisher-bundle-"),
  );

  try {
    return await writeArchive(
      tmpDir,
      files,
      updatedManifest,
      onProgress,
      syntheticFiles,
    );
  } catch (err) {
    // Don't leak a partial bundle if archive creation fails. Cleanup is
    // best-effort — never let a removal failure mask the original error.
    await fs.promises
      .rm(tmpDir, { recursive: true, force: true })
      .catch(() => {});
    throw err;
  }
}

async function writeArchive(
  tmpDir: string,
  files: FileEntry[],
  updatedManifest: Manifest,
  onProgress?: BundleProgressCallback,
  syntheticFiles?: Map<string, Buffer>,
): Promise<{
  bundlePath: string;
  bundleSize: number;
  bundleChecksum: string;
  manifest: Manifest;
  fileCount: number;
  totalSize: number;
}> {
  const pack = tarPack();
  const gzip = createGzip();

  const bundlePath = path.join(tmpDir, "bundle.tar.gz");
  const out = fs.createWriteStream(bundlePath);

  // Compute the whole-bundle MD5 in the same streaming pass that writes the
  // file, so token-auth uploads can sign the bundle without re-reading it.
  const bundleHash = crypto.createHash("md5");
  const hashStream = new Transform({
    transform(chunk, _enc, cb) {
      bundleHash.update(chunk);
      cb(null, chunk);
    },
  });

  const pipelinePromise = pipeline(pack, gzip, hashStream, out);
  // If assembling the archive below throws (e.g. a source file is missing),
  // the awaits in the loop reject before we reach `await pipelinePromise`,
  // leaving the pipeline's own rejection unobserved. Attach a no-op handler so
  // that secondary rejection can never surface as an unhandled rejection; the
  // original error is still propagated by the awaits below, which keep their
  // own handle on this promise (so genuine write failures are not masked).
  pipelinePromise.catch(() => {});

  let fileCount = 0;
  let totalSize = 0;

  for (const entry of files) {
    if (entry.isDirectory) {
      // tar-stream treats directory entries as "void" — they auto-finish
      // internally in _continueOpen(), so no .end(), callback, or empty
      // buffer is needed. See Sink._isVoid in tar-stream/pack.js.
      pack.entry({ name: entry.relativePath + "/", type: "directory" });
      continue;
    }

    // Remap staged renv.lock to bundle root
    const archiveName =
      entry.relativePath === RENV_LOCK_STAGED_PATH
        ? "renv.lock"
        : entry.relativePath;

    // Stream file contents through both the tar entry and MD5 hash
    // simultaneously and avoid buffering entire files in memory.
    const hash = crypto.createHash("md5");
    const entryStream = pack.entry({
      name: archiveName,
      size: entry.size,
      mode: entry.mode,
    });
    const fileStream = fs.createReadStream(entry.absolutePath);
    fileStream.on("data", (chunk) => hash.update(chunk));
    fileStream.on("error", (err) => entryStream.destroy(err));
    await finished(fileStream.pipe(entryStream));
    const md5 = hash.digest();

    addFile(updatedManifest, archiveName, md5);
    fileCount++;
    totalSize += entry.size;
    onProgress?.({ kind: "file", path: archiveName, size: entry.size });
  }

  // Add synthetic (in-memory) files to the bundle
  if (syntheticFiles) {
    for (const [name, content] of syntheticFiles) {
      const hash = crypto.createHash("md5");
      hash.update(content);
      const md5 = hash.digest();

      const syntheticEntry = pack.entry({
        name,
        size: content.length,
        mode: 0o666,
      });
      syntheticEntry.end(content);
      await finished(syntheticEntry);

      addFile(updatedManifest, name, md5);
      fileCount++;
      totalSize += content.length;
      onProgress?.({ kind: "file", path: name, size: content.length });
    }
  }

  onProgress?.({ kind: "summary", files: fileCount, totalBytes: totalSize });

  // Add manifest.json as the final entry
  const manifestJSON = manifestToJSON(updatedManifest);
  const manifestEntry = pack.entry({
    name: "manifest.json",
    size: manifestJSON.length,
    mode: 0o666,
  });
  manifestEntry.end(manifestJSON);
  await finished(manifestEntry);

  pack.finalize();
  await pipelinePromise;

  const { size: bundleSize } = await fs.promises.stat(bundlePath);
  const bundleChecksum = bundleHash.digest("base64");

  return {
    bundlePath,
    bundleSize,
    bundleChecksum,
    manifest: updatedManifest,
    fileCount,
    totalSize,
  };
}
