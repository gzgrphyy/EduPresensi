<script setup lang="ts">
import { z } from 'zod'

const { t } = useI18n()
const { pengaturan, fetch: fetchPengaturan } = usePengaturan()
const activeTab = ref<'umum' | 'absensi' | 'keamanan'>('umum')

const formUmum = reactive({
  namaSekolah: 'SMK Negeri 1 Bandung',
  logoSekolahPath: null as string | null,
  alamat: '',
  telp: '',
  email: '',
  tahunAjaran: '2026/2027',
  semester: 'Ganjil',
  kepalaSekolah: '',
  nipKepsek: '',
})

const formBranding = reactive({
  iconPath: null as string | null,
  faviconPath: null as string | null,
  warnaUtama: '#0A66A0',
})

const presetColors = [
  { name: 'Biru', value: '#0A66A0' },
  { name: 'Biru Muda', value: '#0284c7' },
  { name: 'Hijau', value: '#059669' },
  { name: 'Hijau Lumut', value: '#4d7c0f' },
  { name: 'Merah', value: '#dc2626' },
  { name: 'Merah Muda', value: '#db2777' },
  { name: 'Ungu', value: '#7c3aed' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Oranye', value: '#ea580c' },
  { name: 'Cokelat', value: '#92400e' },
  { name: 'Biru Kelabu', value: '#475569' },
]

// Preview state for branding images
const iconPreview = ref<string | null>(null)
const faviconPreview = ref<string | null>(null)
const iconFile = ref<File | null>(null)
const faviconFile = ref<File | null>(null)

// Preview state for school logo
const logoSekolahPreview = ref<string | null>(null)
const logoSekolahFile = ref<File | null>(null)

const formAbsensi = reactive({
  batasScan: 10,
  autoTutupSesi: true,
  batasTelat: 15,
  notifikasi: true,
  toleransiAlpha: 3,
  izinTeksBebas: false,
})

const formKeamanan = reactive({
  minimalPassword: 8,
  sesiTimeout: 60,
  maxLogin: 3,
  twoFactorAuth: false,
  logAktivitas: true,
})

const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const iconUploading = ref(false)
const faviconUploading = ref(false)
const logoSekolahUploading = ref(false)

const MAX_FILE_SIZE = 10 * 1024 * 1024

const logoAllowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']
const faviconAllowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/x-icon', 'image/vnd.microsoft.icon']

function validateFile(file: File, allowedTypes: string[]): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return t('admin.pengaturan.fileTerlaluBesar')
  }
  if (!allowedTypes.includes(file.type)) {
    return t('admin.pengaturan.tipeTidakDidukung')
  }
  return null
}

// Init branding & umum from existing data
onMounted(async () => {
  if (pengaturan.value) {
    formUmum.namaSekolah = pengaturan.value.namaSekolah
    formUmum.logoSekolahPath = pengaturan.value.logoSekolahPath
    formUmum.alamat = pengaturan.value.alamat || ''
    formUmum.telp = pengaturan.value.telp || ''
    formUmum.email = pengaturan.value.email || ''
    formUmum.tahunAjaran = pengaturan.value.tahunAjaran || ''
    formUmum.semester = pengaturan.value.semester || 'Ganjil'
    formUmum.kepalaSekolah = pengaturan.value.kepalaSekolah || ''
    formUmum.nipKepsek = pengaturan.value.nipKepsek || ''

    formBranding.iconPath = pengaturan.value.iconPath
    formBranding.faviconPath = pengaturan.value.faviconPath
    formBranding.warnaUtama = pengaturan.value.warnaUtama || '#0A66A0'
  }

  try {
    const res = await $fetch<{ keamanan?: typeof formKeamanan }>('/api/admin/pengaturan')
    if (res?.keamanan) {
      formKeamanan.minimalPassword = res.keamanan.minimalPassword ?? 8
      formKeamanan.sesiTimeout = res.keamanan.sesiTimeout ?? 60
      formKeamanan.maxLogin = res.keamanan.maxLogin ?? 3
    }
  } catch {
    // fallback ke default bila gagal fetch
  }
})

// Watch for pengaturan changes (after save from other sources)
watch(pengaturan, (val) => {
  if (val) {
    formUmum.namaSekolah = val.namaSekolah
    formUmum.logoSekolahPath = val.logoSekolahPath
    formUmum.alamat = val.alamat || ''
    formUmum.telp = val.telp || ''
    formUmum.email = val.email || ''
    formUmum.tahunAjaran = val.tahunAjaran || ''
    formUmum.semester = val.semester || 'Ganjil'
    formUmum.kepalaSekolah = val.kepalaSekolah || ''
    formUmum.nipKepsek = val.nipKepsek || ''

    formBranding.iconPath = val.iconPath
    formBranding.faviconPath = val.faviconPath
    formBranding.warnaUtama = val.warnaUtama || '#0A66A0'
  }
})

async function uploadFile(file: File, type: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', type)
  const res = await $fetch<{ success: boolean; path: string }>('/api/admin/upload', {
    method: 'POST',
    body: formData,
  })
  return res.path
}

function handleIconSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    errorMsg.value = ''
    const validationError = validateFile(file, logoAllowedTypes)
    if (validationError) {
      errorMsg.value = `${t('admin.pengaturan.labelLogoAplikasi')}: ${validationError}`
      target.value = ''
      return
    }
    iconFile.value = file
    iconPreview.value = URL.createObjectURL(file)
  }
}

function handleFaviconSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    errorMsg.value = ''
    const validationError = validateFile(file, faviconAllowedTypes)
    if (validationError) {
      errorMsg.value = `${t('admin.pengaturan.labelFavicon')}: ${validationError}`
      target.value = ''
      return
    }
    faviconFile.value = file
    faviconPreview.value = URL.createObjectURL(file)
  }
}

function removeIcon() {
  iconPreview.value = null
  iconFile.value = null
  formBranding.iconPath = null
}

function removeFavicon() {
  faviconPreview.value = null
  faviconFile.value = null
  formBranding.faviconPath = null
}

function handleLogoSekolahSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    errorMsg.value = ''
    const validationError = validateFile(file, logoAllowedTypes)
    if (validationError) {
      errorMsg.value = `${t('admin.pengaturan.labelLogoSekolah')}: ${validationError}`
      target.value = ''
      return
    }
    logoSekolahFile.value = file
    logoSekolahPreview.value = URL.createObjectURL(file)
  }
}

function removeLogoSekolah() {
  logoSekolahPreview.value = null
  logoSekolahFile.value = null
  formUmum.logoSekolahPath = null
}

async function handleSave() {
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    if (iconFile.value) {
      iconUploading.value = true
      const path = await uploadFile(iconFile.value, 'icon')
      formBranding.iconPath = path
      iconUploading.value = false
    }

    if (faviconFile.value) {
      faviconUploading.value = true
      const path = await uploadFile(faviconFile.value, 'favicon')
      formBranding.faviconPath = path
      faviconUploading.value = false
    }

    if (logoSekolahFile.value) {
      logoSekolahUploading.value = true
      const path = await uploadFile(logoSekolahFile.value, 'logo-sekolah')
      formUmum.logoSekolahPath = path
      logoSekolahUploading.value = false
    }

    await $fetch('/api/admin/pengaturan', {
      method: 'PUT',
      body: {
        umum: formUmum,
        branding: {
          iconPath: formBranding.iconPath,
          faviconPath: formBranding.faviconPath,
          warnaUtama: formBranding.warnaUtama,
        },
        absensi: formAbsensi,
        keamanan: formKeamanan,
      },
    })

    await fetchPengaturan()

    iconFile.value = null
    faviconFile.value = null
    iconPreview.value = null
    faviconPreview.value = null
    logoSekolahFile.value = null
    logoSekolahPreview.value = null

    successMsg.value = t('admin.pengaturan.msgBerhasilSave')
  } catch (err: any) {
    iconUploading.value = false
    faviconUploading.value = false
    logoSekolahUploading.value = false
    const message = err?.data?.statusMessage || err?.message || t('admin.pengaturan.msgGagalSave')
    errorMsg.value = message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.pengaturan.title')" :description="t('admin.pengaturan.desc')" />

    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />
    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />

    <div class="flex border-b admin-accent-border mb-5" :style="{ '--tab-accent': formBranding.warnaUtama }">
      <button @click="activeTab = 'umum'"
        class="relative flex-1 py-2.5 px-4 text-sm font-medium transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[var(--tab-accent)] after:transition-all"
        :class="activeTab === 'umum' ? 'text-[var(--tab-accent)] after:w-full' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 after:w-0 hover:after:w-full'">
        {{ t('admin.pengaturan.tabUmum') }}
      </button>
      <button @click="activeTab = 'absensi'"
        class="relative flex-1 py-2.5 px-4 text-sm font-medium transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[var(--tab-accent)] after:transition-all"
        :class="activeTab === 'absensi' ? 'text-[var(--tab-accent)] after:w-full' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 after:w-0 hover:after:w-full'">
        {{ t('admin.pengaturan.tabAbsensi') }}
      </button>
      <button @click="activeTab = 'keamanan'"
        class="relative flex-1 py-2.5 px-4 text-sm font-medium transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[var(--tab-accent)] after:transition-all"
        :class="activeTab === 'keamanan' ? 'text-[var(--tab-accent)] after:w-full' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 after:w-0 hover:after:w-full'">
        {{ t('admin.pengaturan.tabKeamanan') }}
      </button>
    </div>

    <BaseCard>
      <form @submit.prevent="handleSave">
        <!-- Umum -->
        <div v-show="activeTab === 'umum'" class="space-y-6">
          <!-- Branding Section -->
          <div>
            <h3 class="text-base  text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {{ t('admin.pengaturan.brandingVisual') }}
            </h3>
            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-4 border admin-accent-border">


              <!-- Warna Utama -->
              <div class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border p-4">
                <label class="block text-sm  text-gray-700 dark:text-gray-300 mb-3">
                  <span class="flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    {{ t('admin.pengaturan.labelWarnaUtama') }}
                  </span>
                </label>
                <div class="flex flex-wrap items-center gap-3">
                  <label class="relative cursor-pointer w-12 h-12 rounded-lg border-2 border-white dark:border-gray-600 shadow-sm flex-shrink-0" :style="{ backgroundColor: formBranding.warnaUtama }" :title="formBranding.warnaUtama">
                    <input type="color" v-model="formBranding.warnaUtama" class="sr-only" />
                  </label>
                  <input v-model="formBranding.warnaUtama" type="text"
                    class="w-28 px-3 py-2 text-sm border admin-accent-border dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                    maxlength="7" />
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    v-for="preset in presetColors"
                    :key="preset.value"
                    type="button"
                    @click="formBranding.warnaUtama = preset.value"
                    :class="['w-8 h-8 rounded-md border-2 transition-transform hover:scale-110', formBranding.warnaUtama.toLowerCase() === preset.value.toLowerCase() ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-gray-200 dark:border-gray-600']"
                    :style="{ backgroundColor: preset.value }"
                    :title="preset.name"
                  ></button>
                </div>
                <p class="mt-3 text-[10px] text-gray-400 dark:text-gray-500">{{ t('admin.pengaturan.descWarnaUtama') }}</p>
              </div>

              <!-- Logo & Favicon side by side -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Logo Aplikasi (Icon) -->
                <div class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border p-4">
                  <label class="block text-sm  text-gray-700 dark:text-gray-300 mb-3">
                    <span class="flex items-center gap-1.5">
                      <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {{ t('admin.pengaturan.labelLogoAplikasi') }}
                    </span>
                  </label>
                  <!-- Preview -->
                  <div class="flex flex-col items-center gap-3">
                    <div class="w-24 h-24 rounded-lg border-2 border-dashed admin-accent-border flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-700">
                      <img v-if="iconPreview || formBranding.iconPath"
                        :src="iconPreview || formBranding.iconPath"
                        class="w-full h-full object-contain p-2"
                        alt="Preview Logo" />
                      <svg v-else class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <!-- Upload controls -->
                    <div class="flex items-center gap-2">
                      <label class="relative cursor-pointer" :class="{ 'opacity-50 pointer-events-none': iconUploading }">
                        <input type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml" class="sr-only" @change="handleIconSelect" :disabled="iconUploading" />
                        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs  text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border admin-accent-border">
                          <svg v-if="iconUploading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          {{ iconUploading ? t('admin.pengaturan.mengunggah') : t('common.pilihFile') }}
                        </span>
                      </label>
                      <button v-if="(formBranding.iconPath || iconPreview) && !iconUploading" type="button" @click="removeIcon"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs  text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {{ t('common.hapus') }}
                      </button>
                    </div>
                    <p class="text-[10px] text-gray-400 dark:text-gray-500 text-center">{{ t('admin.pengaturan.infoFilePng') }}</p>
                  </div>
                </div>

                <!-- Favicon -->
                <div class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border p-4">
                  <label class="block text-sm  text-gray-700 dark:text-gray-300 mb-3">
                    <span class="flex items-center gap-1.5">
                      <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {{ t('admin.pengaturan.labelFavicon') }}
                    </span>
                  </label>
                  <!-- Preview -->
                  <div class="flex flex-col items-center gap-3">
                    <div class="w-24 h-24 rounded-lg border-2 border-dashed admin-accent-border flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-700">
                      <img v-if="faviconPreview || formBranding.faviconPath"
                        :src="faviconPreview || formBranding.faviconPath"
                        class="w-full h-full object-contain p-1.5"
                        alt="Preview Favicon" />
                      <svg v-else class="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    </div>
                    <!-- Upload controls -->
                    <div class="flex items-center gap-2">
                      <label class="relative cursor-pointer" :class="{ 'opacity-50 pointer-events-none': faviconUploading }">
                        <input type="file" accept="image/png,image/jpeg,image/jpg,image/x-icon,image/vnd.microsoft.icon" class="sr-only" @change="handleFaviconSelect" :disabled="faviconUploading" />
                        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs  text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border admin-accent-border">
                          <svg v-if="faviconUploading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          {{ faviconUploading ? t('admin.pengaturan.mengunggah') : t('common.pilihFile') }}
                        </span>
                      </label>
                      <button v-if="(formBranding.faviconPath || faviconPreview) && !faviconUploading" type="button" @click="removeFavicon"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs  text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {{ t('common.hapus') }}
                      </button>
                    </div>
                    <p class="text-[10px] text-gray-400 dark:text-gray-500 text-center">{{ t('admin.pengaturan.infoFileIco') }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Separator -->
          <div class="border-t admin-accent-border pt-6">
            <h3 class="text-base  text-gray-900 dark:text-gray-100 mb-4">{{ t('admin.pengaturan.informasiSekolah') }}</h3>
            <div class="space-y-4">
              <!-- Logo Sekolah -->
              <div class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border p-4">
                <label class="block text-sm  text-gray-700 dark:text-gray-300 mb-3">
                  <span class="flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {{ t('admin.pengaturan.labelLogoSekolah') }}
                  </span>
                </label>
                <div class="flex flex-col items-center gap-3">
                  <div class="w-24 h-24 rounded-lg border-2 border-dashed admin-accent-border flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-700">
                    <img v-if="logoSekolahPreview || formUmum.logoSekolahPath"
                      :src="logoSekolahPreview || formUmum.logoSekolahPath"
                      class="w-full h-full object-contain p-2"
                      alt="Preview Logo Sekolah" />
                    <svg v-else class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="relative cursor-pointer" :class="{ 'opacity-50 pointer-events-none': logoSekolahUploading }">
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml" class="sr-only" @change="handleLogoSekolahSelect" :disabled="logoSekolahUploading" />
                      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs  text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border admin-accent-border">
                        <svg v-if="logoSekolahUploading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {{ logoSekolahUploading ? t('admin.pengaturan.mengunggah') : t('common.pilihFile') }}
                      </span>
                    </label>
                    <button v-if="(formUmum.logoSekolahPath || logoSekolahPreview) && !logoSekolahUploading" type="button" @click="removeLogoSekolah"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs  text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {{ t('common.hapus') }}
                    </button>
                  </div>
                  <p class="text-[10px] text-gray-400 dark:text-gray-500 text-center">{{ t('admin.pengaturan.infoFilePng') }}</p>
                </div>
              </div>
              <BaseFormField :label="t('admin.pengaturan.labelNamaSekolah')" required>
                <input v-model="formUmum.namaSekolah" type="text"
                  class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
              </BaseFormField>
              <BaseFormField :label="t('admin.pengaturan.labelAlamat')">
                <textarea v-model="formUmum.alamat" rows="2"
                  class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"></textarea>
              </BaseFormField>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <BaseFormField :label="t('admin.pengaturan.labelTelepon')">
                  <input v-model="formUmum.telp" type="text"
                    class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
                </BaseFormField>
                <BaseFormField :label="t('admin.pengaturan.labelEmail')">
                  <input v-model="formUmum.email" type="email"
                    class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
                </BaseFormField>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <BaseFormField :label="t('admin.pengaturan.labelTahunAjaran')">
                  <input v-model="formUmum.tahunAjaran" type="text"
                    class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
                </BaseFormField>
                <BaseFormField :label="t('admin.pengaturan.labelSemester')">
                  <select v-model="formUmum.semester"
                    class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700">
                    <option value="Ganjil">{{ t('semester.ganjil') }}</option>
                    <option value="Genap">{{ t('semester.genap') }}</option>
                  </select>
                </BaseFormField>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <BaseFormField :label="t('admin.pengaturan.labelKepalaSekolah')">
                  <input v-model="formUmum.kepalaSekolah" type="text"
                    class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
                </BaseFormField>
                <BaseFormField :label="t('admin.pengaturan.labelNipKepsek')">
                  <input v-model="formUmum.nipKepsek" type="text"
                    class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
                </BaseFormField>
              </div>
            </div>
          </div>
        </div>

        <!-- Absensi -->
        <div v-show="activeTab === 'absensi'" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BaseFormField :label="t('admin.pengaturan.batasScan')">
              <input v-model.number="formAbsensi.batasScan" type="number" min="1"
                class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
            </BaseFormField>
            <BaseFormField :label="t('admin.pengaturan.batasTelat')">
              <input v-model.number="formAbsensi.batasTelat" type="number" min="1"
                class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
            </BaseFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BaseFormField :label="t('admin.pengaturan.toleransiAlpha')">
              <input v-model.number="formAbsensi.toleransiAlpha" type="number" min="1"
                class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
            </BaseFormField>
          </div>
          <div class="space-y-3">
            <BaseFormField :label="t('admin.pengaturan.opsiLainnya')">
              <div class="flex items-center gap-3">
                <input v-model="formAbsensi.autoTutupSesi" type="checkbox" id="autoTutup"
                  class="w-4 h-4 rounded admin-accent-border text-blue-600 dark:bg-slate-700 focus:ring-blue-500" />
                <label for="autoTutup" class="text-sm text-gray-700 dark:text-gray-300">{{ t('admin.pengaturan.autoTutupSesi') }}</label>
              </div>
              <div class="flex items-center gap-3">
                <input v-model="formAbsensi.notifikasi" type="checkbox" id="notif"
                  class="w-4 h-4 rounded admin-accent-border text-blue-600 dark:bg-slate-700 focus:ring-blue-500" />
                <label for="notif" class="text-sm text-gray-700 dark:text-gray-300">{{ t('admin.pengaturan.kirimNotifikasi') }}</label>
              </div>
              <div class="flex items-center gap-3">
                <input v-model="formAbsensi.izinTeksBebas" type="checkbox" id="izinBebas"
                  class="w-4 h-4 rounded admin-accent-border text-blue-600 dark:bg-slate-700 focus:ring-blue-500" />
                <label for="izinBebas" class="text-sm text-gray-700 dark:text-gray-300">{{ t('admin.pengaturan.izinTeksBebas') }}</label>
              </div>
            </BaseFormField>
          </div>
        </div>

        <!-- Keamanan -->
        <div v-show="activeTab === 'keamanan'" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BaseFormField :label="t('admin.pengaturan.minPassword')">
              <input v-model.number="formKeamanan.minimalPassword" type="number" min="6"
                class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
            </BaseFormField>
            <BaseFormField :label="t('admin.pengaturan.sesiTimeout')">
              <input v-model.number="formKeamanan.sesiTimeout" type="number" min="5"
                class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
            </BaseFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BaseFormField :label="t('admin.pengaturan.maxLogin')">
              <input v-model.number="formKeamanan.maxLogin" type="number" min="1"
                class="w-full px-3.5 py-2.5 border admin-accent-border text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
            </BaseFormField>
          </div>
          <div class="space-y-3">
            <BaseFormField :label="t('admin.pengaturan.opsiKeamanan')">
              <div class="flex items-center gap-3">
                <input v-model="formKeamanan.twoFactorAuth" type="checkbox" id="2fa"
                  class="w-4 h-4 rounded admin-accent-border text-blue-600 dark:bg-slate-700 focus:ring-blue-500" />
                <label for="2fa" class="text-sm text-gray-700 dark:text-gray-300">{{ t('admin.pengaturan.aktifkan2fa') }}</label>
              </div>
              <div class="flex items-center gap-3">
                <input v-model="formKeamanan.logAktivitas" type="checkbox" id="log"
                  class="w-4 h-4 rounded admin-accent-border text-blue-600 dark:bg-slate-700 focus:ring-blue-500" />
                <label for="log" class="text-sm text-gray-700 dark:text-gray-300">{{ t('admin.pengaturan.catatLog') }}</label>
              </div>
            </BaseFormField>
          </div>
        </div>

        <div class="flex justify-end mt-6 pt-4 border-t admin-accent-border">
          <button type="submit" :disabled="saving"
            class="px-6 py-2.5 bg-blue-600 text-sm  text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
            <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {{ saving ? t('common.menyimpan') : t('admin.pengaturan.simpan') }}
          </button>
        </div>
      </form>
    </BaseCard>
  </AppLayout>
</template>
