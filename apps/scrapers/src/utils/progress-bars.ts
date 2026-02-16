import cliProgress from 'cli-progress';

export function createMultiBar(): cliProgress.MultiBar {
  return new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      stopOnComplete: false,
      hideCursor: true,
      format: '{bar} | {percentage}% | ETA: {eta_formatted} | {value}/{total} | {title}'
    },
    cliProgress.Presets.shades_classic
  );
}

export interface OverallProgressTracker {
  addTotal: (amount: number, title?: string) => void;
  increment: (amount?: number, title?: string) => void;
}

export function createOverallProgress(multiBar: cliProgress.MultiBar): OverallProgressTracker {
  const bar = multiBar.create(1, 0, { title: 'Overall' });
  let total = 0;
  let value = 0;

  return {
    addTotal(amount: number, title = 'Overall') {
      total += Math.max(0, amount);
      bar.setTotal(Math.max(total, 1));
      bar.update(value, { title });
    },
    increment(amount = 1, title = 'Overall') {
      value += Math.max(0, amount);
      bar.update(value, { title });
    }
  };
}
