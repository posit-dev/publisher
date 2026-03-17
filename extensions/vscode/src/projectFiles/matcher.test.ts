// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { MatchList, STANDARD_EXCLUSIONS } from "./matcher";

type TestCase = {
  pattern: string;
  path: string;
  matches: boolean;
  inverted: boolean;
};

const PROJECT_DIR = "/project";

function runTestCases(cases: TestCase[]) {
  for (const tc of cases) {
    const patterns = tc.pattern.split("\n");
    const matchList = new MatchList(PROJECT_DIR, patterns);

    const isDir = tc.path.endsWith("/");
    const absPath = PROJECT_DIR + "/" + tc.path.replace(/\/$/, "");

    const m = matchList.match(absPath, isDir);

    if (tc.matches) {
      expect(
        m,
        `pattern "${tc.pattern}" should have matched path "${tc.path}"`,
      ).not.toBeNull();

      if (tc.inverted) {
        expect(
          m!.exclude,
          `pattern match should have been inverted: "${tc.pattern}" with "${tc.path}"`,
        ).toBe(true);
      } else {
        expect(
          m!.exclude,
          `pattern match should not have been inverted: "${tc.pattern}" with "${tc.path}"`,
        ).toBe(false);
      }
    } else {
      expect(
        m,
        `pattern "${tc.pattern}" should not have matched path "${tc.path}"`,
      ).toBeNull();
    }
  }
}

describe("MatchList", () => {
  describe("file patterns", () => {
    test("exact filename matches at any depth", () => {
      runTestCases([
        { pattern: "app.py", path: "app.py", matches: true, inverted: false },
        {
          pattern: "app.py",
          path: "dir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "app.py",
          path: "dir/subdir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "app.py",
          path: "foo.py",
          matches: false,
          inverted: false,
        },
      ]);
    });

    test("rooted pattern matches only at root", () => {
      runTestCases([
        {
          pattern: "/app.py",
          path: "app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "/app.py",
          path: "dir/app.py",
          matches: false,
          inverted: false,
        },
        {
          pattern: "/app.py",
          path: "dir/subdir/app.py",
          matches: false,
          inverted: false,
        },
      ]);
    });

    test("wildcard * matches within filename", () => {
      runTestCases([
        { pattern: "*.py", path: "app.py", matches: true, inverted: false },
        {
          pattern: "*.py",
          path: "dir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "*.py",
          path: "dir/subdir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "*.py",
          path: "app.json",
          matches: false,
          inverted: false,
        },
      ]);
    });

    test("dir/file patterns are rooted", () => {
      runTestCases([
        {
          pattern: "dir/app.py",
          path: "dir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "dir/app.py",
          path: "app.py",
          matches: false,
          inverted: false,
        },
        {
          pattern: "dir/app.py",
          path: "dir/subdir/app.py",
          matches: false,
          inverted: false,
        },
        {
          pattern: "dir/app.py",
          path: "subdir/dir/app.py",
          matches: false,
          inverted: false,
        },
      ]);
    });

    test("** prefix matches in all directories", () => {
      runTestCases([
        {
          pattern: "**/app.py",
          path: "dir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "**/app.py",
          path: "app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "**/app.py",
          path: "dir/subdir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "**/app.py",
          path: "dir/foo.py",
          matches: false,
          inverted: false,
        },
      ]);
    });

    test("mid-pattern ** matches zero or more directories", () => {
      runTestCases([
        {
          pattern: "dir/**/app.py",
          path: "dir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "dir/**/app.py",
          path: "app.py",
          matches: false,
          inverted: false,
        },
        {
          pattern: "dir/**/app.py",
          path: "dir/subdir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "dir/**/app.py",
          path: "subdir/dir/app.py",
          matches: false,
          inverted: false,
        },
      ]);
    });
  });

  describe("directory patterns", () => {
    test("trailing slash matches directories and their contents", () => {
      runTestCases([
        { pattern: "dir/", path: "dir", matches: false, inverted: false },
        { pattern: "dir/", path: "dir/", matches: true, inverted: false },
        {
          pattern: "dir/",
          path: "dir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "dir/",
          path: "dir/subdir/",
          matches: true,
          inverted: false,
        },
        {
          pattern: "dir/",
          path: "subdir/dir/",
          matches: true,
          inverted: false,
        },
        { pattern: "dir/", path: "foo/", matches: false, inverted: false },
      ]);
    });

    test("rooted directory pattern", () => {
      runTestCases([
        { pattern: "/dir/", path: "dir/", matches: true, inverted: false },
        {
          pattern: "/dir/",
          path: "dir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "/dir/",
          path: "subdir/dir/",
          matches: false,
          inverted: false,
        },
      ]);
    });

    test("dir name without slash matches both files and directories", () => {
      runTestCases([
        { pattern: "dir", path: "dir/", matches: true, inverted: false },
        {
          pattern: "dir",
          path: "dir/app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "dir",
          path: "subdir/dir/",
          matches: true,
          inverted: false,
        },
      ]);
    });
  });

  describe("inverted patterns", () => {
    test("! prefix negates the pattern", () => {
      runTestCases([
        {
          pattern: "app.py\n!app.py",
          path: "app.py",
          matches: true,
          inverted: true,
        },
        {
          pattern: "!app.py\napp.py",
          path: "app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "*.py\n!app.py",
          path: "app.py",
          matches: true,
          inverted: true,
        },
        {
          pattern: "app.py\n!app.py\napp.py",
          path: "app.py",
          matches: true,
          inverted: false,
        },
        {
          pattern: "app.py\napp.py\n!app.py",
          path: "app.py",
          matches: true,
          inverted: true,
        },
      ]);
    });
  });

  describe("special lines", () => {
    test("blank lines and comments are ignored", () => {
      runTestCases([
        { pattern: "", path: "", matches: false, inverted: false },
        { pattern: "#abc", path: "#abc", matches: false, inverted: false },
      ]);
    });

    test("escaped special chars", () => {
      runTestCases([
        {
          pattern: "\\#abc",
          path: "#abc",
          matches: true,
          inverted: false,
        },
        {
          pattern: "abc\n\\!abc",
          path: "!abc",
          matches: true,
          inverted: false,
        },
      ]);
    });
  });

  describe("addFromFile", () => {
    test("file patterns are inserted before builtins", () => {
      const matchList = new MatchList(PROJECT_DIR, ["!*.log"]);
      matchList.addFromFile(
        PROJECT_DIR,
        "/project/.posit/publish/config.toml",
        ["*.py"],
      );

      // *.py from the file should match
      const pyMatch = matchList.match(PROJECT_DIR + "/app.py", false);
      expect(pyMatch).not.toBeNull();
      expect(pyMatch!.exclude).toBe(false);

      // *.log from builtins should still exclude (builtins are last)
      const logMatch = matchList.match(PROJECT_DIR + "/debug.log", false);
      expect(logMatch).not.toBeNull();
      expect(logMatch!.exclude).toBe(true);
    });
  });

  describe("STANDARD_EXCLUSIONS", () => {
    test("standard exclusions list is populated", () => {
      expect(STANDARD_EXCLUSIONS.length).toBeGreaterThan(0);
      expect(STANDARD_EXCLUSIONS).toContain("!.git/");
      expect(STANDARD_EXCLUSIONS).toContain("!node_modules/");
      expect(STANDARD_EXCLUSIONS).toContain("!__pycache__/");
    });
  });
});
