const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = "IGAARWboxCWU1BZAE5ZARWNQVElEREE0OG1WaVRZAZAGFaNmxGMFdMQTRKOGtEeXg4bkVFeFNDdnFwLTU5aW50LW5FQ2dmZAWZAGT25xV2hRSV81c3o2NXAtZAXRvRHhydGJQXzN6WDA0SUFKRVlZAS3JCdnhuaExpejI0c3hhT3dWOVZAsWQZDZD"; // عوّضها بالتوكن ديالك
const VERIFY_TOKEN = "my_custom_verify_token"; // عوّضها بالتوكن ديالك


// تحميل وحفظ قائمة المستخدمين المؤكدين
const filePath = './confirmedUsers.json';

function loadConfirmedUsers() {
  try {
    const data = fs.readFileSync(filePath);
    return new Set(JSON.parse(data));
  } catch (error) {
    console.error("❌ خطأ في قراءة ملف المستخدمين:", error);
    return new Set();
  }
}

function saveConfirmedUsers(set) {
  try {
    const array = Array.from(set);
    fs.writeFileSync(filePath, JSON.stringify(array, null, 2));
  } catch (error) {
    console.error("❌ خطأ في حفظ ملف المستخدمين:", error);
  }
}

const confirmedUsers = loadConfirmedUsers();

// التحقق من Webhook
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// استقبال رسائل Instagram
// استقبال رسائل Instagram
app.post('/webhook', async (req, res) => {
  console.log("📦 Payload:", JSON.stringify(req.body, null, 2));

  if (req.body.object === 'instagram') {
    req.body.entry.forEach(entry => {
      if (entry.messaging) {
        entry.messaging.forEach(async (event) => {
          const senderId = event.sender && event.sender.id;
          const messageId = event.message && event.message.mid;

          if (!senderId) return;

          // معالجة رسالة نصية
          if (event.message && event.message.text) {
            const userMessage = event.message.text.trim().toLowerCase();

            if (userMessage === "تم") {
              confirmedUsers.add(senderId);
              saveConfirmedUsers(confirmedUsers);
              await sendReply(senderId, "✅ شكراً على المتابعة! الآن يمكنك إرسال ريلز لتحميله.");
              return;
            }

            // إرسال قالب Generic عند إرسال أي رسالة غير الريلز
            await sendGenericTemplate(senderId);
            return;
          }

          // معالجة مرفقات
          if (event.message && event.message.attachments) {
            let reelFound = false;

            for (const attachment of event.message.attachments) {
              if (attachment.type === 'ig_reel' && attachment.payload && attachment.payload.url) {
                reelFound = true;

                if (!confirmedUsers.has(senderId)) {
                  await sendFollowRequest(senderId);
                  await sendReply(senderId, "📢 بعد المتابعة، أرسل كلمة 'تم' لمتابعة تحميل الريلز.");
                  return;
                }

                await sendReaction(senderId, messageId, "📥");
                await sendReply(senderId, "⏳ يتم تحميل ريلز...");

                try {
                  const reelUrl = attachment.payload.url;
                  await sendInstagramReel(senderId, reelUrl);
                  await sendReply(senderId, "تم تحميل الريلز بنجاح 📥");
                } catch (err) {
                  await sendReply(senderId, "❌ وقع خطأ أثناء تحميل الريلز.");
                }

                return;
              }
            }

            if (!reelFound) {
              await sendReaction(senderId, messageId, "❌");
              await sendReply(senderId, "🚨 المرفق غير مدعوم. يُرجى إرسال مقطع ريلز فقط.");
            }
          } else {
            await sendReaction(senderId, messageId, "❌");
            await sendReply(senderId, "📩 يُرجى إرسال مقطع ريلز ليتم تحميله.");
          }
        });
      }
    });

    return res.sendStatus(200);
  }

  res.sendStatus(404);
});

// إرسال قالب Generic
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
                  image_url: "https://tse3.mm.bing.net/th/id/OIP.iXKBvwJYAyDkvJ6el5JcnQHaEK?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
                  subtitle: "افضل بوت لي تحميل ريلز انستغرام بي ضغطت زر واحدة ",
                  default_action: {
                    type: "web_url",
                    url: "https://www.instagram.com/am_mo111_25_"
                  },
                  buttons: [
                    {
                      type: "web_url",
                      url: "https://www.instagram.com/am_mo111_25_/reel/DLij9OfIjfj/",
                      title: "شرح البوت 🎈"
                    },
                    {
                       type: "web_url",
                      url: "https://www.instagram.com/li9ama_simo",
                      title: "مطور البوت 🎴"
                    },
                    {
                       type: "web_url",
                      url: "https://whatsapp.com/channel/0029VbAgby79sBICj1Eg7h0h",
                      title: "📞 WhatsApp Channel"
                    }
                  ]
                }
              ]
            }
          }
        },
        messaging_type: "RESPONSE"
      }
    );

    console.log("✅ تم إرسال القالب بنجاح.");
  } catch (err) {
    console.error(
      "❌ خطأ في إرسال القالب:",
      err.response ? err.response.data : err.message
    );
  }
}


// إرسال فيديو
async function sendInstagramReel(senderId, url) {
  try {
    const sendResponse = await axios.post(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      messaging_type: "RESPONSE",
      recipient: { id: senderId },
      message: {
        attachment: {
          type: "video",
          payload: { url: url }
        }
      }
    });

    if (sendResponse.status === 200) {
      console.log("✅ تم إرسال الفيديو بنجاح.");
    } else {
      console.log("❌ فشل في إرسال الفيديو.");
      await sendReply(senderId, "❌ حدث خطأ أثناء محاولة إرسال الفيديو.");
    }
  } catch (error) {
    console.error("❌ خطأ في إرسال الفيديو:", error.message);
    await sendReply(senderId, "❌ وقع خطأ أثناء محاولة إرسال الفيديو. حاول مرة أخرى.");
  }
}

// إرسال رسالة نصية
async function sendReply(recipientId, messageText) {
  try {
    await axios.post(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: recipientId },
      message: { text: messageText },
      messaging_type: "RESPONSE"
    });
  } catch (err) {
    console.error("❌ فشل في إرسال الرسالة:", err.response ? err.response.data : err.message);
  }
}
//SDSS
async function sendReaction(recipientId, messageId, reaction = "love") {
  try {
    await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      new URLSearchParams({
        recipient: JSON.stringify({ id: recipientId }),
        sender_action: "react",
        payload: JSON.stringify({
          message_id: messageId,
          reaction: reaction
        })
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log(`📌 Reaction "${reaction}" تم إرساله بنجاح.`);
  } catch (err) {
    console.error(
      "❌ خطأ في إرسال التفاعل:",
      err.response ? err.response.data : err.message
    );
  }
}




// إرسال زر متابعة
async function sendFollowRequest(recipientId) {
  try {
    await axios.post(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "🚫 قبل استخدام البوت، يرجى متابعة حسابنا على إنستغرام لمواصلة الخدمة.",
            buttons: [
              {
                type: "web_url",
                url: "https://www.instagram.com/am_mo111_25_/", // 🔗 ضع رابط حسابك هنا
                title: "🔔 متابعة الحساب"
              }
            ]
          }
        }
      }
    });
  } catch (err) {
    console.error("❌ خطأ في إرسال زر المتابعة:", err.response ? err.response.data : err.message);
  }
}

app.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Instagram bot running...');
});
