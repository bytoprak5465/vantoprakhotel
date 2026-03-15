(function() {
  function t(key, rep) { return (typeof window.__t === 'function') ? window.__t(key, rep) : key; }
  var params = new URLSearchParams(location.search);
  var roomId = params.get('room');
  var comboParam = params.get('combo');
  var checkIn = params.get('checkIn') || '';
  var checkOut = params.get('checkOut') || '';
  var guests = params.get('guests') || '2';
  var rooms = params.get('rooms') || '1';
  var adults = params.get('adults') || '2';
  var childrenUnder6 = params.get('childrenUnder6') || '0';
  var children6Plus = params.get('children6Plus') || '0';

  var comboLines = [];
  if (comboParam) {
    comboParam.split(',').forEach(function(pair) {
      var parts = pair.split(':');
      if (parts.length >= 2) {
        var qty = parseInt(parts[1], 10) || 1;
        if (parts[0] && qty >= 1) comboLines.push({ roomId: parts[0].trim(), quantity: qty });
      }
    });
  }

  var form = document.getElementById('rezervasyon-modal-form');
  var loadingEl = document.getElementById('rezervasyon-form-loading');
  var formRoomId = document.getElementById('rez-form-roomId');
  var formCheckIn = document.getElementById('rez-form-checkin');
  var formCheckOut = document.getElementById('rez-form-checkout');
  var formGuests = document.getElementById('rez-form-guests');
  var formRoomCount = document.getElementById('rez-form-roomCount');
  var formAdults = document.getElementById('rez-form-adults');
  var formChildrenUnder6 = document.getElementById('rez-form-childrenUnder6');
  var formChildren6Plus = document.getElementById('rez-form-children6Plus');
  var formMesaj = document.getElementById('rez-form-mesaj');
  var modalRoomName = document.getElementById('rez-modal-room-name');
  var summaryComboLines = document.getElementById('rez-summary-combo-lines');
  var summaryCheckin = document.getElementById('rez-summary-checkin');
  var summaryCheckout = document.getElementById('rez-summary-checkout');
  var summaryNights = document.getElementById('rez-summary-nights');
  var summaryGuests = document.getElementById('rez-summary-guests');
  var summaryImageWrap = document.getElementById('rez-summary-image-wrap');
  var summaryImage = document.getElementById('rez-summary-image');
  var summaryImageDots = document.getElementById('rez-summary-image-dots');
  var summaryImagePrev = document.getElementById('rez-summary-image-prev');
  var summaryImageNext = document.getElementById('rez-summary-image-next');
  var summaryPriceBlock = document.getElementById('rezervasyon-summary-price-block');
  var summaryPriceDetail = document.getElementById('rez-summary-price-detail');
  var summaryPriceAmount = document.getElementById('rez-summary-price-amount');
  var summaryPriceAvg = document.getElementById('rez-summary-price-avg');
  var summaryTotal = document.getElementById('rez-summary-total');

  // Ülke kodları listesi (İran dahil, yaygın ülkeler)
  var COUNTRY_CODES = [
    { code: 'TR', name: 'Turkey', dial: '+90' },
    { code: 'IR', name: 'Iran', dial: '+98' },
    { code: 'US', name: 'United States', dial: '+1' },
    { code: 'CA', name: 'Canada', dial: '+1' },
    { code: 'GB', name: 'United Kingdom', dial: '+44' },
    { code: 'DE', name: 'Germany', dial: '+49' },
    { code: 'FR', name: 'France', dial: '+33' },
    { code: 'IT', name: 'Italy', dial: '+39' },
    { code: 'ES', name: 'Spain', dial: '+34' },
    { code: 'NL', name: 'Netherlands', dial: '+31' },
    { code: 'BE', name: 'Belgium', dial: '+32' },
    { code: 'CH', name: 'Switzerland', dial: '+41' },
    { code: 'AT', name: 'Austria', dial: '+43' },
    { code: 'SE', name: 'Sweden', dial: '+46' },
    { code: 'NO', name: 'Norway', dial: '+47' },
    { code: 'DK', name: 'Denmark', dial: '+45' },
    { code: 'FI', name: 'Finland', dial: '+358' },
    { code: 'IE', name: 'Ireland', dial: '+353' },
    { code: 'PT', name: 'Portugal', dial: '+351' },
    { code: 'GR', name: 'Greece', dial: '+30' },
    { code: 'HU', name: 'Hungary', dial: '+36' },
    { code: 'PL', name: 'Poland', dial: '+48' },
    { code: 'CZ', name: 'Czech Republic', dial: '+420' },
    { code: 'SK', name: 'Slovakia', dial: '+421' },
    { code: 'RO', name: 'Romania', dial: '+40' },
    { code: 'BG', name: 'Bulgaria', dial: '+359' },
    { code: 'UA', name: 'Ukraine', dial: '+380' },
    { code: 'RU', name: 'Russia', dial: '+7' },
    { code: 'CN', name: 'China', dial: '+86' },
    { code: 'JP', name: 'Japan', dial: '+81' },
    { code: 'KR', name: 'South Korea', dial: '+82' },
    { code: 'IN', name: 'India', dial: '+91' },
    { code: 'PK', name: 'Pakistan', dial: '+92' },
    { code: 'AF', name: 'Afghanistan', dial: '+93' },
    { code: 'IQ', name: 'Iraq', dial: '+964' },
    { code: 'SA', name: 'Saudi Arabia', dial: '+966' },
    { code: 'AE', name: 'United Arab Emirates', dial: '+971' },
    { code: 'QA', name: 'Qatar', dial: '+974' },
    { code: 'OM', name: 'Oman', dial: '+968' },
    { code: 'KW', name: 'Kuwait', dial: '+965' },
    { code: 'LB', name: 'Lebanon', dial: '+961' },
    { code: 'JO', name: 'Jordan', dial: '+962' },
    { code: 'EG', name: 'Egypt', dial: '+20' },
    { code: 'MA', name: 'Morocco', dial: '+212' },
    { code: 'TN', name: 'Tunisia', dial: '+216' },
    { code: 'DZ', name: 'Algeria', dial: '+213' },
    { code: 'BR', name: 'Brazil', dial: '+55' },
    { code: 'AR', name: 'Argentina', dial: '+54' },
    { code: 'MX', name: 'Mexico', dial: '+52' },
    { code: 'CL', name: 'Chile', dial: '+56' },
    { code: 'CO', name: 'Colombia', dial: '+57' },
    { code: 'ZA', name: 'South Africa', dial: '+27' },
    { code: 'NG', name: 'Nigeria', dial: '+234' },
    { code: 'KE', name: 'Kenya', dial: '+254' },
    { code: 'AU', name: 'Australia', dial: '+61' },
    { code: 'NZ', name: 'New Zealand', dial: '+64' }
  ];

  function initPhoneCountrySelect() {
    if (!form) return;
    var select = form.querySelector('[name="phoneCountry"]');
    if (!select) return;

    select.innerHTML = '';

    COUNTRY_CODES.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c.dial;
      opt.textContent = c.code + ' ' + c.dial;
      if (c.code === 'TR') opt.selected = true;
      select.appendChild(opt);
    });
  }

  var monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  function formatDateLong(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr + 'T12:00:00Z');
    if (isNaN(d.getTime())) return dateStr;
    return d.getDate() + ' ' + monthNames[d.getMonth()] + ' ' + d.getFullYear();
  }

  var summaryImages = [];
  var summaryImageIndex = 0;

  function updateSummaryImage() {
    if (!summaryImage || !summaryImages.length) return;
    summaryImage.src = summaryImages[summaryImageIndex];
    if (summaryImageDots) {
      summaryImageDots.innerHTML = summaryImages.map(function(_, idx) {
        return '<button type="button" class="' + (idx === summaryImageIndex ? 'is-active' : '') + '" aria-label="Görsel ' + (idx + 1) + '"></button>';
      }).join('');
      Array.prototype.forEach.call(summaryImageDots.querySelectorAll('button'), function(btn, idx) {
        btn.addEventListener('click', function() {
          summaryImageIndex = idx;
          updateSummaryImage();
        });
      });
    }
    if (summaryImageWrap) summaryImageWrap.style.display = '';
  }

  function initSummarySliderFromUrls(urls) {
    summaryImages = (urls || []).filter(Boolean);
    summaryImageIndex = 0;
    if (!summaryImages.length) {
      if (summaryImageWrap) summaryImageWrap.style.display = 'none';
      return;
    }
    updateSummaryImage();
  }

  // Telefon ülke kodu select'ini doldur
  initPhoneCountrySelect();

  function renderSummaryCombo(comboWithRooms, totalPrice, nights) {
    window._lastSummaryCombo = { combo: comboWithRooms, totalPrice: totalPrice, nights: nights };
    window._lastSummaryRoom = null;
    var g = Math.max(1, parseInt(guests, 10) || 2);
    var a = Math.max(1, parseInt(adults, 10) || 2);
    var u6 = Math.max(0, parseInt(childrenUnder6, 10) || 0);
    var s6 = Math.max(0, parseInt(children6Plus, 10) || 0);
    if (formRoomId) formRoomId.value = '';
    if (formRoomCount) formRoomCount.value = comboWithRooms.length ? comboWithRooms.reduce(function(s, l) { return s + l.quantity; }, 0) : 1;
    if (formAdults) formAdults.value = a;
    if (formChildrenUnder6) formChildrenUnder6.value = u6;
    if (formChildren6Plus) formChildren6Plus.value = s6;
    if (modalRoomName) { modalRoomName.textContent = t('form.roomPackage', { n: comboWithRooms.length }); modalRoomName.style.display = ''; }
    if (summaryComboLines) {
      summaryComboLines.style.display = 'block';
      summaryComboLines.innerHTML = comboWithRooms.map(function(l) {
        return '<p class="rezervasyon-summary-combo-line">' + (l.quantity > 1 ? l.quantity + '× ' : '1× ') + (l.room.name || l.roomId) + ' (' + (l.room.capacity || 0) + ' kişi) · ₺' + Number(l.lineTotalPrice || 0).toLocaleString('tr-TR') + '</p>';
      }).join('');
    }
    if (formCheckIn) formCheckIn.value = checkIn;
    if (formCheckOut) formCheckOut.value = checkOut;
    if (formGuests) formGuests.value = g;
    if (summaryCheckin) summaryCheckin.textContent = formatDateLong(checkIn);
    if (summaryCheckout) summaryCheckout.textContent = formatDateLong(checkOut);
    if (summaryNights) summaryNights.textContent = nights ? nights + ' ' + t('form.nightsStay') : '—';
    var guestText = a + ' yetişkin';
    if (s6 > 0) guestText += ', ' + s6 + ' çocuk (6–12 yaş)';
    if (u6 > 0) guestText += ', ' + u6 + ' çocuk (6 yaş altı, 1 kişi ücretsiz)';
    if (summaryGuests) summaryGuests.textContent = guestText;
    if (summaryImageWrap && summaryImage) {
      var firstRoom = comboWithRooms[0] && comboWithRooms[0].room;
      var imgs = firstRoom && Array.isArray(firstRoom.images) ? firstRoom.images : [];
      var urls = imgs.map(function(u) { return u ? u.replace(/^\//, location.origin + '/') : ''; });
      initSummarySliderFromUrls(urls);
    }
    if (summaryPriceBlock) {
      summaryPriceBlock.style.display = 'block';
      if (summaryPriceDetail) summaryPriceDetail.textContent = t('form.roomNightsX', { rooms: comboWithRooms.length, nights: nights });
      if (summaryPriceAmount) summaryPriceAmount.textContent = '₺' + Number(totalPrice).toLocaleString('tr-TR');
      if (summaryPriceAvg) { summaryPriceAvg.textContent = nights ? t('form.avgPerNight', { amount: Number(totalPrice / (nights * comboWithRooms.reduce(function(s, l) { return s + l.quantity; }, 0))).toLocaleString('tr-TR') }) : ''; summaryPriceAvg.style.display = nights ? '' : 'none'; }
      if (summaryTotal) summaryTotal.textContent = '₺' + Number(totalPrice).toLocaleString('tr-TR');
    }
  }

  function renderSummary(room) {
    window._lastSummaryRoom = room;
    window._lastSummaryCombo = null;
    var nights = room.nights != null ? room.nights : 0;
    var totalPricePerRoom = room.totalPrice != null ? room.totalPrice : 0;
    var numRooms = Math.max(1, parseInt(rooms, 10) || 1);
    var totalPrice = totalPricePerRoom * numRooms;
    var g = Math.max(1, parseInt(guests, 10) || 2);
    var a = Math.max(1, parseInt(adults, 10) || 2);
    var u6 = Math.max(0, parseInt(childrenUnder6, 10) || 0);
    var s6 = Math.max(0, parseInt(children6Plus, 10) || 0);
    if (formRoomId) formRoomId.value = room.id;
    if (formRoomCount) formRoomCount.value = numRooms;
    if (formAdults) formAdults.value = a;
    if (formChildrenUnder6) formChildrenUnder6.value = u6;
    if (formChildren6Plus) formChildren6Plus.value = s6;
    if (modalRoomName) { modalRoomName.textContent = room.name || ''; modalRoomName.style.display = ''; }
    if (summaryComboLines) summaryComboLines.style.display = 'none';
    if (formCheckIn) formCheckIn.value = checkIn;
    if (formCheckOut) formCheckOut.value = checkOut;
    if (formGuests) formGuests.value = g;
    if (summaryCheckin) summaryCheckin.textContent = formatDateLong(checkIn);
    if (summaryCheckout) summaryCheckout.textContent = formatDateLong(checkOut);
    if (summaryNights) summaryNights.textContent = nights ? nights + ' ' + t('form.nightsStay') : '—';
    var guestText = numRooms > 1 ? numRooms + ' oda, ' : '';
    guestText += a + ' yetişkin';
    if (s6 > 0) guestText += ', ' + s6 + ' çocuk (6–12 yaş)';
    if (u6 > 0) guestText += ', ' + u6 + ' çocuk (6 yaş altı, 1 kişi ücretsiz)';
    if (summaryGuests) summaryGuests.textContent = guestText;
    if (summaryImageWrap && summaryImage) {
      var imgs = Array.isArray(room.images) ? room.images : (room.images ? [room.images] : []);
      var urls = imgs.map(function(u) { return u ? u.replace(/^\//, location.origin + '/') : ''; });
      initSummarySliderFromUrls(urls);
    }
    if (summaryPriceBlock) {
      summaryPriceBlock.style.display = 'block';
      if (nights > 0 && totalPricePerRoom > 0) {
        if (summaryPriceDetail) summaryPriceDetail.textContent = (numRooms > 1 ? t('form.roomNightsX', { rooms: numRooms, nights: nights }) : t('form.roomNights', { nights: nights }));
        if (summaryPriceAmount) summaryPriceAmount.textContent = '₺' + Number(totalPrice).toLocaleString('tr-TR');
        if (summaryPriceAvg) { summaryPriceAvg.textContent = t('form.avgPerNight', { amount: Number(totalPrice / (nights * numRooms)).toLocaleString('tr-TR') }); summaryPriceAvg.style.display = ''; }
        if (summaryTotal) summaryTotal.textContent = '₺' + Number(totalPrice).toLocaleString('tr-TR');
      } else {
        if (summaryPriceDetail) summaryPriceDetail.textContent = nights ? (numRooms > 1 ? t('form.roomNightsX', { rooms: numRooms, nights: nights }) : t('form.roomNights', { nights: nights })) : '—';
        if (summaryPriceAmount) summaryPriceAmount.textContent = '—';
        if (summaryPriceAvg) summaryPriceAvg.style.display = 'none';
        if (summaryTotal) summaryTotal.textContent = t('form.contactForPrice');
      }
    }
  }

  function showError(msg) {
    if (!loadingEl) return;
    var text = msg || t('form.roomNotFound');
    if (text.indexOf('<a ') !== -1) loadingEl.innerHTML = text; else loadingEl.textContent = text;
  }

  var apiBase = '';
  var port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (window.location.protocol === 'file:' || !window.location.origin) {
    apiBase = 'http://localhost:3000';
  } else if (isLocal && port !== '3000') {
    apiBase = 'http://' + window.location.hostname + ':3000';
  }

  if (summaryImagePrev) {
    summaryImagePrev.addEventListener('click', function() {
      if (!summaryImages.length) return;
      summaryImageIndex = (summaryImageIndex - 1 + summaryImages.length) % summaryImages.length;
      updateSummaryImage();
    });
  }
  if (summaryImageNext) {
    summaryImageNext.addEventListener('click', function() {
      if (!summaryImages.length) return;
      summaryImageIndex = (summaryImageIndex + 1) % summaryImages.length;
      updateSummaryImage();
    });
  }

  var url = apiBase + '/api/rooms';
  if (checkIn && checkOut) url += '?checkIn=' + encodeURIComponent(checkIn) + '&checkOut=' + encodeURIComponent(checkOut);

  if (comboLines.length > 0) {
    fetch(url).then(function(r) { return r.json(); }).then(function(roomsList) {
      if (loadingEl) loadingEl.style.display = 'none';
      var comboWithRooms = [];
      var totalPrice = 0;
      var nights = 0;
      for (var i = 0; i < comboLines.length; i++) {
        var line = comboLines[i];
        var room = (roomsList || []).find(function(r) { return r.id === line.roomId; });
        if (!room) {
          showError(t('form.roomNotFound') + ' ' + line.roomId);
          return;
        }
        var lineTotal = (room.totalPrice != null ? room.totalPrice : 0) * line.quantity;
        totalPrice += lineTotal;
        if (room.nights != null) nights = room.nights;
        comboWithRooms.push({ roomId: line.roomId, quantity: line.quantity, room: room, lineTotalPrice: lineTotal });
      }
      if (form) form.style.display = 'flex';
      renderSummaryCombo(comboWithRooms, totalPrice, nights);
    }).catch(function() {
      if (loadingEl) loadingEl.style.display = 'none';
      showError(t('form.infoLoadError'));
    });
  } else if (!roomId) {
    window._lastSummaryRoom = null;
    window._lastSummaryCombo = null;
    var linkHtml = '<a href="rezervasyon.html">' + t('form.bookingPageLink') + '</a>';
    showError(t('form.selectRoomFromBooking', { link: linkHtml }));
    if (loadingEl) loadingEl.style.display = 'block';
  } else {
    fetch(url).then(function(r) { return r.json(); }).then(function(roomsList) {
      var room = (roomsList || []).find(function(r) { return r.id === roomId; });
      if (loadingEl) loadingEl.style.display = 'none';
      if (!room) {
        showError(t('form.roomNotFound'));
        return;
      }
      if (form) form.style.display = 'flex';
      renderSummary(room);
    }).catch(function() {
      if (loadingEl) loadingEl.style.display = 'none';
      showError(t('form.infoLoadError'));
    });
  }

  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var fd = new FormData(form);
      var firstName = (fd.get('firstName') || '').trim();
      var lastName = (fd.get('lastName') || '').trim();
      var guestName = (firstName + ' ' + lastName).trim() || firstName || lastName;

      // Telefon: ülke kodu + yerel numarayı tek alanda birleştir
      var phoneCountryEl = form.querySelector('[name="phoneCountry"]');
      var phoneLocalEl = form.querySelector('[name="phoneLocal"]');
      var phoneCountry = phoneCountryEl ? String(phoneCountryEl.value || '').trim() : '';
      var phoneLocalRaw = phoneLocalEl ? String(phoneLocalEl.value || '').trim() : '';
      var phoneLocalDigits = phoneLocalRaw.replace(/[^\d]/g, '');

      // Türkiye için baştaki 0'ı düşür
      if (phoneCountry === '+90' && phoneLocalDigits.startsWith('0')) {
        phoneLocalDigits = phoneLocalDigits.slice(1);
      }

      var fullPhone = '';
      if (phoneCountry && phoneLocalDigits) {
        fullPhone = phoneCountry + phoneLocalDigits;
      } else if (phoneLocalDigits) {
        fullPhone = phoneLocalDigits;
      }

      // Eğer kullanıcı bir şey yazdıysa ama çok kısa ise basit doğrulama
      if (phoneLocalRaw && phoneLocalDigits.length < 7) {
        if (formMesaj) {
          formMesaj.className = 'rezervasyon-form-mesaj error';
          formMesaj.textContent = t('form.invalidPhone');
          formMesaj.style.display = 'block';
        }
        return;
      }

      var paymentMethod = 'eft';
      var payload = {
        guestName: guestName,
        email: fd.get('email'),
        phone: fullPhone,
        checkIn: fd.get('checkIn'),
        checkOut: fd.get('checkOut'),
        guests: parseInt(fd.get('guests'), 10) || 1,
        adults: fd.get('adults') != null ? parseInt(fd.get('adults'), 10) : null,
        childrenUnder6: fd.get('childrenUnder6') != null ? parseInt(fd.get('childrenUnder6'), 10) : null,
        children6Plus: fd.get('children6Plus') != null ? parseInt(fd.get('children6Plus'), 10) : null,
        note: (fd.get('note') || '').trim(),
        paymentMethod: paymentMethod
      };
      if (comboLines.length > 0) {
        payload.rooms = comboLines.map(function(l) { return { roomId: l.roomId, quantity: l.quantity }; });
      } else {
        payload.roomId = fd.get('roomId');
        payload.roomCount = parseInt(fd.get('roomCount'), 10) || 1;
      }
      formMesaj.style.display = 'none';
      fetch(apiBase + '/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(r) {
        return r.text().then(function(text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (_) {}
          return { ok: r.ok, status: r.status, data: data, raw: text };
        });
      }).then(function(result) {
        formMesaj.style.display = 'block';
        if (result.ok && result.data && result.data.ok) {
          var resId = result.data.id;
          var guestEmail = (payload.email || '').trim();
          var roomName = (modalRoomName && modalRoomName.textContent) ? modalRoomName.textContent.trim() : '';
          var checkinText = (summaryCheckin && summaryCheckin.textContent) ? summaryCheckin.textContent.trim() : (payload.checkIn || '—');
          var checkoutText = (summaryCheckout && summaryCheckout.textContent) ? summaryCheckout.textContent.trim() : (payload.checkOut || '—');
          var nightsText = (summaryNights && summaryNights.textContent) ? summaryNights.textContent.trim() : '—';
          var guestsText = (summaryGuests && summaryGuests.textContent) ? summaryGuests.textContent.trim() : (payload.guests ? payload.guests + ' kişi' : '—');
          var priceDetailText = (summaryPriceDetail && summaryPriceDetail.textContent) ? summaryPriceDetail.textContent.trim() : '';
          var priceAmountText = (summaryPriceAmount && summaryPriceAmount.textContent) ? summaryPriceAmount.textContent.trim() : '';
          var totalText = (summaryTotal && summaryTotal.textContent) ? summaryTotal.textContent.trim() : '—';
          if (comboLines.length > 0 && summaryComboLines && summaryComboLines.textContent) roomName = summaryComboLines.textContent.trim() || roomName;
          form.style.display = 'none';
          var successPanel = document.getElementById('rezervasyon-success-panel');
          if (successPanel) {
            successPanel.style.display = 'block';
            var noEl = document.getElementById('rez-success-no');
            if (noEl) noEl.textContent = resId || '—';
            function esc(s) { return (s == null || s === '') ? '—' : String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
            var detailRoom = document.getElementById('rez-success-room');
            if (detailRoom) detailRoom.innerHTML = esc(roomName || '—');
            var detailCheckin = document.getElementById('rez-success-checkin');
            if (detailCheckin) detailCheckin.textContent = checkinText || '—';
            var detailCheckout = document.getElementById('rez-success-checkout');
            if (detailCheckout) detailCheckout.textContent = checkoutText || '—';
            var detailNights = document.getElementById('rez-success-nights');
            if (detailNights) detailNights.textContent = nightsText || '—';
            var detailGuests = document.getElementById('rez-success-guests');
            if (detailGuests) detailGuests.textContent = guestsText || '—';
            var detailGuestName = document.getElementById('rez-success-guest-name');
            if (detailGuestName) detailGuestName.textContent = (payload.guestName || '').trim() || '—';
            var detailEmail = document.getElementById('rez-success-email');
            if (detailEmail) detailEmail.innerHTML = (payload.email && payload.email.trim()) ? '<a href="mailto:' + encodeURIComponent(payload.email.trim()) + '">' + esc(payload.email.trim()) + '</a>' : '—';
            var detailPhone = document.getElementById('rez-success-phone');
            if (detailPhone) detailPhone.innerHTML = (payload.phone && payload.phone.trim()) ? '<a href="tel:' + payload.phone.trim().replace(/\s/g, '') + '">' + esc(payload.phone.trim()) + '</a>' : '—';
            var detailNote = document.getElementById('rez-success-note');
            if (detailNote) detailNote.textContent = (payload.note && payload.note.trim()) ? payload.note.trim() : '—';
            var detailPriceDetail = document.getElementById('rez-success-price-detail');
            if (detailPriceDetail) detailPriceDetail.textContent = (priceDetailText && priceAmountText) ? priceDetailText + ' ' + priceAmountText : (totalText || '—');
            var detailTotal = document.getElementById('rez-success-total');
            if (detailTotal) detailTotal.textContent = totalText || '—';
            var checkinoutEl = document.getElementById('rez-success-checkinout');
            var contactEl = document.getElementById('rez-success-contact');
            fetch(apiBase + '/api/settings').then(function(r) { return r.json(); }).then(function(s) {
              if (checkinoutEl && (s.checkInTime || s.checkOutTime)) checkinoutEl.textContent = (t('form.checkin') || 'Giriş') + ': ' + (s.checkInTime || '14:00') + ' · ' + (t('form.checkout') || 'Çıkış') + ': ' + (s.checkOutTime || '12:00');
              if (contactEl && s.contact) {
                var c = s.contact;
                var parts = [];
                if (c.address) parts.push('<p>' + esc(c.address) + '</p>');
                if (c.phone) parts.push('<p><strong>' + (t('form.phoneLabel') || 'Telefon') + '</strong> <a href="tel:' + (c.phone || '').replace(/\s/g, '') + '">' + esc(c.phone) + '</a></p>');
                if (c.email) parts.push('<p><strong>' + (t('form.emailLabel') || 'E-posta') + '</strong> <a href="mailto:' + encodeURIComponent(c.email) + '">' + esc(c.email) + '</a></p>');
                contactEl.innerHTML = parts.length ? '<p class="rez-success-contact-title">' + (t('footer.contact') || 'İletişim') + '</p>' + parts.join('') : '';
              }
            }).catch(function() {});
            var pdfLink = document.getElementById('rez-success-pdf');
            if (pdfLink && resId && guestEmail) {
              pdfLink.href = apiBase + '/api/public/reservations/' + encodeURIComponent(resId) + '/pdf?email=' + encodeURIComponent(guestEmail);
              pdfLink.style.display = '';
            }
            var manageLink = document.getElementById('rez-success-manage');
            if (manageLink && resId && guestEmail) {
              manageLink.href = 'rezervasyon-sorgula.html?no=' + encodeURIComponent(resId) + '&email=' + encodeURIComponent(guestEmail);
            }
            if (paymentMethod === 'eft') {
              var box = document.getElementById('rez-success-iban-box');
              if (box) {
                box.style.display = 'block';
                box.innerHTML = '<p class="rezervasyon-odeme-iban-loading">' + t('form.ibanLoading') + '</p>';
                fetch(apiBase + '/api/settings').then(function(r) { return r.json(); }).then(function(s) {
                  var iban = (s && s.iban) ? String(s.iban).trim() : '';
                  var bankName = (s && s.bankName) ? String(s.bankName).trim() : '';
                  var instructions = (s && s.paymentInstructions) ? String(s.paymentInstructions).trim() : '';
                  if (!iban && !bankName) {
                    box.innerHTML = '<p class="rezervasyon-odeme-iban-empty">' + t('form.ibanEmpty') + '</p>';
                    return;
                  }
                  var html = '<div class="rezervasyon-odeme-iban-inner">';
                  html += '<p class="rezervasyon-odeme-iban-label">' + t('form.bankTransferTitle') + '</p>';
                  if (bankName) html += '<p class="rezervasyon-odeme-iban-value">' + bankName.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
                  if (iban) html += '<p class="rezervasyon-odeme-iban-label">IBAN</p><p class="rezervasyon-odeme-iban-value rezervasyon-odeme-iban-code">' + iban.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
                  if (instructions) html += '<p class="rezervasyon-odeme-iban-label">' + t('form.instructionsLabel') + '</p><p class="rezervasyon-odeme-iban-note">' + instructions.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</p>';
                  html += '</div>';
                  box.innerHTML = html;
                }).catch(function() {
                  box.innerHTML = '<p class="rezervasyon-odeme-iban-empty">' + t('form.ibanLoadError') + '</p>';
                });
              }
            }
          } else {
            formMesaj.className = 'rezervasyon-form-mesaj success';
            formMesaj.textContent = result.data.mesaj || t('form.reservationReceived');
            form.querySelector('button[type="submit"]').disabled = true;
          }
        } else {
          formMesaj.className = 'rezervasyon-form-mesaj error';
          var hataMesaj = (result.data && result.data.mesaj) || (result.status === 500 ? 'Sunucu veya veritabanı hatası.' : 'Bir hata oluştu.');
          if (result.data && result.data.detail) hataMesaj += ' (' + result.data.detail + ')';
          formMesaj.textContent = hataMesaj;
        }
      }).catch(function() {
        formMesaj.className = 'rezervasyon-form-mesaj error';
        formMesaj.innerHTML = t('form.connectionError');
        formMesaj.style.display = 'block';
      });
    });
  }

  // Havale/EFT: IBAN bilgisini form gösterildiğinde yükle
  (function initPayment() {
    var transferPanel = document.getElementById('rez-odeme-transfer-panel');
    var ibanBox = document.getElementById('rez-odeme-iban-box');
    function loadIbanInfo() {
      if (!ibanBox) return;
      ibanBox.innerHTML = '<p class="rezervasyon-odeme-iban-loading">' + t('form.ibanLoading') + '</p>';
      fetch(apiBase + '/api/settings').then(function(r) { return r.json(); }).then(function(s) {
        var iban = (s && s.iban) ? String(s.iban).trim() : '';
        var bankName = (s && s.bankName) ? String(s.bankName).trim() : '';
        var instructions = (s && s.paymentInstructions) ? String(s.paymentInstructions).trim() : '';
        if (!iban && !bankName) {
          ibanBox.innerHTML = '<p class="rezervasyon-odeme-iban-empty">' + t('form.ibanEmptyShort') + '</p>';
          return;
        }
        var html = '<div class="rezervasyon-odeme-iban-inner">';
        if (bankName) html += '<p class="rezervasyon-odeme-iban-label">' + t('form.bankLabel') + '</p><p class="rezervasyon-odeme-iban-value">' + bankName.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
        if (iban) html += '<p class="rezervasyon-odeme-iban-label">IBAN</p><p class="rezervasyon-odeme-iban-value rezervasyon-odeme-iban-code">' + iban.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
        if (instructions) html += '<p class="rezervasyon-odeme-iban-label">' + t('form.instructionsLabel') + '</p><p class="rezervasyon-odeme-iban-note">' + instructions.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</p>';
        html += '</div>';
        ibanBox.innerHTML = html;
      }).catch(function() {
        ibanBox.innerHTML = '<p class="rezervasyon-odeme-iban-empty">' + t('form.ibanLoadErrorShort') + '</p>';
      });
    }
    if (transferPanel && ibanBox) loadIbanInfo();
  })();

  window.addEventListener('app:languageChanged', function() {
    if (window._lastSummaryRoom) renderSummary(window._lastSummaryRoom);
    else if (window._lastSummaryCombo) renderSummaryCombo(window._lastSummaryCombo.combo, window._lastSummaryCombo.totalPrice, window._lastSummaryCombo.nights);
  });
})();
