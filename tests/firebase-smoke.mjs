import { firebaseConfig, firebaseDataRoot } from "../firebase-config.js";

const requiredFields = ["apiKey", "databaseURL", "projectId"];
const missingFields = requiredFields.filter((field) => !firebaseConfig[field]);

if (missingFields.length) {
  throw new Error(`Firebase 尚未完成設定：缺少 ${missingFields.join(", ")}`);
}

const roomCode = `SMOKE_${Date.now()}`;
const databaseUrl = firebaseConfig.databaseURL.replace(/\/$/, "");
if (!firebaseDataRoot) {
  throw new Error("Firebase 尚未完成設定：缺少 firebaseDataRoot");
}

const roomUrl = `${databaseUrl}/${firebaseDataRoot}/${roomCode}.json`;
let idToken = null;
let roomWasCreated = false;

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  const data = body ? JSON.parse(body) : null;
  if (!response.ok) {
    throw new Error(`Firebase smoke test 失敗（HTTP ${response.status}）：${data?.error?.message || data?.error || "未知錯誤"}`);
  }
  return data;
}

try {
  const auth = await requestJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true })
    }
  );
  idToken = auth.idToken;

  const testState = {
    version: 1,
    status: "lobby",
    smokeTest: true,
    createdAt: Date.now()
  };
  await requestJson(`${roomUrl}?auth=${encodeURIComponent(idToken)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(testState)
  });
  roomWasCreated = true;

  const savedState = await requestJson(`${roomUrl}?auth=${encodeURIComponent(idToken)}`);
  if (!savedState?.smokeTest || savedState.status !== "lobby") {
    throw new Error("Firebase smoke test 失敗：讀回資料與寫入內容不一致");
  }

  console.log("Firebase smoke test 通過：匿名登入、房間寫入與跨連線讀取均正常。");
} finally {
  if (idToken && roomWasCreated) {
    await requestJson(`${roomUrl}?auth=${encodeURIComponent(idToken)}`, { method: "DELETE" });
    const cleanedState = await requestJson(`${roomUrl}?auth=${encodeURIComponent(idToken)}`);
    if (cleanedState !== null) {
      throw new Error("Firebase smoke test 清理失敗：測試房間仍然存在");
    }
  }
  if (idToken) {
    await requestJson(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken })
      }
    );
  }
}
