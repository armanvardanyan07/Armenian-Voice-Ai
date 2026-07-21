export const SILENCE_TIMEOUT_MS = 1500;
export const SPEECH_THRESHOLD = 0.035;

export type SilenceDetectorState = {
  heardSpeech: boolean;
  silentSince: number | null;
};

export type SilenceDetectorUpdate = {
  state: SilenceDetectorState;
  shouldStop: boolean;
};

export function createSilenceDetectorState(): SilenceDetectorState {
  return {
    heardSpeech: false,
    silentSince: null,
  };
}

export function calculateRms(samples: Uint8Array): number {
  if (samples.length === 0) {
    return 0;
  }

  let sumOfSquares = 0;

  for (const sample of samples) {
    const normalizedSample = (sample - 128) / 128;
    sumOfSquares += normalizedSample * normalizedSample;
  }

  return Math.sqrt(sumOfSquares / samples.length);
}

export function updateSilenceDetector(
  state: SilenceDetectorState,
  rms: number,
  now: number,
  threshold = SPEECH_THRESHOLD,
): SilenceDetectorUpdate {
  if (rms >= threshold) {
    return {
      state: {
        heardSpeech: true,
        silentSince: null,
      },
      shouldStop: false,
    };
  }

  if (!state.heardSpeech) {
    return {
      state,
      shouldStop: false,
    };
  }

  const silentSince = state.silentSince ?? now;

  return {
    state: {
      heardSpeech: true,
      silentSince,
    },
    shouldStop: now - silentSince >= SILENCE_TIMEOUT_MS,
  };
}
