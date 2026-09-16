// 複製 Firebase Web App 的公開設定到 firebase-config.js；不要提交服務帳戶 JSON 或後端金鑰。
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 若與既有活動共用資料庫，請指定已獲授權且不會與其他遊戲衝突的專屬資料路徑。
export const firebaseDataRoot = "mooncake-feast-race/rooms";
