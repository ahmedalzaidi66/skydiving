/**
 * Wraps a promise with a configurable timeout.
 * Throws a timeout error if the promise doesn't settle within ms.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Request timed out. Please check your connection and try again.'));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/**
 * Wraps a Supabase query builder's promise to add a timeout.
 * Usage: await withQueryTimeout(supabase.from('x').select('*'))
 */
export async function withQueryTimeout<T>(
  query: PromiseLike<{ data: T | null; error: any }>,
  ms = 10000
): Promise<{ data: T | null; error: any }> {
  try {
    return await withTimeout(query as Promise<{ data: T | null; error: any }>, ms);
  } catch (e: any) {
    return { data: null, error: { message: e.message ?? 'Request timed out.' } };
  }
}
