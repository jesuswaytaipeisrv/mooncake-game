import test from "node:test";
import assert from "node:assert/strict";
import { retryFirebaseNetwork } from "../src/firebase-retry.js";

test("retries a transient Firebase Auth network failure", async () => {
  let calls = 0;
  const delays = [];
  const result = await retryFirebaseNetwork(async () => {
    calls += 1;
    if (calls < 3) throw Object.assign(new Error("temporary"), { code: "auth/network-request-failed" });
    return "connected";
  }, {
    attempts: 3,
    baseDelayMs: 100,
    sleep: async (delayMs) => { delays.push(delayMs); }
  });

  assert.equal(result, "connected");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [100, 200]);
});

test("does not retry configuration or permission errors", async () => {
  let calls = 0;
  await assert.rejects(
    retryFirebaseNetwork(async () => {
      calls += 1;
      throw Object.assign(new Error("denied"), { code: "auth/operation-not-allowed" });
    }, { sleep: async () => {} }),
    /denied/
  );
  assert.equal(calls, 1);
});
