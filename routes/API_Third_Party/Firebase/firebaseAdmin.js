const admin = require("firebase-admin");
const serviceAccount = require("../../../serviceAccountKey.json"); // Thay bằng đường dẫn file JSON Firebase

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const sendNotification = async (title, body, token) => {
  const message = {
    notification: { title, body },
    token,
  };

  try {
    await admin.messaging().send(message);
    console.log("✅ Thông báo đã được gửi!");
  } catch (error) {
    console.error("❌ Lỗi gửi thông báo:", error);
  }
};

const db = admin.firestore();

module.exports = { sendNotification };
