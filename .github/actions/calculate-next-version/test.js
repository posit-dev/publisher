// Import the modules we need
const path = require("path");
const semver = require("semver");

// Mock storage for @actions/core
let inputs = {};
let outputs = {};
let failures = [];
let logs = [];
let groups = [];

// Create a mock for @actions/core
const coreMock = {
  getInput: (name, options) => {
    if (options?.required && !(name in inputs)) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return inputs[name] || "";
  },
  setOutput: (name, value) => {
    outputs[name] = value;
    // Don't log outputs as they happen, we'll show them at the end
  },
  setFailed: (message) => {
    failures.push(message);
    // Don't log failures as they happen, we'll show them at the end
  },
  info: (message) => {
    logs.push(message);
  },
  startGroup: (name) => {
    groups.push(name);
  },
  endGroup: () => {
    if (groups.length > 0) {
      groups.pop();
    }
  },
};

// Test runner
function runTest(name, testInputs, expectedOutputs, expectFailure = false) {
  console.log(`\n=== Running test: ${name} ===`);

  // Display inputs first
  console.log("Inputs:");
  for (const [key, value] of Object.entries(testInputs)) {
    console.log(`  ${key}: ${value}`);
  }

  // Reset state
  inputs = { ...testInputs };
  outputs = {};
  failures = [];
  logs = [];
  groups = [];

  try {
    // Replace the require.cache for @actions/core with our mock
    require.cache[require.resolve("@actions/core")] = {
      exports: coreMock,
    };

    // Clear the cache for index.js if it was previously required
    if (require.cache[require.resolve("./index")]) {
      delete require.cache[require.resolve("./index")];
    }

    // Now require and execute index.js with our mocked environment
    require("./index");

    // Display validation results
    console.log("\nResults:");

    // Validate expectations
    if (expectFailure) {
      if (failures.length === 0) {
        console.error(`❌ Test failed: Expected failure but got success`);
        return false;
      }
      console.log(`✅ Passed: Expected failure`);
      console.log(`  Error: ${failures[0]}`);
      return true;
    } else {
      if (failures.length > 0) {
        console.error(`❌ Test failed with error: ${failures[0]}`);
        return false;
      }

      // Display outputs
      console.log("  Outputs:");
      for (const [key, value] of Object.entries(outputs)) {
        console.log(`    ${key}: ${value}`);

        // Check if this output matches the expected value
        if (expectedOutputs[key] && expectedOutputs[key] !== value) {
          console.error(`    ❌ Expected: ${expectedOutputs[key]}`);
          return false;
        }
      }

      // Additional validation for any explicit expectations
      let allOutputsMatch = true;
      for (const [key, expectedValue] of Object.entries(expectedOutputs)) {
        if (!(key in outputs)) {
          console.error(`❌ Missing expected output: ${key}`);
          allOutputsMatch = false;
        } else if (outputs[key] !== expectedValue) {
          console.error(
            `❌ Output mismatch for ${key}: expected "${expectedValue}", got "${outputs[key]}"`,
          );
          allOutputsMatch = false;
        }
      }

      if (allOutputsMatch) {
        console.log("  ✅ All outputs match expected values");
        return true;
      }

      return false;
    }
  } catch (error) {
    console.error(`\n❌ Test threw an error: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

// Test cases
const tests = [
  // Major version tests
  {
    name: "Major version from stable version",
    inputs: {
      "release-type": "major",
      "all-tags": "v1.4.0",
    },
    expectedOutputs: {
      "next-version": "v2.0.0",
    },
  },
  {
    name: "Major version from prerelease version",
    inputs: {
      "release-type": "major",
      "all-tags": "v1.5.0",
    },
    expectedOutputs: {
      "next-version": "v2.0.0",
    },
  },

  // Minor version tests
  {
    name: "Minor version from stable version",
    inputs: {
      "release-type": "minor",
      "all-tags": "v1.4.0",
    },
    expectedOutputs: {
      "next-version": "v1.6.0",
    },
  },
  {
    name: "Minor version from prerelease version",
    inputs: {
      "release-type": "minor",
      "all-tags": "v1.5.0",
    },
    expectedOutputs: {
      "next-version": "v1.6.0",
    },
  },

  // Patch version tests
  {
    name: "Patch version from stable version",
    inputs: {
      "release-type": "patch",
      "all-tags": "v1.4.0",
    },
    expectedOutputs: {
      "next-version": "v1.4.1",
    },
  },
  {
    name: "Patch version from prerelease version",
    inputs: {
      "release-type": "patch",
      "all-tags": "v1.5.0",
    },
    expectedOutputs: {
      "next-version": "v1.6.0",
    },
  },

  // Premajor version tests
  {
    name: "Premajor version from stable version",
    inputs: {
      "release-type": "premajor",
      "all-tags": "v1.4.0",
    },
    expectedOutputs: {
      "next-version": "v2.1.0",
    },
  },
  {
    name: "Premajor version from prerelease version",
    inputs: {
      "release-type": "premajor",
      "all-tags": "v1.5.0",
    },
    expectedOutputs: {
      "next-version": "v2.1.0",
    },
  },

  // Preminor version tests
  {
    name: "Preminor version from stable version",
    inputs: {
      "release-type": "preminor",
      "all-tags": "v1.4.0",
    },
    expectedOutputs: {
      "next-version": "v1.5.0",
    },
  },
  {
    name: "Preminor version from prerelease version",
    inputs: {
      "release-type": "preminor",
      "all-tags": "v1.5.0",
    },
    expectedOutputs: {
      "next-version": "v1.7.0",
    },
  },

  // Prepatch version tests
  {
    name: "Prepatch version from stable version",
    inputs: {
      "release-type": "prepatch",
      "all-tags": "v1.4.0",
    },
    expectedOutputs: {
      "next-version": "v1.5.0",
    },
  },
  {
    name: "Prepatch version from prerelease version",
    inputs: {
      "release-type": "prepatch",
      "all-tags": "v1.5.0",
    },
    expectedOutputs: {
      "next-version": "v1.5.1",
    },
  },

  {
    name: "Limiting tags with max-tags parameter",
    inputs: {
      "release-type": "patch",
      "all-tags": "v1.0.0,v1.2.0,v1.4.0,v1.6.0,v1.8.0",
      "max-tags": "2",
    },
    expectedOutputs: {
      "next-version": "v1.8.1",
    },
  },
  {
    name: "Version calculation with v prefix",
    inputs: {
      "release-type": "patch",
      "all-tags": "v1.0.0,v1.2.0,v1.4.0",
    },
    expectedOutputs: {
      "next-version": "v1.4.1",
    },
  },
  {
    name: "Multiple tags with v prefix",
    inputs: {
      "release-type": "patch",
      "all-tags": "v1.0.0,v1.2.0,v1.4.0,v1.6.0",
    },
    expectedOutputs: {
      "next-version": "v1.6.1",
    },
  },
  {
    name: "Real world tags for next patch version",
    inputs: {
      "release-type": "patch",
      "all-tags":
        "v1.19.1,v1.19.0,v1.18.1,v1.18.0,v1.16.1,v1.16.0,v1.14.0,v1.12.1,v1.12.0,v1.10.0",
    },
    expectedOutputs: {
      "next-version": "v1.20.0", // v1.19.1 is an odd-minor prerelease, so patch goes to next even minor
    },
  },
  {
    name: "Real world tags for next minor version",
    inputs: {
      "release-type": "minor",
      "all-tags":
        "v1.19.1,v1.19.0,v1.18.1,v1.18.0,v1.16.1,v1.16.0,v1.14.0,v1.12.1,v1.12.0,v1.10.0",
    },
    expectedOutputs: {
      "next-version": "v1.20.0",
    },
  },
  {
    name: "Invalid release type",
    inputs: {
      "release-type": "invalid",
      "all-tags": "v1.0.0,v1.2.0",
    },
    expectFailure: true,
  },
  {
    name: "Empty tags",
    inputs: {
      "release-type": "patch",
      "all-tags": "",
    },
    expectFailure: true,
  },
  {
    name: "Invalid tags",
    inputs: {
      "release-type": "patch",
      "all-tags": "foo,bar,v1.x.0",
    },
    expectFailure: true,
  },
  {
    name: "Mixed valid and invalid tags",
    inputs: {
      "release-type": "patch",
      "all-tags": "v1.0.0,invalid-tag,v1.2.0,not-semver,v1.4.0",
    },
    expectFailure: true,
  },
];

// Run all tests
console.log("=== Testing calculate-next-version (index.js directly) ===\n");

let passCount = 0;
let failCount = 0;

for (const test of tests) {
  const passed = runTest(
    test.name,
    test.inputs,
    test.expectedOutputs || {},
    test.expectFailure || false,
  );

  if (passed) {
    passCount++;
  } else {
    failCount++;
  }
}

// Print summary
console.log("\n=== Test Summary ===");
console.log(`${passCount} tests passed, ${failCount} tests failed`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log("\n✅ All tests passed!");
  process.exit(0);
}
