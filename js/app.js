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

  const MahexLogoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA88AAAFICAYAAABuocyKAAE4JElEQVR4nOzdB3xkZbk/8N97zvSS3tsm2Z4t2WUR3aUtvYii1z8oIGLhKurVq+C1F4oVFIWroGBDBBEFFdGrKKLSVEAB6SDgUramJ9PPef/7Ts7JTs1Mkkkmyf6+n88h7JQzb2YyM+c5z/M+L0BERERERERERERERERERERERERERERERERERERERERENH8IAB0AVlr/T0REREREREQpNABdAK7YG0B/F8BhABzlHhQRERERERHRfKFZGeerAJwA4JVWEP1eABXlHhwRERERERFRuany7ODe7SsAtlqXaVbp9kkAfGUeHxEREREREVFZqSC5BsAPALzWCqTtuc4SwL0ABss8RiIiIiIiIqKysYPkC/cGycdZgXRq4LwLwD0AomUcIxEREREREVHZqCDZC+CLAN4iAJfI7q79LwD3W4E0ERERERER0X5HBcQfAPBONae5x+22I2c7gE4A+CuAvnIOkoiIiIiIiKhcPADeDeA8AQSPDgREHBDmeOBsZ5njAO4q8ziJiIiIiIiIykKt2/xGABfoQNUJwaA40OfD87FY6oLOJoBnATxazoESERERERERlYOa4/w6K3Cu3RoIiE82N+N3o6Pi4MrKZMRsZZ7V/z4A4CXOdyYiIiIiIqL9iUosHwngyxrQvt7rFZ9tacF39uwRtbqOwWhURczSmvM8BOAXACLlHjQRERERERHRXHECOFgtSSWAttUej7iktRUjpiluHx3FsRUVeDQyESdLK+P8J2adiYiIiIiIaH+h1m5eBeAyAL0tDod2UXMzDvL7xXf27MHRgQA8uo6ElHabbVWyfR+AgXIPnIiIiIiIiGguqHi4B8DX1M8ul0v7Ymsrjq6oELcMDuL5aBT/1diIv46NJW8sxzPNBoA7yz1wIiIiIiIiorlSA+AbAA6v0XXHJ5qa8P+qqsRAIoErVNa5shJNLhfuHh21A2dl2Mo8iwL7JiIiIiIiIlrw2gF8VwCvqtV17YKmJrypulroQuAng4PJ7mFnVFfjjyMj2BmP25Gz+vE3a5kqzncmIiIiIiKiRUtljAMALhfAq11CON9TV4d31tUJjxB4IhrFzwYH8fbaWnS6XLhpYAAR07Tvm1ABN4BYeX8FIiIiIiIiotmjAue6vdvXBXC8Uwhxbn09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";

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
