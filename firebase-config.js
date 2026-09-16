// 沿用既有活動站的 Firebase 專案；遊戲資料以 mooncake-feast-race 專屬子樹隔離。
export const firebaseConfig = {
  apiKey: "AIzaSyAMTeFnVOUMmkdI-GoqPAKD4jaBAn_vvsQ",
  authDomain: "dragon-boat-race.firebaseapp.com",
  databaseURL: "https://dragon-boat-race-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dragon-boat-race",
  storageBucket: "dragon-boat-race.firebasestorage.app",
  messagingSenderId: "1065539430564",
  appId: "1:1065539430564:web:2bf7ac93a20007b4845e31"
};

// 沿用提水遊戲已部署的認證規則，月餅房間集中在專屬子樹，不與提水房號混用。
export const firebaseDataRoot = "water-splash-race/rooms/mooncake-feast-race";
