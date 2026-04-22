import { PORTALS } from '@/lib/portals';
import { runScan } from '@/lib/run-scan';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
      };

      try {
        send({
          type: 'progress',
          stage: 'starting',
          message: 'Preparing scan...',
          totalPortals: PORTALS.length,
          completedPortals: 0,
          currentPortal: null,
          recentJobs: 0,
          expiredJobs: 0,
        });

        const result = await runScan({
          logPrefix: 'scrape',
          onPortalStart: (portal, index, total) => {
            send({
              type: 'progress',
              stage: 'scanning',
              message: `Scanning ${portal.name} (${index + 1}/${total})`,
              totalPortals: total,
              completedPortals: index,
              currentPortal: portal.name,
              recentJobs: 0,
              expiredJobs: 0,
            });
          },
          onPortalComplete: ({ portal, index, total, jobsPublishedToday, totalNewJobsFound }) => {
            send({
              type: 'progress',
              stage: 'scanning',
              message: `Finished ${portal.name} (${index + 1}/${total}) — ${jobsPublishedToday} job${jobsPublishedToday === 1 ? '' : 's'} posted today`,
              totalPortals: total,
              completedPortals: index + 1,
              currentPortal: portal.name,
              recentJobs: totalNewJobsFound,
              expiredJobs: 0,
            });
          },
          onFinishing: ({ newJobs, expiredJobs }) => {
            send({
              type: 'progress',
              stage: 'finishing',
              message: 'Finalizing scan results...',
              totalPortals: PORTALS.length,
              completedPortals: PORTALS.length,
              currentPortal: null,
              recentJobs: newJobs,
              expiredJobs,
            });
          },
        });

        send({
          type: 'complete',
          scraped: result.scraped,
          newJobs: result.newJobs,
          expired: result.expired,
        });
      } catch (err) {
        send({ type: 'error', error: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
