// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as crypto from "crypto";
import { pack as tarPack } from "tar-stream";
import { createGzip } from "zlib";
import { finished, pipeline } from "stream/promises";
import { PassThrough } from "stream";

import { FileEntry, Manifest } from "./types";
import { addFile, cloneManifest, manifestToJSON } from "./manifest";

const RENV_LOCK_STAGED_PATH = ".posit/publish/deployments/renv.lock";

/**
 * Create a tar.gz archive from collected files and a manifest.
 *
 * Returns a Buffer containing the tar.gz data and the updated manifest
 * with the `files` section populated (including checksums).
 *
 * The staged renv.lock path (.posit/publish/deployments/renv.lock) is
 * remapped to the bundle root as renv.lock.
 */
export async function createArchive(
  files: FileEntry[],
  manifest: Manifest,
): Promise<{
  bundle: Buffer;
  manifest: Manifest;
  fileCount: number;
  totalSize: number;
}> {
  const updatedManifest = cloneManifest(manifest);
  const pack = tarPack();
  const gzip = createGzip();

  // Collect the output into a buffer
  const chunks: Buffer[] = [];
  const collector = new PassThrough();
  collector.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pipelinePromise = pipeline(pack, gzip, collector);

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
    // simultaneously, matching the Go implementation's io.MultiWriter
    // approach and avoiding buffering entire files in memory.
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
  }

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

  return {
    bundle: Buffer.concat(chunks),
    manifest: updatedManifest,
    fileCount,
    totalSize,
  };
}
