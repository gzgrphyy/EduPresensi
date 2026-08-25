<script setup lang="ts">
  interface Ruangan {
    id: number
    nama: string
    kelas: { id: number; nama: string } | null
    jenis: string
    qrCode: string
    sesiAktif: boolean
    jumlahSesiAktif: number
    createdAt: string
    _count: { jadwalPelajaran: number }
  }

  const { t } = useI18n()
  const { pengaturan } = usePengaturan()

  const { data, pending, refresh } = useFetch < Ruangan[] > ('/api/admin/ruangan', { immediate: true })
  const { data: kelasList } = useFetch < { id: number; nama: string; semester: { isActive: boolean } }[] > ('/api/admin/kelas', { immediate: true })

  // Dropdown kelas: hanya kelas dari semester aktif
  const kelasOptions = computed(() =>
    (kelasList.value || [])
      .filter(k => k.semester.isActive)
      .map(k => ({ id: k.id, nama: k.nama }))
  )

  const searchQuery = ref('')
  const filterKategori = ref('')

  // Auto-refresh tiap 15 detik agar status sesi selalu ter-update
  onMounted(() => {
    const interval = setInterval(() => refresh(), 15000)
    onUnmounted(() => clearInterval(interval))
  })

  const filteredData = computed(() => {
    if (!data.value) return []
    let result = data.value
    if (filterKategori.value === 'KELAS') {
      result = result.filter(r => r.jenis === 'KELAS')
    } else if (filterKategori.value === 'RUANGAN') {
      result = result.filter(r => r.jenis !== 'KELAS')
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(r => r.nama.toLowerCase().includes(q) || r.qrCode.toLowerCase().includes(q) || (r.kelas?.nama || '').toLowerCase().includes(q))
    }
    return result
  })

  const page = ref(1)
  const pageSize = 10

  watch([searchQuery, filterKategori], () => { page.value = 1 })

  const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / pageSize)))
  const visibleData = computed(() => {
    const start = (page.value - 1) * pageSize
    return filteredData.value.slice(start, start + pageSize)
  })

  const showModal = ref(false)
  const editing = ref < Ruangan | null > (null)
  const form = ref({ nama: '', kelasId: 0 })

  const isKelasJenis = computed(() => form.value.kelasId > 0)
  const selectedKelas = computed(() => kelasOptions.value.find(k => k.id === form.value.kelasId))
  const saving = ref(false)
  const confirmDelete = ref < Ruangan | null > (null)
  const showQR = ref < Ruangan | null > (null)
  const qrSvg = ref('')
  const loadingQR = ref(false)
  const errorMsg = ref('')
  const successMsg = ref('')
  const confirmClose = ref(false)
  const dirtyForm = ref(false)
  const copiedType = ref < 'code' | 'url' | null > (null)
  const printSize = ref < 'landscape' | 'portrait' > ('landscape')

  const scanUrl = computed(() => {
    if (!showQR.value) return ''
    if (!import.meta.client) return `${showQR.value.qrCode}`
    return `${window.location.origin}/siswa/scan?code=${showQR.value.qrCode}`
  })

  async function copyToClipboard(text: string, type: 'code' | 'url') {
    try {
      await navigator.clipboard.writeText(text)
      copiedType.value = type
      setTimeout(() => { copiedType.value = null }, 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      copiedType.value = type
      setTimeout(() => { copiedType.value = null }, 2000)
    }
  }

  function showError(msg: string) {
    errorMsg.value = msg
    setTimeout(() => { errorMsg.value = '' }, 5000)
  }

  function showSuccess(msg: string) {
    successMsg.value = msg
    setTimeout(() => { successMsg.value = '' }, 3000)
  }

  function openCreate() {
    editing.value = null
    form.value = { nama: '', kelasId: 0 }
    showModal.value = true
  }

  function openEdit(item: Ruangan) {
    editing.value = item
    form.value = { nama: item.nama, kelasId: item.kelas?.id || 0 }
    showModal.value = true
  }

  function onFormChange() { dirtyForm.value = true }

  function handleCloseClick() {
    if (dirtyForm.value) { confirmClose.value = true }
    else { showModal.value = false }
  }

  async function handleSave() {
    // Pilih salah satu: isi nama ruangan (lab/perpus) ATAU pilih kelas
    const namaAkhir = isKelasJenis.value ? (selectedKelas.value?.nama || '') : form.value.nama
    const jenisAkhir = isKelasJenis.value ? 'KELAS' : 'LAINNYA'
    const kelasIdAkhir = isKelasJenis.value ? form.value.kelasId : null

    if (!namaAkhir.trim()) {
      showError(t('admin.ruangan.msgWajibIsi'))
      return
    }
    saving.value = true
    errorMsg.value = ''
    try {
      if (editing.value) {
        const body: Record<string, unknown> = {}
        if (namaAkhir !== editing.value.nama) body.nama = namaAkhir
        if (jenisAkhir !== editing.value.jenis) body.jenis = jenisAkhir
        if (kelasIdAkhir !== (editing.value.kelas?.id || null)) body.kelasId = kelasIdAkhir
        if (Object.keys(body).length === 0) { showModal.value = false; return }
        const { error } = await useFetch(`/api/admin/ruangan/${editing.value.id}`, { method: 'PATCH', body })
        if (error.value) { showError(error.value.statusMessage || t('admin.ruangan.msgGagalSimpan')); return }
        showSuccess(t('admin.ruangan.msgBerhasilEdit'))
      } else {
        const { error } = await useFetch('/api/admin/ruangan', { method: 'POST', body: { nama: namaAkhir, jenis: jenisAkhir, kelasId: kelasIdAkhir } })
        if (error.value) { showError(error.value.statusMessage || t('admin.ruangan.msgGagalSimpan')); return }
        showSuccess(t('admin.ruangan.msgBerhasilTambah'))
      }
      showModal.value = false
      confirmClose.value = false
      await refresh()
    } finally { saving.value = false }
  }

  async function handleDelete() {
    if (!confirmDelete.value) return
    const { id } = confirmDelete.value
    confirmDelete.value = null
    const { error } = await useFetch(`/api/admin/ruangan/${id}`, { method: 'DELETE' })
    if (error.value) { showError(error.value.statusMessage || t('admin.ruangan.msgGagalHapus')); return }
    showSuccess(t('admin.ruangan.msgBerhasilHapus'))
    await refresh()
  }

  async function openQR(item: Ruangan) {
    showQR.value = item
    loadingQR.value = true
    qrSvg.value = ''
    try {
      const res = await $fetch(`/api/admin/ruangan/${item.id}/qr.svg`, { responseType: 'text' })
      qrSvg.value = res as string
    } catch {
      showError(t('admin.ruangan.msgGagalQr'))
    } finally { loadingQR.value = false }
  }

  function escapeHtml(value: string) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function printQR() {
    if (!showQR.value) return
    const printWin = window.open('', '_blank')
    if (!printWin) return

    const isLandscape = printSize.value === 'landscape'
    const pageW = isLandscape ? 210 : 148
    const pageH = isLandscape ? 148 : 210

    const room = escapeHtml(showQR.value.nama)
    const fullSchoolName = (pengaturan.value?.namaSekolah || 'SMK Negeri 4 Bandung').trim().toUpperCase()
    const m = fullSchoolName.match(/^(SMK NEGERI\s*\d+)\s+(.+)$/)
    let schoolLine1 = fullSchoolName
    let schoolLine2 = ''
    if (m) {
      schoolLine1 = m[1]
      schoolLine2 = `KOTA ${m[2]}`
    } else {
      const words = fullSchoolName.split(/\s+/)
      let lastNum = -1
      for (let i = 0; i < words.length; i++) {
        if (/\d/.test(words[i])) lastNum = i
      }
      if (lastNum > 0 && lastNum < words.length - 1) {
        schoolLine1 = words.slice(0, lastNum + 1).join(' ')
        schoolLine2 = words.slice(lastNum + 1).join(' ')
      } else {
        const mid = Math.ceil(words.length / 2)
        schoolLine1 = words.slice(0, mid).join(' ')
        schoolLine2 = words.slice(mid).join(' ')
      }
    }
    const schoolLogo = escapeHtml(pengaturan.value?.logoSekolahPath || '/photo/smkn4.png')
    const appLogo = escapeHtml(pengaturan.value?.iconPath || '/photo/logo_aplikasiv2.png')
    const appLabel = escapeHtml(t('app.aplikasiLabel'))
    const appName = escapeHtml(t('app.aplikasiSkoria'))
    const welcome = escapeHtml(t('admin.ruangan.qr.posterSelamatDatang'))
    const scanHere = escapeHtml(t('admin.ruangan.qr.posterScan'))
    const scanText = escapeHtml(t('admin.ruangan.qr.scan'))
    const mudah = escapeHtml(t('admin.ruangan.qr.posterMudah'))
    const akurat = escapeHtml(t('admin.ruangan.qr.posterAkurat'))
    const realtime = escapeHtml(t('admin.ruangan.qr.posterRealTime'))

    const featureRow = `
    <div class="feature-row">
      <div class="feature">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg></div>
        <span class="label">${mudah}</span>
      </div>
      <div class="feature">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg></div>
        <span class="label">${akurat}</span>
      </div>
      <div class="feature">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
        <span class="label">${realtime}</span>
      </div>
    </div>`

    const waves = `
    <div class="waves">
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path d="M0,78 C160,118 320,42 560,56 C800,70 960,118 1160,92 C1300,76 1400,96 1440,72 L1440,120 L0,120 Z" fill="#123B6D"/>
        <path d="M0,94 C180,120 360,62 580,74 C800,86 980,120 1180,104 C1320,94 1400,108 1440,92 L1440,120 L0,120 Z" fill="#2563A8"/>
        <path d="M0,78 C160,118 320,42 560,56 C800,70 960,118 1160,92 C1300,76 1400,96 1440,72" fill="none" stroke="#FFC400" stroke-width="5" stroke-linecap="round"/>
      </svg>
    </div>`

    const schoolGroup = `
    <div class="school-group">
      <img class="school-logo" src="${schoolLogo}" alt="Logo Sekolah">
      <div class="school-name"><span class="line1">${escapeHtml(schoolLine1)}</span><span class="line2">${escapeHtml(schoolLine2)}</span></div>
    </div>`

    const appBrand = `
    <div class="app-brand">
      <img class="app-logo" src="${appLogo}" alt="EduPresensi">
      <div class="app-text"><span class="app-label">${appLabel}</span><span class="app-name">${appName}</span></div>
    </div>`

    const footer = `
    <div class="footer-wrap">
      ${waves}
    </div>`

    const body = isLandscape
      ? `<div class="body landscape-body">
        <div class="col-left">
          ${schoolGroup}
          <h1 class="welcome">${welcome}</h1>
          <div class="badge">${room}</div>
          ${appBrand}
          ${featureRow}
          <p class="instruction">${scanText}</p>
        </div>
        <div class="col-right">
          <div class="qr-container">
            <div class="qr-tab"><span class="scan-dot"></span>${scanHere}</div>
            <div class="qr-box">${qrSvg.value}</div>
          </div>
        </div>
      </div>`
      : `<div class="body portrait-body">
        <div class="welcome">${welcome}</div>
        <div class="badge">${room}</div>
        <div class="qr-frame">
          <div class="scan-btn"><span class="scan-dot"></span>${scanHere}</div>
          <div class="qr-box">${qrSvg.value}</div>
        </div>
        ${appBrand}
        ${featureRow}
        <div class="instruction">${scanText}</div>
      </div>`

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>QR - ${room}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A5 ${isLandscape ? 'landscape' : 'portrait'}; margin: 0; }
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:'Poppins','Montserrat','Inter','Segoe UI',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{background:#ffffff;color:#123B6D}
.page{width:${pageW}mm;height:${pageH}mm;padding:7mm}
.card{position:relative;width:100%;height:100%;background:#ffffff;border:1.5px solid #123B6D;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.stripe-band{position:relative;flex-shrink:0;height:40px;background:#123B6D;background-image:repeating-linear-gradient(-45deg,rgba(37,99,168,0.18) 0 6px,rgba(37,99,168,0) 6px 12px);border-radius:12px 12px 0 0}
.stripe-band::after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:#FFC400}
.is-landscape .stripe-band{height:38px}
.school-group{flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;padding:0 16px}
.school-logo{width:45px;height:45px;object-fit:contain;flex-shrink:0}
.school-name{font-weight:600;letter-spacing:0.05em;color:#123B6D;font-size:9.5pt;line-height:1.25;text-align:left}
.school-name span{display:block}
.is-landscape .school-group{margin:0;gap:4mm}
.is-landscape .school-logo{width:12mm;height:12mm}
.is-landscape .school-name{font-size:12.7px;line-height:1.25}
.body{flex:1;padding:0 30px;display:flex;align-items:center}
.welcome{font-weight:700;color:#123B6D;text-align:center;font-size:30pt;line-height:1.1}
.is-landscape .welcome{font-size:36px;line-height:1.1;text-align:left;letter-spacing:0.01em;white-space:nowrap}
.badge{display:inline-flex;align-items:center;justify-content:center;min-width:84px;height:38px;padding:0 16px;border:1.5px solid #123B6D;border-radius:999px;background:#ffffff;font-weight:600;color:#123B6D;font-size:16pt;line-height:1;text-align:center}
.is-landscape .badge{font-size:21px;height:38px;min-width:0;border-radius:10px;letter-spacing:0.06em}
.qr-frame{position:relative;width:280px;height:280px;border:1.5px solid #123B6D;border-radius:16px;background:#ffffff;padding:0;display:flex;align-items:center;justify-content:center}
.qr-frame .qr-box{width:100%;height:100%;padding:16px;border:none;border-radius:16px;display:flex;align-items:center;justify-content:center}
.qr-box{background:#ffffff;border:1px solid #D9E0E8;border-radius:16px;padding:16px;display:flex;align-items:center;justify-content:center}
.qr-box svg{width:100%;height:100%;display:block}
.scan-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;width:162px;height:40px;background:#123B6D;color:#ffffff;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;border-radius:999px;font-size:10.5pt;line-height:1}
.scan-dot{width:5px;height:5px;border-radius:999px;background:#FFC400;flex-shrink:0}
.qr-frame .scan-btn{position:absolute;top:-20px;left:50%;transform:translateX(-50%);z-index:2}
.is-landscape .scan-btn{width:auto;min-width:150px;height:44px;padding:0 30px;font-size:13px;letter-spacing:0.16em;gap:9px;border-radius:999px}
.is-landscape .scan-dot{width:8px;height:8px}
.feature-row{display:flex;justify-content:center;gap:48px}
.feature{display:flex;flex-direction:column;align-items:center;gap:5px;color:#123B6D}
.feature .icon{width:22px;height:22px}
.feature .icon svg{width:100%;height:100%}
.feature .label{font-weight:500;font-size:9pt;color:#123B6D;text-align:center}
.is-landscape .feature-row{justify-content:flex-start;gap:9mm}
.is-landscape .feature{flex-direction:column;align-items:center;gap:2mm}
.is-landscape .feature .icon{width:30px;height:30px;color:#2563A8}
.is-landscape .feature .label{font-size:12px;font-weight:500;text-align:center}
.instruction{color:#6B7280;text-align:center;font-size:9.5pt;line-height:1.5;max-width:100%}
.is-landscape .instruction{font-size:12.7px;max-width:92mm;text-align:left}
.app-brand{display:flex;align-items:center;justify-content:center;gap:8px}
.app-logo{width:45px;height:45px;object-fit:contain;flex-shrink:0}
.app-text{display:flex;flex-direction:column;align-items:flex-start;line-height:1.25}
.app-label{font-weight:400;font-size:8.5pt;color:#6B7280}
.app-name{font-weight:700;font-size:14pt;color:#123B6D;letter-spacing:0.01em}
.is-landscape .app-brand{gap:3mm}
.is-landscape .app-logo{width:12mm;height:12mm}
.is-landscape .app-label{font-size:11.3px}
.is-landscape .app-name{font-size:18.7px}
.footer-wrap{flex-shrink:0}
.waves{height:52px}
.waves svg{width:100%;height:100%;display:block}
.is-landscape .waves{height:18mm}
.landscape-body{gap:7mm}
.is-landscape .body{padding:0 9mm}
.landscape-body .col-left{flex:1.25;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2.5mm}
.landscape-body .col-right{flex:1;display:flex;justify-content:center;align-items:center}
.qr-container{position:relative;width:72mm;height:74mm;background:#F9FAFC;border:1.5px solid #123B6D;border-radius:30px;padding:7mm 6mm 5mm;display:flex;align-items:center;justify-content:center}
.qr-tab{position:absolute;top:-13px;left:50%;transform:translateX(-50%);z-index:2;display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 20px;background:#123B6D;color:#ffffff;font-weight:700;font-size:14px;letter-spacing:0.14em;text-transform:uppercase;border-radius:999px;line-height:1;white-space:nowrap}
.qr-tab .scan-dot{width:7px;height:7px}
.is-landscape .qr-container .qr-box{width:56mm;height:56mm;padding:4mm;background:#ffffff;border:1px solid #D9E0E8;border-radius:20px}
.portrait-body{flex-direction:column;justify-content:center}
.portrait-body > *{margin-top:12px}
.portrait-body .welcome{margin-top:16px}
.portrait-body .badge{margin-top:12px}
.portrait-body .qr-frame{margin-top:38px}
.portrait-body .app-brand{margin-top:14px}
.portrait-body .feature-row{margin-top:18px}
.portrait-body .instruction{margin-top:14px}
</style></head>
<body><div class="page ${isLandscape ? 'is-landscape' : 'is-portrait'}"><div class="card">
<div class="stripe-band"></div>
${isLandscape ? '' : schoolGroup}
${body}
${footer}
</div></div></body></html>`

    printWin.document.write(html)
    printWin.document.close()
    printWin.focus()
    setTimeout(() => printWin.print(), 300)
  }

  function ruanganUrl(item: Ruangan) {
    if (!import.meta.client) return ''
    return `${window.location.origin}/siswa/scan?code=${item.qrCode}`
  }

  // const selectedEl = document.querySelector('.list-item.selected');
  // if (selectedEl) {
  //   selectedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // }
  const centerFilter = ref < HTMLSelectElement | null > (null)
  centerFilter.value?.addEventListener('change', () => {
    const selectedEl = document.querySelector('.list-item.selected')
    if (selectedEl) {
      selectedEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })


</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.ruangan.title')" :description="t('admin.ruangan.desc')" />

    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="searchQuery" type="text" :placeholder="t('admin.ruangan.searchPlaceholder')"
            class="w-40 sm:w-56 pl-9 pr-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400" />
        </div>
        <select ref="centerFilter" v-model="filterKategori"
          class="px-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">{{ t('admin.ruangan.kategoriSemua') }}</option>
          <option value="RUANGAN">{{ t('admin.ruangan.kategoriRuangan') }}</option>
          <option value="KELAS">{{ t('admin.ruangan.kategoriKelas') }}</option>
        </select>
      </div>
      <button @click="openCreate"
        class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs ">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span class="hidden sm:inline">{{ t('admin.ruangan.tambahRuangan') }}</span>
      </button>
    </div>

    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />
    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

    <div v-if="pending" class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
      <div class="p-6 space-y-4">
        <div v-for="i in 3" :key="i" class="flex items-center gap-4 animate-pulse">
          <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-40"></div>
          <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-20 ml-auto"></div>
          <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded w-24 ml-auto"></div>
        </div>
      </div>
    </div>

    <div v-else class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
              <th class="text-left px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{
                t('admin.ruangan.colRuangan') }}</th>
              <th
                class="text-left px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden sm:table-cell">
                {{ t('admin.ruangan.colKelas') }}</th>
              <th
                class="text-center px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden sm:table-cell">
                {{ t('admin.ruangan.colJadwal') }}</th>
              <th class="text-center px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{
                t('admin.ruangan.colStatusSesi') }}</th>
              <th class="text-center px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{
                t('admin.ruangan.colQr') }}</th>
              <th class="text-center px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{
                t('admin.tahunAjaran.colAksi') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y admin-accent-divide">
            <tr v-for="item in visibleData" :key="item.id"
              class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
              <td class="px-4 sm:px-6 py-4">
                <span class=" text-gray-900 dark:text-gray-100">{{ item.jenis === 'KELAS' ? '-' : item.nama }}</span>
              </td>
              <td class="px-4 sm:px-6 py-4 hidden sm:table-cell">
                <span class="text-gray-600 dark:text-gray-300 ">{{ item.kelas?.nama || '-' }}</span>
              </td>
              <td class="px-4 sm:px-6 py-4 text-center hidden sm:table-cell">
                <span class="text-gray-600 dark:text-gray-300 ">{{ item._count.jadwalPelajaran }}</span>
              </td>
              <td class="px-4 sm:px-6 py-4 text-center">
                <span class="inline-flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="item.sesiAktif ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'"></span>
                  <span class="text-xs text-gray-600 dark:text-gray-400">{{ item.sesiAktif ? t('admin.ruangan.sesiAktif') : t('admin.ruangan.sesiTidakAda') }}</span>
                </span>
              </td>
              <td class="px-4 sm:px-6 py-4 text-center">
                <button @click="openQR(item)"
                  class="inline-flex items-center gap-1 px-3 py-1.5 text-sm  text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  QR
                </button>
              </td>
              <td class="px-4 sm:px-6 py-4">
                <div class="flex items-center justify-center gap-1">
                  <button @click="openEdit(item)"
                    class="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    :title="t('common.edit')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button @click="confirmDelete = item"
                    class="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md"
                    :title="t('common.hapus')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredData || filteredData.length === 0">
              <td colspan="6" class="px-4 sm:px-6 py-16 text-center">
                <div class="flex flex-col items-center gap-3">
                  <svg class="w-12 h-12 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p class="text-gray-500 dark:text-gray-400 ">{{ t('admin.ruangan.empty') }}</p>
                  <button @click="openCreate"
                    class="inline-flex items-center gap-1 px-4 py-2 text-xs text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
                    {{ t('admin.ruangan.emptyAction') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="filteredData.length > pageSize"
        class="px-4 sm:px-6 py-3 border-t admin-accent-border flex items-center justify-between gap-3">
        <p class="text-xs text-gray-400 dark:text-gray-500">
          {{ t('common.menampilkan', { from: ((page - 1) * pageSize) + 1, to: Math.min(page * pageSize,
          filteredData.length), total: filteredData.length, unit: t('admin.ruangan.unitRuangan') }) }}
        </p>
        <div class="ml-auto flex items-center gap-2">
          <button @click="page--" :disabled="page <= 1"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            {{ t('common.sebelumnya') }}
          </button>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ t('common.halaman', { page, total: totalPages })
            }}</span>
          <button @click="page++" :disabled="page >= totalPages"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {{ t('common.selanjutnya') }}
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Create/Edit -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="handleCloseClick">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="handleCloseClick"></div>
          <div
            class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-auto overflow-hidden border border-gray-300 dark:border-gray-600">
            <div class="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 class="text-lg  text-gray-900 dark:text-gray-100">{{ editing ? t('admin.ruangan.modalEdit') :
                t('admin.ruangan.modalCreate') }}</h2>
              <button @click="handleCloseClick"
                class="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form @submit.prevent="handleSave" class="p-4 space-y-4">
              <div>
                <label class="block text-xs  text-gray-700 dark:text-gray-300 mb-1.5">{{ t('admin.ruangan.labelRuangan')
                  }}</label>
                <input v-model="form.nama" type="text" @input="onFormChange" :disabled="isKelasJenis"
                  :placeholder="t('admin.ruangan.placeholderNama')"
                  class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed" />
                <p v-if="isKelasJenis" class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{{
                  t('admin.ruangan.infoNamaKelas') }}</p>
              </div>
              <div>
                <label class="block text-xs  text-gray-700 dark:text-gray-300 mb-1.5">{{ t('admin.ruangan.labelKelas')
                  }}</label>
                <select v-model="form.kelasId" @change="onFormChange"
                  class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700">
                  <option :value="0">{{ t('common.tidakAda') }}</option>
                  <option v-for="k in kelasOptions" :key="k.id" :value="k.id">{{ k.nama }}</option>
                </select>
              </div>
              <Transition name="fade">
                <div v-if="!editing"
                  class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ t('admin.ruangan.infoQr') }}</span>
                </div>
              </Transition>
              <Transition name="fade">
                <div v-if="errorMsg"
                  class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                  <span>{{ errorMsg }}</span>
                </div>
              </Transition>
              <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
                <button type="button" @click="handleCloseClick"
                  class="px-4 py-2 text-xs  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">{{
                  t('common.batal') }}</button>
                <button type="submit" :disabled="saving"
                  class="px-5 py-2 text-xs  text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
                  <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {{ saving ? t('common.menyimpan') : t('common.simpan') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>

      <!-- Modal QR Code -->
      <Transition name="modal">
        <div v-if="showQR" class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" @click.self="showQR = null">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="showQR = null"></div>
          <div
            class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-auto p-3 border border-gray-300 dark:border-gray-600 text-center overflow-y-auto">
            <button @click="showQR = null"
              class="absolute top-3 right-3 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 class="text-lg  text-gray-900 dark:text-gray-100 mb-1">{{ showQR.nama }}</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ t('admin.ruangan.qr.scan') }}</p>

            <div v-if="loadingQR" class="py-8 flex justify-center">
              <svg class="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div v-else-if="qrSvg" class="flex justify-center mb-3">
              <div class="qr-preview" v-html="qrSvg" style="width: 200px; height: 200px; margin: 0 auto;"></div>
            </div>

            <!-- Kode QR Text -->
            <div v-if="!loadingQR && showQR" class="mb-3 text-left">
              <div
                class="bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 p-2.5 space-y-1.5">
                <div>
                  <label class="text-xs  text-gray-500 dark:text-gray-400 tracking-wider">{{
                    t('admin.ruangan.qr.labelKode') }}</label>
                  <div class="flex items-center gap-2 mt-1">
                    <code
                      class="flex-1 text-xs font-mono text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded px-2 py-1.5 truncate">{{ showQR.qrCode }}</code>
                    <button @click="copyToClipboard(showQR.qrCode, 'code')"
                      class="flex-shrink-0 p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                      :title="copiedType === 'code' ? t('admin.ruangan.qr.tersalin') : t('admin.ruangan.qr.salinKode')">
                      <svg v-if="copiedType !== 'code'" class="w-4 h-4" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <svg v-else class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label class="text-xs  text-gray-500 tracking-wider">{{ t('admin.ruangan.qr.labelUrl') }}</label>
                  <div class="flex items-center gap-2 mt-1">
                    <code
                      class="flex-1 text-[0.85em] font-mono text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded px-2 py-1.5 truncate">{{ scanUrl }}</code>
                    <button @click="copyToClipboard(scanUrl, 'url')"
                      class="flex-shrink-0 p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                      :title="copiedType === 'url' ? t('admin.ruangan.qr.tersalin') : t('admin.ruangan.qr.salinUrl')">
                      <svg v-if="copiedType !== 'url'" class="w-4 h-4" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <svg v-else class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ t('admin.ruangan.qr.infoScan') }}</p>
                </div>
              </div>
            </div>

            <div class="mb-3">
              <label class="block text-left text-xs text-gray-500 dark:text-gray-400 tracking-wider mb-1.5">{{
                t('admin.ruangan.qr.pilihUkuran') }}</label>
              <div class="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
                <button @click="printSize = 'landscape'"
                  :class="printSize === 'landscape' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'"
                  class="flex-1 py-2 text-xs font-semibold transition-colors">{{ t('admin.ruangan.qr.cetakLandscape')
                  }}</button>
                <button @click="printSize = 'portrait'"
                  :class="printSize === 'portrait' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'"
                  class="flex-1 py-2 text-xs font-semibold transition-colors">{{ t('admin.ruangan.qr.cetakPortrait')
                  }}</button>
              </div>
            </div>

            <div class="flex gap-2 justify-center">
              <button @click="printQR"
                class="px-4 py-2 text-xs  text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {{ t('admin.ruangan.qr.cetak') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Modal Confirm Delete -->
      <Transition name="modal">
        <div v-if="confirmDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="confirmDelete = null"></div>
          <div
            class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-auto p-4 border border-gray-300 dark:border-gray-600">
            <h2 class="text-lg  text-gray-900 dark:text-gray-100 mb-2">{{ t('admin.ruangan.confirmDeleteTitle') }}</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">{{ t('admin.ruangan.confirmDeleteMsg', { nama:
              confirmDelete.nama }) }}</p>
            <p v-if="confirmDelete._count.jadwalPelajaran > 0"
              class="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              {{ t('admin.ruangan.confirmDeleteJadwal', { count: confirmDelete._count.jadwalPelajaran }) }}
            </p>
            <div class="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-slate-700">
              <button @click="confirmDelete = null"
                class="px-4 py-2 text-sm  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">{{
                t('common.batal') }}</button>
              <button @click="handleDelete"
                class="px-4 py-2 text-sm  text-white bg-red-600 rounded-md hover:bg-red-700">{{ t('common.yaHapus')
                }}</button>
            </div>
          </div>
        </div>
      </Transition>

    </Teleport>
  </AppLayout>
</template>

<style scoped>
  .modal-enter-active {
    transition: all 0.2s ease-out;
  }

  .modal-leave-active {
    transition: all 0.15s ease-in;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .modal-enter-from>div:last-child,
  .modal-leave-to>div:last-child {
    transform: scale(0.95);
  }

  .slide-enter-active {
    transition: all 0.3s ease-out;
  }

  .slide-leave-active {
    transition: all 0.2s ease-in;
  }

  .slide-enter-from {
    transform: translateY(-10px);
    opacity: 0;
  }

  .slide-leave-to {
    transform: translateY(-10px);
    opacity: 0;
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }

  .qr-preview {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qr-preview svg {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain;
  }
</style>