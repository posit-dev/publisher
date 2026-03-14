// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as crypto from "crypto";
import { pack as tarPack } from "tar-stream";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
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
      pack.entry({ name: entry.relativePath + "/", type: "directory" });
      continue;
    }

    // Remap staged renv.lock to bundle root
    const archiveName =
      entry.relativePath === RENV_LOCK_STAGED_PATH
        ? "renv.lock"
        : entry.relativePath;

    const content = fs.readFileSync(entry.absolutePath);
    const md5 = crypto.createHash("md5").update(content).digest();

    pack.entry(
      { name: archiveName, size: content.length, mode: 0o666 },
      content,
    );

    addFile(updatedManifest, archiveName, md5);
    fileCount++;
    totalSize += content.length;
  }

  // Add manifest.json as the final entry
  const manifestJSON = manifestToJSON(updatedManifest);
  pack.entry(
    { name: "manifest.json", size: manifestJSON.length, mode: 0o666 },
    manifestJSON,
  );

  pack.finalize();
  await pipelinePromise;

  return {
    bundle: Buffer.concat(chunks),
    manifest: updatedManifest,
    fileCount,
    totalSize,
  };
}
