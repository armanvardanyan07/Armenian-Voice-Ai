import assert from "node:assert/strict";
import test from "node:test";

import {
  SILENCE_TIMEOUT_MS,
  calculateRms,
  createSilenceDetectorState,
  updateSilenceDetector,
} from "../app/components/silence-detector.ts";

test("calculates normalized RMS for silence and a strong signal", () => {
  assert.equal(calculateRms(new Uint8Array([128, 128, 128, 128])), 0);
  assert.ok(calculateRms(new Uint8Array([0, 255, 0, 255])) > 0.9);
});

test("does not auto-stop before speech is detected", () => {
  const initial = createSilenceDetectorState();
  const result = updateSilenceDetector(initial, 0, SILENCE_TIMEOUT_MS + 500);

  assert.equal(result.shouldStop, false);
  assert.deepEqual(result.state, initial);
});

test("auto-stops only after 1.5 seconds of silence following speech", () => {
  const heard = updateSilenceDetector(createSilenceDetectorState(), 0.08, 100);
  const silenceStarted = updateSilenceDetector(heard.state, 0.005, 300);
  const tooEarly = updateSilenceDetector(silenceStarted.state, 0.005, 1799);
  const ready = updateSilenceDetector(tooEarly.state, 0.005, 1800);

  assert.equal(heard.state.heardSpeech, true);
  assert.equal(tooEarly.shouldStop, false);
  assert.equal(ready.shouldStop, true);
});

test("new speech resets the silence countdown", () => {
  const heard = updateSilenceDetector(createSilenceDetectorState(), 0.08, 100);
  const firstSilence = updateSilenceDetector(heard.state, 0.005, 300);
  const resumed = updateSilenceDetector(firstSilence.state, 0.07, 1200);
  const secondSilence = updateSilenceDetector(resumed.state, 0.005, 1500);
  const result = updateSilenceDetector(secondSilence.state, 0.005, 2999);

  assert.equal(resumed.state.silentSince, null);
  assert.equal(result.shouldStop, false);
});
