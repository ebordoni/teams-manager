// Le scritture asincrone possono aver caricato ID del vecchio dataset prima
// di attendere un'API remota. Non consentire un ripristino nel frattempo.
let pendingWrites = 0;
export const hasPendingDataWrites = () => pendingWrites > 0;

export async function trackDataWrite<T>(operation: () => Promise<T>): Promise<T> {
  pendingWrites++;
  try { return await operation(); }
  finally { pendingWrites--; }
}
