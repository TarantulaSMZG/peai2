/**
 * Executes a pool of promise-returning tasks with a specific concurrency limit.
 * This prevents overwhelming APIs or the browser with too many simultaneous requests.
 *
 * @param items The array of items to process.
 * @param task The async function to execute for each item. It receives the item and its index.
 * @param concurrency The maximum number of tasks to run at the same time.
 * @param callbacks An optional object for progress and result callbacks.
 * @returns A promise that resolves to an array of results in the same order as the input items.
 */
export async function promisePool<T, U>(
    items: T[],
    task: (item: T, index: number) => Promise<U>,
    concurrency: number,
    callbacks?: {
        onProgress?: (progress: { completed: number; total: number }) => void;
        onResult?: (result: U) => void;
    }
): Promise<U[]> {
    const results: U[] = new Array(items.length);
    let completed = 0;
    let index = 0;
    const total = items.length;

    const worker = async () => {
        while (index < total) {
            const currentIndex = index++;
            if (currentIndex >= total) break;

            const item = items[currentIndex];
            
            try {
                const result = await task(item, currentIndex);
                results[currentIndex] = result;
                if (callbacks?.onResult) {
                    callbacks.onResult(result);
                }
            } catch (e) {
                // Propagate the error to cause Promise.all to reject, stopping all workers.
                throw e;
            }
            
            completed++;
            if (callbacks?.onProgress) {
                callbacks.onProgress({ completed, total });
            }
        }
    };

    const workers = Array(concurrency).fill(null).map(worker);
    
    // This will wait for all workers to complete their assigned tasks.
    // If any worker's promise rejects, Promise.all will immediately reject.
    await Promise.all(workers);

    return results;
}

/**
 * Dynamically loads a script into the document head.
 * Ensures that the same script is not loaded multiple times.
 * @param src The URL of the script to load.
 * @returns A promise that resolves when the script has loaded, or rejects on error.
 */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script load error for ${src}`));
    
    document.head.appendChild(script);
  });
}
