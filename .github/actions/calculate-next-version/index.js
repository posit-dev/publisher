const core = require("@actions/core");
const semver = require("semver");

try {
  // Get inputs
  const releaseType = core.getInput("release-type", { required: true });
  const allTags = core.getInput("all-tags", { required: true }).trim();
  const maxTagsStr = core.getInput("max-tags", { required: false }) || "10";

  // Validate release type
  if (releaseType !== "release" && releaseType !== "pre-release") {
    core.setFailed(
      `Invalid release-type: '${releaseType}'. Must be either 'release' or 'pre-release'.`,
    );
    return;
  }

  // Validate tags input
  if (!allTags) {
    core.setFailed(
      "Empty all-tags input. The all-tags parameter is required and must contain valid version tags.",
    );
    return;
  }

  // Validate and parse max-tags
  let maxTags = 10; // Default
  try {
    maxTags = parseInt(maxTagsStr, 10);
    if (isNaN(maxTags) || maxTags <= 0) {
      core.info(
        `Invalid max-tags value: "${maxTagsStr}". Using default of 10.`,
      );
      maxTags = 10;
    }
  } catch (error) {
    core.info(
      `Error parsing max-tags value: ${error.message}. Using default of 10.`,
    );
    maxTags = 10;
  }

  // Process tags
  core.startGroup("Processing tags");

  // Convert comma-separated list to array and validate
  const inputTags = allTags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (inputTags.length === 0) {
    core.setFailed(
      "No valid tags found in input. The all-tags parameter must contain at least one valid version tag.",
    );
    return;
  }

  core.info(
    `Found ${inputTags.length} total tags, will process up to ${maxTags} of the most recent ones`,
  );

  // The input tags are in chronological order, with newest last
  // We need to reverse them before limiting to get the newest ones
  const reverseInputTags = [...inputTags].reverse();

  // First limit to the most recent tags up to maxTags as the very first tags in the repo are non-SemVer
  const limitedInputTags = reverseInputTags.slice(0, maxTags);
  core.info(`Limited to the ${limitedInputTags.length} most recent input tags`);

  // Now clean and validate only these limited tags
  const validTagsWithInfo = [];

  for (let i = 0; i < limitedInputTags.length; i++) {
    const tag = limitedInputTags[i];
    try {
      const cleaned = semver.clean(tag);
      if (cleaned && semver.valid(cleaned)) {
        validTagsWithInfo.push({ index: i, originalTag: tag, tag: cleaned });
      } else {
        // If tag doesn't pass semver validation, fail the action
        core.setFailed(
          `Invalid semver tag: '${tag}'. All tags must be valid semantic versions.`,
        );
        return;
      }
    } catch (error) {
      // If semver processing throws an error, fail the action
      core.setFailed(`Error processing tag '${tag}': ${error.message}`);
      return;
    }
  }

  // Extract tag values and sort them (newest first)
  const validTagValues = semver.rsort(
    validTagsWithInfo.map((item) => item.tag),
  );

  if (validTagValues.length === 0) {
    core.setFailed(
      "No valid semver tags found within the input. At least one valid semver tag is required.",
    );
    return;
  }

  core.info(
    `Found ${validTagValues.length} valid semver tags from the most recent ${limitedInputTags.length} input tags`,
  );

  // Log all valid tags at once
  core.info(`Using tags: ${validTagValues.join(", ")}`);

  // Tags are already sorted by semver rules (newest first)

  // Check that we have at least one tag
  if (validTagValues.length === 0) {
    core.setFailed(
      "No valid semver tags found. At least one valid semver tag is required.",
    );
    return;
  }

  core.endGroup();

  // Find latest versions by type
  core.startGroup("Finding latest versions");

  let latestRelease = null;
  let latestPrerelease = null;
  let latestVersion = validTagValues[0]; // First item is the latest since we sorted already

  // Find latest by type (even/odd minor)
  // Since we've already sorted with newest first, we can take the first one of each type
  for (const version of validTagValues) {
    const parsed = semver.parse(version);
    const isEven = parsed.minor % 2 === 0;

    if (isEven && !latestRelease) {
      // First even minor = latest release
      latestRelease = version;
    } else if (!isEven && !latestPrerelease) {
      // First odd minor = latest pre-release
      latestPrerelease = version;
    }

    // Exit loop if we found both
    if (latestRelease && latestPrerelease) {
      break;
    }
  }

  core.info(`Latest version: ${latestVersion || "none"}`);
  core.info(`Latest release: ${latestRelease || "none"}`);
  core.info(`Latest pre-release: ${latestPrerelease || "none"}`);

  if (!latestVersion) {
    core.setFailed(
      "No valid version tags found. At least one valid semantic version tag is required.",
    );
    return;
  }

  core.endGroup();

  // Calculate next version
  core.startGroup("Calculating next version");

  core.info("Using semver to calculate next version");

  // Parse latest version
  const parsed = semver.parse(latestVersion);
  const isEven = parsed.minor % 2 === 0;

  core.info(
    `Latest version parts: v${latestVersion} (major=${parsed.major}, minor=${parsed.minor}, patch=${parsed.patch}, is_even=${isEven})`,
  );

  let nextVersion;

  if (releaseType === "release") {
    // Release - use even minor numbers
    if (isEven) {
      // Already a release version - increment patch
      nextVersion = semver.inc(latestVersion, "patch");
      core.info(
        `Latest is already a release version - incrementing patch: ${nextVersion}`,
      );
    } else {
      // Current latest is prerelease - switch to next even minor
      let nextMinor = parsed.minor + 1;
      // Ensure minor is even
      if (nextMinor % 2 !== 0) {
        nextMinor++;
      }
      nextVersion = `${parsed.major}.${nextMinor}.0`;
      core.info(
        `Latest is a prerelease - creating new release with even minor: ${nextVersion}`,
      );
    }
  } else {
    // Prerelease - use odd minor numbers
    if (isEven) {
      // Current latest is a release - switch to next odd minor
      let nextMinor = parsed.minor + 1;
      // Ensure minor is odd
      if (nextMinor % 2 === 0) {
        nextMinor++;
      }
      nextVersion = `${parsed.major}.${nextMinor}.0`;
      core.info(
        `Latest is a release - creating new prerelease with odd minor: ${nextVersion}`,
      );
    } else {
      // Already a prerelease version - increment patch
      nextVersion = semver.inc(latestVersion, "patch");
      core.info(
        `Latest is already a prerelease - incrementing patch: ${nextVersion}`,
      );
    }
  }

  // Validate the calculated next version
  if (!semver.valid(nextVersion)) {
    core.setFailed(`Failed to calculate a valid next version: ${nextVersion}`);
    return;
  }

  core.endGroup();

  // Output results
  core.startGroup("Results");
  core.info(`Next version: v${nextVersion}`);

  // Set outputs
  core.setOutput("next-version", `v${nextVersion}`);
  core.setOutput("latest-version", `v${latestVersion}`);
  core.setOutput(
    "current-release",
    latestRelease ? `v${latestRelease}` : "none",
  );
  core.setOutput(
    "current-prerelease",
    latestPrerelease ? `v${latestPrerelease}` : "none",
  );

  core.endGroup();
} catch (error) {
  core.setFailed(`Action failed with error: ${error.message}`);
}
