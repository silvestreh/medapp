import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTIONS, EVENTS, STATUS, type CallBackProps, type Step } from 'react-joyride';

import { useTour } from './tour-provider';

const START_DELAY_MS = 500;

interface UseSectionTourReturn {
  steps: Step[];
  run: boolean;
  stepIndex: number;
  handleCallback: (data: CallBackProps) => void;
}

export function useSectionTour(tourId: string, steps: Step[]): UseSectionTourReturn {
  const { activeTourId, startTour, completeTour, isTourCompleted } = useTour();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const hasAutoStarted = useRef(false);

  // Auto-start on first visit (only once per mount)
  useEffect(() => {
    if (hasAutoStarted.current) return;
    if (isTourCompleted(tourId)) return;
    if (steps.length === 0) return;

    const timer = setTimeout(() => {
      hasAutoStarted.current = true;
      startTour(tourId);
    }, START_DELAY_MS);

    return () => clearTimeout(timer);
  }, [tourId, steps.length, isTourCompleted, startTour]);

  // Sync run state with activeTourId
  useEffect(() => {
    if (activeTourId === tourId) {
      setStepIndex(0);
      setRun(true);
    } else {
      setRun(false);
    }
  }, [activeTourId, tourId]);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status, action, type, index } = data;

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        setRun(false);
        completeTour(tourId);
        return;
      }

      // If a step's target is missing, Joyride fires TARGET_NOT_FOUND.
      // If it's the last step, complete the tour instead of getting stuck.
      if (type === EVENTS.TARGET_NOT_FOUND && index >= steps.length - 1) {
        setRun(false);
        completeTour(tourId);
        return;
      }

      // Skip missing targets by advancing to the next step
      if (type === EVENTS.TARGET_NOT_FOUND) {
        setStepIndex(index + 1);
        return;
      }

      if (type === EVENTS.STEP_AFTER) {
        const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
        // If we've moved past the last step, complete the tour
        if (nextIndex >= steps.length) {
          setRun(false);
          completeTour(tourId);
          return;
        }
        setStepIndex(nextIndex);
      }
    },
    [tourId, completeTour, steps.length],
  );

  return { steps, run, stepIndex, handleCallback };
}
