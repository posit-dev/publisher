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
  {
    name: "Calculating release version from release",
    inputs: {
      "release-type": "release",
      "all-tags": "1.0.0,1.2.0,1.4.0",
    },
    expectedOutputs: {
      "next-version": "v1.4.1",
    },
  },
  {
    name: "Limiting tags with max-tags parameter",
    inputs: {
      "release-type": "release",
      "all-tags": "1.0.0,1.2.0,1.4.0,1.6.0,1.8.0",
      "max-tags": "2",
    },
    expectedOutputs: {
      "next-version": "v1.8.1",
    },
  },
  {
    name: "Calculating release version with v prefix",
    inputs: {
      "release-type": "release",
      "all-tags": "v1.0.0,v1.2.0,v1.4.0",
    },
    expectedOutputs: {
      "next-version": "v1.4.1",
    },
  },
  {
    name: "Calculating release version from prerelease",
    inputs: {
      "release-type": "release",
      "all-tags": "1.0.0,1.1.0,1.3.0",
    },
    expectedOutputs: {
      "next-version": "v1.4.0",
    },
  },
  {
    name: "Calculating prerelease version from release",
    inputs: {
      "release-type": "pre-release",
      "all-tags": "1.0.0,1.2.0,1.4.0",
    },
    expectedOutputs: {
      "next-version": "v1.5.0",
    },
  },
  {
    name: "Mixed tags with and without v prefix",
    inputs: {
      "release-type": "release",
      "all-tags": "v1.0.0,1.2.0,v1.4.0,1.6.0",
    },
    expectedOutputs: {
      "next-version": "v1.6.1",
    },
  },
  {
    name: "Real world tags for next release version",
    inputs: {
      "release-type": "release",
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
      "all-tags": "1.0.0,1.2.0",
    },
    expectFailure: true,
  },
  {
    name: "Empty tags",
    inputs: {
      "release-type": "release",
      "all-tags": "",
    },
    expectFailure: true,
  },
  {
    name: "Invalid tags",
    inputs: {
      "release-type": "release",
      "all-tags": "foo,bar,1.x.0",
    },
    expectFailure: true,
  },
  {
    name: "Mixed valid and invalid tags",
    inputs: {
      "release-type": "release",
      "all-tags": "1.0.0,invalid-tag,v1.2.0,not-semver,v1.4.0",
    },
    expectFailure: true,
  },
  {
    name: "Alpha/beta version tags (semver format)",
    inputs: {
      "release-type": "release",
      "all-tags": "v1.0.0-beta.1,v1.0.0-alpha.8,v1.0.0-alpha.7",
    },
    expectedOutputs: {
      "next-version": "v1.0.0",
    },
  },
  {
    name: "Dev version tags (semver format)",
    inputs: {
      "release-type": "pre-release",
      "all-tags": "v1.0.0-dev.1,v1.0.0-dev.0,v0.0.1-dev.6",
    },
    expectedOutputs: {
      "next-version": "v1.1.0",
    },
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
