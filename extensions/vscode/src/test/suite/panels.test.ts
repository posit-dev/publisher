// Copyright (C) 2024 by Posit Software, PBC.

import * as assert from "assert";

import { createContentSecurityPolicyContent } from "../../panels";

suite("toContentSecurityPolicyContent", () => {
  test("url injection", async () => {
    const url1 = "url1";
    const url2 = "url2";
    const nonce = "nonce";
    const res = createContentSecurityPolicyContent(nonce, url1, url2);
    console.log(res);
    assert.equal(
      res,
      "default-src 'none'; connect-src url1 url2 https:; font-src url1 url2 https:; frame-src url1 url2 https:; script-src nonce-nonce url1 url2 https:; style-src url1 url2 https:;",
    );
  });
});
