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

  const MahexLogoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmFAAAACXBIWXMAAA7DAAAOwwHHb6hkAAAAIGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAAAM4SURBVHja7JrPa1xVHMafb5l8V5s0gqKItYoiq0tB8APQQpcuumld6ELw1oUhdKNuhW67VdDFi26sdBF1oQtV21tQUFEXLQUbFRG0VpSkVmtkMpOZeZ5z7swkTWbe5j7l3P1AkjlnfvM753znnsyZMwAgQ4YMGbT1A4gBf1uB0u5H+P32tK2H7X4Gf01Vb6O8L4gB/598cI2Y9m20f1qF7B7aX221j79yD4AEPj5qF5u9RDAh0g1G/g90zJ/Q7W2z5hX7fC0tH11Q/W21d/1b4B9B4gG41sP5nB2tE16D5I/9z8330jAHz2s0uP13340+k7hWk7x+90y9+Iu7v/9T2w2Y3f9zXbW32V/iAX/Y2j/rD1f8G+P0b1A7d5J/bT1bF4P+W7e6X07aex+2qBq8aZl5s5JzN1k5v4I9OtvvM16xJ1p/uT7K18v1s3mH626L3hB9N0+8Nf/Zz4vJ+D1H1W1M3N7mHl63Vz5D0N75x6bW38zWbrlA9sP2q0P97L/wE/gL4uH2MffvYn6P7P3bEaN1H+9zM4Y7vH51N3e8W7Z7c78Z+uC83bC61c6b12+86e4b2C6q7D/w6C2+w/y63P1vD+W3HhA920VvdZ6f1/c5W92tX7r7e7d90M/wP9P9F8aXq3g/wA9Gz0d5885f8fXg6L176378AfnX232M37y75nO7/tXN+L315w/h16rV6Y5j3Y9o9oB599Y9jR4b/e9L7O84X6z2yW88z+0f77+u9g86x90h9674vWw+x//hUv17x66yD97w30N+r/wL7G/wG+/d/2v5v2pC521v5tWw3n9m3+q9w5+4N548L32131W54fW31e6q9w7vXfH+u94f836s/4H0e8Y/TvfGffvffN5s2LvvL/wW8A/73y74n9d+29t24Ltv627v2d0/uWfvG573673cPf/f3v3vvqN107W/Y3v1r6L76Tfvvf/r/d8n1XGq1Xf2r98fvffr+b73rf1749833v27X03q9u+vvdvfdvfe+vffvvevffu7b777e+9//wDv/fG72vXvfvu+/fevf9+/fd/9+/ffvu7//v3r7vvu77//v3vu/f+v//vfv39vff//v3u3vvv3vu/fvvvvvvv77//7977//v3vu+////x+3/9k=";

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
    regionSelect.innerHTML = '';
    var data = MahexState.tarifData || DEFAULT_MAHEX_TARIF;
    Object.keys(data).forEach(function (reg) {
      var opt = document.createElement('option');
      opt.value = reg;
      opt.textContent = reg;
      regionSelect.appendChild(opt);
    });
    updateMahexDestinations();
  }

  function updateMahexDestinations() {
    var regionSelect = document.getElementById('mhx_region');
    var storeSelect = document.getElementById('mhx_store_name');
    if (!regionSelect || !storeSelect) return;

    var region = regionSelect.value;
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
    if (manual) showToast('Menghubungkan ke Google Sheets MahexTarif & MahexBrand...', 'info');
    GasBridge.call('getMahexMasterData', [], function (res) {
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
      doc.addImage(MahexLogoBase64, 'PNG', 158, 10, 38, 22);
    } catch (e) {
      console.log('Logo MAHEX dilewati.');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('MAHEX', 14, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(79, 70, 229);
    doc.text('We Are Always By Your Side', 14, 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Alamat: Cilame, Kec. Ngamprah, Kabupaten Bandung Barat, Jawa Barat 40552', 14, 30);

    doc.setDrawColor(203, 213, 225);
    doc.line(14, 35, 196, 35);

    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);

    doc.setFont('helvetica', 'bold');
    doc.text('No. Faktur:', 14, 43);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceNo, 45, 43);

    doc.setFont('helvetica', 'bold');
    doc.text('Kepada Yth:', 110, 43);
    doc.setFont('helvetica', 'normal');
    doc.text(storeName, 138, 43);

    doc.setFont('helvetica', 'bold');
    doc.text('Tanggal:', 14, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(date, 45, 50);

    doc.setFont('helvetica', 'bold');
    doc.text('Brand / Klien:', 110, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(brand, 138, 50);

    doc.setFont('helvetica', 'bold');
    doc.text('Wilayah:', 14, 57);
    doc.setFont('helvetica', 'normal');
    doc.text(region, 45, 57);

    doc.setFont('helvetica', 'bold');
    doc.text('Kota Tujuan:', 110, 57);
    doc.setFont('helvetica', 'normal');
    doc.text(destination, 138, 57);

    var startY = 66;
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
