<script setup lang="ts">
interface ProfileData {
  id: number
  nama: string
  nip: string | null
  foto: string | null
  email: string
  role: string
  isActive: boolean
  waliKelas?: { id: number; nama: string }[]
}

const { data: profile, refresh } = useFetch<ProfileData>('/api/user/profile', { immediate: true })

const form = reactive({
  nama: '',
  email: '',
  foto: null as string | null
})

const pwForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const errorMsg = ref('')
const successMsg = ref('')
const saving = ref(false)
const fotoFile = ref<File | null>(null)
const fotoPreview = ref<string | null>(null)
const fotoUploading = ref(false)
const showEditModal = ref(false)

function openEditModal() {
  errorMsg.value = ''
  successMsg.value = ''
  fotoPreview.value = null
  fotoFile.value = null
  form.nama = profile.value?.nama || ''
  form.email = profile.value?.email || ''
  form.foto = profile.value?.foto
  showEditModal.value = true
}

function closeEditModal() {
  if (saving.value) return
  showEditModal.value = false
}

const pwErrorMsg = ref('')
const pwSuccessMsg = ref('')
const savingPw = ref(false)
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const roleLabel = computed(() => {
  const role = profile.value?.role
  return role ? role.charAt(0) + role.slice(1).toLowerCase() : '-'
})

watch(profile, (val) => {
  if (val) {
    form.nama = val.nama
    form.email = val.email
    form.foto = val.foto
  }
}, { immediate: true })

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await $fetch<{ success: boolean; path: string }>('/api/user/upload', {
    method: 'POST',
    body: formData,
  })
  return res.path
}

function handleFotoSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    errorMsg.value = ''
    if (file.size > 10 * 1024 * 1024) {
      errorMsg.value = 'Foto: File terlalu besar. Maksimal 10MB'
      target.value = ''
      return
    }
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'].includes(file.type)) {
      errorMsg.value = 'Foto: Tipe file tidak didukung'
      target.value = ''
      return
    }
    fotoFile.value = file
    fotoPreview.value = URL.createObjectURL(file)
  }
}

function removeFoto() {
  fotoPreview.value = null
  fotoFile.value = null
  form.foto = null
}

async function handleSave() {
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    if (fotoFile.value) {
      fotoUploading.value = true
      const foto = await uploadFile(fotoFile.value)
      form.foto = foto
      fotoUploading.value = false
    }

    const body: Record<string, any> = {}
    if (form.nama) body.nama = form.nama
    if (form.email) body.email = form.email
    if (form.foto !== undefined) body.foto = form.foto

    await $fetch('/api/user/profile', { method: 'PUT', body })
    successMsg.value = 'Profil berhasil diperbarui'
    showEditModal.value = false
    await refresh()
  } catch (err: any) {
    fotoUploading.value = false
    errorMsg.value = err?.data?.statusMessage || 'Gagal menyimpan profil'
  } finally {
    saving.value = false
  }
}

async function handleChangePassword() {
  pwErrorMsg.value = ''
  pwSuccessMsg.value = ''

  if (!pwForm.currentPassword) {
    pwErrorMsg.value = 'Password saat ini wajib diisi'
    return
  }
  if (!pwForm.newPassword) {
    pwErrorMsg.value = 'Password baru wajib diisi'
    return
  }
  if (pwForm.newPassword.length < 6) {
    pwErrorMsg.value = 'Password baru minimal 6 karakter'
    return
  }
  if (pwForm.newPassword !== pwForm.confirmPassword) {
    pwErrorMsg.value = 'Konfirmasi password tidak cocok'
    return
  }

  savingPw.value = true
  try {
    await $fetch('/api/user/password', {
      method: 'PUT',
      body: {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword
      }
    })
    pwSuccessMsg.value = 'Password berhasil diubah'
    pwForm.currentPassword = ''
    pwForm.newPassword = ''
    pwForm.confirmPassword = ''
  } catch (err: any) {
    pwErrorMsg.value = err?.data?.statusMessage || 'Gagal mengubah password'
  } finally {
    savingPw.value = false
  }
}
</script>

<template>
  <PTKLayout>
    <PageHeader title="Profil Saya" description="Informasi akun PTK" :show-back="false" />

    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />
    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />

    <!-- Header Profil -->
    <BaseCard class="text-center">
      <div class="flex flex-col items-center">
        <div>
          <div v-if="fotoPreview || profile?.foto"
            class="w-24 h-24 rounded-full overflow-hidden border-2 border-primary-200 dark:border-primary-800 shadow-md">
            <img :src="fotoPreview || profile?.foto" class="w-full h-full object-cover" />
          </div>
          <div v-else
            class="w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 text-4xl font-bold">
            {{ profile?.nama?.charAt(0)?.toUpperCase() || 'G' }}
          </div>
        </div>

        <h2 class="mt-3 text-lg font-bold text-gray-900 dark:text-gray-100">{{ profile?.nama || '-' }}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">PTK · {{ roleLabel }}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500">NIP: {{ profile?.nip || '-' }}</p>

        <button
          type="button"
          @click="openEditModal"
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 rounded-full shadow-md shadow-primary-500/30 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Ganti Profil
        </button>
      </div>
    </BaseCard>

    <!-- Wali Kelas -->
    <BaseCard class="mt-6">
      <div class="flex items-center gap-2 mb-4">
        <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
          <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          <path d="M21 21v-2a4 4 0 0 0 -3 -3.85" />
        </svg>
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Wali Kelas</h3>
      </div>

      <div v-if="profile?.waliKelas && profile.waliKelas.length > 0" class="divide-y-[0.5px] divide-gray-100 dark:divide-slate-700/60">
        <div v-for="k in profile.waliKelas" :key="k.id" class="flex items-center gap-3 py-3">
          <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400 dark:text-gray-500 flex-shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ k.nama }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">Kelas</p>
          </div>
          <span class="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Wali</span>
        </div>
      </div>
      <p v-else class="text-sm text-gray-500 dark:text-gray-400">Bukan wali kelas.</p>
    </BaseCard>

    <!-- Ubah Password -->
    <BaseCard class="mt-6">
      <div class="flex items-center gap-2 mb-5">
        <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Ubah Password</h3>
      </div>

      <Notification type="success" :message="pwSuccessMsg" :show="!!pwSuccessMsg" @dismiss="pwSuccessMsg = ''" />
      <Notification type="error" :message="pwErrorMsg" :show="!!pwErrorMsg" @dismiss="pwErrorMsg = ''" />

      <form @submit.prevent="handleChangePassword" class="space-y-4 max-w-md">
        <BaseFormField label="Password Saat Ini" required>
          <div class="relative">
            <input v-model="pwForm.currentPassword" :type="showCurrentPassword ? 'text' : 'password'" placeholder="Masukkan password saat ini"
              class="w-full px-3.5 pr-10 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <button type="button" @click="showCurrentPassword = !showCurrentPassword" tabindex="-1"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-colors">
              <svg v-if="showCurrentPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </BaseFormField>
        <BaseFormField label="Password Baru" required>
          <div class="relative">
            <input v-model="pwForm.newPassword" :type="showNewPassword ? 'text' : 'password'" placeholder="Minimal 6 karakter"
              class="w-full px-3.5 pr-10 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <button type="button" @click="showNewPassword = !showNewPassword" tabindex="-1"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-colors">
              <svg v-if="showNewPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </BaseFormField>
        <BaseFormField label="Konfirmasi Password Baru" required>
          <div class="relative">
            <input v-model="pwForm.confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" placeholder="Ketik ulang password baru"
              class="w-full px-3.5 pr-10 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            <button type="button" @click="showConfirmPassword = !showConfirmPassword" tabindex="-1"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-colors">
              <svg v-if="showConfirmPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </BaseFormField>

        <div class="flex justify-end pt-2">
          <button type="submit" :disabled="savingPw"
            class="px-6 py-2.5 bg-orange-500 text-sm font-medium text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 inline-flex items-center gap-2 shadow-sm">
            <svg v-if="savingPw" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Ubah Password
          </button>
        </div>
      </form>
    </BaseCard>

    <!-- Modal Ganti Profil -->
    <BaseModal :show="showEditModal" title="Ganti Profil" @close="closeEditModal" max-w="max-w-lg">
      <form @submit.prevent="handleSave" class="space-y-5">
        <div class="flex flex-col items-center gap-2">
          <div class="relative">
            <div v-if="fotoPreview || form.foto"
              class="w-24 h-24 rounded-full overflow-hidden border-2 border-primary-200 dark:border-primary-800 shadow-md">
              <img :src="fotoPreview || form.foto" class="w-full h-full object-cover" />
            </div>
            <div v-else
              class="w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 text-3xl font-bold">
              {{ profile?.nama?.charAt(0)?.toUpperCase() || 'G' }}
            </div>
            <label class="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary-500 hover:bg-primary-600 flex items-center justify-center cursor-pointer shadow-md border-2 border-white dark:border-slate-700 transition-colors">
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp" class="sr-only" @change="handleFotoSelect" />
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </label>
          </div>
          <button v-if="fotoPreview || form.foto" type="button" @click="removeFoto"
            class="text-[11px] text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
            Hapus foto
          </button>
        </div>

        <BaseFormField label="Nama Lengkap" required>
          <input v-model="form.nama" type="text"
            class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        </BaseFormField>
        <BaseFormField label="Email (Akun Login)" required>
          <input v-model="form.email" type="email"
            class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
        </BaseFormField>
      </form>
      <template #footer>
        <button type="button" @click="closeEditModal"
          class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">{{ 'Batal' }}</button>
        <button type="submit" @click="handleSave" :disabled="saving"
          class="px-5 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 inline-flex items-center gap-2 shadow-sm">
          <svg v-if="saving || fotoUploading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          {{ saving || fotoUploading ? 'Menyimpan...' : 'Simpan' }}
        </button>
      </template>
    </BaseModal>
  </PTKLayout>
</template>
