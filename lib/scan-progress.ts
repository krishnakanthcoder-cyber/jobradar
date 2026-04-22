export interface ScanProgressState {
  running: boolean;
  stage: 'idle' | 'starting' | 'scanning' | 'finishing' | 'completed' | 'error';
  message: string;
  totalPortals: number;
  completedPortals: number;
  currentPortal: string | null;
  recentJobs: number;
  expiredJobs: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

const DEFAULT_STATE: ScanProgressState = {
  running: false,
  stage: 'idle',
  message: 'Idle',
  totalPortals: 0,
  completedPortals: 0,
  currentPortal: null,
  recentJobs: 0,
  expiredJobs: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
};

function getStore() {
  const globalScope = globalThis as typeof globalThis & {
    __jobradarScanProgress?: ScanProgressState;
  };

  if (!globalScope.__jobradarScanProgress) {
    globalScope.__jobradarScanProgress = { ...DEFAULT_STATE };
  }

  return globalScope;
}

export function getScanProgress(): ScanProgressState {
  return { ...getStore().__jobradarScanProgress! };
}

export function setScanProgress(
  patch: Partial<ScanProgressState>
): ScanProgressState {
  const store = getStore();
  store.__jobradarScanProgress = {
    ...store.__jobradarScanProgress!,
    ...patch,
  };

  return { ...store.__jobradarScanProgress };
}

export function startScanProgress(totalPortals: number): ScanProgressState {
  return setScanProgress({
    running: true,
    stage: 'starting',
    message: 'Preparing scan...',
    totalPortals,
    completedPortals: 0,
    currentPortal: null,
    recentJobs: 0,
    expiredJobs: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  });
}

export function resetScanProgress(): ScanProgressState {
  const store = getStore();
  store.__jobradarScanProgress = { ...DEFAULT_STATE };
  return { ...store.__jobradarScanProgress };
}
