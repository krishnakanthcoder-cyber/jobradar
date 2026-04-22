export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { default: cron } = await import('node-cron');
  const { runScan } = await import('./lib/run-scan');

  const run = () =>
    runScan({ logPrefix: 'scheduler' }).catch((err) =>
      console.error('[scheduler] scan failed:', err)
    );

  // Run once at startup, then every 20 minutes
  void run();
  cron.schedule('*/20 * * * *', () => void run());

  console.log('[scheduler] started — scanning every 20 minutes');
}
