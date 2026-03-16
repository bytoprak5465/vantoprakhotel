require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const db = require('./db');
try { db.cleanupOrphanedRoomData(); } catch (_) {}
try { db.syncGalleryFromAllSources(); } catch (_) {}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'otel-jwt-gizli-anahtar-degistirin';
const BASE_URL = (process.env.BASE_URL || '').trim() || 'http://localhost:' + (process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

[DATA_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Mail gönderimi: .env içinde MAIL_ENABLED=true yoksa KAPALI. Açmak için .env'e MAIL_ENABLED=true ekleyin.
const MAIL_ENABLED = process.env.MAIL_ENABLED === 'true' || process.env.MAIL_ENABLED === '1';

// Gmail SMTP ayarları (Railway ile uyumlu)
// Tercihen şu environment değişkenlerini kullanır:
// - SMTP_USER / SMTP_PASS (yeni isimler)
// - Aksi halde geriye dönük uyumluluk için MAIL_USER / MAIL_PASS
const SMTP_USER = process.env.SMTP_USER || process.env.MAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.MAIL_PASS;

const mailTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT || 587),
 secure: true,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

async function sendMail(to, subject, text) {
  if (!MAIL_ENABLED) {
    console.log('[MAIL] Disabled, skipping sendMail to', to);
    return;
  }
  if (!to || !subject || !text) return;

  await mailTransporter.sendMail({
    from: process.env.MAIL_FROM || SMTP_USER,
    to,
    subject,
    text
  });
}

async function sendReservationMailToGuest(reservation) {
  if (!reservation || !reservation.email) return;

  const settings = db.getSettings();
  const hotelName = (settings && settings.introTitle) ? settings.introTitle : 'Toprak Otel';
  const viewUrl = BASE_URL + '/rezervasyon-sorgula.html?no=' + encodeURIComponent(reservation.id) + '&email=' + encodeURIComponent(reservation.email);

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rezervasyon Onayı</title>
</head>
<body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color:#f5f1ea; color:#151515;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f1ea;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background:#fdfaf5; border-radius: 12px; box-shadow: 0 10px 40px rgba(36,24,8,0.12); border: 1px solid rgba(176,138,60,0.15);">
          <tr>
            <td style="padding: 32px 36px 24px; border-bottom: 2px solid #b08a3c; text-align: center;">
              <p style="margin:0 0 4px; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color:#b08a3c; font-weight: 600;">VAN</p>
              <h1 style="margin:0; font-size: 22px; font-weight: 600; letter-spacing: 0.08em; color:#151515;">${hotelName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 36px 20px;">
              <h2 style="margin:0 0 20px; font-size: 18px; font-weight: 600; color:#151515;">Rezervasyon Talebiniz Alındı</h2>
              <p style="margin:0 0 20px; font-size: 15px; line-height: 1.65; color:#6b6060;">Sayın <strong>${(reservation.guestName || 'Misafirimiz').replace(/</g, '&lt;')}</strong>,</p>
              <p style="margin:0 0 24px; font-size: 15px; line-height: 1.65; color:#6b6060;">Rezervasyon talebiniz kaydedilmiştir. Aşağıdaki bilgileri kontrol edebilir, rezervasyonunuzu görüntüleyip PDF voucher indirebilirsiniz.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid rgba(176,138,60,0.2); border-radius: 8px; margin-bottom: 24px;">
                <tr><td style="padding: 14px 18px; border-bottom: 1px solid rgba(176,138,60,0.12); font-size: 13px; color:#6b6060;"><strong style="color:#151515;">Rezervasyon No</strong></td><td style="padding: 14px 18px; border-bottom: 1px solid rgba(176,138,60,0.12); font-size: 13px; color:#151515;">${String(reservation.id).replace(/</g, '&lt;')}</td></tr>
                <tr><td style="padding: 14px 18px; border-bottom: 1px solid rgba(176,138,60,0.12); font-size: 13px; color:#6b6060;"><strong style="color:#151515;">Giriş</strong></td><td style="padding: 14px 18px; border-bottom: 1px solid rgba(176,138,60,0.12); font-size: 13px; color:#151515;">${String(reservation.checkIn || '').replace(/</g, '&lt;')}</td></tr>
                <tr><td style="padding: 14px 18px; border-bottom: 1px solid rgba(176,138,60,0.12); font-size: 13px; color:#6b6060;"><strong style="color:#151515;">Çıkış</strong></td><td style="padding: 14px 18px; border-bottom: 1px solid rgba(176,138,60,0.12); font-size: 13px; color:#151515;">${String(reservation.checkOut || '').replace(/</g, '&lt;')}</td></tr>
                <tr><td style="padding: 14px 18px; border-bottom: 1px solid rgba(176,138,60,0.12); font-size: 13px; color:#6b6060;"><strong style="color:#151515;">Oda</strong></td><td style="padding: 14px 18px; border-bottom: 1px solid rgba(176,138,60,0.12); font-size: 13px; color:#151515;">${String(reservation.roomName || reservation.roomId || '').replace(/</g, '&lt;')}</td></tr>
                <tr><td style="padding: 14px 18px; font-size: 13px; color:#6b6060;"><strong style="color:#151515;">Misafir sayısı</strong></td><td style="padding: 14px 18px; font-size: 13px; color:#151515;">${String(reservation.guests || '').replace(/</g, '&lt;')}</td></tr>
              </table>
              <p style="margin:0 0 24px; font-size: 14px; line-height: 1.6; color:#6b6060;">Rezervasyon detaylarınızı görüntülemek ve PDF voucher indirmek için aşağıdaki butona tıklayın.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #c9a227 0%, #b8860b 50%, #9a7200 100%); box-shadow: 0 4px 16px rgba(184,134,11,0.35);">
                    <a href="${viewUrl}" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 600; letter-spacing: 0.06em; color: #fff; text-decoration: none;">REZERVASYONU GÖRÜNTÜLE</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; font-size: 12px; color:#6b6060;">Link açılmazsa tarayıcınıza kopyalayın:<br><a href="${viewUrl}" style="color:#b08a3c; word-break: break-all;">${viewUrl}</a></p>
              <p style="margin: 20px 0 0; padding: 12px 16px; font-size: 13px; font-weight: 600; background: rgba(176,138,60,0.08); border-radius: 8px; color:#151515;">Evli olmayan müşteriler kabul edilmemektedir.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 36px 24px; border-top: 1px solid rgba(176,138,60,0.15); text-align: center;">
              <p style="margin:0; font-size: 11px; letter-spacing: 0.08em; color:#6b6060;">Bizi tercih ettiğiniz için teşekkür ederiz.</p>
              <p style="margin: 6px 0 0; font-size: 12px; font-weight: 600; color:#b08a3c;">${hotelName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await mailTransporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: reservation.email,
    subject: `${hotelName} – Rezervasyon Talebiniz (${reservation.id})`,
    html
  });
}

async function sendReservationMailToAdmin(reservation) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!reservation || !adminEmail) return;

  const settings = db.getSettings();
  const hotelName = (settings && settings.introTitle) ? settings.introTitle : 'Toprak Otel';

  const esc = (s) => String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yeni Rezervasyon</title>
</head>
<body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color:#f5f1ea; color:#151515;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f1ea;">
    <tr>
      <td align="center" style="padding: 32px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background:#fdfaf5; border-radius: 12px; box-shadow: 0 8px 32px rgba(36,24,8,0.1); border: 1px solid rgba(176,138,60,0.15);">
          <tr>
            <td style="padding: 24px 28px 20px; border-bottom: 2px solid #b08a3c;">
              <p style="margin:0 0 4px; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color:#b08a3c; font-weight: 600;">Yeni Rezervasyon</p>
              <h1 style="margin:0; font-size: 18px; font-weight: 600; letter-spacing: 0.04em; color:#151515;">${esc(hotelName)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 28px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px;">
                <tr><td style="padding: 10px 0 6px; color:#6b6060; width: 38%;"><strong style="color:#151515;">Rezervasyon No</strong></td><td style="padding: 10px 0 6px; color:#151515;">${esc(reservation.id)}</td></tr>
                <tr><td style="padding: 6px 0; color:#6b6060;"><strong style="color:#151515;">İsim</strong></td><td style="padding: 6px 0; color:#151515;">${esc(reservation.guestName)}</td></tr>
                <tr><td style="padding: 6px 0; color:#6b6060;"><strong style="color:#151515;">E-posta</strong></td><td style="padding: 6px 0;"><a href="mailto:${esc(reservation.email)}" style="color:#b08a3c; text-decoration: none;">${esc(reservation.email)}</a></td></tr>
                <tr><td style="padding: 6px 0; color:#6b6060;"><strong style="color:#151515;">Telefon</strong></td><td style="padding: 6px 0; color:#151515;">${esc(reservation.phone)}</td></tr>
                <tr><td style="padding: 6px 0; color:#6b6060;"><strong style="color:#151515;">Giriş / Çıkış</strong></td><td style="padding: 6px 0; color:#151515;">${esc(reservation.checkIn)} – ${esc(reservation.checkOut)}</td></tr>
                <tr><td style="padding: 6px 0; color:#6b6060;"><strong style="color:#151515;">Oda</strong></td><td style="padding: 6px 0; color:#151515;">${esc(reservation.roomName || reservation.roomId)}</td></tr>
                <tr><td style="padding: 6px 0; color:#6b6060;"><strong style="color:#151515;">Misafir sayısı</strong></td><td style="padding: 6px 0; color:#151515;">${esc(reservation.guests)}</td></tr>
                <tr><td style="padding: 10px 0 0; color:#6b6060;"><strong style="color:#151515;">Not</strong></td><td style="padding: 10px 0 0; color:#151515;">${esc(reservation.note) || '—'}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 28px 20px; border-top: 1px solid rgba(176,138,60,0.12); text-align: center;">
              <p style="margin:0; font-size: 11px; color:#6b6060;">Bu e-posta otomatik gönderilmiştir.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await mailTransporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: adminEmail,
    subject: `${hotelName} – Yeni Rezervasyon Talebi (${reservation.id})`,
    html
  });
}

const uploadsAbsolute = path.resolve(UPLOADS_DIR);
if (!fs.existsSync(uploadsAbsolute)) fs.mkdirSync(uploadsAbsolute, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsAbsolute),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'image').replace(/\s/g, '-').replace(/[^a-zA-Z0-9._-]/g, ''))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Uploads: önce dosya adıyla açık route (güvenli), sonra statik
app.get('/uploads/:filename', (req, res, next) => {
  const name = (req.params.filename || '').replace(/\.\./g, '');
  if (!name) return next();
  const filePath = path.resolve(UPLOADS_DIR, path.basename(name));
  if (!fs.existsSync(filePath)) return next();
  res.sendFile(filePath, { maxAge: '1d' }, (err) => { if (err) next(err); });
});
app.use('/uploads', express.static(UPLOADS_DIR));

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ ok: false, mesaj: 'Oturum gerekli.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    const admin = db.getAdminById(req.user.id);
    if (!admin) return res.status(401).json({ ok: false, mesaj: 'Oturum geçersiz.' });
    const lastActivity = admin.lastActivity ? new Date(admin.lastActivity).getTime() : 0;
    if (Date.now() - lastActivity > ACTIVITY_TIMEOUT_MS) {
      return res.status(401).json({ ok: false, mesaj: 'Oturum süresi doldu. 10 dakikadan fazla işlem yapılmadı.' });
    }
    req.user.role = admin.role;
    req.user.permissions = admin.role === 'super_admin' ? ['*'] : (Array.isArray(admin.permissions) ? admin.permissions : []);
    db.updateAdminActivity(req.user.id);
    next();
  } catch {
    res.status(401).json({ ok: false, mesaj: 'Geçersiz oturum.' });
  }
}

function superAdminOnly(req, res, next) {
  if (req.user.role !== 'super_admin') return res.status(403).json({ ok: false, mesaj: 'Yetkiniz yok.' });
  next();
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    const perms = req.user.permissions;
    if (Array.isArray(perms) && (perms.includes('*') || perms.includes(perm))) return next();
    res.status(403).json({ ok: false, mesaj: 'Bu alana erişim yetkiniz yok.' });
  };
}

// Favicon: tarayıcı otomatik ister; 204 ile 404 önlenir
app.get('/favicon.ico', (req, res) => res.status(204).end());

// --- Public API ---
app.get('/api/slider', (req, res) => {
  try { return res.json(db.getSlider()); } catch (e) { console.error('getSlider:', e); return res.status(500).json([]); }
});
// Slider resmini API ile sun (uploads path sorunlarını aşar)
app.get('/api/slider-image/:id', (req, res) => {
  try {
    const list = db.getSlider();
    const item = list.find(s => s.id === req.params.id);
    if (!item || !item.imageUrl || !String(item.imageUrl).trim()) return res.status(404).end();
    const filename = path.basename(String(item.imageUrl).replace(/\\/g, '/'));
    const filePath = path.join(uploadsAbsolute, filename);
    if (!fs.existsSync(filePath)) return res.status(404).end();
    return res.sendFile(filePath, { maxAge: '1d' });
  } catch (e) { return res.status(500).end(); }
});
app.get('/api/settings', (req, res) => {
  try { return res.json(db.getSettings()); } catch (e) { console.error('getSettings:', e); return res.status(500).json({}); }
});
app.get('/api/rooms', (req, res) => {
  const rooms = db.getRooms(true);
  const checkIn = req.query.checkIn;
  const checkOut = req.query.checkOut;
  if (checkIn && checkOut) {
    const list = rooms.map(r => {
      const avail = db.getRoomAvailabilityForRange(r.id, checkIn, checkOut);
      return { ...r, totalPrice: avail ? avail.totalPrice : null, availableCount: avail ? avail.availableCount : 0, nights: avail ? avail.nights : 0 };
    });
    return res.json(list);
  }
  res.json(rooms);
});
app.get('/api/rooms/:id', (req, res) => {
  const room = db.getRoomById(req.params.id);
  if (!room) return res.status(404).json({ ok: false });
  res.json(room);
});
app.get('/api/rooms/:id/price', (req, res) => {
  const room = db.getRoomById(req.params.id);
  if (!room) return res.status(404).json({ ok: false });
  const dateStr = req.query.date;
  if (dateStr) {
    const effective = db.getRoomEffectivePriceAndCapacity(req.params.id, dateStr);
    if (effective) return res.json(effective);
  }
  res.json({ price: room.price, capacity: room.capacity != null ? room.capacity : 2 });
});
app.get('/api/featured-rooms', (req, res) => {
  try {
    const settings = db.getSettings();
    let allRooms = db.getRooms(true);
    if (allRooms.length === 0) allRooms = db.getRooms(false);
    const featuredIds = settings.featuredRoomIds || [];
    let featured = featuredIds.length ? allRooms.filter(r => featuredIds.includes(r.id)) : allRooms.slice(0, 3);
    if (featured.length === 0 && allRooms.length > 0) featured = allRooms.slice(0, 3);
    return res.json(featured);
  } catch (e) { console.error('featured-rooms:', e); return res.status(500).json([]); }
});
app.get('/api/testimonials', (req, res) => {
  try { return res.json(db.getTestimonials()); } catch (e) { console.error('getTestimonials:', e); return res.status(500).json([]); }
});

app.get('/api/services', (req, res) => {
  try { return res.json(db.getServices()); } catch (e) { console.error('getServices:', e); return res.status(500).json([]); }
});
app.get('/api/gallery', (req, res) => {
  try {
    if (req.query.grouped === '1' || req.query.grouped === 'true') return res.json(db.getGalleryGrouped());
    if (req.query.home === '1' || req.query.home === 'true') return res.json(db.getGalleryForHome());
    return res.json(db.getGallery());
  } catch (e) { console.error('getGallery:', e); return res.status(500).json([]); }
});

app.get('/api/check-db', (req, res) => {
  try {
    const rooms = db.getRooms(true);
    const firstRoom = rooms[0];
    if (!firstRoom) return res.json({ ok: false, mesaj: 'Veritabanında oda yok. "npm run init" çalıştırın.' });
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const dates = db.getDatesInRange(today, tomorrow);
    const eff = firstRoom && db.getRoomEffectivePriceAndCapacity(firstRoom.id, today);
    res.json({ ok: true, mesaj: 'Veritabanı hazır.', odalar: rooms.length, testOda: firstRoom.id, tarihTest: !!eff });
  } catch (err) {
    const errStr = (err && err.message) || String(err);
    console.error('check-db hatası:', errStr);
    res.status(500).json({ ok: false, mesaj: 'Veritabanı hatası: ' + errStr });
  }
});

// Ana sayfa: veriyi HTML ile birlikte gönder (rezervasyon maili vb. aynen çalışır).
function serveHomePage(req, res, next) {
  try {
    const slider = db.getSlider();
    const settings = db.getSettings();
    let allRooms = db.getRooms(true);
    if (allRooms.length === 0) allRooms = db.getRooms(false);
    const featuredIds = settings.featuredRoomIds || [];
    let featured = featuredIds.length ? allRooms.filter(r => featuredIds.includes(r.id)) : allRooms.slice(0, 3);
    if (featured.length === 0 && allRooms.length > 0) featured = allRooms.slice(0, 3);
    const testimonials = db.getTestimonials();
    const gallery = db.getGalleryForHome ? db.getGalleryForHome() : db.getGallery();
    const services = db.getServices();
    const data = { slider, settings, featuredRooms: featured, testimonials, gallery, services };
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const script = '<script>window.__INITIAL_DATA=' + JSON.stringify(data).replace(/</g, '\\u003c') + ';</script>';
    html = html.replace('</body>', script + '\n</body>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    console.error('Ana sayfa veri enjeksiyonu:', e);
    next();
  }
}
app.get('/', serveHomePage);
app.get('/index.html', serveHomePage);

function serveGalleryPage(req, res, next) {
  try {
    const grouped = db.getGalleryGrouped();
    const htmlPath = path.join(__dirname, 'public', 'galeri.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const script = '<script>window.__GALLERY_GROUPED=' + JSON.stringify(grouped).replace(/</g, '\\u003c') + ';</script>';
    html = html.replace('</body>', script + '\n</body>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    console.error('Galeri sayfası veri enjeksiyonu:', e);
    next();
  }
}
app.get('/galeri.html', serveGalleryPage);

// Statik dosyalar (index.html, js, css vb.) API'dan sonra
app.use(express.static(path.join(__dirname, 'public')));

const ACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 dakika işlem yoksa oturum sonlanır

app.post('/api/reservations', (req, res) => {
  try {
    const { roomId, guestName, email, phone, checkIn, checkOut, guests, note, roomCount, adults, childrenUnder6, children6Plus, rooms: roomsArray } = req.body;
    const today = new Date().toISOString().slice(0, 10);
    if (!guestName || !email || !checkIn || !checkOut) {
      return res.status(400).json({ ok: false, mesaj: 'Zorunlu alanları doldurun.' });
    }
    if (checkIn < today) {
      return res.status(400).json({ ok: false, mesaj: 'Giriş tarihi geçmiş bir tarih olamaz.' });
    }
    const numGuests = Math.max(1, parseInt(guests, 10) || 1);
    const basePayload = { guestName, email, phone: phone || '', checkIn, checkOut, guests: numGuests, note: note || '', adults: adults != null ? parseInt(adults, 10) : null, childrenUnder6: childrenUnder6 != null ? parseInt(childrenUnder6, 10) : null, children6Plus: children6Plus != null ? parseInt(children6Plus, 10) : null };

    if (Array.isArray(roomsArray) && roomsArray.length > 0) {
      const groupId = 'g' + Date.now().toString();
      const stayDates = db.getDatesInRange(checkIn, checkOut);
      const stayNights = stayDates.length > 1 ? stayDates.slice(0, -1) : stayDates;
      let lineIndex = 0;
      for (const line of roomsArray) {
        const rid = line.roomId || line.room_id;
        const qty = Math.max(1, parseInt(line.quantity != null ? line.quantity : line.roomCount, 10) || 1);
        if (!rid) continue;
        const room = db.getRoomById(rid);
        if (!room) return res.status(400).json({ ok: false, mesaj: 'Seçilen odalardan biri bulunamadı.' });
        const cap = room.capacity != null ? room.capacity : 2;
        if (cap * qty < 1) return res.status(400).json({ ok: false, mesaj: 'Oda kapasitesi geçersiz.' });
        for (const dateStr of stayNights) {
          const eff = db.getRoomEffectivePriceAndCapacity(rid, dateStr);
          if (!eff || eff.open === 0) return res.status(400).json({ ok: false, mesaj: 'Seçilen tarihlerde "' + (room.name || rid) + '" satışa kapalı.' });
          const booked = db.getRoomBookedCountByDate(rid, dateStr);
          const availableRooms = Math.max(0, (eff.capacity || 0) - booked);
          if (availableRooms < qty) return res.status(400).json({ ok: false, mesaj: 'Seçilen tarihlerde "' + (room.name || rid) + '" için yeterli oda müsait değil.' });
        }
        const newItem = {
          id: groupId + '-' + String(lineIndex++),
          ...basePayload,
          roomId: rid,
          roomCount: qty,
          status: 'beklemede',
          createdAt: new Date().toISOString(),
          reservationGroupId: groupId
        };
        db.insertReservation(newItem);
      }
      return res.status(201).json({ ok: true, id: groupId, mesaj: 'Rezervasyon talebiniz alındı.' });
    }

    const singleRoomId = roomId;
    if (!singleRoomId) return res.status(400).json({ ok: false, mesaj: 'Oda seçimi gerekli.' });
    const room = db.getRoomById(singleRoomId);
    if (!room) return res.status(400).json({ ok: false, mesaj: 'Seçilen oda bulunamadı.' });
    const numRooms = Math.max(1, parseInt(roomCount, 10) || 1);
    const peoplePerRoom = room.capacity != null ? room.capacity : 2;
    if (peoplePerRoom * numRooms < numGuests) {
      return res.status(400).json({ ok: false, mesaj: 'Seçilen oda sayısı ve kapasite misafir sayısına yetmiyor.' });
    }
    var stayDates = db.getDatesInRange(checkIn, checkOut);
    if (stayDates.length > 1) stayDates = stayDates.slice(0, -1);
    for (const dateStr of stayDates) {
      const eff = db.getRoomEffectivePriceAndCapacity(singleRoomId, dateStr);
      if (!eff || eff.open === 0) {
        return res.status(400).json({ ok: false, mesaj: 'Seçilen tarihlerde oda satışa kapalı.' });
      }
      const booked = db.getRoomBookedCountByDate(singleRoomId, dateStr);
      const availableRooms = Math.max(0, (eff.capacity || 0) - booked);
      if (availableRooms < numRooms) {
        return res.status(400).json({ ok: false, mesaj: 'Seçilen tarihlerde yeterli oda müsait değil (en az ' + numRooms + ' oda gerekli).' });
      }
    }
    const newItem = {
      id: Date.now().toString(),
      ...basePayload,
      roomId: singleRoomId,
      roomCount: numRooms,
      status: 'beklemede',
      createdAt: new Date().toISOString()
    };
    db.insertReservation(newItem);

    // Rezervasyon mail'leri sadece MAIL_ENABLED=true ise gönderilir
    if (MAIL_ENABLED) {
      sendReservationMailToGuest(newItem).catch(err => {
        console.error('Müşteri maili gönderilemedi:', err && err.message ? err.message : err);
      });
      sendReservationMailToAdmin(newItem).catch(err => {
        console.error('Admin maili gönderilemedi:', err && err.message ? err.message : err);
      });
    }

    res.status(201).json({ ok: true, id: newItem.id, mesaj: 'Rezervasyon talebiniz alındı.' });
  } catch (err) {
    var errStr = (err && (typeof err.message === 'string' ? err.message : String(err))) || '';
    if (!errStr && err) errStr = Object.prototype.toString.call(err);
    console.error('Rezervasyon hatası:', errStr || err);
    var kullaniciMesaj;
    if (errStr && (errStr.includes('FOREIGN KEY') || errStr.includes('SQLITE_CONSTRAINT'))) {
      kullaniciMesaj = 'Seçilen oda artık mevcut olmayabilir. Rezervasyon sayfasından tekrar oda seçin.';
    } else if (errStr && errStr.includes('locked')) {
      kullaniciMesaj = 'Veritabanı şu an kullanımda. Kısa süre sonra tekrar deneyin.';
    } else if (errStr && errStr.includes('no such column')) {
      kullaniciMesaj = 'Veritabanı sürümü uyumsuz. Proje klasöründe "npm run init" çalıştırın veya data klasöründeki otel.db dosyasını silip sunucuyu yeniden başlatın.';
    } else {
      kullaniciMesaj = errStr ? ('Rezervasyon kaydedilemedi. Hata: ' + errStr.slice(0, 200)) : 'Rezervasyon kaydedilemedi. Veritabanı hatası. Lütfen "npm run init" çalıştırın veya data/otel.db dosyasını silip sunucuyu yeniden başlatın.';
    }
    res.status(500).json({ ok: false, mesaj: kullaniciMesaj, detail: errStr ? errStr.slice(0, 300) : null });
  }
});

app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ ok: false, mesaj: 'Ad, e-posta ve mesaj zorunludur.' });
  res.json({ ok: true, mesaj: 'Mesajınız alındı.' });
});

app.post('/api/complaints', (req, res) => {
  const { fullName, phone, title, description, reservationNo } = req.body;
  if (!fullName || !title) return res.status(400).json({ ok: false, mesaj: 'Ad soyad ve şikayet başlığı zorunludur.' });
  db.insertComplaint({
    fullName: String(fullName).trim(),
    phone: String(phone || '').trim(),
    title: String(title).trim(),
    description: String(description || '').trim(),
    reservationNo: String(reservationNo || '').trim()
  });
  res.json({ ok: true, mesaj: 'Şikayet veya öneriniz alındı. En kısa sürede değerlendirilecektir.' });
});

// --- Public: Rezervasyon sorgulama / PDF / iptal (e-posta ile doğrulama) ---
function normalizeEmail(s) {
  return (s || '').trim().toLowerCase();
}
function getReservationPublic(id, email) {
  let r = db.getReservationById(id);
  let groupList = [];
  if (!r && id && /^g\d+/.test(String(id).trim())) {
    groupList = db.getReservationsByGroupId(String(id).trim());
    r = groupList[0] || null;
  }
  if (!r) return null;
  if (email && normalizeEmail(r.email) !== normalizeEmail(email)) return null;
  const room = db.getRoomById(r.roomId);
  const roomName = room ? room.name : r.roomId;
  const avail = db.getRoomAvailabilityForRange(r.roomId, r.checkIn, r.checkOut);
  const totalPrice = avail && avail.nights ? (avail.totalPrice || 0) * (r.roomCount || 1) : null;
  const nights = avail ? avail.nights : 0;
  const displayId = r.reservationGroupId || r.id;
  let status = r.status;
  if (groupList.length > 1) {
    const anyOnayli = groupList.some(x => x.status === 'onaylandi');
    const allIptal = groupList.every(x => x.status === 'iptal');
    if (anyOnayli) status = 'onaylandi';
    else if (allIptal) status = 'iptal';
  }
  return { ...r, id: displayId, status, roomName, totalPrice, nights };
}

app.get('/api/public/reservations/:id', (req, res) => {
  const id = (req.params.id || '').trim();
  const email = (req.query.email || '').trim();
  if (!id) return res.status(400).json({ ok: false, mesaj: 'Rezervasyon numarası gerekli.' });
  const r = getReservationPublic(id, email || null);
  if (!r) return res.status(404).json({ ok: false, mesaj: 'Rezervasyon bulunamadı veya e-posta eşleşmiyor.' });
  res.json(r);
});

app.get('/api/public/reservations/:id/pdf', (req, res) => {
  const id = (req.params.id || '').trim();
  const email = (req.query.email || '').trim();
  if (!id) return res.status(400).json({ ok: false, mesaj: 'Rezervasyon numarası gerekli.' });
  const r = getReservationPublic(id, email || null);
  if (!r) return res.status(404).json({ ok: false, mesaj: 'Rezervasyon bulunamadı veya e-posta eşleşmiyor.' });
  const settings = db.getSettings();
  const hotelName = (settings && settings.introTitle) ? settings.introTitle : 'Toprak Otel';
  const contact = (settings && settings.contact) ? settings.contact : {};

  function formatDateTR(str) {
    if (!str) return '-';
    const s = String(str).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return str;
    const [y, m, d] = s.split('-');
    return d + '.' + m + '.' + y;
  }

  function statusLabel(st) {
    if (st === 'onaylandi') return 'Onaylı';
    if (st === 'iptal') return 'İptal';
    if (st === 'gelmeyen') return 'Gelmeyen';
    return 'Beklemede';
  }

  function paymentStatusLabel(st) {
    if (!st) return 'Belirtilmemiş';
    if (st === 'paid') return 'Ödendi';
    if (st === 'pending') return 'Beklemede';
    if (st === 'failed') return 'Başarısız';
    return st;
  }

  function paymentMethodLabel(m) {
    if (!m) return 'Belirtilmemiş';
    if (m === 'cash') return 'Otelde Nakit';
    if (m === 'card') return 'Otelde Kredi Kartı';
    if (m === 'bank') return 'Havale / EFT';
    return m;
  }

  const createdAt = r.createdAt || r.created_at || '';
  const createdDate = createdAt
    ? formatDateTR(createdAt)
    : formatDateTR(new Date().toISOString().slice(0, 10));

  const doc = new PDFDocument({ margin: 40 });
  // Türkçe karakterler için isteğe bağlı özel font:
  // data/voucher-font.ttf dosyası varsa onu kullan, yoksa Helvetica ile devam et.
  let bodyFont = 'Helvetica';
  try {
    const voucherFontPath = path.join(DATA_DIR, 'voucher-font.ttf');
    if (fs.existsSync(voucherFontPath)) {
      doc.registerFont('voucher-body', voucherFontPath);
      bodyFont = 'voucher-body';
    }
  } catch (_) {
    bodyFont = 'Helvetica';
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="rezervasyon-' + id + '.pdf"');
  doc.pipe(res);

  const startX = 40;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const GOLD = '#b8860b';
  const GOLD_DARK = '#8b6914';
  const TEXT = '#1a1a1a';
  const TEXT_MUTED = '#4a4a4a';

  // Üst başlık – VAN / OTEL ADI (premium spacing)
  doc
    .font(bodyFont === 'voucher-body' ? 'voucher-body' : 'Helvetica-Bold')
    .fontSize(20)
    .fillColor(GOLD_DARK)
    .text('VAN', startX, 42, { width: pageWidth, align: 'center' });

  doc
    .font(bodyFont === 'voucher-body' ? 'voucher-body' : 'Helvetica-Bold')
    .fontSize(26)
    .fillColor(GOLD)
    .text(hotelName.toUpperCase(), startX, 62, { width: pageWidth, align: 'center' });

  // İnce ayırıcı çizgi
  doc
    .lineWidth(0.5)
    .strokeColor(GOLD)
    .opacity(0.6)
    .moveTo(startX + pageWidth * 0.25, 98)
    .lineTo(startX + pageWidth * 0.75, 98)
    .stroke()
    .opacity(1);

  // SAYIN bandı
  const sayinY = 108;
  doc
    .lineWidth(1)
    .strokeColor(GOLD)
    .rect(startX, sayinY, pageWidth, 22)
    .stroke();

  doc
    .font(bodyFont)
    .fontSize(11)
    .fillColor(GOLD_DARK)
    .text('SAYIN ' + (r.guestName || ''), startX + 8, sayinY + 6, {
      width: pageWidth - 16,
      align: 'left'
    });

  // CHECK IN / CHECK OUT / ROOM TYPE / RESERVATION / NIGHT tablosu
  const tableY = sayinY + 38;
  const cols = [
    { key: 'checkin',  label: 'CHECK IN',    width: 80 },
    { key: 'checkout', label: 'CHECK OUT',   width: 80 },
    { key: 'room',     label: 'ROOM TYPE',   width: 160 },
    { key: 'resdate',  label: 'RESERVATION', width: 90 },
    { key: 'night',    label: 'NIGHT',       width: 60 }
  ];

  let x = startX;
  doc.lineWidth(1).strokeColor(GOLD);
  cols.forEach(col => {
    doc.rect(x, tableY, col.width, 20).stroke();
    doc
      .font(bodyFont === 'voucher-body' ? 'voucher-body' : 'Helvetica-Bold')
      .fontSize(8)
      .fillColor(GOLD_DARK)
      .text(col.label, x, tableY + 6, { width: col.width, align: 'center' });
    x += col.width;
  });

  const rowY = tableY + 20;
  x = startX;
  const rowValues = {
    checkin:  formatDateTR(r.checkIn),
    checkout: formatDateTR(r.checkOut),
    room:     (r.roomCount != null ? r.roomCount : 1) + ' * ' + (r.roomName || r.roomId || ''),
    resdate:  createdDate,
    night:    String(r.nights != null ? r.nights : '-')
  };

  cols.forEach(col => {
    doc.rect(x, rowY, col.width, 20).stroke();
    doc
      .font(bodyFont)
      .fontSize(9)
      .fillColor(TEXT)
      .text(rowValues[col.key], x + 4, rowY + 5, {
        width: col.width - 8,
        align: 'center'
      });
    x += col.width;
  });

  // GUEST LIST
  let y = rowY + 28;
  doc
    .font(bodyFont === 'voucher-body' ? 'voucher-body' : 'Helvetica-Bold')
    .fontSize(10)
    .fillColor(GOLD_DARK)
    .text('GUEST LIST', startX, y, {
      width: pageWidth,
      align: 'left'
    });

  y += 16;
  doc
    .lineWidth(1)
    .strokeColor(GOLD)
    .rect(startX, y, pageWidth, 20)
    .stroke();

  doc
    .font(bodyFont)
    .fontSize(10)
    .fillColor(TEXT)
    .text('1. ' + (r.guestName || '-'), startX + 8, y + 5, {
      width: pageWidth - 16,
      align: 'left'
    });

  // Ek rezervasyon detayları (tarih, no, ödeme bilgileri)
  y += 36;
  doc
    .font(bodyFont === 'voucher-body' ? 'voucher-body' : 'Helvetica-Bold')
    .fontSize(10)
    .fillColor(GOLD_DARK)
    .text('Rezervasyon Detayları', startX, y);

  y += 14;
  const totalStr =
    r.totalPrice != null && r.totalPrice > 0
      ? '₺' + Number(r.totalPrice).toLocaleString('tr-TR')
      : '-';

  const extraLines = [
    'Rezervasyon No : ' + (r.id || '-'),
    'Oluşturulma    : ' + createdDate,
    'Durum          : ' + statusLabel(r.status),
    'Ödeme Yöntemi  : ' + paymentMethodLabel(r.paymentMethod),
    'Ödeme Durumu   : ' + paymentStatusLabel(r.paymentStatus),
    'Toplam Tutar   : ' + totalStr
  ];

  doc
    .font(bodyFont)
    .fontSize(9)
    .fillColor(TEXT_MUTED)
    .text(extraLines.join('\n'), startX, y + 2, {
      width: pageWidth / 2 - 10,
      align: 'left',
      lineGap: 2
    });

  // İletişim kutusu
  const contactBoxY = 382;
  const boxHeight = 70;

  doc
    .lineWidth(1)
    .strokeColor('#cccccc')
    .rect(startX, contactBoxY, pageWidth / 2 - 10, boxHeight)
    .stroke();

  doc
    .font(bodyFont === 'voucher-body' ? 'voucher-body' : 'Helvetica-Bold')
    .fontSize(9)
    .fillColor(GOLD_DARK)
    .text('İletişim', startX + 6, contactBoxY + 6);

  let cy = contactBoxY + 20;
  doc
    .font(bodyFont)
    .fontSize(9)
    .fillColor(TEXT_MUTED);

  if (contact.phone) {
    doc.text('Tel: ' + contact.phone, startX + 6, cy, {
      width: pageWidth / 2 - 22
    });
    cy += 12;
  }
  if (contact.email) {
    doc.text('E-posta: ' + contact.email, startX + 6, cy, {
      width: pageWidth / 2 - 22
    });
    cy += 12;
  }

  // Adres kutusu
  const addrBoxX = startX + pageWidth / 2 + 10;
  doc
    .lineWidth(1)
    .strokeColor('#cccccc')
    .rect(addrBoxX, contactBoxY, pageWidth / 2 - 10, boxHeight)
    .stroke();

  doc
    .font(bodyFont === 'voucher-body' ? 'voucher-body' : 'Helvetica-Bold')
    .fontSize(9)
    .fillColor(GOLD_DARK)
    .text('Adres', addrBoxX + 6, contactBoxY + 6);

  doc
    .font(bodyFont)
    .fontSize(9)
    .fillColor(TEXT_MUTED)
    .text(
      contact.address || 'Adres bilgisi henüz tanımlanmamış.',
      addrBoxX + 6,
      contactBoxY + 20,
      { width: pageWidth / 2 - 22 }
    );

  // Teşekkür ve alt çizgi
  const thanksY = contactBoxY + boxHeight + 28;
  doc
    .font(bodyFont === 'voucher-body' ? 'voucher-body' : 'Helvetica-Bold')
    .fontSize(9)
    .fillColor(GOLD_DARK)
    .text(
      'BİZLERİ TERCİH ETTİĞİNİZ İÇİN TEŞEKKÜR EDER VE İYİ ÇALIŞMALAR DİLERİZ.',
      startX,
      thanksY,
      { width: pageWidth, align: 'center' }
    );

  doc
    .moveTo(startX + pageWidth * 0.15, thanksY + 18)
    .lineTo(startX + pageWidth * 0.85, thanksY + 18)
    .lineWidth(1.5)
    .strokeColor(GOLD)
    .stroke();

  doc.end();
});

app.post('/api/public/reservations/:id/cancel', (req, res) => {
  const id = (req.params.id || '').trim();
  const email = (req.body && req.body.email) ? String(req.body.email).trim() : '';
  if (!id) return res.status(400).json({ ok: false, mesaj: 'Rezervasyon numarası gerekli.' });
  if (!email) return res.status(400).json({ ok: false, mesaj: 'E-posta gerekli.' });
  const r = getReservationPublic(id, email);
  if (!r) return res.status(404).json({ ok: false, mesaj: 'Rezervasyon bulunamadı veya e-posta eşleşmiyor.' });
  if (normalizeEmail(r.email) !== normalizeEmail(email)) return res.status(403).json({ ok: false, mesaj: 'E-posta adresi bu rezervasyonla eşleşmiyor.' });
  if (r.status === 'iptal') return res.status(400).json({ ok: false, mesaj: 'Bu rezervasyon zaten iptal edilmiş.' });
  const today = new Date().toISOString().slice(0, 10);
  if ((r.checkIn || '') < today) return res.status(400).json({ ok: false, mesaj: 'Rezervasyon giriş tarihi geçmiş. İptal sadece giriş tarihi gelmemiş rezervasyonlar için yapılabilir.' });
  const count = db.cancelReservationForGuest(id);
  res.json({ ok: true, mesaj: count > 0 ? 'Rezervasyon iptal edildi.' : 'İptal işlemi yapılamadı.' });
});

/** Rezervasyon tarih/oda değişikliği talebi: sadece son 24 saat içinde. Talep oluşturulur, admin onayından sonra uygulanır. */
app.post('/api/public/reservations/:id/change-dates', (req, res) => {
  const id = (req.params.id || '').trim();
  const email = (req.body && req.body.email) ? String(req.body.email).trim() : '';
  const newCheckIn = (req.body && req.body.newCheckIn) ? String(req.body.newCheckIn).trim().slice(0, 10) : '';
  const newCheckOut = (req.body && req.body.newCheckOut) ? String(req.body.newCheckOut).trim().slice(0, 10) : '';
  const newRoomId = (req.body && req.body.newRoomId) ? String(req.body.newRoomId).trim() : null;
  if (!id) return res.status(400).json({ ok: false, mesaj: 'Rezervasyon numarası gerekli.' });
  if (!email) return res.status(400).json({ ok: false, mesaj: 'E-posta gerekli.' });
  if (!newCheckIn || !newCheckOut || newCheckIn >= newCheckOut) return res.status(400).json({ ok: false, mesaj: 'Geçerli giriş ve çıkış tarihi girin.' });
  const r = getReservationPublic(id, email);
  if (!r) return res.status(404).json({ ok: false, mesaj: 'Rezervasyon bulunamadı veya e-posta eşleşmiyor.' });
  if (r.status === 'iptal') return res.status(400).json({ ok: false, mesaj: 'İptal edilmiş rezervasyon değiştirilemez.' });
  const createdAt = r.createdAt ? new Date(r.createdAt).getTime() : 0;
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  if (createdAt < twentyFourHoursAgo) return res.status(400).json({ ok: false, mesaj: 'Tarih/oda değişikliği sadece rezervasyonun yapıldığı andan itibaren 24 saat içinde yapılabilir.' });
  const groupId = r.reservationGroupId || null;
  const targetRoomId = newRoomId || r.roomId;
  if (newRoomId && !db.getRoomById(newRoomId)) return res.status(400).json({ ok: false, mesaj: 'Seçilen oda tipi bulunamadı.' });
  const excludeId = groupId ? null : (r.id || id);
  if (groupId) {
    const groupList = db.getReservationsByGroupId(groupId);
    let totalRoomCount = 0;
    let sameRoom = false;
    for (const resItem of groupList) {
      if (resItem.status === 'iptal') continue;
      totalRoomCount += (resItem.roomCount || 1);
      if (resItem.roomId === targetRoomId) sameRoom = true;
    }
    const avail = db.getRoomAvailabilityForRange(targetRoomId, newCheckIn, newCheckOut, null, sameRoom ? groupId : null);
    if (!avail || avail.availableCount < totalRoomCount) return res.status(400).json({ ok: false, mesaj: 'Seçilen oda veya tarihlerde yeterli müsaitlik yok. Lütfen başka seçenek deneyin.' });
  } else {
    const need = r.roomCount || 1;
    const sameRoom = targetRoomId === r.roomId;
    const avail = db.getRoomAvailabilityForRange(targetRoomId, newCheckIn, newCheckOut, sameRoom ? excludeId : null, null);
    if (!avail || avail.availableCount < need) return res.status(400).json({ ok: false, mesaj: 'Seçilen oda veya tarihlerde yeterli müsaitlik yok. Lütfen başka seçenek deneyin.' });
  }
  const newRoom = db.getRoomById(targetRoomId);
  const requestId = db.insertReservationChangeRequest({
    reservationDisplayId: id,
    email,
    guestName: r.guestName || '',
    currentRoomId: r.roomId || '',
    currentRoomName: r.roomName || r.roomId || '',
    currentCheckIn: r.checkIn || '',
    currentCheckOut: r.checkOut || '',
    newRoomId: targetRoomId,
    newRoomName: newRoom ? newRoom.name : targetRoomId,
    newCheckIn,
    newCheckOut
  });
  res.json({ ok: true, mesaj: 'Değişiklik talebiniz alındı. Onaylandıktan sonra rezervasyonunuz güncellenecektir.', requestId });
});

/** Rezervasyon misafir bilgisi güncelleme (ad, e-posta, telefon, not). E-posta doğrulaması gerekli. */
app.post('/api/public/reservations/:id/change-guest', (req, res) => {
  const id = (req.params.id || '').trim();
  const email = (req.body && req.body.email) ? String(req.body.email).trim() : '';
  const guestName = (req.body && req.body.guestName) != null ? String(req.body.guestName).trim() : null;
  const newEmail = (req.body && req.body.newEmail) != null ? String(req.body.newEmail).trim() : null;
  const phone = (req.body && req.body.phone) !== undefined ? String(req.body.phone).trim() : null;
  const note = (req.body && req.body.note) !== undefined ? String(req.body.note).trim() : null;
  if (!id) return res.status(400).json({ ok: false, mesaj: 'Rezervasyon numarası gerekli.' });
  if (!email) return res.status(400).json({ ok: false, mesaj: 'Mevcut e-posta gerekli.' });
  const r = getReservationPublic(id, email);
  if (!r) return res.status(404).json({ ok: false, mesaj: 'Rezervasyon bulunamadı veya e-posta eşleşmiyor.' });
  if (r.status === 'iptal') return res.status(400).json({ ok: false, mesaj: 'İptal edilmiş rezervasyon güncellenemez.' });
  const finalEmail = (newEmail != null && newEmail !== '') ? newEmail : r.email;
  const count = db.updateReservationGuestInfo(r.id, guestName !== null ? guestName : r.guestName, finalEmail, phone !== null ? phone : r.phone, note !== null ? note : r.note);
  if (!count) return res.status(400).json({ ok: false, mesaj: 'Güncelleme yapılamadı.' });
  res.json({ ok: true, mesaj: 'Rezervasyon bilgileriniz güncellendi.' });
});

// --- Auth ---
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ ok: false, mesaj: 'Kullanıcı adı ve şifre gerekli.' });
  const admin = db.getAdminByUsername(String(username).trim());
  if (!admin) return res.status(401).json({ ok: false, mesaj: 'Kullanıcı adı veya şifre hatalı.' });
  if (!bcrypt.compareSync(String(password), admin.passwordHash)) return res.status(401).json({ ok: false, mesaj: 'Kullanıcı adı veya şifre hatalı.' });
  const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: '7d' });
  db.updateAdminActivity(admin.id);
  const permissions = admin.role === 'super_admin' ? ['*'] : (Array.isArray(admin.permissions) ? admin.permissions : []);
  res.json({ ok: true, token: String(token), user: { id: admin.id, username: admin.username, role: admin.role, permissions } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const admin = db.getAdminById(req.user.id);
  if (!admin) return res.status(401).json({ ok: false });
  const permissions = admin.role === 'super_admin' ? ['*'] : (Array.isArray(admin.permissions) ? admin.permissions : []);
  res.json({ id: admin.id, username: admin.username, role: admin.role, permissions });
});

app.put('/api/auth/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ ok: false, mesaj: 'Mevcut ve yeni şifre gerekli.' });
  const admin = db.getAdminById(req.user.id);
  if (!admin || !bcrypt.compareSync(currentPassword, admin.passwordHash)) return res.status(401).json({ ok: false, mesaj: 'Mevcut şifre hatalı.' });
  if (newPassword.length < 6) return res.status(400).json({ ok: false, mesaj: 'Yeni şifre en az 6 karakter olmalı.' });
  db.updateAdminPassword(admin.id, bcrypt.hashSync(newPassword, 10));
  res.json({ ok: true, mesaj: 'Şifre güncellendi.' });
});

app.put('/api/auth/change-username', authMiddleware, (req, res) => {
  const { newUsername, password } = req.body;
  const trimmed = (newUsername || '').trim();
  if (!trimmed) return res.status(400).json({ ok: false, mesaj: 'Yeni kullanıcı adı gerekli.' });
  if (!password) return res.status(400).json({ ok: false, mesaj: 'Şifre doğrulaması gerekli.' });
  const admin = db.getAdminById(req.user.id);
  if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) return res.status(401).json({ ok: false, mesaj: 'Şifre hatalı.' });
  const existing = db.getAdminByUsername(trimmed);
  if (existing && existing.id !== admin.id) return res.status(400).json({ ok: false, mesaj: 'Bu kullanıcı adı zaten kullanılıyor.' });
  db.updateAdminUsername(admin.id, trimmed);
  const token = jwt.sign({ id: admin.id, username: trimmed, role: admin.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ ok: true, mesaj: 'Kullanıcı adı güncellendi.', token, user: { id: admin.id, username: trimmed, role: admin.role } });
});

// --- Protected: Slider ---
app.get('/api/admin/slider', authMiddleware, requirePermission('slider'), (req, res) => res.json(db.getSlider()));
app.post('/api/admin/slider', authMiddleware, requirePermission('slider'), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, mesaj: 'Yeni slide için görsel yüklemelisiniz.' });
  const imageUrl = '/uploads/' + req.file.filename;
  const title = (req.body && req.body.title) ? String(req.body.title).trim() : '';
  const subtitle = (req.body && req.body.subtitle) ? String(req.body.subtitle).trim() : '';
  const item = { id: Date.now().toString(), imageUrl, title, subtitle, order: db.getSliderCount() };
  db.insertSliderItem(item);
  db.ensureGalleryHasImage(imageUrl, (title || subtitle).trim());
  res.status(201).json({ ok: true, item });
});
app.put('/api/admin/slider/:id', authMiddleware, requirePermission('slider'), upload.single('image'), (req, res) => {
  const updates = {};
  if (req.file) {
    updates.imageUrl = '/uploads/' + req.file.filename;
    db.ensureGalleryHasImage(updates.imageUrl, (req.body.title || req.body.subtitle || '').trim());
  }
  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.subtitle !== undefined) updates.subtitle = req.body.subtitle;
  if (req.body.order !== undefined) updates.order = parseInt(req.body.order, 10);
  const item = db.updateSliderItem(req.params.id, updates);
  if (!item) return res.status(404).json({ ok: false });
  res.json({ ok: true, item });
});
app.delete('/api/admin/slider/:id', authMiddleware, requirePermission('slider'), (req, res) => {
  db.deleteSliderItem(req.params.id);
  res.json({ ok: true });
});

// --- Protected: Settings (intro, featured, about, contact) ---
app.get('/api/admin/settings', authMiddleware, requirePermission('settings'), (req, res) => res.json(db.getSettings()));
app.put('/api/admin/settings', authMiddleware, requirePermission('settings'), (req, res) => {
  const current = db.getSettings();
  const updated = { ...current, ...req.body };
  delete updated.adminEmail;
  delete updated.mailFrom;
  db.setSettings(updated);
  res.json({ ok: true, settings: updated });
});

// --- Protected: Rooms ---
app.get('/api/admin/rooms', authMiddleware, requirePermission('rooms'), (req, res) => res.json(db.getRooms(false)));
app.post('/api/admin/rooms', authMiddleware, requirePermission('rooms'), upload.array('images', 10), (req, res) => {
  const images = (req.files || []).map(f => '/uploads/' + f.filename);
  const cap = req.body.capacity != null && !isNaN(parseInt(req.body.capacity, 10)) ? Math.max(1, parseInt(req.body.capacity, 10)) : 2;
  const room = {
    id: Date.now().toString(),
    name: req.body.name || 'Oda', slug: (req.body.name || 'oda').toLowerCase().replace(/\s+/g, '-'),
    description: req.body.description || '', price: parseFloat(req.body.price) || 0, capacity: cap,
    features: JSON.parse(req.body.features || '[]'),
    images, active: req.body.active !== 'false', createdAt: new Date().toISOString()
  };
  db.insertRoom(room);
  const roomName = room.name || '';
  images.forEach(url => { db.ensureGalleryHasImage(url, roomName); });
  res.status(201).json({ ok: true, room });
});
app.put('/api/admin/rooms/:id', authMiddleware, requirePermission('rooms'), upload.array('images', 10), (req, res) => {
  const r = db.getRoomById(req.params.id);
  if (!r) return res.status(404).json({ ok: false });
  const updates = {};
  if (req.body.name !== undefined) { updates.name = req.body.name; updates.slug = (req.body.name || r.slug).toLowerCase().replace(/\s+/g, '-'); }
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.price !== undefined) updates.price = parseFloat(req.body.price);
  if (req.body.capacity !== undefined) updates.capacity = parseInt(req.body.capacity, 10) >= 1 ? parseInt(req.body.capacity, 10) : 1;
  if (req.body.features !== undefined) updates.features = Array.isArray(req.body.features) ? req.body.features : JSON.parse(req.body.features || '[]');
  if (req.body.active !== undefined) updates.active = req.body.active !== 'false';
  // Resim sırası / silme: body.imagesOrder JSON array (mevcut URL'ler istenen sırada); yeni yüklenen dosyalar sona eklenir. Path olarak sakla (/uploads/xxx).
  function toImagePath(url) {
    if (typeof url !== 'string' || !url.trim()) return '';
    const s = url.trim();
    const match = s.match(/\/uploads\/[^?#]+/);
    if (match) return match[0];
    if (s.startsWith('/uploads/')) return s.split('?')[0];
    return s;
  }
  if (req.body.imagesOrder !== undefined) {
    let ordered = req.body.imagesOrder;
    if (typeof ordered === 'string') try { ordered = JSON.parse(ordered); } catch (e) { ordered = []; }
    if (!Array.isArray(ordered)) ordered = [];
    ordered = ordered.map(toImagePath).filter(Boolean);
    const newUrls = (req.files || []).map(f => '/uploads/' + f.filename);
    updates.images = ordered.concat(newUrls);
  } else if ((req.files || []).length) {
    updates.images = [...(r.images || []), ...(req.files || []).map(f => '/uploads/' + f.filename)];
  }
  const room = db.updateRoom(req.params.id, updates);
  (req.files || []).forEach(f => {
    const url = '/uploads/' + f.filename;
    db.ensureGalleryHasImage(url, updates.name || r.name || '');
  });
  res.json({ ok: true, room });
});
app.delete('/api/admin/rooms/:id', authMiddleware, requirePermission('rooms'), (req, res) => {
  try {
    db.deleteRoom(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, mesaj: e.message || 'Oda silinemedi.' });
  }
});

// --- Protected: Tarihe göre fiyat dönemleri ---
app.get('/api/admin/room-price-overrides', authMiddleware, requirePermission('kontejan'), (req, res) => {
  const list = db.getRoomPriceOverrides(req.query.roomId || null);
  res.json(list);
});
app.post('/api/admin/room-price-overrides', authMiddleware, requirePermission('kontejan'), (req, res) => {
  const { roomId, dateFrom, dateTo, price, capacity } = req.body;
  if (!roomId || !dateFrom || !dateTo || price == null) return res.status(400).json({ ok: false, mesaj: 'Oda, tarih başlangıç, bitiş ve fiyat gerekli.' });
  const id = Date.now().toString();
  db.insertRoomPriceOverride({ id, roomId, dateFrom, dateTo, price: parseFloat(price) || 0, capacity: capacity != null ? parseInt(capacity, 10) : null, createdAt: new Date().toISOString() });
  res.status(201).json({ ok: true, override: db.getRoomPriceOverrideById(id) });
});
app.put('/api/admin/room-price-overrides/:id', authMiddleware, requirePermission('kontejan'), (req, res) => {
  const o = db.getRoomPriceOverrideById(req.params.id);
  if (!o) return res.status(404).json({ ok: false });
  const updates = {};
  if (req.body.roomId !== undefined) updates.roomId = req.body.roomId;
  if (req.body.dateFrom !== undefined) updates.dateFrom = req.body.dateFrom;
  if (req.body.dateTo !== undefined) updates.dateTo = req.body.dateTo;
  if (req.body.price !== undefined) updates.price = parseFloat(req.body.price);
  if (req.body.capacity !== undefined) updates.capacity = req.body.capacity !== '' && req.body.capacity != null ? parseInt(req.body.capacity, 10) : null;
  const updated = db.updateRoomPriceOverride(req.params.id, updates);
  res.json({ ok: true, override: updated });
});
app.delete('/api/admin/room-price-overrides/:id', authMiddleware, requirePermission('kontejan'), (req, res) => {
  db.deleteRoomPriceOverride(req.params.id);
  res.json({ ok: true });
});
app.get('/api/admin/rooms/:id/calendar', authMiddleware, requirePermission('kontejan'), (req, res) => {
  const room = db.getRoomById(req.params.id);
  if (!room) return res.status(404).json({ ok: false });
  const from = db.normalizeDateStr(req.query.from) || req.query.from;
  const to = db.normalizeDateStr(req.query.to) || req.query.to;
  if (!from || !to) return res.status(400).json({ ok: false, mesaj: 'from ve to tarih parametreleri gerekli (YYYY-MM-DD).' });
  const list = db.getRoomCalendar(req.params.id, from, to);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json(list);
});
app.post('/api/admin/room-price-overrides/bulk', authMiddleware, requirePermission('kontejan'), (req, res) => {
  const { roomIds, dateFrom, dateTo, price, capacity, openOnly, open } = req.body;
  if (!roomIds || !Array.isArray(roomIds) || !roomIds.length || !dateFrom || !dateTo) {
    return res.status(400).json({ ok: false, mesaj: 'En az bir oda ile tarih başlangıç ve bitiş gerekli.' });
  }
  const fromNorm = db.normalizeDateStr(dateFrom);
  const toNorm = db.normalizeDateStr(dateTo);
  if (!fromNorm || !toNorm) {
    return res.status(400).json({ ok: false, mesaj: 'Tarih formatı YYYY-MM-DD veya GG.AA.YYYY olmalı.' });
  }
  if (openOnly === true || openOnly === 'true') {
    const openVal = (open === 0 || open === '0') ? 0 : 1;
    const count = db.setBulkDailyRates(roomIds, fromNorm, toNorm, null, null, true, openVal);
    return res.status(200).json({ ok: true, updated: count });
  }
  const priceNum = (price != null && price !== '' && !isNaN(parseFloat(price))) ? parseFloat(price) : 0;
  if (priceNum < db.MIN_DAILY_PRICE) {
    return res.status(400).json({ ok: false, mesaj: '100 TL altı girdiniz. Fiyat en az 100 ₺ olmalıdır.' });
  }
  const count = db.setBulkDailyRates(roomIds, fromNorm, toNorm, price, capacity);
  res.status(200).json({ ok: true, updated: count });
});

app.patch('/api/admin/rooms/:id/calendar/day', authMiddleware, requirePermission('kontejan'), (req, res) => {
  try {
    const room = db.getRoomById(req.params.id);
    if (!room) return res.status(404).json({ ok: false });
    const date = db.normalizeDateStr(req.body.date) || req.body.date;
    if (!date) return res.status(400).json({ ok: false, mesaj: 'date gerekli (YYYY-MM-DD).' });
    const { open, price, capacity } = req.body;
    if (price !== undefined || capacity !== undefined) {
      const eff = db.getRoomEffectivePriceAndCapacity(req.params.id, date);
      if (!eff) return res.status(400).json({ ok: false });
      const p = (price !== undefined && price !== '' && !isNaN(parseFloat(price))) ? parseFloat(price) : eff.price;
      if (p < db.MIN_DAILY_PRICE) {
        return res.status(400).json({ ok: false, mesaj: '100 TL altı girdiniz. Fiyat en az 100 ₺ olmalıdır.' });
      }
      const c = (capacity !== undefined && capacity !== '' && !isNaN(parseInt(capacity, 10))) ? Math.max(0, parseInt(capacity, 10)) : eff.capacity;
      db.upsertRoomDailyRate(req.params.id, date, p, c, eff.open);
      return res.json({ ok: true });
    }
    const openVal = (open === 0 || open === '0' || open === false) ? 0 : 1;
    const ok = db.setRoomDayOpen(req.params.id, date, openVal);
    if (!ok) return res.status(400).json({ ok: false });
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH calendar/day hatası:', err);
    res.status(500).json({ ok: false, mesaj: 'Sunucu hatası: ' + (err.message || 'bilinmeyen') });
  }
});

// --- Protected: Reservations ---
app.get('/api/admin/reservations', authMiddleware, requirePermission('reservations'), (req, res) => res.json(db.getReservations()));
app.get('/api/admin/reservations/:id', authMiddleware, requirePermission('reservations'), (req, res) => {
  const r = db.getReservationById(req.params.id);
  if (!r) return res.status(404).json({ ok: false, mesaj: 'Rezervasyon bulunamadı.' });
  res.json(r);
});

// --- Protected: Şikayet & Öneriler (iletişim formundan gelen talepler) ---
app.get('/api/admin/complaints', authMiddleware, requirePermission('complaints'), (req, res) => res.json(db.getComplaints()));

app.get('/api/admin/reservation-change-requests', authMiddleware, requirePermission('changeRequests'), (req, res) => res.json(db.getReservationChangeRequests()));
app.get('/api/admin/reservation-change-requests/:id', authMiddleware, requirePermission('changeRequests'), (req, res) => {
  const req_ = db.getReservationChangeRequestById(req.params.id);
  if (!req_) return res.status(404).json({ ok: false, mesaj: 'Talep bulunamadı.' });
  res.json(req_);
});
app.post('/api/admin/reservation-change-requests/:id/approve', authMiddleware, requirePermission('changeRequests'), (req, res) => {
  const reqId = req.params.id;
  const changeReq = db.getReservationChangeRequestById(reqId);
  if (!changeReq) return res.status(404).json({ ok: false, mesaj: 'Talep bulunamadı.' });
  if (changeReq.status !== 'beklemede') return res.status(400).json({ ok: false, mesaj: 'Talep zaten işlenmiş.' });
  const id = changeReq.reservationDisplayId;
  let internalId = id;
  if (/^g\d+/.test(String(id))) {
    const list = db.getReservationsByGroupId(id);
    if (list.length) internalId = list[0].id;
  }
  const updated = db.updateReservationRoomAndDates(internalId, changeReq.newRoomId, changeReq.newCheckIn, changeReq.newCheckOut);
  if (!updated) return res.status(400).json({ ok: false, mesaj: 'Rezervasyon güncellenemedi (müsaitlik değişmiş olabilir).' });
  db.updateReservationChangeRequestStatus(reqId, 'onaylandi', req.user.id);
  res.json({ ok: true, mesaj: 'Talep onaylandı, rezervasyon güncellendi.' });
});
app.post('/api/admin/reservation-change-requests/:id/reject', authMiddleware, requirePermission('changeRequests'), (req, res) => {
  const changeReq = db.getReservationChangeRequestById(req.params.id);
  if (!changeReq) return res.status(404).json({ ok: false, mesaj: 'Talep bulunamadı.' });
  if (changeReq.status !== 'beklemede') return res.status(400).json({ ok: false, mesaj: 'Talep zaten işlenmiş.' });
  db.updateReservationChangeRequestStatus(req.params.id, 'reddedildi', req.user.id);
  res.json({ ok: true, mesaj: 'Talep reddedildi.' });
});

app.patch('/api/admin/reservations/:id', authMiddleware, requirePermission('reservations'), (req, res) => {
  const { status, paymentMethod, paymentStatus } = req.body;
  let reservation = db.getReservationById(req.params.id);
  if (!reservation) return res.status(404).json({ ok: false });
  if (status !== undefined && status !== null) {
    if (!['beklemede', 'onaylandi', 'iptal', 'gelmeyen'].includes(status)) return res.status(400).json({ ok: false, mesaj: 'Geçersiz durum.' });
    reservation = db.updateReservationStatus(req.params.id, status);
  }
  if (paymentMethod !== undefined || paymentStatus !== undefined) {
    reservation = db.updateReservationPayment(req.params.id, paymentMethod, paymentStatus);
  }
  res.json({ ok: true, reservation });
});

// --- Protected: Admins (super_admin only) ---
app.get('/api/admin/admins', authMiddleware, superAdminOnly, (req, res) => {
  const now = Date.now();
  const admins = db.getAdmins().map(a => {
    const lastActivity = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
    const isActive = (now - lastActivity) < ACTIVITY_TIMEOUT_MS;
    return { id: a.id, username: a.username, role: a.role, permissions: a.permissions || [], createdAt: a.createdAt, lastActivity: a.lastActivity, isActive };
  });
  res.json(admins);
});
app.post('/api/admin/admins', authMiddleware, superAdminOnly, (req, res) => {
  const { username, password, role, permissions } = req.body;
  if (db.getAdminByUsername(username)) return res.status(400).json({ ok: false, mesaj: 'Bu kullanıcı adı zaten kayıtlı.' });
  const perms = Array.isArray(permissions) ? permissions : [];
  const admin = { id: Date.now().toString(), username: (username || '').trim(), passwordHash: bcrypt.hashSync(password, 10), role: role || 'admin', permissions: perms, createdAt: new Date().toISOString() };
  db.insertAdmin(admin);
  res.status(201).json({ ok: true, admin: { id: admin.id, username: admin.username, role: admin.role, permissions: admin.permissions } });
});
app.put('/api/admin/admins/:id', authMiddleware, superAdminOnly, (req, res) => {
  const { id } = req.params;
  const { username: newUsername, password: newPassword, permissions } = req.body;
  const target = db.getAdminById(id);
  if (!target) return res.status(404).json({ ok: false, mesaj: 'Kullanıcı bulunamadı.' });
  if (newUsername !== undefined && newUsername !== null) {
    const trimmed = (newUsername + '').trim();
    if (!trimmed) return res.status(400).json({ ok: false, mesaj: 'Kullanıcı adı boş olamaz.' });
    const existing = db.getAdminByUsername(trimmed);
    if (existing && existing.id !== id) return res.status(400).json({ ok: false, mesaj: 'Bu kullanıcı adı zaten kayıtlı.' });
    db.updateAdminUsername(id, trimmed);
  }
  if (newPassword !== undefined && newPassword !== null && String(newPassword).length > 0) {
    if (String(newPassword).length < 6) return res.status(400).json({ ok: false, mesaj: 'Şifre en az 6 karakter olmalı.' });
    db.updateAdminPassword(id, bcrypt.hashSync(newPassword, 10));
  }
  if (permissions !== undefined && Array.isArray(permissions)) {
    db.updateAdminPermissions(id, permissions);
  }
  const didUsername = newUsername !== undefined && newUsername !== null && String(newUsername).trim() !== '';
  const didPassword = newPassword !== undefined && newPassword !== null && String(newPassword).length >= 6;
  const didPermissions = permissions !== undefined && Array.isArray(permissions);
  if (!didUsername && !didPassword && !didPermissions)
    return res.status(400).json({ ok: false, mesaj: 'Kullanıcı adı, şifre veya yetkilerden en az biri girin.' });
  res.json({ ok: true });
});
app.delete('/api/admin/admins/:id', authMiddleware, superAdminOnly, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ ok: false, mesaj: 'Kendinizi silemezsiniz.' });
  db.deleteAdmin(req.params.id);
  res.json({ ok: true });
});

// --- Protected: Testimonials ---
app.get('/api/admin/testimonials', authMiddleware, requirePermission('testimonials'), (req, res) => res.json(db.getTestimonials()));
app.post('/api/admin/testimonials', authMiddleware, requirePermission('testimonials'), upload.single('image'), (req, res) => {
  const imageUrl = (req.file && req.file.filename) ? '/uploads/' + req.file.filename : '';
  const author = (req.body.author || '').trim();
  const text = (req.body.text || '').trim();
  if (!imageUrl && !author && !text) return res.status(400).json({ ok: false, mesaj: 'En az bir fotoğraf yükleyin veya yazar/yorum girin.' });
  const rating = Math.min(5, Math.max(0, parseInt(req.body.rating, 10) || 0));
  const item = { id: Date.now().toString(), author, text, rating, imageUrl };
  db.insertTestimonial(item);
  if (imageUrl) db.ensureGalleryHasImage(imageUrl, author || 'Yorum');
  res.status(201).json({ ok: true, item });
});
app.put('/api/admin/testimonials/:id', authMiddleware, requirePermission('testimonials'), upload.single('image'), (req, res) => {
  const existing = db.getTestimonials().find(t => t.id === req.params.id);
  if (!existing) return res.status(404).json({ ok: false });
  const updates = {
    author: (req.body.author != null ? req.body.author : existing.author || '').trim(),
    text: (req.body.text != null ? req.body.text : existing.text || '').trim(),
    rating: req.body.rating !== undefined && req.body.rating !== '' ? Math.min(5, Math.max(0, parseInt(req.body.rating, 10) || 0)) : existing.rating
  };
  if (req.file && req.file.filename) {
    updates.imageUrl = '/uploads/' + req.file.filename;
    db.ensureGalleryHasImage(updates.imageUrl, updates.author || 'Yorum');
  }
  if (req.body.order !== undefined && req.body.order !== '') updates.order = parseInt(req.body.order, 10);
  const item = db.updateTestimonial(req.params.id, updates);
  if (!item) return res.status(404).json({ ok: false });
  res.json({ ok: true, item });
});
app.delete('/api/admin/testimonials/:id', authMiddleware, requirePermission('testimonials'), (req, res) => {
  db.deleteTestimonial(req.params.id);
  res.json({ ok: true });
});

// --- Protected: Services (Hizmetler) ---
app.get('/api/admin/services', authMiddleware, (req, res) => res.json(db.getServices()));
function toServiceImagePath(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  const s = url.trim();
  const match = s.match(/\/uploads\/[^?#]+/);
  if (match) return match[0];
  if (s.startsWith('/uploads/')) return s.split('?')[0];
  return s;
}
app.post('/api/admin/services', authMiddleware, requirePermission('services'), upload.array('images', 10), (req, res) => {
  const title = (req.body && req.body.title) ? String(req.body.title).trim() : '';
  const shortDesc = (req.body && req.body.shortDesc != null) ? String(req.body.shortDesc).trim() : '';
  const detail = (req.body && req.body.detail != null) ? String(req.body.detail).trim() : '';
  const icon = (req.body && req.body.icon != null) ? String(req.body.icon).trim() || '⭐' : '⭐';
  if (!title) return res.status(400).json({ ok: false, mesaj: 'Başlık zorunludur.' });
  const images = (req.files || []).map(f => '/uploads/' + f.filename);
  const item = db.insertService({ title, shortDesc, detail, icon, images });
  images.forEach(url => db.ensureGalleryHasImage(url, title));
  res.status(201).json({ ok: true, item });
});
app.put('/api/admin/services/:id', authMiddleware, requirePermission('services'), upload.array('images', 10), (req, res) => {
  const existing = db.getServiceById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, mesaj: 'Hizmet bulunamadı.' });
  const updates = {};
  if (req.body && req.body.title !== undefined) updates.title = String(req.body.title).trim();
  if (req.body && req.body.shortDesc !== undefined) updates.shortDesc = String(req.body.shortDesc).trim();
  if (req.body && req.body.detail !== undefined) updates.detail = String(req.body.detail).trim();
  if (req.body && req.body.icon !== undefined) updates.icon = String(req.body.icon).trim() || '⭐';
  if (req.body && req.body.order !== undefined) updates.order = parseInt(req.body.order, 10);
  if (req.body.imagesOrder !== undefined) {
    let ordered = req.body.imagesOrder;
    if (typeof ordered === 'string') try { ordered = JSON.parse(ordered); } catch (e) { ordered = []; }
    if (!Array.isArray(ordered)) ordered = [];
    ordered = ordered.map(toServiceImagePath).filter(Boolean);
    const newUrls = (req.files || []).map(f => '/uploads/' + f.filename);
    updates.images = ordered.concat(newUrls);
    updates.images.forEach(url => db.ensureGalleryHasImage(url, updates.title !== undefined ? updates.title : existing.title));
  } else if ((req.files || []).length) {
    const current = Array.isArray(existing.images) ? existing.images : (existing.imageUrl ? [existing.imageUrl] : []);
    const newUrls = (req.files || []).map(f => '/uploads/' + f.filename);
    updates.images = current.concat(newUrls);
    newUrls.forEach(url => db.ensureGalleryHasImage(url, existing.title));
  }
  const item = db.updateService(req.params.id, updates);
  res.json({ ok: true, item });
});
app.delete('/api/admin/services/:id', authMiddleware, requirePermission('services'), (req, res) => {
  db.deleteService(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/gallery', authMiddleware, requirePermission('gallery'), (req, res) => res.json(db.getGallery()));
app.post('/api/admin/gallery', authMiddleware, requirePermission('gallery'), upload.single('image'), (req, res) => {
  const imageUrl = (req.file && req.file.filename) ? '/uploads/' + req.file.filename : '';
  if (!imageUrl) return res.status(400).json({ ok: false, mesaj: 'Resim gerekli.' });
  const showOnHome = req.body.showOnHome !== 'false' && req.body.showOnHome !== false;
  const item = { id: Date.now().toString(), imageUrl, caption: (req.body.caption || '').trim(), order: db.getGalleryCount(), showOnHome };
  db.insertGalleryItem(item);
  res.status(201).json({ ok: true, item: db.getGalleryItemById(item.id) });
});
app.put('/api/admin/gallery/:id', authMiddleware, requirePermission('gallery'), upload.single('image'), (req, res) => {
  const existing = db.getGallery().find(g => g.id === req.params.id);
  if (!existing) return res.status(404).json({ ok: false, mesaj: 'Galeri öğesi bulunamadı.' });
  const updates = { caption: (req.body.caption !== undefined ? req.body.caption : existing.caption) || '' };
  if (req.file && req.file.filename) updates.imageUrl = '/uploads/' + req.file.filename;
  if (req.body.order !== undefined) updates.order = parseInt(req.body.order, 10);
  if (req.body.showOnHome !== undefined) updates.showOnHome = req.body.showOnHome === true || req.body.showOnHome === 'true';
  const item = db.updateGalleryItem(req.params.id, updates);
  res.json({ ok: true, item });
});
app.delete('/api/admin/gallery/:id', authMiddleware, requirePermission('gallery'), (req, res) => {
  db.deleteGalleryItem(req.params.id);
  res.json({ ok: true });
});
app.patch('/api/admin/gallery/:id', authMiddleware, requirePermission('gallery'), (req, res) => {
  const existing = db.getGallery().find(g => g.id === req.params.id);
  if (!existing) return res.status(404).json({ ok: false, mesaj: 'Galeri öğesi bulunamadı.' });
  const updates = {};
  if (req.body.showOnHome !== undefined) updates.showOnHome = req.body.showOnHome === true || req.body.showOnHome === 'true';
  if (Object.keys(updates).length === 0) return res.json({ ok: true, item: db.getGalleryItemById(req.params.id) });
  const item = db.updateGalleryItem(req.params.id, updates);
  res.json({ ok: true, item });
});

// SPA fallback for admin
app.get('/admin/*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));

// Tüm yakalanmamış hatalar JSON dönsün (500 HTML yerine)
app.use(function(err, req, res, next) {
  console.error('Sunucu hatası:', err);
  if (res.headersSent) return next(err);
  var code = 500;
  var mesaj = (err && err.message) ? err.message : 'Sunucu hatası';
  if (err && err.code === 'LIMIT_FILE_SIZE') { code = 400; mesaj = 'Dosya çok büyük. En fazla 5 MB yükleyebilirsiniz.'; }
  res.status(code).json({ ok: false, mesaj });
});

app.listen(PORT, () => {
  console.log('Otel sitesi: http://localhost:' + PORT);
  console.log('Admin: http://localhost:' + PORT + '/admin/');
});
