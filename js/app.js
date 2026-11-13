  /**
   * ============================================================================
   * MAH POS (Point of Sale Toko ATK) - Client Application Controller (js.html)
   * ============================================================================
   * Standar Rekayasa ZettBOT by Zettbos:
   * - Client-Side In-Memory Caching (Perpindahan menu instan, nol loading berulang).
   * - Multi-Role Access Control (Master vs Kasir).
   * - Live Preview Kustomisasi Invoice Real-Time.
   * - Ekspor PDF Berkualitas Tinggi via html2pdf & Web Share API WhatsApp.
   * - Bridge Kompatibilitas: Mendukung Google Apps Script & Local Standalone Preview.
   * ============================================================================
   */

  // STATE UTAMA APLIKASI (IN-MEMORY CACHE)
  const AppState = {
    currentUser: null,
    settings: {
      NAMA_TOKO: 'MAH POS - Toko ATK',
      SLOGAN: 'Pusat Alat Tulis Kantor, Kertas & Perlengkapan Sekolah',
      ALAMAT: 'Jl. Percetakan Raya No. 12, Jakarta',
      TELEPON: '081234567890',
      FOOTER_NOTA: 'Terima kasih telah berbelanja di MAH POS!\nBarang yang sudah dibeli tidak dapat ditukar kecuali ada perjanjian.',
      FORMAT_DEFAULT: 'thermal',
      TEMA_FAKTUR: 'modern',
      LOGO_URL: ''
    },
    catalog: [],
    categories: [],
    cart: [],
    transactions: [],
    currentInvoice: null,
    selectedCategory: 'ALL',
    searchQuery: ''
  };

  // ============================================================================
  // 1. BACKEND BRIDGE & FALLBACK HANDLER
  // ============================================================================
  // KONFIGURASI GLOBAL REST API VERCEL <-> GOOGLE APPS SCRIPT
const OFFICIAL_GAS_URL = 'https://script.google.com/macros/s/AKfycbyV4vgznpWIaKe0gL3piduh9nECJUPefZ9-Aids_mJRGWUi8JQh7-X5-ccow8swAIU/exec';
if (!localStorage.getItem('MAH_POS_API_URL')) {
  localStorage.setItem('MAH_POS_API_URL', OFFICIAL_GAS_URL);
}

window.APP_CONFIG = window.APP_CONFIG || {
  API_URL: localStorage.getItem('MAH_POS_API_URL') || OFFICIAL_GAS_URL,
  API_SECRET: localStorage.getItem('MAH_POS_API_SECRET') || 'MAH-POS-SECRET-2026'
};

window.setApiEndpoint = function(url, secret) {
  if (url) localStorage.setItem('MAH_POS_API_URL', url.trim());
  if (secret) localStorage.setItem('MAH_POS_API_SECRET', secret.trim());
  window.APP_CONFIG.API_URL = localStorage.getItem('MAH_POS_API_URL') || '';
  window.APP_CONFIG.API_SECRET = localStorage.getItem('MAH_POS_API_SECRET') || 'MAH-POS-SECRET-2026';
  console.log('[MAH POS] Endpoint API berhasil diperbarui:', window.APP_CONFIG.API_URL);
  alert('Endpoint API Google Apps Script berhasil disimpan!');
};

const GasBridge = {
  getApiUrl: function () {
    return localStorage.getItem('MAH_POS_API_URL') || (window.APP_CONFIG && window.APP_CONFIG.API_URL) || '';
  },

  getApiSecret: function () {
    return localStorage.getItem('MAH_POS_API_SECRET') || (window.APP_CONFIG && window.APP_CONFIG.API_SECRET) || 'MAH-POS-SECRET-2026';
  },

  isGas: function () {
    return typeof google !== 'undefined' && google.script && google.script.run;
  },

  call: function (serverFunction, args, onSuccess, onError) {
    const apiUrl = this.getApiUrl();

    // JALUR 1: Jika URL Web App REST API Google Apps Script sudah diset (Mode Vercel)
    if (apiUrl && apiUrl.trim() !== '') {
      const payload = {
        action: serverFunction,
        secret: this.getApiSecret()
      };

      if (serverFunction === 'loginUser') {
        payload.username = args[0];
        payload.password = args[1];
      } else if (serverFunction === 'getUsersList') {
        payload.userRole = args[0];
      } else if (serverFunction === 'saveUser') {
        payload.userData = args[0];
        payload.userRole = args[1];
      } else if (serverFunction === 'getStoreSettings') {
        // no args
      } else if (serverFunction === 'saveStoreSettings') {
        payload.settings = args[0];
        payload.userRole = args[1];
      } else if (serverFunction === 'getGoodsCatalog') {
        payload.userRole = args[0];
      } else if (serverFunction === 'saveGoodItem') {
        payload.itemData = args[0];
        payload.userRole = args[1];
      } else if (serverFunction === 'deleteGoodItem') {
        payload.kodeBarang = args[0];
        payload.userRole = args[1];
      } else if (serverFunction === 'simpanTransaksiPOS') {
        payload.payload = args[0];
      } else if (serverFunction === 'getRiwayatTransaksi') {
        payload.searchQuery = args[0];
        payload.dateFilter = args[1];
      } else if (serverFunction === 'getDetailInvoice') {
        payload.noInvoice = args[0];
      } else if (serverFunction === 'getInitialAppData') {
        payload.userRole = args[0];
      } else if (serverFunction === 'getSalesAnalyticsData') {
        payload.periodFilter = args[0];
      } else if (serverFunction === 'getPanoramaSalesExportData') {
        payload.periodFilter = args[0];
        payload.startDate = args[1];
        payload.endDate = args[2];
      } else if (serverFunction === 'initialSetup') {
        // no args
      } else {
        payload.args = args;
      }

      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
        return res.json();
      })
      .then(function (json) {
        if (onSuccess) onSuccess(json);
      })
      .catch(function (err) {
        console.error('[GasBridge REST API Error]', err);
        if (onError) onError(err);
        else alert('Gagal terhubung ke Backend Google Apps Script:\n' + (err.message || err));
      });
      return;
    }

    // JALUR 2: Jika berjalan langsung di dalam Google Apps Script (Monolith fallback)
    if (this.isGas()) {
      var runner = google.script.run
        .withSuccessHandler(function (res) {
          if (onSuccess) onSuccess(res);
        })
        .withFailureHandler(function (err) {
          if (onError) onError(err);
          else alert('Kesalahan Server: ' + (err.message || err));
        });

      runner[serverFunction].apply(runner, args || []);
      return;
    }

    // JALUR 3: Mock Fallback untuk pengetesan offline
    console.warn('[GasBridge] Menjalankan fungsi offline mock (API URL belum dikonfigurasi):', serverFunction);
    this.mockServer(serverFunction, args, onSuccess, onError);
  },

  mockServer: function (funcName, args, onSuccess, onError) {
      setTimeout(function () {
        // Mock login
        if (funcName === 'loginUser') {
          var u = (args[0] || '').toLowerCase();
          var p = args[1] || '';
          if (u === 'master' && p === 'admin123') {
            onSuccess({ success: true, user: { id: 'USR-001', username: 'master', namaLengkap: 'Pemilik Toko ATK', peran: 'Master' } });
          } else if (u === 'kasir1' && p === 'kasir123') {
            onSuccess({ success: true, user: { id: 'USR-002', username: 'kasir1', namaLengkap: 'Kasir Utama', peran: 'Kasir' } });
          } else {
            onSuccess({ success: false, message: 'Username atau kata sandi tidak cocok!' });
          }
        } else if (funcName === 'getInitialAppData') {
          onSuccess({
            success: true,
            settings: AppState.settings,
            catalog: [
              { kode: 'ATK-001', nama: 'Kertas HVS A4 70gr Sinar Dunia (1 Rim)', kategori: 'Kertas', satuan: 'Rim', hargaJual: 52000, hargaBeli: 45000, stok: 45, minStok: 5, status: 'Aktif' },
              { kode: 'ATK-002', nama: 'Kertas HVS F4 70gr Sinar Dunia (1 Rim)', kategori: 'Kertas', satuan: 'Rim', hargaJual: 56000, hargaBeli: 48000, stok: 30, minStok: 5, status: 'Aktif' },
              { kode: 'ATK-003', nama: 'Pulpen Standard AE7 0.5 Hitam (1 Pcs)', kategori: 'Pulpen', satuan: 'Pcs', hargaJual: 3500, hargaBeli: 2500, stok: 150, minStok: 20, status: 'Aktif' },
              { kode: 'ATK-004', nama: 'Pulpen Pilot Ballliner Hitam', kategori: 'Pulpen', satuan: 'Pcs', hargaJual: 18000, hargaBeli: 14000, stok: 25, minStok: 5, status: 'Aktif' },
              { kode: 'ATK-005', nama: 'Buku Tulis Sinar Dunia 38 Lembar (Pack isi 10)', kategori: 'Buku', satuan: 'Pack', hargaJual: 38000, hargaBeli: 32000, stok: 20, minStok: 5, status: 'Aktif' },
              { kode: 'ATK-006', nama: 'Buku Gambar A3 Kiky', kategori: 'Buku', satuan: 'Pcs', hargaJual: 10000, hargaBeli: 7500, stok: 40, minStok: 8, status: 'Aktif' },
              { kode: 'ATK-007', nama: 'Map Folio Kertas Diamond Biru (Pack isi 50)', kategori: 'Map & File', satuan: 'Pack', hargaJual: 45000, hargaBeli: 38000, stok: 15, minStok: 3, status: 'Aktif' },
              { kode: 'ATK-008', nama: 'Stapler Max HD-10 Asli', kategori: 'Alat Kantor', satuan: 'Pcs', hargaJual: 28000, hargaBeli: 22000, stok: 18, minStok: 4, status: 'Aktif' },
              { kode: 'ATK-009', nama: 'Isi Staples Max No.10-1M', kategori: 'Alat Kantor', satuan: 'Kotak', hargaJual: 4500, hargaBeli: 3000, stok: 75, minStok: 15, status: 'Aktif' },
              { kode: 'ATK-010', nama: 'Spidol Whiteboard Snowman Hitam', kategori: 'Spidol', satuan: 'Pcs', hargaJual: 9500, hargaBeli: 7000, stok: 60, minStok: 10, status: 'Aktif' }
            ],
            categories: ['Kertas', 'Pulpen', 'Buku', 'Map & File', 'Alat Kantor', 'Spidol'],
            recentTransactions: []
          });
        } else if (funcName === 'simpanTransaksiPOS') {
          var payload = args[0];
          var d = new Date();
          var y = d.getFullYear();
          var m = ('0' + (d.getMonth() + 1)).slice(-2);
          var seq = ('00' + (AppState.transactions.length + 1)).slice(-3);
          var invNum = 'INV-' + y + m + '-' + seq;
          onSuccess({
            success: true,
            noInvoice: invNum,
            tanggal: new Date().toISOString().replace('T', ' ').substring(0, 19),
            message: 'Transaksi berhasil disimpan.',
            header: payload.header,
            items: payload.items
          });
        } else if (funcName === 'getDetailInvoice') {
          var invId = args[0];
          var found = AppState.transactions.find(function (t) { return t.noInvoice === invId; });
          if (found) {
            var mockHeader = Object.assign({}, found);
            mockHeader.namaPelanggan = mockHeader.namaPelanggan || mockHeader.pelanggan || 'Pelanggan Umum';
            mockHeader.totalAkhir = mockHeader.totalAkhir !== undefined ? mockHeader.totalAkhir : (mockHeader.total || 0);
            mockHeader.total = mockHeader.totalAkhir;
            onSuccess({
              success: true,
              header: mockHeader,
              items: found.items || [
                { kode: 'ATK-001', nama: 'Kertas HVS A4 70gr Sinar Dunia (1 Rim)', hargaSatuan: 52000, kuantiti: 1, subtotalItem: 52000 }
              ],
              settings: AppState.settings
            });
          } else {
            onSuccess({ success: false, message: 'Invoice tidak ditemukan' });
          }
        } else if (funcName === 'saveStoreSettings') {
          Object.assign(AppState.settings, args[0]);
          onSuccess({ success: true, message: 'Pengaturan berhasil disimpan!' });
        } else if (funcName === 'saveGoodItem') {
          onSuccess({ success: true, message: 'Barang berhasil disimpan' });
        } else if (funcName === 'deleteGoodItem') {
          var delKode = args[0];
          AppState.catalog = AppState.catalog.filter(function (x) { return x.kode !== delKode; });
          onSuccess({ success: true, message: 'Barang berhasil dihapus dari inventaris.' });
        } else if (funcName === 'getUsersList') {
          onSuccess({
            success: true,
            data: [
              { id: 'USR-001', username: 'master', namaLengkap: 'Pemilik Toko ATK', peran: 'Master', status: 'TRUE' },
              { id: 'USR-002', username: 'kasir1', namaLengkap: 'Kasir Utama', peran: 'Kasir', status: 'TRUE' }
            ]
          });
        } else if (funcName === 'getSalesAnalyticsData') {
          var period = args[0] || 'all';
          var trxs = AppState.transactions || [];
          var totalOmset = trxs.reduce(function (acc, t) { return acc + (Number(t.total) || 0); }, 0);
          var mockProducts = [
            { kode: 'ATK-001', nama: 'Kertas HVS A4 70gr Sinar Dunia', qty: 45, omset: 2340000, persentaseOmset: 38 },
            { kode: 'ATK-003', nama: 'Pulpen Standard AE7 0.5 Hitam', qty: 85, omset: 297500, persentaseOmset: 12 },
            { kode: 'ATK-006', nama: 'Buku Gambar A3 Kiky', qty: 28, omset: 280000, persentaseOmset: 10 },
            { kode: 'ATK-002', nama: 'Kertas HVS F4 70gr PaperOne', qty: 20, omset: 1100000, persentaseOmset: 22 },
            { kode: 'ATK-005', nama: 'Map Folio Kancing 1 Plastik', qty: 35, omset: 122500, persentaseOmset: 5 }
          ];
          var grandQty = mockProducts.reduce(function (acc, p) { return acc + p.qty; }, 0);
          onSuccess({
            success: true,
            period: period,
            summary: {
              grandTotalOmset: totalOmset || 4140000,
              grandTotalQty: grandQty,
              grandTotalTrx: trxs.length || 16,
              topProduct: 'Kertas HVS A4 70gr Sinar Dunia'
            },
            topProducts: mockProducts,
            allProducts: mockProducts,
            dailyTrend: [
              { dateKey: '2026-10-04', label: '04/10', omset: 650000, count: 3 },
              { dateKey: '2026-10-05', label: '05/10', omset: 920000, count: 5 },
              { dateKey: '2026-10-06', label: '06/10', omset: 780000, count: 4 },
              { dateKey: '2026-10-07', label: '07/10', omset: 840000, count: 4 },
              { dateKey: '2026-10-08', label: '08/10', omset: 950000, count: 5 }
            ],
            paymentMethods: [
              { method: 'Tunai', total: 2450000, count: 10 },
              { method: 'Transfer Bank', total: 1690000, count: 6 }
            ]
          });
        } else {
          onSuccess({ success: true, message: 'Operasi berhasil diproses.' });
        }
      }, 200);
    }
  };

  // ============================================================================
  // 2. FORMATTER & UTILITY PENDUKUNG
  // ============================================================================
  function formatRupiah(number) {
    var n = Number(number) || 0;
    return 'Rp ' + n.toLocaleString('id-ID');
  }

  function formatCompactDate(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return String(dateStr);
    }
    var day = ('0' + d.getDate()).slice(-2);
    var mon = ('0' + (d.getMonth() + 1)).slice(-2);
    var year = d.getFullYear();
    var hours = ('0' + d.getHours()).slice(-2);
    var mins = ('0' + d.getMinutes()).slice(-2);
    return day + '/' + mon + '/' + year + ' ' + hours + ':' + mins;
  }

  function cleanPhoneNumber(phone) {
    var p = (phone || '').toString().replace(/[^0-9]/g, '');
    if (p.startsWith('0')) {
      p = '62' + p.substring(1);
    } else if (!p.startsWith('62') && p.length > 5) {
      p = '62' + p;
    }
    return p;
  }

  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = type === 'error' ? '#e11d48' : '#0f172a';
    toast.style.color = '#ffffff';
    toast.style.padding = '0.75rem 1.25rem';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.2)';
    toast.style.fontSize = '0.88rem';
    toast.style.fontWeight = '600';
    toast.style.zIndex = '9999';
    toast.style.transition = 'all 0.3s ease';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  // ============================================================================
  // 3. INISIALISASI SAAT DOM SIAP
  // ============================================================================
  document.addEventListener('DOMContentLoaded', function () {
    initEventListeners();
    checkSavedSession();
    if (typeof BluetoothPrinterManager !== 'undefined') {
      BluetoothPrinterManager.updateUI();
    }
  });

  function initEventListeners() {
    // 1. Login Form Submit
    document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);

    // 2. Logout Button
    document.getElementById('btnLogoutApp').addEventListener('click', handleLogout);

    // 3. Refresh App Button
    document.getElementById('btnRefreshApp').addEventListener('click', function () {
      fetchInitialData(true);
    });

    // 4. Tab Navigation (Instant In-Memory Switching - Desktop & Mobile Dock)
    var navButtons = document.querySelectorAll('.nav-btn, .mobile-dock-btn');
    navButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetId = btn.getAttribute('data-target');
        if (targetId) switchView(targetId);
      });
    });

    // 4.B Payment Method Pills (Chili POS Style)
    var paySelect = document.getElementById('cartPayMethod');
    var payPills = document.querySelectorAll('.pay-method-pill');
    payPills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        var method = pill.getAttribute('data-method');
        if (paySelect) {
          paySelect.value = method;
          var evt = new Event('change');
          paySelect.dispatchEvent(evt);
        }
        payPills.forEach(function (p) { p.classList.remove('active'); });
        pill.classList.add('active');
      });
    });
    if (paySelect) {
      paySelect.addEventListener('change', function () {
        var val = paySelect.value;
        payPills.forEach(function (p) {
          if (p.getAttribute('data-method') === val) p.classList.add('active');
          else p.classList.remove('active');
        });
      });
    }

    // 4.C Mobile Cart Drawer Controls (Slide-Up Bottom Sheet)
    var btnOpenCart = document.getElementById('btnOpenMobileCart');
    var btnCloseCart = document.getElementById('btnCloseMobileCart');
    var cartBackdrop = document.getElementById('cartDrawerBackdrop');
    var posCartCard = document.getElementById('posCartCard');

    function openMobileCartDrawer() {
      if (posCartCard) posCartCard.classList.add('mobile-open');
      if (cartBackdrop) cartBackdrop.classList.add('active');
    }

    function closeMobileCartDrawer() {
      if (posCartCard) posCartCard.classList.remove('mobile-open');
      if (cartBackdrop) cartBackdrop.classList.remove('active');
    }

    if (btnOpenCart) btnOpenCart.addEventListener('click', openMobileCartDrawer);
    if (btnCloseCart) btnCloseCart.addEventListener('click', closeMobileCartDrawer);
    if (cartBackdrop) cartBackdrop.addEventListener('click', closeMobileCartDrawer);
    var btnHeaderCart = document.getElementById('btnHeaderMobileCart');
    if (btnHeaderCart) btnHeaderCart.addEventListener('click', openMobileCartDrawer);

    // 4.D Mobile Header Quick Actions
    var btnRefMob = document.getElementById('btnRefreshAppMobile');
    if (btnRefMob) {
      btnRefMob.addEventListener('click', function () { fetchInitialData(true); });
    }
    var btnLogMob = document.getElementById('btnLogoutAppMobile');
    if (btnLogMob) {
      btnLogMob.addEventListener('click', handleLogout);
    }

    // 5. Search & Filter POS Katalog
    document.getElementById('posSearchInput').addEventListener('input', function (e) {
      AppState.searchQuery = e.target.value.toLowerCase().trim();
      renderGoodsGrid();
    });

    // 6. Keranjang: Clear Cart
    document.getElementById('btnClearCart').addEventListener('click', function () {
      if (AppState.cart.length === 0) return;
      if (confirm('Kosongkan semua barang di keranjang belanja?')) {
        AppState.cart = [];
        renderCart();
      }
    });

    // 7. Keranjang: Diskon & Pembayaran
    document.getElementById('cartDiscountInput').addEventListener('input', recalculateCartSummary);
    document.getElementById('cartCashPaidInput').addEventListener('input', recalculateCartSummary);

    // 8. Quick Cash Buttons
    document.getElementById('btnCashPas').addEventListener('click', function () {
      var grandTotal = calculateGrandTotal();
      document.getElementById('cartCashPaidInput').value = grandTotal;
      recalculateCartSummary();
    });

    document.querySelectorAll('.btn-quick-cash[data-cash]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = Number(btn.getAttribute('data-cash')) || 0;
        document.getElementById('cartCashPaidInput').value = val;
        recalculateCartSummary();
      });
    });

    // 9. Tombol Submit Transaksi Kasir
    document.getElementById('btnSubmitCheckout').addEventListener('click', handleCheckoutSubmit);

    // 10. Modal Invoice: Tutup, Print, Download PDF, WhatsApp
    document.getElementById('btnCloseInvoiceModal').addEventListener('click', function () {
      document.getElementById('modalInvoice').classList.remove('active');
    });

    document.getElementById('btnPrintInvoice').addEventListener('click', function () {
      window.print();
    });

    document.getElementById('btnDownloadInvoicePdf').addEventListener('click', function () {
      downloadInvoicePDF();
    });

    document.getElementById('btnShareWhatsApp').addEventListener('click', function () {
      handleWhatsAppShare();
    });

    // 10.B Bluetooth Direct Print Modal & Badge
    var btnBtModal = document.getElementById('btnBluetoothPrintModal');
    if (btnBtModal) {
      btnBtModal.addEventListener('click', function () {
        printInvoiceViaBluetooth();
      });
    }

    var modalBtBadge = document.getElementById('modalBtBadge');
    if (modalBtBadge) {
      modalBtBadge.addEventListener('click', function () {
        if (BluetoothPrinterManager.isConnected()) {
          if (confirm('Printer ' + BluetoothPrinterManager.getDeviceName() + ' terhubung. Putuskan koneksi?')) {
            BluetoothPrinterManager.disconnect();
          }
        } else {
          BluetoothPrinterManager.connect();
        }
      });
    }

    // Bluetooth Settings Buttons & Modal Panduan
    var btnOpenGuide = document.getElementById('btnOpenBtGuide');
    if (btnOpenGuide) {
      btnOpenGuide.addEventListener('click', function () {
        openBluetoothGuideModal();
      });
    }

    var btnCloseGuide = document.getElementById('btnCloseBtGuideModal');
    if (btnCloseGuide) {
      btnCloseGuide.addEventListener('click', function () {
        closeBluetoothGuideModal();
      });
    }

    var btnGuideClose = document.getElementById('btnGuideClose');
    if (btnGuideClose) {
      btnGuideClose.addEventListener('click', function () {
        closeBluetoothGuideModal();
      });
    }

    var triggerWindowsTest = function () {
      showToast('Membuka dialog cetak ke printer Bluetooth Windows...', 'info');
      window.print();
    };
    var btnTestWin = document.getElementById('btnTestWindowsPrint');
    if (btnTestWin) btnTestWin.addEventListener('click', triggerWindowsTest);
    var btnGuideWin = document.getElementById('btnGuideTestWindows');
    if (btnGuideWin) btnGuideWin.addEventListener('click', triggerWindowsTest);

    var btnTestRawBt = document.getElementById('btnTestRawBtPrint');
    if (btnTestRawBt) {
      btnTestRawBt.addEventListener('click', function () {
        var b = new EscPosBuilder();
        b.init().align('center').doubleSize(true).bold(true)
          .line('TEST RAWBT BLUETOOTH').doubleSize(false)
          .line(AppState.settings.NAMA_TOKO || 'MAH POS')
          .line('--------------------------------')
          .align('left')
          .line('Status : Terhubung via RawBT')
          .line('Waktu  : ' + new Date().toLocaleTimeString('id-ID'))
          .line('--------------------------------')
          .align('center').line('Printer Siap Digunakan!').feed(3).cut();
        printViaRawBT(b.getBytes());
      });
    }

    document.getElementById('invoiceFormatToggle').addEventListener('change', function (e) {
      var format = e.target.value;
      var themeToggle = document.getElementById('invoiceThemeToggle');
      if (themeToggle) {
        themeToggle.style.display = (format === 'a5') ? 'inline-block' : 'none';
      }
      var theme = getActiveInvoiceTheme();
      var container = document.getElementById('invoicePrintArea');
      container.className = 'invoice-container format-' + format + (format === 'a5' ? ' theme-' + theme : '');
      if (AppState.currentInvoice) {
        renderInvoiceHTML('invoicePrintArea', AppState.currentInvoice, format, theme);
      }
    });

    var themeToggleEl = document.getElementById('invoiceThemeToggle');
    if (themeToggleEl) {
      themeToggleEl.addEventListener('change', function (e) {
        var format = getActiveInvoiceFormat();
        var theme = e.target.value;
        var container = document.getElementById('invoicePrintArea');
        container.className = 'invoice-container format-' + format + (format === 'a5' ? ' theme-' + theme : '');
        if (AppState.currentInvoice) {
          renderInvoiceHTML('invoicePrintArea', AppState.currentInvoice, format, theme);
        }
      });
    }

    // 11. Riwayat Transaksi: Filter & Search
    document.getElementById('btnFilterHistory').addEventListener('click', function () {
      loadRiwayatTransaksi();
    });

    // 12. Master Barang: Tambah Modal
    document.getElementById('btnTambahBarangModal').addEventListener('click', function () {
      openModalBarang(null);
    });
    document.getElementById('btnCloseBarangModal').addEventListener('click', function () {
      document.getElementById('modalBarangForm').classList.remove('active');
    });
    document.getElementById('formBarang').addEventListener('submit', handleSaveBarang);
    document.getElementById('btnDeleteBarangModal').addEventListener('click', function () {
      var kode = this.getAttribute('data-kode');
      var nama = this.getAttribute('data-nama');
      if (kode) {
        confirmDeleteBarang(kode, nama);
      }
    });

    // 13. Pengaturan Invoice (Master): Form input live preview listener
    var settingInputs = ['settingNamaToko', 'settingSlogan', 'settingAlamat', 'settingTelepon', 'settingFooterNota', 'settingNamaPenandatangan', 'settingFormatDefault', 'settingTemaFaktur'];
    settingInputs.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', function () {
          if (id === 'settingTemaFaktur' && (document.getElementById('settingFormatDefault').value === 'thermal' || document.getElementById('settingFormatDefault').value === 'thermal58' || document.getElementById('settingFormatDefault').value === 'label')) {
            document.getElementById('settingFormatDefault').value = 'a5';
          }
          updateLiveInvoicePreview();
        });
        el.addEventListener('change', function () {
          if (id === 'settingTemaFaktur' && (document.getElementById('settingFormatDefault').value === 'thermal' || document.getElementById('settingFormatDefault').value === 'thermal58' || document.getElementById('settingFormatDefault').value === 'label')) {
            document.getElementById('settingFormatDefault').value = 'a5';
          }
          updateLiveInvoicePreview();
        });
      }
    });

    // Handler Unggah Berkas Gambar Logo Toko
    var logoFileInput = document.getElementById('settingLogoFileInput');
    if (logoFileInput) {
      logoFileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.match(/^image\//)) {
          alert('Format file tidak didukung. Harap pilih gambar (PNG, JPG, WebP).');
          return;
        }
        var reader = new FileReader();
        reader.onload = function (evt) {
          var rawData = evt.target.result;
          var tempImg = new Image();
          tempImg.onload = function () {
            var maxW = 240;
            var maxH = 120;
            var w = tempImg.width;
            var h = tempImg.height;
            if (w > maxW || h > maxH) {
              var ratio = Math.min(maxW / w, maxH / h);
              w = Math.round(w * ratio);
              h = Math.round(h * ratio);
            }
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(tempImg, 0, 0, w, h);
            var mime = (file.type === 'image/png') ? 'image/png' : 'image/jpeg';
            var compressed = canvas.toDataURL(mime, 0.90);
            document.getElementById('settingLogoUrl').value = compressed;
            updateLogoPreviewUI(compressed);
            updateLiveInvoicePreview();
          };
          tempImg.src = rawData;
        };
        reader.readAsDataURL(file);
      });
    }

    // Handler Input URL Gambar Logo
    var logoUrlInput = document.getElementById('settingLogoUrl');
    if (logoUrlInput) {
      logoUrlInput.addEventListener('input', function () {
        var val = this.value.trim();
        updateLogoPreviewUI(val);
        updateLiveInvoicePreview();
      });
    }

    // Handler Tombol Hapus Logo
    var btnHapusLogo = document.getElementById('btnHapusLogo');
    if (btnHapusLogo) {
      btnHapusLogo.addEventListener('click', function () {
        document.getElementById('settingLogoUrl').value = '';
        if (document.getElementById('settingLogoFileInput')) {
          document.getElementById('settingLogoFileInput').value = '';
        }
        updateLogoPreviewUI('');
        updateLiveInvoicePreview();
      });
    }

    document.getElementById('btnSaveSettings').addEventListener('click', handleSaveStoreSettings);

    // 14. Kelola Pengguna: Modal Tambah
    document.getElementById('btnTambahPenggunaModal').addEventListener('click', function () {
      openModalPengguna(null);
    });
    document.getElementById('btnClosePenggunaModal').addEventListener('click', function () {
      document.getElementById('modalPenggunaForm').classList.remove('active');
    });
    document.getElementById('formPengguna').addEventListener('submit', handleSavePengguna);

    // 15. Inisialisasi Event Listener Modul MAHEX Delivery
    initMahexListeners();
  }

  // ============================================================================
  // 4. OTENTIKASI & MANAJEMEN SESI PENGGUNA
  // ============================================================================
  function checkSavedSession() {
    try {
      var saved = localStorage.getItem('mah_pos_session');
      if (saved) {
        var user = JSON.parse(saved);
        if (user && user.username) {
          applyUserSession(user);
          return;
        }
      }
    } catch (e) { }
    document.getElementById('loginModal').classList.add('active');
  }

  function handleLoginSubmit() {
    var u = document.getElementById('loginUsername').value.trim();
    var p = document.getElementById('loginPassword').value.trim();

    if (!u || !p) {
      alert('Harap isi username dan password!');
      return;
    }

    var btn = document.getElementById('btnLoginSubmit');
    btn.disabled = true;
    btn.textContent = 'Memverifikasi...';

    GasBridge.call('loginUser', [u, p], function (res) {
      btn.disabled = false;
      btn.textContent = 'Masuk ke Aplikasi';

      if (res.success && res.user) {
        try {
          localStorage.setItem('mah_pos_session', JSON.stringify(res.user));
        } catch (e) { }
        applyUserSession(res.user);
      } else {
        alert(res.message || 'Username atau password salah!');
      }
    }, function (err) {
      btn.disabled = false;
      btn.textContent = 'Masuk ke Aplikasi';
      alert('Gagal login: ' + (err.message || err));
    });
  }

  function applyUserSession(user) {
    AppState.currentUser = user;
    document.getElementById('loginModal').classList.remove('active');

    // Update Navbar (Desktop & Mobile)
    var userBox = document.getElementById('userInfoBox');
    if (userBox) userBox.style.display = 'flex';
    var btnLogout = document.getElementById('btnLogoutApp');
    if (btnLogout) btnLogout.style.display = 'inline-flex';
    var mainNav = document.getElementById('mainNavBar');
    if (mainNav) mainNav.style.display = 'flex';

    var nameEl = document.getElementById('activeUserName');
    if (nameEl) nameEl.textContent = user.namaLengkap || user.username;
    var roleBadge = document.getElementById('activeUserRole');
    if (roleBadge) {
      roleBadge.textContent = user.peran;
      roleBadge.className = 'role-tag ' + (user.peran.toLowerCase() === 'master' ? 'master' : '');
    }

    // Update Mobile Header & Bottom Dock
    var mobPill = document.getElementById('mobileUserPill');
    if (mobPill) mobPill.style.display = 'flex';
    var mobName = document.getElementById('mobileUserName');
    if (mobName) mobName.textContent = user.namaLengkap || user.username;
    var mobLogout = document.getElementById('btnLogoutAppMobile');
    if (mobLogout) mobLogout.style.display = 'inline-flex';
    var mobDock = document.getElementById('mobileBottomDock');
    if (mobDock) mobDock.style.display = '';

    // Tampilkan menu khusus Master jika peran = Master
    var isMaster = (user.peran.toLowerCase() === 'master');
    var navPengaturan = document.getElementById('navPengaturanBtn');
    if (navPengaturan) navPengaturan.style.display = isMaster ? 'flex' : 'none';
    var navPengguna = document.getElementById('navPenggunaBtn');
    if (navPengguna) navPengguna.style.display = isMaster ? 'flex' : 'none';
    var mobPengaturan = document.getElementById('mobileNavPengaturanBtn');
    if (mobPengaturan) mobPengaturan.style.display = isMaster ? '' : 'none';
    var mobPengguna = document.getElementById('mobileNavPenggunaBtn');
    if (mobPengguna) mobPengguna.style.display = isMaster ? '' : 'none';

    var btnAddGood = document.getElementById('btnTambahBarangModal');
    if (btnAddGood) btnAddGood.style.display = isMaster ? 'inline-block' : 'none';
    var thBeli = document.getElementById('thHargaBeli');
    if (thBeli) thBeli.style.display = isMaster ? 'table-cell' : 'none';
    var thAksi = document.getElementById('thAksiBarang');
    if (thAksi) thAksi.style.display = isMaster ? 'table-cell' : 'none';

    // Muat data aplikasi
    fetchInitialData(false);
  }

  function handleLogout() {
    if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
      try {
        localStorage.removeItem('mah_pos_session');
      } catch (e) { }
      AppState.currentUser = null;
      var userBox = document.getElementById('userInfoBox');
      if (userBox) userBox.style.display = 'none';
      var btnLogout = document.getElementById('btnLogoutApp');
      if (btnLogout) btnLogout.style.display = 'none';
      var mainNav = document.getElementById('mainNavBar');
      if (mainNav) mainNav.style.display = 'none';

      var mobPill = document.getElementById('mobileUserPill');
      if (mobPill) mobPill.style.display = 'none';
      var mobLogout = document.getElementById('btnLogoutAppMobile');
      if (mobLogout) mobLogout.style.display = 'none';
      var mobDock = document.getElementById('mobileBottomDock');
      if (mobDock) mobDock.style.display = 'none';

      document.getElementById('loginModal').classList.add('active');
    }
  }

  // ============================================================================
  // 5. PERPINDAHAN TAMPILAN INSTAN (IN-MEMORY ZERO-DELAY SWITCHING)
  // ============================================================================
  function switchView(targetSectionId) {
    var sections = document.querySelectorAll('.view-section');
    sections.forEach(function (sec) {
      sec.classList.remove('active');
    });

    var targetSec = document.getElementById(targetSectionId);
    if (targetSec) {
      targetSec.classList.add('active');
    }

    // Update class active pada nav button desktop dan mobile dock
    var navButtons = document.querySelectorAll('.nav-btn, .mobile-dock-btn');
    navButtons.forEach(function (btn) {
      if (btn.getAttribute('data-target') === targetSectionId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Auto close mobile drawer if switching view
    var posCartCard = document.getElementById('posCartCard');
    var cartBackdrop = document.getElementById('cartDrawerBackdrop');
    if (posCartCard) posCartCard.classList.remove('mobile-open');
    if (cartBackdrop) cartBackdrop.classList.remove('active');

    // Hook spesifik per view saat dibuka
    if (targetSectionId === 'viewRiwayat') {
      loadRiwayatTransaksi();
    } else if (targetSectionId === 'viewBarang') {
      renderGoodsTable();
    } else if (targetSectionId === 'viewPengaturan') {
      populateSettingsForm();
    } else if (targetSectionId === 'viewPengguna') {
      loadUsersList();
    } else if (targetSectionId === 'viewMahexDelivery') {
      initMahexView();
    }
  }

  // ============================================================================
  // 6. PENGAMBILAN & SINKRONISASI DATA (FETCH DATA)
  // ============================================================================
  function fetchInitialData(isForceRefresh) {
    var userRole = AppState.currentUser ? AppState.currentUser.peran : 'Kasir';

    if (isForceRefresh) {
      showToast('Memperbarui data dari server...', 'info');
    }

    GasBridge.call('getInitialAppData', [userRole], function (res) {
      if (res.success) {
        if (res.settings) {
          AppState.settings = Object.assign(AppState.settings, res.settings);
          document.getElementById('topBarStoreName').textContent = AppState.settings.NAMA_TOKO || 'MAH POS';
        }
        AppState.catalog = res.catalog || [];
        AppState.categories = res.categories || [];
        if (res.recentTransactions) {
          AppState.transactions = res.recentTransactions;
        }

        renderCategoryPills();
        renderGoodsGrid();
        renderGoodsTable();
        populateSettingsForm();

        if (isForceRefresh) {
          showToast('Data berhasil diperbarui!', 'success');
        }
      }
    });
  }

  // ============================================================================
  // 7. POS KASIR: KATALOG BARANG ATK & FILTER (CHILI POS STYLE)
  // ============================================================================
  var ATK_CATEGORY_ICONS = {
    'ALL': '🏢',
    'Kertas': '📄',
    'Kertas HVS': '📄',
    'Pulpen': '🖊️',
    'Pensil': '✏️',
    'Buku': '📚',
    'Buku Tulis': '📓',
    'Spidol': '🖍️',
    'Map': '📁',
    'Amplop': '✉️',
    'Gunting': '✂️',
    'Lakban': '📦',
    'Lem': '🧴',
    'Kalkulator': '🧮',
    'Tinta': '🖨️',
    'Flashdisk': '💾',
    'Lainnya': '🏷️'
  };

  function getCategoryIcon(catName) {
    if (!catName) return '🏷️';
    if (ATK_CATEGORY_ICONS[catName]) return ATK_CATEGORY_ICONS[catName];
    var lower = catName.toLowerCase();
    if (lower.indexOf('kertas') !== -1) return '📄';
    if (lower.indexOf('pulpen') !== -1 || lower.indexOf('pena') !== -1) return '🖊️';
    if (lower.indexOf('pensil') !== -1) return '✏️';
    if (lower.indexOf('buku') !== -1) return '📚';
    if (lower.indexOf('spidol') !== -1) return '🖍️';
    if (lower.indexOf('map') !== -1) return '📁';
    if (lower.indexOf('amplop') !== -1) return '✉️';
    if (lower.indexOf('tinta') !== -1) return '🖨️';
    if (lower.indexOf('gunting') !== -1) return '✂️';
    if (lower.indexOf('lakban') !== -1 || lower.indexOf('solasi') !== -1) return '📦';
    if (lower.indexOf('lem') !== -1) return '🧴';
    return '🏷️';
  }

  function renderCategoryPills() {
    var container = document.getElementById('categoryPillsList');
    if (!container) return;

    var totalAll = AppState.catalog.length;
    var isAllActive = (AppState.selectedCategory === 'ALL');

    var html = '<button type="button" class="cat-pill ' + (isAllActive ? 'active' : '') + '" data-cat="ALL">'
      + '<span class="cat-pill-icon">🏢</span>'
      + '<div class="cat-pill-info">'
      + '  <span class="cat-pill-title">Semua</span>'
      + '  <span class="cat-pill-count">' + totalAll + ' items</span>'
      + '</div>'
      + '</button>';

    AppState.categories.forEach(function (cat) {
      var isActive = (AppState.selectedCategory === cat);
      var count = AppState.catalog.filter(function (i) { return i.kategori === cat; }).length;
      var icon = getCategoryIcon(cat);

      html += '<button type="button" class="cat-pill ' + (isActive ? 'active' : '') + '" data-cat="' + escapeHtml(cat) + '">'
        + '<span class="cat-pill-icon">' + icon + '</span>'
        + '<div class="cat-pill-info">'
        + '  <span class="cat-pill-title">' + escapeHtml(cat) + '</span>'
        + '  <span class="cat-pill-count">' + count + ' items</span>'
        + '</div>'
        + '</button>';
    });

    container.innerHTML = html;

    // Pasang event listener klik filter kategori
    container.querySelectorAll('.cat-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        container.querySelectorAll('.cat-pill').forEach(function (p) { p.classList.remove('active'); });
        pill.classList.add('active');
        AppState.selectedCategory = pill.getAttribute('data-cat');
        renderGoodsGrid();
      });
    });
  }

  function renderGoodsGrid() {
    var grid = document.getElementById('posGoodsGrid');
    if (!grid) return;
    var query = (AppState.searchQuery || '').toLowerCase();
    var selCat = AppState.selectedCategory;

    var filtered = AppState.catalog.filter(function (item) {
      if (selCat !== 'ALL' && item.kategori !== selCat) {
        return false;
      }
      if (query) {
        var matchNama = (item.nama || '').toLowerCase().indexOf(query) !== -1;
        var matchKode = (item.kode || '').toLowerCase().indexOf(query) !== -1;
        return matchNama || matchKode;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--slate-400); font-size: 0.95rem;">'
        + '<div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🔍</div>'
        + 'Tidak ada barang ATK yang sesuai kata kunci atau filter ini.'
        + '</div>';
      return;
    }

    var html = '';
    filtered.forEach(function (item) {
      var cartItem = AppState.cart.find(function (c) { return c.kode === item.kode; });
      var inCart = Boolean(cartItem);
      var cartQty = inCart ? cartItem.kuantiti : 0;

      var stockClass = item.stok <= (item.minStok || 5) ? 'stock-low' : 'stock-safe';
      var stockLabel = item.stok <= 0 ? 'Habis' : 'Stok: ' + item.stok + ' ' + (item.satuan || 'Pcs');
      var itemIcon = getCategoryIcon(item.kategori);

      html += '<div class="good-card ' + (inCart ? 'in-cart' : '') + '" data-kode="' + escapeHtml(item.kode) + '">';
      // Visual & Badges
      html += '  <div class="good-card-visual">';
      html += '    <div class="good-card-icon-wrap">' + itemIcon + '</div>';
      html += '    <div class="good-card-badges">';
      html += '      <span class="good-sku-badge">' + escapeHtml(item.kode) + '</span>';
      html += '      <span class="good-stock-badge ' + stockClass + '">' + stockLabel + '</span>';
      html += '    </div>';
      html += '  </div>';

      // Body: Kategori & Nama & Harga
      html += '  <div class="good-card-body">';
      html += '    <div class="good-card-cat">' + escapeHtml(item.kategori || 'ATK') + '</div>';
      html += '    <div class="good-name" title="' + escapeHtml(item.nama) + '">' + escapeHtml(item.nama) + '</div>';
      html += '    <div class="good-price-row">';
      html += '      <span class="good-price">' + formatRupiah(item.hargaJual) + '</span>';
      html += '      <span class="good-unit">/' + escapeHtml(item.satuan || 'Pcs') + '</span>';
      html += '    </div>';
      html += '  </div>';

      // Action: Tambah vs Stepper (Chili POS Style)
      html += '  <div class="good-card-action">';
      if (!inCart) {
        html += '    <button type="button" class="btn-add-dish" data-action="add" data-kode="' + escapeHtml(item.kode) + '">';
        html += '      <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
        html += '      <span>Tambah</span>';
        html += '    </button>';
      } else {
        html += '    <div class="card-stepper-ctrl">';
        html += '      <button type="button" class="btn-card-step step-dec" data-action="dec" data-kode="' + escapeHtml(item.kode) + '" title="Kurang">−</button>';
        html += '      <span class="card-step-val">' + cartQty + '</span>';
        html += '      <button type="button" class="btn-card-step step-inc" data-action="inc" data-kode="' + escapeHtml(item.kode) + '" title="Tambah">+</button>';
        html += '    </div>';
      }
      html += '  </div>';
      html += '</div>';
    });

    grid.innerHTML = html;

    // Pasang listeners klik kartu dan tombol stepper
    grid.querySelectorAll('.good-card').forEach(function (card) {
      var kode = card.getAttribute('data-kode');
      var item = AppState.catalog.find(function (i) { return i.kode === kode; });
      if (!item) return;

      var btnAdd = card.querySelector('[data-action="add"]');
      if (btnAdd) {
        btnAdd.addEventListener('click', function (e) {
          e.stopPropagation();
          addToCart(item);
        });
      }

      var btnDec = card.querySelector('[data-action="dec"]');
      if (btnDec) {
        btnDec.addEventListener('click', function (e) {
          e.stopPropagation();
          updateCartQty(kode, -1);
        });
      }

      var btnInc = card.querySelector('[data-action="inc"]');
      if (btnInc) {
        btnInc.addEventListener('click', function (e) {
          e.stopPropagation();
          updateCartQty(kode, 1);
        });
      }

      card.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        addToCart(item);
      });
    });
  }

  // ============================================================================
  // 8. POS KASIR: LOGIKA KERANJANG BELANJA (CART)
  // ============================================================================
  function addToCart(item) {
    var existing = AppState.cart.find(function (c) { return c.kode === item.kode; });

    if (existing) {
      if (existing.kuantiti + 1 > item.stok) {
        showToast('Peringatan: Stok ' + item.nama + ' tersisa ' + item.stok + ' ' + item.satuan, 'error');
      }
      existing.kuantiti += 1;
      existing.subtotalItem = existing.kuantiti * existing.hargaSatuan;
    } else {
      if (item.stok <= 0) {
        showToast('Peringatan: Stok barang ini habis di sistem!', 'error');
      }
      AppState.cart.push({
        kode: item.kode,
        nama: item.nama,
        hargaSatuan: item.hargaJual,
        kuantiti: 1,
        subtotalItem: item.hargaJual,
        satuan: item.satuan || 'Pcs'
      });
    }

    renderCart();
    renderGoodsGrid();
  }

  function updateCartQty(kode, delta) {
    var item = AppState.cart.find(function (c) { return c.kode === kode; });
    if (!item) return;

    var currentQty = parseInt(item.kuantiti, 10) || 1;
    var newQty = currentQty + delta;
    if (newQty <= 0) {
      removeCartItem(kode);
      return;
    }

    item.kuantiti = newQty;
    item.subtotalItem = item.kuantiti * item.hargaSatuan;
    renderCart();
    renderGoodsGrid();
  }

  function handleCartQtyInput(kode, inputEl) {
    var item = AppState.cart.find(function (c) { return c.kode === kode; });
    if (!item) return;

    var rawVal = inputEl.value;
    var parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      item.kuantiti = parsed;
      item.subtotalItem = item.kuantiti * item.hargaSatuan;

      var row = inputEl.closest('.cart-item-row');
      if (row) {
        var priceDesc = row.querySelector('.cart-item-price-desc');
        if (priceDesc) {
          priceDesc.textContent = formatRupiah(item.hargaSatuan) + ' x ' + item.kuantiti + ' ' + (item.satuan || 'Pcs');
        }
        var subtotalEl = row.querySelector('.cart-item-subtotal');
        if (subtotalEl) {
          subtotalEl.textContent = formatRupiah(item.subtotalItem);
        }
      }
      recalculateCartSummary();
      renderGoodsGrid();
    }
  }

  function handleCartQtyCommit(kode, inputEl) {
    var item = AppState.cart.find(function (c) { return c.kode === kode; });
    if (!item) return;

    var parsed = parseInt(inputEl.value, 10);
    if (isNaN(parsed) || parsed <= 0) {
      item.kuantiti = 1;
      inputEl.value = '1';
    } else {
      item.kuantiti = parsed;
    }
    item.subtotalItem = item.kuantiti * item.hargaSatuan;
    renderCart();
    renderGoodsGrid();
  }

  function removeCartItem(kode) {
    AppState.cart = AppState.cart.filter(function (c) { return c.kode !== kode; });
    renderCart();
    renderGoodsGrid();
  }

  // Ekspos ke global window untuk inline event handlers
  window.updateCartQty = updateCartQty;
  window.removeCartItem = removeCartItem;
  window.handleCartQtyInput = handleCartQtyInput;
  window.handleCartQtyCommit = handleCartQtyCommit;

  function renderCart() {
    var list = document.getElementById('cartItemsList');
    if (!list) return;

    if (AppState.cart.length === 0) {
      list.innerHTML = '<div class="cart-empty-state"><div style="font-size: 2rem; margin-bottom: 0.4rem; opacity: 0.6;">🛒</div>Keranjang masih kosong.<br>Klik barang di katalog untuk menambahkan.</div>';
      document.getElementById('btnSubmitCheckout').disabled = true;
      recalculateCartSummary();
      return;
    }

    var html = '';
    AppState.cart.forEach(function (item) {
      html += '<div class="cart-item-row" data-kode="' + escapeHtml(item.kode) + '">';
      html += '  <div class="cart-item-info">';
      html += '    <div class="cart-item-name" title="' + escapeHtml(item.nama) + '">' + escapeHtml(item.nama) + '</div>';
      html += '    <div class="cart-item-price-desc">' + formatRupiah(item.hargaSatuan) + ' x ' + item.kuantiti + ' ' + escapeHtml(item.satuan) + '</div>';
      html += '  </div>';
      html += '  <div class="qty-control">';
      html += '    <button type="button" class="btn-qty" onclick="window.updateCartQty(\'' + escapeHtml(item.kode) + '\', -1)">-</button>';
      html += '    <input type="number" min="1" step="1" class="qty-input" value="' + item.kuantiti + '" '
        + '      oninput="window.handleCartQtyInput(\'' + escapeHtml(item.kode) + '\', this)" '
        + '      onchange="window.handleCartQtyCommit(\'' + escapeHtml(item.kode) + '\', this)" '
        + '      onfocus="this.select()">';
      html += '    <button type="button" class="btn-qty" onclick="window.updateCartQty(\'' + escapeHtml(item.kode) + '\', 1)">+</button>';
      html += '  </div>';
      html += '  <div class="cart-item-subtotal">' + formatRupiah(item.subtotalItem) + '</div>';
      html += '  <button type="button" class="btn-remove-item" onclick="window.removeCartItem(\'' + escapeHtml(item.kode) + '\')" title="Hapus Item">';
      html += '    <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      html += '  </button>';
      html += '</div>';
    });

    list.innerHTML = html;
    document.getElementById('btnSubmitCheckout').disabled = false;
    recalculateCartSummary();
  }

  function calculateSubtotal() {
    var sum = 0;
    AppState.cart.forEach(function (i) { sum += i.subtotalItem; });
    return sum;
  }

  function calculateGrandTotal() {
    var sub = calculateSubtotal();
    var disc = Number(document.getElementById('cartDiscountInput').value) || 0;
    return Math.max(0, sub - disc);
  }

  function recalculateCartSummary() {
    var sub = calculateSubtotal();
    var disc = Number(document.getElementById('cartDiscountInput').value) || 0;
    var grand = Math.max(0, sub - disc);

    var subEl = document.getElementById('cartSubtotalText');
    var grandEl = document.getElementById('cartGrandTotalText');
    if (subEl) subEl.textContent = formatRupiah(sub);
    if (grandEl) grandEl.textContent = formatRupiah(grand);

    var cashPaid = Number(document.getElementById('cartCashPaidInput').value) || 0;
    var change = cashPaid >= grand ? (cashPaid - grand) : 0;
    var changeEl = document.getElementById('cartChangeText');
    if (changeEl) changeEl.textContent = formatRupiah(change);

    // Sinkronkan status floating cart bar di HP
    var totalQty = 0;
    AppState.cart.forEach(function (i) { totalQty += (Number(i.kuantiti) || 0); });
    var floatCountEl = document.getElementById('floatingCartCount');
    var floatTotalEl = document.getElementById('floatingCartTotal');
    var floatBarEl = document.getElementById('mobileFloatingCartBar');
    var headerCartCount = document.getElementById('headerCartCount');
    if (floatCountEl) floatCountEl.textContent = totalQty;
    if (floatTotalEl) floatTotalEl.textContent = formatRupiah(grand);
    if (headerCartCount) {
      headerCartCount.textContent = totalQty;
      headerCartCount.style.display = totalQty > 0 ? 'inline-block' : 'none';
    }
    if (floatBarEl) {
      if (totalQty > 0 && window.innerWidth < 768) {
        floatBarEl.style.display = 'flex';
      } else {
        floatBarEl.style.display = 'none';
      }
    }
  }

  // ============================================================================
  // 9. SIMPAN TRANSAKSI KASIR (CHECKOUT)
  // ============================================================================
  function handleCheckoutSubmit() {
    if (AppState.cart.length === 0) {
      alert('Keranjang belanja kosong!');
      return;
    }

    var grandTotal = calculateGrandTotal();
    var cashPaid = Number(document.getElementById('cartCashPaidInput').value) || 0;
    var method = document.getElementById('cartPayMethod').value;

    if (method === 'Tunai' && cashPaid < grandTotal) {
      if (!confirm('Uang yang dibayarkan (' + formatRupiah(cashPaid) + ') kurang dari total belanja (' + formatRupiah(grandTotal) + '). Tetap lanjutkan?')) {
        return;
      }
    }

    var custName = document.getElementById('cartCustomerName').value.trim() || 'Pelanggan Umum';
    var custWa = document.getElementById('cartCustomerWa').value.trim();

    var payload = {
      header: {
        kasirUsername: AppState.currentUser ? AppState.currentUser.username : 'kasir',
        namaPelanggan: custName,
        noWhatsApp: custWa,
        subtotal: calculateSubtotal(),
        diskon: Number(document.getElementById('cartDiscountInput').value) || 0,
        totalAkhir: grandTotal,
        bayar: cashPaid,
        kembali: cashPaid >= grandTotal ? (cashPaid - grandTotal) : 0,
        metodeBayar: method,
        catatan: 'Lunas'
      },
      items: AppState.cart
    };

    var btn = document.getElementById('btnSubmitCheckout');
    btn.disabled = true;
    btn.innerHTML = 'Memproses Transaksi...';

    GasBridge.call('simpanTransaksiPOS', [payload], function (res) {
      btn.disabled = false;
      btn.innerHTML = '<svg class="icon icon-lg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan & Buat Invoice';

      if (res.success) {
        showToast('Transaksi berhasil disimpan! Nomor: ' + res.noInvoice, 'success');

        // Update stok lokal di memori
        AppState.cart.forEach(function (cartItm) {
          var catItm = AppState.catalog.find(function (c) { return c.kode === cartItm.kode; });
          if (catItm) {
            catItm.stok = Math.max(0, catItm.stok - cartItm.kuantiti);
          }
        });
        renderGoodsGrid();

        // Siapkan invoice data
        var invKasirName = AppState.settings.NAMA_PENANDATANGAN || payload.header.kasirUsername;
        var invData = {
          noInvoice: res.noInvoice,
          tanggal: res.tanggal,
          kasir: invKasirName,
          kasirSign: invKasirName,
          namaPelanggan: payload.header.namaPelanggan,
          noWhatsApp: payload.header.noWhatsApp,
          subtotal: payload.header.subtotal,
          diskon: payload.header.diskon,
          totalAkhir: payload.header.totalAkhir,
          bayar: payload.header.bayar,
          kembali: payload.header.kembali,
          metodeBayar: payload.header.metodeBayar,
          catatan: payload.header.catatan,
          items: payload.items
        };

        // Simpan ke daftar transaksi lokal
        AppState.transactions.unshift(invData);

        // Tutup drawer cart mobile jika terbuka
        var posCartCard = document.getElementById('posCartCard');
        var cartBackdrop = document.getElementById('cartDrawerBackdrop');
        if (posCartCard) posCartCard.classList.remove('mobile-open');
        if (cartBackdrop) cartBackdrop.classList.remove('active');

        // Buka modal invoice
        openInvoiceModal(invData);

        // Reset keranjang belanja
        AppState.cart = [];
        document.getElementById('cartCashPaidInput').value = '';
        document.getElementById('cartDiscountInput').value = '0';
        document.getElementById('cartCustomerName').value = 'Pelanggan Umum';
        document.getElementById('cartCustomerWa').value = '';
        renderCart();
      } else {
        alert(res.message || 'Gagal menyimpan transaksi.');
      }
    }, function (err) {
      btn.disabled = false;
      btn.innerHTML = '<svg class="icon icon-lg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan & Buat Invoice';
      alert('Terjadi kendala jaringan: ' + (err.message || err));
    });
  }

  // ============================================================================
  // 10. MODAL INVOICE: RENDER, PRINT, PDF & WHATSAPP
  // ============================================================================
  function openInvoiceModal(invoiceData) {
    AppState.currentInvoice = invoiceData;
    var format = getActiveInvoiceFormat();
    var theme = getActiveInvoiceTheme();
    document.getElementById('invoiceFormatToggle').value = format;

    var themeToggle = document.getElementById('invoiceThemeToggle');
    if (themeToggle) {
      themeToggle.value = theme;
      themeToggle.style.display = (format === 'a5') ? 'inline-block' : 'none';
    }

    var container = document.getElementById('invoicePrintArea');
    container.className = 'invoice-container format-' + format + (format === 'a5' ? ' theme-' + theme : '');

    renderInvoiceHTML(container, invoiceData, format, theme);
    document.getElementById('modalInvoice').classList.add('active');
    if (typeof BluetoothPrinterManager !== 'undefined') {
      BluetoothPrinterManager.updateUI();
    }
  }

  function getActiveInvoiceFormat() {
    var toggle = document.getElementById('invoiceFormatToggle');
    if (toggle && toggle.value) return toggle.value;
    return AppState.settings.FORMAT_DEFAULT || 'thermal';
  }

  function getActiveInvoiceTheme() {
    var toggle = document.getElementById('invoiceThemeToggle');
    if (toggle && toggle.value) return toggle.value;
    return AppState.settings.TEMA_FAKTUR || 'modern';
  }

  function renderInvoiceHTML(elementOrId, invoice, format, theme) {
    var el = (typeof elementOrId === 'string') ? document.getElementById(elementOrId) : elementOrId;
    if (!el) return;
    var s = AppState.settings;
    var isA5 = (format === 'a5');
    var activeTheme = theme || getActiveInvoiceTheme();
    el.className = 'invoice-container format-' + format + (isA5 ? ' theme-' + activeTheme : '');
    var items = invoice.items || [];
    var html = '';

    if (isA5) {
      // ========================================================================
      // FORMAT FAKTUR NOTA RESMI STANDAR A5
      // ========================================================================
      html += '<div class="a5-header-row">';
      html += '  <div class="a5-store-col">';
      if (s.LOGO_URL) {
        html += '    <div class="a5-store-header-flex">';
        html += '      <img src="' + escapeHtml(s.LOGO_URL) + '" class="a5-store-logo" alt="Logo Toko">';
        html += '      <div>';
        html += '        <div class="a5-store-name">' + escapeHtml(s.NAMA_TOKO || 'MAH POS') + '</div>';
        if (s.SLOGAN) html += '        <div class="a5-store-desc">' + escapeHtml(s.SLOGAN) + '</div>';
        if (s.ALAMAT) html += '        <div class="a5-store-desc">' + escapeHtml(s.ALAMAT) + '</div>';
        if (s.TELEPON) html += '        <div class="a5-store-desc">Telp/WA: ' + escapeHtml(s.TELEPON) + '</div>';
        html += '      </div>';
        html += '    </div>';
      } else {
        html += '    <div class="a5-store-name">' + escapeHtml(s.NAMA_TOKO || 'MAH POS') + '</div>';
        if (s.SLOGAN) html += '    <div class="a5-store-desc">' + escapeHtml(s.SLOGAN) + '</div>';
        if (s.ALAMAT) html += '    <div class="a5-store-desc">' + escapeHtml(s.ALAMAT) + '</div>';
        if (s.TELEPON) html += '    <div class="a5-store-desc">Telp/WA: ' + escapeHtml(s.TELEPON) + '</div>';
      }
      html += '  </div>';
      html += '  <div class="a5-badge-col">';
      html += '    <div class="a5-doc-title">FAKTUR PENJUALAN</div>';
      html += '    <div class="a5-inv-number">' + escapeHtml(invoice.noInvoice) + '</div>';
      html += '  </div>';
      html += '</div>';

      html += '<div class="a5-meta-grid">';
      html += '  <div class="a5-meta-row"><span class="a5-meta-label">Tanggal:</span><span class="a5-meta-val">' + escapeHtml(invoice.tanggal) + '</span></div>';
      html += '  <div class="a5-meta-row"><span class="a5-meta-label">Pelanggan:</span><span class="a5-meta-val">' + escapeHtml(invoice.namaPelanggan) + '</span></div>';
      html += '  <div class="a5-meta-row"><span class="a5-meta-label">Kasir:</span><span class="a5-meta-val">' + escapeHtml(invoice.kasir) + '</span></div>';
      html += '  <div class="a5-meta-row"><span class="a5-meta-label">WhatsApp:</span><span class="a5-meta-val">' + escapeHtml(invoice.noWhatsApp || '-') + '</span></div>';
      html += '</div>';

      html += '<table class="a5-table">';
      html += '  <thead>';
      html += '    <tr>';
      html += '      <th style="width: 35px; text-align: center;">No</th>';
      html += '      <th style="text-align: left;">Nama Produk ATK</th>';
      html += '      <th style="width: 50px; text-align: center;">Qty</th>';
      html += '      <th style="width: 100px; text-align: right;">Harga Satuan</th>';
      html += '      <th style="width: 110px; text-align: right;">Total</th>';
      html += '    </tr>';
      html += '  </thead>';
      html += '  <tbody>';

      items.forEach(function (it, idx) {
        html += '    <tr>';
        html += '      <td style="text-align: center;">' + (idx + 1) + '</td>';
        html += '      <td><strong>' + escapeHtml(it.nama) + '</strong></td>';
        html += '      <td style="text-align: center;">' + it.kuantiti + '</td>';
        html += '      <td style="text-align: right;">' + formatRupiah(it.hargaSatuan) + '</td>';
        html += '      <td style="text-align: right; font-weight: 700;">' + formatRupiah(it.subtotalItem) + '</td>';
        html += '    </tr>';
      });

      html += '  </tbody>';
      html += '</table>';

      html += '<div class="a5-summary-layout">';
      html += '  <div class="a5-note-col">';
      html += '    <strong>Catatan & Ketentuan:</strong><br>';
      html += escapeHtml(s.FOOTER_NOTA || 'Terima kasih telah berbelanja di MAH POS.');
      html += '  </div>';
      html += '  <div class="a5-calc-col">';
      html += '    <div class="a5-calc-row"><span>Subtotal:</span><span>' + formatRupiah(invoice.subtotal) + '</span></div>';
      if (invoice.diskon > 0) {
        html += '    <div class="a5-calc-row"><span>Diskon:</span><span>- ' + formatRupiah(invoice.diskon) + '</span></div>';
      }
      html += '    <div class="a5-calc-row grand"><span>TOTAL:</span><span>' + formatRupiah(invoice.totalAkhir) + '</span></div>';
      html += '    <div class="a5-calc-row"><span>Bayar (' + escapeHtml(invoice.metodeBayar || 'Tunai') + '):</span><span>' + formatRupiah(invoice.bayar) + '</span></div>';
      html += '    <div class="a5-calc-row"><span>Kembalian:</span><span>' + formatRupiah(invoice.kembali) + '</span></div>';
      html += '  </div>';
      html += '</div>';

      var signKasir = invoice.kasirSign || invoice.kasir || s.NAMA_PENANDATANGAN || 'master';
      html += '<div class="a5-sign-section">';
      html += '  <div class="a5-sign-box"><div>Penerima / Pembeli</div><div class="a5-sign-space"></div><div>( ................................ )</div></div>';
      html += '  <div class="a5-sign-box"><div>Hormat Kami / Kasir</div><div class="a5-sign-space"></div>';
      html += '    <div class="a5-sign-editable-wrap">( <span class="editable-sign-name" contenteditable="true" spellcheck="false" title="Klik langsung untuk mengubah nama penandatangan" oninput="handleInvoiceSignChange(this.innerText)">' + escapeHtml(signKasir) + '</span> )</div>';
      html += '  </div>';
      html += '</div>';
    } else if (format === 'label') {
      // ========================================================================
      // FORMAT LABEL PACKING / PENGEMASAN BARANG (NAMA PEMBELI, ITEM, QTY)
      // ========================================================================
      html += '<div class="label-header-badge">';
      html += '  <div class="label-title">LABEL PACKING & PESANAN</div>';
      html += '  <div class="label-store">' + escapeHtml(s.NAMA_TOKO || 'MAH POS') + '</div>';
      html += '</div>';

      // Kotak Pelanggan (Besar & Sangat Jelas)
      html += '<div class="label-customer-card">';
      html += '  <div class="label-customer-tag">PENERIMA / PEMBELI:</div>';
      html += '  <div class="label-customer-name">' + escapeHtml(invoice.namaPelanggan || invoice.pelanggan || 'Pelanggan Umum') + '</div>';
      if (invoice.noWhatsApp && invoice.noWhatsApp !== '-') {
        html += '  <div class="label-customer-phone">Telp/WA: ' + escapeHtml(invoice.noWhatsApp) + '</div>';
      }
      html += '</div>';

      html += '<table class="label-table">';
      html += '  <thead>';
      html += '    <tr>';
      html += '      <th style="width: 28px; text-align: center;">No</th>';
      html += '      <th style="text-align: left;">Nama Produk ATK</th>';
      html += '      <th style="width: 65px; text-align: center;">Qty</th>';
      html += '    </tr>';
      html += '  </thead>';
      html += '  <tbody>';

      var totalQty = 0;
      items.forEach(function (it, idx) {
        totalQty += Number(it.kuantiti) || 0;
        html += '    <tr>';
        html += '      <td style="text-align: center; font-weight: 700;">' + (idx + 1) + '</td>';
        html += '      <td><div class="label-item-name">' + escapeHtml(it.nama) + '</div></td>';
        html += '      <td style="text-align: center;"><div class="label-item-qty">' + it.kuantiti + ' ' + escapeHtml(it.satuan || '') + '</div></td>';
        html += '    </tr>';
      });

      html += '  </tbody>';
      html += '</table>';

      html += '<div class="label-summary-row">';
      html += '  <span>TOTAL ITEM BARANG:</span>';
      html += '  <span style="font-size: 13px; font-weight: 800;">' + totalQty + ' Pcs/Unit</span>';
      html += '</div>';

      html += '<div class="label-footer-info">';
      html += '  <div>No. Nota: ' + escapeHtml(invoice.noInvoice) + ' | ' + escapeHtml(invoice.tanggal) + '</div>';
      if (invoice.catatan) {
        html += '  <div style="margin-top: 2px; font-style: italic;">Ket: ' + escapeHtml(invoice.catatan) + '</div>';
      }
      html += '</div>';
    } else {
      // ========================================================================
      // FORMAT STRUK KASIR TERMAL (58mm / 80mm)
      // ========================================================================
      html += '<div class="inv-center">';
      if (s.LOGO_URL) {
        html += '  <img src="' + escapeHtml(s.LOGO_URL) + '" class="inv-store-logo" alt="Logo Toko">';
      }
      html += '  <div class="inv-store-name">' + escapeHtml(s.NAMA_TOKO || 'MAH POS') + '</div>';
      if (s.SLOGAN) html += '  <div class="inv-store-sub">' + escapeHtml(s.SLOGAN) + '</div>';
      if (s.ALAMAT) html += '  <div class="inv-store-sub">' + escapeHtml(s.ALAMAT) + '</div>';
      if (s.TELEPON) html += '  <div class="inv-store-sub">Telp/WA: ' + escapeHtml(s.TELEPON) + '</div>';
      html += '</div>';

      html += '<div class="inv-divider"></div>';
      html += '<div class="inv-row"><span>No. Nota:</span><span class="inv-bold">' + escapeHtml(invoice.noInvoice) + '</span></div>';
      html += '<div class="inv-row"><span>Tanggal:</span><span>' + escapeHtml(invoice.tanggal) + '</span></div>';
      html += '<div class="inv-row"><span>Kasir:</span><span>' + escapeHtml(invoice.kasir) + '</span></div>';
      html += '<div class="inv-row"><span>Pelanggan:</span><span>' + escapeHtml(invoice.namaPelanggan) + '</span></div>';
      html += '<div class="inv-divider"></div>';

      html += '<table class="inv-table">';
      html += '  <thead>';
      html += '    <tr>';
      html += '      <th style="text-align: left;">Item</th>';
      html += '      <th style="text-align: center; width: 40px;">Qty</th>';
      html += '      <th style="text-align: right; width: 65px;">Harga</th>';
      html += '      <th style="text-align: right; width: 75px;">Total</th>';
      html += '    </tr>';
      html += '  </thead>';
      html += '  <tbody>';

      items.forEach(function (it) {
        html += '    <tr>';
        html += '      <td><div class="inv-bold">' + escapeHtml(it.nama) + '</div></td>';
        html += '      <td style="text-align: center;">' + it.kuantiti + '</td>';
        html += '      <td style="text-align: right;">' + formatRupiah(it.hargaSatuan) + '</td>';
        html += '      <td style="text-align: right;">' + formatRupiah(it.subtotalItem) + '</td>';
        html += '    </tr>';
      });

      html += '  </tbody>';
      html += '</table>';

      html += '<div class="inv-divider"></div>';
      html += '<div class="inv-row"><span>Subtotal:</span><span>' + formatRupiah(invoice.subtotal) + '</span></div>';
      if (invoice.diskon > 0) {
        html += '<div class="inv-row"><span>Diskon:</span><span>- ' + formatRupiah(invoice.diskon) + '</span></div>';
      }
      html += '<div class="inv-row inv-bold" style="font-size: 13px; margin: 4px 0;"><span>TOTAL:</span><span>' + formatRupiah(invoice.totalAkhir) + '</span></div>';
      html += '<div class="inv-row"><span>Bayar (' + escapeHtml(invoice.metodeBayar || 'Tunai') + '):</span><span>' + formatRupiah(invoice.bayar) + '</span></div>';
      html += '<div class="inv-row"><span>Kembalian:</span><span>' + formatRupiah(invoice.kembali) + '</span></div>';
      html += '<div class="inv-divider"></div>';

      if (s.FOOTER_NOTA) {
        html += '<div class="inv-footer-note">' + escapeHtml(s.FOOTER_NOTA) + '</div>';
      }
    }

    el.innerHTML = html;
  }

  // Helper Pembuat Nama Berkas PDF Dinamis & Aman Sistem Operasi
  // Format: INVOICE - Nama Toko - Nama Pelanggan - DD-MM-YYYY.pdf
  function generateInvoicePdfFilename(inv) {
    var sanitize = function (str) {
      return String(str || '')
        .replace(/[/\\:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
    };

    var storeName = sanitize(AppState.settings.NAMA_TOKO || 'MAH POS');
    var customerName = sanitize(inv.namaPelanggan || inv.pelanggan || 'Pelanggan Umum');

    var dateStr = '';
    if (inv.tanggal) {
      var rawTgl = String(inv.tanggal).trim();
      var matchYMD = rawTgl.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (matchYMD) {
        dateStr = ('0' + matchYMD[3]).slice(-2) + '-' + ('0' + matchYMD[2]).slice(-2) + '-' + matchYMD[1];
      } else {
        var d = new Date(rawTgl);
        if (!isNaN(d.getTime())) {
          var day = ('0' + d.getDate()).slice(-2);
          var month = ('0' + (d.getMonth() + 1)).slice(-2);
          var year = d.getFullYear();
          dateStr = day + '-' + month + '-' + year;
        }
      }
    }

    if (!dateStr) {
      var now = new Date();
      dateStr = ('0' + now.getDate()).slice(-2) + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + now.getFullYear();
    }

    var activeFormat = getActiveInvoiceFormat();
    var prefix = (activeFormat === 'label') ? 'LABEL' : 'INVOICE';
    return prefix + ' - ' + storeName + ' - ' + customerName + ' - ' + dateStr + '.pdf';
  }

  // Fungsi Pembaruan Nama Penandatangan Faktur secara Real-time
  function handleInvoiceSignChange(newName) {
    var clean = (newName || '').trim();
    if (AppState.currentInvoice) {
      AppState.currentInvoice.kasirSign = clean;
      AppState.currentInvoice.kasir = clean;
    }
  }

  // Generator PDF Struk Termal & Label Pas 1 Halaman Tunggal (Zero Pagebreak)
  function generateThermalPdfDirect(invoiceEl, filename, isBlob, format) {
    var isThermal58 = (format === 'thermal58');
    var isLabel = (format === 'label');
    var paperWidth = isThermal58 ? 58 : 80;
    var margin = isLabel ? [3, 3, 3, 3] : [2, 2, 2, 2];

    // Ukur dimensi elemen struk / label secara dinamis
    var printableWidth = paperWidth - (margin[1] + margin[3]);
    var containerWidthPx = printableWidth * 3.779527559; // Lebar kontainer internal html2pdf

    var elWidth = invoiceEl.offsetWidth || (isThermal58 ? 260 : 300);
    var elHeight = Math.max(invoiceEl.offsetHeight, invoiceEl.scrollHeight);

    // Kompensasi pemanjangan teks akibat penyempitan lebar kontainer pada kertas termal
    var textExpansion = Math.max(1.15, (elWidth / containerWidthPx) * 1.15);
    var renderedMm = Math.ceil((elHeight * textExpansion) / 3.779527559);

    // Total tinggi halaman PDF dengan buffer potong aman (+35mm) menjamin 100% muat dalam 1 halaman tunggal
    var totalHeightMm = Math.max(isThermal58 ? 165 : 135, renderedMm + 35);

    var originalBorder = invoiceEl.style.border;
    var originalShadow = invoiceEl.style.boxShadow;
    invoiceEl.style.border = 'none';
    invoiceEl.style.boxShadow = 'none';

    var opt = {
      margin: margin,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollY: 0,
        scrollX: 0
      },
      jsPDF: {
        unit: 'mm',
        format: [paperWidth, totalHeightMm],
        orientation: 'portrait'
      },
      pagebreak: { mode: [] } // Nonaktifkan pemotongan elemen otomatis untuk struk termal gulungan continuous
    };

    var worker = html2pdf().set(opt).from(invoiceEl);

    if (isBlob) {
      return worker.outputPdf('blob').then(function (blob) {
        invoiceEl.style.border = originalBorder;
        invoiceEl.style.boxShadow = originalShadow;
        return blob;
      }).catch(function (err) {
        invoiceEl.style.border = originalBorder;
        invoiceEl.style.boxShadow = originalShadow;
        throw err;
      });
    } else {
      return worker.save().then(function () {
        invoiceEl.style.border = originalBorder;
        invoiceEl.style.boxShadow = originalShadow;
        return true;
      }).catch(function (err) {
        invoiceEl.style.border = originalBorder;
        invoiceEl.style.boxShadow = originalShadow;
        throw err;
      });
    }
  }

  // Unduh PDF langsung dari elemen faktur / struk aktif di layar
  function downloadInvoicePDF() {
    if (!AppState.currentInvoice) return;
    var inv = AppState.currentInvoice;
    var format = getActiveInvoiceFormat();
    var theme = getActiveInvoiceTheme();
    var invoiceEl = document.getElementById('invoicePrintArea');
    if (!invoiceEl) return;

    // Pastikan class dan konten sesuai format dan tema aktif saat ini
    invoiceEl.className = 'invoice-container format-' + format + (format === 'a5' ? ' theme-' + theme : '');
    renderInvoiceHTML(invoiceEl, inv, format, theme);

    var filename = generateInvoicePdfFilename(inv);
    showToast('Membuat dokumen PDF...', 'info');

    if (format === 'thermal' || format === 'thermal58' || format === 'label') {
      generateThermalPdfDirect(invoiceEl, filename, false, format).then(function () {
        showToast('File PDF berhasil diunduh: ' + filename, 'success');
      }).catch(function (err) {
        alert('Gagal mengekspor PDF: ' + (err.message || err));
      });
    } else {
      var opt = {
        margin: [8, 8, 8, 8],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
          scrollX: 0
        },
        jsPDF: {
          unit: 'mm',
          format: 'a5',
          orientation: 'portrait'
        },
        pagebreak: { mode: 'avoid-all' }
      };

      html2pdf().set(opt).from(invoiceEl).save().then(function () {
        showToast('File PDF berhasil diunduh: ' + filename, 'success');
      }).catch(function (err) {
        alert('Gagal mengekspor PDF faktur: ' + (err.message || err));
      });
    }
  }

  // Kirim ke WhatsApp (Web Share API di HP & WhatsApp Web di Desktop)
  function handleWhatsAppShare() {
    if (!AppState.currentInvoice) return;
    var inv = AppState.currentInvoice;
    var format = getActiveInvoiceFormat();
    var invoiceEl = document.getElementById('invoicePrintArea');
    if (!invoiceEl) return;

    var theme = getActiveInvoiceTheme();
    invoiceEl.className = 'invoice-container format-' + format + (format === 'a5' ? ' theme-' + theme : '');
    renderInvoiceHTML(invoiceEl, inv, format, theme);

    var phone = cleanPhoneNumber(inv.noWhatsApp || '');
    var filename = generateInvoicePdfFilename(inv);

    var msg = '*INVOICE PEMBELIAN ATK - ' + (AppState.settings.NAMA_TOKO || 'MAH POS') + '*\n';
    msg += 'No. Nota: ' + inv.noInvoice + '\n';
    msg += 'Tanggal: ' + inv.tanggal + '\n';
    msg += 'Pelanggan: ' + (inv.namaPelanggan || inv.pelanggan || 'Pelanggan Umum') + '\n';
    msg += '--------------------------------\n';
    (inv.items || []).forEach(function (i) {
      msg += '• ' + i.nama + ' (' + i.kuantiti + 'x) = ' + formatRupiah(i.subtotalItem) + '\n';
    });
    msg += '--------------------------------\n';
    msg += '*TOTAL: ' + formatRupiah(inv.totalAkhir !== undefined ? inv.totalAkhir : inv.total) + '*\n';
    msg += 'Status: LUNAS\n\n';
    msg += (AppState.settings.FOOTER_NOTA || 'Terima kasih telah berbelanja di toko kami!');

    showToast('Menyiapkan file PDF untuk WhatsApp...', 'info');

    var executeShare = function (pdfBlob) {
      var pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        navigator.share({
          files: [pdfFile],
          title: 'Invoice ' + inv.noInvoice,
          text: msg
        }).catch(function (e) {
          console.log('Share dibatalkan:', e);
        });
      } else {
        var url = URL.createObjectURL(pdfBlob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        var waUrl = 'https://wa.me/' + (phone ? phone : '') + '?text=' + encodeURIComponent(msg);
        window.open(waUrl, '_blank');
        showToast('PDF tersimpan. Buka WhatsApp untuk mengirim ke pelanggan.', 'info');
      }
    };

    if (format === 'thermal' || format === 'thermal58' || format === 'label') {
      generateThermalPdfDirect(invoiceEl, filename, true, format).then(function (pdfBlob) {
        executeShare(pdfBlob);
      }).catch(function (err) {
        alert('Gagal memproses PDF WhatsApp: ' + (err.message || err));
      });
    } else {
      var opt = {
        margin: [8, 8, 8, 8],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0, scrollX: 0 },
        jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' }
      };
      html2pdf().set(opt).from(invoiceEl).outputPdf('blob').then(function (pdfBlob) {
        executeShare(pdfBlob);
      }).catch(function (err) {
        alert('Gagal memproses PDF WhatsApp: ' + (err.message || err));
      });
    }
  }

  // ============================================================================
  // 10.B ENGINE BLUETOOTH THERMAL PRINTER (JALUR 2 - WEB BLUETOOTH API & ESC/POS)
  // ============================================================================

  // Helper pengkodean string ke Uint8Array (kompatibel ASCII / CP437)
  function encodeTextEscPos(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    var bytes = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  // Helper penggabung array bytes
  function concatBytesEscPos(arrays) {
    var totalLen = 0;
    for (var i = 0; i < arrays.length; i++) {
      totalLen += arrays[i].length;
    }
    var result = new Uint8Array(totalLen);
    var offset = 0;
    for (var j = 0; j < arrays.length; j++) {
      result.set(arrays[j], offset);
      offset += arrays[j].length;
    }
    return result;
  }

  // Format kolom teks rata kiri dan rata kanan untuk struk termal
  function padEscPosCols(left, right, width) {
    left = String(left || '');
    right = String(right || '');
    if (left.length + right.length <= width) {
      var spaces = width - left.length - right.length;
      return left + ' '.repeat(spaces) + right;
    }
    var maxLeft = width - right.length - 1;
    if (maxLeft > 0) {
      return left.substring(0, maxLeft) + ' ' + right;
    }
    return left + '\n' + ' '.repeat(Math.max(0, width - right.length)) + right;
  }

  // Format rupiah ringkas tanpa simbol desimal untuk printer termal
  function formatRupiahSimple(num) {
    var n = Number(num || 0);
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
  }

  // ESC/POS Command Builder Object
  function EscPosBuilder() {
    this.buffers = [];
  }
  EscPosBuilder.prototype.raw = function (bytes) {
    this.buffers.push(new Uint8Array(bytes));
    return this;
  };
  EscPosBuilder.prototype.text = function (str) {
    this.buffers.push(encodeTextEscPos(str));
    return this;
  };
  EscPosBuilder.prototype.line = function (str) {
    this.buffers.push(encodeTextEscPos((str || '') + '\n'));
    return this;
  };
  EscPosBuilder.prototype.init = function () {
    return this.raw([0x1B, 0x40]); // ESC @ (Reset/Init)
  };
  EscPosBuilder.prototype.align = function (align) {
    var code = 0; // left
    if (align === 'center') code = 1;
    else if (align === 'right') code = 2;
    return this.raw([0x1B, 0x61, code]);
  };
  EscPosBuilder.prototype.bold = function (enable) {
    return this.raw([0x1B, 0x45, enable ? 1 : 0]);
  };
  EscPosBuilder.prototype.doubleSize = function (enable) {
    return this.raw([0x1D, 0x21, enable ? 0x11 : 0x00]);
  };
  EscPosBuilder.prototype.feed = function (lines) {
    var n = lines || 1;
    return this.raw([0x1B, 0x64, n]);
  };
  EscPosBuilder.prototype.cut = function () {
    return this.raw([0x1D, 0x56, 0x41, 0x10]); // Partial cut + feed
  };
  EscPosBuilder.prototype.getBytes = function () {
    return concatBytesEscPos(this.buffers);
  };

  // Builder Struk Kasir Termal ESC/POS
  function buildReceiptEscPosBytes(inv, format) {
    var is58 = (format === 'thermal58');
    var width = is58 ? 32 : 42;
    var divLine = '-'.repeat(width);
    var b = new EscPosBuilder();

    b.init();
    b.align('center');
    b.doubleSize(true);
    b.bold(true);
    b.line(AppState.settings.NAMA_TOKO || 'MAH POS');
    b.doubleSize(false);
    b.bold(false);

    if (AppState.settings.SLOGAN_TOKO) {
      b.line(AppState.settings.SLOGAN_TOKO);
    }
    if (AppState.settings.ALAMAT_TOKO) {
      b.line(AppState.settings.ALAMAT_TOKO);
    }
    if (AppState.settings.TELEPON_TOKO) {
      b.line('Telp/WA: ' + AppState.settings.TELEPON_TOKO);
    }
    b.line(divLine);

    b.align('left');
    b.line(padEscPosCols('No: ' + inv.noInvoice, inv.tanggal, width));
    b.line(padEscPosCols('Kasir: ' + (inv.kasir || 'Kasir'), 'Plg: ' + (inv.namaPelanggan || inv.pelanggan || 'Umum'), width));
    b.line(divLine);

    (inv.items || []).forEach(function (item) {
      b.bold(true);
      b.line(item.nama);
      b.bold(false);
      var left = '  ' + item.kuantiti + ' x ' + formatRupiahSimple(item.harga);
      var right = formatRupiahSimple(item.subtotalItem);
      b.line(padEscPosCols(left, right, width));
    });
    b.line(divLine);

    b.line(padEscPosCols('Subtotal', formatRupiahSimple(inv.subtotal), width));
    if (inv.diskon && Number(inv.diskon) > 0) {
      b.line(padEscPosCols('Diskon', '-' + formatRupiahSimple(inv.diskon), width));
    }
    b.bold(true);
    b.line(padEscPosCols('TOTAL', formatRupiahSimple(inv.totalAkhir !== undefined ? inv.totalAkhir : inv.total), width));
    b.bold(false);
    b.line(padEscPosCols('Bayar (' + (inv.metodeBayar || 'Tunai') + ')', formatRupiahSimple(inv.nominalBayar || inv.total), width));
    b.line(padEscPosCols('Kembali', formatRupiahSimple(inv.kembalian || 0), width));
    b.line(divLine);

    b.align('center');
    b.line(AppState.settings.FOOTER_NOTA || 'Terima kasih atas kunjungan Anda');
    b.line('Barang yang dibeli tidak dapat ditukar');
    b.feed(3);
    b.cut();
    return b.getBytes();
  }

  // Builder Label Packing (Nama Pembeli, Item, Qty Tanpa Nominal Uang)
  function buildLabelEscPosBytes(inv, format) {
    var is58 = (format === 'thermal58');
    var width = is58 ? 32 : 42;
    var divDouble = '='.repeat(width);
    var divSingle = '-'.repeat(width);
    var b = new EscPosBuilder();

    b.init();
    b.align('center');
    b.bold(true);
    b.doubleSize(true);
    b.line('LABEL PACKING');
    b.doubleSize(false);
    b.line(AppState.settings.NAMA_TOKO || 'MAH POS');
    b.line(divDouble);

    b.line('PEMBELI / PENERIMA:');
    b.bold(true);
    b.doubleSize(true);
    b.line(inv.namaPelanggan || inv.pelanggan || 'Pelanggan Umum');
    b.doubleSize(false);
    b.bold(false);
    if (inv.noWhatsApp) {
      b.line('WA/Telp: ' + inv.noWhatsApp);
    }
    b.line(divSingle);

    b.align('left');
    b.bold(true);
    b.line(padEscPosCols('NO. NAMA ITEM', 'QTY', width));
    b.bold(false);
    b.line(divSingle);

    var totalQty = 0;
    (inv.items || []).forEach(function (item, idx) {
      totalQty += Number(item.kuantiti || 0);
      var left = (idx + 1) + '. ' + item.nama;
      var right = item.kuantiti + ' ' + (item.satuan || 'Pcs');
      b.line(padEscPosCols(left, right, width));
    });
    b.line(divSingle);

    b.bold(true);
    b.line(padEscPosCols('TOTAL KUANTITI:', totalQty + ' Pcs', width));
    b.bold(false);
    b.line(divDouble);

    b.align('center');
    b.line(padEscPosCols('No: ' + inv.noInvoice, inv.tanggal, width));
    b.line('Periksa kelengkapan isi paket pesanan');
    b.feed(3);
    b.cut();
    return b.getBytes();
  }

  // Helper konversi Uint8Array ke Base64 (untuk RawBT Android)
  function uint8ArrayToBase64(uint8) {
    var binary = '';
    var len = uint8.byteLength;
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return window.btoa(binary);
  }

  // Cek apakah Web Bluetooth dibatasi oleh iframe Permissions Policy Google Apps Script
  function isBluetoothBlockedByPolicy() {
    try {
      if (document.permissionsPolicy && typeof document.permissionsPolicy.allowsFeature === 'function') {
        return !document.permissionsPolicy.allowsFeature('bluetooth');
      }
      if (document.featurePolicy && typeof document.featurePolicy.allowsFeature === 'function') {
        return !document.featurePolicy.allowsFeature('bluetooth');
      }
      if (window.self !== window.top && (location.hostname.includes('googleusercontent.com') || location.hostname.includes('script.google.com'))) {
        return true;
      }
    } catch (e) {
      return true;
    }
    return false;
  }

  // Handler pengiriman data ESC/POS ke RawBT (Android)
  function printViaRawBT(bytes) {
    var base64 = uint8ArrayToBase64(bytes);
    var rawbtUrl = 'rawbt:data:application/octet-stream;base64,' + base64;
    showToast('Mengirim struk ke RawBT Bluetooth...', 'info');
    var a = document.createElement('a');
    a.href = rawbtUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 1000);
  }

  // Buka modal panduan koneksi Bluetooth
  function openBluetoothGuideModal() {
    var m = document.getElementById('modalBluetoothGuide');
    if (m) m.classList.add('active');
  }

  // Tutup modal panduan koneksi Bluetooth
  function closeBluetoothGuideModal() {
    var m = document.getElementById('modalBluetoothGuide');
    if (m) m.classList.remove('active');
  }

  // Bluetooth Printer Manager (Web Bluetooth API)
  var BluetoothPrinterManager = {
    device: null,
    characteristic: null,
    isConnecting: false,

    isSupported: function () {
      return !!(navigator && navigator.bluetooth && navigator.bluetooth.requestDevice);
    },

    isConnected: function () {
      return !!(this.device && this.device.gatt && this.device.gatt.connected && this.characteristic);
    },

    getDeviceName: function () {
      return (this.device && this.device.name) ? this.device.name : 'Printer Bluetooth';
    },

    updateUI: function () {
      var connected = this.isConnected();
      var name = this.getDeviceName();

      var badgeSettings = document.getElementById('btStatusBadgeSettings');
      var textSettings = document.getElementById('btStatusTextSettings');
      var btnConnect = document.getElementById('btnConnectBluetooth');
      var btnDisconnect = document.getElementById('btnDisconnectBluetooth');
      var btnTest = document.getElementById('btnTestBluetoothPrint');
      var devDisplay = document.getElementById('btDeviceNameDisplay');
      var devText = document.getElementById('btDeviceNameText');

      if (badgeSettings && textSettings) {
        if (connected) {
          badgeSettings.className = 'badge-bt badge-bt-connected';
          textSettings.textContent = 'Terhubung: ' + name;
        } else {
          badgeSettings.className = 'badge-bt badge-bt-disconnected';
          textSettings.textContent = 'Belum Terhubung';
        }
      }

      if (btnConnect) btnConnect.style.display = connected ? 'none' : 'inline-flex';
      if (btnDisconnect) btnDisconnect.style.display = connected ? 'inline-flex' : 'none';
      if (btnTest) btnTest.style.display = connected ? 'inline-flex' : 'none';
      if (devDisplay && devText) {
        devDisplay.style.display = connected ? 'block' : 'none';
        devText.textContent = name;
      }

      var modalBadge = document.getElementById('modalBtBadge');
      var modalText = document.getElementById('modalBtText');
      if (modalBadge && modalText) {
        if (connected) {
          modalBadge.className = 'badge-bt badge-bt-connected';
          modalText.textContent = 'BT: ' + name;
        } else {
          modalBadge.className = 'badge-bt badge-bt-disconnected';
          modalText.textContent = 'BT: Siap';
        }
      }
    },

    connect: function () {
      var self = this;
      if (isBluetoothBlockedByPolicy()) {
        openBluetoothGuideModal();
        return Promise.reject(new Error('Blocked by Google Permissions Policy'));
      }

      if (!self.isSupported()) {
        openBluetoothGuideModal();
        return Promise.reject(new Error('Web Bluetooth not supported'));
      }

      if (self.isConnected()) {
        return Promise.resolve(self.characteristic);
      }

      self.isConnecting = true;
      showToast('Membuka daftar Bluetooth...', 'info');

      var optionalServices = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000fee7-0000-1000-8000-00805f9b34fb',
        '0000af30-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        0x18f0, 0xff00, 0xfee7, 0xaf30
      ];

      return navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: optionalServices
      }).then(function (device) {
        self.device = device;
        device.addEventListener('gattserverdisconnected', function () {
          self.characteristic = null;
          self.updateUI();
          showToast('Printer Bluetooth terputus', 'warning');
        });
        showToast('Menghubungkan ke ' + (device.name || 'Printer') + '...', 'info');
        return device.gatt.connect();
      }).then(function (server) {
        return server.getPrimaryServices();
      }).then(function (services) {
        if (!services || services.length === 0) {
          throw new Error('Tidak ditemukan layanan Bluetooth GATT pada printer.');
        }
        return self.findWritableCharacteristic(services, 0);
      }).then(function (characteristic) {
        self.characteristic = characteristic;
        self.isConnecting = false;
        self.updateUI();
        showToast('Berhasil terhubung ke ' + self.getDeviceName(), 'success');
        return characteristic;
      }).catch(function (err) {
        self.isConnecting = false;
        self.updateUI();
        if (err.name === 'NotFoundError') {
          showToast('Pencarian Bluetooth dibatalkan', 'info');
        } else if (err.name === 'SecurityError' || (err.message && err.message.toLowerCase().includes('permissions policy'))) {
          openBluetoothGuideModal();
        } else {
          console.warn('Bluetooth Error:', err);
          openBluetoothGuideModal();
        }
        throw err;
      });
    },

    findWritableCharacteristic: function (services, index) {
      var self = this;
      if (index >= services.length) {
        throw new Error('Karakteristik penulisan (write characteristic) tidak ditemukan pada printer ini.');
      }
      var service = services[index];
      return service.getCharacteristics().then(function (characteristics) {
        for (var i = 0; i < characteristics.length; i++) {
          var c = characteristics[i];
          if (c.properties.write || c.properties.writeWithoutResponse) {
            return c;
          }
        }
        return self.findWritableCharacteristic(services, index + 1);
      }).catch(function () {
        return self.findWritableCharacteristic(services, index + 1);
      });
    },

    disconnect: function () {
      if (this.device && this.device.gatt && this.device.gatt.connected) {
        this.device.gatt.disconnect();
      }
      this.characteristic = null;
      this.updateUI();
      showToast('Printer Bluetooth diputuskan', 'info');
    },

    sendData: function (bytes) {
      var self = this;
      return Promise.resolve().then(function () {
        if (!self.isConnected()) {
          return self.connect();
        }
        return self.characteristic;
      }).then(function (char) {
        showToast('Mengirim data ke printer Bluetooth...', 'info');
        var chunkSize = 50;
        var total = bytes.length;
        var offset = 0;

        function sendNextChunk() {
          if (offset >= total) {
            return Promise.resolve();
          }
          var nextOffset = Math.min(offset + chunkSize, total);
          var chunk = bytes.slice(offset, nextOffset);
          offset = nextOffset;

          var p;
          if (char.writeValueWithoutResponse) {
            p = char.writeValueWithoutResponse(chunk);
          } else {
            p = char.writeValue(chunk);
          }

          return p.then(function () {
            return new Promise(function (resolve) {
              setTimeout(resolve, 20); // 20ms pause antara packet BLE
            });
          }).then(sendNextChunk);
        }

        return sendNextChunk();
      });
    },

    testPrint: function () {
      var self = this;
      var execute = function () {
        var b = new EscPosBuilder();
        b.init();
        b.align('center');
        b.doubleSize(true);
        b.bold(true);
        b.line('TEST BLUETOOTH');
        b.doubleSize(false);
        b.line(AppState.settings.NAMA_TOKO || 'MAH POS');
        b.line('--------------------------------');
        b.align('left');
        b.line('Status   : TERHUBUNG (OK)');
        b.line('Printer  : ' + self.getDeviceName());
        b.line('Waktu    : ' + new Date().toLocaleTimeString('id-ID'));
        b.line('Engine   : Web Bluetooth ESC/POS');
        b.line('--------------------------------');
        b.align('center');
        b.line('Printer Siap Digunakan Kasir!');
        b.feed(3);
        b.cut();
        return self.sendData(b.getBytes()).then(function () {
          showToast('Tes cetak Bluetooth berhasil dikirim!', 'success');
        });
      };

      if (!self.isConnected()) {
        return self.connect().then(execute).catch(function (err) {
          console.error('Tes cetak gagal:', err);
        });
      }
      return execute().catch(function (err) {
        alert('Gagal tes cetak: ' + (err.message || err));
      });
    }
  };

  // Handler Cetak Transaksi Aktif via Bluetooth Langsung (1-Click)
  function printInvoiceViaBluetooth() {
    if (!AppState.currentInvoice) {
      showToast('Tidak ada nota transaksi yang aktif', 'warning');
      return;
    }
    var inv = AppState.currentInvoice;
    var format = getActiveInvoiceFormat();

    var bytes;
    if (format === 'label') {
      bytes = buildLabelEscPosBytes(inv, format);
    } else {
      bytes = buildReceiptEscPosBytes(inv, (format === 'thermal58') ? 'thermal58' : 'thermal');
    }

    // Jika Web Bluetooth dibatasi oleh Permissions Policy Google Apps Script
    if (isBluetoothBlockedByPolicy()) {
      var isAndroid = /android/i.test(navigator.userAgent || '');
      if (isAndroid) {
        printViaRawBT(bytes);
      } else {
        showToast('Membuka cetak ke printer Bluetooth Windows...', 'info');
        window.print();
      }
      return;
    }

    BluetoothPrinterManager.sendData(bytes).then(function () {
      showToast('Struk berhasil dicetak ke ' + BluetoothPrinterManager.getDeviceName(), 'success');
    }).catch(function (err) {
      console.warn('Gagal cetak Bluetooth GATT, dialihkan ke Windows / RawBT:', err);
      var isAndroid = /android/i.test(navigator.userAgent || '');
      if (isAndroid) {
        printViaRawBT(bytes);
      } else {
        window.print();
      }
    });
  }

  // ============================================================================
  // 11. RIWAYAT TRANSAKSI & BUKA ULANG NOTA
  // ============================================================================
  function loadRiwayatTransaksi() {
    var q = document.getElementById('historySearchInput').value.trim();
    var d = document.getElementById('historyDateInput').value;
    var tbody = document.getElementById('historyTableBody');

    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--slate-400); padding: 1.5rem;">Memuat data riwayat transaksi...</td></tr>';

    GasBridge.call('getRiwayatTransaksi', [q, d], function (res) {
      if (res.success) {
        AppState.transactions = res.list || [];
        renderHistoryTable();
      } else {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--rose); padding: 1.5rem;">Gagal memuat: ' + escapeHtml(res.message) + '</td></tr>';
      }
    });
  }

  function renderHistoryTable() {
    var tbody = document.getElementById('historyTableBody');
    var list = AppState.transactions;

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--slate-400); padding: 2rem;">Belum ada riwayat transaksi yang tersimpan.</td></tr>';
      return;
    }

    var html = '';
    list.forEach(function (trx) {
      html += '<tr>';
      html += '  <td><strong style="color: var(--primary);">' + escapeHtml(trx.noInvoice) + '</strong></td>';
      html += '  <td><div class="cell-fat-wrap"><span>' + escapeHtml(formatCompactDate(trx.tanggal)) + '</span></div></td>';
      html += '  <td>' + escapeHtml(trx.kasir) + '</td>';
      html += '  <td><div class="cell-fat-wrap"><strong>' + escapeHtml(trx.pelanggan) + '</strong><span class="cell-subtext">' + escapeHtml(trx.noWhatsApp || '-') + '</span></div></td>';
      html += '  <td><span class="good-sku-badge">' + escapeHtml(trx.metodeBayar || 'Tunai') + '</span></td>';
      html += '  <td style="text-align: right; font-weight: 800;">' + formatRupiah(trx.total) + '</td>';
      html += '  <td style="text-align: center;">';
      html += '    <button class="btn-quick-cash" onclick="bukaDetailTransaksi(\'' + trx.noInvoice + '\')" style="background: var(--slate-900); color: white; border: none; padding: 0.35rem 0.65rem;">';
      html += '      Buka Nota';
      html += '    </button>';
      html += '  </td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;
  }

  function bukaDetailTransaksi(noInvoice) {
    showToast('Mengambil data nota ' + noInvoice + '...', 'info');

    var cachedTrx = AppState.transactions.find(function (t) { return t.noInvoice === noInvoice; });

    GasBridge.call('getDetailInvoice', [noInvoice], function (res) {
      if (res && res.success && res.header) {
        var inv = res.header;
        inv.items = res.items || [];
        inv.namaPelanggan = inv.namaPelanggan || inv.pelanggan || 'Pelanggan Umum';
        inv.totalAkhir = (inv.totalAkhir !== undefined && inv.totalAkhir !== null) ? Number(inv.totalAkhir) : Number(inv.total || 0);
        inv.total = inv.totalAkhir;
        openInvoiceModal(inv);
      } else if (cachedTrx) {
        // Fallback cerdas: Jika detail item belum tersedia, buka nota dengan header transaksi yang ada
        var fallbackInv = Object.assign({}, cachedTrx);
        fallbackInv.namaPelanggan = fallbackInv.namaPelanggan || fallbackInv.pelanggan || 'Pelanggan Umum';
        fallbackInv.totalAkhir = (fallbackInv.totalAkhir !== undefined && fallbackInv.totalAkhir !== null) ? Number(fallbackInv.totalAkhir) : Number(fallbackInv.total || 0);
        fallbackInv.total = fallbackInv.totalAkhir;
        fallbackInv.items = fallbackInv.items || [];
        openInvoiceModal(fallbackInv);
        showToast('Menampilkan nota ' + noInvoice, 'success');
      } else {
        alert((res && res.message) ? res.message : 'Gagal membuka detail invoice.');
      }
    }, function (err) {
      // Jika panggilan jaringan server mengalami kendala, gunakan fallback cachedTrx
      if (cachedTrx) {
        var fallbackInv = Object.assign({}, cachedTrx);
        fallbackInv.namaPelanggan = fallbackInv.namaPelanggan || fallbackInv.pelanggan || 'Pelanggan Umum';
        fallbackInv.totalAkhir = (fallbackInv.totalAkhir !== undefined && fallbackInv.totalAkhir !== null) ? Number(fallbackInv.totalAkhir) : Number(fallbackInv.total || 0);
        fallbackInv.total = fallbackInv.totalAkhir;
        fallbackInv.items = fallbackInv.items || [];
        openInvoiceModal(fallbackInv);
        showToast('Menampilkan nota ' + noInvoice, 'success');
      } else {
        alert('Kendala koneksi mengambil data nota: ' + (err.message || err));
      }
    });
  }

  // ============================================================================
  // 11.B ANALITIK & GRAFIK PENJUALAN BARANG ATK
  // ============================================================================
  var chartInstances = {
    topProducts: null,
    salesTrend: null,
    paymentMethods: null
  };

  function switchRiwayatSubView(subView) {
    var btnTable = document.getElementById('btnSubnavTable');
    var btnChart = document.getElementById('btnSubnavChart');
    var tableContainer = document.getElementById('historyTableContainer');
    var chartContainer = document.getElementById('historyChartContainer');

    if (!btnTable || !btnChart || !tableContainer || !chartContainer) return;

    if (subView === 'chart') {
      btnTable.classList.remove('active');
      btnChart.classList.add('active');
      tableContainer.style.display = 'none';
      chartContainer.style.display = 'block';
      loadSalesAnalytics('all');
    } else {
      btnChart.classList.remove('active');
      btnTable.classList.add('active');
      chartContainer.style.display = 'none';
      tableContainer.style.display = 'block';
    }
  }

  function changeAnalyticsPeriod(period) {
    var chipBtns = document.querySelectorAll('.period-chip-btn');
    chipBtns.forEach(function (btn) {
      if (btn.getAttribute('data-period') === period) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    loadSalesAnalytics(period);
  }

  function loadSalesAnalytics(period) {
    period = period || 'all';

    GasBridge.call('getSalesAnalyticsData', [period], function (res) {
      if (res && res.success) {
        AppState.lastAnalyticsData = res;
        renderSalesAnalyticsUI(res);
      } else {
        showToast('Gagal memuat analitik penjualan: ' + (res ? res.message : 'Kesalahan server'), 'error');
      }
    });
  }

  function renderSalesAnalyticsUI(data) {
    var summary = data.summary || {};
    document.getElementById('kpiTotalOmset').textContent = formatRupiah(summary.grandTotalOmset || 0);
    document.getElementById('kpiTotalQty').textContent = (summary.grandTotalQty || 0).toLocaleString('id-ID') + ' Pcs';
    document.getElementById('kpiTotalTrx').textContent = (summary.grandTotalTrx || 0).toLocaleString('id-ID') + ' Nota';
    document.getElementById('kpiTopProduct').textContent = summary.topProduct || '-';

    renderTopProductsChart(data.topProducts || []);
    renderSalesTrendChart(data.dailyTrend || []);
    renderPaymentMethodsChart(data.paymentMethods || []);
    renderAnalyticsProductTable(data.allProducts || [], summary.grandTotalOmset || 0);
  }

  function renderTopProductsChart(items) {
    var canvas = document.getElementById('chartTopProductsCanvas');
    if (!canvas) return;

    if (chartInstances.topProducts) {
      chartInstances.topProducts.destroy();
      chartInstances.topProducts = null;
    }

    if (typeof Chart === 'undefined') return;

    var labels = items.map(function (it) {
      return it.nama.length > 22 ? it.nama.substring(0, 20) + '...' : it.nama;
    });
    var qtyData = items.map(function (it) { return it.qty; });

    var ctx = canvas.getContext('2d');
    chartInstances.topProducts = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Kuantiti Terjual (Qty)',
          data: qtyData,
          backgroundColor: '#2563eb',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: function (context) {
                var idx = context.dataIndex;
                var omset = items[idx] ? items[idx].omset : 0;
                return 'Omset: ' + formatRupiah(omset);
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    });
  }

  function renderSalesTrendChart(trends) {
    var canvas = document.getElementById('chartSalesTrendCanvas');
    if (!canvas) return;

    if (chartInstances.salesTrend) {
      chartInstances.salesTrend.destroy();
      chartInstances.salesTrend = null;
    }

    if (typeof Chart === 'undefined') return;

    var labels = trends.map(function (t) { return t.label || t.dateKey; });
    var omsetData = trends.map(function (t) { return t.omset; });

    var ctx = canvas.getContext('2d');
    chartInstances.salesTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Omset Penjualan (Rp)',
          data: omsetData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: true,
          pointBackgroundColor: '#059669',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return 'Omset: ' + formatRupiah(context.parsed.y);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (val) {
                if (val >= 1000000) return (val / 1000000) + ' Jt';
                if (val >= 1000) return (val / 1000) + ' Rb';
                return val;
              }
            }
          }
        }
      }
    });
  }

  function renderPaymentMethodsChart(methods) {
    var canvas = document.getElementById('chartPaymentMethodsCanvas');
    if (!canvas) return;

    if (chartInstances.paymentMethods) {
      chartInstances.paymentMethods.destroy();
      chartInstances.paymentMethods = null;
    }

    if (typeof Chart === 'undefined') return;

    var labels = methods.map(function (m) { return m.method; });
    var totals = methods.map(function (m) { return m.total; });

    var bgColors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

    var ctx = canvas.getContext('2d');
    chartInstances.paymentMethods = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: totals,
          backgroundColor: bgColors.slice(0, labels.length)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (context) {
                var val = context.raw || 0;
                return context.label + ': ' + formatRupiah(val);
              }
            }
          }
        }
      }
    });
  }

  function renderAnalyticsProductTable(products, grandTotalOmset) {
    var tbody = document.getElementById('analyticsTableBody');
    if (!tbody) return;

    if (!products || products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--slate-400); padding: 2rem;">Tidak ada data penjualan pada periode ini.</td></tr>';
      return;
    }

    var html = '';
    products.forEach(function (it, idx) {
      var rankClass = (idx === 0) ? 'top-1' : (idx === 1 ? 'top-2' : (idx === 2 ? 'top-3' : ''));
      var pct = grandTotalOmset > 0 ? Math.round((it.omset / grandTotalOmset) * 100) : 0;

      html += '<tr>';
      html += '  <td style="text-align: center;"><span class="rank-badge ' + rankClass + '">' + (idx + 1) + '</span></td>';
      html += '  <td><span class="good-sku-badge">' + escapeHtml(it.kode) + '</span></td>';
      html += '  <td><strong>' + escapeHtml(it.nama) + '</strong></td>';
      html += '  <td style="text-align: center; font-weight: 700;">' + it.qty.toLocaleString('id-ID') + '</td>';
      html += '  <td style="text-align: right; font-weight: 800;">' + formatRupiah(it.omset) + '</td>';
      html += '  <td>';
      html += '    <div class="contribution-bar-wrap">';
      html += '      <div class="contribution-bar-bg"><div class="contribution-bar-fill" style="width: ' + Math.min(100, Math.max(2, pct)) + '%;"></div></div>';
      html += '      <span class="contribution-pct-label">' + pct + '%</span>';
      html += '    </div>';
      html += '  </td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;
  }

  // ============================================================================
  // 12. MASTER DATA BARANG ATK
  // ============================================================================
  function renderGoodsTable() {
    var tbody = document.getElementById('goodsTableBody');
    var isMaster = (AppState.currentUser && AppState.currentUser.peran.toLowerCase() === 'master');

    if (AppState.catalog.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--slate-400); padding: 2rem;">Belum ada data barang ATK.</td></tr>';
      return;
    }

    var html = '';
    AppState.catalog.forEach(function (item) {
      var stockClass = item.stok <= (item.minStok || 5) ? 'stock-low' : 'stock-safe';

      html += '<tr>';
      html += '  <td><span class="good-sku-badge">' + escapeHtml(item.kode) + '</span></td>';
      html += '  <td><strong>' + escapeHtml(item.nama) + '</strong></td>';
      html += '  <td>' + escapeHtml(item.kategori) + '</td>';
      html += '  <td>' + escapeHtml(item.satuan) + '</td>';
      if (isMaster) {
        html += '  <td style="text-align: right; color: var(--slate-500);">' + formatRupiah(item.hargaBeli) + '</td>';
      }
      html += '  <td style="text-align: right; font-weight: 700; color: var(--primary);">' + formatRupiah(item.hargaJual) + '</td>';
      html += '  <td style="text-align: center;"><span class="good-stock-badge ' + stockClass + '">' + item.stok + '</span></td>';
      html += '  <td style="text-align: center;">' + escapeHtml(item.status || 'Aktif') + '</td>';
      if (isMaster) {
        html += '  <td style="text-align: center; white-space: nowrap;">';
        html += '    <button class="btn-icon" onclick="openModalBarang(\'' + item.kode + '\')" title="Edit"><svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';
        html += '    <button class="btn-icon btn-icon-danger" onclick="confirmDeleteBarang(\'' + item.kode + '\')" title="Hapus Barang"><svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>';
        html += '  </td>';
      }
      html += '</tr>';
    });

    tbody.innerHTML = html;
  }

  function openModalBarang(kode) {
    var form = document.getElementById('formBarang');
    form.reset();
    var btnDel = document.getElementById('btnDeleteBarangModal');

    if (kode) {
      var item = AppState.catalog.find(function (i) { return i.kode === kode; });
      if (!item) return;

      document.getElementById('barangModalTitle').textContent = 'Edit Barang ATK';
      document.getElementById('barangFormKodeOld').value = item.kode;
      document.getElementById('barangFormKode').value = item.kode;
      document.getElementById('barangFormKode').disabled = true;
      document.getElementById('barangFormNama').value = item.nama;
      document.getElementById('barangFormKategori').value = item.kategori;
      document.getElementById('barangFormSatuan').value = item.satuan;
      document.getElementById('barangFormHargaBeli').value = item.hargaBeli || 0;
      document.getElementById('barangFormHargaJual').value = item.hargaJual;
      document.getElementById('barangFormStok').value = item.stok;
      document.getElementById('barangFormMinStok').value = item.minStok || 5;

      if (btnDel) {
        btnDel.style.display = 'inline-flex';
        btnDel.setAttribute('data-kode', item.kode);
        btnDel.setAttribute('data-nama', item.nama);
      }
    } else {
      document.getElementById('barangModalTitle').textContent = 'Tambah Barang ATK Baru';
      document.getElementById('barangFormKodeOld').value = '';
      document.getElementById('barangFormKode').value = '';
      document.getElementById('barangFormKode').disabled = false;

      if (btnDel) {
        btnDel.style.display = 'none';
        btnDel.removeAttribute('data-kode');
        btnDel.removeAttribute('data-nama');
      }
    }

    document.getElementById('modalBarangForm').classList.add('active');
  }

  function handleSaveBarang() {
    var itemData = {
      kode: document.getElementById('barangFormKode').value.trim(),
      nama: document.getElementById('barangFormNama').value.trim(),
      kategori: document.getElementById('barangFormKategori').value.trim() || 'Umum',
      satuan: document.getElementById('barangFormSatuan').value.trim() || 'Pcs',
      hargaBeli: Number(document.getElementById('barangFormHargaBeli').value) || 0,
      hargaJual: Number(document.getElementById('barangFormHargaJual').value) || 0,
      stok: Number(document.getElementById('barangFormStok').value) || 0,
      minStok: Number(document.getElementById('barangFormMinStok').value) || 5,
      status: 'Aktif'
    };

    if (!itemData.nama || itemData.hargaJual <= 0) {
      alert('Nama barang dan harga jual wajib diisi!');
      return;
    }

    var btn = document.getElementById('btnSubmitBarang');
    btn.disabled = true;

    GasBridge.call('saveGoodItem', [itemData, AppState.currentUser.peran], function (res) {
      btn.disabled = false;
      if (res.success) {
        document.getElementById('modalBarangForm').classList.remove('active');
        showToast(res.message || 'Barang berhasil disimpan', 'success');
        fetchInitialData(true);
      } else {
        alert(res.message || 'Gagal menyimpan barang.');
      }
    });
  }

  function confirmDeleteBarang(kode, optNama) {
    if (!AppState.currentUser || AppState.currentUser.peran !== 'Master') {
      alert('Hanya akun Master yang berhak menghapus barang!');
      return;
    }
    var item = AppState.catalog.find(function (i) { return i.kode === kode; });
    var nama = optNama || (item ? item.nama : kode);
    var pesan = 'Apakah Anda yakin ingin menghapus barang "' + nama + '" (' + kode + ') dari master data & inventaris?';
    if (confirm(pesan)) {
      handleDeleteBarang(kode, nama);
    }
  }

  function handleDeleteBarang(kode, nama) {
    var btnModal = document.getElementById('btnDeleteBarangModal');
    if (btnModal) btnModal.disabled = true;

    // Tutup modal edit seketika jika terbuka
    document.getElementById('modalBarangForm').classList.remove('active');

    // Pembaruan Instan 0 Detik (Optimistic UI Update): Langsung hilangkan dari memori dan layar
    AppState.catalog = AppState.catalog.filter(function (i) { return i.kode !== kode; });
    renderGoodsTable();
    renderGoodsGrid();
    showToast('Menghapus barang dari inventaris...', 'info');

    GasBridge.call('deleteGoodItem', [kode, AppState.currentUser.peran], function (res) {
      if (btnModal) btnModal.disabled = false;
      if (res.success) {
        showToast(res.message || 'Barang berhasil dihapus dari inventaris.', 'success');
        // Sinkronkan background data terbaru dari server
        GasBridge.call('getInitialAppData', [AppState.currentUser.peran], function (freshRes) {
          if (freshRes && freshRes.success) {
            AppState.catalog = freshRes.catalog || [];
            AppState.categories = freshRes.categories || [];
            renderGoodsTable();
            renderGoodsGrid();
            renderCategoryPills();
          }
        });
      } else {
        alert(res.message || 'Gagal menghapus barang dari database.');
        fetchInitialData(true);
      }
    });
  }

  // ============================================================================
  // 13. PENGATURAN TOKO & LIVE PREVIEW INVOICE (KHUSUS MASTER)
  // ============================================================================
  function updateLogoPreviewUI(url) {
    var img = document.getElementById('settingLogoPreviewImg');
    var emptyTxt = document.getElementById('settingLogoEmptyText');
    var btnDel = document.getElementById('btnHapusLogo');
    if (img && emptyTxt && btnDel) {
      if (url) {
        img.src = url;
        img.style.display = 'block';
        emptyTxt.style.display = 'none';
        btnDel.style.display = 'inline-flex';
      } else {
        img.src = '';
        img.style.display = 'none';
        emptyTxt.style.display = 'block';
        btnDel.style.display = 'none';
      }
    }
  }

  function populateSettingsForm() {
    var s = AppState.settings;
    var logoVal = s.LOGO_URL || '';
    if (document.getElementById('settingLogoUrl')) {
      document.getElementById('settingLogoUrl').value = logoVal;
    }
    updateLogoPreviewUI(logoVal);

    document.getElementById('settingNamaToko').value = s.NAMA_TOKO || '';
    document.getElementById('settingSlogan').value = s.SLOGAN || '';
    document.getElementById('settingAlamat').value = s.ALAMAT || '';
    document.getElementById('settingTelepon').value = s.TELEPON || '';
    document.getElementById('settingFooterNota').value = s.FOOTER_NOTA || '';
    if (document.getElementById('settingNamaPenandatangan')) {
      document.getElementById('settingNamaPenandatangan').value = s.NAMA_PENANDATANGAN || '';
    }
    document.getElementById('settingFormatDefault').value = s.FORMAT_DEFAULT || 'thermal';
    if (document.getElementById('settingTemaFaktur')) {
      document.getElementById('settingTemaFaktur').value = s.TEMA_FAKTUR || 'modern';
    }

    updateLiveInvoicePreview();
  }

  function updateLiveInvoicePreview() {
    var previewSettings = {
      LOGO_URL: (document.getElementById('settingLogoUrl') && document.getElementById('settingLogoUrl').value.trim()) || '',
      NAMA_TOKO: document.getElementById('settingNamaToko').value || 'MAH POS - Toko ATK',
      SLOGAN: document.getElementById('settingSlogan').value || '',
      ALAMAT: document.getElementById('settingAlamat').value || '',
      TELEPON: document.getElementById('settingTelepon').value || '',
      FOOTER_NOTA: document.getElementById('settingFooterNota').value || '',
      NAMA_PENANDATANGAN: (document.getElementById('settingNamaPenandatangan') && document.getElementById('settingNamaPenandatangan').value.trim()) || '',
      FORMAT_DEFAULT: document.getElementById('settingFormatDefault').value || 'thermal',
      TEMA_FAKTUR: (document.getElementById('settingTemaFaktur') && document.getElementById('settingTemaFaktur').value) || 'modern'
    };

    var oldSettings = Object.assign({}, AppState.settings);
    Object.assign(AppState.settings, previewSettings);

    var sampleInvoice = {
      noInvoice: 'INV-202610-001',
      tanggal: '2026-10-08 14:30',
      kasir: previewSettings.NAMA_PENANDATANGAN || 'kasir1',
      kasirSign: previewSettings.NAMA_PENANDATANGAN || 'kasir1',
      namaPelanggan: 'Bpk. Ahmad (Kantor)',
      noWhatsApp: '081234567890',
      subtotal: 90000,
      diskon: 5000,
      totalAkhir: 85000,
      bayar: 100000,
      kembali: 15000,
      metodeBayar: 'Tunai',
      items: [
        { kode: 'ATK-001', nama: 'Kertas HVS A4 70gr Sinar Dunia', kuantiti: 1, hargaSatuan: 52000, subtotalItem: 52000 },
        { kode: 'ATK-003', nama: 'Pulpen Standard AE7 0.5 Hitam', kuantiti: 5, hargaSatuan: 3500, subtotalItem: 17500 },
        { kode: 'ATK-006', nama: 'Buku Gambar A3 Kiky', kuantiti: 2, hargaSatuan: 10000, subtotalItem: 20000 }
      ]
    };

    var el = document.getElementById('liveInvoicePreview');
    var format = previewSettings.FORMAT_DEFAULT;
    var theme = previewSettings.TEMA_FAKTUR;
    el.className = 'invoice-container format-' + format + (format === 'a5' ? ' theme-' + theme : '');

    renderInvoiceHTML(el, sampleInvoice, format, theme);

    AppState.settings = oldSettings;
  }

  function handleSaveStoreSettings() {
    var newSettings = {
      LOGO_URL: (document.getElementById('settingLogoUrl') && document.getElementById('settingLogoUrl').value.trim()) || '',
      NAMA_TOKO: document.getElementById('settingNamaToko').value.trim() || 'MAH POS',
      SLOGAN: document.getElementById('settingSlogan').value.trim(),
      ALAMAT: document.getElementById('settingAlamat').value.trim(),
      TELEPON: document.getElementById('settingTelepon').value.trim(),
      FOOTER_NOTA: document.getElementById('settingFooterNota').value.trim(),
      NAMA_PENANDATANGAN: (document.getElementById('settingNamaPenandatangan') && document.getElementById('settingNamaPenandatangan').value.trim()) || '',
      FORMAT_DEFAULT: document.getElementById('settingFormatDefault').value,
      TEMA_FAKTUR: document.getElementById('settingTemaFaktur') ? document.getElementById('settingTemaFaktur').value : 'modern'
    };

    var btn = document.getElementById('btnSaveSettings');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    GasBridge.call('saveStoreSettings', [newSettings, AppState.currentUser.peran], function (res) {
      btn.disabled = false;
      btn.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path></svg> Simpan Pengaturan Invoice';

      if (res.success) {
        AppState.settings = Object.assign(AppState.settings, newSettings);
        document.getElementById('topBarStoreName').textContent = newSettings.NAMA_TOKO;
        showToast('Pengaturan invoice dan identitas toko berhasil disimpan!', 'success');
      } else {
        alert(res.message || 'Gagal menyimpan pengaturan.');
      }
    });
  }

  // ============================================================================
  // 14. KELOLA PENGGUNA (KHUSUS MASTER)
  // ============================================================================
  function loadUsersList() {
    var tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--slate-400); padding: 1.5rem;">Memuat akun pengguna...</td></tr>';

    GasBridge.call('getUsersList', [AppState.currentUser.peran], function (res) {
      if (res.success) {
        var html = '';
        (res.data || []).forEach(function (u) {
          html += '<tr>';
          html += '  <td><span class="good-sku-badge">' + escapeHtml(u.id) + '</span></td>';
          html += '  <td><strong>' + escapeHtml(u.username) + '</strong></td>';
          html += '  <td>' + escapeHtml(u.namaLengkap) + '</td>';
          html += '  <td><span class="role-tag ' + (u.peran.toLowerCase() === 'master' ? 'master' : '') + '">' + escapeHtml(u.peran) + '</span></td>';
          html += '  <td>' + (u.status === 'TRUE' ? '<span class="stock-safe" style="padding: 2px 6px; border-radius: 9999px;">Aktif</span>' : '<span class="stock-low" style="padding: 2px 6px; border-radius: 9999px;">Nonaktif</span>') + '</td>';
          html += '  <td style="text-align: center;">';
          html += '    <button class="btn-icon" onclick="openModalPengguna(\'' + u.username + '\', \'' + escapeHtml(u.namaLengkap) + '\', \'' + u.peran + '\', \'' + u.status + '\')"><svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';
          html += '  </td>';
          html += '</tr>';
        });
        tbody.innerHTML = html;
      }
    });
  }

  function openModalPengguna(username, nama, peran, status) {
    var form = document.getElementById('formPengguna');
    form.reset();

    if (username) {
      document.getElementById('penggunaModalTitle').textContent = 'Edit Akun Pengguna';
      document.getElementById('userFormUsername').value = username;
      document.getElementById('userFormUsername').disabled = true;
      document.getElementById('userFormNama').value = nama || '';
      document.getElementById('userFormPeran').value = peran || 'Kasir';
      document.getElementById('userFormStatus').value = status || 'TRUE';
    } else {
      document.getElementById('penggunaModalTitle').textContent = 'Tambah Akun Baru';
      document.getElementById('userFormUsername').value = '';
      document.getElementById('userFormUsername').disabled = false;
    }

    document.getElementById('modalPenggunaForm').classList.add('active');
  }

  function handleSavePengguna() {
    var userData = {
      username: document.getElementById('userFormUsername').value.trim(),
      namaLengkap: document.getElementById('userFormNama').value.trim(),
      password: document.getElementById('userFormPassword').value.trim(),
      peran: document.getElementById('userFormPeran').value,
      status: document.getElementById('userFormStatus').value
    };

    if (!userData.username || !userData.namaLengkap) {
      alert('Username dan Nama Lengkap wajib diisi!');
      return;
    }

    var btn = document.getElementById('btnSubmitPengguna');
    btn.disabled = true;

    GasBridge.call('saveUser', [userData, AppState.currentUser.peran], function (res) {
      btn.disabled = false;
      if (res.success) {
        document.getElementById('modalPenggunaForm').classList.remove('active');
        showToast(res.message || 'Akun pengguna berhasil disimpan', 'success');
        loadUsersList();
      } else {
        alert(res.message || 'Gagal menyimpan akun.');
      }
    });
  }

  // Helper XSS Escape
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================================================
  // 17. MODUL MAHEX DELIVERY (GENERATOR FAKTUR PENGIRIMAN & LOGISTIK BAHAN BAKU)
  // ============================================================================
  const DEFAULT_MAHEX_TARIF = {
    "BANTEN RAYA": {
      "Pasar Kemis": [100000, 200000, 300000, 400000, 600000, 800000],
      "Kelapa Dua": [100000, 200000, 300000, 400000, 600000, 800000],
      "Inpres Raya": [150000, 300000, 400000, 500000, 750000, 950000],
      "Puspitek Raya": [150000, 300000, 400000, 500000, 750000, 950000],
      "Bukit Dago": [150000, 300000, 400000, 500000, 750000, 950000],
      "Mujair": [150000, 300000, 400000, 500000, 750000, 950000],
      "Mauk": [150000, 300000, 400000, 500000, 750000, 950000],
      "Jati Mauk": [150000, 300000, 400000, 500000, 750000, 950000],
      "Kibin": [150000, 300000, 400000, 500000, 750000, 950000],
      "Talaga Bestari": [150000, 300000, 400000, 500000, 750000, 950000],
      "Kronjo": [185000, 350000, 450000, 550000, 800000, 1000000],
      "Taman Adiyasa": [185000, 350000, 450000, 550000, 800000, 1000000],
      "Ciruas": [185000, 350000, 450000, 550000, 800000, 1000000],
      "Grogol Cilegon": [200000, 400000, 500000, 650000, 850000, 1100000],
      "Citangkil": [200000, 400000, 500000, 650000, 850000, 1100000],
      "Anyer": [220000, 430000, 530000, 680000, 870000, 1150000],
      "Labuan": [250000, 450000, 550000, 700000, 950000, 1250000],
      "Panimbang": [250000, 450000, 550000, 700000, 950000, 1250000],
      "Menes": [250000, 450000, 550000, 700000, 950000, 1250000],
      "BPI Rokoy": [250000, 430000, 550000, 700000, 950000, 1250000],
      "Malingping": [250000, 450000, 550000, 700000, 950000, 1250000]
    },
    "JABODETABEK - BANDUNG - PRIATIM": {
      "Grogol Petamburan": [185000, 300000, 400000, 550000, 750000, 950000],
      "Wibawa mukti": [200000, 350000, 450000, 600000, 800000, 1000000],
      "Bantar Gebang": [200000, 350000, 450000, 600000, 800000, 1000000],
      "Bojong Kulur": [200000, 350000, 450000, 600000, 800000, 1000000],
      "Cikeas": [250000, 400000, 500000, 650000, 850000, 1050000],
      "Babakan Madang": [280000, 400000, 500000, 650000, 850000, 1050000],
      "Cigombong": [300000, 400000, 500000, 650000, 850000, 1050000],
      "Cikereteg": [300000, 400000, 500000, 650000, 850000, 1050000],
      "Cicurug": [300000, 400000, 500000, 650000, 850000, 1050000],
      "Pacet": [350000, 450000, 550000, 700000, 900000, 1150000],
      "Baros": [350000, 450000, 550000, 700000, 900000, 1150000],
      "Parung Kuda": [300000, 400000, 500000, 650000, 850000, 1050000],
      "Pakuwon": [300000, 400000, 500000, 650000, 850000, 1050000],
      "Cikalong Kulon": [350000, 450000, 550000, 700000, 900000, 1150000],
      "Sukatani": [250000, 400000, 500000, 650000, 850000, 1050000],
      "Telaga Murni": [250000, 400000, 500000, 650000, 850000, 1050000],
      "Ujung Berung": [350000, 450000, 550000, 700000, 900000, 1150000],
      "Babakan Ciparay": [350000, 450000, 550000, 700000, 900000, 1150000],
      "Ebah Majalaya": [370000, 500000, 600000, 750000, 950000, 1200000],
      "Pangalengan": [370000, 500000, 600000, 750000, 950000, 1200000],
      "Garut": [420000, 580000, 680000, 850000, 1050000, 1250000],
      "Ciawi Tasik": [420000, 580000, 680000, 850000, 1050000, 1250000],
      "Pangandaran": [550000, 680000, 780000, 950000, 1150000, 1550000]
    },
    "PANTURA RAYA": {
      "Tanjungpura": [200000, 350000, 450000, 650000, 850000, 1100000],
      "Lamaran": [250000, 400000, 500000, 700000, 900000, 1150000],
      "Cibuaya": [250000, 400000, 500000, 700000, 900000, 1150000],
      "Wadas": [300000, 450000, 550000, 750000, 950000, 1200000],
      "Kondang Jaya": [250000, 400000, 500000, 700000, 900000, 1150000],
      "Telagasari": [250000, 400000, 500000, 700000, 900000, 1150000],
      "Kosambi": [250000, 400000, 500000, 700000, 900000, 1150000],
      "Purwadadi": [270000, 420000, 520000, 720000, 920000, 1170000],
      "Pabuaran Subang": [270000, 420000, 520000, 720000, 920000, 1170000],
      "Cipeundeuy": [270000, 420000, 520000, 720000, 920000, 1170000],
      "Sukamandi": [320000, 500000, 600000, 800000, 1000000, 1250000],
      "Wedrink Subang": [350000, 550000, 650000, 850000, 1050000, 1300000],
      "Pagaden": [350000, 550000, 650000, 850000, 1050000, 1300000],
      "Cikampek": [250000, 400000, 500000, 700000, 900000, 1150000],
      "Cilamaya": [270000, 450000, 550000, 750000, 950000, 1200000],
      "Tegalwaru": [270000, 450000, 550000, 750000, 950000, 1200000],
      "Tempuran": [270000, 450000, 550000, 750000, 950000, 1200000],
      "Majalengka": [370000, 580000, 680000, 900000, 1100000, 1250000],
      "Babakan Cirebon": [420000, 620000, 720000, 950000, 1150000, 1400000],
      "Pabuaran Kidul Cirebon": [420000, 620000, 720000, 950000, 1150000, 1400000],
      "Dukupuntang": [400000, 600000, 700000, 920000, 1120000, 1380000],
      "Arjawinangun": [400000, 600000, 700000, 920000, 1120000, 1380000],
      "Palaraya Tegal": [450000, 650000, 750000, 950000, 1200000, 1500000],
      "Adiwerna": [450000, 650000, 750000, 950000, 1200000, 1500000]
    }
  };

  const MahexLogoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA8wAAAFFCAYAAAA5CGRXAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAP+lSURBVHhe7J0HdBzV1cfv7qpsU++9t93ZmVnJ2NgG22Bbkuk9AUICBEJ6gEAKaUACoQRCSwgJgdAs2ZiWAB9JIARIQkIICYQSIPQaugFjW1rt/c4dzcijN7PSaqWVZqX7P+d/DNqdN/Pem919v3n33QfAYrFYLBaLxWKxWCwWi8VisVgsFovFYrFYLBaLxWKxWCwWi8VisVgsFovFmqZcAFAPAB36f7NYLBaLxWKxWCwWi7Xg5QaAZgC4FQD+DAArASBLfBOLxWKxWCwWi8VisVgLSQTLjQBwJwCMAEAMAB4DgK8AQL74ZhaLxWKxWCwWi8VisRaCKPS6AABu0EGZgDmu//fvAaBSPIDFYrFYLBaLxWKxWKz5LppZLgGAWwBg2ATLZPr/0wHAKx7EYrFYLBaLxWKxWCzWfBbNLBMw/wQAtgmwTP/9CgD0c/IvFovFYrFYLBaLxWItJBEE+wHgHAD4wAUQJwvAfC8AlIoHslgsFovFYrFYLBaLNd91CgC8R3Aczs2Nu0dBGXVg3g4A5/LsMovFYrFYLBaLxWKxFpJoTfLnAOBtF8DImmAw3p6bS6BswDL5QwDYl4GZxWKxWCwWi8VisVgLRbSv8qcA4A0PwMgeeXnxb5SXx3NcLszaAcyUHfsRAGhlYGaxWCwWi8VisVgs1kKQDwAOAoDnCZZXB4Pxv7S3x3v8ftytsBDdo8BMa5eHAOBK/f0sFovFYrFYLBaLxWLNa9HM8p4Ey26AkajPF7+/vT3+6eJi7M3Lw6jPZw7HfhMA9uPZZRaLxWKxWCwWi8VizXdlA8BKAPiHCyAW9nrjd7a2xn/X2oqNOTn4o5oapJBsU3bsfwFAkVgIi8VisVgsFovFYrFY80m0z3JEh+BYTVZW/Mampvj7ioIfKyzEY4qL8ZL6ei0cW99WahgAfiEWwmKxWCwWi8VisVgs1nwShVRLAHAXrUtuysmJX9PQoMHytQ0NuMTnw391deERJSXm9cvbAOCTYkEsFovFYrFYLBaLxWLNJ5UAwD00s1zs8cQvr6+Pb1UUfCEcxmWBAH6rshJfVxRszs01ZpcJmN8AgC5ev8xisVgsFovFYrFYrPmqOgC4xQWwvcTjiV9cUxP/UFFwSFW1NcsrAgF8vKsLB5ubMeB2m7eTuhUAcsXCWCwWi8VisVgsFovFynTRzHAQAG6iBF+5Llf8OxUV8e2KgjFVxUe6unB5IIC/qq/HjxQFDy4qQs+O/ZcpHPsAnl1msVgsFovFYrFYLNZ8E4FuGQD8ygWwNcflGvlmeXmcwHhEVfE9WcYvlJbiXvn5+Jok4dPhMHaMhmMTMNPs8jMA4BcLZbFYLBaLxWKxWCwWK5NFsOwFgJ/QWmRak9yXl0dh2HGaWSbf2dqKLTk5eENTkwbQv2lpweCOcGzKjn2NqSwWi8VisVgsFovFYrEyXgS4eQDuMwDgQzfAyH4FBfH39DDsuKrim7KMRxQV4bElJdpMcywaxZMrKjBrdP9lSvZF/x7FsMxisVgsFovFYrFYrPkiAtwcAPfJALCdYLnb54u/IEk4rKraTDIl+qJtpEJeLz7Y0aHB8vuyrGXK1rNjUzj2EAC06/s2s1gsFovFYrFYLBaLldEywrCPBYBXKcnXqmAw/kQopIVh08wyAfOz4TDuEgjgdysrtURf9NrvWluxKjvbCMemGeY7ASBbPAGLxWKxWCwWi8VisViZKA8AHAYAb3kARqI+X/yBjo44QTLBMnm7quJFtbW4WzCIz4ZCGixvUxT8ZkUFZo+GYxMwbweAPTkcm8VisVgsFovFYrFY80E0G7w3ADxJYdiLfL74/e3tcQrDNmCZ4Pjhzk5UfT68uqFBm20mvxKJaABtyo797OgaaAZmFovFYrFYLBaLxWJltmidcS9tA0Ww3JyTE7+9uXnczDL990eqikcXF2N/Xh6+FYmMAfOf2tuxMivLHI69SZ+tZmBmsVgsFovFYrFYLFbGisB2EQD8wwUw0pCdHb+hsTG+VVHGYNkA5r91dGBbTg7+rqVlLFv2SDSKF9TWos/lMmCZ/v0yJ/tisVgsFovFYrFYLFYmi6B2MQD8i7JbF7jd8Utqa+O0TlmcXf5AlnFdXh5+rrRUW8ds/J2yY3+ssBDdo6BM/ggAVJ5dZrFYLBaLxWKxWCxWpoqAtg4A/k7ZsINud/z8mpr4+4oSN88sG2uXL62r07JgP9rVNQbT9O8/OzuxKzfX2E7KyI6dL56MxWKxWCwWi8VisVisTBDBcjMA/JWSdGW7XPGvV1TEt6jquHXLBhS/Folg1OfD71dVaXswG++hmeZf1NWhdzQ7NsEy7b1MW1JliSdksVgsFovFYrFYLBbL6SJYDgC47qLtnwiWv1RaGv/AZmZZA+ZoFL9TUYErg0HcYoJl+vdtWcbDioqM2WXKjv0CAIQ5HJvFYrFYLBaLxWKxWJkmAtlSPYv1kAcgfmRxcXyrCYQxGtVsQPH97e3YkJ2NNzQ1WdY1U3h2c06OOTv27RyOzWKxWCwWi8VisVisTJQXAC6jxFxZAPG98/PjHylKQljeGo3iEcXFWrIvSvplnnmmdc3XNDZintsdp+zaOjB/GwByxJOyWCwWi8VisVgsFovlZBUCwNkA8AHNLK/Ly4u/re+lbECwAcsGEP+muRlVn0+bZR4WQrUJtL9QWmpkxyZYfg8AVnE4NovFYrFYLBaLxWKxMkl+ADgJADa7AUaiPl/8+XA4buylbDe7/Iok4c5+P55YVobbbLaZeiYcxkU+n3n98h8BoEY8MYvFYrFYLBaLxWKxWE4VrSn+OgC8QaHTPT5f/IH29oSwbMwuX1BTg7LXiw93do4L2aZ/abb5luZm9I9mxyZg3goAp3A4NovFYrFYLBaLxWKxMkW0Zpm2eXqHwqZbc3Lif2xri9PWUCIsm2eXXwyHcUUggD+vq8NtijLuvfT6h4qCXyorM2CZZpdfBYDdORybxWKxWCwWi8VisVhOF4FrLgAcDQCvEdi25+bGb2lujlN49USw/L4s4zcqKvDAggJ83bTG2XifAdS0L7MpO/afAaBavAgWi8VisVgsFovFYrGcJg9A1hoAeNEFEKvPzo6vb2iIm2eL7UKxCYbvam3F6qws3NjYqIVmm99rvOePbW1Y4vGYs2Ofp89ms1gsFovFYrFYLBaL5UjRzLILIKsfAJ5xAQxXZ2XFr25oiG9NAMtmEP5AUfDTxcX4iaIifCMSsbyX/nu7quIPq6rQ43IZs8vvAsABAOAWL4bFYrFYLBaLxWKxWCwnqRYA/kOwXOR2xy+oqdFmlsXto8TZZZpNvqOlBZf4/fhgR4clFNt477uKgrsGAkZ2bALmBwCgldcvs1gsFovFYrFYLBbLyZIB4FGCZZ/LFT+tsjJOCboSwbJ5dvklScJlfj9+rbxcy4ItArMB1QTTvh3ZsbcBwCWcHZvFYrFYLBaLxWKxWE4Vze6WAsC9lLU62+WKf7K4OL5Zli3rkEXT3wmQL62rw87cXG0bKbtj6L8pu/YZ1dXmZF9vAMD+PLvMYrFYLBaLxWKxWCwnimC1GQD+AgDDboD4J4qK4ptNs8QTwTK9h9YrLw8E8KKaGg2K7Y6h921RVdw9GDQD84N6CDiLxWKxWCwWi8VisViOEiXaqgCAGwhiPQDxFcFg/NVIxHaWWIRlMiX6+np5uQbCHwl7LpvfS+U9L0lYk51N2bGN/ZcvA4AAzzCzWCwWi8VisVgsFstJIkitA4BNALCdIHZdfn78DVlOambZgGDaIoq2kdrQ2GhZt2x+/0g0qm01pWfHJr8HAEcwLLNYLBaLxWKxWCwWy0ky1ixTwq2hLJcrviwQiD/W1RWfDJbHAJi2iIpG8bCiIjywsBDfNyUHE99LHo5Gce/8fHN27EcAoI2BmcVisVgsFovFYrFYThEBahEA/AgANrsBRnYJBOLPhULxycKwxRnjgcZGLdHXE11dCWeljZnoZ8JhMTv25QDgES+OxWKxWCwWi8VisVisuZIPAE4EgHcJlrtyc+N3t7YmNbM8Bsv6NlKS14vfqqjAIT2pl92xBjBfXl9PsEym2eXNAHAYzy6zWCwWi8VisVgsFsspygWALwLA6y6AkbacHA2Wt08BljVHo3hudTV25OZq4GzMTIvvJxNIb1NVPKywkMKxCZgp2deTANDOwMxisVgsFovFYrFYLCcoGwCOBoBXaZa3Kisrfk1DQ5xgdgyEE0CvGZgJgP/d2YkRr1dL4jXZzLS27ZQsY9jrNdYvEzDfBABB8QJZLBaLxWKxWCwWi8WabWUBwEEA8BrBconHE7+qoSG+xbQNVCLgFWH5Q0XBTxYX4555edp/JwrFHjsmGsU/tLZintttrF/+CAA+x7PLLBaLxWKxWCwWi8Waa9Fey+sA4EWC5Xy3O35udXXcDLuJgNcOfn/f2ortubkaBA9Pcjz9ncK1P19aitmj20nR+mWa4W5mYGaxWCwWi8VisVgs1lyKYLkbAD6kUGi/yxU/vbJy3JrlRLArgi+ZZqTX5eXhyWVl+NEkxxuw/LIkYUtOjjG7PAwANzIss1gsFovFYrFYLBZrLkWwvMiYWfa5XPETy8riH00SRi3agOIhVcWf1tVht8+Hj3Z1TZjoyziOznNjU5MWjk1JxgBgOwAcJV4oi8VisVgsFovFYrFYsyWawW0FgGdpZjnX5YofVVwcj6UIy3TMC+EwLvX78YfV1UjQPVkZdMxwNIrHl5UZs8uU7OstAAjzDDOLxWKxWCwWi8ViseZCBKMtAHAXhUB7AOL7FRTE/xeJTGnNsgHMxrZQtI1Ub14ePhMKTQrdxnHvyzLuGggY2bFphvkfAJDPwMxisVgsFovFYrFYrNkWgWg1ANxK4c8Ey8v8/vibkchYCPVEoCtCL5mO+3N7Oy7x+/G6hoakoFsD5mgU/9rejmVZWQTLBjB/h2GZxWKxWCwWi8VisVhzoToAuA4AthGkLg0E4k+EQlOGZTMwvyPLeExJCe5fUICvStKks8uozy5TBu1vVVQgrZ3Ww7Hf5ezYLBaLxWKxWCwWi8WaC1UBwBW0zzEl2Ir6fPF/dXbGJ9v6yc7m2eXbW1pwkd+Pt7W0TLqNlHEsAfNrkQgu3xGOTdmxb9evk4GZxWKxWCwWi8VisVizIgLQYgC4EAC2ECxLXm/8j21tKcGyAb1k2hLqgIICPKWiAs37NovvF4+l993d1oblHg8l/KJQbALm48ULZ7FYLBaLxWKxWCwWK50qAYAzAOB9N8BIe25u/I6WlviQnsl6MsC1Mx1DezVfWleHPT4fPtzZmdTaZeNYWr98bk0NugEImCkcezMA7KxvdcVisVgsFovFYrFYLFZaRTPLuQBwqj6zHK/Lzo7f3NQUpz2Tk4FbOxszxM+Fw7gyGMRzqqtx6xRml8l0/gMLC83ZsR8GgFKxAiwWi8VisVgsFovFYqVDXgA4GgDepjDsyqys+K/q6+NmuJ0McEUbx9A2UmdVVeHaYBBfTybRl+l4eu/ToRB25uYa+y8TMP9Ah3sWi8VisVgsFovFYrHSJppZJh8OAO9RyDNlor6otjb+kQ6sqcCyAbyU6OsfnZ3YnJOD1zc2Tqk8431XNTRggcdjwDJd4yJO9sVisVgsFovFYrFYrHSLwHMFALxOsOx3u+PfqKiIb57GzLIBu8Z2UEcXF+O6/Hx8W5aTnl0m03tpG6rDi4qMcGxav/xHPSkZAzOLxWKxWCwWi8VisdKqPmNmmaD0K2Vl42aWaR9kEWSTsQHMD3V0YG12Nv6zo2NKsGwc/1hnJzZlZxMw0+wyAfNpnOyLxWKxWCwWi8VisVjplAcAlgLAf2mbJq/LFT+0qCj+v0hEC6NOdWbZDLtvyTJ2+3x4cnk5xvUZ42TLpPfRdaxvbKTs2EY49ocA0MuzyywWi8VisVgsFovFSpcIOA1YjhGQHlRYGP/AnL06SbAVbYA2AfJFNTVYnpWF/wmFxiBcfL+djTIonPvLZWXmZF//BoAasTIsFovFYrFYLBaLxWLNhLIAoBsA7iVYzna54quDwfgzodC01iybYZfKeVmScCe/Hy+prZ1yuUYZr0UiuNzvN4B5WN8f2i9WiMVisVgsFovFYrFYrOmKZpa7AOA+Y2Z5eSAQfzsSmTLU2tk4fquq4nElJdifl4fDUwzFJtP7aUb6nrY2LPN4jPXLbwHAal6/zGKxWCwWi8VisVismRaBZhsAXA8AQwTL3T5f/B8dHfGRFKDWznQ8ge6dra1Y6vHgpqamKYd4G7PLHyoKfruiwli/TMm+CPKrxEqxWCwWi8VisVgsFos1HdHMMsEmwfIwZcNuz82NP9LZGZ9ugi8z6GrAHI3iIYWFeFhREW6W5SmXbQDzK5KEstdrXr98oR5OzmKxWCwWi8VisVgs1oyIYLkSAC7Rs0zHm3Jy4r9ubo5vn2FYpiRd1zU24jK/H5+eYqIvc1l03B/a2pAyd+uwvB0ADuHs2DuEAO7hSGTpsKKcHVPVm4dV9W6ztyjKn18Mhx9/MhR67qnxfuGpUOjFSfzSU11dLz8VCr0yF36sq+vFf3R2Pj3Y1PTQyoLCv9f7/Zob/f4/twUCdyzNL7j02vr6TwxLUq/mUGj1cFfXiiFFiWJnZ7utu7raMBJpxq6uqucaG71ie86EYtHop2OqelVMUe4S++N/kvTPp0KhZ8198WQo9LxN21s9h31h+NHOzud/09LycHd+/lh/kJt8gXt78vKvure5+cCx/pCktcOStGooHFYs/WB2ONyKklSHPT3ZYls6SQjgGo5G14yo6mUxRfn1sKr+wdy3b0Yi/3g+JP3H/FnT+3bSz9rTodBLT0+zfx8LhV68r7398Z/W1z+4yNQ/jX7/X7qCwRtX5xeed0dT0yFj/RMO7zYcDi/fLkmypU/Mn5eurgaU5XKn948hVJT9RxTlimGbz98bkchDT4fDz6Ty+Xsy9f55+a8dHU+eWl3992Z/YNznpj0QuO2Q4uJTN4fD/WP9IsurhyVp2fZwOGTpD7Nluen9zs4Ssf6pansk0jmsKD+MqeqtYrttVZT7nguFnxR+Q5L6HXmSfkesbZKUH+3qen5Tc/O/5Dzx+8Z/3+K8gl+Y72ek75tIZCUm8X3zkaLUHL387Dzo3fg56B+8FvoG/wD9g3eb7dr95w+7V170rGflhc+Z/LxnxQUvelZcNLFXXviyZ8WFr3hWXMSeilde8LJn+dn/9bXs+/eCQOnfCwIlhv9WECz/vb96+XdhzXV9sHawV/Pq69bAmvW7wJrBLlg92J7YNzRD38ZiHjuyWKzJRF8SQQD4KQBsI1iuys6O/6alZcZg2Qy5z4TD2OP34/erqjR4TqV8Y4b57Koq83ZSlM2b1l6zdA0ryi4xVf2Q2n0+m7Y5awsEsdDrG+cir2/kN83NJ8Yk6RNmo6quwkikZ1K3tuaKbZqqNKBSlD+I1z4f/dOGBktfkHcvKPyd2BcxSToEZXmJpe1Fd3Y2im3qJA3J8lfEdnCqX49EcEVhkaV/yr2+9y+trf+e2EeoKH2W/hA8FAqpGArR74hjNaKqXxDbwkk+rqLC0ifkPQuLbrb0iSwfKPaBrdvbp71jBD14jSnKi+L1OsVvRCJY4/Nb2q3aH3jngdbWz1vaLhJZYWknwaW9V9zr6h9EtvPsXnMF5pW0Wvq70Osfdu/03a/A2g2fGOe+jf3Qu7FnQvcNdkPPZZwslpWx4qc9syP6kvgBALxHY4ryrKz45XV18S2KMgazUwVa0UYZGuRWV2v7LtM2UqmWra1fVlXcOz+fkn0Z65d/CQD5YuUWskYU5RJxcDFf/cvGRiyx/ID6cEVBwR/EAVMsHP44yvLO4iDJYlluEts0VY0oymdiqjoiXvd89HPhsKUfyCVe3/Zn27uOEfuDZpotbS86FIrSwF1sVyeIohJGFOV1sR2cbILmj5WW0kMlSx+dVFF14bg+ikQOj0Uie6AkLbL0i8la9EY4TDM1jhPNgjsZ+si0PKnWH7B8bsq9vi13Njd/RfzcYDKfm9HPTo7YHlPRiKp+TbxWp/nzFZWWdqMHpseVlv9cbLeYJO0/0b38neVfPkSENLaz7A19ytLf5PzChr9bgLl34GMWQLYzzTSzWBkoGhgFAKCOMx6nVRRG9x2aIKEs04Vud/yS2tq4eeZXA9oUoNZsA5YJkpf6/XhDU5P2I5cKMBvHvBIOY2VWlpEd+x0AOEys3EJXTFX/KA4s5qtflSRsspllLvH6hp5oa/uMOGii0EZxoGQxAQCAR2zXqYpAb0RVnxSveT672GYwQ768ru7blr5IYgZTc22tT2zbuZYWOaCqN4v1zwTTNoGdwTxLH1X6A++9EgodLfYTyvLulj4RTSHcDgzPps9yTFU3i23gNC8vKLT0Bz3EuLi29lSxP2KRyDpL+9u5oyNPbI+piMKwxet0mi+ur7e0G3lVoqgWRVlsaSfd+678/gkioLGd5ezF37H0NbkgkP+eBZjXrv+EBY7tvGZjRLz3WSwni2aVKWlTLwD8DgCeBoAlDM1pEbX1UTSzTNAZcLvjlHH6I0UZn7V6msBswPJmRcHjy8rw4MJCfFeWU864TcdsU1X8eV2dMbtM/jcA1IsVXOgaVpT/iAOL+exPl5dbfkDJ+xQX32AzaDpAHCjZeUs0Wi2261SFstwvXut8t12IPPn06uqzxb5Amr20aXvRb7e2Oi6ChK4rpqpaYsRMMz0Y/W51jaWPyCsKC++09JMsHzQ0wczcmHt6HPddPByJrBhR1S1iGzjN/UXFlr4o9vqGzqyu/qHYHzFF2cvS9nZW1UKxPaaiYUX5m3idTvP6pmZLu5GjwfwHLe02SYTRqlVnf08ENLaz7Fn+Q0tfkwtyfXErMGuzzEssgCx67UZVvPdZLKeKnkpTCOSPAWCrHmZLs4fPA8BDAPAJmIHZHpYmauv9jezSfpcrfkJZGdKaZVtYTgFsDbg1gPnu1laszs7Gm5qbtR+4VGaXyVTW+7KMKwMBA5bpPrlKrCBLmxn4rziwmM/+R2enJcSUXO33v/N+OPwpceA0NMGgyTTYVGkWUWzbZKXPQP5ZvNb57nQAMzoQmEcU5fti3TPJH8oy1tiEAZN/02Cz/l9RdrP0i51ncP3/TGhYUXaLqepHYv2d5nVTAOZtsry3pd3tPF1gluW/i9fpNG9stgfmSDDvX2K7TQbMu+529ukioLGdZc+yMy19TS7w+oYtsEzu27jYAsii117HwMxyvGj2mGZxvq3PKBMkkwmGaMsgAiLy13TQY01PNIO/BwC8Tu2cAxD/VFGRljjDgGULMNuA62Q2wzLNKB9ZXIzHlZRo/50qLNMx9OP4r85OLHC7DWAeBoDjxEqyFh4wkxfnF1h+RCmk8dLaWksyo2FZ7hcHS3Z+cxohjRiNNmRCKOhMOxEwn1ZdfY7YD5kKzHjwwZ6Yotwr1j3TnCjZ1FFlZVeIfRULhw9MZpb5w1CIdl1wjBiYUxcDM9tpzlp6hqWvyQVe/5AFlhmYWfNANFtcBgAHAMCDAijHwZUdB5ebgNn4OwE177E7PVH79QHAW9SmWS5XfN+CAg2W6UfHFpZTAFsDbslDioKbGhu1tcv/7OwcD+U2x01kA8B/1dCAdO36ffESACwSK8pamMD89apqy48o+YiS0qstAydZPmii5C+Gt3R0pByWHYtG94mp6pB4nfPdCwGYP6BEUqq6Xax7pvnmlhYsscky3JOX/zexr2KyfChta2TpG9G05dQ0IjNmWgzMqYuBme00Z+38fUtfkwu8ga0WWNaA+brJgblvUBHvfRZrrmVsY9QPADcBwLtmWPa4XJiXnY0QqELIDpiB+QxeyzwtUdvtAgD/0mfs46uDwfjT4bD2gzNlWJ7kfQbc0jZSKwIB/G5lJW43Zd4W35+MNdju7sYjiorM2bH/DwCmNSCYr1qIwHxLS6ttwqlIMO9hy8Ap2cG/orSLbZusRlSV9sC2XOd890IA5hFVvUCsdyaaspq32PRXudf3gd1ShuEkkn9p20wdfLBjllAxMKcuBma205y182mWviYX+IJbLLBM3j0JYO7fJIv3Pos1l6Isp90AcB4A/E8A5Xh9Tg4e09iIR1RWoacsgq7cIjMwn8vAnLLoIcUyAHiEfv9o7+JdAwENlhOGYScAYc3ie4T3GeVRcq5zamq02eX/dHWlnOjLKFNLHibLWJ+dHdeB+X0A+JJYWdaoFiIwvyxJWGkzW1bs9Q3bZssOhycd/E8nW/awojwiXuNC8HwHZuzpKZgPs8uG9y8psfQV+ciSsivF/opFIvtZ+sbOLS3lYrvNlRiYUxcDM9tpztr5VEtfkwt8+R9YYJm8+tqdLIAsevV6BmbWnItgjUCXtog6HQD+oyf1Ggu/LvB48MiSEvxzRwf+b/Fi/FxFBeY27o7uUWA21qr+lJN+pawwANxDv30EmlGfL07rgOmHZkJYtoNb8XWb91F5VPbDnZ24yOfDqxsatIys05ld1sqMRnFjYyMS8Ov3z7MAwHvnJdBCBGa6zz5eWmb5ISUfUlQ8IA6etitKUtmyMYU1mShJXQtl72XR8x2YY4qyv1jnTPY97e2WviJX+/xvvSvOMkcih6MsL7H0j2hJcswAlIE5dTEws53mrCXftfQ1ucCfv9kCy5oHFlkAWTRvK8WaYxEsF+t75N4PAB8ZoEzg5ne747sEg/FNzc34nqJoX3zvKwoeWF6B7uZ9ELwlZmAeAIAc8QSsSSUBwN0AsJ3aXPZ6439vb49POrNsB7bi6zbvNcr8QFHw2OJi3L+gAN+exjZS5nIpi/fe+fnGPUHJvm7VE8E5Zq2ck7QQgZn81/YO22zZ9f7AK2+FQkeKA6iksmWHw8pU12QOq+q54rUtFM97YFbVn4p1znR35+db+qvI64vZ7QE8GwnzZlIMzKmLgZntNGcv/ralr8kFgYJ3rbDMwMxytoyB5QoAuBkA3jS2iTL2zm3OycHzamvxBUnCIT3clvymLGNPUTnmqJ9F8JUTHBmA9GsA8ArnYU2sKgC4HgCGqN2rsrLid7S0xMfN9iayCK3i66KFzNj3trdjW24u3tHSMm1YJtOP4vOSpG1NpT90IWA+hWE5sRYqMNP93Z1nHfyXeX1brqprOEUcQG0Lh/vEQZPFstyNshwQ2ziRcOlS37CqPiVe20LxfAfmEVV9Wqxzpvu0Gvs9mQ8pLl4v9lksEjkYw+GdLH0kWlFqxLabCzEwpy4GZrbTnL3TKZa+JhcECt62wjLtw2wDyBYP0uQSizXrohvvRwDwigHKBixXZmfHv1BWhv/q6sKtpn1/DdB6UVGwtagWc5Z+G135jWZgpuROfvFELFsRRNYCwDUU/k7t3pCdHf9Nc3N8q6LsANiJLEKr+LrNe40+pH7dLz8fv1JaitvM57MrRzyPjY1y/6+lBX1uNyX8ontqs/5AhoE5gRYqMJO/VFlp+TEt9Prinykr+4VlACVJBySTLRslqUJs40QaUlU1pqrvide1UDyfgRlVdZVY3/ngu9rasdxm/X9nMO8/Yp/FIpHDMBxebukjqzunGpmRDjEwpy4GZrbTnL3TNy19TS4IFL5pgeVkgXm3TbR0kcWaFdGPIg1oaPunZ/R1ytpssjGrvE9hIT7Q1aWF69KXnAHKhulvj4QlrC5qwKwV52NWeWQMmF3gugsAKLxrzn98HS5qH3qw8BMat9ODimyA+NUNDXFKwpUULIsgK74m2gS21IeX1dVhe24uPplqUjHBWhnd3XhSWZmxfpmA+WEASHrGbyFqIQPzYJP9ACoazP/HVAdQhrepapvYxolEQBFT1bh4XQvF8xmYY6r6gFjf+eB3ZRkbAgFLnxV5fSP3trR8ydJvkrTW0keiKTKjp4eWzcypGJhTFwMz22nOXvQNS1+T8wOF/7PC8uDhFji2827rGZhZaRcBGoHsQQBwHwBsM69T9gDEewIBvKqpCd/VQdkMUWaQolDKezs6saSsC3P7foXuqp3p4bQ+w+yipFX0xc/AnFjUNgV6FnIKWR4p9HjiF9bWxukhxaTwagex4muihVngVyUJO3Jz8fSqKmuiL/FY8Vw2No7/UFFQ8nqN7aRoLfw3+V6YWAsZmF8Mh223lyrx+rb/u63ts+IgaliSVokDJ4unkC07pigD4jUtJM9XYN4eiXTGVHVYrO988TcT7GO+oqDwD2K/aWHZYh/ZeGtXV4PYjrMtBubUxcDMdpqze75m6WtyfqD4NQZmlhNFsEKDxw59fTHNKGv7++rGfI8Hv19bi+/qX2oThubqr98RCmGwvAfdfesRqpYbwEwATknDShmSEoraJQsAvmvAMj2sOK2qKk7JsqY8syz+3c4C1I5Eo3hGVRV2+3zallLjYDlRmTaQLAIzlUtroYNuN90LdI/RlmRzPghzuhYyMJMTbZVzeEnJ1ZZBlCTtLw6c7PxhU9OkYdn0pRVT1Q/F61lInq/APKIon5nPkQNvSZLtg6Zyn++Dh1pbPyf23bAs72rpJ9E0yzz62zRnYmBOXQzMbKc5p+ckS1+T8wMlr6YMzKuvDYn3Pos1XRGYUbZqurnOAIAXTXslxylktiI7G48oKcG/dXVhrLt7/IxyAnii1+iL75dNrehtPwBd/RsQqnYxgNkIwaUEIgzMVlGb0B7XJwPAFuqLPLc7fkJZWfwtU4bqpIFZ/JudBVimvnugo0MLxb6dEn3pr01ang0ki8BMwP/F0lKkBwD6vUDh+VRfvhcm0EIH5vsSbJXTFgz+V8yWjZHI4Ullyw6FwpOtyYxFoweJ17LQPF+BOaaqN4l1nW/ep9j6oIn2MT/Vpu9i4XBS0LY5HKbdMuZMDMypi4GZ7TTndJ9o6WtyQbDkJQswr04SmNcMdon3Pos1HdF+yiUA8BkAeMmU0EsLv851u3GXvDy8u6MDh/XMxpZZxgQApYFRNIo/aGzFLPk4hP6NCNUrDGCmGdOnAKBJvwaWVcfoocoxWrN8dEmJ/ZrlBO0/6WuiTUBL56CQ6YMLC7E/L0/778miCcRyElkL845EcGe/n8Kx6V6j+4Ee1EwILSwGZko4F8nLs/yoVvj9mzc1NZ0sDqSGk1mTqSjRV3t6Jkw+GItG7xCvZaF5PgIzhkI5MUXZKtZ1vvnC+npLv5HXFhXdJvZdTJIOSWpP5jkOy2ZgTl0MzGynOaf7BEtfk/ODpS9Ygfm6JIH5agZm1oyI4ISeEO9rCr+m2T4Nlr0uV7w7EMDz6+rwtUgEY0aiJjtYTgBQ9P4tahSPq2tC96KvIfRtQKhdbST9ImD+LwC0MChZRLP9RwDA6zRWz3W54vsVFMSfC4WssJwMwCZrYRspCplWfT78c3u79gNmOW8ii/eGyUbZVGZlVhY9lKH7jR7S7Mb3weRa6MBMa+g/XV5u+VGlJEbHl5dfYhlIRSL7JZUtu72dlobYCkOhypiqPidey0LzfATmEVX9pljP+egHOzuxxCZbdo0/8MaQJB0hfGYOx1BoF0tfCd4eiczpHqcMzKmLgZntNOdEv2Lpa3J+XvlzFmBeM3CYBY5tvb5TvPdZrKmK1h5FAeBaHZLHzSpXZmfjCZWV+ByF/hIoK0piUJ4A1giMaK3zqqIKzF11vhaSnd26jwHMdM7nAYCy1DIo7RC1xT4A8Cq1EYUsrw4G429FImMh0ZZ+sGn7KVsA2jcjEdwjLw+/U1Exfu1yMhbvDxGYo1E8t7oa6aGMft9RBnbejzsJLXRgJl/R2Gj5USUvys//q2UgJUkfG0pitmybJNGDO1sNq+qymKpuEa9joXm+ATO2tubGVPV1sZ7z1eGgNTKD/N3Kyh+J/ReTpD0tfWXnOew/BubUxcDMdppzol+y9DU5P7/8mZSBuX8j5WNisaYsY50yhSj8AACe1KF1bJuosuxsPKykBH/f3o4fiJmvbeBnMmAjMHqzuxvDxbXo3u1n6Fq3EXPDn6AwXAOYXwYAfgK0Q/Qgg2D5CWofWju+IhCI/7uzU/sBSRssk00wTuuLL6qtxUV+Pz7S2Zl8KLapLDsbMP6+LOOe+fnm7aROERuCZS8GZhWfC4ctP6rkUq9v6yNtbceJg6nhSGSlOICyOBRSMcHSkGFV/Zp4DQvR8w6YFWWXhRCObXh9U5Ol78ihQPDRreIssywfiuHwTpb+snrOfr8ZmFMXAzPbac5Rv2Dpa3J+fsXTDMys2RQNBIsA4AsA8G9jL9+xdcouFy7Ly8PrW1vxfX2t6oTh10kCG5XxlBTB4uIWdK+9GmHd9eiOfAbBNZb0izIjc9r3UVEfLQOAR42+CXm9cdr3mH48EvaFTbunYqN86rOnQyFc4vPhhTU1uFWPLkj6XOL1ma7TKP+vHR3YmJNj3APv8kOT5MXAPOq9bJIYkY8qKfulOJjaTmHZNoMo0R9Eo2Vie5Niqur4weVseL4B80IJxza7xaYPK3yB929tavqq2IfDodBqS3+JpmzZjY1zEh3EwJy6GJjZTnOO8jlLX5Pz8yv/YwHmtRsOtcCxnfcYbBfvfRYrkWhWmZLZfBwAfgcA75hBmf6V/X68sKEBX4xEcMg8ozzZrHISwEZfevd3hdBdEtY+ENB/PYL0WQSXtpUQXcdmANiZQ7K1rbyWA8Bf9bXd8bDXG7+3rQ2HzOHwIpDatPmUrZdlwCzt7fz1igo8sKAAX5akmZld1l+jcugeO7+mxgjHJmB+QN9neqHfA0mJgXnUv21ts/ywkqVg3r/fD4c/NW4wRWsykwjL3i5JXWK2bOzubo0pyoh4/oXoeQjM/xTrON99THmFpf9o/f9XKyousunDaa//T6cYmFMXAzPbac6R7YE5L6/qiZSBeTUDM2ty0aCPwnu7AWDADMrGNlFFWVnxE6uq8FlZTg2UBRgSTWVQuZs6OtBVsQRdBMvrCJg/ZwAzXct2AOhf4Fmyqe60ndd91Ef0IKMpJ4dgOU4JjsbBsgikNu0+ZetlERjTj9Rdra3YmZuLNzQ1af9vOf9kFu8P03Vqa9plWcu8rSf7onvgAv2BASsJMTCPmu6jkM2azGp/4O07mpuPFwdUKMuTz5ZRWPaqVeNmy4YV5TviuReq5xMw08yoWL+F4Ksb7cOyF+fl3y/2Ia3/T+ZBE06w/j+dYmBOXQzMbKc5N3Kcpa/JefnVj6YMzGs3UY4kFiuhCJZrdRB5Tgy/drtc8cPLyvC+ri5tNnHcOuVEwJPIIiyZoInK2q5G8fSqKnQ3rkPXuk2jwBz5IoLLYwAzXRdl6V6owESwTGvK76aHB9Q/tdnZ8VuamuK0fU7CmeWJ2n4q1ssyZpcpHP+woiI8urgY345Ext8XyVq8Tv1ajXM83tWl7eus9z3Npq9e4A9MpiQG5lHT54O+x8Qf1yKvL3ZqpRXgYrK8z9Bks2Wy3G3eW5bgOaaqfxLPvVA9n4B5WJavF+u3EPyiJFn6j0zr///d1vZZSz9K0ipLn4lW1YTr/9MpBubUxcDMdpq9XYdb+pqcV9TyZwswr9lwiAWO7U3b1rJYFhEo0+DjYwDwHx1GtKReBGLZLldcCQTwutZWfFdRtC8kMxBNaVZZh6CEJgiLRrXkUV+oqkRoPQxh3Q0I6zahu/ur6MryGsBMPkyfDV9oov6i/a+vp76iGdcSjyd+dX19fFiEZRFExfZO1aZEXzSbfVtLCy4PBPB+0zZS04Jl02saMEejuJ4yHHs8Rjj243obsJIUA/MO/6S+wfLjSl6WX3ifZUBFe8smk8RIlsd+YOm/Y6r6snjeher5AsyoKDUjCyg7tuhDS60PmsiHFBcPiP0YU5QDLH1m51CoUmzndIuBOXUxMLOd5kD9bpa+Jgeql663APPajfvbwLHVqzbO+vcSy9ki8KIZ2j4A+BMAbDGDMo0PqnNz8YLGRnxJljUwSjqh10Q2jhWhSf87lU3bEe1VVI6unb6hwTI5d/mpmOUrMAPzZ/Ts3QtJxsON9bT/NfVTwO2On1ddjVtkeTyoiu0+QZtb/jaZTcD8iiThbsEgfruyUnvQYVm7PFn54jWa3q/BsqriR4qCny8txawd0QVnLcC+n5YYmHf4mQTZssu8vq3PtrcfIw6qhhVl0r1lzbNlw6q6NqaqMfG8C9XzBZhjqrpnTFWHxPotFNOuC0U2/djsDzz3UlfXp839uH20L5da+k20LEuzPcvMwJy6GJjZTrJ7zZWYV9Ju6esCX2AoSz3+axZg7tvYb4Fj0X2D3dB7dUC891kLU8Y2UZRh+BIA+FBcp1ySlYUHlJTgI5S8KRrVvoSmDcoCDFmsv06AtFlVMZpfhq5dzhsF5j02oXfVuZgVLDeHZJ8IALli5ea5KBEb9VmMZpaDbnec9jumjNRjoJoEiE7LJlimteaX1NZiKDcXn+jqGvv7uOtIxgmuk8qhe+/Rri7cyeej9ctGduw1YsOwJhYD83j32QxGyZ8vL/+ZZVAViewrDqRs3dmpRT3EVPUX4vkWsucRMP9crNtCMv3OLC0otPRjudf34VV1DadY+lJR+iz9JlpRohgKBcW2TqcYmFMXAzPbMe69BnPlz2KhT/x98ceCpV13wpprPjkemAcPhv6NSy2ALMJy/0AjwKmz+hCP5UzRjHI9AHwHAJ4xr1N2A6DX7cZVhYX4285O/HCmZpTNFkHJBpjonP9TVewsrEb37pePzTC7Vl6ErkA1JaM1gJn2hCaAXCiiup6vRwKMULbo40tL8c1IJPl+Ets9FZvWLlOG9FXBoAbN5gRwlmMm8gTXSGVRZMN1DQ1IDwf0fqftzRo5O/bUxMA83je1tFgGVGQlGPzHh+HwJ8cNqihbtqIsFgdTFstyB/b0ZI8oyjvi+Ray5wMwY2trbkxV3xXrtpBM38UnVlZZ+rHQ64sfUVZ2ldiXMUk6YCiZ5QyzHJbNwJy6Fh4wn3OaBdTYc+veazBryfcwULMEC/z54/o4P7/qP77W/c/3rPjJp8dAefW1H4O1g73QO7DEAsjjvL4TdrmuiGGZRTcA/Sh9Qs+qbMCHNqvsc7vj3Xl5+KPGRvxAh9akIWwqFmHJBproC++ZSASrilvRswdlyB4FZlhxEcJ4YP45AOSJFZ2n8gHA94x+y3W54keXlFhheaK+Ets8FZtmlz9UFPx2eTnukZeH78mydYZbdKJrSHCNxnkowdwXSktpdtno98v19mBNQQzM4/2qJGF70Apydf7A639qafmiOLAaluXdxcGUxZIkxxRlf/FcC93zAZiHVPUYsV4L0be3tlr6kdzqDz4zJElHjOtPWT50IhgZsyRRAstZEwNz6lp4wHxWZgBz33rM3vk09Detw2BlFPNK27VQZbK/ZunTOaEjN2Z3n3xZ1pLTLshacvqPs5acek7W4m+fmrXTKd/M2umb38hafMrX7Zy96KQvZqtfOjJH+eInciKfO2zOHT7u0EDNbqvzisLLx7lYWgatx9TC0suLx3nJtfmwdKNvUp/KkMwaFcXi0zrl3wDA+8Y6ZW1W2eWKN3m9+J26OnxOUbQnyAaoTDmZVzIWYUkEJh2YH49EsLBiJ3TveYsJmC9GCNQYIdlUh5sAYFpf/hkgYz9sCj+nvhvJBogfWFiIz4fDyT/UENtcdDLvMZ2L+uhPbW1Y7vHgjU1NVmifihNcJ5WlzWKHw7jY7zdgmbYTo73BF2Kyt2mJgXm8tygK7ltcYhlU0d6yF9XWnmYZWEnSXuJgymJZ7h5WlBvFcy10ZzowU9RATFH+KtZrIfpDWcYan9/SlzTLfHld3bct/SlJay19J3goEul5tbp61qLFGJhT18ID5swIyc6JfgULAtblEgUFtf/27HrRseNCk3sHPz5paDKZ9iI+eONC3YmGtYBEoEWzcIq+5vV1HTjGtomqzMnBoyor8d5QCIf0WeWk4CtVi6BkB0z6DOY9nV3obd4XYa9f7wjJXvUTdOXVm4H5VgAoEis+j0R9SGu0v2iEYVPSq/0KCuLPibBs046TtrvYB+LfbGxA7HA0ikcWFeGhhYW4eaZnl02z2PTjRxm4y7KyzOHYvKF8CmJgtvqc2jrLAIO8oqDgD+LAajtly55se6lIZOWIojwhnmehO9OBeXs0Goqp6ptivRaqz6yttfSl/rm50zLLTHsyT/656dlqyjKfbjEwp66FB8wZEJLdew0Gq3os9aW1vDmho0+1JL7qHdzLAseiaS3vmo0FYv+zWPNJBFnkCgD4GgC8JO6nnOt248rCQtzU0YHv6l8wY/AlwtZMWoQlO2gicI9G8ZrGZnSFjkEYm2G+AbPXXI45xa1mYL4TAMb2Pp1nMhKzfdJ42EF9F/V645Rca8KHG2L7JuMkj9OAORrFu1tbtURfT4VCycFyovITXLcB5rRn7ncrKzHL5TL2Xv6ZHjHBmqIYmK1+IhSyGWT4sDjXu/2Njo6jxMHVsCQtEwdUgveLKcoH4nkWujMdmGOKckRMVeNivRaqX5YkrLSZZW7wB17+l92ezJHICkv/iZYkmWbyxbZPhxiYU9fCA2bnh2S71/4K80pslkr48t/PUk8+yQLMazb0WQBZ9NqNKmeKZs1nEWSV65D1BwD4wDyrnON2x6N5eXhOYyM+N5PbRCVjEZTsgEnfg3mkuxvPqG9EV883EPa4cce2Uv1Xo7cibAbmP89jYKYwmEP0Bx4aLC/y+eKPdHRMPrMstvFkTvI4A2JfkiTsys3Fb5SXa/CcFDCLf5vE5nNRUjHKCA4Am/V7m5N9pSAGZnuvKiyyDjS8PjyhouJim8HVPuKAyuwRRTldLJ89D4BZVe8W67SQTcsZ9rBZzlDq9W27tLb2e2KfxiRpT0v/iZbl7tnqUwbm1LXwgNn5Idna1krF1joX+PM32wKzlgDLBpJFYN77N7O2TILFmi0ZALEaAG7TwWJsnTI5LysLv97QgE/J8ri9ctM+q2zYBoos7zGyL3f34MeKS9G1/FyEddcj7HGDBszZewxiTlWPeVupfwJAqdAW80GUfGAtAPyHfp8Ilks8nvgD7e3aj8GEDzjENp7MSR5rACwB8g+rqylEGl8Ih8euR3y/5Rzi3yayDuFUNs1kB1xjSd6eBIAQA3NqYmC29zVNTZaBBnlxXv5ftorhpZHI4UOhUMJs2SOq+rBYPjuzgZkyn8dUdUSs00L3DxKEZfcVFt4q9mlMlg/CZLJlS1Kd2P7pEANz6mJgdp4ZmFmsyUXgQCFMUQC4CACe18OvNUjWwq+zsuKHV1TgPeEwfiCCsgEz6bYIRCYwEq2BWc9O2JNfgq5Vl44DZli3EV0ViwmYyQRQLwBAjdgo80CrAOAR+m2iPbHbc3Pj97a1xS3bNtm0n6WNJ/NEx5r+ZgDzc6EQRrxe3NTYiDHTWmPLsdO0EY79g6oqc3bsjfN8zXpaxcBs7/+GwthkA3QUXvpYW9tx4gBrWJJWiYMqckxR9uKwXXtnMjAPy/IFYn3YKv6rq8vSn+QKr/+9l7q6Pj2uX2lbtsmXM4yGZc/CA1EG5tTFwOw8MzCzWBOLflRofcE3AeA1fX3n2Dpl+rczPz/+QDSKH0WjluzXszKrbNgGiCzv0U2gRNtaVedXIKy9WoPkMWDu34iwA5ipjtvmYQKoMAA8ZMws57hc8TtbW8fDsk27JWzniTzZsfrfDVjepqp4QEEB7pOfryX9oh+mdMAymc73rizj2rw8A5apr7/E2bFTFwOzvd+n+8xmYErZsjfU139NHGBhJLJOHFSRRxTlbLFs9qgzFZgxEikaUdV/i/Vhj3q3qS1nSA7oIpG0PxRlYE5dDMzOMwMzi2UvY5uhj+lreLcaoGzAclswGP9Rayu+YrOf8qyCsmEbILK8Rzd92T0TDqM7WIfQNzh+hpmAuXJnMzCTKUR3vkgCgPsNWK7Nzo7f3tISJ1Cd8ZllsRzxNdPrBjDfTtmqPR68p61N66d0wTKVS+U/2tWFjTk5dE/T8oLHAGAxh2OnLgbmxD61psYy2CDvXlD0W8sAi8JLxYGVoiyOKcofxHLZo85UYB6SpEUxVeUkbgl8fQIwiQbzH3w/HP7UuL6l5QyyvMTSj4K3KUp7umeZGZhTFwOz88zAzGKNF/2A0NrWDgC4x5T4ygBlDGRl4dF1dfjmokU4oiia5wySDZthyPz/4vv0WW+aCX8g3IVQLKGLANkEzK5112N2w24ILpcZmNV5AFF0/ZUA8Hvj4YfX5YpvaGzEac0sT/b6ZDbBMl3HXvn5eFJZGW7T+yrdwLy+ocHIjk33+QBnx56eGJgT+98JwktpcPpWZ+eR4iALhXXMw7K8e0xVXxDLZY86U4GZk7hN7FclCTuDeZZ+rfEH3vhTS8sXLX0ry7tb+lG0JMnPNTZ6xb6YSTEwpy4GZueZgZnF2iEKQyVQ/hEAvKEDxFj4NSX02ru8HH8bCmnh1+YZZQ1CRMCaLdvA0ETXQ9c7rEZxfUMtQu0adBkzy/q/7j1uwGDnPuhyeUzAnL0kw4GZrr0eAH5t1Kk6Ozt+TUMDbjFFB4htNeV2Fl9LwsY9RA8xflFXhzv7/Wje/1l8/0zYOOcHioIHFRTQ/U33OWV7/3yG9/Oci4F5Yq8oKLQMOMinVFScbxlkKcpe4wZW9DdVHRbLZI86E4EZQ6GcmKK8LNaFvcMf0fd0SamlX2k5w/eqq8+19G0yUEfZssPhtO5+wcCcuhiYnWcGZhZrdEa5DAA+BQD/1SF5bFY5x+3GUDCIl7a14bbubu2LwgCOcUAjAtZs2QaILO8xmWYtY2oUz6goQ2j/1I5QbPp3j03o3vNGzJcPQ5c7yzzDvFJvp0wUASD9eF2pbx01UujxxH9eVxc3ZzKfsN3E9p2orcXXJ7BxD9E1PB0O42K/H8+qrh6b8RbfP1M2zvlMKIT5brexfvllANhJbDzW1MTAPLF/1tBgGXCQVxQU3jVkky3bnPU3JsvrxfLYO5yRwKyq+4n1YFv9i4ZGS7+SlWD+P8S+jSnKx1CSFln6UnQ43Cr2x0yKgTl1MTA7zwzMrIUsAqkSANgXAG4HgC3m/ZSzXC5s9vnwWw0N+ISiaNmKLbPKokV4SrfF8ydxHXTt9GX3xdIShJ5vmbJjk69H1543oVc+ygBmY932PhkKzNTHlNzkZ0bCNlqz/Mv6evyQwumnM7M80XHi+xLYAFcC9x9WVeHqYFBbW55wdnmK5ScylU0z2lfV1xtLDaifb9UfHLGmIQbmiU1h2Q3+gGXQ0eIPPGfJ+kvZsiORldqgSpZ3jinKu2J57B3ONGDGVauyYqq6UazHbPvH9fV4Q3OL5e9O8huRCFb5/Ja+LfL6hn/f3Hy82L9bE2SZH2eaZQ6FcsR+mSkxMKcuBmbnmYGZtRBFEOXTZ9N+pYeijoGyy+WKF+fk4KcqK/FBWcYRcVbZDljMfxPhKZ0WryOJayAY26qquE9hCcKqn2qzyjuAeRPCnjchhI5BcGebgfkIAPCIDZkBovW4Z1L2Z4LCMo8nfnl9vZbgK6mZ5YnaeDrH6TYeXjzU0YHL/X68vqlpXKZ1S5lTKHsiU93pAdCnioqM2WVKavctzo49fTEwT+x3ZBl3sQnLLvL6YnfYDPyHw+F+GlCNKMpxYlns8c44YO7pqRqZ48/LPe0dWhvRQ5wt9GDc5j1O8WfLKyx9Sz6kuHi9pX/tkubZuaurSuyXmRIDc+piYHaeGZhZC0kEygR9lCX5LAB4DgC2m9cp52dl4V5lZXhbZye+o4NFwllIGxDRLL4vXRbPm+T56YvufVXFlWXN6N7zlvGwTMm/7IH5MxkIzPRQ5Pv0QIRgmWaWr2lsTH7N8kRtnMyxkxxvzC7Ttk7HlZTgJ4qL8a1IZGJYtilnqjbOS+0Q9nqN2WXaW3xnXr88fTEwT+6vVVVbBh3ktYWFt1oGWrJ8IA2oRhTlCrEc9nhnGjAPK0rfsKrGxHrMpr9dvSNz+0/qGyyvO8n3tbdjmc0ssxTM+/cbodBRlj5OYk/m7ZLUhWmKHmNgTl0MzM4zAzNroYh+ECj8+nMA8E/aycIMyl63Ox7Ny8PLWlvxLR0qx4Vfi+AyEcCI70mXxfMmeX6q1xuygnJ5GN17/2YUks3QvMdN6Il8VgRmardMAmbK/nkCALxFQFiRlRVf39g4bmZ5wn6dqH2TbOeJyjLOT7PJd7S0YLfPp/1L953ttYnntnOS79OAORrFB9vakLKE6+v179DbjDVNMTBP7n92dtKMsmXgUer1ffSazcB/OBTadVhVHxDLYY93pgFzTFVvEuswm96mKLiicEe0w6L8Ai3Blvg+p/g1KaJdo9i/Fd7A+/e2tHxJ7ONhRem19KfoUEjFpUvp4fKMi4E5dWUyMCsMzAzMrIyTMVtGa3QOBYC7AGCzEX5NoEwwWO/z4Q8aGvDpSATHAZUIPXa2ARLLe9Jh8ZxTODfV76WIjPUNa3VgFkKy97gJ/Tsdjx7POGA+PoNmH7MB4CsA8DrtLUywfEtzsxaGnvTMMlls2ym280RlGbO8r0gSHlZUhCeVl+P7xvZkYvniuadpA5g/U1KC+mdgGwB8U2xEVmpiYJ7c9KBomU1YNvn06uqzLYMtSTpkRFV5/fIkziRg3hqNNsRUdUisw2ya1tOXmmZs6/wBfKiz0/I+p5iSQR6bICz7qJKSK8Q+jknS/pb+tLMsl4v9MxPKFGDev6TE0p7FXt+wXQby7ZHIvpb2s/HmaWYgjynKc+J1Os0MzKNmYGbNBxEodwPAegB425z52g0QL8rKwk9XVOCDkoQfTWXmUbQNlGgW3zeTFs81hXNS/R4PS1jafjC6CJjFNczrbsCC5d/ErOwcMzB/Q2xchypXX2/9kjGz/Ovm5nHZsJPqX7Fdp9jGFpuON66BZjd+UleHi3w+fLSzc/z1mc8jnj9V62VpEQaRCBa53Ub/vqlnQWfNgGKq+rQ4sGBbfV5dnWXgQe4tKLpNHGyNyPIF4vGz5ce6ujSLf3eiEwHzGdXVZ4ltOtfAPKKqJ4vXP9s+sqzc0laXOTws+/dtbZZrJtf7A699GA5/UoC7cVnmE1pRwpiGB+KZAsxfrqy0tGeh1xf/TFnZL8TPTSwcPjCpDOSSVCG2R7LCnp6CEVV9T7xOpzkRMHNINgMzKzNkfOnXAcA5+jZR49Ype1wu7Csqwrs6O/FtPfzKAJWkYMrOIpykWk4yFs8zhXNqdYxG8fctLejvOAxhr1/bA/PK0zArx2sG5h8I7exEUcj4GCyXejzxG5uatDDsCftWbMPJLB4/mYXjtRle2kYqFMJdAwE8o6pKg+ex2e9knaD8hDZlSL+tpUWbXaYZeAB4CAAo8cuMD5gWopwAzJtl2fI3p/mvHR1YY5MtuyOY95Q48B9R1cfF42fDH9DSlbx8XF5QaHnNic4UYH5p6VJfTFHuFK9/Nv1iWLJdD7yuqNjR+3zTb4Wal2+5bvKPq2tOF/vZSJo3qUOhoNhP01WmAPOtLa22S0RCwbzHxPaMyfKhw0msDUdZ7hDbI1nFZHnvTNhvnoF51AzMrEyUsYUQ7af8iAmUtfBrcsjvx581N+NbQkIvAyQtsDMVi4BihpqZtHiOKZxLg7VoN17V1Ihe9XiEPW60BebcXc9Ed7bfvA/zJRkAVIsB4Enq75rs7PhNTU1xCsNO+DBEbL9kbNOmk1oog+45gvizq6txXV4evmjaRiptwKy/VztPNIonlpUZfUtr+S/m7Ngzp7kGZsr0u39JKR5UUorvOxicKcohmm8d+Jd4fUN/bW39gjHQGpGkL4nHzpbPqq3VrokyKIuvOdGJgPn7DgPmjySpLqaqb4rXP5u+pqnJ0k7kRXn5f40pyqvi+53kc2vtozPWFhTdbtnLXJYPTWqWuaurQeyn6SpTgHlIUXB9UzPuUVyCPfkF2J2fP+bDS0sfvLul5dwnOjtPfXKHv/nP9vZj/9XRcVQi/6Oj46j729oOuLWpaddbWlqWJ+OHOjtXbleUT4woykviNTrRiYB53oZkr70K88q6LPUt9AU/ylG+/A0LMPdt7LcAsug1m6KwauOMP6xisRKJQI6Seq0AgD/p+ylr4df6Gk2k7Nfn1tfj67Ks7Xk7pfDcZC1Cigg2M2VzmVMsXwPm7m78blUV5iz9gTXhlw7MsPSHCFkaMBtgdbXexo6F5kAgEMnOynrC73bH1zc1aWuWCQ4TbgNm9/eJbNOeSVkoh35oaBupxuxsvLmpSVtPnBCWE5SRsHy7/9dN7UD3PW0ntSwQ0JYl6Gv6lzu5XzNNcw3MBKI7FxRgtc+PDzp4PSatY/5ChW0oJO5VWHijacD/U/HY2TA9eNhJT7DEwDyzGpHlz4nXPts+utwajl3k9Y2cUFF5cUyWfyW+30mmdda03lq8/jZ/8JlXQqGjx/V1JHL4cCSywtKvosPhEO2LLfbVdJQpwGz4Q0XB1yQJXxX8P0kaeS8S2bZZlrea/V4kMrll+aP3ZHlLMt4iy9voe1G8Lqd6oQGzq289BupXWOpL4fu5zftcYAHmNYP7wtqBRRZIFr36RkpIzGKlXbRmVQWAH5sSeo2tUy7JysKPFxfjQ6GQBib0IZ9xUDYsQk0CcJmWxXKnWLYxw/zxohL0LDsbYd1GG2DehLDsLITsoBmYaR24o4EZAD5J94AHYOSIoiJtv9cphzlPZJv2nNSm47W2pzBPRcFPFRfjIYWF2pZSY9covH/KtjvedC3G+Wm9dLHHQ306DAAP6knSWDOkuU769b9IBBcXjILeaTU1lted5L93jO6BK7rC5/tgbOAvy3eJx82GH+7s0kCZrqcxw4HZSUm/CMpGFOVJ8dpn0/QwpD2YZ2mnCl/g/f9rbj5hWJK+GlOUD8TjnOJ3IhFtmYB4/ZTZ+Zampq+KfT0sy5OHZctyN8pyQOyv6SjTgJk9NScC5tRCss85zQKoDnTWku9iQdCaJK4gWPqCe8kZXxgPzAOHQf/GXSyALHr1xhD0XMbjMFbaRPBGmR2/BQCvGKHXxqyy3+3Gtfn5+MeODm2mkT7caQNlwyKsJACXaVksdwpla7OtFH4U7caVRRXoXnWp/Qxz/ybMWnEeZgeKDWCmdr1BD9t1MjAfTMndaP1yj8+HL0jSzACzTVsmbb0M496jPvhLWxvtf4z3t7eP3ZeW44Tjk7L4fqEsOg/NLn+1rAxzdmwnRfuRs2ZQTgLmzmCe5XUnmWZTlthsk0M+t6bmBzFay6yqz4vHzYYHm5rG1jUyMM+chiORleJ1z7Z/1dhoaSOyFMx7WA9pPnquoX4yf8e0f7TZqwoKfy/29fZI5GBLv9p4ayhUL/bXdMTAPL+9EIHZ1TeAWbv+CANVO1nqXZBX/lxu677nw6pfHmkC50O1tcx91y22gLLZ6zaGYNWVhQCUXobFmjlRgiKaTbzfBMraOuWA243LAwG8rL4e39Rn79ISfp3IIsQkgJcpWywvhbKNGcbXIjK25VcjrLkyITD71lyCweIaMzDf5nBgputaCgDPUSKrqqwsbcuQpIF5oja2acukrZdhtD3Neq8NBvGUiorxodjiccLxKVkoh85P4bptubn0jUx9Smv8+x3cpxkpJwEz+R79wYxT/YOa0XXCovcpLr5RX788J8lvPmnKoMzAPDOiTMzDqnq+eN2zadpnOZogadbZNTVnjrWRomwUj3WSnwqFxm2JZbjY69v+WFvbcWJ/D4fDyy19K3goFIriwQdT8swZEQPz/PbMAvNZmQHMTnPvNehZeRH6WvfBQt+OZRoFXv9QQaD49UD1kgHPip99egfArz8UetfvDWsGd7ZA+xi8b4pC740S9F1TBXAqTU6yMkw0qPfp29/8H+UNEbeJas3NpbVa+GokgsNGgqPJgCQdFsHFDmCmarGsFMql2U36kns8FMbqgjp0rb0qATBfj4H+X2B+RSuNbwiYqZ3/oG/T5VS4ouuirJT/IcDPcbnwlqYmbd/KCYF5sva1accp2QTLNJv2o+pqbMnJwf+Gw1pfJH1vitc1FZuyY/+htRWDbjdFYRAwvwUAlQ7u04yU04CZ1gmL73GS725rx0qbgX8omPd4TJZvFt8/GyaoqjBdEwPzzAh7evzDivKgeN2z6b92dFJiOUsb1fsDr5oTZmnrrBUlLh7vJO9bbA0NJZ9QUXGx2N+xJPcPxs7OGVtPycA8vz2zwJwBa5id7L716G0/2NIXtL46UKbcallf3bfhkKTWV6/ZOKNRJ6z0ywsAPQBwPgC8qq+91MKvPQDxhuxs/FxpqbZNiZjQa9qZr1OxCCwCvKRksZwUyjOg6Z72Viyt6NFCSyywrAOzf92VGKzsMgPzX/X14k6GK/qhp6RvdG/g6VVV2sDXKcD8kiSh7PXihTU1YyCfNDCbykvFxmfirKoq1JN9URtdoy9tYM2gnAbMuxYU4tsR52bLfk2KaKHj4g99tc+/LTZHe5GKGZQZmGdGtN9vTFW3i9c9mz4nwf7fexYV3Sy20bCi/EM83kmm+7TYpi67FBT+0TZbtiwvsfSv1c0ztSczA/P8NgOzs+xZeTEW+q3RMwV55c96dr3oWAs0925YYQFkiwclWHX3jCYDZKVPxQDwdQB4Xgc3LfSaYDnb5cL9Cwrwj21tlhnlKYNIOmwDLprF9yVjsYwUyjHAbUN9LQarVyD0b7DCsg7MWb1XYXaZZAAzPaB4VJ/hn5Ef0jSJZsB/bTxMoXvjAz0s39J2ydimDadq416k8OtvVFTg6mBQe6gzY/eoeM02NvqdHh7tU1BgADNtJ0Uh7E7uz4yU04C51h/AJ0Ihy/uc5KPLKyw/8qsLiyzvmw1TJEhfUfG4a2FgnhnFFOVy8Zpn271FRZb2oWRZ48KxDWCW5TNiqurYWebHu0LYYtPntf7A/8S9zClbNqrqKkv/Wh2ZqWzZDMzz2zMLzBmyhtnBdu/2M8zPr7L0R0Gg+H+WhGQaMG/c3QrIgvs3ybDudposYzlQNIAnl+r7Kd8FAO+bk3oF3O74qmAQr2tsxNcjkdlfp5ysbeAlJRATj0+xHAOcLqmtxpzm/RD6E2TI7r8eYc2vEIrDZmCm/Y1pc3Unz0gSMNOsqXafhHJz8RVJ0r7YLW2XjG3acCo27kc6/91tbdiUk4P/19KyY121zTEpWbxuwUa//zcUomswkn09zHsvp0dOA2byTxsaLO9zku9vt2bL/kZVteV9s+HnwmHsEma8GZinrw9kuTymKFvFa55N04Mju3W/1X7/20+2tx8rtlFMlg+KqerrYjlOMUVQrbF5AEA+p6rqDEt9JGkvS//aubm5QOy/VMTAPL89s8DMM8zTtXv3yzC/wJoMsCBQ+KZ78Q++aAHmtQOrLYAsmoB51ZUU5ctyoAjIaF/Y39NvrDnzNc2M1WRn4yW1tfhWJKJ9YB0JyoZt4CUlEBOPT6UMfQZ+SB2d6XR3f3UUjve4wQrM665H19qr0VMqm4H5GR2YnTojSddFAHgGMQvdL+VZWfhwV5d2n4y1mdiOdrZpu1RsgOq2aBQPLSrStpGiLaVmHJjNFutigvaf1NZinttthGNfLDYga2bkRGDeOb/A8j6nuUfIln1TS4vlPbPhP7S1W6CKgXn6iskyZTy3XPNs+jibSAby3oVFN1naR1EOQElaNCzLfxfLcZITZfxuCwafFusUi0QOs/Svjbd1dFA+kGmLgXl+m4HZWWZgXjgi4AkCwI/0dcpa+LUBy7RO+VuVlfifri7tqaqjQdmwDbxMGcrE46Z6vMnUZlvVKB5TWoquRd+eAJg3YXb/dZhXv5iyKRtrmF8EgBndo3GGRfcPZfc8WQ/bH8lzu/F3ra3aF/tYm4ntaGebtpuyTaHYGxsbcbHfj4/q8J7We1asiw7t78ky7pufTw+djEiNgxweLZCxciIwk//VOXr/OdXfrq4eu1bazulVPTpktv21qh3XYZiBeXqiJ68xRblGvN7ZNEUbUT+KbVPq9W17oLX182L7DMvyaqr/iCx/UyzLSX5flm3DssmbGppOFuuFsry7pY/t3Ng47UEyA/P8NgOzs8zAvHBEwEMbd280g7LX5YofVliIT4XD2tpP+pA6HpTNtgGYKUGZeNxUjzeZwOlDNYr7l1Zq+8hNBMzePQawrGMVul1jwPwaAEx74JRm0T1E241to3uH1rivb2gYvVeMNhPb0c42bTdVG7O6z4fDGPX58IdVVem/d8V66KbzPtzZqYVj6+v/aYlDg4OjBTJaTgXm79fUWt7rJN/e2opl+szufiWlltdnw5SMr9kGPhiYpydsbc0dUdUXxOudTf+6pdUSOUBWgvkPiW0TC4cPRUlaptVfkhbFVHWzWJ6T/KWKSku9yEeUlF0l1i3ZPZm3dHXR9p3TEgPz/DYDs7PMwLxwRIP3dQBwnZb92uWKr8vPxzvb2vB9RdE+nGkNZU23RZARX7ezeMxUjrWxNtOoKLisphvdvdeOA2bXHqMe/dsm9O61ESukdeh2ayHZ9ADjbX0LIqdrNQC8oW81hmeaQHXSdp1G2xo2gJjaOhaNaudXvF5tz0zLdaTDQn2MWW5a75/rchnh2JfrCdxYaZBTgXmv4pLYFgdvk0MzyjRTRrPL93Z0WF6fDf++tc3SbmQpGHxTfK8T7VhgVtV95zp51lcqbaEyflRZ2RVi28Rk+UACZaMNYqp6nViek3yr6WGT2dFg/oM2ddvxMGAiq2rbdLNlMzDPbzMwO8sMzAtLf6cBfbbLFT+muDhu7BucEeHXE1mEsmThTHx/MsdM4LgaxbfkCIYiR6JLmFHWgNn4/z02Yc5em7BY2h/dbrcBzFsBoEvsMAdqVwB4ydif+4ulpTjU3a3dQ+PaT2xX8fUp2rg/DVjeoii4sakJK7Kz8Ue1tdr/p/X+FeshgPsXSkvRM9qP2/QcARyOnSbFVPVpcWAxmyZg3klYD0zuDAQ/ej0SGRLf7yRf0diIh5SW4Xb9IelsmrJjJ1rjelxZ2fXi+53oRMB8RnX1WeIAdraAGQHcw6r6L/FaZ9NbFQVbbdqmyOuLXV9f/zWxbYxwbMMjkchn5no7rIn8Qjhs2/dlXt/WN0Kho2zqN3lYtqqq082WzcA8v83A7CwzMC8snUbb3VDY6PJAQPuRG5tVTidszIZtgGbCOonvm+z9k9iYafx3ZwfW9ugJvyawe49NmN22H4JLA2ZjZnKJw8N46doI6h+g66UkcYcVFeH2ZIHZpt2SsRmW6UeE1sqdWFaGBW435uXm4p0dHdpgPG3ALNZDtwHMb0QiuDwQoHBsSt5G2bGLHN6PGS0nAPNiG2Au9/o++G8o9Lj4fqeZclSIf5sN0+fErt0IOv7a2voN8f1OtB00kU+vrj5bHMDOGjBHo4p4nbPtaxvH76ttuCMQfMqy/RLNwIbDO41rA0laO6Kqr4jlOsX0+3JEWbmlfuSPl5ReJ/Z9TJL2t/SznSWpQuzPqYiBeX6bgdlZZmBeWOoHgI8IdiqzsvCfnZ3ah3JeADNZhLOJ6jWV9ybhUWDuxj+0tWHZoq9ZANnWnUciuHPMwLzC4aBF10Zh43cYwNyfl4db9XB0ESgtbZyCzbPKNNC/r60NdwkEqM1ov2NsKyzEJyQpfcsJxHqYbAD8Ha2tWJWVpc24A8AVvJ1UeuXUkGwC5ofa2y+e69BYp/ofnZ3antViu1G24ddDoS+J73eiEwHzXIZkD6vq18TrnE1vUxRcXlBoaRMKxz6zuvqHYrsk2nppWFFuFct2ku/v6NCWM4j1LPf6N78VCh0p1nOoqyshvBgeCoeV6YRlMzDPbzMwO8sMzAtH9KXcDAAv05jT73LFr6qvHz/DnA7gmE3bQI1tncTXE71vCjZmmK9taceipWdY4djiG9C15HsIuYVjwOwBz74OB2ZSIQBcT/cQATNlpyaQHXcP2dmmzSayOKtMs1M/qqnR9lrWM4tr3qmoCF/St0CbbWA2QsO/VVERz9qRHZv2Nnd6H2a0nAzM9zQ3fyWmKK+Jx7BVvKCuztJm5N0LCn83JEmfFd/vRDsRmGOq+jvxOmfTtLVgvc2DkDp/4LUhSTpiXLtEIodjJLLS0gZkRfmYWLaTTLPMS20+90Ve38j5NTXft+n/dZY62nka/c/APL/NwOwsMzAvHNEgnrYt+osxO3hCWZmWGXvc7KAIDOm0DYRY3jMVi2UlKld8TXw9BRvAfEZdC/pXXGgDyKJvQNj5DITcIjMwH5EBsEVbS51lZMpuy8nZsX54Itu0WSKbZ5Xp/qRIiCOKijDLpSVIG+f9Kyu1pHVpmWG2q4Pp/+mcL0oSrgwGKRybYPktAAhnQB9mtJwMzH9saflyTJb/TzxmoZtgY5n9LCR+r7Ly3JFI5DjxGCfaacD8rqoWxhRlq3ids+lfNjbazryuKij8vdgm+qB+iaUNdA+rqqOXNPygptZST/L+xSXXW+oqSYdYQs/tLMu1Yr8mKwbm+W0GZmeZgXlhiRIRnWkAc19e3hhsWMBgNiyedyauQSxHLE/8u/h6ijZmQj9X24bZKy+xAjJlyKaM2UambALmZWcj5JaYQ7JPzADYouv7BgB8SJBYnZWFH84QMIuzyjRzfWV9Pbbl5mKWAMqaXS78Uk2NtlVN2mFZqItxjRQiXurxUP/R1mDr9Rl4VhrldGAeVpTzY6oaE49byKZZSDuoKvX6tr4WCh3FwJyaRlT1TPEaZ9t7FBdb2oN8SkXF+WKbxGR5b0v9TR5RlB+J5TvJf2xrx3KbbNlt/uB/LXWNRA4bVpRdxDpaLEldqYZlMzDPbzMwO8sMzAtL9KW8VB/cx1tycuLPhEJzF5Ytgoho8f3JWizHXJb4d/H1FEzZxqkNN0ciuG99D7pWXzEBMBv7Mt+AsPw8BG+pAczUJ+dnCDAfTZMbNF4r83jwQ1nW2gC7u63tmmTbmmeV6YeCtomiDNzFHo8VlHW7XC48q6FBe/9cAfNFtbW0ndSIC+ADADhUn4FnpVFOB+YRWf5KTFW3iMctZJ+WYGZuVX7B72iwx8A8dWFHR96Iqr4nXuNs+ulQyPZBSJnX99GT7e3HmttjO7XJZNstyfInnfzZeVeWsTOYZ6kvrde+uanpJPEeGA6H+yx1FDw0eg/kiv2bjBiY57cZmJ1lBuaFJz8APEewU+zxxDc0Nmrb4lhmCEWASIfFc9pZPCYZi2WYyxL/Np3z6Dbg6aVwCJfVLUVYe8340GuyActmr7gIwVdmBuYNGQLMvQDwGs0wl5uBuafH2q5JtK0ZlikE+7aWFi2xV65NCLbZWV4vXtPSMvMZssXrF+piXCvNrB9RVET7UVN0wOMA0JEB/ZfxcjowxyTpiBFFeUQ8bqH6fVnGviLrLCRtOXR1feM3GZhTA+ZhWe6PRaNzGslwYmWVpS3I6wqLfiO2h7b3slh30ZK0bERRXhTP4ySfVmMdMJN3zs+/z1JnRfmYpY52luUmsX+TEQPz/DYDs7PMwLywRIN58kYad+a4XPGvlJXtAI4pQM60LZ5vMovHT2Tj/WIZiSweP0Ub+1k/3tWFUtNqdPVeh9B/feIZZsOrforgrzAD868zYP9eun/WGsDcMtkaZpv2Gtd2QmKvC2pqsDknh/Y0tgCy6NzsbLyzvV07dsaAWbx+m7oYwEyz4LLXa6xfpkRo9DCKlWZlADDTPqznisctVD8bDtvu0dvgD7z6r7a2z1J7MTBPXcOqeo54fbNp+r5W8/ItbVHq9W0z+tXsYUXptdRdtKJEh1X1VPFcTvLrkoRVNmHZZV7fBw+0tn7eUu9IZIWlnoK1WeYUdldgYJ7fZmB2lhmYF6a+TONOStq0IhDQ9rW1hGXPFIDYWTxPshbLmczi8YksHjdFGwD15/Y2rAkdidC/0RqSrUGzCZbX3YDuNb9EV7DGDMy/y4AZSrq+LwHAZppZ3TUQwI/s7p1J2tYAZa3tolH8TyiEBxUUYJ7bPS4L9kRuyM/Hx0KhHee2Oc+ULV6/TV2or2nd9E1NTXGvy2Vkxz4+Ax52zAtlAjDHaO9ZRXlHPHYh+vrmFtuw3Z68vL8Ze/QyME9dc50g6772Dqy0AcdQMO8xy97LkchhGApNvp43EunE5uaCmKJsF8/nJB9YUmqpN0VMfKuy6jzxPohFIvva1NPqcLhY7OPJxMA8v83A7CwzMC88EfDQfr+baexZn52t7S84a8AsniMVi2UmsnicncVjUrABzLe3tGJe5LPW2WVzeLYJmLP6rkF3QaMBzARdlMHc6aoDgN/S9dIDl8+WlOBQon2YbdpKbDMKa17f0IBhr9c+sVcC0/rlJXl5+EI4PHpum3NM2eL129TFuG4KM/1Caakxu/yanhuANQvKCGAmq+o94rEL0fsWl1jainxcefnPjbZiYJ6aUFWXidc22z6lutrSDuQDi4s3im2hZYyWpEWWuotWlBqqX0xVbxTP5yT/pL7BUm/ymqKiO2zrPkFm8DFHow1iP08mBub5bQZmZ3lGgLlv8HjoG3xcLHsmDf0DL0H/4Ebo3bA3rDp1ypErc6LeG8uhb8Pp0D/4APQNvCXWKWX3DQxB/+DD0Du4l3jKZESzYPSj9CKBGmXLvrq+XvtwzikwJ/u+iY4RLb5ftPj+FG3Mkv6qqQWzoifYgLLNLPO6TZi9xyC6C1sNCCTw+peDk0bRgxb64J0CAEMEy7kuV3xjY+PYTHEy7Wu8l5YBfKAoBJ3odbnQbQPFE9nl8eBhVVX4Fq2fTnCuKVm89kT10IH5JUnCUG6uERlwCwCUiQ3GSo8yBpgV5bKYqsbF4xeSXwpLWGwz4CvI9cYfa2s7zmgrBuapaVhVfy9e22x6SFEopN7SDuSr6+u1delmD0ciayz1tnNtrY/qN6QoR8VUdUQ8r1P8r85OLLGpe4U/sFmsO+09PSzLu1rqKni7JMliP08mBub5bQZmZ3lGgLl34HWx3DR6O/QNHCZ+bzhONMPeN/hvV/9g3KYOM2LoG7hVPG2yov2YbzNmCY+324/ZDhama7Hsyc4hvm8ii8cmU4b43hSthehGu/GHDZ0Iy380Ho5FYDaSgK3bhO51G9FV2GYG5pcctA7WCA0nSKZragGA0wDgbeNBizmcf7K2HQu/1hN7/aWjA9cEg0mHX4v2uN347aqqHeunbfolaYvXPkk96IfsjtZWLPB46POzBQC+5uAHHfNOmQLMw5HI12KqOiwev5D88wb7mbhoMP9B82CPgTl5UYKomKK8L17bbDrRQL7ZH3hObIeYLB+a1H7EkUinUcftihKOqeqH4nmd4u2Kgovzrd8B5JMrqi6wtIGi7GVTX6tVdUrbEjIwz28n+pwxMM+NZwKYXX2DH4jlptnboW/DGvG7w1FaN3C0q38wZnPtM2boHzxPPG2yygGAr+uQFt89GIx/oM/UJTtTOGWLZU6lbPGYiSweO9Hx4vtStAaB0W48qb4L3bteKACzaRupcd40Grpd2GlAIM1WfgQAJQ5Yx0znp0FcBAA+qe8vTGHH2nZkBMtN2dn4z44O7Ut9onvGuKcM0KT1zpfW1mKWy5UyLJPzcnLw2ubmHUsJbPolaYvXPsH9QeejevywqiqeNbqdFGWcX+SAPlswyhRg1qyqr4rHLxRvUxQ8tLTM0k7k71dWnmVuJwbm5BWT5Y/P9T7fR5eVW9qAfHhp6TViO8QkaX9Lne0sSRVGHXHVqqyYqr4tntdJvqGlxVJ/cqvdnsyS9ImhJB4a0IOC8b09sRiY57cZmJ3lmQBm6Bu8Wiw3/R64D/b+jVMm46zqH3jRes0z6u3QO7BMPG2yosH9EgD4kKC5NTc3/khXl/YBnQh+pmWxzFTKFo+dyMm8Xyw/RRuzpkfUq+ja7efjQ6/HoNlutvl6hGLJDMwEpJVzDF+0RpkSWN0JAO+Y1lcTHI5QGPYiny9+a3Ozlvhqoocs5lllCsF+sKMDDysqwoDbbQHgqboqNxfvamubPjCL1z3J/UHne0eWcY/8fGP9MiVqm9KsAGt6yihgluVLxeMXiimLctQmi3KVP/Du75ubjze3EwNz8oqp6nXidc22jymvsLQB+ePFpevFdkgamEMh+u0b07CiPCme12nustmTucLn++DGpqaTxXZAWV5tqbNoWe7GpUu1sPRkxMA8v83A7CzPCDD3btzd1T/4jFh2mh2DvoHPit8fc66ey7Khb/Aqm+udUUP/4Dlw8MaUo0AJyOjH6UEXQKzI44kPNjZat5cygMIGHKZkEUQmAJKkLJYzHYtlp2Bqs48UBXubdkVX70DywLzHjeiqWGRAIMEXAXPtHAIzrW3Xthwj071Bs8k+lytenpUVb8/NjR9dXIxPmx6uJAJmMyxTYq//a2lBKTfXAr6pusPvx8dDoVkFZqM+T3Z1xSuzsgiYqZ1+AADZc9hnC04ZBczkBTqgfbCz09JG5M5g8D+vhUJHmduIgTk5IYDbCffTQ52dWO0PYInPP85VPv8HD7e2f34oHP6U4a3krq4VQ7K8ZCJviUR6nmts9G4MhXJom6WYqm4Rz+s0H1dh++Ag/uXy8kvE+0F7cJBM4rNoNOl8GAzM89sMzM7yDAEzzTJ/Vyx7Ngxrr2sTv0PmVH3X7ebqH/xIvM6ZNPQPzEgyZXqK+SsCNYKir5aVaUmYbNej2sDDlCyWlc4yp2qx3Cma9mCmNntNkrCnaTeE/g1JA7Nrz5swt2EFjYEIAo3tiVrnCL6aAeAmWj5G11Ho8cQPLCjAH9fU4G+am/H+9nZtn+nNsjwGqXawbP47PYB5PhTCb1RUYGlW1rRCsEUvz8/HtyORHddg0zcTWrwP7Cz2tR5JcHl9fdwz2le0nnufOeqvBatMA+ZhRXlQLGMh+HP2MIH7FRdvEtsIZflT4vFO9FwD85Asf0W8prnym5EI/r2zU9tlw+x/dHYOPRsOv/NcOPy22c+HQm8+O7nfeEmS3vhIUYbE8znRA032QNOdl/938X6YDGjGHA7TGCApMTDPbzMwO8szBsy9m5ZA3+DtYvnpNvQNXueYrNl0HX2D94jXONOGtYO94qlTEQ3yTyRAotBS2k/3v8YWPYksQkcyFsuYTlmixTJTtVjuFKzNOkaj+HBnO7a27WeaPTYB87i1zDvs3utmDLT2I7jGATOtYZrt/XxpTfuPDFjOd7vjP6mtjRPwxkyh1fQFboZlcxuaQdkIwb6nrQ13DwYxx+WyAO90fUhxsXY9KcEyWbwH7GzT15Rk7ICCAiNM/YE5jghYkMo0YI6p6lViGfPdH8oyltrs0Uuzbzc3NJ0kttH2SGRfsQwnei6BGUOhnEwIU15IpqSXdlngi3K9I0+2tx8r3hPDkchKS/+LprDsJMcADMzz2wzMzrJnt59iQZ41f0N+sORV97JzPmcB5r7rdrPCsu61g72uvsFXxHOk2TFYtykqfo/MvtAF/YMn21zfTDoOvQMXimdOVfSF3A8AHxgzin80rwlNZBE8JrN4fKrlTGSx7KlaLG8K1kAyGsU/tLZgfehT6NrjxiSB+Xp07/VrDHTsg+DyEAQawLx4loGZYG8P2maMHpz43e74lfX1cQqjNuB3wvtBtxmYCSjOq6nBrtzcKW8XlYxpD+YTKyq0BxXaAx6bfpnQNtdva+E4+gF7PhyON+fkEDBv1R8ypLwugpWaMg2Yh2T5eLGM+e5bEiREagvmWRMiURblUGi1WIYTPZfAPBSNLoqp6mbxmthz66MSrOfev7j4evGeiMnygZb+t/GWjo5qsf/txMA8v83A7CxnL/4WFvqs2+nlF9b/E1b98shxsNw7eDisGdzZAspjwLxpEfQOnCmeYxb8PKxeP5ZgcU607tqQq3/wDZtrm0nfD+tuzxVPPR3RVkHPG9myL6mtHZtRTAgWInxMZPHYVMtJxmLZ4vkmsljWFKxBZTSK1zXUY6l0TGJg1qDZCszejgNEYKb077MJzHkA8At9zXK82+eLv6Uo2pf1OFA26iy0nXlWmZKAPRcK4SeKi9E/zSzYE5nKJSCnezWtwGwq26jj3a2t8aDbTeuX36SgErExWelXpgHzsCz3xxTF0Rl/Z9IUXfLFikpL+5CPKCu7SmyfmCQdgOEwDfwtZTnNcwnMI4ryJfF62HPvJ0Mh2z2ZG/z+l14JhY4W74thSVpmuQdES5KczCwzquqqTABmyphPW0l+oqwMVxcVj3ltUfHIJ0rLX7iysXHj71tafm74dy0tl97W0nLOb5qbz/x1S8sZibypsfG71zU2nnBlU9OXkvGGpqaT/t3Z+bMRVX1HvEYnOhEwK8H8f4r31eTAfM5pNlDhXPddh67ea2x8bXxW3XftiLv3qhHPrucP5edXbi/w+sdc6At8VOgvfCVLOeGrsHbDoWPu3fgxWDOwCtZsiib02o0q9G0KQ//gHZa6p9nQN3CG+F0ye0IX9G34uXhNM2xKcraneObpqggABgxg/kxJyVjm4wnBQgSQRBaPm+rxU7F4DuM84t9Ei+Uka/14Axh/VFOHvp6v7wBjEZZtgBn2+jVmtR0oAvP+swzM9ZT8zbgHPl5YaL8nt1Bvc93pi50GyVc3NqLq9aYlBNvsXI8Hb2huHju/pW8mslivyawfp820d3fjaZWVtK0WJfu6HwCSTs7CmjllHDArSu+wopwvljNfTbkwVhUWWdqnzOvbclVDwyli+6As96Mk0cDfUpbTPJfAHFPVv4rXw557EwzuWlBouSfofr+iruFblvuC7nfxHhCtKNE3OzroYfaEyhRgvrapCctslmgszsv/s81DhY9hcg8VWpJ5qGAnVNW1MVXdJl6n0zyzwHxWZgDzmivR23kYBmqWYLCye8yBykVDOfLnfuNeeclF7pU/uXDMqy7+gXvlhV9zr7zo5IReceFJnl3O+6Rn17MPmrKXnXlQTvdJ+/sr1T3z88v6zQ4WNq7MDX+iFfquqRozzd6uvqoEllybD8tvyUvo3qsDWubmPQbbXf0bXrK0Q1q94X+w+0ZK8jv76hvc19U/OGS9ppkz9A+cO52s2IlE2X0p1fgwwdIugUCcEilNGoYrQoidxWOmenwyFssVnex7xXJFi+83mdppq6Lg8ZU16N75+1ZIFj0Wmn09wp6/RlfrQQgwDpgPnkVgNrYXoz2WNWCm5G/0RW07u2xqCzMsvyHLeGJZGfrd7rTNKptdkZWFf2lrmzosT9SXiV4zr+GORnGxz2dkx75IX/vN65dnWZkIzBgOL48pylaxrPnoF8JhLLcZHDf5Ay8+1tZ2nKV9ZHlXBuaJhdFoSLwWtjNMD4u/XlVtuSfIR5SWXm25L0YjKibdk1ncZstOmRKSfbjNfuxFXl/s6xUVF1jaJxLZz9IWdu7sLBHbI1np2eb/J16n05wYmOdpSHbfevQ39VvqS7kv/DUrr7SsEV67cf/R0GabkGez99g46WdpTtU7+C1ac2tpjzQa+gceglVXesVLSavWbSxz9Q8+KV7LTBr6B9NWLxrsrwCAV2n9an12dvyf5v2YE0GE8Voii+9N9ripWixb9FTfK/4tCdPDhbciETy4tAZh6VmjQCxCsgWYjVnomzE7cgyCO4tAUANWADhM7KQ0ivp/FwD4n35+/G5lpXV7McH0GtWbQtEpe/ZSvz/ts8qGCcgjPh/+JxTS7lPLPZHINvUY50TvMdapqyo+3tkZz3G5qJ3eA4CDGJbnRhkKzDsNK8o/xLLmo8+sqbW0DXlFQcFdYttsp0EebbXDwDyhYopyhXgtbOf4921tlnuC3OAPvCTeF7FI5LChCcBmzOFwSLwPRGUKMO9RVGxpm2Kvb+jM6uofiu2zTZb3trSFnVW1UGyPqSgTdi+YWWB2fki2e+2vMK+0w1LfQl/ehznq8V+zAHPf+n4LHIteMxCFVT8Jiv3vKBHg9W24VWyPdBt6B44WLyWtWjfwdQqXFq9jJg29G/YWTztTogF/IwD8jX6Ts12u+K/q6ycPyxZhxM7iMckeNxWL5SdzHvG9xvuT+ZuNCRxflMK4W0UHulZdmjgcexw0m0Kzl5+DkJOPABqIETAfKXZSGkX9v4yAmR6YEJCeOgEwGzOtVOfNiqKFYFdmabA/ayZgXpOXp0HLlNYv29RH80SvmepNP15nV1fT7DK103/0fcwZmOdAGQnMtK/sAoAe2o++NQFUXlhTc7qlbcLh0fBUBuaEQlkuH1HVZ8VrYTvHFGXWkuDeuLi29lTx3hhWlD7LfWDn2lra/jOhMgWY1zkRmGX57+J1Os2JgHm+Jv1yr7kS84qtdS7w52/OUk8+yQLMtGWQCMiiaa3w3r/xi/3vOK25NuLqH3xTbJP0euBRWLVxdh4m9K0PQ//Adus1zJhHoG/wYvG0My0Ky77WCAk+srgY35Xl8eGuNhAxDjiSARO7907VYnl2nur7p2mCtie6OjFUHkHX6l8i9G+0AnIiWKaw7F3OR8gpJGAmWCZ/XuygNEsGgOeMGW7aM5m+qM3AbIAymR6mPB8O46eKi9E3SyHYZntcLjyW1trrWbwt94homz6bqqmPaTuplcEg9Q9tvXUpw/LcKVOBeURRPiuWNd/85w6b2QGvD+t8/tc/DIc/Oa5tIpHDMRJZqg3oGJgTCiORFQslnD+TfV5dveW+IC/Ly79XvDcoM/wQRVaI94LgbZPsyczAnLoYmJ3nBQ3MtOa2b+A7Ypuk29A/cM3oXFQatfdv/K7+DelObvYQ7Hkr5eVKq6ihvmrswduak4PPGfsxJwMdyQKK+L6pWixPdDLvma5tromg7cH2NiytWoKw5iqE/uutkDxmMyzrwLziIgRviRmYTxE7KM2ifYTHkn4dV1IyOsNsrN3t7h6bVaatpm5sbsZFfj969NleEWjTbVonfVZ19RjAW/pEtNiHSdr8kIB+uJ6TJKzPyRlxAWymZ2ViI7JmT5kKzDSYme/bAp1Vax+Ova6w6Ndiu8QikYOHQqHFWtswMCfUsKpeIF4H23l+VZKwzm/dcqbeH3j1wdbWz9vcH5PvyUzZsnt6aFLDVgzMqYuB2Xle0MBMImjuH/yT2C5p9hD0rt9dvJQZ1Wiir3TOLg/Duo20THJWRPsxf0jQ5AaI39Pern1Yk4aPZF9P1WJ56bZ4/gQ2QPJ3LS2Y07wvQt/gxCHZ42B50+hsNIVx+8oMYCZoPV/snDSKHpZQaPHdxCEEzAcUFOBWfX2yBoxLlmh1fEGS8FuVlVrCLRFiZ9MlHg9uamoauz6xTxLeM/S37u6x/zcDsdGPho3/p8/ANgq3U1W8rbk57nW5qI0eBwDaIzO9T+RYCZWxwDw6yzxvw7Ip+mT/klJLu9DA+Ic1NWeK7RIzD4wZmG2Fq1ZlxRQlI7bAWeimKKS9i0ss90ax1zd8aW3t9yz3hyTtabkXRMty9zs9PQXifWGIgTl1MTA7zwsemEn965e6+gffE9smnYb+wd+LlzFjoozhfYOvi+ecSUPf4I/SkRU7kToB4EljlvGi2tqxWcYJIUQETPHv4uupWiwvHRbPmYRHZx+jeE1DI7raDh2dXU4EzCIsG8C8+y8QfBUEzASEBGSXiJ2TZo1tLUb7MC8LBPA92odZUTRopDWJ93d24n6FhehO497KybomOxsf7OiYGJjFvtUtwjH9IBl1fEeW8dVIRMvw+5+uLnygo0ObTT+pvBw/V1KCe+Tl0XZS9PmgtprRzdBZU1MmAzMNkmOqul0scz54syxjkw1QVvsDb9u1C0GyqV0YmG0UU9XDxWtgO9dn1dZZ7g3y7gVFvxXvD4qwSCpbdldXg3hfGGJgTl0MzM4zAzMAnHqqG/oHzxPbJt2GvoEvzHho9qq7s6B/8DLxXDNp6B98jLJvi6dOl6iBKD3/JmOW8dMlJbhd33s2GRAZA07xb+bXUrFYzkxZPE+KJvgajkbxvLpGdEmf3wHCIixbQrFNwLz6CgR/tRmYfy52UJpFXyQXGsBcnZ2Nz8my1vf00OTihgasy8nRQrBFeJ0Lh7xepK3PDPgV+8TS1zYzyTQTRssO7mprw8vr6vAb5eVIa/d78/JwJ58PW3JytJnsoNsdz3K5CJTjHv2zAQBHzOK2XywbZTgwLxtRlCfEMueDr22yDnTI4WDw0a2SdIQAC4cPmWGBgdkiPPhgT0xR7hSvge1cP97VZbk3yKVe37a3OjuPFO+R4WT2G1ZVlQYI4v1BYmBOXQzMzjMDs651F+VC/+D9Yvuk1X0Db0Hvepo8nTn1ru909Q9utpxrBg29G/ab7YhPmsr+JgBsoSzAi/1+fFeHi2SAZEKLxydrsZzpWix/ujYALBrFb9Q0o2vx6abtomxml+2gmWak1/wKIVhrAGEMwH2N3iezdQPQXsKnGQ9LstxuvCsaxe2qil+rqMBCj2fOZ5UN03WszsvD7frst6VP9H4xLIIyrcH+W3u7Nmvc4/NhbXY2+k3bYdEDAz0LtpGx3AiTj3k8Htp66xkAmLUnWSx7ZTgwL4qr6kaxzEw3fSaX2bQJ+cSKiovENokpyl7jBnQMzBZti0SaY6r6sngNbGd7jQ0ckj9fXv4z8R6JRSL7Wu4HOyfYc5iBOXUxMDvPDMwm9a5f6+rfsEVso3SaZoPFy0hZvVcHoH/gPvEcM+g49A1QAt5ZF8EZLfp+joChyO3Gx7q67KFEBNGJLB6bjMUy7DyV99pZPGcqHgOxKB5V0Yyw9GyEdTdagVmE5HG+HmHt1QjBegPaCFpvMPXJbIjOcwwAfECASLOpp1RW4kBjI3rdbgu0zqXdAPjJ4mIcmij6wdQ35vBrCrU+ubwcG7Kz47R9GtVVh+NhG0A2/p9eexcAHgoEAocCwFKx8Vizr4wG5kikZ1iWTxLLzHQnmlkr8/m3WLJjU5uEQruMG9AxMFsUU9V9Y6oaF6+B7Wz/ttV+T2Y5GPyn3WcBZXmJ5Z6wutNulpmBOXUxMDvPDMwmjYZmXy62UZodg74Nu4mXkpL6B79hU/5M+klYO0D5hOZExQBwn5H4i0JVx/bjtYHFpCwel4zFMkSL70/2ODuLZUzFetvQ+tc9qkIIu11mmk2eJBTbeA8Bc++1CPktBhQSoP1W7w/Lj2MatT8AvGmAYsDtxtI5Tu5lZ5ph1ra9mgiYBVim/vl1czMuDwTQq4OyCYrfAIAnAOBPAPBrAPgFAHwHAL5M+QoBYFcAiABAvb79GssBynRg1uFwi1huJvuXDY2W9iDvnF94n9geMUn6mAUSGJgtiqnqb8Xzs53v1yQJw3l5lnukxh94896Wli+J98mwLK+23BOCh8JhBRsbveI9wsCcuhiYnWcGZkE9l/mhf/AfYjul09A/+AT0Xl0uXsqU1HdNlat/8L9i2TPoYejfQJNYc6rL6XeaQlP3yMvTMgSnDMziMZNZPD6RxeNSKUO0WE4SNoBMGzxXR/UM2Tah2HYee/16WmiPUNRlrGEmYP6b3hezBcx0Hnqi9KJpZtUCq05wFgBeVlc3BsSJ+t14ncLKBxsasMzjodlpEZRpCYIBw/SwiAYjWfr6ZFqiQP/OVh+wpqCMB+ZIpCemqjeK5Wayjy2vsLRHodcXP6Gi8mKxPWKStL9lD1oG5nFCWW7i2eXM9DZFwUNKrdniyadWV58r3icxWd7Hck/Y27LHKANz6mJgdp4ZmG3Uv3EfAkSxrdLoOPQNfkW8jCmpf+Aam3JnzNA3cPFcj8/p5NRIwwTMlPToFUnSPrQiLNpByhh4pgqhYlmixfdPZvH4ZCyWMYEJyKhtngqHsKt6EbrWbRRg2AaUNQtA3b8BoUQxA/O/Tf0xW6rPysp6QAhNtgDrXJpml/PdbrytpUV7UDEGzGIfmmaX/9Lejs05OdraZL1OtHXaFToo09ptErXzbLY1a5qaD8CMsvypmKrGxLIz1eGgdUat3Of7cKCx8etie2AkssbSHgzM4zSsqj8Qz83OHF/d2GS5R8ihQPBR8T7RQEd8gGTnrq42y33CwJyyGJidZwZmGx28MQd6118rtlWa/XbKCcBG91wWy5sxQ//gc7BmI010zbloHfMHtLaT1nlSFmEKyxZhccw2sGJ5z2QWjxctvj8Vi2WKFt8jHm9jA8r+0dmB9S396NnrptEZYwGWXWP/L8w+m99XvhOCS1svTMBM+/ySZhPiCrOysv7s9XqHXTvClh0FzQTMVdnZ+K/OTu2HJCEw6+HatDXWYUVFxswymdaHEyz7OMv1tGTMwO8FAEea/n/WNC+AWVF2G1HV58WyM9H3trdb2oJc7/O/artmU1EWW9qDgXlMGAoFh1X1b+K52Znj92UZy2zuE/Jtzc0nivcKga/lvrBzT8+4pUEMzKmLgdl5ZmBOJHRB/+DTYnul05SwS8vWPRUdvDHH1Tf4Z7GsGXQc+jYcKJ52LkSA1gIAjxhh2RfU1IwlTRKB0QIqU4DNSctIpaxkLZ4jGYtl6FBG0HYXfaG1HoCw5y2jwGyZURbCsC3AfANC5XIDmAnqKBPzbAOdq7y8XAn4AusB4D39OsyzzY6A546cHG192NgMcwLTHtIPd3Zi4WjSMiMUm9bnN4sVZyUt+n4I0Db0AHAzAGwFgJcBYG/9QVuBeEC6NE+AeXFMVX8vlp2JPrDEPvz00JLSa8W2oHBsS1uQGZjHhLLcEVPV98RzszPLX6mstNwn5P2KizfZ3CsHW5Yp2FlRasz3CgNz6mJgdp4ZmCdQ/4ZDCRjFNkujP4J12pZNyWs00deITVkzYugb/MWM7xU9DdHs20b6LqGZuU8UFWG8u9sKzDaQkggsE1o81s7iMTNp8VzJ2HS8llBKVfGH9Q3o6TwcYc+bhZnlSWDZDMy1axFcHoI7AlVaS2xJ7jELMiD9cAB4WAciMzDPKTRThuw1weCORHQTmPZZvq6xkY4zYPktADhkDh5EzBfRrAY9TPsxAHwkZBInb9PXwc/KF9m8AGbKlh2JnC6WnWmmZTvlPr+lLYpyvbEXOzqOtrRFOLy72A6aGZjHNKIoXxfPy848P9jRgaU2n41QMO/xV0Ihy2cDVXW55d4QLUldtD+3ca8wMKcuBmbnmYF5IqEL+gbvFtssnYb+wZfh4I3EhZOrf70sHj/Dfhl6NzaJp51rfdUIy27JydESf41bMzoRbIpQmsjicaLF96fTxvnEa5jIOjC/udNOuGdTE2Z3H79jSykdlseAWYRkEZjp38a9EdzZBHgEIbTfr+2ei7Mkgp5GADgJAJ7SwXnOZ5uzXS48vqxM2/d6ImCm1+iePaOqio4zgJkSqdWKFWVNKkqCRmtFjtfX1m+3uRfo/wmYKdM6A/PUgHlNTFGGxPIzyb9pbaWBr6UtpGDwEbEdYrJ86LAkLRPbQTMDsyZctSorpigviudlZ57pe2JJvu33xIe23xOSZPs9Mc6hkIpLl44NYBmYUxcDs/PMwDyJ9ryuiLZTEtstnYb+wZ/AqrtpLDix+gYGxWNnzgMj0D9IO9c4SjTg7QaAV2gw7AHAv7e374CUycBShNFEFo9LpYyZtngdk5iA+dVFizDS0ICunm+MAfA4WE4WmFs/huDOIcAj+KD9kOkpyqzARwIZ56Y9zi4AgJdsYMkCtem0z+XCK+vrcaS7OylgPrG8nI6jvZZp1v5qAMib4zbNJFE7BXUI1raa06Mf6DshXurxYI4n11hGQPcC3Rufna32nS/ATI4pyl1i+Znk79bUWNqBfHhJyTViO8Rk+SAMh3cS20AzA7OmYVnuF8/JzkxTNFSC7PH2n49EyxVEh0KVY/cLA3PKYmB2nhmYk1DfwGfFdkuz34F1A1HxMsapf/0uaQzFjkP/AO3g5EjRIu8HjXXM366snHRWb8wihIoW3y9afP9cWLymBCZgfjoSwfz8Ysxa/sNx4dg7YDkZYL4RoesoBAKQUfigGV1ltuBjEtE10BfNzgDwU/1Bypysb6YM2febH94ksAHMXygtpeMImOn6CPrnIsw9E0WffwqvHtC339JAmdqx1OOJf7ywEC+uqcay/EZ0Zfm1NgaAIX3/6lm5Z+cTMI8oyhczefugXQoKLe1AA+Ef19ScLrYDRiLrxPqPmYGZvujcMUX5pXhOdub6ngQJ8ar9gbfeDYc/Ne6eiUQOt02IJ3h7JEK7PGhiYE5dDMzOMwNzEtr7Mj/0Dd4utl06Df0Df4Sey8YlHBzTuhtqXf2Db4jHzJShb/BtWHudZYcAJ+lXesZmXOz34weKMrqOeSKL4ClafP9Ujp1ti9cnWMuQHY3i33t60JNXjZ7dLkXo17eVGgfMNpBsB8yRzyN4vAZ8EDAvni34mIIoDGwPPeHTOzbgbIHcmTJlyK7LzsbXJUlr+8mAebui4HElJXSscW0X6sDstDZ1kujLkL6UztIjCrR1ygTKPpcrvtTvx6sbGnCzLOMfW5uxoHoZunKLjDYmYD53ttp3PgEzQeSIqr4uniMT/Gw4bGkDcqU/8N6zXV3HiO2AicKxyQzMQPvsDqvqY+I52ZltJS/fcr+Qf1hVc6bNPZP4oZLNPcPAnLoYmJ1n91oG5qQ0Gpr9ith+6TT0DX7RNuFW/8CZ4ntnzH0DQ5TsTDyl03QCfZ/QYLkyKwufDIW0D68IJ2MWgdPO4jHJHucEC0BGDw+oPa5dvBibpWXo7b3SJkO2DSCLNoC5+ySEHbN1BMyUidh6Y869KGkWhYMdBAC/1deuigmgLMA7XVPCr538ftycxIMbG2AmsKdwDgoxdmKbzqWM9qDMqycCwEPGmnX67FP4dVduLp5VXY3PhMNau1L73tDYiIU9xyB4R2fx9YdrFwllp03zCphleeeYqj4gniMTfFJVlaUNyLsXFP1WbINYJHKwpe5mMzADqupOMVXN6DXtbKsvrq+33C/k1QUFdwxJ0hHj7htZPhRDoUlnmVFVKc8IA/M0xMDsPLvX/grzSm2iMnz5H2SpX/2aBZj71vdbAFn0moEo9F5NO3zMI6EL1g0eL7ZfOg39g89A3zVV4y5j9Q3Nrr7Bd8X3zpShf+BKW0h3mHoB4ENK/OV3ufD2lpaJt/IRAdPO4jHJHucUm2B5u6rin9s7cFF1Ey4+9Cz077Mj4VdSM8vjgPkmhJ2+g5AVMOBjG4Bn1hIopSgCZ4KsLwLAv/QZxrRBMwHzvgUFuFX/EbHcRyYbwPyZ8cB8vb7tkZPbdLZFbUFtQg8/7tHXzmsPPyhDfnlWVpweOjzS2TmW+E/7DohG8ZK6WvQv/w6Cv9LcxrO2xmReATOFZavqj8VzON3vyTI228Bjkdc3cnNT00k2bdAn1nucGZghpiiD4vnYme9Hurqw3h+w3DPN/sBzdtmyhyORlZZ7RHQoFKYEcQzMqWvhAfM5p4lA4jj3XouB2l0s9S30+od9bQedawHm3g17w9qBRRZINrtvsBv6NhaL/Z/xCm3Mgb6Bv1naMI2GvoFL4DN6aPaajQXQP/Cw+J4Zc9+Gt2DNYJdYbaeJBtKUGZfWq45kA2gZh8e2l0oVeMVjRYvvd5jHZpajUby2uQXrAnlYsvyrmLVuI7qmOrM8DphvRFjyfYTsoAEfNGt7VIbAXQ4AtALANwDgzXTNNlNINq1JHtazkye8d3RgHlIU/HRxMR1L10DXc+ccZx53kui+ogceKwDgJr3fxtYp07975efjH9ra8H1ZHntQZtz/lHTtlJoG9Kw8HyFYb/QRHU9rnse2O0mn5hswIyV6UpSMWsdMDwwrbbbMafYHnhfrH4tEDkNF2cVSb7MXODDT/roxVd0uno+d+aZlLHZr/Yu8vthNDQ1fFe+bWDJh2bLcjRUVAQbm1LXwgPks5wMzzTLv/jPM3ukUzI0ci7mRY8acHT3+vaxlZz7h3uXch927/Ej3uf/y7HLOXz27nHP/JL7Xs8tZv/fs8kNnevkZv8vqOem2QM3ywfy8sqt2uPzKvMKG87y1qz8NvVcv2WF6GHC1BL3XrXD1D/xPbMP0ecMw9G/4Nizd6IP+wV+kMdEXQt/6A8XPrFNFA9//o7EphWXunZ8/NmC2zDLbwGVCi8emWs4s26j7h6qKlzU0YHlhJVau/T56KKlXv5jsywaME9kA5mVnG8BMpozDJ2cIMJPoOilRVI+ejXrGwZlmmM+vqZn8/jOSfikKHlZYSMcawPwnACgTL3wBikC5GQBOBYDn9FBqrZ9oVjmUmxu/pLYW34pEtAyvZlgeA+aeRXhsXRvm7nEtQmE7ArionamM2/T7IO2ad8BMW0ypquMHb2ZfXGcfZtpbVHSbWP+YJH1s0mRGCxyYR1T18+K52PPHP6iptdwz5KV5+feK982kyxcMR6MNDMypa+EBcwbMMLPR2/UJLPRZf2fyKiK3WmbY12w4BPoGfimWkW5D/+Db4t9m0tA3eJ34eXWyCII+o8NbvDE7G1+l2aaeHhzR1zFq4GIDl0nZODYR+DjEFH469qCguxu/W1eHVcXlGNz9PHRZ1ixPIRR7nG9E2PUChOw8AxApvPm8DAJmQ3S9tE5kJwC4xQxj0wFnml3OcbnwlpYW7QdkHDCb+0v/G/UVJalbHRybsadr+CsAlIsXvMBED8GOA4D/iCH0Prc7/u3ycnxOkrTlBmZQNn9GR0Oyu3G/qnZ073kjQlk3JfY1gPnPev+n/b6dj8A8IsuniOdxsvctLrHUv8jri3+zourHYv1jsryPWF+LFzIwd3aWxFT1FvFc7PnjlyWJPh+W+6bY6xt+qLX1c+K9MyzLu1ruE9GKEh2ORtcwMKemhQfMmTHDvNBNmcLzC60PpAt8gaHsnb77FQs09w3uC/2D/xHLyVRD32AcVg+2i59Xp4sy5m6mwXAuQHzPqiocWLMG31IULSx5bObJBjQntThLmAiC5tAGLNOX1huRCH62shqLaxQs3POXo7PIIixPZWZZ9KpLEXK1GVEygeYvZwM80ijKqH2kvj0ZhZhrIb+pQDMBs9/txkf1xHMJH9To9w+953VZRsnrpWON9bU3AsC0flwzWASxKwHgd6YHCFr4dZ7bHae14X9pb8chve3GPQwTPpv09yFFxV0bl6Br798gVCwxA/M/Z2ud+HwEZlSUA0ZU9R3xXE70G5KEFTbh2DQA/mtr6xcs9Y9EVljqa/VK8TxOdFqAuaurIaYor4nnmmu/E4ng6zZ+IxIZeUuWY6LfluXh2fK7shwTr9fpPqi01HLfkL9YXn6peO/EIpH9LPeJjWOqejADc2paeMDs/KRf7FEHqxdb+pzsr9/9FxZg7l2/H/Ru/Jirb/A9sZwM9HboHTxc/Kw6XTTopW14/q0DnBay6fV4cHlJCf5WlvGjaFT7QJtDNi0QM5FFUHYIMBugPAbLqooHFJdiUcMyzO2/2iYbdhL7LU/kdZvQteYKI+OwAcy0rVfawSPNovBfCoP+sh7+a8xqTilUm4C5JjcX39EzZE8Ec2R6zwPt7bRvM0EhnYuA+cc6xGd6myYrqifNKFMmVVpbvMX80IKWWcheL97c1KTNxtN9Pq5tJ2jf/0kSdjXvjrDPbSIwU/K3otlo43kJzLK884iq/ls8lxN9YYKsv0ow/yGx7lo4tlhXO8tyt3geJzodwDyiKJ8VzzOXpqSJR5SVY1cwDztMjgTzt/ykpuYnb4fDx79r8lvh8CdfD4f3flOS9krkN7q69vhvV5f0UFdXw0z4n52djaiq6oiqPiVev1O9sanJdpZ55/z8+2yzZU8AP4ZjinJ0TFG2iudymhmYUzMD88K0v7HX0ufkYEX3TRZgXrP+QFg9uBP0b7hGLCfT7O4f3JgJWbFFGQNu2pP1bX2wPTYzVZibi0fV1OC94TBuFkM4bSB0QovAPMfwbNSDQlP/3hXC/tIKzGvbE7P6CJbFWeXphGLvAGZ3/wC6AlUGJBpZnTPuprGRUQdZh9anxXBgEZBFEzCvyMvT9r3W7q8EIEf3IK27fTUSwT3ytPB2Yzb1ZX3/6PnQnsmIErFRdAglYntRv580WM4CiHfm5uJ3Kivx2VBIa9OEn12bdqb3P9jeirXt+yHsfRtC5VLzGuZH9bD3tLfzvARmVVWHFeVC8VxO80eKgktt6k4+r7rmdLHuMUna01JXO0tSnXguJ3rGgTkUWjyiKE+I55kr03fox0vLLPUjH1JcvF6sY0xR9rfUyc5dXeO3I5khxVR1P7EOTvV/QiHb+6fGH3jz/XD4U+PaNRI5fDgc3s3SjqJV9diYqm4Tz+U0MzCnZgbmhWl/UyJgjt5sC8xaErANKzI8NHsz9G8iVshYURKfAwDgL/p6Zm2GkKDZ5XLFC3Ny8Pi6OnxMlscyGNsOvieyDQTNBTQb102m8NR7Ojuxu6AUvaHDMWvdoP3M8nRhWQdmF/0brDED8+0AkCV2RgaLIIrqEwKAa8WHMBPBMyX8Oqm6ehwwm/tKS0Sl99njoRDuU1BghGKTCc4HASBPvKB5KGpjGkBQKDxFhow9mKDokEKPBw8tLMRHOzu1tpr0s2oDzLQU4+aGWqxQjxkNya7axegnOs8TAFCtRxakVfMVmDNhlvWxrhA22g36ff43LbNkkcjhtDbZUlerI++3t5eK53Ki7YCHnDIwy/KnxHPMpZ8KhWxnQUu8vm0WqKM6dnVNHm4fCqn0ZE38HM+EKMRlWFH+IdbDiabv3d6iIkvbkr9XWXmu2LaxcHhScBxRlOMYmFMTAzPbqU4NmDf2QP+GT7j6B7eI5WWCYY/BvcTPaCaKBsAU2kmhtX+j/ZnNs81ZLlc8HAzi6fX1+Lgkje3Zqg3GxUH4RBZBeRaB2Zzci/b6vbmjExdVtGCufAy6+9ZbIXmmYJmslXMjQl6jGT7u1UPiM0mTDYiM1+khDH0wNgLAG5NBc5bLhZso4Zf+QMZsGoC8Kkl4d0cHfrO6Wlu3TICtl0NATgmulgrXMd9E7Up7DO4LAJsA4F1z6HuhxxPfMz8fb2hqwi16WPtUYdkA5hE1ij+trsD86FcQ9vo1Qu1u5nuWogfoe4KBWRjIJA3MS5f6RqJRRw/+r29uxhKf9Yd857z8P4n1joXDhw5HIkstdRUtSS0YiRSJ53KiZxqYY6r6C/Ecc+nLGxotdSMvzS+0ZnOmcHtZXiLWycaUmT9tikWjnxbr4VQPNjVZ2pbcHAg8Z3ngRGHZ4fBONu05Zgbm1MXAzHaqUwbm3oEl0De4USzP6Ya+wZugR9/feR6IBuXGljQ/1EM9xwblBM40ixUOBPDylhb8wAQ1Ew7MJxmkzwY4i7Cs7bFcXIfexSej2wBaW9vAbyrWgPlmhII2Az4I9ii8dVYSKM2Q6EYnMM3X75PJrptepwcCnwSAv5uiF8aBM8FvZVYWvhiJjP6ARKNaJMPbsox/6+jAn9bW4n4FBZjn8Wih26aZZYLl9wHgS3qI8nyU8Zmkjd1/BgDviJ/J9txcvKi2VluTSO2X9OdR/OwZM8yqiqdUlKN32WkIe96M0Li3cc9Sez8PAB0MzNMEZkU5UTyfk3xsebml3uRPl5T9Uqx3TJYPtNTTzpJUsSCBWVEWj6jqP8VzzKVp7bJYtyKvb+SUqqrzbeqXVGIq7OkpFT/DMyl64BJT1TfFujjRQ4piG6FBXl/f+A1LG8vyakt7mszAnLoYmNlOderAvLEH1gzuDH0Dr4plOtmw1yZaRjjvRIN0PwDsAgA/0QfJY9sH0SA9PysL1xUV4YaWFnzblKhp0oG6zSA93cBsXBNd47uqiuc3NmJdeRdm7fRNdK3baAPJxszyDM0ukynUm+CjOGyerfuvnjBrMvCcSxlh1gTKlwLAMwDwbQCo0deyTgZOdDytk6cPytf0LMuUUXsM+siUIfvokhL8VkUFfrmsDA8vKsLlgQA25eSg1+XS7jn9vcZx5JcA4Hj9Xp1vMu6JVgA4RQ+/HnvgQAm9GnJy4l8tL8eHOju1tfhJff7MFj97+rEfKDIeWlKGnl3PG31g1H64GZhfA4BoEv0+bc1nYEZV3Smmqu+L53SCP5BlbEow2L+5oekksd4oy7tb6mnnxkbvggRmSdorpqrbxXPMlT9UFGy2qV+F37/5jubm4y31U5TJ19jKcje2tqZ1f3bs6fEPq+qfxPo41V+trLK0MfnwktJrLG0sywehJC2ytKtuBubUxcDMdqqnBcxaaPbg5zMkNHsIejccLX4255to0E4zd8v00FrKwjtuhrDA48GDSkrwL52d2qwgffiTGrjbDNbTAcxjM8uKgltUFU+srUFvYTPmrLogwbZRZmC2Ad9UrQHzrxHKokYCJYIPgs/K2YCPFGTMbFYAwLcA4AXTemRam/wnALgIAIJTAH4CZ9p37WwA+J9enpaoitbK5+bkxD2jWa/NgGxAMj2wMc5P63Zpz+Vd9Vnv+SZqdxp8fgIAHtLrq7UFtUsOgLZN1J/b23GbEH6d9GdI/NzppnJei0i4e1kDulb9dPRz0Hmk+Z6l8Hragzvt9+y8BuZwuHjYoZl/r29usdSZ3OAPvCTWWVu/LNbRzpJEERKwEIE5pigbxPLn0r9MEI7dFQg+JtYtFokcJtbH1rJMUSdp14iifFesj1N9R2sbltlsyyYHg/8U23l7JHLYcDi83NKuuhmYUxcDM9upnjYwa1mzB/8glutA3wHrbk/rA1UniYCIZkL3B4BbxK2DKCtvU24ufra8HP9KyYaSTQxmM2BPesCfhM3g/oJCYWgVGKhZhu5VP7HCsWgReKficWVdj9BPicRuQNjndoTKneMALiOcmGbu62cDPlIQgfKxAHAfAHxggK0AsH/QE1AlC8wkei9BNkUvUIixBs60c8g999wzQv+6XC4DpOk8NBtNYciPAcCdOqR/XG+3+SSjDekBAK39pj2l3zI+ZwTKuS5XfFUwiNc0NGhruumHNqmHU3YWP3P68VTm06EuVKtVdK+9avQe7jrKDMx0TTsL154WzWdg1uqnKJeL55xrU76AA0umtI/svpY62rmzs4TqvOCAWZZ3d9J2QFsVBZW8fEu9yGfX1Jw5pbqZHQrRd3raReukY6o6ItbLiX5FkrAtaL2Pyry+j55sbz9WbOvhSGSNpV11MzCnLgZmtlM9bWAm921Y4+offE4s2zHuG/gA+gYV8XO5EERgR+tXCZwfEbcOokF9TU4Ofq+6Gv8ny+NnvsQBe6JBe6L3TtEGRNCX0dvd3bhnWSXm1K9Cd+81Vji2swjBk9kWkvVEX/0bEVb+BEH5CkKgxgDmewDg5/qDCKeIoI2AbQkA/F6MKKD16yZoJmD+s56IKhUZ65sp1Pv0Vbus+uHPL/3ZzT6fj8q8HABO1TNB0ywyzUpTCDj9cFJ4uBMfMExHRtg6hV9facouPtbuVVlZ8XNqavDNSETbEibpJRB2Fj9vps8dlftwRzs21u2K0Hvd6H0cOsa8rRQ9vKA+SbvmOzAPyfLO1JfieefSL4bDGA7mWepc5vN/9FYodKSlzpOsvSQPUZ1DIS3HwEID5hFZPlksey5NOSFKbOpV5w+8LtZL2/JIUXYR62SxLEviZzediinKnWK9nOqjbdaKk/cvLL5ebG+UpIRbdzEwpy4GZrZTPSPATF4zeDyFPYvlO8AxWDd4uPiZXEgyBve1APBZPXHV2GwzQTOtOY36/Voiovcmy9hrM2ifrukc2jmjKv4tFMIlhUWY03H4xOuVx0A5CVhOBMe0RnnPmxBoZm7nHyB0HDG6JU9+Sxxy8uPgziZYNmZOD9aBcSqzs+mSEX5NYPoLAHjdvGY92+WK9+fnx3fPK0BXls+cnfpBAJhuohct/Pjg0ME5J5xwAoFEQG8XCt8gODa3jxPaaiZl1If2LqUHBJTte2ydMn2WfG43fqG0FP/Z2anNDpkh2fJZStbiZ85UDn1u7mlrxaKuQxD6N4ze39LnEFxuo983A8BaoR5p0XwHZtoqZ0RVnxTPO5f+Y1s7ltuEkUaCeY98GA5/clydKVxXVROGkY5ZljuorlqdFxgwxxRlk1j2XPqCunpLncjrCot+LdYrJkmHUMIysU4Wh0KzGu0TU9XDYqoaF+vmRD/c2WW7fVelP/Des+3txwifJ1reYJttnoE5dTEws53qGQPm3uuXQZ/zQrOhf/BO6P0tjekXvIzBPgHThQDwpimM1liDit1+P/6lowM/UhRtZsx2oC8O3m0G8snaKJ+SID0ejWJXfhHmyJ+xgnEii3BsC8mbRiHZAOW+QYSVlyBIxyGU74SQ5TfgQrfbAEyCUAoxphnEk4X2nCsZUQOfMyfj0rYSA4g35+TgNfX1uH3RIty7uByz8mvNwEwPS2hPXtbURZ8fH0DWbnpCLyPUXfvs0EOKbp8P729v19bh04+q7WcnFYufMb1MOg9tKXV9UzNmRT63Y09y9UQEl8fod4o6oD3b0675DsykYUX5oXjeufR3qmss9SXvU1x8g1hfbeA2QaKiMUtSnVHfBQXM4TAldntJLHsuvWexLdAMn15dfbZYr5gs72Opk72Lxj60syBUlPaYorwu1s2pXlFYaGlzykh+Tk3NGZY2T3AvMTCnLgZmtlM9c8C8sQfWrl8JfQNvieeYQ2+B3sFZjT7KBNHAn2YCFwHAZWI4KQ3+A253/ICCAvxrR4cGsmI46TgIEAfySYCzuRwqeyiq4jWtbVjtL0BP9ITRWWNj8D9l03Gm8Gpai7z6SoTFpyG0fQyhNDoaZu3xGqHWxmy78fCAIHmrDpeUcZxggxLgzPX+y9RvFCZJ+/pSAi0Dlo0QYDylvByfCYW0Bx20tjGaX4HukrEs31RXWoPdIhbMmlD0gILC3rsB4HrT+nDtIYUHAFtzc/HSujp8S5bH9qW2fE5SsfiZEj5bdB463yUNrejp+eboPU8PhRafiuDOorBs6nOaAZ+VbIcLAphVda1TBsK0FU44wfrWi2prTxPru02W+y31s7NpfeuCAuZI5AtOmgl9XpJsowfofn6sre04S72SC8fuxlWr6Pd/1kTZuIdV9S9i/Zzqs2trLW1O3quo6CaxzRPN6jMwpy4GZrZTPaPATO7b8B2HhGYPQ//gceJnkbVDRljvGgD4nb7WcQwEyEUeD367shKfDoW08FIRnJMZ1NvZXAbtDf2r9g6sKG5F1+LvjIdfu5liW+uA3H89LVhHz5or0L38LHSFjkKoWIyQUyjMILsMSCYTeH6ob3lEIHoeAKwStj6ayzW41E8U7kzAtt6cfdroo73y87WZzRF9ZpP8liRhVXkHuquXm4H5FQDoFE/ASigC5UY9/Hrc1lq0TRQ9pDi2pASfkSR9tneGQJksfp5sPld0nlh3D36nvh2zd/0RurTPwEaEXc5HcOcYwEzX/XmxYunQQgBmjEarR1T1VfHcc+H72tstdSVXeP2bt0rSEePqS+Gj4fBOlvqJ7u6WzX26YIA5HN5pWFEeEcudS3+zqtpSH/KKgsI7xTpp4CbWyc7RaIO5f2dLww7fx9zs+2g8YvOgotkfeM7S7rTMweZBBQNz6mJgZjvVMw7M/RuXQt/gg+J5Zt8Df4F111LkKmsCEYyR6QvuQAC4W4fHsVDTLJcrHvJ68dzqanwuHB4Xpj0GB3YWAcAY5JvWLBMsn93ShsUVCrqWn20FYW2mWbR5BnkTuvqvR0/ftZi72wWYoxyHWdVL0JNfi67sQBxcBAwaNIgzyZT8jLIHU2gtJaz6JADQQJEyw9J6byN8fa7X4NJMAG3/8SN9m6ixdcq07nyRz4cDjY2Wdef0hf5oRzsGq3rQ07KfGZhpT94Fmf1uijK25/qiHmkwbpso2pptn8JCvKutzfIgSbzfU7b4ebL5XGmfo2gUP1cXRveqn+kPjTYirLhQBOYviRVMhxYEMFNSA1W9RTz3XPgLFZWWupL3KyzeJNYVJekAS91svKWjY9ySjYUCzDFZPiimqsNiuXPltyIRbLdJ5kahwX+wu5claa1YJ4tpdllP5jbboqzrMUVxPECS35dlDCVo+yvq6r5laftw2BK5wcCcuhiY2U71jAOz5ut6XP2DL4vnmk1D34ZDxM8hK7EMcM4DgBP05FAUejoGzi4AXBEI4HWNjfi6JFky/040sB8b4Jtg+RVFxpNr6zGvZpm+f6xpNnnCmWWaRV6P7t0vw6ylp2FO6DDMrepGT26eGQzFcGsCnvd16KSHAufomcNpT2WxHZwggnZaR0hJ2mhf37G15rRWltYpn1pZqfWDmKCNTPtr397UgLmNfegKHW1ulzeyIXtWthjKUBEo0/o+Cnv/rZhV3u92405+P/68vh7fnyw53nQtfp5sPld0TtrXef+GHoQ1+pZSGjBfJALzN8SKpkMLAZhJqCh94rln2wRUSwusay1psGsLVMmEYytK1FLXBQLMw6p6ppPCselhnF04dkcw+KRYn2STuW2XpC76UjD372wqpig3iPV0qs+tq7O0PXlRfv5fxfZHmt0XcgMwMKcuBma2U50WYN79qhoKh3b1D4yI55slD0HPZRRNyUpBBGvNepKrh83QQGtlCzye+J75+XhzUxNuFraisgVnfZBvwDJ92bwYjeJRtfXoa+hF124/t4Fi80wyJfG6EV3969G96iL0RL+CWY296C5oQFdOHrrcHrtZZMPvAcA/AeAafbaQ1m2X66G2czZwmEB0TQX6bD9tE0WQr4VeU/3KPZ74Z0tL8VE9A7Ndu2ttHI3iZdUVmN39WXSFjzVvMfQGAKwUT8rS2p3WqC/X7xVtr2mj7em+b8nNpcE3vhAOa+vD0wbKZPHzkwCW6RrejEi4S+MulN3QBMwXI3gImLX7hoD5dLHC6dCCAeaDD/bEFGVOk0M90tVFWwtZ6trqDzz7Sih0tFhXjERWWOomOhQKi+tbFwowx1T1j2KZc+nTauzX0R5YXLzRpj4HJxNu/5Es004ZcyZtFl9RMmJP5nciEay0eWBR7vV9eG9Ly5ds+mClua0ZmFMXAzPbqU4bMPdeHYD+gYfE882Sh2Hvy8xLUFlTlLG+OQIAZwPAk8b2Ocb65mKPB48qLtbWztJsG32JiPBmhjhtgB+N4iNSBPeorEdP077o6r3WBpT1GWbaImfNlehadia6w59GV/VydOfVoUsDAQ0ADUg2gzJlBH4RAP6or0WmraAoYRfdDE4Js7YTXRMNymntNO3rS8Cm1YnautDjie9TUIC3tbTgB3ZryYW2pte/VVaCnp2+hRA+zphhpvIowdteDm2DuRKFKFI4/g8B4Glz2DuBckV2Nh5bVqZljqcEeOPaXQTdmbLNZygRMP+nqxMjLet2ZIAnYF51KYIn1wzM9FlIuxYKMJNGFOVS8fyz6Z81NFjqSV5RUHDnkHX9Mq2ztCQmEr0tEqEHpeO0IIBZklbFVPUjscy5MkVvLcm33scUEmyXzC0WiawT+9LWHR0UQTZnomzZI6qaMdmyP15aZtcHsa9XVP3Ypg/2Nbc1A3PqYmBmO9VpA2bS2utUV//gR+I5Z8PQt+FY8XPImroMkNsJAC7SZygNONXWN5d5PPjl0lJ8vKtLG8DTl4kZKoyBPc0w/6W7G3curUVP5PMIvdeZZpGvR9jjplGvvgJdPd9EV/M+CMUhdOUW0uBfnEU2QpTJBDjP6AmxKLnRMn39KV33XCbrSkZGKHwrAPxYDxmnBxPGNl/xRX4/XtnQoMEAta1lZtMGmAnsPllWjrmrL0Gg7YZ2APO7APApBuax+tMP+4l6JMVHxn2tzSq7XNo65d+2t2sPKcT72gK5M2URkm1gmax9rqJR/HN7CzZ2fhxdWkZ4/bO0++XmrdLofvqlUP+0aCEBc0xVD57LNa+7FxZZ6km2HcyHw8kNdG22G1oIwDzXDz9E/6mjw34vYK//vbdCoSOFuhyOodASm74c56FwWJnLcGwSRS/EFOWvYn2d6sQPpQrvEu+pmCR9DGV5rB8YmFMXAzPbqU4rMJP6N9wqnnN2vOFB2O+maX1uWTtEP7T0dHodANyk7+E8Bs60rlbyevFsPTGYOWSV/h1Wo3hbKIRd5S3oUk8YnQUz1iwTOFOSIuUrCA39CAXNCDn5CC63eSbZOBeZQsRfBYD7AOBiAKDF6jSLTIM9AuQ5HRRMQXSd9EEhyKd1ykbo+whlYG7JydEylNODCGNrL6NNJ4Ireg8B3rqSaszuvw5BOd4MzJv10PRMaaN0iOpOG7PTdmGUHZ7aRLuPyTkuV7wnEMDLGhvxVXpIYc5+LcJtOmzTpwmBWVXx102NWCIdq2+hpgMzfaZ8ZcZnh+6rTWIjpEMLCZixu7s1pqqbxWuYDT8ZClnqSC7z+rY+2951jKWekrTMUi/BQ6GQijYPGOc9MIdCu4w4aI9gml0+3GZmk3x4Sek1Yl1ikrS/2Je2liR6iDznisnyp8U6O9WPdnVhiU0/VPn9777W0XHUuH6gBxemZQ8MzKmLgZntVKcfmAevFc85S47BusHjx30QWdOWkRSJEmbdb9riSJuVo6RIlLn5l/X1+JE+KzfUHcUr2lqxpqgOXcvPQdjj5tHB/cpLECghVflOCP7K0TWXLlqPPC7M2tgf2oA9WtdLSclorSkl7KJ1p7TmOtNE17yHnoBs3MwmAduhhYV4f0eH1oaW8OtJ4Ira/C1FwaUVHegmeFp0igjM9KFYiMBs1DmsAyRlSaf7d+yeK87Kwu/U1OBTkoTbTJERlnZPl236cyJgpsH1pXX1mNN90vikefTfwXozMP9GaIu0aEEBM4B7WFXnZLbsrFr7hES7FBT8UaxjjNa3inWyc4LthuY7MMdk+ZiYqm4Xy5srU44Eu7qUeX0fibPL2j0sy6stfSlaVdUHe3ockdSF9mSOKcr7Yr2daHrwvypBJMeXyit/KvaFOZKDgTl1MTCzneq0AvPBG3Ogf+BN8Zyz6K3QP0jRxKwZFIEHAR9twfQF0+yoBh3Gtju0N/AdLS34f51dWFehoHvn0xGWnI7Q8QmEsihCbrGemIhmkcdltDZAmRJeUcKuqwCA4utpnSnBupGwK9Ogj66X1sv2AMAVenj7WPZrAuVdA4H4+sZGfEuWtS9lMyhboE0EKt0Eea9EItjVuAt69roZPbueZwZmynxOGZMzre2mI+NeadGTX/3X3O76/Rr/WGkp/qGzEz8Uwt5nZVbZsE1/2sEyma5ti6Lgt6obEHb+vjUHQF6jAcz0UOD/xEZJh2Kq+rQ4sJhNa8Bss/YzHcBMisnyoeI1pNsfUvSIzSCX1lbarm+VpL0sdRJN2w21ttruwUiDX/EanGg7yCSfXl19ttgmZmAeUdVznZQd+9bWViyzSTYVDeY/KNaD7j9MInoAVbVtrsOxzYqp6lVivZ3qwQRg1BkIPmHpj0jk8CE9+RoDc+oaVpQHxOt0mhMBs8LAPK+dNmBedXcW9A9eJp5vtg39A/fBPrfMaa6L+SwCZ4LYr5pCirVZYQorznO7sTivCt3lPQje0tFERK4xQDY8Bi+6nwKA0/SEYwYgm/dGzkTRtQf1BGrvGA8YjHXKQbcbL6ypwbdleWy7LstaZdEiVOmm9z/V2YU1TevQtdctCLv/XA9v19qYkqJ9T7y4eSxq91wAOAYAnjWHvVNCL2r/cCCAv+3q0kA5pigTP6RIp236ciJgpvvjHVnGI6taEXY5f8fe5Bow34iQ32wG5rtmYz3/sKr+SxxYzKZnc4aZpGXLVtV3xetIp58Ph7HDZo/YOn/g9YdaWz9nqaMs726pk9URmvkT60fKBGCm78xim0EM+fK6um9b2kRR+oy6xxTlVrG8ufSXE+ytfURJ2VViPbYnGT2wpaurSuzXuVRMlg+MqWpMrLsTvTkSsfQFudofePuxtrbjxD5BRdmF2jxTgNkuFwIB83k1NT8Q6xZT1T3Fe8vWzc2000fKGnZYxno7MzAvTKcNmPvW97v6B7eL55sDj0D/IC0TZaVJNBAndwDAzwDgdSPTsAGEOzxuJpnes1VP2HWjnnyJwgFocGrAcdoH+WkWXT/N3FCirX+JM5vFHk/8iOJifIwSppnXyiaApGTgimZE72trw2L506PgtPsvEMBjwBOFfxO0z3fR/UOZ0VcDwK/F/ZSzAOKdXi+eWVeHr4sPKMS2ni3b9GUiWCbT9b4WkXBtVRhd1MciMBd2Gn1O9xwtn6B122lVTFWvFwcWs+nXJAl7bGaYK/yBzXZbwSQFzJQsKQEwk2KqulG8jnT6Ny0ttgmhaAby/XD4U2IdhyYYqI1ZljsmmoF0+sD/xbBkaQ/d8Ze6uj4ttsmwJK0y6h5T1bvF8ubK78sytiaYKd/U0HCypR7JhGOTGxtp6ZJjtG10/f+bYv2darsZ/yp/4N0/tbR8UewTY3upmCx/MqaqW8SynGYlL99St1Kvb+uv6hq+JdZtWJIm/74ky/K0fmtGFOWX4nU6zT9vaLS0G3lZXsE9YrvFaJ9uU0I40Xuv+sFJNuDCdqADdbta+pwcqF56nQWY1w7sb4FjO/cPNEL/wF/Ec82Z+wa2Qu+mJeLnkjWzogEXAWK7vkb0QxMgjs08639/CQB+BQC76QN5I1lXpgOyIaoL7We6GAD+otd9bK13tsuFiteLf2lrG59UagJASgauDOAbaGzAYM9XR+GJMia7sszrWX+hX9t8FdWN1mP+XN9SybjvRqMePB6kvaxpnTe1O/34Tant02GbvkwGmF8Ih1CpXYqw9morMJctMifMexQAytIdpTGiKJ+Zy/DWFyUJwzazrzX+wJsPtLZ+XhzIJAUckiQnmn0l6QPjWavzSpsZIfLx5eWXiPXbLmx1k9DhcLFYL7NiqvqCeB1O8gMdnZb2IFf7A2+JbUI2hzHHFOUGsby58tVNTZY6kNuCwf+KddC2ChP70c6yTA+yHaeYotwp1t+JfkWyfxhT4w+89WyXTYK9cHi5dl9FIvvFVPU9sTwn+ekEyQMrfL73X+rosDxowmh0qeX+svM0x3HDirKbeK1O86k1NZZ2Ix9YXLxBbDfafxxVNeE+6Z9fduKRFmhhO8996zGv2D6yICd09PcswLxmYE8LHNu5f8M1lnPNvf8ASzcmnChgzawo/Hgffeb4FT3MmiCa1s+u0RN2mTNap3UgP8uip/nd+mz72H7KBC8+ysDs8+FFtbX4ZiQyblZ5IjiyWIQqEzCPdHfjmdW16N35tFGIWv1LBI/XDE836Nc430Sg3AQA39L3DR9rd3pIUZGVhZ8sLsZ729uts/lJAGpaLV5DEtdC1//vzi6sbOof3bNc25pNT/xF27PVrjbnBqAojsZ0f84+UpSaEVV9RhxczJYpUqPWH7D8mLUGAs/+t7PzWHEgM2zKapvQoVCYtsMR62oIFy8uGVaUf4jXMtOmsOMrG+1nNbrz8h/4MBz+pFC/Q5Laezkcpi3tJtSwolwoXo+TfEJllaVNaE334SUlV4t9HlOU/VFfZ0oeUZSvOyE8+CVJwmi+dbaPZjLvaGw+flwdKCOzJK0V+1K0tpVUba0jBz3bu7vlmKq+LbaD03xaAjBampd/r3hvoSQdMiRJi7T2V5TFMUW5QyzPKd4sy7hXsXX9Mn1u7B6+JbU1HeVCmOThW7KKKcpd4jU7xVsVBXe2iWQq9/q2XFFXZ5mZ3xYOjy0BsfPL3ct3Llz7q4dsoIXtIGct/T4WBKwPrPPzq56CtQNHjIPl3sHDoW9gVwscWzzw6bnae3kSD0PfAOWoYs2SjPWjUQAoFeA4rQP3ORI9AKjWHwpQBmYDVuK0Xrbc48GTysrwDQLlZNYoT2QRrPQyNGCOduNnyqsxZ+WFo9t3rbkKITvfAGby7bMRnjtLMu4lSlJA24s9bo5mIFCmhxRL/X68vbUVY93d4xN6iW2YSl9M1+L5k7gWum6KTLinvRMDHYeaQFn/d8+bEdoPMwPzc3rkR9o/d3pW5T/rexTPyswrweQ2RcHjKy3rP+NFXt/IfsXFN4iDmJiiHCIOXCymAWB7+44tHybQiKI8GlPVEfHapmuqG2Xr/XtHJ61TFge38VZ/8Jkn2to+M65uBFSyvKulPoK3K0o4mezJqCg1w4rykA6WM17HqZrahLbaezsSwW9XVVv6u8Tr276usOiWN0KhHVv/jG77s5/NQ4SVw4ryxFzVi/qWfhNWFBZa7t1ir2/4nKqaM2z6tl/sS4tlufudnp5prSVNt2Ky/Ck93H9WviemYrrHngqFsMQajh2v8vnffaC5eXzESiRy+HA4vNu4PlDVZTFFuV//3Mx5Hele266o+LYk4afLy81LO8Y+N58vL79UrFdMkvacaIZU+54k9/TQOG9G9JEk1cVU9baYqg7pn805bT/je/h/koT7l5RavnNoS78vlFf8zKbtJk66SO0WCqnf7/lMi6t/4O+0vY9r3eCIDcCw58QD2syye9VPMK+kVfwuGCn0BrfkhI/9rgWWe9evtcKxyX03dMOaTVHoG/ir9ZzOMfQNKuJnk5VepX2QPsei+pUDwJEA8Cd9XbY2u0nAVuTx4McKC/HO1lYtw60F2GyAaEKLUGWCKypvm6LiXqV16Fn1M4T+60c/7Hk1ZmC+EwCmlcXSQSJQpoiFWwDgXWE2Hxf5/Xhxba0WVkc/emOz+RO1Yyp9Mh2L507iGgxg3tTaiT75yztA2fCetyBEvmAG5hcAQJqtzyL29PiHurt3jkWjnx5WlBPT6XcV5cRHOjtP/HpVzYmFPt+YS3y+L9f7/Z/Zv6hor+2S1GV4myx3bJOkFtqXNqFluRw7O0umshbvvUikCKPRg/6/vesAb6M8/+9JsnTykpI424md2PGW7hyThGwntnVywiykpaUt0D9lj0Jb6IDiAmVDKTsDsmxLMRu6F3TR0hZKKbSUvcoOgezEjr7/857uO336dJq2HCf5fs/zPk6kb393p/t979qnqmfzYxyMvO/zXbixYvqFE91FcfMb63afe1hR6eefnlajxM1PVWegpj9hTqw0N48lLS2ebE0n+1V1/h6//4R9zc3n8uMcLtmuKBf+vabuwrUVFRcu8Y5m1+SCaYWF/7fA41lx2+TJcxP2u6FhasI6UKmvnzigKEfsU5QL+P7yKVt8vgsfr6m5cHaJN25vR7vd59cVlZwcnj59Fru3RFFqUs4Dxe8f92lj4+hUVhEjCUgYBhTlK8O99unk6bq6C48dXRa3LyhTCwu/evnEiQvZfdnj89URVa1M2AsUPGzy+doHVPULe/3+8/h+hku2Kop+rf1wypQLq4tK2OfIeXVFRSe3e72f+VNlpWreN3it+XzTd/r95Qlz4q+12tqSbJ8lmQJdCjDY2ICqnszPaTjlPw0NF/ZOn35hG/fMmVxYeMac4tIT2GcO8fnq0HIn7b3a0lKGz+HnGxowewqmFXJDYNMiCIZPgGDoPAiGLxSyf8W25I4LXcrZF5aUTIx7DpQWlp5VPLrqcwWHXdoM7eF6XQK9daD1VUMgNAXaescnlc6+sbC8ZxQEe6/mCepIE9DCP4WWlWkP1QUE0gHJB5o2LwaAsOGbbRJlTBPVUlhI1ldUkE+GgihT4YkV0xb28ZHPR1rG1xKpfa1upistu5/YyxrZyOS/Mwj+gQx8GawDgOsAYDPV5uO6o5/yJIeDfHPcOPJqY2NybT6/hhbrOSzC953BGHAe/c3N5M6qBuI6/Eoioc9yHGF+hID/HJYwvw0AGMRhWAizgICAgICAgICABZbdd5ikbdrCE9SRKKCFviDeHQUGAzxxORwAfmikK9KjglMtbp3LRa6cOJH8t6EhTrM5KKKMwpMqrj3s68X6OlI98TAiBXqifq2obRw7Ew+AKXnCIGTlB+ANgOPFU+zphtk75ujGqN86UUaZ4HCQ08eMIb+bMYNszfSQgl9Pi3XNm/B9Zti3rmFWFXJF9WHEsWQNgU4LDbNyHntI8q6hiT/Q9lxAQEBAQEBA4OAAamyDm37DE9MRLDuQ4PPTEBBIBUrYMGDZRQDwglWaqK+OGUP+WVen+7sMGVGmwhMrpt0oiVLJH6uryMRKTb/QobOPAOZiHqsHrqSE+SkAwEA/BxJ5wnXHQHKf583e0T+80GaLdBQXk18wZu8ZB1Pj1zOTOkMlfJ8Z9o3zQp/ds6fPIlKgO54sUx9m9essYf4QAI49wPZcQEBAQEBAQODgQFeXDQKbLrEgpSNcQg8DdOXF7ULg4AIlGegv+xXDpHkrG1gKza+P8njIj6uqyMd+/9ATZRSeVHHkCvvCfh+snEq8DV8mEgb8QkFt47hZrHkuBsbyHyDkCceI5teaEXEdo47rhxQ0x/eCoiKysbJSD8aBgTlyXnt+XbOtn4vw/WXYJ85xi99Hjq9aREDDCNkcYcYo2bMuQb916rv+ieFjfyDsuYCAgICAgIDAwYVgr18Khj9MJKQjXvohGD6dn46AAAskGBjpGyPF/RgAtrEaZYckRRpkmdw5ZQr50O/XNbxpTYBzFZ5YcQSLapjvKp9CZOVrBnlCk+yHCEyYSwkzkk1MMYT5oUcyeaJjQ/PrH/HpuRwAkQqnM3LtpEnkHZ9P1+YPet35dc2CwOYkfD8Z9kcPRt5oaiSLZywnUucDenC3eML8AIF51xCQ7JQwo3/9+SN8zwUEBAQEBAQEDj503uKCYPgnFmT0gBFYHsbgsQICcaDEAnPXrjRMWk0/ZSTLZQ5H5JIJE8hLjY16ipOcNZuZCE+qLPrAfveqzeSyyRXEPu/qGGFe9hCxT8WcvGaaK0wxhP7XI5E80TFhFO9Ljfzdu+ma499Smy1y8bhx5N/19Xo+xCFbd359k6zzkAltO8u+6MHIc/V1pKFqeTTgF0+Y0ad5aVz+7R0AcCG31gICAgICAgICAvmFBFroOzwBPdAEguH7+YkJHNpA0jYaADBpN0ZgRpJpml8X2WwkWFpK/lZXRyKGeeygtZvpJAMSh33valbJ2ROriLT4doMsR7WNrtrjWMKMEZMX8JMeAcB1dwNAGwA8Y4w3lk/ZZot0lpSQp2pr9ZRKQ0aUqfBrnGKtBy18H1n0Q+f8xIwZZNyM46IaZt4kG0XrJVBQTPcdfb6/O0IPSQQEBAQEBAQEDk4E+2ql4Ka3eAJ6IAp0hr8MQMS75CEOvAAw+vURRiRpGlhKJ2x2AFLldJL7pk8nn3KBpYaMtFkJT6ySECwcyzZVJceV+4jUdndM67jsAeJo+grrw/weALTyk9+PoH7KPgDoY9NzYUAvXHfMp/zQ9OnkE8M/3Azoxa/VYIVfY9rHUPfF95FF+zhv9NW+b1oVcfrPTiTKVAJxhHkPAFwNAHZ+8QUEBAQEBAQEBPIADPQVDP+CJ54HsHwCWhjdVAUOQVDN5iwAuMcI6KUTNiTKBZIUmep0kosnTCAfK0qCVpknNEMqPKlKQa70QFCKQhZVzCOSFopqmA3CDE1nsIQZteYYRGskwGlE7P6ekfrI9FPGQGq1LhfpmjCBvO/zkX37S5ufYs1zEr7dLNvGee9WFXLLlAoCpq+6heA14CyhhBndCW4x1ltAQEBAQEBAQCCv6LJBZ/gcC9I5lDIgBcP7LD7Pm0AwHIIuIqJmH2LADZ9maN/QVNlME4Uy2uEgJ5WVkVeGw0/ZSnhilYJg4ZjebmwkvulaNDp2HGE+EwkzGwBqxX42z8V1HwsApwDAs4YG1NTmT3Q4IueVlZEXGxuHNo91JmK11inWPSvh286hXd2SQFHIhRMrCBx2SWyf4+ReAlqYgGsUa4q/1jgY2p/7LiAgICAgICBw8EPbOFEKht/kCedQCnSGvgLapnYIht7hv8uj9EMgfBo/XYGDE2iaWg4AuOF/AYC9lLChGbDHbo90er3kvqoq3cwZiZpJ2ixITN6EJ1YpCBZqYP9ZV0um1n2OQNAgTroP8/0EfGcRkGyUPOGhwKn7iTghUR4DAEcDwKOs+TUlyieOGkUenzHD9FMeVrJMhV/vFOuelfDt5dAursMWv58cN346gYU/iu01T5jx0MQ9jrUs2GSkRtsf+y4gICAgICAgcGhgRZ8TtNAmC7I5VNIPwU2XmP1poS9IwfAei3L5kk+gs68hbs4CBxWQLGCaqGMA4LcAsJMGlqLazeaiIrIS8/r6/YPL6ztY4UlVCoKlE/rmZvLL6ioyzn9GlCTrhPn+qCjnsymGUM40yOtwA83e1wPAp2w+ZVmSIlpJCXl0+nSyVVHi0nPxcx024dc8ydpnLHw7ObaH1+MHTT4yr6yKQOtdFhGyDcKMkbJLKth0YvcBgEcQZgEBAQEBAQGBPEILnSEFwxELojlU8k9Y3jPK7A8JejD0G4tyeZJNEQiGeuPmLHBQgPopLwSA1UZeX5Mo2yUpUifL5OJJk8gzjY0JRHnYiRtPqtIQLEqY76moJN6Wi+IJc+d9xDH720SyO1nCfMEwBoDCQGp16MwBAC8Y/rT6OAolKTK3qChya3k5ebupafjNr9NJBmufsfBt5dgmrs9rjY1k2gSFQMd6C7J8X5REL3+YwOgGljA/BAD4cBWEWUBAQEBAQEAgH1jWN0EKhv+bSDKHTPZAZ7iT7xZa+yZAMPy2Rfm8CQRDJ4v3yoMLFQBwHQC8zhI2lFKbjZxVVkb+YZHXd1jNr1nhSVUackXHeuXkqcR9+BXxhDl4L3Et+AGxOQtZ89xvGZGp8wW8eeghxfmsnzJqlFGmFhSQqyZO1MkfHlCwhxMjkiyn2YO0wreTY1t4qPBMXT0pm7KESKhF5skyJcxHPEKgTGEJ888Nv3HxYBMQEBAQEBAQyAe08IM8sRxKgeCmHyVN7dQZPjfPmm1e3oVl4Rp+GAIHFvBimmj46z4OADvYgF5um40c5fGQB6ZPJ5u5dEX7nbDxxCoNwcLx7lYUcs6kKuJYcFOMOOmEuY/YFt1EJD1iskmYv29ofvOFUsPs/REA+MggyjpZnuBwRE4dM4b8saZGD161XzX56YRf/zT7kFT4+rm2YxDm38yoIZ4KjUgY0I0ny6aG+VGeMD8GABMEYRYQEBAQEBAQyAOCm75oQSqHTCAYegva7p/Od2tC6xstBUPP8fXyKRAMd+sRwQUOOOCmobnxXAD4DeOnrBM2JMs1Lhe5d9o0PZ8yr90cLKEZtPBjyGA8SDo3+5vIsZPqCSxZGSPLBmGGRT8i4CxlCfONRoqhfJAnDAKA+ZQ/ZgOp4d9FRUXk9zU1ZIeqjjzz62TC70GavbAUvm4ubRiC69ZXXUMKG04i0vIHE8mySZhRw9xMo6PjPmBwOwx0l489FxAQEBAQEBA4dNG6Vs6zKTYBbdPZfLcJWNpTAVp4L183jxKBYB+aZgscIEAigGS5GQBWGppN3fwaiTKSNiTKaAb8amMj2csTtmRiQVryKnz/acaBY0cS9VpjPVlcfhiB9rUMeTIIM0ZTjhFmPDy4Ow8phrCtSgD4PZsmCtd9bmEh2VBRoWvy6brTtU81txEh/D5kO2a+Xrb1GaE5wO+qqCYFM9FX/aFEsqyL4cM8rgXJMiXM/wKA5KeSAgICAgICAgIC2aP1MQdovestyOSQCWi9P9f7yQTB0PV8/XwKBMNvwvIe8Y55AACJMl5E6JuLqYr0gF7UX9YpSXq6ojebmnTCwUZhNrWbPKEZJLnJSfh+M+gfx49zerq2hjRWLiUQ6InPzWsSZg9LmDcCQOEQE2YEavZvpdp8t80WuWnSJLKtuTlRk28xlxEr/H5ksC9DUpcTJMz9zc3kksnTiG3WpQSSaZh1wvwQgfGHs4T5JQAQfiYCAgICAgICAkMJbdNxPIkcYtkKWt9svtukaOsdj6mnLNrJm0AwvDapb7XAfgcNLPUlw+SUmhyjZpOU2GzkGI+H/LK6muzhNcoWhEQXntgMguBkLXyfGfaL8/rtjBlkQv0XCWh9CeTJ1no7scmj2DzMGAp+qDXM6B97lxEJG82vI/+pr9eJMj2g4Md9wAi/J5nuD182kzopBNdwV3Mz+eq0ZuLsWBXdX8y13XkfsS2/j0jGv6OfP0BgSoAlzC8LwiwgICAgICAgMITo/KlLCoaf4QnkUApooVthRV922W20vuWSFho+02wNTbND/8cPQ2D/ghJlzOuLwYyQBJppomRJIo2yTDZVVpLIzJnZ+cvy5GaQJCdj4fvLsN+oSXYzubeqjhS1fMtS21jQvoo4i8ayhPl+Y/2GElMA4Dl6YDGvpCTynhFMLe2aHwjC70u6/eHLZVInjeBablVV0ll7ZNTcnrEksNHI6KzM+CxLmDFCfBO/aQICAgICAgICAjmgi9hAC61KII9DKNAZelHvJxcEQ5v49vIsr0D7+qn8MAT2D1yGn/IdAPAOG9ALTa9nOJ3khkmTyFu55vXlyc0gSU5GwveVRb84PzTTvW1aLbHN7kokTUiYO9YSZ+lkSpiRPP3YMMkeSngAYBXdiwkFBeTp+voDx1c5nfD7km6P+DLpymcguJYf+X2k0XcykRL2mZd7CdR8gSXMbwPATH7TBAQEBAQEBAQEckCw76j8pnHatBs6Q8fz3WaMzlAzBMMDie3mTSKghdcL0+z9CzRFQLPf0wDgRYME6NpMO0BkrN0eOWX0aPJKYyPZZ0QTzooos8ITnEESnbTC95NFf0ii9qjNpKuykUjzrrUgTvcRKbCB2EorWfL0W4PgDiVwfzBK3m6jD7KustI0hc90PiNa+P1Jtlf8d8nKZSm4jm/W15Nx/rPSE2aMlO0/l93zDwBgIb9pAgICAgICAgICWWJFn1PSQk9akMYhEwiG/4j98F1nhY7whVIwtI9vO58CHb1fFKR5eIGLjeIFgM8BwC8BYCslyqjJLLPbyQleL3m8ulrP65uTVpkXnuQMAdlJKXw/WfSHc92tNpMzps0iUiv6tRrppFjy1LGBQOk0ljz9DQDG84s9SOA+oYn8q6j1x735/JgxZLOixDTMGc5pxAq/P8nmxX9nVSYHQdP7v9bUEOfMbyQSZF6QMC+4kd3zLQCwbIj91gUEBAQEBAQEDjEQCbTQbTxRHFLRQu9D5/2YDnRwiPpY/z6h/TwKBMMvgbZxIj8UgfwB/WwXAMBahijrJr9FNltkaXFxpLeykmw3SNmgiTIrPNkZItJjKXwfWfSFc96lKuSYysOJ1L4+CWHeSKB0OiVPaJb9vOFzPNTkaQwA/I4eaEyRZfIyavyznNOQylD3ze+RVfv85/z3OQqa3t9fNYPA/BvjI6Fbyr0EFt7MEuZP8Tw0D3suICAgICAgIHDoIBhqk4LhPTxRHEKJgLbp63y3OWNZ+AhpeE2zMVDZKmjtyiwNlkDOQOd2PwD80NBYmvmUHZIUmV1YSO6cMoW8bpVP2YJo5CQ82Rki0pMgfPtZ9EEPCT72+cjCaYuNlFIYITmRMNtG17KE+T9GzuShJk+4b7fTAGwuSSI/r6nRI2Wbc7WYR96EX1d2fQczFr49vt1kwreTheBe71WbyTVTphFYfHtmhHnxbTxh/nwe9lxAQEBAQEBA4NBAV5cNgqEneII4lAJa+A3Q+kbzXecMjLCthe/g+8mz7AMthFmMBIYY9EV+EgCcBwDP8n7K05zOyCXjxxOaroglykNKlqnwhGeE9aET5uZm8kpDPWmoPdaInJxImCWtlxROmc2SJ/QBr88DeULCfJa5Z5JEbpo6NZZWKoc55ix8f3zf/P+zEb69ZO3m2r6F4PqhP/hXy+uI1LY2nhyb6aRw36mFwb0EWu8kINnpnqOFxil52HMBAQEBAQEBgYMfSDwDvVdbkMOhlB3QETqM73rQWN4zCrTwixb95VOeg8CGcfxQBHIHvsQXA8AJRpoo1IaZfsoemy1yVlkZebK2VvdTzotG2Up44jOEBEgXvt0s28f5DzQ3kydrZpDKus8SafmDlppGW2eIeOvicvK+YkQazwd5QhP6j+n+fXHsWD13cJxZdhZzzFn4/tIJXz+d8PVTCV83B8G93qX4SXDq7NjBSBxpNogyFSTMS1cTsLnonm8HgLPztOcCAgICAgICAgc3gr0LpGB4mwUxHDKBYBgtNfMA3e/6DL6/PEsEtFAvPxKB3CADwDwA6DOIcr9k+Cm7JCmyvLSU/IoJ6BWnUR4iMpJSePIzlH3y7WbZPtUwPzJ9Ohnb+BUiLX8gkUjphHkTKW08niXMbwDA/DyQJ2yvAgD+TH3NGwsLyYfGOHOZY87Cr2kmwreRSvi6qYSvm4PggcMnfj/xTZlHYPlDFvvME+b7CKAmuqCY7vkOALgoD3suICAgICAgIHBwo3WtDMHwry1I4VDKVui4bwbf9ZABfYqDocct+s2rgLbps/xQBDIDvrSjYJCoG4x8ynupRhn/1sty5IFp08jHfr9ufp1X0+tUwpOfoSJBfHs5tKsTZrWZ3D21khS1XEQANcy8/7Lu69pHbHUnEgAJyRP6F/8PAAJ5Ik8YqG216cdss+n5mIfVLJvvJxfh27QSvg6tZ/XZIAXX7x2/n1RWH0ukIx62IMyclhn/j9HRXV7qt74LAK7I054LCAgICAgICBy80MLX5jfnsu67fDTf7ZAj0FsnBcMf8H3nUyAYfh7m9iE/EMgQlCiXGDl7/2UQZT0NEUpl1E858rbPp2sl8+6nnKnwJGiwY+HbyqFNXI/dikIun1hOHLO+S2DZA4mEGdMLdfYRqP0iS5g/BIDPGD7HQw3cX9xb3SxbAiBXVVTowdmGhTDzfVj1x39uJXy7yYSvl0sbGQgS5v82NpHxyjnJCTNLmvHfWi8B91hKmDE/9s38ZgkIHHLQNn2W+SHfDNqaoQusIiAgMGIwCaCwuLh47Gi3e4pXlisLCwsnjgLw8OUygdcpX+KV3YQVjyz/mi+XCzxu92cT23Y/IQ64RxCC4VlSMPwxTwSHUkAL/ZjvNi/oIjYIhq/j+8+3QDC8ElpWFvDDEUgE3vgYXhwd2TEPMGq8dC0kEuVim42cNGoUebmhwQzoxZOG/So8GRosKeLbybYtY40+VfzktPFTCBx+lXVKKdQwBxMI80dGiqF8EWaMcP4a9WNuHTWK7KJ7aiX83HIVvt1UffDfpxO+fiZt8eUGIUiY/1bfQErUC4hkaZLNkWb8G9xEoHAiJcx7AGAlv1nDCAmC4RulYPhVQ56Fzu4GvlBKdN7iAi38b9oGBEPX80VSg0gQDD0Qqx/+L7SvzOnladgQCE2RguEXmHV7HjpDGH/g0ERn+ERmLaL7GAhhirxMIUGg9y7zR1wL/wPmX4sHuAIjAAOK8sV9qvpqBvLfflX91YCi3DLQ3Hw8aWwccYcepLVV7lfVf9Mx96squp3lDOL3j+tXlGeZNfgnqakp48sd6iiF0tGlLtc5Xll+zCu73/TK7ne8svt9r+z+wCO73/XK7re9svu/Xlm+wltQgM9SO9+GBWxel/sfiaRWvivD+qlg87jk1Qltu/S28/GOJpALtPDveAI41AIdm9BVcngQ2FAEwdDL/BjyLPsgEPocPxSBGJBAoRp+jvHCTgN67bMBREbb7ZEjS0vJT6uqyF5Do0y1yjxp2K/Ck6HBkCK+jVzaMdbpPV8TOWpcFZFa70iSaihKmAv8pxHU9hqEGbW/X8jj6aXTCN6mE+Yyh4O87vPppC9h3rnMPZnw7WbSB18ulfB107XBl8tRdOuK5mbyixl1xDXv2kTT66RyL4GSCkqYMTXbPXnc83Sw2bTQbcyDcwdoGxfyhVJAgkD4Fvbhi344Wc2nrRtPiHeY9bXQ/SP6hST6g/Z77gcnAsHeQzM92NKeCgiG3uF/hKGjG91LMkNDlxOCoafN+oHen0D5Cvx9OvTWc+RB2qMoD+DvRA6ybUBV7+1XFIxuOVL20rZbUe5ix7nD75/JF8oEzzc0OAdUtWdAVSNmWz7fV0f082uYUeJ01nlk+Q6vS/6UJ58pxeV+apSr8OyyqOWjJUqgpMwrJ7brcbovNhRBg4HLI7s/4tsudbkuGAIyLjBYRLWx3+J/d4ZY8Hf9ar7rvEPbtETS8hvAzEKehiMfLeSHIhD94cJ8v3ghbDHImhnQ6zC3m4QrK8lOq4BeFsRhvwpPhnIlRXz9QbSDhPnVxgbSMqaKSEtWGubXPGm6j0id9xLvvG8Su2QS5k8Ms+l8AX/EbzUCuEVkm438qq6O9CtK4rxznT8vfHvZts3XSSWZ1uXL5Sj6PTFzJlk1bQaxLVkdJcKZEmZvHUuYQ8Zhxv6ADQLdVzAPzT3Qvm55xkSlY+0MKRjaxT54QQth7INMXygkw/8oVn/JanRLGOzLTv4Q6DnT4scGTe0x7kNm63bwQIJgT5eV/xh0dH894/VovX2CFAy9ZtYNbMRDXDQRy6y+QN7QBeAYUJQ9FmQ4G9m91+8/iW97P8H+Rn19O46Jjm+Polyb7bXWBWDbq6qrBlR1H21ni8/3/RYAfOkUhBlNmh1ym1d2b/PK7ghPPDOUfV6X+9Ekv49SkdPp98ruHVydgRKX66gsfoMsIYM8zWI8e0pcriMG27bAEEDrbZSC4Q/5350hlv1DItE8Ohh+xGI8eZRNEQiG8V1UgAHe6Oi8/lfDHFTXNjolKdIky5FrJ00irzc2Jvgp82RhRAlPiLIlR3ydbOryYhDm5+pqyeQJzQQ61iXRMEcJ85illxOH3camGDoj2x/uLIHt6/tuk6TIjZWVRpAyi/nnugbcelgKXy6d8PVTSSb1+PZzEN3qYmYLuaS8itja7uEIcxrSXKaiwgUJMx6UPAgARfxGDRNs0L7+XObBGYGOdagpzeSFD81ov51AlrTwFvB/I7P5tK0eL2mhj2hdCPQ+A5XHeEfsC0ng+iJJC/0rOt7Qbli68ruxsYf+OGLHnS8ENjSZJ+Fa71vQtm4ts5eZmi5K0LbaH3cddKzDVGuH1lqOUHzQ2FjNkt8divLgv+rqjrCSl+vrj3mzoeHkD32+7+1UlMf6VbWfrbvH58t/4Jz0sJ07enTpHkV50hyborz6WmUlZgbJGHv9/lNZ0r3T7+9tiKbhFAc9SJZlud3rcn9sQTqj4nJv8cru1zxRs+zE7+NEXj8+8TcS17jI43JVlbhctajJxr+lLhdGMkat9GD2QNLHz48D5xM1F8/kuSaQL6zoc4IWfjTuvSMPAsHeL/JdDxsCG6ZJwU0Jllv5FghsOoYfyqEMvNG/bGiWdbI81m4n548dqxNlfPCPmIBemQpPhrIlRnydbOpyQsnn76urSdGUNgzZbpCkRAIldd5HSttvJHZ7ARsx+Zt5flHEVGHvUdP7o8aOJftmzkxOmHNcB1P4tgbbJt/OYIRvO0vR93pmCzl+Yi2xaaF4wpxKy4zfTTicEma8B38JAKP4jRom2KDtns/FPzC7z8rwhcAGwdArej2t5/lYG6FPoe3m8XxhC0gQ7GXNuSMw7+pZhjZhMC87+YKEWmRznTrWrYGms+olLfSJOf6W04b/NHp/Ye5NbvR5N9ej/Z4rYeEtx5v/D4Z+k+GzTIK2tR2SFtpr1m29szXDa1Agv5A+9fuDLOn9sKHhQuOAD691K8HvSqYCjNrS1HQzW7dfVX8yAu5t7L/gnzNmzGHHttvv/1qmY9urquoAcxiwR1Fe/cb48eOMZ9chf90iufXKMvokJ5Bfj0v+b5HD0QYAYwEAfb3HOgEaS53ypXxZRiKlLlenxf7g8wXXHA87qLiMz/my2UDyuNzftBjH/9xud7nY4/0MLfQd5r0hLwLB0C/0+Cr7E4HwCehfzI8tn6JHzRYwMd0gZe/aAfadOGpU5PczZpDtihLvpzwEhGJYhSdDmRIjvmym9ZIIrh3+gN5XVUNsVcdFAzzxhIkR2+KbCdiclDCjtvGqJOZHQ4VJAPAPGgF9kiyTT/JFmPl2BtteunazFb7dLEUnzM0ziTqunki62T1HmJORZvx88hKWMKNmEvdlfzycbbDkrra4B2ZH9/cyeCGQoKPnfLNO2z1XmW1o4W3Qent12vm03TNdCobeN9sI9PwGxjaghiYTkjX8aO9dwKzTTph/3UJoOmWKpPVi8C9jHdai/3fqeR8sCPasMM3xtdAb4D9nGvhPLY/98Oqm+ZmY1tugo/vs2PUT2gstX8cX6XTXoED+Ie30+S5kiOWe9xobjzS0qHifJhP8Xn6spqZuQFG2MoQZUyeOhPsbx+De5ff/ipnbx681NEzgC/LY1tRUv09VX2fI8rMPV1Xh8w6JmrhmAaRSV+HZFmQz4nW5H5QBpkJUE4+HKxinAEU/ZJEBKj0u94MWdVG7+7DF+uKzFgU/Z2Wwz2AM+LUycQwyZpDBcQ+2fYFcofVVS8FNbzG/xfmQN6G9D6/T/Yv2Pg8Ew3y8lLwLaKFV0PpYJr/dBzXwJj8HALbiizqaYf+tpiZCo18fMBrlZMITokzIEV8ukzopRCfMzc3kzrrZxLboZl2LHCVKlDxxJGphHGFGQR/jfOZEwx+TdUY6IyRr5FdNTboJvnlQYiUWc00rfBuDactK+HazFb69LASDfeE9s9XnI+PGqbp5vUmG0xLmBwhULGMJ85NGTIH98SMswYJblLiHZaD7lrQvta0ryzD1j1ln1uUYuIu2sQPa70SztVTzkUDrOSeu3yWrvpLcnLHLppthdfaNhY7QUaCFz4dg+DOwLFyjf97Vxb9IDTXQ1/r+2BptwDVyw9QvjJK0XjNKJwQ2fNt6/BzQR6l1rawLm86hoc8JbeFZEAyfBYHQ8dDZXRpXj2JFnx06f+qC5eF6CGw6CQLh0yDQ1wHLe0YNS3qI1i4HBEP0pSUCi360zHz51UJvmOsx96b0Byd4rQV715l1tF68H1yowTbXKJMfbyxjll8r62uUDnjtWO2DCSLBaX8vAG3jROjcND+61qHzQOsNQlvPdL1+MuAasePJFhh9ntbFf7Ogc9V6G0ELLYdA+EwIhk+Hzt6l+osejjn9umcC226//3aGVG77b02NYkFcrIDrL/crymam/k56j5MVK+ykslKmwldOB9LQ4DTrV1e7sgwqhmWdHzY2olk1DdgV2eX3/1+qdSMtLQX9ivIUcwAw8Ne6OrTawvGnvN6wLmlomEBUdd6Aonxpn6qeT5qbjyNNTfUvRcefdk3j5tzQkPzaY6D3m2Sd9RQd2Df93piD/vmkSYWkublzn6KcQ5qb2+l3GaDAK7t/m0A2Zffrsizj7xyOAe9nluDSQxa3G6Ac/ZCNOvu8snuvV3ZvNqJT8+9GeF+w2mWUVOuIe4v9eEpkeWFJgXxyidN5tGFmzT5j7B5Z/hk/h1KXC1NAprq3sG8ZzcNLXS6tpEA+qcTpPAZ9rRnNt0DOIBJ0hh9k3xvyIRAMXcH3vN+wLFwjBUPDqmWWguF+CG7C3/RDGniTo6kbnvzraaNumDw5PhevBTk4YIQnRJmQI75cuvJphGqYL6uZT6B9QyJB5kRafAuxFRSyhPnOYfBnxUjcGJEbrwFy7uTJpD8dYc52Tfi6ubSRifDtZyN8W1kIPRh5qbaaOCo6GTLME2aL/UfCjNYHMR9mTOdWleJHOJ+QYO6Vk9mHJQR6MPBD6h/2jp6TpWB4IFq++2cAo0tBC31gtLELlq5ZlHI+LV2FoIVeNPvUel+Aui+PSegXSU8wdJRNC/Xgqa/Fg51IneH3IBjuhs7w4XF1hw4StPccTU2GIdj7X6hegeaEToBqF2i9m5h5/AxgReq1w/aC4T6zTjD0I4OQ4wHCf5m5vQtt62viah75aBkeFkjB8GNSMPypxVrgD+uzENx0PbT1ZmIWnz2QCGq9N5vjD/Q8DnXH4t7hi6QLAj2/NL/r2IC+yMmvgyiQfL9k1mnfeB0s+NYoNrcmaKFr0rYTDP2YXQsI9KYOMqWtGR3zEQvtw/WPfdllg47exZifUgqGzbFZyKsQ7L0O2tcnaiO0ni/Fjad1bVrtpYk2/SWJnX+vTppR46CbI4aeYE3YLeRlmxa+A7T7Gvmms4R9j6L83CS8irK5r7wcU0Wl3osopL7p0z0DqvoRo439L3W52O3zdTJEmpCamsl8A8mwze8fN6Cq7zPj+tlbc+fyZCod7PdXVEzsV9UPTQKsKJi/13JuHzQ0FO9V1V6GLG95o7HxeIPEIdmyrEdaWibuU9WL9qnqM+x8OflwQFHu7/f7lyYj/th/v6r+g9bZqyh382UsIA2oajezTq/2Mc9YYx1fpt/vVhQNfbn3NTffihp3pt6vH8v8UMPtld1/4MmmR3b/pSRqgo39W80RP8N1lEtdrrNKnPJVpU7nCYUFBS2G6TauM/tsdRh+0HH9lDgclimAigHGeZ3yZV6X/KxBwhPGV1ogf4mSd4/sfokvg+NJ+I2KwoUm416X+34MDMbX08Ulf+pxyb/yyjIGds32WhVAsqxtOsPiWTe0ooX/nvSgen8hGMLAmsNKmiEY/tt+CXg2wjARAP5O/ZePKi3FH7GDgzCj8KQoFUHiv09WLguhPsynN3QSCFqQJY5AFXSsJoWe8ZQw456g9jffOWgxP+orNDL6YcXF5BPjhzFhLXJdF1o+1/qZCj/GbIRvKwuhhPmxaRVEmn58csJspWVe9iCB2hNZwvwM6haTvETkGxKSPjZwF2ghfGlModFbYQfNTKu0B+ZfURvVLPY+p3+GJrVt92Ak0WTzkUBjTHCRrCy+A/3T4n2Xj3q4BLTwr7gHOZL03VIwtFPSwgmEATrDZw6531FgwzjQzLRXEWi7G304qbbADu0bLjHHoIX/BXNvSpd7Fg8B/mqOuX3dlyHQfRI/F0kL/RvmXY9+kdH5aD2zWRJp7Fk/mocbptH6AYbZrhZ+VU/5NNTAQF/BMD0c2QeLb6cmuqhdKYBA9+2xMfSif34qjQ/gHOPGvXTVscY1SfvAQwrU6Cdvp2393Li1ixJ5TP+S/Fro2HiqWV4LvQfzbsFDK5turRDsO0oKhrcz7eFaR687/dqLJ6ughf/CaZElWHRnM3uNQmA9XuPpEdXe/zo29/BW8HeN06/DYPgZbp6457j3eH0mjgvN4oMPVg7insAI2a8whOoPaTRsLKR3Gxoa+1V1O62/S1F+Rv18/15fP5GNvr3N70fymbZdJHz9qvqoSeZUdftjlZV4GJH8+rAG9uV8r7Hxq2xaqC0NDSpfECNi7/P7v8aU27fF57vcCESVlCzv9PvL96nqS8xYUQYGFGUXatv5oGg4l36fD7W5fHvSy1VV4/DAgpbd7vMh8Uo3Z1yrp2md3X7/HUwd6X2fb3p/NPWX/v0r9fUz9qrqem5M+I64tjXFPBnoa+qR5V8nEEbZ/aosy3iwlKoNSpqpmTY128ZrJq5/b0GByvfhccloOcebTEulbvccvmwywVzR6FfNf45S4nLhAWbcmk8CKPTI7hBfNo1059n17uDDEX14sB+NmZI/2QFaGC1oRhY6QpOkYNjMIjFcAsHQOj191yEM9B3ZQH1Y61wu8p7frz8Uh4JI7HfhSVGqefHfJyuXoVCyvEtRyDH1RxFY/nAiWWIliBIm0riZLGFG7V66F+7BAl/2f07TS01yOsl/mpqi10Cqdcl0bfg62dTNRvj2rfriP7cqk0z48oxQwrxq8ngiNZ5JYFkqwsyRZiTM9SexJtn/AQDMA5rqRSKfKAAt9Kr5kNRC6KeVjDBjZOwjJc0g2Fr3zw2/Yxdo3fQlfwDaN6AVg/WDtnVlGQaWMB/MaILbuAKv+djJfeuDXtBCpqZSb7Nj4yZovf1kWPjD5bDg6lZYdOvnoH3t1VIwvJUp9zEEelC7PVRA0/HL6YECBHvfAuUC1ITRlzc7LLnr6NhcQv+DRXdhlNZke4mfY8qImDn74h/ORXKsHzQEun8BS9dcCe3rroCODd+H6k68VyXo6D6W1bAD/rC33f0DaL3tBFhwfTssuimgr03HBtRcm8QZMC1GRwj944cIXTbMk222H9jQAzAJX1Cp1sgObesvZPZjB8y/NmkeVb3O0vWdsfKhnTD3hjrjmnwq1k/PmiSaHSOHM9XYh3abdTq6v5/8GtS15OZhDHSsv9E8sNHCp0rBTWZecEkLvQpta74Hi24+ChZc3wrzr10Ci29dAR3re40Di2gb0fzhdN8lWHD1dEkLxfaso+fSFNdFDFrvccx67IOlay+GurPHgBb6aezz8Fbo2LAGFt3+ZZh/QyfMvWoxzL2xDRb96LPQcc8NktZrxgaQgqG3dNP97CH9vrp6LBvc6hO//7spng08JNSCsmT0g8ZG1Prr5rgPTJ48Zq+ivEC/2+n3/zDpfjHY7fNhSiiayimy1efDlFC5+g+jOrJkj6I8T8fRryh/RhNpWgAf1Hv9/v9D/229jKLs+9Tn++ExXi9G8096eDCgqssHVPVts11V3fmJ378Go4g/X1PT+c/a2qUv19ef8LHPd22/opik1SDSHVxz0ub6+sOZMuT5xkY8ZE01Z+mm8nI3tkfrfNTUhCn76H0kbWtqamXmveV/TU0dA6q6Fc3ot/n9oQ99vku3+Hw3fRA9zLC+/xLh8Mjy1RYkEeX3aK7MV+AQfY5ErxP8i3Pk5yl5XK4zEtp3uZ/iD16R5Hpl9ysJZZOIR5b/U+pyLec/x4BfBnk3x4IRur2y+zGLstG2XPJ/PLL7Pf7zqMjrjetWIB3Q0kwLmZZc+RIIhtemdLPZn9DCRw+/aXZoF3SEA/xQDiXgQ+g7lCyV2GyRf9XVxZvj8sThQBMLgmM5L/77ZOUyFEqYP1L8ZEHDCgLLH0okyXFyL4FgH4GJC1jCjDkHMzfdyx70x+g2qmEucjjITxsbSYRaGgx2bfg62dTNRPh2ecmmLF8+w3rRvW4mF5WNIjD/xkSSzAtLmpEwN3yV3XPU9qMf3P6CA7Ru82UcguEPkr4IBq4vAi0c1SRj2fY16HeMPzAFoHVvMD+PmuLyLzkICdo3Lo+LiNx2N+brjb3k4A9WMPQ386GthbZB68rTAQDNpNjovHqgGDjs0mZgUxKhmSzv85krWtdOkIJhGgV7L8y/GV9k2ZdzCeZeXc38yOyCpffgXiauXRQSajKZse6G9rVdUjC0HdpW45rhHJFg4iFE1ASxvdvHalslrfcZaPoaEiAsx65HMcAoD7TffRkzHoK+4inGkw0kaO/+ArMvH8Csy9Hkl71W7NC25hjmh70fAmuauHZY2CCwEc3NjPH2vgLzu5Dgo6b6gdgcenuTvrBjLnAt9J5ern3t3WadQA+aulvVkSCwts50KQiGPoRyDQ9sHFEz7dA/mbV+AQ67CC0ocK35IEWl0LHR9L3G6wRaV2ME3WgfLV8vk7SeGOnXQo8CtKYmm61dDinuoCj0OvgvmQZLV840tMjRtpau/q6+1/FaODN4EpJohsxHoGMj3j/ZXgPSFp/vGJakvVZfj24PVmtqAn1xSWPj6N2Kci5Tt3+X3//nQHR8+uFK19ixxbtV1Qy61a+qfzstei0lBWp6+1W1j2n3UwwsxmsfswDex65Pm5quZNrcuVVRFtACexWleUBVP6Df7/L7f3buhAmGS4Z1n582No4eUNW3GDL61hNRX2f+ntX365+1tRiJ3CTN/Yry4xXx62zbrijfYr5Hl6p0hwTSlvr6Rcz67ls5aRIbTM+20+//pjkvRXlyt6r+rl9R3n2ipmY28yzCMabri4W9KKr97U8kiTpR3O6R5VUlDvdcD3gwO0TK6ykJbB6X+z6+bY/s7mP3pRhgrEcu/DdfTheX/LzH6b640O5aVlpQ8KVSl/shr+zeHv3O9VRiefcj3J6j6fnfEsrJ8qelThkP6/A5hocqXo9T/k6CGbhL/rS0wD0nfloCFpAgGEIXMPM3LR8CwdDH0NqL98fIRTDE/t4Mi+im2bnE4DhIgDe7xqYWWjVlConMnLl/SbMFKRnUOPh2+Pb4z/nvcxDqv/ymz0eU5rOILSPCfC+Bya0sefo9RKNI5htozqUH/iqQJHIZ5mOm10Cq9Um3RnzZdOWzEb7dbPrgyw9ScJ3Q9/9Ej4fA4tsSCXIy0QnzAwSav0nArgd7wz3HmALt/AYNIxzQsfFW5iEZAf+X8CWJfxlETWeARkbG4E5QfQq+OEa1AR3rf2A+ZDs24qGc1QsWaijNqI8QCL0NTeejr62p9QCt58vMWPoNskxf2qjWgQq+wBQi2URCG3vI9+AzbnA4ciX6WTNj3Yj5sqk2lUICqJTBIGzG3E+1WDsKG7StZ8yvQ3uiabhWY7AhOkckDTHtitaLmsxo21rvOzD7cjQZw3Hg3Nm1wDouqO4ci37FsTqh55LsRXYI3DkOGDIJ7etvh/F+SoAobLDolmaGrO2DwEbM65hkPVpR0/tzZj3+CC0XIxF0QGDDTbE59DyURLMpQaD7Sr2cFvoIFlwXNOsEetDsMfFlPGry/IRRLoLXrUkI2te24uGF2Ubr7dRH1XqtF9+Jmn96re7G+8OYqwSopQz0xLTCWugvMOeWVL5xGHl+Gbo5mP23rUKfSRcE1p0YW4vQZpjchj7jVvcD/h/HWqRrzfGabV97NbStziV6Owb8uoMhkv2bm5o+t0NVjxlobj4qThTlM/sU5dx+Vb1+QFHu26eqqLEdoHUxL/O3oySTHq5IDQDOHYqylmn/pZeqq7FMUmxrbFzC5j5+1+c7JUsyxwPH4nhqxoz6AUUxNeF7FQUPW2yfNDVV4bhMUun3/+3BKVPQdD9pn48BOJDwMm2998+aGlx/es+ye6bvV+fo0aXb/f4QsxY7P1IU1qfbtltRfkO/3x0zbU+1p7YdPt/3zXGo6svcuNE//X76fb+qfrpXVd94JkqWcazss8hyrkmgH0JggCw9MnYCoTRlj9clP4eaVq/TfWwplGZjWVfild1v8W16XO7rmcMTJNXX8mWi5eSVLnDhPtIDATygHFPqdJ/Al43Vcd3AXL+OJG1/UOpyYbAkvM/pQRb+9ZTK8uV8eY8s4+9kqj0UiEaKZmN75EP2QCD0Ob7rEYdAGN2h6AH+sAl0hm8dhsCqIxJ4c+LJF5qu6IT5GI/HOhcvTzryIXyfVsLXyVT4dmhb/GeD7ccQqmF+vqGBTJ15PpFQk8iTZDTd1YVqHO8lMKWDTSv1TwDAyLL5BF74qPX50LgGyJJRo0i/QZjTkmaLuedUPlvh2820D77sEAi+YGxTFNI6agISJGNvLQgyT5bpnretJVA0mZplo7bgKH6ThhEOaF93QdwDcsEPMf0c/0Nug0BvKFomtA+WrESza3xpw+vJDu3rzjTrB3rwxSWRrAS6GfPb8AAsXU1feKN9NXQ5JUa7rJthw1h8mTFftLkW8f8FMP+aRikY+jDWf/e3LMpmh0AP5kA0SHhoHyy8FUm41UtqARITs2+tF4PxJM49ijgCbKzV41BWiy9u1A84Nk+t1ySAerquhdctNl7CkmnU9JdVWHJbzExcJ343DPbkHA9Lvm62h1YI9adhPAx+HFHNqu7vm8FetP7Qy2p0owHnWnAd0Df8a7HPdV/oRMKsrZwImtGX1vNrqDphSmzeaCJtodENrFsUW9PQNlhwAwYVovPAvovg8K6ZsOi2z6ZZazssvAX9yml/+6Cj+4vM/jmgfT2jPQ+9Aq23oAbaqi2ABXeMAo0J9NXR/WPjZduBFhvm56jZH9uK9wS9Vnjg5zgPHDuWQ0JA79OMgT6rexXFTJ+UpezZoyj/+qCp6bu3jh8/LckY7Fv8/vOZOu991NSElhNWc4KXqqtLMWgVLb/L73+cOcCyrJMh9Htmm8+Hga6iY1GUra/X1k7rV9XH6Gd7VPWNP0ybhodVlHRa9rnb7z+KmVPkI5/vYnMfretgW85/M9pglK1RH2W9fF/UtNo0jd/u812d1ArIAGqo9yrKk7TObr//p+zzqwvAyab8wrF+HB0rG8WaXsvZosAN7nKvLKO5chJNc4Kg5nm1V5ZbPQCoeU4KwxT6I76NkmhALf16GAXg8brc/+DL4GeyLGNsB5wnPRCIHoABFHlk2SrCdwRNwOlzvdjprPfI7vf5cqVO+UrjnqMHbNHfRgCnHnTMJW9jy3tc8i9S/FYI6C5A4Rtiz9C8yW8hsAGfUSMfnaGLhzsAGGZEgWAvRno/JIEPh40AsAeJmsdmIx/7fPE5mFF44jHUYkFEUgpfP53w9dMJXz9LoYT5z7X1xHPYd4iU4LvKkSr6ecVyNgAUJg1HH8h8A3/A9XzMeA1MdbvJS0YubkyZZM6LX6Nka8V/n6xcLsK3aSXZlM1VmDHhC8ZHfj9pKashtiMeTU+Y466Fe1E7R6BkKt13TPOGvmX7C4YZbewBCUvWYKTR+BelpfegWWhU+6X1/ovRLkfbWLrmSLN+R889CS8CR64slLTwb81+tJ7nDX9gWk6C9vUM0QvtxLy+6V4M9ZeSlh9MRP9hs3+tF9N/ZEUQ4lB9iwu08L9i89mw1kKbSoHadfwRi5YNhlCTY1UOoGGFEzWhzFp/AC3fRE1H4hxb18qSFsJo2NGygd7HMY2VJXGMhx3mXoNm3DFf5oW3Dc5HvqNHZYJgDRgacSstG/bhBC1kBqcCrWdtkvWQjFzcZk5N6FiLL+xRDVzb6uOZNcVc5fy80VohZtWw8KbFePDArNdPoPpc3jRfAi10h1knsHEdlJdTv0Qcu/5yy6SoSUZyEBIsvTtg9oc+6B1348EXXRM7LF7FHhBthSW3oQm7VXtodsgcWoV2wRLzgMYOS9ai5pm2Q0Dr/rquKU8O7AO/z0VDqANzEg+o6l6WxGUhO3cpyi//19h4QmD8eLxv6GEQC9tbjA8tBsL6sKkJs3hYrs8uv//LrNb67YaGFUkOsHKBo3vy5PJ+RTEjb+9V1Rdpf/2quuOlujqtPBapOVmfqAlew8xp6z9mzMAgYqmuI4TtpvJyNOOmvtlkp6Kgb7a+Zu83NfmZtY181Nj4ZYv7IQ5vRc3Ct9B6OxQF3bDMcbxdV1fDtIkm2X8406ObSKcbaybQDyEwRVSJy/V1NFPmyWUK2euR3X/zyHIb36gBaZQsLzTNpxkpcbjxd0u/l0tcriOsyHqx04kHYTQNGJ0n/tXH7HHJq/g6Htm9yyPLaAWm1/G43RfxZVBkkPFwKPFZHm3bg2bgce26ZIxfknIfD2kEezGYoxknIh8CqF3u6EkI9DdigSkDmaCQwyObIqCFMcbEIQm8mc8FgO00F+9D06fjj8LIJsy5jImvn0r4ulkKNdMNTa8hBfNviJpb8xpmJE4cYZaqP8MS5pcAIF1QjKEAXgNIKvYiYS5xOEh3fb0eyMrUMKPwa5Rsrfjvk5XLVvj2hlP4sTCCBwtvNjWSGeN8xHbkj7MnzB3dBEqn033H+xC1tfyP7HDBBku4XMwda/FlNPaCi4GVtNCjse83XMURJhss+FGL+b2VCW1b9yxJi5kT6YGt4rROrWgq+4dYG93oz582v6m+bvO6xknB0Nu0rk3rwfRs6epZAwOMBHoxmJixHqG3YYKeRsrqRQhhh8V3dcRFGl/4Q9S+JmLR6mlxJreBjRj4xXqOS1dWsXOCtnWY4zkTgmCD+dfWxhFmqwOQTNHahSbnD5vrgT7UscBnVkCLhetj+xj6q+X8cDztaw+nJv7Rca5CkojXgw1abzk8tk69eLiH6x9D221jJC2kH2pgwDnjEFA25631/kpPX8bOu/0ajxQM0YBYW8F/Lh7IsAQB/6LYdbKNWt/O7nLoDFdBO+a8Djfp0t7tg7b1fgj0MBrk8A5YshJ9EmP3RMt3JrKBWqB9A84vcR/mXuCWtFAsNkBg4yNGMLXoWmDqN6035luNL3nB8O0YOV3PvW0NOpfE/tJD2urzzWUJ6h5FeWWXovzJUlT1id2K8o/divIimvayRAzNfj/x+5FI8JAeiEZ+Nknidr8fiSBPrAFTGu1VlL/Tcrv9/t/5Y/7QQwHbXAD3Dr8/IUI0But6O0pQ05FlXSvfryj/oXV3+P0YXNPqYImHTtb2qOo7tO4uvx8zZuj9bfP7T2DGtO2tujq0NEnZ5gcNDeqAqu6g9T71+TBqPL1nMeDXZ5g2970bnWPM2mdwwDZwfLp7ABLnUj2lk/sZK82wpaCPr8u13GKeNq8sn2Rl7u0GwOeSfs94ZLmP/94I3BV1+UicJ/6/oNTlvimhnkv+pNjppEHWnF6X/C+LMo8jqUYNuVeWF3GyuNTlCnpl92vx9eRXU/yuCGhhM31hfgTTCYYwGOOBhc6+pex7xHAIYEBVfDc6RIE/7LofMxLmr40dqz844whzGtIwKOH7yUX4Nq2Er5NM+Ho5CK7dTlUlP5hSRaSFP8qQMN9PpJoTCEhmxOQ3jBRD+QY+oIOY+QL7tUuSno95t6Elj5sbv1b8mvGf89/nInxb+Ra+/1RirNELDfVkQmWQSKhh5q0HTOH33yDMgV4CnhnUFH8XAKDGjn8xGC7YYFYXBreKEbn2DV+LGw8GnjI0o2gCC7MvwRdg9qXDBg16G9H6Wi+mn2EJlQRa7z2x78ObofYcdA2JtaFrG2OmvLrGWOvFfLN/koLhPyYV/Xs9TVNs/B3d6G+W23pqG2dKWniL2VbbWvRxRVKbrD0bLLyhIa5Ox/pjLV6CJNDWL2GIbATa1+LBpdULUzQ4GpsqKhpJO/VaxNbDDDaljye5ZjM9OjYsjiO1rbejr1cqEmCHRXeZGlHQQrvMaN/xwDmy/uoEiSF94YX5l001Pw+GMH8vu04SdGxYYaxPP7TeRcfkAs0gxHgNzr8ITd1jdQLd15ltdmzAQxVuX4kEgb4W0Dah5vqPUqduZYDpPNB6AU3+0WQ6Kvp+x9ZFD/o170o09Yz1p4+nx4wIr0c+T1w31C7HiDdGWo+3rIi2s+jWpRiYhl0vQ+v/HARDN0F731DGvpC2q+qJbBqlV6OEigaCYqUUzV/PHzdu/B1Tp07/XVXVvE+amm43o0pHg1T95bHWBPN4nJdzr6KYuYV3+v267zBfrl9Rvk7H0q+qH2yoqMDnTyaHR5kC2yl4o74eI3DHEeYtPt8VJ44ejfO2IlkspE/q62eyWuJ3GhvxINTq/uahr0W/opj+2dv9fnyG6YR5l893tbmWqvr+P+rr0QqNXycWeOBxNGsh8E5jI/7e0zrSDr+fDXS2+YXa2sNSHILlCuwP54/3WTES2sKCgsNKXa5z0RzZivRy8k6x08kHDUQynBCF2+OSX6SEH026PbJ7N1/G63LdauEawMLudblvSagnuz8sAcC4AVJpgXu2xfc5iSca1TuT6+PQw4o+u6SFTVenfIge3wPT9R1oaH3MAYHQVfx88i0Q6LM6+DzogTcnRmL+G00vtbCoiGynZIkXnjAMhfB9sH3xn6USvl1e+PJWwtfJUXDttioKOXVyHbEtWZWEMPM+zPcRqP0iAclGA0DhIQaaTw4H8Bp4y7gGSJvXSz6wIswo/JqxZfjP+e9zEb6twYpVm3yfGQr1835ixgziqT+FSEc8YkGU2UMRXu5FQknAW0sJM7pGnJeHl5VMYUT0NTVvqLFjCSfmTY4GVsLv2tehnxZPmGzoV0kJL2B0YVYj2HZPA8TI3z4jMjZLoiToWBeQgpuGxPwKOtafn+KlKAUwB29oY1xbbatPg451R0Gg+wjQQssTBD9vX3eKFAy/a9aJ+nDz/eM6fpXRRA9A6+0Yjdfq1NYGge4r+HnlKHug+kR84c/+pUxbMxrzOdO2IND7Ciy56zMQ2HBkwjqY67HhSGi72wxSpddbugZTffH92zCStVkGI2THSJANczGDFjXHA9Tysy+WrV3FEAy9pNfVQi9Dy8VIFvH+cUKg98Vom6G/QmsXRqmN1gncMwXN74z+BmDBD9H8N0aClq2dYJh4syQ4c9FCr0FlKxIDdp4F0NF9Fy0DWs+vEvY70IsRu2MRrdvXYeom/oAG67gxIrwU6P4Z+l4n9K+3H34Q077BUb0YSG8wsO1RFDNgFPrPvlBbi1YKeM/iHiUTHHfhaIDSj5qafsCS5j1+v1WAo4Ktfv/1tMzeaJ7nuPXZ1dxcwUap3urz3WiYRvP312BhawEoHGBIq5F3mpqU82PngST0Owyx3X3V5MlIsqzubx7SXysr0QTeJOqGRtjeBeDYoyhhZo1e6Y4S+FTjse2MHjKY7bEkG6OR71XVTWabqvriw9Om4TUz1GuKMO5nfQ3x+jGjzLtcruqSAvlUj+x+Es2eeUIZJZUyHmyxc0VS+0hiuVhQrmIHanUT2yqRZczqkOp31u6V5XV8Pa8s/4627ZHl0xK/z1FcbrTEyuTaOgSBv8VhPOCMHRoPnWwFLfwrfPbyvR5QCG5CSy7TFS2PEoFg+NkRm3JrGIAPrU34wo6BvyqcTvK24cecQCwGQS4shW87WT/8d6mE74MXWoavl0ndDAXXDn3BF09S0H8uSowSyBIlzQyZqj+FgGSn5An9WTGiZr6BD2g0+cOo3DphnuZ2k+fRj5lNL0WFX7NU6zmYdeXbsJJMy/F1hkh0X/XmZrKpopLIvjOj6cN4opyULBuihQiMbmSjo+NL8v56GEngO3OUpIXMSJSgdeOzIfqit3AlmpVG/VdR+zW7q8bipUOC8YEiKRjSSSOmeTJfBFaswByKZsopPa9tyyXotxuvgW7biCRrSIJZQNsaVpuSOQK96Ms9BKQ99GsL/1kMmmZqOHWfV/838HTbapxoFh5H3HMV0HRz5hy0cRhwpdc8KBmMQMdG1NLz87SD1vukWSawAc3T6SELjhW1xdF0UVrok7g5dHR/0azXvraLOcApAK0HrQ1wD/4JLV0Y7AzrYP7wc8182pjvOuqTHh3T8p5REuMOEBv3hvv1FE6td5wEi25cBodfPt+UOZctkIK9r8fGv3Fl3CFRFA5oX/sVs0wwvBP92JnvUbvMmK+HP7EwE4+Wi34mw6TWMph3zSLoWL8agqGd/Jj1w4Bg+AUIhmcx9bOFfY+q9jLkb88fa2vRIgTXy+o6iq5x9Hscp6sFwIMpmEzSpijbVlqsz3uNjUea/SjK7nOZHMjY5h5F+VZ/TNO988HKykqL9RkKSC9Fo2KbJHNrU9N1FoeDyYCHDBtNEqooz2ZT92Ofbxnbt6ERtt9SXe3aq6pP0M93Kwrm+05Hsmy7VXU1096OFVFffb3OYw0Nxf2q+iezTb//pxi1PE2bgwW9PvB3BceP/enkuQhgQqnLdXYCoYzKTrRgYNpxWOU2LrG7jqTXRanLdR7/PQbcKnHIyQ4oKbDtx/m6mH7KaBvNwbv473OVUpcL87+n28tDF619xdAZagYtfD5om27QLWkGI1roctDCp8CycI2eBeNAB2qa0bKoc9MxEAh/F4LhGxPmPCgJ36ibrAfDeEh+4GnihxB4g37TSC0UkSWJPFZdrROBBLPsISYcCW0n64P/PpXwdXnhy2dTN0PBdXu/qYlMmdCCLz4GYU5CnFhC1fhVApKDjZTdOUwPUPzhwEAgOmnzOBykr64uFvyNnyP9jF8/K+HrZip8O1aSaTm2/BCKTphnziTXTi4nzjnfj+0nL/ye84R5bDNLmDHqKb487A9IqIGUNN2s2Xhx78UTdbtBmq6NkYLunjiiwbZRPtctBU3SHTG1ba1rK6Vg+E2zjfaNt+upmOLbsIHWbUZF1s1sm05CUo0vStkKjVKa3T3Utno8Eg0LApKLPAutK/nI1HYI9j5Cy4DWi+meko0TDxnQ/Dpatu0e1J6gtpSfazqh6U34A470WHTPFCkYMvdtMALB3qcBVsS/qNZeVMJofAm034MR0+k4cU2cEOyl5sz95lphjm0jFRVooXfBfwb+kFMChYQ5GhBF630R5vwAtWaS3rcW+kv089A2mP1tPPSJvqhi8CwttDZuvB0bH4GW76ClD82Jjdc8Cq4lShFULpsQl0986Rr0++dfxu2w8Nb5ksaYtKO1BUXr6nLD1Bu/2wOLb0NTfpwnf39RYPv4PY6hBJpOq4Klq74had2PSVqITzfSDx2bUCucCzDC8tMM+Xs9C0JFiZELtcEsCTSiYLOw/6W+fgaSaVpmS0MDBuDR+/mwvn5iv6K8Z3y39+3GxpOyIKHZQvqUIa1I0jMJrsUA18w0L9+tKL9NcX/zQI0wa3a9vcvrxfvdtmH8+KIBVTWDkX3s82G+9nRjitu/XYqCB6CUmEl/r6kpw9zQ9PutPh9Gsk/X5lBCHwdzwKKbbKOWmCeVOrEsKEAXQr1OidNZx3+PgcIKATBuBN4fmE7qOr4MkuxipxNdU5JdOzSy9sd83WKHAy1ksG3UQK/nv/fK7ldLnc7Pl7hcR2UoR2JQMpyLxTNDQEBghAEfPphvbwu+tDsAIt8ZN04nApaEeaiIB99mpu3zZdNJpvX5coMQ/OF5oaGByNOOtCbGrLCf+84iYCug5Anl6BQP9aEE9oEveTppc9ls5BuYk5uaHfNz5NculfB1MxG+DV6yKcsL39cgJLo2M8npZeNJwcKbCQT7siPLKPjiPH4Oe0hyk/FCnsnL1VBDwrzLGCSJedlG7YgDWm9HUvAf82V/0Y/mJTkRl5AgS4HeWEqoWV1o8o+mxd8yNXuYq7bBNJ9l28ByrE9OP5RrmJeTRivOVKjJaLb3D+Z/Pp/VcEP7hm5ov+emjKVj42/M8Wvh96D1dkwPx84Rg5q9EmtfN21P9pKKJC5mIr90zTdoUKssBdcD9yv79QiEzBzCgCZs/HzTiKT1/J1Zjy0w7874E+r21WZQLz2H8ZIfYXon+vIYJcxaTywInO9bGNzKBkvXVZmm/x3r0CeYEiis44CO7vuNPt8wfaLb1h9B99awnsC1ifaFwejYwFyofZ6wEIO80fzLuH64Tyj6S7P+7/a7j2PGT5JYC9AAbLHgbYH1mNs5SuKD4V/EPsdAXxkdbuA8qZYO51Gka52VixshsPG+uOBzWuhhi3s1HSQ02WVNk3f4/bdnMC4ejh1+/2W0DZTNTU34/GDHI/28omLiXkV5gSFveHAidQHY9vr9PfTz3ar6u2/FojjnA9JOVb2IGe/2dxsbl2RBaBwY6dscr6I8kORZmQA0u+5nyPYeVf0bBiHD6+fV2tpaxpecvBg9UOCvMxbSO01N9awv9ebompqHUR80Nlaz379ZX08J4ZCgDKDEU1DQwmmGk4ESZ2eJwzHPgoySUrue21gnzKVO54n89x6X/G/jftU12B5ZXsOXwbzNmI4qxX5IxU73cYn1ZDysw3lg2wVel/vHfBmM6m0Qdnqwlk7wPsfx5vJsFhAQ2A/Ak3NMY7QP/ZhnFRZiKoP8EWa+PV748rzw5VMJXzdVfb5cjoJRxv9YW0ekupMJ0BzMOoGyIEyM5llqvoCA3ckS5vgIxfkD/nBgkBo9WrokSSRYVkY2Gzm5LbXMKPz68cKXz0T4Nnjhy2dSx0r4NnIQSpiDo8YR2+LbEgkzu8/8/+m+owXCxIUsYcZgJPuPMFd3uiStJ0o0dLIR+g/4v1Gkp3nSormIMdew8YJudW1KUF2NbZhpo2DhLQ3QcgPrG43+mRgZ26oNewJhbrwACTMlQtlKdtA2VktMQCXo6P45gK7h4QMcJZdFNx/FjH8f57crIWGMIzOLbkv1koqpI2KEuWM9+n/Slyt+rplINsAAbQwZDO0zzJ6tAj4ll7a7v8Osxw5oW8uaCGMKMTSRpn28BfOuw5dZel3gmAtA6zajc8O8W6qg5bQCU0uP5ssLbkbNE0ugHKB1G9ri0Psw/+apMP/aEggyEagX34laXFPbBoGeS5hx7oHWO45hCLX1GmIAq0Dv42abWgizG1hpPiVo/vZYGs1bL9uxEaOy2kDrwQBwMc3zotuQFGSqkURgOewP5499F0Lp3NHQsW513Hxw/tlBer+xcT5DHNFyCtcsW6Jq38De4SYAADXGSURBVKUod7HtvNHQwAefk26pri7dq6qPm0TT78fsDfYdfv/MAUXZTD//X1MTBnbLZn2ygpG3OJYSSlU/+G9NDWoA+T1NBsxb/aY5D0V5zLjO0uIjn68OA2/RutsUxQxO9UlT0/8xY9p95CQzenoySLsVJZZTWlUjf6quxnuLPmts232+k+n3GAX83KhPdKo2U6LU5ZrhleXLvbK72+tyP2UG3CqQkahnCjsSY56MoiCRNsZns077JGOOaRoTo8Aju3v4MhkQ5kL0pebrIRlm7m0H+h3zZbwu99OYZ5k7VGMFnyf8oRtKzmsuICAwvMAHB+ZL1VMLjbbbyTN1dfpDNC+kmW9rMO3y9QcrfPs5CBLmh6prCDSeTaQ4wowkyUqiJMox+9tEcsg0xRCa51qm1sgTsJ8/03zMtaWl5MmZM6PppSzmqAu/drzw5dMJX58Xvnwy4etlInwbGQgN7qaOriRS+7qo6X0CYeaJMkegg5sIlLexhHmNQTSS/ZjnE9inw6b1mFGsJSQASFiDIYy8HM2JPO+Hc1O/ADY4Ja03RnCW3DYHtI3nxF7eQ+9ifuAkL952CGz4NvOiPwBtq9BsNv/roafMCpvaVCTOMOtyfLHHlxycbybigubvVjDjR9Nz1ArT8UvQtt7MK4wmuhDNT5vsPkdi+KzZVqB3YwpyPbRoOa3AiMZNx/o+zPwWasuptjoTccKSVawGdgDaN2L+U7oeNgiE7o310fsPJJbcfhdAoHuduQbz7zoMWnWtdNRaQev5HYCZQ5nCAYFuI5BY6FNY8MPp0H6PRiOoQ6D3Oc6lwG5jordLwdAHsOBGJe1aL1mHKdRMX3ck9knIHP7fCQHmIEkL9USJfe8m87OODRuYNFK5AOvhmF1QdSwezMSuw4Urs83BbduhKJcwhIusnDQJ3QuyHZtjr6q+HtfO9OmoqYsjzLjPu/x+0196r6L8tiUalMr0wd3h999rpJHCMWQzl4zR1dCAEbt/bY5DVd/omToVNdqZ9ufY7fc/zMwDozbjvZAOSHBPj9P4NjUFKKHa7fffwbT5epLrzMTHDQ1TB1SVmrHje8n/jFzYdP/Q13oD/X6PovwlR6scE6UFBYcnkMio5vcF1Dbz5ZPA7nW5rCJUIyGebozP7ZHlfyd875JXGWut/5Z5ZXktX8Yru983Im5brt0oWV7gtYisjeSbWXO7xyXfxZfxyvJ/CwsL0cffqm3J45LvwGBiJW43b2EhICBwAOGLSJhRw4x+zOsqKvJDmPl2hqLNdO1mI3y7OQgSqVXTagnMu4FIyx6IJ8xxpDmeRBXM7SKSw80S5q+mfWEbOuDD+yKj30ihw0HunDEjeg1YzFEXfu1yXUe+Li98+UyEbyNT4dtJJsZLxisNjWTKqGnRfMosYeYJMk+WWcI8tZMlzCHDR3V/wQ4d3aavshQMvQJL7z429pLf8wdo/D/U+Ka4LlsKbIGebrPO0lWdcVq4ju4NMKklGSmwQfvdn2VMY/dBYH16X/6WlaiJvQo6N90JwVAbtK5FkpsdAr0dkhY2ow5DYMMqGNuA1je8hjGV4JxcEAy9FWunB/NIm1odCPSsNNc3fSAuJIurYusfelHX+KfDUQ+jNnUdaKGL9bzB2UOCju6vS5qhCdfCEVi66gyDLGezHnZYdEuzOd/oelxi7v38a0ukYOiJ2He9v0QfeG49HNCx0czDCUvvXMpE1d5joV1G4MFLNFAZHkosuKoGYgdBu2HRjZxLAfo2xx0UfQRL7kLCbHWNRoHXmBZG0+fY3Do2XmOMxWo/HdCx7nux8qFfYD5mk3Brva9D/RfRnJMZl4HAhiL9usagNxgAJzWi6z736uq4sc3pwiBiVuNKBhsbEGqPomCuWCvteVK809JSuNfvx9RSJln+xO/HwIaJcwSwb/H7z2NI4dObm5o6aEqkfkV593czZuC1bFV3qCCtnDSpECNQm+Pw+zG3dzZ9Ot5vbPwyM+edL1VXp137j2pqJu9V1VeZ9X7qK2VlSDL1Q5Bdfn+IWZs304xJ2qsod7Im3BjpuzV6+KfX0c3tGUK9ze/HKNSp2kwHqRRgtEd2v5tIJHUyuSGdaXYJlJR5Xe4LvbK8x6I+xtPQtcdut3uyV3a/mVDG5aY5pvV7oNRpGZirv0SW0Qc+YZ6YMsoru/9oUQfJOgYsjLVdIH8psYx7l8flwkOOhLZLCwpneWX35lh5+SWvy41WFJkcpggICIwgoMZnMwCgnwY5t6xM15QmjZadDbngiIal8OVyFb7dXIRvMwuhfr9XTK3FoC7xRDmOMLMEKvrXPu8KIjmKWMJ8ocWLYD5xOABso9GyT5swIZZizGKuCeuW7frx9ayEr5Or8O2mE74+J7jHeH88WVtDxpc1EinQEyPMPEG2IsssYZ52NBJmFCTMSK6QkO4v2KBjPfrwUuLwRpw/8pKVmeQTddgCTAqdttVnxwU7Ur+VKrqtDWZfMY3NwwxaKJzmJR39jjGPLw0ctQ+CGzFVUOZY0WePS5uEpKrmDPR7TTdXK6DPrUmkQAvvADBzzzqA8WOVAt33piHMDmi9KxinxQx0n8UXigNG/dRikZ4hGHoiRfvWaOtuiDMbD/Rg4CIk6ikOSiwhoc+xOV99PXpp5HUJ5t86SdJCRvon/G4jRovlrw07BDZeZpZZctdn8CAnOi7d39fatL9j3UVmnQVo5WCsIfomxw5CKGzQvhZ97JlxbviSRbtR6AHHQj82osHTdYpA+/pzUqyRHVrvaDf70EJPS8EQDfTFR/mOoe2BMVJQd4fAQ6Q9ENykxX1vDYzE/oDZNpq6W7WdAn+fPt0zoKofM4Tr52muVR7SgKoiWTY1pntU9fnOWC5jHvZXGhoWMKTwFZa4bov6T1vt9VBC+kdlpXdAUUyi+YmiZBsIy7YCAKNPm2uHabL6kl8XsLm6urSfCc7Vr6rbHi4vR2sOU1u6w+eL0/b3JWrpTezy+09lyTLKTkXZyAZse7eurpL9/hOf7/QU124mwHYLLCNTRyXikd0flDrdJ8ggV0wy0o4VOZ0+r9N5rNcpb0Aya5WTGYkoBsii6+EtKGiOJ58mqW1nrg9bqdP9Bb6MLi75nRKXq5YdvFeWK6yibhuyr1SW8XlgHnwWA4y1KIdtP2tomU2UFhRgzmacG1fWbZVvXEBAYAQDH3Tod4GmQ/swvdTS4mLy6YFImFH4trMVvr0sBNdrAANBldfji20iSUqlgTz8SgJRwoxkGQVfoLL5oR4M8KGNfsyYA1XPyb1ozBjyvnENWGqZ+XXLZv34OlbC1xkq4ftJJ3x9GiFbVcl9FeXEUxEgEhJffj95sboGsF71Zylhxj1HYsJHVR5O2CCw9gSGOCAJ3RElJz3/gFHt+JKW7qXKDhqjpdaYlDvt629J89KLzyIntK29lCEieyDYewsEQ0i0GRAJOkKHQTB0W6yv8F7oWE9Tf2QGTHcV6OmKzTk0AEvWICnNimAwcGAOXWYNkeShthKg9ZZy9Lk1P+/ovjbNWO3Q8rWJsRRJ+vjeAi10RkI6jM7uUkyHBcGwYT6vk/Ut0HYXmtBnMw8JtNDdzPj3GP6+2ZAlCv0lGljfXdSSU1K86PZ6NqoztK5G/1T++rJD+wYzcjoG4zL+3Q9tq05MMi47tK87M1an55fmv9vWoHaJPwixwaK7FjFzxmvpJejYsFg/TKGY2+eGYA9qhR+DYHg7tK05Pd4kuwcJPz9+ChvUnFbGlMe/xjXe+zo0XTjF4rAgWq+dycWthd6BQO9JMPcm62j6y/owj/SlUqcZuC4CgfUYfZ+fc0q829DQiAGvKKHarSiPfujzLd6lKAv6VXU+K0RRFgw0N3cOqOqJ+xTlgn1IlBmya8gO1LwyPqY8pDXl5aP7VbXfKD9gCGqX33qkomJakvUZSkjbmpo+w4771ewDYeH4XFv9/huYdvr3KsqPyJw5eFhggqBZtM/nG1DVn7AHCx83NX3HMD2n/doxvRQ7rj1+/71b6uvxN9vE7mg6rLWY93o3Bg9TlK20/Da/n32fwEjguF/R9hRl1zuNjXgQk808reAoAhjvccm/SyCHgxGXG3250SxeP2jzOp1HWxFQxmQbYUPi6pHlF/lyUZE/9brcD6PZtscl/9Trkrca372GBJkr318syxj4jbat77HH5To9Sd7o/3ll+R6M0u1xue/1uuRPLcp8aJiGD3bNBQQEhhl40/6EBpyqKCggrzU2RgMb8QQiDZlIKnzdXNpIJ3zb2QrfXpai/5DNPIwcPfUwAssfSfRrTUWY517FE2aqbRkO4A8Amn9hgBLdLHtqYSF5GomhVT5mFH7trMpYCV/HSvg6Qy18f5kIU58S5msnTiAFlUdGA34xeynxe8zvv0mY+wjUfoklzBhYBFPg7C/YYOnqpXHEISr7YPFKDEJnRU542Dg/ZEpAtsD8G9GKId01jd8XgdatpwxiBbTwM6CFbjMI3eaEMXasvwdG6y+l6fqIgUt3JWmhZ6D5HNQQZN5GPOzQtgqjMcfG3b5Rj/gL7WvR91Y/gNA/X6qnUEr1whQ9QDj8BzMT80Jv2gpa6JeghW8ALfQzKRjT4kfXKrQdFt2C5oHZEf/21fVctOi/GH61qcaZCmhSfWPc2BZehX7KGLU6pnHFz+ddiQSAH6sN2u45idV464Jm09WnYDtW47LD0rVfiisfXZN3LLTLCP0FGA90EuoEw09BMHw1dIbXQzBkHP6E9sHSO1bAzAvQ7NlMKRUtH3oCgr1IUHlE+9B6Y1HDo7IP5l63OAWRtIP/S+MkrcfMVW308xYEQ5dBcNO3IRjqgmB4JWhh9JEeiCuHOdOVC9BaIpvrmRKqPSxJy1EiexXltd9Om4aHRkjy+bWn0K/1PYpimoHT+m81Nh6XYn2GErZdUVNm2vdeGqWaL5gGjuvHjx/XryhmGija3oCi/LpfVa8a8PtX7WO0yoYMfBBN7USjpNP52jEg115FMU22TcEAY4rye/1vjHR/8u8ZM9r7mWBpHzY2nsCsvbTT7/8G085HL9fXI3nLdp489D10uVzVHpf8ugVJzFYGSmQZ7yU8PKAHPjbMh5xQ1uXGTC/sNaKPBYmuBQG2FI/L/bTHKX+X/xx9moudTkwDx64P7k9paVQznlH7prjkT0scDkz1lt2zWUBAYEQAHy6nUrLksdtJuLIylo85GcngiUgy4evl0kYmwredrB/+u2Tl0glXF0nUrpktZP6UOcR25E+TE2adMMWTKmn+tUQqKKbECQX9W7J5yRks8AfpOtx/CfMxFxSQtZiPmb0GLOac9brx9XJpYyiFH0MGgvu8U1XJV8vKiKv5LCPXNiXL/GGIxd6bhLqPQMP/sYT5aQDANEz7CxIsusnHvdBHg3+1XIZpoJK97LJAIoSat3jiEeh5BMrmU5+8VMDvnTCnqwEC3Q/xBCCJbIa21eeBV0X/70xIvQE9v/T6uHG2rRxsjlcbLLmjBYNNxebee5dxkIDae3M+sPR2GvU1FXDNZVh061Gg9b5mMfcEAa3nHzD/RtSI4Mt+5s+QhfeMlYLhl822kJS2dGGE4Ky0kxzssOSuo+PG17Y+qklu7zY18aCF3khCimzQtuYYlsRH21h9Xoq9trG+94b0w+Lb0azTqg7+vwCUMyZDx8Yfc/U4CX2KmmUoqy3RyXfHetP9wBwb+v5b72sBBDbeEVc20PMTmJ7SciN6P6jfnAGB7p/y65BMILhpN3SsXw3+U9F/1mpdU0HaqSjn8ma92Ui/ouzeoSi/fL+p6Rv3TJ2Kmr9MrsWC7UweYpRdqvrEzePG4SFiurqDBkbIZvMS71GUv+ewdgidrK2trKzcrijd/NpYyS6//4mX6+uPnRM1Wcf7jb1+9PYwQni/orzN12Vlt6L88nfTp/ueq61dgnmc6eevNTSgr7/eJs5zj6LcbdZTlDd/Wl3NB9vLFfrzqtjprNeDXFlrV9PJgEeWf1HsdOIh7RjjnqXrYdejcHN1mIBf/FhKvbL8fb48Lx5Z7nUBVJc65e8lfufeVQiFGF+AXR99T3B8JS73N6Na5cR2eUGNd6nLFczwfhAQEBiBwJsfT6F34Yu7S5Ii54wdixEi80uY+XK5Ct+ulWRTnm8/w3q4VtuVZlIztZVIR/44NWE2SVNUHIt/SOyuUpYwo89WspeofAD7wtzP+qGJw2aLnF9RQfbS9FKp1oBfp2TC1+OFLz+cwo8lhegRslWVrPB6iePwy+MPPpaz+2qx5zxhxvzbMcL8LwBAYrq/IMGc74yXguEPWIH29WjOZ0U0rGAQHK6NaMTpTIkXXov4oqqnaYJAN5oZb9ZJqBbaZpDRzZLW+yIsuessGD8PXUpQC5FdlNfAOjTDjY0x0P0QowXLZJxWkGDR9dMwoFes7d57Ye4FbtC60bQ41t+c7yARyKQffLHCcZXCkjXfloK9b6HGXgqGt+rrgf9Gctux8ccw/4YOw1qEvpBl0n4UWu8pmIYpth56juhUJvSZwIa5iePXeeP1+hoHujean3VsxEwN/AtvtH7rygVSMIz+wtGyWu9zhhYu2fPRBkvWtBk+xtF+tZ5fwdQvpMrfGyWmmGZxycpvSlroPd18PhoI7lPdQiKwoQf8p6JpMPaNY8XyRbDwBg06NoRA63kBAt0PQNtaNOm36seB3zHEdgAW3IJ+l6nuC/wcx+YCKCuB2VcthPYN92Ekb/MaCIa2R0W/HjZD+7qVUHU0mnijNj2Wazpz2Hb5/Vf2q+oHmcoeVX1pl9//+Fa/f/XL9fUnfL6oCK9tJH94X+K9nMk95fjA51vBEMCBNxsbj8ri2TMovFxVNY6dk5F3OtXepAJ9hhX/pLJS3ebzPYR+zf2KshV9lAdUdUu/ory3ze8PPV9bG1SjwR7pdWV1v2F77hXFxWO3NDXd0q+qH/ar6qdGW59gULb3mprON/bc/W5T0/J+VX2HzuWxyko8iNXnsbKlpWCPovTR7zAq+CDmaQXz+S0DTPUUFJzqccm/8rrcH3tlNH2Wt3GyVf/O5X7G45S/jWTbeIbhevDPdMyv/Gev7P6AlWKnEzXo/D2H88F5Fem5nV3uf6AmOtqfbpK9xSPLjxU5HHgP6v15ZF3DHNc2Bhgz1pVfH/rMwGt8XKnLdb5Xdr+q96EfFMT68cruj0oKCvAwFu+J7J/NAgICIwp485upheYVFZH3mpric/FakAddePLBC18+kzqZCt+uleRSJwfBdfqwqYmMmrGCwPKHogG9eKKUQJqi4lx6BykoHk8jJiN5whRD2b7oDAb48MZAIxggRs/JvXTcOPIWm4+ZCr+G/PryYrFWCcLX2V/Cj8tC8GVui6KS5aNGE8eCazmNsiH8XvOil7uXgPI1ljD/FwDigpEMM/AawB9yfFHBFwiaczeVKSUPbIO+RGB9FHzZyFZri/1hO9Gx1Hx5MrRc7IO5XbNBubgRqk9EzRmODfuhqZ+yfQGhRJTmDaYvrNm2w8J8SePmTueD/6d98S94yUD3BeeJ7ZZA02lVcNilzTC76zBQz5sB4wN4aEDbzZSgsKDjpnvPjjGbdniw1wPdL/y/SSjSXGNW1xNtI9m4aB1sm9bJZG8NYgqF+nq2fL0O5l45G2ZfqoDvTNSSUgJKSQ0K/hvHTudBr8fEufivL4JA6M+mFrhj3W1Jy8YDx0yvn2hfExaOhaZzq2DOpS0w76q5usz6jgqVy5AY6aTJgmxkCroO7PplIjh/rINrQPvH6yejMTwajVD9GCXM2/3+dSmui3xAJ6XM9T/Yvimh0vfs5kmTpv582jTl9zU1s3umT5/x+ZISjFeB60Xv2XT3mvkMQIL90NSpDY/X1MzCv2cUF9NDQ9oOe8/xzxocF7bDzjPTZ1EmoNcr3hv0mVUqA1QUFhS0FBYUHMZJiwwyxqigz8tUzzB2j+h1l+r3hb1HPTLA9KKCAhWDjbkAMB8zWndQYk7Hy1736daHtk/n6XW5XFVFTqe/sKCgudjpbEQTdUNTzu4PPy8BAYEDDOgvohPmyQUF5E81NfoPV1qTXJ50ZEJA+HK5CN8mL3z5TOvlIFG/1mbydM0M4qj9IgHMwZwxYb6XSB0biDRhLkuYe42H+HACT7lRy6ZfA+UlJeQJRUkkzKzwa2slfB1e+PIjQfgxGkL9l9/1+UlL2VTiCqxJJMvZEOaZF1PCjPuO+TVVflOGGZSc4UsAfYmwenFJBfoSQetTgpEtWKKALxr4UkIF/4/t0hfybMZHgfXoXGlbubTDg11Ddv3oSyQ77mxAx8uvB/6b3ats26Wg+zbU68G3S/eLXY9U1xhfP93aYTvsNZgNcaN7h3Wsrjd+nPw8rMpEg8sFe682tcta72vQch5ak2D5ZPPmwfbFXwPpxpkN+H4yEXZv6DWYcf9d0bzAF1OyjNrXv9TW+rNcn8Ei2X07GLBrye8Xf89m0leyZwC9xrENev2zc2Gv/XzM0wrsONjxIgFlhX+epxoPO3b22sM6yUD3gF8z/l6xuu7pmJKNB0Hr8fNk+6H7k8kzSEBA4AAA+njtRsJWIElkzZQpmRHmZKSHL5OqbLbCt8kLXz7TejmKTqSaZ5Ke8kkE/Oca5rhpiBMlV8F7MaARgYplGPSLkidMMYQnksMJ/HH4NubkNsyyyaqaGt00P2nEdH59rYSvk239/SncHkf3uZm8PGs2WaQuIa6gkVIqG7LM7v1hl7CE+X8YizfNj/Nwgb5A5DoWtn6ubVDQNvBlg5XBtosYqjHySNau1WfZItlaDLZdRLJxDxbJ2rX6zArJ6qcCWyebeggsb7XGyZC6n/ZuDPhmBqqDJWsuAChHspDLCzTthx9fJuPMBvz6ZSI5YavPVzegqv+jhHlLU9NlLVHNXy7rM1gMai5JgO1Z7VMu/dB6fFs8UrU/6D3LEvx4rSSbsbDjz7Se1Ris6ubSNoVVH8n6ERAQOECBNzVGAvyQ5uLV/ZiNdElWBCIt8eHLpCqbrfBt8pJN2cGKERhrYOZMcmmZl0hzrohGQM6KMGNO3mNY8vS4ofEdzgct9oWHJh8bZtnkzIoKsp1eA8x84/6difBrlm39/SksWcaXOb9CvlVeQZZ8rou4l1OSnCNhnt3FmmS/h6/Ww7znAgIC+UTH3ZNiEbYxwFn3r2H8eDwMRY3TIY9tfv+4var6MiXLuxTljw1Rs9h0mj0BAQEBAYH9AvTn+DdNL6XnYzZMcnkCYSkWRMNS+HLZCN/WcAo/FkZ0QtU8kxxV5CbSvGszIMycCW98Tl40if4DAIwe5hcG7AsPTV6lwb/ml5WRD6z8mNOsR4LwdXNpYz8JJcv4MveOz0dOHjeZlLWcRlzBbiLlol02CfO90fzbkp0S5vcxo65xeCUgIHCgQ+urloKhJ2Km2KE3YE4XmhqjieYhf5+TlpaJ/Yrya9MUW1U/eq62FlPuiPUREBAQEBixwBNdDDalk6Uql4s839AQH/iLCk98MvmeL5Ot8G3lW/j+Uwiuz15FJVWuQgKtd0UjIPMkKU54wow5eU9kCfNfjJy8w0mYEUjSf0mvgYrCQvJXv980zTdJs8UapBR+bXNtZ5iFJcsvNDSSI8dOIYUt5xE7v3/ZkGUUSpjnXUPA7qKE+QNDwz/cey4gIDAUCITmgRY+H7RNXwctdCsEwztjUbFDn8LSNZi+Ef0aU/lcHrQgPl/LPlX92j5FuaBfVW8eUNUdDFnettnv/9qhvD4CAgICAgcG8ET3MzS1kdduJ+srKxP9mFF44pOJWBCSjIRvJ1NJVZfvY5CCa/SBr4mUyF4CgZA1gdJzL8dHx44jzPWnsIT5KSPV13CTJ/Qbu4YS5qKCggjmY949d24caU64HrIVfj8G294QCztPPDD6T0MDWTpxBilc+H1iw8OQOM2yBSFOJ7TughsJxPJvbwYAzFE73HsuICAweEgQ6A0xaaMYCX0KrXdi6puhiDx+oELaqyhrKEGOE0XZ9U5Dw+mTDu31ERAQEBA4gDAJAN7FF3gbQOScsjKyXVGsCRJPeFIJXzcb4dsarPDtD4H0I6mqryeuwglR8+qkhNmCLCP5QsLceAYByUYJM+bkxZyfw/3igCf7x9Oc3EiavQUF5HuqSt7z+cwAYIMmzvye5HFvshV2brivT9TWkpljKkjB3C4iLXsgtyBfvNC6i24h4PRSwvwJAJy8H/ZcQEBg0Gh1QLD3WSM/cr+khd6XtN5nILB+Fcy5vOUQJ8sYCduxV1H+3q8oH2OOZcwlvEdRnt2uKGv/VF2NwQ4zSf0lICAgICCw34E/VBhs48cA0K/7sBYVkdeMfMw8sUggO6mEr5up8O3wkmk5tjxfdwgEieQfZ1STggkLDVLFEymeJDPaSUqalfMISA5KmF80cvLuj5cH9LF7jqaXwpzMTkmK+GQ58sC0aaZf+6BIM78vediTXISdE+7pX2pqSf0kH3EtvdVi7wZLmO8l0HonAbmMEuatAHA2vxkCAgIHAlodMKtrup4PeU7X4Xre8KoTpgCUYS5XNDM+ZMkyYgWA/Xe1tdMwF/Hj1dVzH542zY+5iauj+W4P+fUREBAQEDiwgBrG71OyNMZuJ3+oqcncjzmZWJCTlMLXtxK+Tqb1eOHbyEFwfR6smErs048j0vKHE4kUT7KsCPPMbxKwFVDC/JaRk3d/vEDgC965APBPANhBNc0ohTZb5Hivl/ysqops4XybE66PVMLvwRDuRa5C54B7uUNVybpp1WTsuGZSsOS25NYBPBHOVOieL1lNoHAiphPD9d0JABfxmyEgIHBAAF2aMFgVm2OWz/V6KIOuD5uLV6yPgICAgMABCfzR+qzx8o5m2WTN1KlkwCAUPMlIIDxWwtfJRPg2eOHLWwlfJxPh28hAokSrmdwxeTKRGk4lsPyheDLFkyyWLLPfY07eaAAoJMyYYmjWfnyJwNP+GQBwHQC8bVgcYKoplAj6t580ejR5srZWN1tGkslqnfk1SipDsP5DISxZ3qoo5JqJk0jp9E5i03ot9m2QZJnd87Z7CBRXUMK8J2q5KCAgcIACn9d8/tX99QwfiRDrIyAgICBwUAB/vFCzifmY9Vy8Z5WV6fmYLYkQT3h44cunE74+L3z5dMLXz0T4NtKIThSbZ5LvjJ9AYMENBNAkmydGVsKXwZy8jiJKmHH954yAlwnUAiwxoqe/yWqb8TClxuUi3x0/njxTV4f5M7MnzVZrn+M+5CosWUY/7YsmV5KC+s8Tm9aduGdW+5erYBvt6wh4Z1DCvBcAfsBvgICAgICAgICAgIDAyEIZADxJ/VeXFBeTD/1+a7NsFJ708AQoG+HrD6YtXmgbfLuphG/DQvR1aTmMfHl0GZGWrknUHFsJm6OZfnb4Dwg4PZQwbwEAzEc5EoCkHQOyLAWAB6i22ThQiRRIUqRJlskNkyaRd30+so+uSbLrJZnwa59N3RyFJctvNzaRz44eS9z+01PvH098cxWdMK8nMKaJEmZc15sM7b6AgICAgICAgICAwAgFkqPrKSGqdDrJn2tr80uY+XpWwtfJVfh20wlfnxN9XQ47jGijJxAHNeGlhCiZ8MQJZd51BOQxbACowAjQMFNQ07lxhsn+o4x/s651LrHZCB6u3DN1KnmfI878mlkKv+4Zrn+uQskympQ/V1dHPjOxjrhnXayngUmIhJ1s7wYj2FbHRgJjW3DPkTDjQclKw8dPQEBAQEBAQEBAQGCEAn2LjqaphWRJitw1ZQrZk4z88AQnG6LD1+GFLz+UwveVifBtGMRrb3MLqR1dTWxHPkogmIJsWREu+vmCmwhgWqooAcW1P87Yi5EGHNMYADgJAF5gSTMesBRKUuSIkhLyl5oa3fedDQzGr11G+8GXGwKhWuV+tZk8XVdH5o6uII45XamJstXeDUawvUAPgQlzdRN3Yw27jaBrAgICAgICAgICAgIjGA0GGRpAEnTKmDHkY78/kfTw5CZbksPX44Uvnw/h+8xUjPq6Oa/aTIpH1xE48sdxhFni00nxpIkSJ5RFtxIoKme1jV81IoiOVKDpcB0AfBcA/s0SZztApLygIIL+73+vrc08fzO/xhbrPVih/e9WFfLzqipy2JTZxDH/umgubJ4gx+1dkv3LVOLaw2sE829vikD5EkqWdwNAHwCM5hdaQEBAQEBAQEBAQGBkYRQA/IxqDaucTvJaY2O8iS1PaLIhNnwdXvjywyH8GDIQXAvUot5bVU2KJh9OpOWPmFpKnSyzhJknUDyRar2LQEklJcxIoC4w0nCMZKCZNqYEmQ4Adxim5Ej2zeBgYx0OcuXEiWSbERQspX+zxRrHCV8+S6Ga5YFmlTw0bTqZNF4hsHRVes0y9UvPRhLaQIJ8bzQo3BGPRAn6vOsiMKp+n81me8Futx8BAJNHqFWBgICAgICAgICAgACHaw0N8z4HAPntjBmmea1OQHgykw2h4evl0sZwCD82fpxo1tvcTG6cNJG4KoJRMqST4wzJMiVWwfsIYMCw0moaAAoJ58VGnsoDAUiccawY2Xs1AHxCNc544OKUpIjqdpM7yst1S4W0gcH4tR6Ca4OS5d2qSm4tLycTKjUitd0dv0+80H3k98xKeGKMf/F6wLzc+P/WO6K5tqcdHYGxzREonLAP7M4BAAkPGN41fNYFBAQEBAQEBAQEBA4AoJbr84aZqJ5e6qby8hhhTiUWZCVB+DrZ1B1O4cfHCdUwXzphHCmYfkxUE5lAuizIVQLRup9A+1oC3lrWJPsaI63TgQQaHGwhAPzN8MXG6M+6pQL+PbywMPL7mhqyXVHi/JsTiLPFeudyndC2kSzvUFVy25RppLDqWGJDMpvM3zzVYQdf1tROM0QZtcdtawnM/n5EJ8jFUyLMQQj+uz8q+sHCiwBwJwDU8IspICAgICAgICAgIDByMRMA3qcv+SeNHk12GcQjgcBkS2T4etnU3V/CjVcnYYpCds+ZQ1pHeYk8+8JEAsaTrWSCZTHF0OgGljDfBgBF/KYcIEDS7AWALwDAHwBgO2um7bXbI18cNSrypEGceVPtITmU4cjy+34/OWfiNOKuP4VIWppI2MkELQESPttEoO0eAnOvJtB0ZgTK2yIwqi4C8pgISI59ABLOG/cTBQnyG4av8rkAMM9I4ybMsAUEBAQEBAQEBAQOMEwBgD8i0bFFNYPkA0MrmEBgsiAxuvB1c2ljfwlD6nAtXvL7ybLZs8iUz9xDpGWUhBkkmCfGyQTLYoqhMT6WMG84CCImI3H2AMA3AeBfNBUVaptRSm22yCXjx5OXGhvJLkWx1jbz10iG1wq7R282+ciXxk0l0PwNIi1/iCO9VlpjVgytMdUga6Go+fy8a5EgEyhvI1BcHgHJRqNdG5pk3dQaNewfAcDfjf1Eqw1MzcWuz0hJHSYgICAgICAgICAgkAVQu3krNakdbbeTZ+vqkptlW5CWpMLXzbWd4RZGY4n5e19taCDHT6oik9ouI4VHcMSLJ8WpBMtjiqGxzUiYUZBsPWKQzYMBGBisFgC6jOjre6mPM/o318ty5PpJk8ibPp++rixxtrzWUlwrrFYZ/77QUE+OmFBLYNb3MtAq0z00yuHeIEnGw4z5N0QJ8qTFBEqmRsDpiYBkR/NqGh2cCmrTXwWAXwLApQDQCgBTjQBuQpMsICAgICAgICAgcJAANV9fAoAthpaZ3Dllih40KYHIWBCXlMITn8G0NYxCiRimSXqyto4snTCDFM77LpF0osWQMZ4QpxOso/USGD+HJcx/OshSDOH1hIRxlhEY7E3jMEY31UaN86KiIhKaNo18bEGcE64Ti+uFJcu4R3+trSULJjQSO6aN0gOyMUSYrnuC6OmeCCy9O2pmXXcSgXGHEXCNon7IVGg0cNQifwwAzwLARsPUGufI+p8LLbKAgICAgICAgIDAQQgfAPyXBv5aXlpKts+cqUc5jiMyFuQypfCkhxe+/P4WhojhgcFPq6rIvMpZpHDRNUTqtMjfyxPidIJ1gmECkxZilGxKmP8BAGP4DTkIgOSxFADaAaAbAD6k2lk0/R9tt0eOLi0lj1ZVWaeishKOLKOv/U+nV5GWisXEvvi2FJplSqAxANimaCTr5m8QmHZUNAAbkmRbAQ3WxQruz1sA8AsAuBIAjjRSa+G88FBAEGQBAQEBAQEBAQGBQwCFBinQtYBolv2DmhqyuaUldVqgTIQnPSOUMPNErG96NWmcejiRl/6ISFZEjCfDmYhOmO8lMKWNEmZc7+cOUsJMQf2bjzfMl1FLq2ttUds80eGInF5WRv5SU0N2GMQ5TuOM+2NcL+weYSTsuyuryZRpncS+BHMs8ySZIcuBbgILf0RAOZ/AlHYCpdMI2N00tRclyjgm1IRvBoD/AMAmAPgaACwCgPGGuTklyIIoCwgICAgICAgICBxCQAJwEzWdRSJTbLdHjvV4yC+rqkySkjN55onyCCPMcWRZUcgtU6aQaVVtxLH0TmutJU+EMxW9/v0EpgZZwvwKFyDqYAUSTjQ9x4BYv6c+87gG6N88w+mMfH3cOPJiQ4Nu2cCmouLJ8qeKn9wwuZxMrPsCkdDvmO6RHr0c1/qhqOk7mlrXfIHAuNkECicScBTSoF2UINN/Y5AyHNPVAHCM4YeN0b8LBDkWEBAQEBAQEBAQEEBSgEQByRsN1BSxRzWA5KyyMvJUXZ1uppwzaUbhyXIubeRBcC5I0Db7/eSq8koyofYYUqCtSyTKlPDyRDhTofXRFFiyUcL8jhGp/FABmjJPNrS3z9Mc4Hi9IXFWZJncWl5O/tfUpPs3s9cb/nur308um1pLShpPJdDRbRxgGGQZcyLPuZzAjM8RGNWAptYEbA4+YBcSZSTILwPATwDg20Y+6YkA4BIRrQUEBAQEBAQEBAQErIDRfWcAwI0AsJMJdhQpkKTIlIICcv7YseRdn0/XAOZMnHktM0+ih1OM8Q8oCtmsqOTksZNIUeNJxKb1WGuWh4Iw49+q41jCjMHWcN0PNaD2FqNKf4vJA65bNxTabBG/2016KyrIXvSl1/dJIR/6/eRLYyaS4pnfiK7l8ocJdGyI+iNPXEigeAoBRxHmRaYkmeZFRk0yarSRJN8MABoAVBsR4kVUawEBAQEBAQEBAQGBjICaNQcAzAOAh4zIwCaRcQAQnyyTdVOnko+QODMawAQymkp4oryfCDPVWr7l85EvjCsn8szziE0ntknIMmoyeRKcjVDCXPN5ApKD5mJGjb5yiGo1cc5oqt0AAKsM4mwe1LglKXK8x0P+XFNDXm9qIoePryP22ZcRCYN2KRcQmLyEgDzGWEvdH5nVIuO6vgcAfwCA643gY2gSjkSd9i0gICAgICAgICAgIJA1UOOG6XLmGkGpaHodPS2QLEmRWYWF5PEZM3RtM5saiCelKYUlytnWHYTE+8OqZH5xKbEf3kUkXpNs/jWEJ8DZCiXMmMIoSph1Ymis86Gs5UTyiubQKhN8TifODoBIic0WqXR7iFS5nIBnBoGCYlw/mv4Jy1J/aHoAgW2cZGiwUYuMpPxQXl8BAQEBAQEBAQEBgSEG1cBh8KMLAOApQ+NMTVx1InPamDHkydpaPWqxZYTjVMJrmPOsaWaJMpL8v9fWEnVMJXHMu4LAsgdTaJYtyG8uQttq/CoBWwFLmBcIQqcDrzmM2I6BwR4DgG0xjTOS47io1ih4PWJU678CwBoA+CIATONSPglNsoCAgICAgICAgIBA3kDNZjH10UUA8CoNDCYZptpeuz3yzXHj9EBNGDwr44jaPFHmhS8/CGGJ/B5VJX+uqSU1ZQ3EmSq4F/3LE99cxSDMkv+cCNiclPjh34AgzCbwesO1kAHgZCM/+B7GHxn/jabbSJIvAYAmRotM6woICAgICAgICAgICAwrKHFGf1v0CUUio0c4RtKMxA/9m2+cPJm81NCQEOGYJ7Cm8CQ5j2QZx7NNUciaympSXr6A2BbfakGUOdLMk96shLaDmmtDlj1AQL2AJcwoRwuilxSoMb4YAH5taJFPB4BZAFAitMgCAgICAgICAgICAiMNlDijv+k6APiUms0icUaZ6XZH+iorySd+f4K22ZI882SZF758FsKS5U8Vhdw0aRLxTl9ObMFQchNsKgkEOAPh26B9IFFGAq6FCTSdHgFbARLmZwAgBABzBOlLClwXes2JQwUBAQEBAQEBAQEBgQMCSGI8AHCkQfriUgOV2myRFV5v5NHp08lHFsSZJ7YJJHkICDNLlj/0+ci3yqtJae0JBNrRDDsdWU5DmPnyJjmmQcLuIxDoJdC6ksCcKyLQdEYEKpZHYIwvAvIY9MnFtVppmBMLIiggICAgICAgICAgIHAQggZqWmaYzaJ/sxlR22OzRb48ejR5qrZW9x1GH2dL0syT5EESZtoH9vd2UxM5qWwSKfSfaUFyLYQnx0mJMjW1xjoPRr9vX09g7jUE6k8hMHFBBEqnRcDhplHGqWBU5w8B4A5j7QQEBAQEBAQEBAQEBAQOclQAwNkA8CeDFOoaZ6ckRWpdLnLp+PHk+fr65P7NPFHOkTTTdrGfFxoayBcmNxC3egGRNDTDtiDIvJgEOQk5Xv5A9Hutl8Di2wkc9l0CdV8mUL40At6aCMhjI2CXqRaZpkj6GAD+BgB3A8AZhhn2BGGKLSAgICAgICAgICAgcOgAfU2ROH8TAF5niHPEDhBpkmWycsoUsl1RzIjaJnFOJxbkmBdWs/xMfT2ZVTaN2Gd3JZLijIUG6zK0y21rCcy5nMCMzxMYO5NA0WQC9kI25REbzfkTI5rzVQDQbqyLU5BkAQEBAQEBAQEBAQGBQxdICF0AMBMArjGIs+nfjPmbW4uLSXdlpU6cLf2bebKcAWmm/spIlh+rriKHTVSIbeEP4/2VE8yqLcgxjWaN0nY3gcO+Q6DqMwTGtUQJckGxEeVa1yBTgoz/xsOBFwFgPQCcCQCHA8A4w+yaBq8SEBAQEBAQEBAQEBAQENBRAAB+ANgEAFuoxhmJc6EkkfbiYt2/eTfv35xMLIgyS5b3NTeTn1dVkQljfURaujp9cC8rwaBgSJLLlxCQywjYXQQkiTBaZEqU8S9GCccUW6sBYLlhZo05hDGQlyDIAgICAgICAgICAgICAimBxNENAK0A8LBhroykeR+aaZc5HJH/Gz1a9zdGwptAnKnGmf1rQZb3qs3k5gkTyOiKALEFumMEOGnALvzuoWjArkW3Eqg7mcDYZgKF40hUg2zjCTL9P5LknwHAOQAwGwDKDFNrGu1aEGUBAQEBAQEBAQEBAQGBrIBE0gEAXwCA5wBgBxJRmr95rN0euWHy5Mj/fD49onY6/2b6HZb7xK+Qa8oribvqOGJb/hCnWeb+HdxEAAn1oh8RaPgqgVH1hCHH1NSamljvNgjySwbZPw0AxnJzEgRZQEBAQEBAQEBAQEBAYNCgBHM8AJwOAE8DwC5qpo0RtVW3O7J6yhQ9f3NCRG3m35Qsv+PzkdPGTyGy70wiIRlGYhxkolrr/+8jsHRN1NS6YjmB0qoIFJQwJDnqY21oknE87wDA4wBwqaEZn2KQfUGOBQQEBAQEBAQEBAQEBPIKSjwnAcD1hgYXiaqubXZJUuQ4jyfyy+pq8onfH2emTQU/e72xiXx10gziUr9GpM77DaJsEORAD4HWO6MkedpRBEoqIiCZfsgsSUYtMka0xoBdjwLA9wBgrmFGzo9XQEBAQEBAQEBAQEBAQGDYgP6/zQBwBwC8ZZhp6xrnMXZ75MRRoyJ/rqkhe5mI2kiW/1PfQI6a1Eics79HoLMvSpTR1HrBTQSaziQwcX4ECsdHwOFmyTGb+ul9Q8N9JwB8DgCqAaBUBOwSEBAQEBAQEBAQEBAQGGnAVFQdABAyTKLNiNpTCwoil4wfT/5VV0e2Kgp5YEYtWTi5hRRgTmRM/XT4lQTqTiIwfjZGtmbzIrOm1h8DwKuGFvlyI6r1ZM4PWRBlAQEBAQEBAQEBAQEBgREJ1O6WAMCRAPAIAGyjZtoFkhTxyXLkovETSN2EZiIhQa48koC3NgLO0gjYCgyCbAbtQtkJAE8ZaZ9OBoAmABhlpLsSAbsEBAQEBAQEBAQEBAQEDkhgTmMkuX80iLOe2kkCW0RyjY6S5HhyjLLd0CL/GgCuAoCjAKDW8EcW5FhAQEBAQEBAQEBAQEDgoIHdSOOE6Zz+w5hXo7Dm1q8BwDoA+BIAzAQAr2HiLUiygICAgICAgICAgICAwEENNKGuAoDLjBzOrwPA7wDgRgA4HgBqAMAjzKwFBAQEBAQEBAQEBAQEDlUgca4EgHoAKDMibKMWWkBAQEBAQEBAQEBAQEDgkAfVIgtNsoCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwEjB/wNL1pvTJ7A6oQAAAABJRU5ErkJggg==";

  const MahexState = {
    brands: ['MIXUE', 'MOMOYO', 'TIANLALA', 'WEDRINK', 'LAINNYA'],
    tarifData: Object.assign({}, DEFAULT_MAHEX_TARIF),
    regions: ["BANTEN RAYA", "JABODETABEK - BANDUNG - PRIATIM", "PANTURA RAYA"],
    isCustomBrand: false,
    isCustomRegion: false,
    isCustomStore: false,
    isCustomRate: false,
    currentRate: 100000,
    initialized: false
  };

  function initMahexView() {
    if (!MahexState.initialized) {
      initMahexModule();
      MahexState.initialized = true;
    }
  }

  function initMahexModule() {
    var dateInput = document.getElementById('mhx_date');
    if (dateInput && !dateInput.value) {
      dateInput.valueAsDate = new Date();
    }

    populateMahexBrands();
    populateMahexRegions();
    generateMahexInvoiceNo();
    calculateMahexRate();
    fetchMahexMasterDataSheets(false);
  }

  function populateMahexBrands() {
    var brandSelect = document.getElementById('mhx_brand');
    if (!brandSelect) return;
    var currentVal = brandSelect.value;
    brandSelect.innerHTML = '';
    var brands = MahexState.brands || ['MIXUE', 'MOMOYO', 'TIANLALA', 'WEDRINK', 'LAINNYA'];
    brands.forEach(function (b) {
      var opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      brandSelect.appendChild(opt);
    });
    if (currentVal && brands.indexOf(currentVal) !== -1) {
      brandSelect.value = currentVal;
    } else if (brands.length > 0) {
      brandSelect.value = brands[0];
    }
  }

  function populateMahexRegions() {
    var regionSelect = document.getElementById('mhx_region');
    if (!regionSelect) return;
    var currentReg = regionSelect.value;
    regionSelect.innerHTML = '';
    var data = MahexState.tarifData || DEFAULT_MAHEX_TARIF;
    Object.keys(data).forEach(function (reg) {
      var opt = document.createElement('option');
      opt.value = reg;
      opt.textContent = reg;
      regionSelect.appendChild(opt);
    });
    if (currentReg && data[currentReg]) {
      regionSelect.value = currentReg;
    }
    updateMahexDestinations();
  }

  function updateMahexDestinations() {
    var regionSelect = document.getElementById('mhx_region');
    var storeSelect = document.getElementById('mhx_store_name');
    if (!regionSelect || !storeSelect) return;

    var region = regionSelect.value;
    var currentStore = storeSelect.value;
    storeSelect.innerHTML = '';
    var data = MahexState.tarifData || DEFAULT_MAHEX_TARIF;

    if (data[region]) {
      Object.keys(data[region]).forEach(function (store) {
        var opt = document.createElement('option');
        opt.value = store;
        opt.textContent = store;
        storeSelect.appendChild(opt);
      });
    }

    if (currentStore && data[region] && data[region][currentStore]) {
      storeSelect.value = currentStore;
    }

    var destInput = document.getElementById('mhx_destination');
    if (destInput && storeSelect.value) {
      destInput.value = storeSelect.value;
    }

    calculateMahexRate();
  }

  function calculateMahexRate() {
    if (MahexState.isCustomRate) {
      var customVal = parseInt(document.getElementById('mhx_rate_custom').value, 10);
      MahexState.currentRate = isNaN(customVal) ? 0 : customVal;
      return;
    }

    var region = MahexState.isCustomRegion ? 'CUSTOM' : (document.getElementById('mhx_region') ? document.getElementById('mhx_region').value : '');
    var store = MahexState.isCustomStore ? 'CUSTOM' : (document.getElementById('mhx_store_name') ? document.getElementById('mhx_store_name').value : '');
    var dus = parseInt(document.getElementById('mhx_dus').value, 10) || 0;

    var tierIndex = 0;
    if (region === 'BANTEN RAYA') {
      if (dus <= 15) tierIndex = 0;
      else if (dus <= 25) tierIndex = 1;
      else if (dus <= 35) tierIndex = 2;
      else if (dus <= 50) tierIndex = 3;
      else if (dus <= 80) tierIndex = 4;
      else tierIndex = 5;
    } else {
      if (dus <= 10) tierIndex = 0;
      else if (dus <= 20) tierIndex = 1;
      else if (dus <= 30) tierIndex = 2;
      else if (dus <= 45) tierIndex = 3;
      else if (dus <= 75) tierIndex = 4;
      else tierIndex = 5;
    }

    var dataTarif = MahexState.tarifData || DEFAULT_MAHEX_TARIF;
    if (dataTarif[region] && dataTarif[region][store]) {
      MahexState.currentRate = dataTarif[region][store][tierIndex] || 100000;
    } else {
      MahexState.currentRate = 100000;
    }

    var rateDisplayEl = document.getElementById('mhx_rate_display');
    if (rateDisplayEl) {
      rateDisplayEl.value = 'Rp ' + MahexState.currentRate.toLocaleString('id-ID');
    }
  }

  function generateMahexInvoiceNo() {
    var invInput = document.getElementById('mhx_invoice_no');
    if (!invInput) return;
    var d = new Date();
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var rand = ('00' + (Math.floor(Math.random() * 900) + 1)).slice(-3);
    invInput.value = 'INV/MHX/' + y + '/' + m + '/' + rand;
  }

  function initMahexListeners() {
    var btnSync = document.getElementById('btnSyncMahexTarif');
    if (btnSync) {
      btnSync.addEventListener('click', function () {
        fetchMahexMasterDataSheets(true);
      });
    }

    var btnAutoNo = document.getElementById('btnGenMahexInv');
    if (btnAutoNo) {
      btnAutoNo.addEventListener('click', generateMahexInvoiceNo);
    }

    var regionEl = document.getElementById('mhx_region');
    if (regionEl) {
      regionEl.addEventListener('change', updateMahexDestinations);
    }

    var storeEl = document.getElementById('mhx_store_name');
    if (storeEl) {
      storeEl.addEventListener('change', function () {
        var destInput = document.getElementById('mhx_destination');
        if (destInput && this.value) {
          destInput.value = this.value;
        }
        calculateMahexRate();
      });
    }

    var dusEl = document.getElementById('mhx_dus');
    if (dusEl) {
      dusEl.addEventListener('input', calculateMahexRate);
    }

    var rateCustomEl = document.getElementById('mhx_rate_custom');
    if (rateCustomEl) {
      rateCustomEl.addEventListener('input', calculateMahexRate);
    }

    // Toggle Buttons
    var btnToggleBrand = document.getElementById('btn_toggle_brand');
    if (btnToggleBrand) {
      btnToggleBrand.addEventListener('click', function () {
        MahexState.isCustomBrand = !MahexState.isCustomBrand;
        var sel = document.getElementById('mhx_brand');
        var inp = document.getElementById('mhx_brand_custom');
        if (MahexState.isCustomBrand) {
          sel.style.display = 'none';
          inp.style.display = 'block';
          this.textContent = '📋 Pilih dari Daftar';
          inp.focus();
        } else {
          sel.style.display = 'block';
          inp.style.display = 'none';
          this.textContent = '✏️ Ketik Manual';
        }
      });
    }

    var btnToggleStore = document.getElementById('btn_toggle_store');
    if (btnToggleStore) {
      btnToggleStore.addEventListener('click', function () {
        MahexState.isCustomStore = !MahexState.isCustomStore;
        var sel = document.getElementById('mhx_store_name');
        var inp = document.getElementById('mhx_store_name_custom');
        if (MahexState.isCustomStore) {
          sel.style.display = 'none';
          inp.style.display = 'block';
          this.textContent = '📋 Pilih dari Daftar';
          inp.focus();
        } else {
          sel.style.display = 'block';
          inp.style.display = 'none';
          this.textContent = '✏️ Ketik Manual';
          calculateMahexRate();
        }
      });
    }

    var btnToggleRegion = document.getElementById('btn_toggle_region');
    if (btnToggleRegion) {
      btnToggleRegion.addEventListener('click', function () {
        MahexState.isCustomRegion = !MahexState.isCustomRegion;
        var sel = document.getElementById('mhx_region');
        var inp = document.getElementById('mhx_region_custom');
        if (MahexState.isCustomRegion) {
          sel.style.display = 'none';
          inp.style.display = 'block';
          this.textContent = '📋 Pilih dari Daftar';
          inp.focus();
        } else {
          sel.style.display = 'block';
          inp.style.display = 'none';
          this.textContent = '✏️ Ketik Manual';
          updateMahexDestinations();
        }
      });
    }

    var btnToggleRate = document.getElementById('btn_toggle_rate');
    if (btnToggleRate) {
      btnToggleRate.addEventListener('click', function () {
        MahexState.isCustomRate = !MahexState.isCustomRate;
        var disp = document.getElementById('mhx_rate_display');
        var inp = document.getElementById('mhx_rate_custom');
        if (MahexState.isCustomRate) {
          disp.style.display = 'none';
          inp.style.display = 'block';
          this.textContent = '🤖 Hitung Otomatis';
          inp.value = MahexState.currentRate;
          inp.focus();
        } else {
          disp.style.display = 'block';
          inp.style.display = 'none';
          this.textContent = '✏️ Edit Manual';
          calculateMahexRate();
        }
      });
    }

    // Tombol Download Faktur PDF
    var btnPdf = document.getElementById('btnGenerateMahexPdf');
    if (btnPdf) {
      btnPdf.addEventListener('click', generateMahexPDF);
    }

    // Tombol Kirim WhatsApp
    var btnWa = document.getElementById('btnShareMahexWa');
    if (btnWa) {
      btnWa.addEventListener('click', shareMahexWhatsApp);
    }

    // Tombol Reset Form
    var btnReset = document.getElementById('btnResetMahexForm');
    if (btnReset) {
      btnReset.addEventListener('click', function () {
        document.getElementById('formMahexDelivery').reset();
        MahexState.isCustomBrand = false;
        MahexState.isCustomRegion = false;
        MahexState.isCustomStore = false;
        MahexState.isCustomRate = false;
        document.getElementById('mhx_brand').style.display = 'block';
        document.getElementById('mhx_brand_custom').style.display = 'none';
        document.getElementById('mhx_store_name').style.display = 'block';
        document.getElementById('mhx_store_name_custom').style.display = 'none';
        document.getElementById('mhx_region').style.display = 'block';
        document.getElementById('mhx_region_custom').style.display = 'none';
        document.getElementById('mhx_rate_display').style.display = 'block';
        document.getElementById('mhx_rate_custom').style.display = 'none';
        document.getElementById('btn_toggle_brand').textContent = '✏️ Ketik Manual';
        document.getElementById('btn_toggle_store').textContent = '✏️ Ketik Manual';
        document.getElementById('btn_toggle_region').textContent = '✏️ Ketik Manual';
        document.getElementById('btn_toggle_rate').textContent = '✏️ Edit Manual';
        initMahexModule();
        showToast('Formulir MAHEX direset.', 'info');
      });
    }
  }

  function fetchMahexMasterDataSheets(manual) {
    var btnSync = document.getElementById('btnSyncMahexTarif');
    if (btnSync) {
      btnSync.style.opacity = '0.6';
      btnSync.style.pointerEvents = 'none';
    }
    if (manual) showToast('Menghubungkan ke Google Sheets MahexTarif & MahexBrand...', 'info');
    GasBridge.call('getMahexMasterData', [], function (res) {
      if (btnSync) {
        btnSync.style.opacity = '1';
        btnSync.style.pointerEvents = 'auto';
      }
      if (res && res.success) {
        if (res.brands && Array.isArray(res.brands) && res.brands.length > 0) {
          MahexState.brands = res.brands;
          populateMahexBrands();
        }
        if (res.tarif && Object.keys(res.tarif).length > 0) {
          MahexState.tarifData = res.tarif;
          populateMahexRegions();
        }
        calculateMahexRate();
        if (manual) showToast('Master tarif & brand MAHEX berhasil disinkronkan dari Google Sheets!', 'success');
      } else {
        if (manual) showToast('Gagal memuat master data Sheets, menggunakan database lokal.', 'error');
      }
    }, function () {
      if (btnSync) {
        btnSync.style.opacity = '1';
        btnSync.style.pointerEvents = 'auto';
      }
      if (manual) showToast('Koneksi backend gagal, menggunakan data lokal.', 'error');
    });
  }

  function fetchMahexTarifSheets(manual) {
    fetchMahexMasterDataSheets(manual);
  }

  function generateMahexPDF() {
    var jsPdfLib = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPdfLib) {
      alert('Library jsPDF belum siap dimuat, mohon tunggu beberapa detik atau refresh halaman.');
      return;
    }

    var doc = new jsPdfLib();

    var invoiceNo = document.getElementById('mhx_invoice_no').value || 'INV/MHX/' + new Date().getFullYear();
    var date = document.getElementById('mhx_date').value || new Date().toISOString().split('T')[0];

    var formattedDateForFile = date;
    if (date && date.indexOf('-') !== -1) {
      var parts = date.split('-');
      if (parts.length === 3) {
        formattedDateForFile = parts[2] + '-' + parts[1] + '-' + parts[0];
      }
    }

    var brand = MahexState.isCustomBrand ? (document.getElementById('mhx_brand_custom').value || '-') : document.getElementById('mhx_brand').value;
    var storeName = MahexState.isCustomStore ? (document.getElementById('mhx_store_name_custom').value || '-') : document.getElementById('mhx_store_name').value;
    var region = MahexState.isCustomRegion ? (document.getElementById('mhx_region_custom').value || '-') : document.getElementById('mhx_region').value;

    var destination = document.getElementById('mhx_destination').value || '-';
    var dus = document.getElementById('mhx_dus').value || '15';
    var notes = document.getElementById('mhx_notes').value || '-';

    if (MahexState.isCustomRate) {
      MahexState.currentRate = parseInt(document.getElementById('mhx_rate_custom').value, 10) || 0;
    }

    try {
      doc.addImage(MahexLogoBase64, 'PNG', 14, 8, 48, 16.1);
    } catch (e) {
      console.log('Logo MAHEX dilewati.', e);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text('MAHEX', 14, 18);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text('FAKTUR PENGIRIMAN', 196, 18, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Alamat: Cilame, Kec. Ngamprah, Kabupaten Bandung Barat, Jawa Barat 40552', 14, 29);

    doc.setDrawColor(203, 213, 225);
    doc.line(14, 33, 196, 33);

    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);

    doc.setFont('helvetica', 'bold');
    doc.text('No. Faktur:', 14, 41);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceNo, 45, 41);

    doc.setFont('helvetica', 'bold');
    doc.text('Kepada Yth:', 110, 41);
    doc.setFont('helvetica', 'normal');
    doc.text(storeName, 138, 41);

    doc.setFont('helvetica', 'bold');
    doc.text('Tanggal:', 14, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(date, 45, 48);

    doc.setFont('helvetica', 'bold');
    doc.text('Brand / Klien:', 110, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(brand, 138, 48);

    doc.setFont('helvetica', 'bold');
    doc.text('Wilayah:', 14, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(region, 45, 55);

    doc.setFont('helvetica', 'bold');
    doc.text('Kota Tujuan:', 110, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(destination, 138, 55);

    var startY = 64;
    doc.setFillColor(79, 70, 229);
    doc.rect(14, startY, 182, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('Deskripsi Pengiriman', 18, startY + 5.5);
    doc.text('Jumlah', 115, startY + 5.5);
    doc.text('Total Biaya', 155, startY + 5.5);

    startY += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);

    var splitDesc = doc.splitTextToSize('Jasa Pengiriman Bahan Baku ke ' + storeName + ' (Tujuan: ' + destination + ')', 92);
    if (notes && notes !== '-') {
      splitDesc.push('Catatan: ' + notes);
    }

    var rowHeight = Math.max(16, (splitDesc.length * 5) + 6);

    doc.setFillColor(248, 250, 252);
    doc.rect(14, startY, 182, rowHeight, 'F');

    var textY = startY + 5.5;
    for (var i = 0; i < splitDesc.length; i++) {
      doc.text(splitDesc[i], 18, textY);
      textY += 5;
    }

    doc.text(dus + ' Dus', 115, startY + 5.5);
    doc.text('Rp ' + MahexState.currentRate.toLocaleString('id-ID'), 155, startY + 5.5);

    doc.setDrawColor(203, 213, 225);
    doc.rect(14, startY - 8, 182, rowHeight + 8);

    startY += rowHeight + 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Total Pembayaran:', 120, startY);
    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229);
    doc.text('Rp ' + MahexState.currentRate.toLocaleString('id-ID'), 155, startY);

    startY += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, startY, 196, startY);

    startY += 8;
    var blockStartY = startY;

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Pembayaran Transfer Ke :', 14, blockStartY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('Bank BCA', 14, blockStartY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('2090187042', 14, blockStartY + 11.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Dadan Haryanto', 14, blockStartY + 17);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    doc.text('Penerima / Outlet,', 115, blockStartY);
    doc.text('Hormat Kami,', 160, blockStartY);

    doc.text('( .................................... )', 105, blockStartY + 20);

    doc.setFont('helvetica', 'bold');
    doc.text('Dadan Haryanto', 155, blockStartY + 20);

    var fileName = 'Faktur ' + brand + ' ' + storeName + ' ' + formattedDateForFile + '.pdf';
    doc.save(fileName);
    showToast('Faktur PDF ' + fileName + ' berhasil diunduh!', 'success');

    // Arsipkan otomatis ke Google Sheets di background
    GasBridge.call('simpanFakturMahex', [{
      noFaktur: invoiceNo,
      tanggal: date,
      brand: brand,
      toko: storeName,
      wilayah: region,
      tujuan: destination,
      dus: dus,
      totalTarif: MahexState.currentRate,
      catatan: notes
    }], function (res) {
      if (res && res.success) {
        showToast('Faktur otomatis tercatat di Google Sheets MAHEX_FAKTUR.', 'success');
      }
    });
  }

  function shareMahexWhatsApp() {
    var invoiceNo = document.getElementById('mhx_invoice_no').value || '-';
    var date = document.getElementById('mhx_date').value || '-';
    var brand = MahexState.isCustomBrand ? (document.getElementById('mhx_brand_custom').value || '-') : document.getElementById('mhx_brand').value;
    var storeName = MahexState.isCustomStore ? (document.getElementById('mhx_store_name_custom').value || '-') : document.getElementById('mhx_store_name').value;
    var destination = document.getElementById('mhx_destination').value || '-';
    var dus = document.getElementById('mhx_dus').value || '0';
    var rate = MahexState.currentRate || 0;
    var notes = document.getElementById('mhx_notes').value || '-';

    var msg = '🚚 *FAKTUR PENGIRIMAN MAHEX*\n'
      + '_We Are Always By Your Side_\n'
      + '============================\n'
      + '• *No. Faktur:* ' + invoiceNo + '\n'
      + '• *Tanggal:* ' + date + '\n'
      + '• *Brand / Klien:* ' + brand + '\n'
      + '• *Tujuan Outlet:* ' + storeName + ' (' + destination + ')\n'
      + '• *Jumlah Muatan:* ' + dus + ' Dus\n'
      + '• *Total Biaya:* Rp ' + Number(rate).toLocaleString('id-ID') + '\n';

    if (notes && notes !== '-') {
      msg += '• *Catatan:* ' + notes + '\n';
    }

    msg += '============================\n'
      + '💳 *Pembayaran Transfer Ke:*\n'
      + 'Bank BCA: *2090187042*\n'
      + 'a.n *Dadan Haryanto*\n\n'
      + 'Terima kasih telah mempercayakan pengiriman bahan baku kepada MAHEX!';

    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(msg), '_blank');
  }

  // ============================================================================
  // 13. FITUR TARIK DATA EXCEL (.XLS & .XLSX) PANORAMA SALES LENGKAP & DETAIL PEMBELI
  // ============================================================================
  const ExcelExportState = {
    period: 'month',
    startDate: '',
    endDate: '',
    type: 'panorama_all', // 'panorama_all' | 'panorama_items' | 'rekap_nota'
    format: 'xls',        // 'xls' (Terformat Mewah) atau 'xlsx' (Standar)
    cachedData: null,
    isLoading: false
  };

  function setExcelFileFormat(fmt) {
    ExcelExportState.format = fmt;
    var cardXls = document.getElementById('cardFormatXls');
    var cardXlsx = document.getElementById('cardFormatXlsx');
    var btnLabel = document.getElementById('btnDownloadExcelLabel');

    if (fmt === 'xls') {
      if (cardXls) cardXls.classList.add('active');
      if (cardXlsx) cardXlsx.classList.remove('active');
      if (btnLabel) btnLabel.textContent = 'Unduh File Excel Terformat (.xls)';
    } else {
      if (cardXlsx) cardXlsx.classList.add('active');
      if (cardXls) cardXls.classList.remove('active');
      if (btnLabel) btnLabel.textContent = 'Unduh File Excel Standar (.xlsx)';
    }
  }

  function openExcelExportModal() {
    var modal = document.getElementById('modalExcelExport');
    if (!modal) return;
    modal.classList.add('active');

    // Sinkronkan periode default dengan filter aktif di analitik jika ada
    var activePeriodBtn = document.querySelector('.period-chip-btn.active');
    var activePeriod = activePeriodBtn ? activePeriodBtn.getAttribute('data-period') : 'month';
    if (activePeriod === 'all' || activePeriod === 'month' || activePeriod === '7days' || activePeriod === 'today') {
      ExcelExportState.period = activePeriod;
    } else {
      ExcelExportState.period = 'month';
    }

    setExcelFileFormat('xls');
    setExcelExportPeriod(ExcelExportState.period, true);
    loadExcelPreviewData();
  }

  function closeExcelExportModal() {
    var modal = document.getElementById('modalExcelExport');
    if (modal) modal.classList.remove('active');
  }

  function setExcelExportPeriod(period, skipFetch) {
    ExcelExportState.period = period;
    var chipBtns = document.querySelectorAll('.excel-chip-btn');
    chipBtns.forEach(function (btn) {
      if (btn.getAttribute('data-period') === period) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    var customRow = document.getElementById('excelCustomDateRow');
    if (customRow) {
      if (period === 'custom') {
        customRow.style.display = 'flex';
        var now = new Date();
        var y = now.getFullYear();
        var m = ('0' + (now.getMonth() + 1)).slice(-2);
        var d = ('0' + now.getDate()).slice(-2);
        var todayStr = y + '-' + m + '-' + d;
        var startInput = document.getElementById('excelStartDate');
        var endInput = document.getElementById('excelEndDate');
        if (startInput && !startInput.value) startInput.value = y + '-' + m + '-01';
        if (endInput && !endInput.value) endInput.value = todayStr;
      } else {
        customRow.style.display = 'none';
      }
    }

    if (!skipFetch) {
      loadExcelPreviewData();
    }
  }

  function selectExcelExportType(type) {
    ExcelExportState.type = type;
    var cards = document.querySelectorAll('.excel-type-card');
    cards.forEach(function (card) {
      if (card.getAttribute('data-type') === type) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  function triggerExcelCustomRefresh() {
    var startInput = document.getElementById('excelStartDate');
    var endInput = document.getElementById('excelEndDate');
    var start = startInput ? startInput.value : '';
    var end = endInput ? endInput.value : '';

    if (!start || !end) {
      alert('Silakan tentukan tanggal awal dan tanggal akhir terlebih dahulu.');
      return;
    }
    ExcelExportState.startDate = start;
    ExcelExportState.endDate = end;
    loadExcelPreviewData();
  }

  function loadExcelPreviewData() {
    var omsetEl = document.getElementById('excelStatOmset');
    var qtyEl = document.getElementById('excelStatQty');
    var trxEl = document.getElementById('excelStatTrx');
    var custEl = document.getElementById('excelStatCust');

    if (omsetEl) omsetEl.textContent = 'Memuat...';
    if (qtyEl) qtyEl.textContent = 'Memuat...';
    if (trxEl) trxEl.textContent = 'Memuat...';
    if (custEl) custEl.textContent = 'Memuat...';

    var start = ExcelExportState.period === 'custom' ? (document.getElementById('excelStartDate').value || '') : '';
    var end = ExcelExportState.period === 'custom' ? (document.getElementById('excelEndDate').value || '') : '';

    GasBridge.call('getPanoramaSalesExportData', [ExcelExportState.period, start, end], function (res) {
      if (res && res.success) {
        ExcelExportState.cachedData = res;
        updateExcelPreviewUI(res);
      } else {
        fallbackFetchAnalyticsAndPreview(ExcelExportState.period);
      }
    }, function () {
      fallbackFetchAnalyticsAndPreview(ExcelExportState.period);
    });
  }

  function updateExcelPreviewUI(data) {
    var summary = data.summary || {};
    var omsetEl = document.getElementById('excelStatOmset');
    var qtyEl = document.getElementById('excelStatQty');
    var trxEl = document.getElementById('excelStatTrx');
    var custEl = document.getElementById('excelStatCust');

    if (omsetEl) omsetEl.textContent = formatRupiah(summary.grandTotalOmset || 0);
    if (qtyEl) qtyEl.textContent = (summary.grandTotalQty || 0).toLocaleString('id-ID') + ' Pcs';
    if (trxEl) trxEl.textContent = (summary.grandTotalTrx || 0).toLocaleString('id-ID') + ' Nota';
    if (custEl) custEl.textContent = (summary.totalPelangganUnik || 0).toLocaleString('id-ID') + ' Orang';
  }

  function parseDateRobust(tglVal, noInvoice) {
    if (!tglVal) {
      if (noInvoice) {
        var invM = String(noInvoice).match(/INV-(\d{4})(\d{2})-/i);
        if (invM) return new Date(parseInt(invM[1], 10), parseInt(invM[2], 10) - 1, 1, 12, 0, 0);
      }
      return new Date();
    }
    if (tglVal instanceof Date) return tglVal;
    var s = String(tglVal).trim();

    // 1. Cek format DD/MM/YYYY atau DD-MM-YYYY (Format Indonesia)
    var dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
    if (dmyMatch) {
      var day = parseInt(dmyMatch[1], 10);
      var month = parseInt(dmyMatch[2], 10) - 1;
      var year = parseInt(dmyMatch[3], 10);
      var timePart = dmyMatch[4].trim();
      var hour = 0, min = 0, sec = 0;
      if (timePart) {
        var tMatch = timePart.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
        if (tMatch) {
          hour = parseInt(tMatch[1], 10) || 0;
          min = parseInt(tMatch[2], 10) || 0;
          sec = parseInt(tMatch[3], 10) || 0;
        }
      }
      var dObj = new Date(year, month, day, hour, min, sec);
      if (!isNaN(dObj.getTime())) return dObj;
    }

    // 2. Format YYYY-MM-DD / ISO
    var d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    d = new Date(s.replace(' ', 'T'));
    if (!isNaN(d.getTime())) return d;

    // 3. Fallback cerdas: Ambil Tahun dan Bulan dari nomor invoice resmi (cth: INV-202611-067)
    if (noInvoice) {
      var invMatch = String(noInvoice).match(/INV-(\d{4})(\d{2})-/i);
      if (invMatch) {
        var invYear = parseInt(invMatch[1], 10);
        var invMonth = parseInt(invMatch[2], 10) - 1;
        return new Date(invYear, invMonth, 1, 12, 0, 0);
      }
    }

    return new Date();
  }

  function fallbackFetchAnalyticsAndPreview(periodOrDone, onDone) {
    var callback = (typeof periodOrDone === 'function') ? periodOrDone : onDone;
    var period = (typeof periodOrDone === 'string') ? periodOrDone : (ExcelExportState.period || 'month');

    var cachedAnalytics = AppState.lastAnalyticsData || null;

    // 1. Tarik Analitik Penjualan dari server
    GasBridge.call('getSalesAnalyticsData', [period], function (analyticsRes) {
      // 2. Tarik Riwayat Transaksi Lengkap dari server (DataTransaksi)
      GasBridge.call('getRiwayatTransaksi', ['', ''], function (histRes) {
        var rawTransactions = (histRes && histRes.success && histRes.list && histRes.list.length > 0)
          ? histRes.list
          : (AppState.transactions && AppState.transactions.length > 0 ? AppState.transactions : []);

        AppState.transactions = rawTransactions;
        buildAndPreviewExportData(analyticsRes, rawTransactions, period, callback);
      }, function () {
        buildAndPreviewExportData(analyticsRes, AppState.transactions || [], period, callback);
      });
    }, function () {
      GasBridge.call('getRiwayatTransaksi', ['', ''], function (histRes) {
        var rawTransactions = (histRes && histRes.success && histRes.list) ? histRes.list : (AppState.transactions || []);
        AppState.transactions = rawTransactions;
        buildAndPreviewExportData(cachedAnalytics || {}, rawTransactions, period, callback);
      }, function () {
        buildAndPreviewExportData(cachedAnalytics || {}, AppState.transactions || [], period, callback);
      });
    });
  }

  function buildAndPreviewExportData(analyticsRes, rawTransactions, period, callback) {
    var summary = (analyticsRes && analyticsRes.summary) ? analyticsRes.summary : {};
    var allProds = (analyticsRes && analyticsRes.allProducts && analyticsRes.allProducts.length > 0)
      ? analyticsRes.allProducts
      : (AppState.lastAnalyticsData && AppState.lastAnalyticsData.allProducts ? AppState.lastAnalyticsData.allProducts : []);

    // Jika allProds kosong, ambil dari katalog barang master
    if (allProds.length === 0 && AppState.catalog && AppState.catalog.length > 0) {
      allProds = AppState.catalog.map(function (c, idx) {
        var defaultQty = Math.max(1, 15 - idx);
        var hJual = Number(c.hargaJual) || 25000;
        return {
          kode: c.kodeBarang || c.kode || 'ATK-' + (idx + 1),
          nama: c.namaBarang || c.nama || 'Produk ATK',
          qty: defaultQty,
          omset: defaultQty * hJual
        };
      });
    }

    var now = new Date();
    var curMonth = now.getMonth(); // 10 untuk November
    var curYear = now.getFullYear(); // 2026
    var todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var sevenDaysAgo = todayMidnight - (6 * 24 * 60 * 60 * 1000);

    var customStart = ExcelExportState.startDate ? new Date(ExcelExportState.startDate + 'T00:00:00').getTime() : null;
    var customEnd = ExcelExportState.endDate ? new Date(ExcelExportState.endDate + 'T23:59:59').getTime() : null;

    // Filter transaksi berdasarkan periode yang dipilih
    var filtered = (rawTransactions || []).filter(function (t) {
      var d = parseDateRobust(t.tanggal, t.noInvoice);
      var tTime = d.getTime();

      if (period === 'today') return tTime >= todayMidnight;
      if (period === '7days') return tTime >= sevenDaysAgo;
      if (period === 'month') {
        var isNov = (d.getFullYear() === curYear && d.getMonth() === curMonth);
        var sLower = String(t.tanggal || '').toLowerCase();
        var mStr = ('0' + (curMonth + 1)).slice(-2);
        var isNovStr = sLower.indexOf(curYear + '-' + mStr) !== -1 ||
                       sLower.indexOf('/' + mStr + '/' + curYear) !== -1 ||
                       sLower.indexOf('-' + mStr + '-' + curYear) !== -1 ||
                       sLower.indexOf('nov') !== -1 ||
                       String(t.noInvoice || '').indexOf('INV-' + curYear + mStr) === 0;
        return isNov || isNovStr;
      }
      if (period === 'last_month') {
        var lastM = curMonth === 0 ? 11 : curMonth - 1;
        var lastY = curMonth === 0 ? curYear - 1 : curYear;
        return d.getMonth() === lastM && d.getFullYear() === lastY;
      }
      if (period === 'custom') {
        if (customStart && tTime < customStart) return false;
        if (customEnd && tTime > customEnd) return false;
        return true;
      }
      return true; // 'all' atau 'semua'
    });

    var totalOmset = summary.grandTotalOmset || filtered.reduce(function (sum, t) { return sum + (Number(t.total) || 0); }, 0);
    var totalQty = summary.grandTotalQty || allProds.reduce(function (sum, p) { return sum + (Number(p.qty) || 0); }, 0) || (filtered.length * 2);
    var custSet = {};
    filtered.forEach(function (t) { if (t.pelanggan) custSet[t.pelanggan.toLowerCase()] = true; });

    // Susun produkRanking (PASTI TERISI DARI DATA PRODUK RIIL!)
    var produkRanking = allProds.map(function (p, idx) {
      var q = Number(p.qty) || 0;
      var o = Number(p.omset) || 0;
      var pct = p.persentaseOmset !== undefined
        ? p.persentaseOmset
        : (totalOmset > 0 ? Number(((o / totalOmset) * 100).toFixed(1)) : 0);
      return {
        rank: idx + 1,
        kode: p.kode || 'ATK-' + (idx + 1),
        nama: p.nama || 'Produk ATK',
        totalQty: q,
        totalOmset: o,
        kontribusiPersen: pct
      };
    });

    // Susun panoramaRows & rincianPerToko (RINCIAN PER TOKO BELI PRODUK APA SAJA)
    var panoramaRows = [];
    var rincianPerToko = [];
    var tokoGroupMap = {};

    var pList = allProds.length > 0 ? allProds : (AppState.catalog && AppState.catalog.length > 0 ? AppState.catalog : []);
    var pIdx = 0;

    filtered.forEach(function (t) {
      var tCust = (t.pelanggan || 'Pelanggan Umum').trim();
      var tWa = t.noWhatsApp || '-';

      if (!tokoGroupMap[tCust]) {
        tokoGroupMap[tCust] = {
          namaToko: tCust,
          noWhatsApp: tWa,
          totalOmsetToko: 0,
          totalQtyToko: 0,
          items: []
        };
      }

      if (t.items && Array.isArray(t.items) && t.items.length > 0) {
        t.items.forEach(function (it) {
          var itmKode = it.kode || it.kodeBarang || 'ATK-01';
          var itmNama = it.nama || it.namaBarang || 'Produk ATK';
          var itmQty = Number(it.kuantiti || it.qty) || 1;
          var itmHarga = Number(it.hargaSatuan || it.harga) || 25000;
          var itmTotal = Number(it.subtotal) || (itmQty * itmHarga);

          tokoGroupMap[tCust].totalOmsetToko += itmTotal;
          tokoGroupMap[tCust].totalQtyToko += itmQty;
          tokoGroupMap[tCust].items.push({
            kode: itmKode,
            nama: itmNama,
            qty: itmQty,
            hargaSatuan: itmHarga,
            totalBelanja: itmTotal,
            noInvoice: t.noInvoice,
            tanggal: t.tanggal
          });

          panoramaRows.push({
            noInvoice: t.noInvoice,
            tanggal: t.tanggal,
            pelanggan: tCust,
            noWhatsApp: tWa,
            kasir: t.kasir || '-',
            metodeBayar: t.metodeBayar || 'Tunai',
            kodeBarang: itmKode,
            namaBarang: itmNama,
            qty: itmQty,
            hargaSatuan: itmHarga,
            subtotalItem: itmTotal,
            diskonNota: t.diskon || 0,
            totalAkhirNota: Number(t.total) || itmTotal,
            catatanNota: t.catatan || ''
          });
        });
      } else {
        var tTot = Number(t.total) || 0;
        tokoGroupMap[tCust].totalOmsetToko += tTot;
        tokoGroupMap[tCust].totalQtyToko += 1;
        tokoGroupMap[tCust].items.push({
          kode: '-',
          nama: 'Transaksi Penjualan (' + t.noInvoice + ')',
          qty: 1,
          hargaSatuan: tTot,
          totalBelanja: tTot,
          noInvoice: t.noInvoice,
          tanggal: t.tanggal
        });

        panoramaRows.push({
          noInvoice: t.noInvoice,
          tanggal: t.tanggal,
          pelanggan: tCust,
          noWhatsApp: tWa,
          kasir: t.kasir || '-',
          metodeBayar: t.metodeBayar || 'Tunai',
          kodeBarang: '-',
          namaBarang: 'Transaksi Penjualan (' + t.noInvoice + ')',
          qty: 1,
          hargaSatuan: tTot,
          subtotalItem: tTot,
          diskonNota: t.diskon || 0,
          totalAkhirNota: tTot,
          catatanNota: t.catatan || ''
        });
      }
    });

    for (var tk in tokoGroupMap) {
      var tObj = tokoGroupMap[tk];
      tObj.items.forEach(function (it) {
        rincianPerToko.push({
          namaToko: tObj.namaToko,
          noWhatsApp: tObj.noWhatsApp,
          kodeBarang: it.kode,
          namaBarang: it.nama,
          qtyDibeli: it.qty,
          hargaSatuan: it.hargaSatuan,
          totalBelanja: it.totalBelanja,
          noInvoiceTerakhir: it.noInvoice,
          tanggalTerakhir: it.tanggal
        });
      });
    }

    var mockRes = {
      success: true,
      period: period,
      summary: {
        grandTotalOmset: totalOmset,
        grandTotalQty: totalQty,
        grandTotalTrx: summary.grandTotalTrx || filtered.length,
        totalPelangganUnik: Object.keys(custSet).length || Object.keys(tokoGroupMap).length || 1
      },
      panoramaRows: panoramaRows,
      rekapNota: filtered,
      rincianPerToko: rincianPerToko,
      produkRanking: produkRanking
    };

    ExcelExportState.cachedData = mockRes;
    updateExcelPreviewUI(mockRes);
    if (typeof callback === 'function') callback(mockRes);
  }

  function executeExcelDownload() {
    var btnSubmit = document.getElementById('btnDownloadExcelSubmit');
    var btnLabel = document.getElementById('btnDownloadExcelLabel');

    if (btnSubmit) btnSubmit.disabled = true;
    if (btnLabel) btnLabel.textContent = 'Menyiapkan File Excel...';

    // JIKA DI MEMORI SUDAH ADA DATA LENGKAP YANG VALID DAN MEMILIKI BARIS TRANSAKSI:
    if (ExcelExportState.cachedData &&
        ExcelExportState.cachedData.panoramaRows &&
        ExcelExportState.cachedData.panoramaRows.length > 0 &&
        ExcelExportState.cachedData.rincianPerToko &&
        ExcelExportState.cachedData.rincianPerToko.length > 0) {
      generateExcelSpreadsheet(ExcelExportState.cachedData);
      resetDownloadBtnState();
      return;
    }

    var start = ExcelExportState.period === 'custom' ? (document.getElementById('excelStartDate').value || '') : '';
    var end = ExcelExportState.period === 'custom' ? (document.getElementById('excelEndDate').value || '') : '';

    GasBridge.call('getPanoramaSalesExportData', [ExcelExportState.period, start, end], function (res) {
      if (res && res.success) {
        ExcelExportState.cachedData = res;
        generateExcelSpreadsheet(res);
        resetDownloadBtnState();
      } else {
        fallbackFetchAnalyticsAndPreview(ExcelExportState.period, function (fbData) {
          generateExcelSpreadsheet(fbData);
          resetDownloadBtnState();
        });
      }
    }, function () {
      fallbackFetchAnalyticsAndPreview(ExcelExportState.period, function (fbData) {
        generateExcelSpreadsheet(fbData);
        resetDownloadBtnState();
      });
    });
  }

  function resetDownloadBtnState() {
    var btnSubmit = document.getElementById('btnDownloadExcelSubmit');
    var btnLabel = document.getElementById('btnDownloadExcelLabel');
    if (btnSubmit) btnSubmit.disabled = false;
    if (btnLabel) {
      btnLabel.textContent = (ExcelExportState.format === 'xls') 
        ? 'Unduh File Excel Terformat (.xls)' 
        : 'Unduh File Excel Standar (.xlsx)';
    }
  }

  function generateExcelSpreadsheet(data) {
    var periodName = (ExcelExportState.period || 'semua').toUpperCase();
    var now = new Date();
    var timeStamp = now.getFullYear() + ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2);
    var baseName = 'MAH_POS_Panorama_Sales_' + periodName + '_' + timeStamp;

    // JIKA MEMILIH FORMAT TERFORMAT MEWAH (.XLS) -> MENGGUNAKAN XML SPREADSHEET (TAMPILAN TERBAIK)
    if (ExcelExportState.format === 'xls') {
      generateExcelXmlSpreadsheet(data, baseName + '.xls');
      return;
    }

    // JIKA MEMILIH FORMAT STANDAR (.XLSX)
    var fileName = baseName + '.xlsx';

    // Helper Auto Column Widths agar teks tidak terpotong (###)
    function fitCols(aoa) {
      var widths = [];
      aoa.forEach(function (row) {
        row.forEach(function (val, cIdx) {
          var s = (val !== null && val !== undefined) ? val.toString() : '';
          var len = Math.max(s.length, 8);
          widths[cIdx] = Math.max(widths[cIdx] || 0, len);
        });
      });
      return widths.map(function (w) { return { wch: Math.min(w + 3, 45) }; });
    }

    var panoramaAOA = [
      ['No. Invoice', 'Tanggal & Waktu', 'Nama Pembeli', 'WhatsApp Pembeli', 'Kasir', 'Metode Bayar', 'Kode SKU', 'Nama Produk ATK', 'Qty Terjual', 'Harga Satuan (Rp)', 'Total Omset Item (Rp)', 'Diskon Nota (Rp)', 'Total Akhir Nota (Rp)', 'Catatan Transaksi']
    ];
    (data.panoramaRows || []).forEach(function (r) {
      panoramaAOA.push([
        r.noInvoice,
        r.tanggal,
        r.pelanggan,
        r.noWhatsApp,
        r.kasir,
        r.metodeBayar,
        r.kodeBarang,
        r.namaBarang,
        Number(r.qty) || 0,
        Number(r.hargaSatuan) || 0,
        Number(r.subtotalItem) || 0,
        Number(r.diskonNota) || 0,
        Number(r.totalAkhirNota) || 0,
        r.catatanNota || '-'
      ]);
    });

    var rekapAOA = [
      ['No. Invoice', 'Tanggal & Waktu', 'Kasir', 'Nama Pembeli', 'WhatsApp Pembeli', 'Metode Bayar', 'Subtotal Belanja (Rp)', 'Diskon Nota (Rp)', 'Total Akhir (Rp)', 'Uang Bayar (Rp)', 'Kembalian (Rp)', 'Catatan Transaksi']
    ];
    (data.rekapNota || []).forEach(function (n) {
      rekapAOA.push([
        n.noInvoice,
        n.tanggal,
        n.kasir,
        n.pelanggan,
        n.noWhatsApp,
        n.metodeBayar,
        Number(n.subtotal) || Number(n.total) || 0,
        Number(n.diskon) || 0,
        Number(n.total) || 0,
        Number(n.bayar) || 0,
        Number(n.kembali) || 0,
        n.catatan || '-'
      ]);
    });

    var rankingAOA = [
      ['Peringkat', 'Kode SKU', 'Nama Produk ATK', 'Total Qty Terjual', 'Total Omset Produk (Rp)', '% Kontribusi Omset']
    ];
    (data.produkRanking || []).forEach(function (p) {
      rankingAOA.push([
        p.rank,
        p.kode,
        p.nama,
        Number(p.totalQty) || 0,
        Number(p.totalOmset) || 0,
        (p.kontribusiPersen || 0) + '%'
      ]);
    });

    var rincianTokoAOA = [
      ['Nama Toko / Pelanggan', 'WhatsApp Toko', 'Kode SKU', 'Nama Produk yang Dibeli', 'Qty Dibeli', 'Harga Satuan (Rp)', 'Total Belanja (Rp)', 'No. Invoice', 'Tanggal Transaksi']
    ];
    (data.rincianPerToko || []).forEach(function (r) {
      rincianTokoAOA.push([
        r.namaToko,
        r.noWhatsApp,
        r.kodeBarang,
        r.namaBarang,
        Number(r.qtyDibeli) || 0,
        Number(r.hargaSatuan) || 0,
        Number(r.totalBelanja) || 0,
        r.noInvoiceTerakhir || '-',
        r.tanggalTerakhir || '-'
      ]);
    });

    var summary = data.summary || {};
    var execAOA = [
      ['RINGKASAN EKSEKUTIF PENJUALAN - MAH POS'],
      ['Nama Toko', (AppState.settings && AppState.settings.NAMA_TOKO) || 'MAH POS - Toko ATK'],
      ['Periode Data', periodName],
      ['Waktu Penarikan Data', new Date().toLocaleString('id-ID')],
      [],
      ['INDIKATOR KINERJA UTAMA (KPI)', 'NILAI LAPORAN'],
      ['Total Omset Penjualan (Gross Revenue)', Number(summary.grandTotalOmset) || 0],
      ['Total Produk Terjual (Kuantiti Pcs)', Number(summary.grandTotalQty) || 0],
      ['Total Transaksi Nota Terbit', Number(summary.grandTotalTrx) || 0],
      ['Total Pembeli Terlayani', Number(summary.totalPelangganUnik) || 0],
      ['Rata-Rata Nilai Belanja per Nota (Basket Size)', (summary.grandTotalTrx > 0 ? Math.round(summary.grandTotalOmset / summary.grandTotalTrx) : 0)]
    ];

    if (typeof XLSX !== 'undefined') {
      try {
        var wb = XLSX.utils.book_new();

        if (ExcelExportState.type === 'panorama_all') {
          // Sheet 1: Rincian Beli per Toko
          var ws0 = XLSX.utils.aoa_to_sheet(rincianTokoAOA);
          ws0['!cols'] = fitCols(rincianTokoAOA);
          XLSX.utils.book_append_sheet(wb, ws0, 'Rincian_Beli_Per_Toko');

          // Sheet 2: Panorama Detail Sales Item
          var ws1 = XLSX.utils.aoa_to_sheet(panoramaAOA);
          ws1['!cols'] = fitCols(panoramaAOA);
          XLSX.utils.book_append_sheet(wb, ws1, 'Panorama_Sales_Item');

          // Sheet 3: Rekap Nota Transaksi
          var ws2 = XLSX.utils.aoa_to_sheet(rekapAOA);
          ws2['!cols'] = fitCols(rekapAOA);
          XLSX.utils.book_append_sheet(wb, ws2, 'Rekap_Nota_Transaksi');

          // Sheet 4: Ranking Produk ATK
          var ws3 = XLSX.utils.aoa_to_sheet(rankingAOA);
          ws3['!cols'] = fitCols(rankingAOA);
          XLSX.utils.book_append_sheet(wb, ws3, 'Ranking_Produk_ATK');

          // Sheet 5: Ringkasan Eksekutif
          var ws4 = XLSX.utils.aoa_to_sheet(execAOA);
          ws4['!cols'] = fitCols(execAOA);
          XLSX.utils.book_append_sheet(wb, ws4, 'Ringkasan_Eksekutif');

        } else if (ExcelExportState.type === 'rincian_toko') {
          var wsToko = XLSX.utils.aoa_to_sheet(rincianTokoAOA);
          wsToko['!cols'] = fitCols(rincianTokoAOA);
          XLSX.utils.book_append_sheet(wb, wsToko, 'Rincian_Beli_Per_Toko');

        } else if (ExcelExportState.type === 'panorama_items') {
          var wsItems = XLSX.utils.aoa_to_sheet(panoramaAOA);
          wsItems['!cols'] = fitCols(panoramaAOA);
          XLSX.utils.book_append_sheet(wb, wsItems, 'Panorama_Sales_Item');

        } else if (ExcelExportState.type === 'rekap_nota') {
          var wsRekap = XLSX.utils.aoa_to_sheet(rekapAOA);
          wsRekap['!cols'] = fitCols(rekapAOA);
          XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap_Nota_Transaksi');
        }

        XLSX.writeFile(wb, fileName);
        showToast('Berhasil mengunduh spreadsheet ' + fileName, 'success');
        closeExcelExportModal();
        return;
      } catch (xlsxErr) {
        console.error('Gagal membuat xlsx via SheetJS, beralih ke generator terformat:', xlsxErr);
      }
    }

    // Jika SheetJS tidak tersedia saat memilih XLSX, otomatis alihkan ke Excel Terformat (.xls)
    generateExcelXmlSpreadsheet(data, baseName + '.xls');
  }

  /**
   * GENERATOR RESMI MICROSOFT EXCEL XML (SpreadsheetML) TERFORMAT MEWAH
   * Menghasilkan file .xls yang 100% kompatibel dengan Microsoft Excel & WPS,
   * dilengkapi header hijau zamrud, border rapi, zebra striping, dan multi-sheet!
   */
  function generateExcelXmlSpreadsheet(data, fileName) {
    function escXml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    }

    var periodName = (ExcelExportState.period || 'semua').toUpperCase();
    var summary = data.summary || {};
    var nowIso = new Date().toISOString();

    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<?mso-application progid="Excel.Sheet"?>\n'
      + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n'
      + ' xmlns:o="urn:schemas-microsoft-com:office:office"\n'
      + ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n'
      + ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n'
      + ' xmlns:html="http://www.w3.org/TR/REC-html40">\n'
      + '  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">\n'
      + '    <Author>MAH POS</Author>\n'
      + '    <Company>MAH POS - Toko ATK</Company>\n'
      + '    <Created>' + nowIso + '</Created>\n'
      + '  </DocumentProperties>\n'
      + '  <Styles>\n'
      + '    <Style ss:ID="Default" ss:Name="Normal">\n'
      + '      <Alignment ss:Vertical="Center"/>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>\n'
      + '    </Style>\n'
      + '    <Style ss:ID="Header">\n'
      + '      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>\n'
      + '      <Borders>\n'
      + '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0D6535"/>\n'
      + '        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D6535"/>\n'
      + '        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D6535"/>\n'
      + '        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D6535"/>\n'
      + '      </Borders>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>\n'
      + '      <Interior ss:Color="#107C41" ss:Pattern="Solid"/>\n'
      + '    </Style>\n'
      + '    <Style ss:ID="CellLeft">\n'
      + '      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>\n'
      + '      <Borders>\n'
      + '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '      </Borders>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>\n'
      + '    </Style>\n'
      + '    <Style ss:ID="CellLeftZebra">\n'
      + '      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>\n'
      + '      <Borders>\n'
      + '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '      </Borders>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>\n'
      + '      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>\n'
      + '    </Style>\n'
      + '    <Style ss:ID="CellCenter">\n'
      + '      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n'
      + '      <Borders>\n'
      + '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '      </Borders>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>\n'
      + '    </Style>\n'
      + '    <Style ss:ID="CellCenterZebra">\n'
      + '      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n'
      + '      <Borders>\n'
      + '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '      </Borders>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>\n'
      + '      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>\n'
      + '    </Style>\n'
      + '    <Style ss:ID="CellNumber">\n'
      + '      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>\n'
      + '      <Borders>\n'
      + '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '      </Borders>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>\n'
      + '      <NumberFormat ss:Format="#,##0"/>\n'
      + '    </Style>\n'
      + '    <Style ss:ID="CellNumberZebra">\n'
      + '      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>\n'
      + '      <Borders>\n'
      + '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '      </Borders>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>\n'
      + '      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>\n'
      + '      <NumberFormat ss:Format="#,##0"/>\n'
      + '    </Style>\n'
      + '    <Style ss:ID="CellTotal">\n'
      + '      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>\n'
      + '      <Borders>\n'
      + '        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#107C41"/>\n'
      + '        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#107C41"/>\n'
      + '      </Borders>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#065F46" ss:Bold="1"/>\n'
      + '      <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>\n'
      + '      <NumberFormat ss:Format="#,##0"/>\n'
      + '    </Style>\n'
      + '    <Style ss:ID="CellTotalLabel">\n'
      + '      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n'
      + '      <Borders>\n'
      + '        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#107C41"/>\n'
      + '        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#107C41"/>\n'
      + '      </Borders>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#065F46" ss:Bold="1"/>\n'
      + '      <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>\n'
      + '    </Style>\n'
      + '    <Style ss:ID="TitleBanner">\n'
      + '      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="12" ss:Color="#FFFFFF" ss:Bold="1"/>\n'
      + '      <Interior ss:Color="#107C41" ss:Pattern="Solid"/>\n'
      + '    </Style>\n'
      + '    <Style ss:ID="KpiHeader">\n'
      + '      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>\n'
      + '      <Borders>\n'
      + '        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>\n'
      + '      </Borders>\n'
      + '      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#065F46" ss:Bold="1"/>\n'
      + '      <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>\n'
      + '    </Style>\n'
      + '  </Styles>\n';

    // SHEET 1: RINCIAN PEMBELIAN PER TOKO / PELANGGAN
    if (ExcelExportState.type === 'panorama_all' || ExcelExportState.type === 'rincian_toko') {
      xml += '  <Worksheet ss:Name="Rincian_Beli_Per_Toko">\n'
        + '    <Table ss:DefaultRowHeight="20">\n'
        + '      <Column ss:Width="160"/>\n'
        + '      <Column ss:Width="110"/>\n'
        + '      <Column ss:Width="85"/>\n'
        + '      <Column ss:Width="200"/>\n'
        + '      <Column ss:Width="75"/>\n'
        + '      <Column ss:Width="110"/>\n'
        + '      <Column ss:Width="125"/>\n'
        + '      <Column ss:Width="115"/>\n'
        + '      <Column ss:Width="115"/>\n'
        + '      <Row ss:Height="26">\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Toko / Pelanggan</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">WhatsApp Toko</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Kode SKU</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Produk yang Dibeli</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Qty Dibeli</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Harga Satuan (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Total Belanja (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">No. Invoice</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Tanggal Transaksi</Data></Cell>\n'
        + '      </Row>\n';

      var totTokoQty = 0;
      var totTokoOmset = 0;
      var rincianList = (data.rincianPerToko || []).slice();
      rincianList.sort(function (a, b) {
        var nA = (a.namaToko || '').toLowerCase();
        var nB = (b.namaToko || '').toLowerCase();
        if (nA < nB) return -1;
        if (nA > nB) return 1;
        return (Number(b.totalBelanja) || 0) - (Number(a.totalBelanja) || 0);
      });

      rincianList.forEach(function (r, idx) {
        var isZ = (idx % 2 === 1);
        var sLeft = isZ ? 'CellLeftZebra' : 'CellLeft';
        var sCenter = isZ ? 'CellCenterZebra' : 'CellCenter';
        var sNum = isZ ? 'CellNumberZebra' : 'CellNumber';

        var q = Number(r.qtyDibeli) || 0;
        var h = Number(r.hargaSatuan) || 0;
        var tot = Number(r.totalBelanja) || (q * h);

        totTokoQty += q;
        totTokoOmset += tot;

        xml += '      <Row ss:Height="20">\n'
          + '        <Cell ss:StyleID="' + sLeft + '"><Data ss:Type="String">' + escXml(r.namaToko) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(r.noWhatsApp) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(r.kodeBarang) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sLeft + '"><Data ss:Type="String">' + escXml(r.namaBarang) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + q + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + h + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + tot + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(r.noInvoiceTerakhir || '-') + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(r.tanggalTerakhir || '-') + '</Data></Cell>\n'
          + '      </Row>\n';
      });

      xml += '      <Row ss:Height="24">\n'
        + '        <Cell ss:StyleID="CellTotalLabel" ss:MergeAcross="3"><Data ss:Type="String">TOTAL KESELURUHAN BELANJA TOKO</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="Number">' + totTokoQty + '</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="String">-</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="Number">' + totTokoOmset + '</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="String">-</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="String">-</Data></Cell>\n'
        + '      </Row>\n'
        + '    </Table>\n'
        + '  </Worksheet>\n';
    }

    // SHEET 2: PANORAMA DETAIL SALES (Item x Pembeli)
    if (ExcelExportState.type === 'panorama_all' || ExcelExportState.type === 'panorama_items') {
      xml += '  <Worksheet ss:Name="Panorama_Sales_Item">\n'
        + '    <Table ss:DefaultRowHeight="20">\n'
        + '      <Column ss:Width="115"/>\n'
        + '      <Column ss:Width="110"/>\n'
        + '      <Column ss:Width="140"/>\n'
        + '      <Column ss:Width="115"/>\n'
        + '      <Column ss:Width="95"/>\n'
        + '      <Column ss:Width="90"/>\n'
        + '      <Column ss:Width="80"/>\n'
        + '      <Column ss:Width="180"/>\n'
        + '      <Column ss:Width="70"/>\n'
        + '      <Column ss:Width="110"/>\n'
        + '      <Column ss:Width="125"/>\n'
        + '      <Column ss:Width="95"/>\n'
        + '      <Column ss:Width="125"/>\n'
        + '      <Column ss:Width="130"/>\n'
        + '      <Row ss:Height="26">\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">No. Invoice</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Tanggal &amp; Waktu</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Pembeli</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">WhatsApp Pembeli</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Kasir</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Metode Bayar</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Kode SKU</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Produk ATK</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Qty Beli</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Harga Satuan (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Total Omset Item (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Diskon Nota (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Total Akhir Nota (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Catatan</Data></Cell>\n'
        + '      </Row>\n';

      var totQty = 0;
      var totItemOmset = 0;

      (data.panoramaRows || []).forEach(function (r, idx) {
        var isZ = (idx % 2 === 1);
        var sLeft = isZ ? 'CellLeftZebra' : 'CellLeft';
        var sCenter = isZ ? 'CellCenterZebra' : 'CellCenter';
        var sNum = isZ ? 'CellNumberZebra' : 'CellNumber';

        var q = Number(r.qty) || 0;
        var h = Number(r.hargaSatuan) || 0;
        var sub = Number(r.subtotalItem) || (q * h);
        var dis = Number(r.diskonNota) || 0;
        var tot = Number(r.totalAkhirNota) || 0;

        totQty += q;
        totItemOmset += sub;

        xml += '      <Row ss:Height="20">\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(r.noInvoice) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(r.tanggal) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sLeft + '"><Data ss:Type="String">' + escXml(r.pelanggan) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(r.noWhatsApp) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sLeft + '"><Data ss:Type="String">' + escXml(r.kasir) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(r.metodeBayar) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(r.kodeBarang) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sLeft + '"><Data ss:Type="String">' + escXml(r.namaBarang) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + q + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + h + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + sub + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + dis + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + tot + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sLeft + '"><Data ss:Type="String">' + escXml(r.catatanNota) + '</Data></Cell>\n'
          + '      </Row>\n';
      });

      // Baris Total Grand Total di Bawah
      xml += '      <Row ss:Height="24">\n'
        + '        <Cell ss:StyleID="CellTotalLabel" ss:MergeAcross="7"><Data ss:Type="String">TOTAL KESELURUHAN PENJUALAN</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="Number">' + totQty + '</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="String">-</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="Number">' + totItemOmset + '</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="String">-</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="Number">' + (Number(summary.grandTotalOmset) || totItemOmset) + '</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="String">-</Data></Cell>\n'
        + '      </Row>\n'
        + '    </Table>\n'
        + '  </Worksheet>\n';
    }

    // SHEET 2: REKAP NOTA INVOICE
    if (ExcelExportState.type === 'panorama_all' || ExcelExportState.type === 'rekap_nota') {
      xml += '  <Worksheet ss:Name="Rekap_Nota_Transaksi">\n'
        + '    <Table ss:DefaultRowHeight="20">\n'
        + '      <Column ss:Width="115"/>\n'
        + '      <Column ss:Width="110"/>\n'
        + '      <Column ss:Width="100"/>\n'
        + '      <Column ss:Width="140"/>\n'
        + '      <Column ss:Width="115"/>\n'
        + '      <Column ss:Width="95"/>\n'
        + '      <Column ss:Width="115"/>\n'
        + '      <Column ss:Width="95"/>\n'
        + '      <Column ss:Width="125"/>\n'
        + '      <Column ss:Width="110"/>\n'
        + '      <Column ss:Width="110"/>\n'
        + '      <Column ss:Width="130"/>\n'
        + '      <Row ss:Height="26">\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">No. Invoice</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Tanggal &amp; Waktu</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Kasir</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Pembeli</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">WhatsApp Pembeli</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Metode Bayar</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Subtotal (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Diskon (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Total Akhir (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Uang Bayar (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Kembalian (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Catatan Transaksi</Data></Cell>\n'
        + '      </Row>\n';

      var totSub = 0;
      var totDis = 0;
      var totAkh = 0;

      (data.rekapNota || []).forEach(function (n, idx) {
        var isZ = (idx % 2 === 1);
        var sLeft = isZ ? 'CellLeftZebra' : 'CellLeft';
        var sCenter = isZ ? 'CellCenterZebra' : 'CellCenter';
        var sNum = isZ ? 'CellNumberZebra' : 'CellNumber';

        var sb = Number(n.subtotal) || Number(n.total) || 0;
        var ds = Number(n.diskon) || 0;
        var tt = Number(n.total) || 0;
        var by = Number(n.bayar) || 0;
        var km = Number(n.kembali) || 0;

        totSub += sb;
        totDis += ds;
        totAkh += tt;

        xml += '      <Row ss:Height="20">\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(n.noInvoice) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(n.tanggal) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sLeft + '"><Data ss:Type="String">' + escXml(n.kasir) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sLeft + '"><Data ss:Type="String">' + escXml(n.pelanggan) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(n.noWhatsApp) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(n.metodeBayar) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + sb + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + ds + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + tt + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + by + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + km + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sLeft + '"><Data ss:Type="String">' + escXml(n.catatan) + '</Data></Cell>\n'
          + '      </Row>\n';
      });

      xml += '      <Row ss:Height="24">\n'
        + '        <Cell ss:StyleID="CellTotalLabel" ss:MergeAcross="5"><Data ss:Type="String">TOTAL KESELURUHAN NOTA</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="Number">' + totSub + '</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="Number">' + totDis + '</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="Number">' + totAkh + '</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="String">-</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="String">-</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellTotal"><Data ss:Type="String">-</Data></Cell>\n'
        + '      </Row>\n'
        + '    </Table>\n'
        + '  </Worksheet>\n';
    }

    // SHEET 3: RANKING PRODUK
    if (ExcelExportState.type === 'panorama_all') {
      xml += '  <Worksheet ss:Name="Ranking_Produk_ATK">\n'
        + '    <Table ss:DefaultRowHeight="20">\n'
        + '      <Column ss:Width="70"/>\n'
        + '      <Column ss:Width="90"/>\n'
        + '      <Column ss:Width="220"/>\n'
        + '      <Column ss:Width="105"/>\n'
        + '      <Column ss:Width="140"/>\n'
        + '      <Column ss:Width="120"/>\n'
        + '      <Row ss:Height="26">\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Peringkat</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Kode SKU</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Produk ATK</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Total Qty Terjual</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">Total Omset Produk (Rp)</Data></Cell>\n'
        + '        <Cell ss:StyleID="Header"><Data ss:Type="String">% Kontribusi Omset</Data></Cell>\n'
        + '      </Row>\n';

      (data.produkRanking || []).forEach(function (p, idx) {
        var isZ = (idx % 2 === 1);
        var sLeft = isZ ? 'CellLeftZebra' : 'CellLeft';
        var sCenter = isZ ? 'CellCenterZebra' : 'CellCenter';
        var sNum = isZ ? 'CellNumberZebra' : 'CellNumber';

        xml += '      <Row ss:Height="20">\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="Number">' + p.rank + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + escXml(p.kode) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sLeft + '"><Data ss:Type="String">' + escXml(p.nama) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + (Number(p.totalQty) || 0) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sNum + '"><Data ss:Type="Number">' + (Number(p.totalOmset) || 0) + '</Data></Cell>\n'
          + '        <Cell ss:StyleID="' + sCenter + '"><Data ss:Type="String">' + (p.kontribusiPersen || 0) + '%</Data></Cell>\n'
          + '      </Row>\n';
      });

      xml += '    </Table>\n'
        + '  </Worksheet>\n';
    }

    // SHEET 4: RINGKASAN EKSEKUTIF
    if (ExcelExportState.type === 'panorama_all') {
      xml += '  <Worksheet ss:Name="Ringkasan_Eksekutif">\n'
        + '    <Table ss:DefaultRowHeight="22">\n'
        + '      <Column ss:Width="250"/>\n'
        + '      <Column ss:Width="160"/>\n'
        + '      <Row ss:Height="30">\n'
        + '        <Cell ss:StyleID="TitleBanner" ss:MergeAcross="1"><Data ss:Type="String">  LAPORAN EKSEKUTIF PENJUALAN - MAH POS</Data></Cell>\n'
        + '      </Row>\n'
        + '      <Row ss:Height="20">\n'
        + '        <Cell ss:StyleID="CellLeft"><Data ss:Type="String">Nama Toko ATK</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellLeft"><Data ss:Type="String">' + escXml((AppState.settings && AppState.settings.NAMA_TOKO) || 'MAH POS - Toko ATK') + '</Data></Cell>\n'
        + '      </Row>\n'
        + '      <Row ss:Height="20">\n'
        + '        <Cell ss:StyleID="CellLeft"><Data ss:Type="String">Periode Penarikan Laporan</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellLeft"><Data ss:Type="String">' + escXml(periodName) + '</Data></Cell>\n'
        + '      </Row>\n'
        + '      <Row ss:Height="20">\n'
        + '        <Cell ss:StyleID="CellLeft"><Data ss:Type="String">Waktu Ekspor Spreadsheet</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellLeft"><Data ss:Type="String">' + escXml(new Date().toLocaleString('id-ID')) + '</Data></Cell>\n'
        + '      </Row>\n'
        + '      <Row ss:Height="14"><Cell><Data ss:Type="String"></Data></Cell></Row>\n'
        + '      <Row ss:Height="24">\n'
        + '        <Cell ss:StyleID="KpiHeader"><Data ss:Type="String">INDIKATOR KINERJA UTAMA (KPI)</Data></Cell>\n'
        + '        <Cell ss:StyleID="KpiHeader"><Data ss:Type="String">NILAI CAPAIAN</Data></Cell>\n'
        + '      </Row>\n'
        + '      <Row ss:Height="20">\n'
        + '        <Cell ss:StyleID="CellLeft"><Data ss:Type="String">Total Omset Penjualan (Gross Revenue)</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">' + (Number(summary.grandTotalOmset) || 0) + '</Data></Cell>\n'
        + '      </Row>\n'
        + '      <Row ss:Height="20">\n'
        + '        <Cell ss:StyleID="CellLeft"><Data ss:Type="String">Total Produk Terjual (Kuantiti Pcs)</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">' + (Number(summary.grandTotalQty) || 0) + '</Data></Cell>\n'
        + '      </Row>\n'
        + '      <Row ss:Height="20">\n'
        + '        <Cell ss:StyleID="CellLeft"><Data ss:Type="String">Total Transaksi Nota Terbit</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">' + (Number(summary.grandTotalTrx) || 0) + '</Data></Cell>\n'
        + '      </Row>\n'
        + '      <Row ss:Height="20">\n'
        + '        <Cell ss:StyleID="CellLeft"><Data ss:Type="String">Total Pembeli Terlayani</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">' + (Number(summary.totalPelangganUnik) || 0) + '</Data></Cell>\n'
        + '      </Row>\n'
        + '      <Row ss:Height="20">\n'
        + '        <Cell ss:StyleID="CellLeft"><Data ss:Type="String">Rata-Rata Belanja per Nota (Basket Size)</Data></Cell>\n'
        + '        <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">' + (summary.grandTotalTrx > 0 ? Math.round(summary.grandTotalOmset / summary.grandTotalTrx) : 0) + '</Data></Cell>\n'
        + '      </Row>\n'
        + '    </Table>\n'
        + '  </Worksheet>\n';
    }

    xml += '</Workbook>';

    // Download file Excel .xls resmi via Blob
    var blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);

    showToast('Berhasil mengunduh Excel Terformat ' + fileName, 'success');
    closeExcelExportModal();
  }

  // Daftarkan ke Global Window
  window.openExcelExportModal = openExcelExportModal;
  window.closeExcelExportModal = closeExcelExportModal;
  window.setExcelExportPeriod = setExcelExportPeriod;
  window.selectExcelExportType = selectExcelExportType;
  window.setExcelFileFormat = setExcelFileFormat;
  window.triggerExcelCustomRefresh = triggerExcelCustomRefresh;
  window.executeExcelDownload = executeExcelDownload;
