import { nextSlot, previousSlot } from './slots';

export interface SchedulerOptions {
  /** Run a scheduled pull. Rejections are reported to `onError`, never thrown. */
  run: () => Promise<unknown>;
  /** When the last successful pull finished, if ever. */
  lastSuccessAt: () => Promise<Date | undefined>;
  now?: () => Date;
  onError?: (err: unknown) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  log?: (message: string) => void;
}

export interface Scheduler {
  start(): Promise<void>;
  stop(): void;
}

/**
 * Fires `run` at each slot (see `SYNC_SLOTS`). On start, runs once at once when the latest slot
 * already passed without a successful pull (first start, or the server was down).
 */
export function createScheduler(options: SchedulerOptions): Scheduler {
  const now = options.now ?? (() => new Date());
  const onError = options.onError ?? (() => {});
  const setTimer =
    options.setTimer ??
    ((fn, ms) => {
      const handle = setTimeout(fn, ms);
      handle.unref();
      return handle;
    });
  const clearTimer =
    options.clearTimer ??
    ((h) => {
      clearTimeout(h as NodeJS.Timeout);
    });
  const log =
    options.log ??
    ((m) => {
      console.info(`[sync] ${m}`);
    });
  let timer: unknown;
  let stopped = true;

  const fire = async () => {
    try {
      await options.run();
    } catch (err) {
      onError(err);
    }
  };

  const arm = () => {
    if (stopped) return;
    const slot = nextSlot(now());
    log(`next scheduled pull at ${slot.toISOString()}`);
    const delay = Math.max(0, slot.getTime() - now().getTime());
    timer = setTimer(() => {
      void fire().finally(arm);
    }, delay);
  };

  return {
    async start() {
      if (!stopped) return;
      stopped = false;
      log('scheduler started');
      arm();
      try {
        const last = await options.lastSuccessAt();
        if (!last || last.getTime() < previousSlot(now()).getTime()) {
          log(`catch-up pull (last success ${last ? last.toISOString() : 'never'})`);
          // Not awaited: a catch-up pull can take minutes and must not block server startup.
          void fire();
        }
      } catch (err) {
        onError(err);
      }
    },
    stop() {
      stopped = true;
      if (timer !== undefined) clearTimer(timer);
      timer = undefined;
    },
  };
}
