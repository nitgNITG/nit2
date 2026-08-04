#!/usr/bin/env node
'use strict';

const { createHmac } = require('crypto');
const https = require('https');

// ── JWT ──────────────────────────────────────────────────────────────────────
const SECRET = process.env.SITE_JWT_SECRET;
const b64 = s => Buffer.from(s).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const h   = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const p   = b64(JSON.stringify({ id: '6507a1b2c3d4e5f678901234', iat: Math.floor(Date.now() / 1000) }));
const sig = createHmac('sha256', SECRET).update(h + '.' + p).digest('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const JWT = `${h}.${p}.${sig}`;

// ── Topic rotation ───────────────────────────────────────────────────────────
const TOPICS = [
  { ar: 'كيفية إنشاء متجر إلكتروني ناجح في مصر والخليج',       service: 'ecommerce'  },
  { ar: 'أفضل نظام نقاط بيع POS للمطاعم في مصر 2025',          service: 'restaurant' },
  { ar: 'تطوير تطبيق iOS لشركتك: دليل شامل',                   service: 'ios'        },
  { ar: 'منصة Moodle للشركات: التعليم الإلكتروني للموظفين',     service: 'moodle'     },
  { ar: 'كيف تختار شركة برمجة تطبيقات موثوقة في مصر',          service: 'custom'     },
  { ar: 'تطوير تطبيق Android بـ Flutter: مزايا وتكاليف 2025',  service: 'android'    },
  { ar: 'برامج الولاء الرقمية: كيف تضاعف مبيعاتك',             service: 'loyalty'    },
  { ar: 'أنظمة إدارة التوصيل: كيف تبني fleet management',       service: 'delivery'   },
  { ar: 'التعليم الإلكتروني في السعودية: الفرص والتحديات',      service: 'moodle'     },
  { ar: 'تطبيق مطعم متكامل: من الطلب حتى التوصيل',             service: 'restaurant' },
  { ar: 'كيف تبني منصة B2B للتجارة الإلكترونية',               service: 'ecommerce'  },
  { ar: 'تصميم تجربة المستخدم UX لتطبيقات الجوال العربية',     service: 'custom'     },
  { ar: 'الفرق بين تطبيق native وFlutter وReact Native',        service: 'android'    },
  { ar: 'كيف تنجح في سوق التجارة الإلكترونية الخليجي 2025',    service: 'ecommerce'  },
];

const override = process.env.TOPIC_OVERRIDE?.trim();
let topicAr, topicService;
if (override) {
  topicAr      = override;
  topicService = 'custom';
} else {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const chosen    = TOPICS[dayOfYear % TOPICS.length];
  topicAr         = chosen.ar;
  topicService    = chosen.service;
}

console.log('Topic:', topicAr);

// ── Helpers ──────────────────────────────────────────────────────────────────
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Call Claude API ──────────────────────────────────────────────────────────
async function callClaude(prompt) {
  const body = JSON.stringify({
    model: 'claude-opus-4-5',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });
  const res = await httpsRequest({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  }, body);

  const json = JSON.parse(res.body);
  if (!json.content?.[0]?.text) throw new Error('Empty Claude response: ' + res.body);
  return json.content[0].text;
}

// ── Build article prompt ─────────────────────────────────────────────────────
function buildPrompt(topic) {
  return [
    'أنت كاتب محتوى SEO متخصص لشركة N.I.T Egypt لتطوير البرمجيات.',
    '',
    'اكتب مقالة SEO احترافية عن: "' + topic + '"',
    '',
    'أعد JSON فقط بدون أي نص خارجه، بهذا الشكل بالضبط:',
    '```json',
    '{',
    '  "title": "عنوان المقالة بالعربي 60-70 حرف يحتوي الكلمة المفتاحية",',
    '  "titleEn": "Article title in English 60-70 chars with keyword",',
    '  "metaDesc": "وصف ميتا بالعربي 140-155 حرف مع الكلمة المفتاحية ودعوة للتصرف",',
    '  "metaDescEn": "Meta description in English 140-155 chars with keyword and CTA",',
    '  "content": "فقرة افتتاحية بالعربي 100-150 كلمة تشرح المشكلة",',
    '  "contentEn": "Opening paragraph in English 100-150 words explaining the problem",',
    '  "slug": "arabic-slug-with-hyphens-no-special-chars",',
    '  "sections": [',
    '    {',
    '      "title": "عنوان القسم الأول",',
    '      "titleEn": "Section 1 Title",',
    '      "content": "محتوى القسم 80-120 كلمة",',
    '      "contentEn": "Section content 80-120 words",',
    '      "list": [',
    '        { "title": "نقطة 1", "titleEn": "Point 1", "content": "شرح 2-3 جمل", "contentEn": "Explanation 2-3 sentences" },',
    '        { "title": "نقطة 2", "titleEn": "Point 2", "content": "شرح 2-3 جمل", "contentEn": "Explanation 2-3 sentences" },',
    '        { "title": "نقطة 3", "titleEn": "Point 3", "content": "شرح 2-3 جمل", "contentEn": "Explanation 2-3 sentences" }',
    '      ]',
    '    },',
    '    {',
    '      "title": "عنوان القسم الثاني",',
    '      "titleEn": "Section 2 Title",',
    '      "content": "محتوى القسم 80-120 كلمة",',
    '      "contentEn": "Section content 80-120 words",',
    '      "list": [',
    '        { "title": "نقطة 1", "titleEn": "Point 1", "content": "شرح 2-3 جمل", "contentEn": "Explanation 2-3 sentences" },',
    '        { "title": "نقطة 2", "titleEn": "Point 2", "content": "شرح 2-3 جمل", "contentEn": "Explanation 2-3 sentences" }',
    '      ]',
    '    },',
    '    {',
    '      "title": "لماذا تختار N.I.T Egypt؟",',
    '      "titleEn": "Why Choose N.I.T Egypt?",',
    '      "content": "شركة N.I.T Egypt تأسست 2013 ولديها خبرة 12 سنة في تطوير البرمجيات لمصر والخليج. نفذنا أكثر من 150 مشروعاً ناجحاً.",',
    '      "contentEn": "N.I.T Egypt founded 2013, 12+ years experience, 150+ projects for Egypt and Gulf clients.",',
    '      "list": [',
    '        { "title": "خبرة 12 سنة", "titleEn": "12 Years Experience", "content": "منذ 2013 ونحن نطور حلولاً برمجية متكاملة للشركات والمؤسسات في مصر والخليج.", "contentEn": "Since 2013 delivering integrated software solutions for businesses across Egypt and the Gulf." },',
    '        { "title": "دعم ما بعد التسليم", "titleEn": "Post-Delivery Support", "content": "ضمان سنة كاملة مع دعم فني مستمر وتحديثات دورية.", "contentEn": "Full year warranty with continuous support and periodic updates." },',
    '        { "title": "تقنيات حديثة", "titleEn": "Modern Technologies", "content": "Flutter وReact وNext.js وNode.js وMoodle — أحدث التقنيات لمشروعك.", "contentEn": "Flutter, React, Next.js, Node.js, Moodle — latest tech for your project." }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '```',
    '',
    'قواعد: الـ slug بالعربي مع hyphens فقط. JSON valid تماماً. لا نص خارج الـ JSON.',
  ].join('\n');
}

// ── Build SVG cover image ────────────────────────────────────────────────────
function buildSvgBase64(titleEn, service) {
  const colors = {
    ecommerce: '#1a3a5c', moodle: '#1a4a3a', restaurant: '#3a1a1a',
    delivery: '#2a1a3a', loyalty: '#3a2a1a', ios: '#1a1a4a',
    android: '#1a3a1a', custom: '#0B2923',
  };
  const bg   = colors[service] || '#0B2923';
  const safe = (titleEn || '').slice(0, 45).replace(/&/g, 'and').replace(/[<>"]/g, '');
  const svg  = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="#0B2923"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect x="0" y="0" width="8" height="630" fill="#1DDB9E"/>
    <text x="80" y="120" font-size="36" fill="#1DDB9E" font-family="sans-serif" font-weight="bold">NIT</text>
    <text x="80" y="160" font-size="18" fill="#aaaaaa" font-family="sans-serif">N.I.T Egypt - nitg-eg.com</text>
    <text x="80" y="310" font-size="40" fill="#ffffff" font-family="sans-serif" font-weight="bold">${safe}</text>
    <rect x="80" y="370" width="120" height="4" fill="#1DDB9E" rx="2"/>
    <text x="80" y="540" font-size="22" fill="#888888" font-family="sans-serif">nitg-eg.com | 2025</text>
  </svg>`;
  return Buffer.from(svg).toString('base64');
}

// ── POST multipart form ──────────────────────────────────────────────────────
function buildMultipart(fields, fileField, fileBase64, filename, mimeType) {
  const boundary = 'Boundary' + Date.now().toString(16);
  const CRLF     = '\r\n';
  const parts    = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}${CRLF}`,
      `Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}`,
      value,
      CRLF,
    );
  }

  // File part
  const fileBuf = Buffer.from(fileBase64, 'base64');
  parts.push(
    `--${boundary}${CRLF}`,
    `Content-Disposition: form-data; name="${fileField}"; filename="${filename}"${CRLF}`,
    `Content-Type: ${mimeType}${CRLF}${CRLF}`,
  );

  const bodyBuf = Buffer.concat([
    Buffer.from(parts.join('')),
    fileBuf,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
  ]);

  return { bodyBuf, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function postMultipart(path, fields, fileField, fileBase64, filename, mime) {
  const { bodyBuf, contentType } = buildMultipart(fields, fileField, fileBase64, filename, mime);
  return httpsRequest({
    hostname: 'www.nitg-eg.com',
    path,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${JWT}`,
      'Content-Type': contentType,
      'Content-Length': bodyBuf.length,
    },
  }, bodyBuf);
}

// ── Send Telegram notification ───────────────────────────────────────────────
async function sendTelegram(message) {
  const text = encodeURIComponent(message);
  const path = `/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage` +
    `?chat_id=${process.env.TELEGRAM_CHAT_ID}&text=${text}&parse_mode=Markdown`;
  const res = await httpsRequest({ hostname: 'api.telegram.org', path, method: 'GET' });
  console.log('Telegram:', res.status);
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    // 1. Generate article with Claude
    const raw   = await callClaude(buildPrompt(topicAr));

    // Extract JSON — strip markdown fences first, then fall back to brace matching
    let jsonStr;
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    } else {
      // Find outermost { ... } by tracking depth
      let start = raw.indexOf('{');
      if (start === -1) throw new Error('No JSON found in Claude response:\n' + raw.slice(0, 500));
      let depth = 0, end = -1;
      for (let i = start; i < raw.length; i++) {
        if (raw[i] === '{') depth++;
        else if (raw[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end === -1) throw new Error('Unclosed JSON in Claude response');
      jsonStr = raw.slice(start, end + 1);
    }

    let article;
    try {
      article = JSON.parse(jsonStr);
    } catch (parseErr) {
      throw new Error(`JSON parse failed: ${parseErr.message}\nRaw snippet: ${jsonStr.slice(10200, 10500)}`);
    }
    console.log('Generated:', article.title);

    // 2. Build cover image
    const imgBase64 = buildSvgBase64(article.titleEn, topicService);

    // 3. POST article
    const artRes = await postMultipart(
      '/api/blog/article',
      {
        title:      article.title,
        titleEn:    article.titleEn,
        content:    article.content,
        contentEn:  article.contentEn,
        metaDesc:   article.metaDesc,
        metaDescEn: article.metaDescEn,
        slug:       article.slug,
      },
      'img', imgBase64, 'cover.svg', 'image/svg+xml',
    );

    if (artRes.status !== 201 && artRes.status !== 200) {
      throw new Error(`API error ${artRes.status}: ${artRes.body}`);
    }

    const articleId   = JSON.parse(artRes.body).article?.id;
    const articleSlug = article.slug || articleId;
    console.log('Posted article id:', articleId, 'slug:', articleSlug);

    // 4. POST sections
    if (articleId && Array.isArray(article.sections)) {
      for (const sec of article.sections) {
        const secRes = await postMultipart(
          `/api/blog/article/${articleId}/section`,
          {
            title:      sec.title,
            titleEn:    sec.titleEn || sec.title,
            content:    sec.content || '',
            contentEn:  sec.contentEn || sec.content || '',
            list:       JSON.stringify(sec.list || []),
          },
          'img', imgBase64, 'cover.svg', 'image/svg+xml',
        );
        console.log('Section posted:', sec.title, secRes.status);
      }
    }

    // 5. Revalidate Next.js cache
    const revalBody = JSON.stringify({ slug: articleSlug });
    const revalRes = await httpsRequest({
      hostname: 'www.nitg-eg.com',
      path: '/api/revalidate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(revalBody),
        'x-revalidate-secret': process.env.SITE_JWT_SECRET,
      },
    }, revalBody);
    console.log('Revalidate:', revalRes.status, revalRes.body);

    // 6. Telegram notification
    const url  = `https://www.nitg-eg.com/ar/blog/${articleSlug}`;
    const time = new Date().toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo' });
    await sendTelegram(
      `✅ *مقالة جديدة نُشرت*\n\n` +
      `📌 *${article.title}*\n\n` +
      `🔗 ${url}\n\n` +
      `🕘 نُشرت الساعة ${time}`
    );

    console.log('Done!');
  } catch (err) {
    console.error('FAILED:', err.message);
    // Notify on failure too
    await sendTelegram(`❌ *فشل نشر المقالة*\n\n\`${err.message.slice(0, 200)}\``).catch(() => {});
    process.exit(1);
  }
})();
