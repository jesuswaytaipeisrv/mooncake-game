/**
 * 只重試 Firebase 的暫時性網路錯誤；設定與權限錯誤必須立即顯示，不能被重試掩蓋。
 */
export async function retryFirebaseNetwork(operation, options = {}) {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => window.setTimeout(resolve, delayMs)));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error?.code !== "auth/network-request-failed" || attempt === attempts) throw error;
      await sleep(baseDelayMs * attempt);
    }
  }

  throw new Error("Firebase network retry exhausted unexpectedly");
}
