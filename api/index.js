import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import { put, get } from "@vercel/blob";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = "IGAARWboxCWU1BZAE5ZARWNQVElEREE0OG1WaVRZAZAGFaNmxGMFdMQTRKOGtEeXg4bkVFeFNDdnFwLTU5aW50LW5FQ2dmZAWZAGT25xV2hRSV81c3o2NXAtZAXRvRHhydGJQXzN6WDA0SUFKRVlZAS3JCdnhuaExpejI0c3hhT3dWOVZAsWQZDZD";
const VERIFY_TOKEN = "my_custom_verify_token";

// 🔵 إعدادات فيسبوك
const FACEBOOK_PAGE_ID = "225597157303578";
const FACEBOOK_PAGE_ACCESS_TOKEN = "EAAHa6OnUvf8BPP19ybvnvZB6VeiT7jW4MBDD32Rbz0HkREd7x9h7V3H9Vca2ECbTwmZBOBQskVr1IiZCNJXRZBZBPUuXZB9I8WZAf5FapAcvFUxRT12WAgH6X708qwSSkjjR5PqShfFX7yvWJfYrfg3mYZCGX4F43fRqu7v2JWedHooNJmwBGpoyLZCMkmbYq6tvTnO2VSbMZD";


const USERS_FILE = "users_followers.txt"; // ملف تخزين المستخدمين

// ======= دوال التخزين =======
async function getStoredUsers() {
  try {
    const { data } = await get(USERS_FILE);
    const content = await data.text();
    return content ? content.split(",") : [];
  } catch (err) {
    console.error("❌ خطأ في جلب المستخدمين:", err.message);
    return [];
  }
}

async function storeUserId(userId) {
  try {
    const storedUsers = await getStoredUsers();
    if (!storedUsers.includes(userId)) {
      storedUsers.push(userId);
      const content = storedUsers.join(",");
      await put(USERS_FILE, content, { access: "public" });
      console.log("✅ تم تخزين ID المستخدم:", userId);
    }
  } catch (err) {
    console.error("❌ خطأ في تخزين ID:", err.message);
  }
}

// ======= Webhook GET =======
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// ======= Webhook POST =======
app.post("/webhook", async (req, res) => {
  if (req.body.object !== "instagram") return res.sendStatus(404);

  console.log("📦 Payload:", JSON.stringify(req.body, null, 2));

  const storedUsers = await getStoredUsers();

  req.body.entry.forEach((entry) => {
    if (!entry.messaging) return;

    entry.messaging.forEach(async (event) => {
      const senderId = event.sender?.id;
      if (!senderId) return;

      // تحقق من المستخدم
      if (!storedUsers.includes(senderId)) {
        if (event.message?.text?.toLowerCase() === "تم") {
          await storeUserId(senderId);
          await sendReply(senderId, "✅ شكراً! يمكنك الآن إرسال ريلز للتحميل.");
          return;
        } else {
          await sendReply(senderId, "📌 المرجو متابعة الحساب أولا ثم إرسال 'تم'");
          return;
        }
      }

      // رسالة نصية
      if (event.message?.text) {
        await sendGenericTemplate(senderId);
        return;
      }

      // مرفقات
      if (event.message?.attachments) {
        let reelFound = false;
        for (const attachment of event.message.attachments) {
          if (attachment.type === "ig_reel" && attachment.payload?.url) {
            reelFound = true;
            await sendReply(senderId, "⏳ يتم تحميل ريلز...");
            try {
              const reelUrl = attachment.payload.url;
              await sendInstagramReel(senderId, reelUrl);
              await sendReply(senderId, "✅ تم تحميل الريلز بنجاح");
            } catch (err) {
              await sendReply(senderId, "❌ وقع خطأ أثناء تحميل الريلز.");
            }
            return;
          }
        }
        if (!reelFound) {
          await sendReply(senderId, "🚨 المرفق غير مدعوم. يُرجى إرسال مقطع ريلز فقط.");
        }
      }
    });
  });

  res.sendStatus(200);
});

// ======= دوال الإرسال =======
async function sendReply(recipientId, messageText) {
  try {
    await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: { text: messageText },
        messaging_type: "RESPONSE",
      }
    );
  } catch (err) {
    console.error("❌ فشل في إرسال الرسالة:", err.response?.data || err.message);
  }
}

async function sendGenericTemplate(recipientId) {
  try {
    await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [
                {
                  title: "BOT REELS 🔮",
                  image_url:
                    "https://tse3.mm.bing.net/th/id/OIP.iXKBvwJYAyDkvJ6el5JcnQHaEK?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
                  subtitle:
                    "افضل بوت لي تحميل ريلز انستغرام بي ضغطت زر واحدة ",
                  default_action: {
                    type: "web_url",
                    url: "https://www.instagram.com/am_mo111_25_",
                  },
                  buttons: [
                    {
                      type: "web_url",
                      url: "https://www.instagram.com/am_mo111_25_/reel/DLij9OfIjfj/",
                      title: "شرح البوت 🎈",
                    },
                    {
                      type: "web_url",
                      url: "https://www.instagram.com/li9ama_simo",
                      title: "مطور البوت 🎴",
                    },
                    {
                      type: "web_url",
                      url: "https://whatsapp.com/channel/0029VbAgby79sBICj1Eg7h0h",
                      title: "📞 WhatsApp Channel",
                    },
                  ],
                },
              ],
            },
          },
        },
        messaging_type: "RESPONSE",
      }
    );
    console.log("✅ تم إرسال القالب بنجاح.");
  } catch (err) {
    console.error("❌ خطأ في إرسال القالب:", err.response?.data || err.message);
  }
}

async function sendInstagramReel(senderId, url) {
  try {
    const sendResponse = await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        messaging_type: "RESPONSE",
        recipient: { id: senderId },
        message: {
          attachment: {
            type: "video",
            payload: { url: url },
          },
        },
      }
    );

    if (sendResponse.status === 200) {
      console.log("✅ تم إرسال الفيديو بنجاح.");
      await postVideoToFacebook(
        url,
        "📥 لي تحميل رليز بدون تطبيق قوم بي تجربات https://instagram.com/am_mo111_25_"
      );
    } else {
      console.log("❌ فشل في إرسال الفيديو.");
      await sendReply(senderId, "❌ حدث خطأ أثناء محاولة إرسال الفيديو.");
    }
  } catch (error) {
    console.error("❌ خطأ في إرسال الفيديو:", error.message);
    await sendReply(senderId, "❌ وقع خطأ أثناء محاولة إرسال الفيديو. حاول مرة أخرى.");
  }
}

// ======= نشر الفيديو على فيسبوك =======
async function postVideoToFacebook(videoUrl, caption = "📲 فيديو تم تحميله تلقائياً") {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${FACEBOOK_PAGE_ID}/videos`,
      new URLSearchParams({
        file_url: videoUrl,
        description: caption,
        access_token: FACEBOOK_PAGE_ACCESS_TOKEN,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (response.data?.id) {
      console.log("✅ تم نشر الفيديو على الصفحة بنجاح. Video ID:", response.data.id);
    } else {
      console.log("⚠️ تم إرسال الطلب ولكن ما تمش النشر.");
    }
  } catch (err) {
    console.error("❌ خطأ أثناء نشر الفيديو على صفحة فيسبوك:", err.response?.data || err.message);
  }
}

// ======= تشغيل السيرفر =======
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Instagram bot running...");
});
