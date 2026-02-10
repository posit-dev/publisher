// Copyright (C) 2026 by Posit Software, PBC.

describe("clearupDeployments functionality", () => {
  const testProjectDir = "fastapi-simple";
  const excludedDir = "config-errors";

  before(() => {
    cy.resetConnect();
    cy.setAdminCredentials();
  });

  beforeEach(() => {
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
  });

  it("should cleanup deployments for a specific subdirectory", () => {
    // Create a deployment in the test project directory
    cy.log("Creating test deployment");
    cy.createPCSDeployment(
      testProjectDir,
      "fastapi-main.py",
      "Test Deployment",
      () => {},
    );

    // Verify .posit directory exists before cleanup
    cy.exec(`test -d content-workspace/${testProjectDir}/.posit`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      expect(result.code, "Deployment .posit directory should exist").to.equal(
        0,
      );
    });

    // Run clearupDeployments for specific subdirectory
    cy.log("Running clearupDeployments for specific subdirectory");
    cy.clearupDeployments(testProjectDir);

    // Verify .posit directory was removed
    cy.exec(`test -d content-workspace/${testProjectDir}/.posit`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      expect(
        result.code,
        "Deployment .posit directory should be removed",
      ).to.not.equal(0);
    });

    // Verify excluded directories are still intact
    cy.exec(`test -d content-workspace/${excludedDir}/.posit`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      expect(
        result.code,
        "Excluded directory .posit should still exist",
      ).to.equal(0);
    });

    // Verify in UI - deployments should be cleared
    cy.log("Verifying UI shows no deployments for test project");
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.expectInitialPublisherState();

    // Try to select deployment - should show only excluded directories
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // Verify the cleaned-up deployment is not in the list
    cy.get(".quick-input-widget")
      .find(".quick-input-list-row")
      .should(($rows) => {
        const text = $rows.text();
        expect(text).to.not.include(testProjectDir);
      });

    // Close the picker
    cy.get("body").type("{esc}");
  });

  it("should cleanup all deployments except excluded directories", () => {
    // Create multiple deployments
    cy.log("Creating test deployments in multiple directories");
    cy.createPCSDeployment(
      testProjectDir,
      "fastapi-main.py",
      "Test Deployment 1",
      () => {},
    );
    cy.createPCSDeployment(
      "static",
      "index.html",
      "Test Deployment 2",
      () => {},
    );

    // Verify .posit directories exist before cleanup
    cy.exec(`test -d content-workspace/${testProjectDir}/.posit`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      expect(result.code, "First deployment should exist").to.equal(0);
    });

    cy.exec(`test -d content-workspace/static/.posit`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      expect(result.code, "Second deployment should exist").to.equal(0);
    });

    // Run clearupDeployments without subdirectory (cleanup all)
    cy.log("Running clearupDeployments for all directories");
    cy.clearupDeployments();

    // Verify .posit directories were removed
    cy.exec(`test -d content-workspace/${testProjectDir}/.posit`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      expect(result.code, "First deployment should be removed").to.not.equal(0);
    });

    cy.exec(`test -d content-workspace/static/.posit`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      expect(result.code, "Second deployment should be removed").to.not.equal(
        0,
      );
    });

    // Verify excluded directories are still intact
    cy.exec(`test -d content-workspace/${excludedDir}/.posit`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      expect(result.code, "Excluded directory should still exist").to.equal(0);
    });

    // Verify in UI
    cy.log("Verifying UI shows only excluded deployments");
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.expectInitialPublisherState();

    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // Should only see excluded directory deployments
    cy.get(".quick-input-widget")
      .find(".quick-input-list-row")
      .should(($rows) => {
        const text = $rows.text();
        expect(text).to.not.include(testProjectDir);
        expect(text).to.not.include("static");
        // Should still have the error cases from config-errors
        expect(text).to.include("Error");
      });

    cy.get("body").type("{esc}");
  });

  it("should verify find command works correctly in CI environment", () => {
    // This test specifically checks if the find command used in clearupDeployments
    // works correctly. In CI, there might be permission or path issues.

    // Create a test deployment
    cy.log("Creating test deployment for find command verification");
    cy.createPCSDeployment(
      testProjectDir,
      "fastapi-main.py",
      "Find Test Deployment",
      () => {},
    );

    // Manually run the find command that clearupDeployments uses
    const excludePatterns = [excludedDir]
      .map((dir) => `-not -path "*/${dir}/*"`)
      .join(" ");
    const findCmd = `find content-workspace -type d -name ".posit" ${excludePatterns}`;

    cy.log(`Testing find command: ${findCmd}`);
    cy.exec(findCmd, { failOnNonZeroExit: false }).then((result) => {
      cy.log(`Find command result code: ${result.code}`);
      cy.log(`Find command stdout: ${result.stdout}`);
      cy.log(`Find command stderr: ${result.stderr}`);

      expect(result.code, "Find command should succeed").to.equal(0);
      expect(result.stdout, "Find should locate .posit directories").to.include(
        ".posit",
      );
      expect(
        result.stdout,
        "Find should not include excluded directories",
      ).to.not.include(excludedDir);

      // Count how many .posit directories were found
      const positDirs = result.stdout
        .split("\n")
        .filter((line) => line.includes(".posit"));
      cy.log(`Found ${positDirs.length} .posit directories`);
      expect(
        positDirs.length,
        "Should find at least one .posit directory",
      ).to.be.greaterThan(0);
    });

    // Now run the delete command
    cy.log("Testing delete command");
    cy.exec(`${findCmd} -exec rm -rf {} +`, { failOnNonZeroExit: false }).then(
      (result) => {
        cy.log(`Delete command result code: ${result.code}`);
        cy.log(`Delete command stderr: ${result.stderr}`);

        expect(result.code, "Delete command should succeed").to.equal(0);
      },
    );

    // Verify deletion worked
    cy.exec(`test -d content-workspace/${testProjectDir}/.posit`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      expect(
        result.code,
        "Deployment should be removed after find+delete",
      ).to.not.equal(0);
    });

    // Verify excluded directory still exists
    cy.exec(`test -d content-workspace/${excludedDir}/.posit`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      expect(
        result.code,
        "Excluded directory should still exist after find+delete",
      ).to.equal(0);
    });
  });

  it("should handle case when no deployments exist", () => {
    // First cleanup everything
    cy.log("Cleaning up all deployments");
    cy.clearupDeployments();

    // Run cleanup again - should not fail
    cy.log("Running clearupDeployments when no deployments exist");
    cy.clearupDeployments();

    // Verify we can still navigate UI normally
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.expectInitialPublisherState();
  });

  it("CI-specific: verify deployment cleanup in containerized environment", () => {
    // This test verifies cleanup works when running inside Docker (CI scenario)
    // Check if we're running in CI by looking for Docker
    cy.exec("docker ps", { failOnNonZeroExit: false }).then((dockerResult) => {
      if (dockerResult.code !== 0) {
        cy.log("Not running in CI environment, skipping CI-specific test");
        return;
      }

      cy.log("Running in CI environment, testing Docker-based cleanup");

      // Create a deployment
      cy.createPCSDeployment(
        testProjectDir,
        "fastapi-main.py",
        "CI Test Deployment",
        () => {},
      );

      // Verify deployment exists from inside container
      cy.exec(
        `docker exec publisher-e2e.code-server bash -c "test -d /home/coder/workspace/${testProjectDir}/.posit"`,
        { failOnNonZeroExit: false },
      ).then((result) => {
        expect(result.code, "Deployment should exist in container").to.equal(0);
      });

      // Run cleanup
      cy.clearupDeployments(testProjectDir);

      // Verify deployment was removed from inside container
      cy.exec(
        `docker exec publisher-e2e.code-server bash -c "test -d /home/coder/workspace/${testProjectDir}/.posit"`,
        { failOnNonZeroExit: false },
      ).then((result) => {
        expect(
          result.code,
          "Deployment should be removed from container",
        ).to.not.equal(0);
      });

      // Verify from host filesystem as well
      cy.exec(`test -d content-workspace/${testProjectDir}/.posit`, {
        failOnNonZeroExit: false,
      }).then((result) => {
        expect(
          result.code,
          "Deployment should be removed from host",
        ).to.not.equal(0);
      });
    });
  });

  afterEach(() => {
    // Clean up test deployments after each test
    cy.clearupDeployments(testProjectDir, [excludedDir]);
    cy.clearupDeployments("static", [excludedDir]);
  });
});
