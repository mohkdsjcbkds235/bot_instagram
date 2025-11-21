const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = "IGAAKBNjRZBjsNBZAFJhTXdTN1VnVk5jSXZAwN0xFRlRHVFFqYjFlRjk2c3RxaHNsdjhDa25sUGowS0JKSTVWUjRpNHY1SWtjQmplVno2UmRFSFo1WnlvU1RZAWWpJSzVMbDBDSDFSYTN0ZAUNUNy1NYWF3aWp0QldfT2hONjRKRGpnVQZDZD";
const VERIFY_TOKEN = "my_custom_verify";

// 🔵 إعدادات فيسبوك
const FACEBOOK_PAGE_ID = "225597157303578";
const FACEBOOK_PAGE_ACCESS_TOKEN = "EAAHa6OnUvf8BPTNccoszJ4xxXlwZAY3qGaN8yLWRHCrL7hmctM6mM6NWbu5LIFtQPcQU9jCNsi1prFp9DIlwSVbNSzZAxLeafXjVDZAUvZCea0Tu8Nzx897JyJT4mCm4wDJTIvcqICplk7ZBeUAQzsgLZBAbxce4ZCXK5dJpfrCy7mtNVZA5NfJw8B7ZAEiO7DYEWvjuFL7AZD";

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

app.post('/webhook', async (req, res) => {
  console.log("📦 Payload:", JSON.stringify(req.body, null, 2));

  if (req.body.object === 'instagram') {
    req.body.entry.forEach(entry => {
      if (entry.messaging) {
        entry.messaging.forEach(async (event) => {
          const senderId = event.sender && event.sender.id;
          const messageId = event.message && event.message.mid;

          if (!senderId) return;

          if (event.message && event.message.text) {
            await sendGenericTemplate(senderId);
            return;
          }

          if (event.message && event.message.attachments) {
            let reelFound = false;

            for (const attachment of event.message.attachments) {
              if (attachment.type === 'ig_reel' && attachment.payload && attachment.payload.url) {
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
          } else {
            await sendReply(senderId, "📩 يُرجى إرسال مقطع ريلز ليتم تحميله.");
          }
        });
      }
    });

    return res.sendStatus(200);
  }

  res.sendStatus(404);
});

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
      // 🆕 النشر على صفحة فيسبوك
      await postVideoToFacebook(url, "📥 لي تحميل رليز بدون تطبيق قوم بي تجربات https://instagram.com/am_mo111_25_ ");
    } else {
      console.log("❌ فشل في إرسال الفيديو.");
      await sendReply(senderId, "❌ حدث خطأ أثناء محاولة إرسال الفيديو.");
    }
  } catch (error) {
    console.error("❌ خطأ في إرسال الفيديو:", error.message);
    await sendReply(senderId, "❌ وقع خطأ أثناء محاولة إرسال الفيديو. حاول مرة أخرى.");
  }
}

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

// 🆕 دالة نشر الفيديو على فيسبوك
async function postVideoToFacebook(videoUrl, caption = "📲 فيديو تم تحميله تلقائياً") {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${FACEBOOK_PAGE_ID}/videos`,
      new URLSearchParams({
        file_url: videoUrl,
        description: caption,
        access_token: FACEBOOK_PAGE_ACCESS_TOKEN
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (response.data && response.data.id) {
      console.log("✅ تم نشر الفيديو على الصفحة بنجاح. Video ID:", response.data.id);
    } else {
      console.log("⚠️ تم إرسال الطلب ولكن ما تمش النشر.");
    }
  } catch (err) {
    console.error("❌ خطأ أثناء نشر الفيديو على صفحة فيسبوك:", err.response ? err.response.data : err.message);
  }
}

app.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Instagram bot running...');
});
