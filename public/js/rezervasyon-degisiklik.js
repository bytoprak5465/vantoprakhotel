(function() {
  var apiBase = '';
  var port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (window.location.protocol === 'file:' || !window.location.origin) {
    apiBase = 'http://localhost:3000';
  } else if (isLocal && port !== '3000') {
    apiBase = 'http://' + window.location.hostname + ':3000';
  }

  var params = new URLSearchParams(location.search);
  var prefillNo = params.get('no') || params.get('id') || '';
  var prefillEmail = params.get('email') || '';

  var form = document.getElementById('degisiklik-form');
  var noInput = document.getElementById('degisiklik-no');
  var emailInput = document.getElementById('degisiklik-email');
  var mesajEl = document.getElementById('degisiklik-mesaj');
  var uyariEl = document.getElementById('degisiklik-24uyari');
  var sonucEl = document.getElementById('degisiklik-sonuc');
  var dlEl = document.getElementById('degisiklik-dl');
  var guncelleBtnWrap = document.getElementById('degisiklik-guncelle-btn-wrap');
  var guncellePanel = document.getElementById('degisiklik-guncelle-panel');
  var guncelleTrigger = document.getElementById('degisiklik-guncelle-trigger');
  var updateFormsEl = document.getElementById('degisiklik-update-forms');
  var updateBackBtn = document.getElementById('degisiklik-update-back');
  var updateFeedbackEl = document.getElementById('degisiklik-update-feedback');
  var updateFeedbackText = document.getElementById('degisiklik-update-feedback-text');
  var updateFeedbackBack = document.getElementById('degisiklik-update-feedback-back');
  var formRoomPanel = document.getElementById('degisiklik-form-room');
  var formDatesPanel = document.getElementById('degisiklik-form-dates');
  var formGuestPanel = document.getElementById('degisiklik-form-guest');
  var newRoomSelect = document.getElementById('degisiklik-new-room');
  var newCheckInInput = document.getElementById('degisiklik-new-checkin');
  var newCheckOutInput = document.getElementById('degisiklik-new-checkout');
  var newCheckInRoomHidden = document.getElementById('degisiklik-new-checkin-room');
  var newCheckOutRoomHidden = document.getElementById('degisiklik-new-checkout-room');
  var newRoomDatesHidden = document.getElementById('degisiklik-new-room-dates');
  var tarihFormRoom = document.getElementById('degisiklik-tarih-form-room');
  var tarihFormDates = document.getElementById('degisiklik-tarih-form-dates');
  var guestForm = document.getElementById('degisiklik-guest-form');

  if (noInput && prefillNo) noInput.value = prefillNo;
  if (emailInput && prefillEmail) emailInput.value = prefillEmail;

  var currentReservation = null;
  var currentEmail = '';

  function formatDate(str) {
    if (!str) return '—';
    try {
      var d = new Date(str + 'T12:00:00Z');
      if (isNaN(d.getTime())) return str;
      var day = d.getDate();
      var month = d.getMonth() + 1;
      var year = d.getFullYear();
      return (day < 10 ? '0' : '') + day + '.' + (month < 10 ? '0' : '') + month + '.' + year;
    } catch (_) { return str; }
  }

  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function showMesaj(text, isError) {
    if (!mesajEl) return;
    mesajEl.textContent = text || '';
    mesajEl.className = 'rezervasyon-form-mesaj ' + (isError ? 'error' : 'success');
    mesajEl.style.display = text ? 'block' : 'none';
  }

  function renderDetay(r) {
    if (!dlEl) return;
    var totalStr = (r.totalPrice != null && r.totalPrice > 0) ? '₺' + Number(r.totalPrice).toLocaleString('tr-TR') : '—';
    dlEl.innerHTML =
      '<dt>Rezervasyon no</dt><dd><strong>' + (r.id || '—') + '</strong></dd>' +
      '<dt>Oda</dt><dd>' + (r.roomName || r.roomId || '—') + '</dd>' +
      '<dt>Mevcut giriş</dt><dd>' + formatDate(r.checkIn) + '</dd>' +
      '<dt>Mevcut çıkış</dt><dd>' + formatDate(r.checkOut) + '</dd>' +
      '<dt>Gece</dt><dd>' + (r.nights != null ? r.nights : '—') + '</dd>' +
      '<dt>Tahmini toplam</dt><dd>' + totalStr + '</dd>';
  }

  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var no = (noInput && noInput.value) ? noInput.value.trim() : '';
      var email = (emailInput && emailInput.value) ? emailInput.value.trim() : '';
      if (!no || !email) {
        showMesaj('Rezervasyon numarası ve e-posta girin.', true);
        return;
      }
      sonucEl.style.display = 'none';
      uyariEl.style.display = 'none';
      showMesaj('Sorgulanıyor…', false);
      fetch(apiBase + '/api/public/reservations/' + encodeURIComponent(no) + '?email=' + encodeURIComponent(email))
        .then(function(r) {
          return r.json().then(function(data) { return { status: r.status, data: data }; });
        })
        .then(function(result) {
          if (result.status === 404 || !result.data || !result.data.id) {
            showMesaj(result.data && result.data.mesaj ? result.data.mesaj : 'Rezervasyon bulunamadı veya e-posta eşleşmiyor.', true);
            return;
          }
          var r = result.data;
          if (r.status === 'iptal') {
            showMesaj('İptal edilmiş rezervasyonun tarihi değiştirilemez.', true);
            return;
          }
          var createdAt = r.createdAt ? new Date(r.createdAt).getTime() : 0;
          var twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
          if (createdAt < twentyFourHoursAgo) {
            showMesaj('', false);
            uyariEl.style.display = 'block';
            return;
          }
          currentReservation = r;
          currentEmail = email;
          showMesaj('', false);
          renderDetay(r);
          var cin = (r.checkIn || '').slice(0, 10);
          var cout = (r.checkOut || '').slice(0, 10);
          if (newCheckInInput) {
            newCheckInInput.value = cin;
            newCheckInInput.setAttribute('min', todayStr());
          }
          if (newCheckOutInput) {
            newCheckOutInput.value = cout;
            newCheckOutInput.setAttribute('min', cin || todayStr());
          }
          if (newCheckInRoomHidden) newCheckInRoomHidden.value = cin;
          if (newCheckOutRoomHidden) newCheckOutRoomHidden.value = cout;
          if (newRoomDatesHidden) newRoomDatesHidden.value = r.roomId || '';
          if (newRoomSelect) {
            fetch(apiBase + '/api/rooms')
              .then(function(res) { return res.json(); })
              .then(function(rooms) {
                newRoomSelect.innerHTML = (rooms || []).map(function(room) {
                  return '<option value="' + (room.id || '').replace(/"/g, '&quot;') + '"' + (room.id === r.roomId ? ' selected' : '') + '>' + (room.name || room.id || '').replace(/</g, '&lt;') + '</option>';
                }).join('');
              })
              .catch(function() { newRoomSelect.innerHTML = '<option value="' + (r.roomId || '').replace(/"/g, '&quot;') + '">' + (r.roomName || r.roomId || '').replace(/</g, '&lt;') + '</option>'; });
          }
          var guestNameStr = (r.guestName || '').trim();
          var spaceIdx = guestNameStr.indexOf(' ');
          var first = spaceIdx > 0 ? guestNameStr.slice(0, spaceIdx) : guestNameStr;
          var last = spaceIdx > 0 ? guestNameStr.slice(spaceIdx + 1) : '';
          var gFirst = document.getElementById('degisiklik-guest-firstName');
          var gLast = document.getElementById('degisiklik-guest-lastName');
          var gEmail = document.getElementById('degisiklik-guest-email');
          var gPhone = document.getElementById('degisiklik-guest-phone');
          var gNote = document.getElementById('degisiklik-guest-note');
          if (gFirst) gFirst.value = first;
          if (gLast) gLast.value = last;
          if (gEmail) gEmail.value = r.email || '';
          if (gPhone) gPhone.value = r.phone || '';
          if (gNote) gNote.value = r.note || '';
          if (guncelleBtnWrap) guncelleBtnWrap.style.display = 'block';
          if (guncellePanel) guncellePanel.style.display = 'none';
          if (updateFormsEl) { updateFormsEl.style.display = 'none'; formRoomPanel && (formRoomPanel.style.display = 'none'); formDatesPanel && (formDatesPanel.style.display = 'none'); formGuestPanel && (formGuestPanel.style.display = 'none'); }
          sonucEl.style.display = 'block';
        })
        .catch(function() {
          showMesaj('Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olun (npm start) ve sayfayı http://localhost:3000 adresinden açın.', true);
        });
    });
  }

  if (newCheckInInput && newCheckOutInput) {
    newCheckInInput.addEventListener('change', function() {
      var cin = newCheckInInput.value;
      if (cin && newCheckOutInput.value && newCheckOutInput.value < cin) newCheckOutInput.value = cin;
      newCheckOutInput.setAttribute('min', cin || todayStr());
    });
  }

  function showUpdatePanel(type) {
    if (updateFeedbackEl) updateFeedbackEl.style.display = 'none';
    if (updateChoicesElDeg) updateChoicesElDeg.style.display = 'none';
    if (updateFormsEl) updateFormsEl.style.display = 'block';
    if (formRoomPanel) formRoomPanel.style.display = type === 'room' ? 'block' : 'none';
    if (formDatesPanel) formDatesPanel.style.display = type === 'dates' ? 'block' : 'none';
    if (formGuestPanel) formGuestPanel.style.display = type === 'guest' ? 'block' : 'none';
  }
  var updateChoicesElDeg = document.querySelector('#degisiklik-guncelle-panel .rezervasyon-update-choices');
  function showUpdateChoices() {
    if (updateFeedbackEl) updateFeedbackEl.style.display = 'none';
    if (updateChoicesElDeg) updateChoicesElDeg.style.display = 'block';
    if (updateFormsEl) updateFormsEl.style.display = 'none';
    if (formRoomPanel) formRoomPanel.style.display = 'none';
    if (formDatesPanel) formDatesPanel.style.display = 'none';
    if (formGuestPanel) formGuestPanel.style.display = 'none';
  }
  function showUpdateFeedback(message, isError) {
    if (!updateFeedbackEl || !updateFeedbackText) return;
    updateFeedbackEl.className = 'rezervasyon-update-feedback ' + (isError ? 'rezervasyon-update-feedback--error' : 'rezervasyon-update-feedback--success');
    updateFeedbackEl.querySelector('.rezervasyon-update-feedback-icon').textContent = isError ? '!' : '✓';
    updateFeedbackText.textContent = message || '';
    if (updateChoicesElDeg) updateChoicesElDeg.style.display = 'none';
    if (updateFormsEl) updateFormsEl.style.display = 'none';
    if (formRoomPanel) formRoomPanel.style.display = 'none';
    if (formDatesPanel) formDatesPanel.style.display = 'none';
    if (formGuestPanel) formGuestPanel.style.display = 'none';
    updateFeedbackEl.style.display = 'block';
    updateFeedbackEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (guncelleTrigger && guncellePanel && guncelleBtnWrap) {
    guncelleTrigger.addEventListener('click', function() {
      guncelleBtnWrap.style.display = 'none';
      guncellePanel.style.display = 'block';
      showUpdateChoices();
    });
  }
  ['degisiklik-choice-room', 'degisiklik-choice-dates', 'degisiklik-choice-guest'].forEach(function(id, i) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', function() { showUpdatePanel(['room', 'dates', 'guest'][i]); });
  });
  if (updateBackBtn) updateBackBtn.addEventListener('click', showUpdateChoices);
  if (updateFeedbackBack) updateFeedbackBack.addEventListener('click', showUpdateChoices);

  if (tarihFormRoom) {
    tarihFormRoom.addEventListener('submit', function(e) {
      e.preventDefault();
      if (!currentReservation) return;
      var newRoomId = newRoomSelect ? (newRoomSelect.value || '').trim() : (currentReservation.roomId || '');
      var newCheckIn = newCheckInRoomHidden ? newCheckInRoomHidden.value.trim().slice(0, 10) : (currentReservation.checkIn || '').slice(0, 10);
      var newCheckOut = newCheckOutRoomHidden ? newCheckOutRoomHidden.value.trim().slice(0, 10) : (currentReservation.checkOut || '').slice(0, 10);
      if (!newRoomId || !newCheckIn || !newCheckOut || newCheckIn >= newCheckOut) {
        showMesaj('Oda tipi seçin.', true);
        return;
      }
      showMesaj('Güncelleniyor…', false);
      fetch(apiBase + '/api/public/reservations/' + encodeURIComponent(currentReservation.id) + '/change-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail, newCheckIn: newCheckIn, newCheckOut: newCheckOut, newRoomId: newRoomId })
      })
        .then(function(res) { return res.json().then(function(data) { return { status: res.status, data: data }; }); })
        .then(function(result) {
          if (result.status !== 200 || !result.data || !result.data.ok) {
            var errMsg = result.data && result.data.mesaj ? result.data.mesaj : 'Güncelleme yapılamadı.';
            showMesaj(errMsg, true);
            showUpdateFeedback(errMsg, true);
            return;
          }
          var successMsg = result.data.mesaj || 'Değişiklik talebiniz alındı. Onaylandıktan sonra rezervasyonunuz güncellenecektir.';
          showMesaj(successMsg, false);
          showUpdateFeedback(successMsg, false);
        })
        .catch(function() {
          showMesaj('Sunucuya bağlanılamadı. Sunucunun çalıştığından emin olun.', true);
          showUpdateFeedback('Sunucuya bağlanılamadı. Sunucunun çalıştığından emin olun.', true);
        });
    });
  }

  if (tarihFormDates) {
    tarihFormDates.addEventListener('submit', function(e) {
      e.preventDefault();
      if (!currentReservation) return;
      var newCheckIn = newCheckInInput ? newCheckInInput.value.trim().slice(0, 10) : '';
      var newCheckOut = newCheckOutInput ? newCheckOutInput.value.trim().slice(0, 10) : '';
      var newRoomId = newRoomDatesHidden ? (newRoomDatesHidden.value || '').trim() : (currentReservation.roomId || '');
      if (!newCheckIn || !newCheckOut || newCheckIn >= newCheckOut) {
        showMesaj('Geçerli giriş ve çıkış tarihi seçin.', true);
        return;
      }
      showMesaj('Güncelleniyor…', false);
      fetch(apiBase + '/api/public/reservations/' + encodeURIComponent(currentReservation.id) + '/change-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail, newCheckIn: newCheckIn, newCheckOut: newCheckOut, newRoomId: newRoomId })
      })
        .then(function(res) { return res.json().then(function(data) { return { status: res.status, data: data }; }); })
        .then(function(result) {
          if (result.status !== 200 || !result.data || !result.data.ok) {
            var errMsg = result.data && result.data.mesaj ? result.data.mesaj : 'Güncelleme yapılamadı.';
            showMesaj(errMsg, true);
            showUpdateFeedback(errMsg, true);
            return;
          }
          var successMsg = result.data.mesaj || 'Değişiklik talebiniz alındı. Onaylandıktan sonra rezervasyonunuz güncellenecektir.';
          showMesaj(successMsg, false);
          showUpdateFeedback(successMsg, false);
        })
        .catch(function() {
          showMesaj('Sunucuya bağlanılamadı. Sunucunun çalıştığından emin olun.', true);
          showUpdateFeedback('Sunucuya bağlanılamadı. Sunucunun çalıştığından emin olun.', true);
        });
    });
  }

  if (guestForm) {
    guestForm.addEventListener('submit', function(e) {
      e.preventDefault();
      if (!currentReservation) return;
      var first = (document.getElementById('degisiklik-guest-firstName') && document.getElementById('degisiklik-guest-firstName').value.trim()) || '';
      var last = (document.getElementById('degisiklik-guest-lastName') && document.getElementById('degisiklik-guest-lastName').value.trim()) || '';
      var newEmail = (document.getElementById('degisiklik-guest-email') && document.getElementById('degisiklik-guest-email').value.trim()) || '';
      var phone = (document.getElementById('degisiklik-guest-phone') && document.getElementById('degisiklik-guest-phone').value) ? document.getElementById('degisiklik-guest-phone').value.trim() : '';
      var note = (document.getElementById('degisiklik-guest-note') && document.getElementById('degisiklik-guest-note').value) ? document.getElementById('degisiklik-guest-note').value.trim() : '';
      var guestName = (first + ' ' + last).trim() || (currentReservation.guestName || '');
      if (!guestName || !newEmail) {
        showMesaj('Ad, soyad ve e-posta zorunludur.', true);
        return;
      }
      showMesaj('Güncelleniyor…', false);
      fetch(apiBase + '/api/public/reservations/' + encodeURIComponent(currentReservation.id) + '/change-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail, guestName: guestName, newEmail: newEmail, phone: phone, note: note })
      })
        .then(function(res) { return res.json().then(function(data) { return { status: res.status, data: data }; }); })
        .then(function(result) {
          if (result.status !== 200 || !result.data || !result.data.ok) {
            var errMsg = result.data && result.data.mesaj ? result.data.mesaj : 'Güncelleme yapılamadı.';
            showMesaj(errMsg, true);
            showUpdateFeedback(errMsg, true);
            return;
          }
          currentReservation.guestName = guestName;
          currentReservation.email = newEmail;
          currentReservation.phone = phone;
          currentReservation.note = note;
          if (currentEmail === newEmail) currentEmail = newEmail;
          renderDetay(currentReservation);
          var successMsg = result.data.mesaj || 'Rezervasyon bilgileriniz güncellendi.';
          showMesaj(successMsg, false);
          showUpdateFeedback(successMsg, false);
        })
        .catch(function() {
          showMesaj('Sunucuya bağlanılamadı. Sunucunun çalıştığından emin olun.', true);
          showUpdateFeedback('Sunucuya bağlanılamadı. Sunucunun çalıştığından emin olun.', true);
        });
    });
  }
})();
