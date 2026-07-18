export function scheduleDelayedRefresh(
  refresh: () => Promise<void>,
  onError: (error: unknown) => void,
  delayMs = 800
) {
  window.setTimeout(() => {
    void refresh().catch(onError)
  }, delayMs)
}
