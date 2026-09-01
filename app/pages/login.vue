<script setup lang="ts">
const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)
const showPassword = ref(false)

async function handleLogin() {
  errorMsg.value = ''
  loading.value = true

  try {
    const data = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })

    const { fetch } = useUserSession()
    await fetch()

    const role = data.user?.role
    if (role === 'ADMIN') navigateTo('/admin', { replace: true })
    else if (role === 'GURU') navigateTo('/absensi', { replace: true })
    else if (role === 'SISWA') navigateTo('/siswa', { replace: true })
    else if (role === 'PETUGAS_PIKET') navigateTo('/piket', { replace: true })
  } catch (err: any) {
    errorMsg.value = err?.data?.statusMessage || err?.statusMessage || 'Login gagal'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-50 via-[#FEFEFE] to-primary-50/40 flex items-center justify-center p-4 md:p-8">
    <!-- Decorative background elements -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none -z-0">
      <div class="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary-100/30 blur-3xl" />
      <div class="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent-50/40 blur-3xl" />
      <div class="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary-50/20 blur-3xl" />
    </div>

    <!-- Main Card -->
    <div class="w-full max-w-4xl bg-white rounded-2xl shadow-xl shadow-primary-200/30 overflow-hidden flex flex-col md:flex-row relative z-10">
      <!-- Top accent line -->
      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 z-10" />

      <!-- ==================== LEFT PANEL: School Branding ==================== -->
      <div class="hidden md:flex md:w-[38%] bg-gradient-to-br from-primary-500 to-primary-700 p-8 lg:p-10 flex-col justify-between relative overflow-hidden">
        <!-- Decorative circles -->
        <div class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary-400/15" />
        <div class="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-primary-400/15" />
        <div class="absolute top-1/3 -right-8 w-24 h-24 rounded-full bg-primary-400/10" />
        <!-- Subtle angled pattern overlay -->
        <div class="absolute inset-0 opacity-[0.03]" style="background-image: repeating-linear-gradient(45deg, #fff 0px, #fff 2px, transparent 2px, transparent 8px)" />

        <!-- Top: Logo & Identity -->
        <div>
          <div class="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center shadow-lg shadow-primary-900/20 mb-6 transform hover:scale-105 transition-transform duration-300 overflow-hidden">
            <img src="/photo/smkn4.png" alt="SMKN 4 Bandung" class="w-full h-full object-contain p-1" />
          </div>
          <h2 class="text-2xl font-bold text-white tracking-tight">SMKN 4 Bandung</h2>
          <p class="text-primary-200 text-sm mt-1 font-medium">Sistem Absensi Digital</p>

          <!-- Divider -->
          <div class="mt-4 h-px bg-gradient-to-r from-primary-400/40 to-transparent" />
        </div>

        <!-- Bottom: Motto & Info -->
        <div class="space-y-4">
          <div>
            <p class="text-white/85 text-sm leading-relaxed italic">
              "Membangun generasi unggul melalui pendidikan berkualitas dan kedisiplinan"
            </p>
            <div class="mt-3 h-0.5 w-16 bg-accent-500 rounded-full" />
          </div>

          <div class="flex items-center gap-3 text-primary-200 text-xs">
            <div class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Jl. Kliningan No.6, Kel. Turangga,<br /> 
                    Kec. Lengkong, Kota Bandung, <br />
                    Jawa Barat 40264</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== RIGHT PANEL: Login Form ==================== -->
      <div class="flex-1 p-8 md:p-10 lg:p-12">
        <!-- Mobile Logo (visible only on small screens) -->
        <div class="md:hidden text-center mb-8">
          <div class="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mx-auto mb-3 shadow-md overflow-hidden">
            <img src="/photo/smkn4.png" alt="SMKN 4 Bandung" class="w-full h-full object-contain p-0.5" />
          </div>
          <h2 class="text-lg font-bold text-gray-900">SMKN 4 Bandung</h2>
          <p class="text-xs text-gray-400 mt-0.5">Sistem Absensi Digital</p>
        </div>

        <div class="max-w-sm mx-auto md:mx-0">
          <!-- Header -->
          <div class="mb-8">
            <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Selamat Datang</h1>
            <p class="text-sm text-gray-400 mt-1.5">Silakan masuk menggunakan akun Anda</p>
          </div>

          <!-- Error Message -->
          <Transition name="fade">
            <div v-if="errorMsg" class="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2.5 shadow-sm">
              <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{{ errorMsg }}</span>
            </div>
          </Transition>

          <!-- Form -->
          <form @submit.prevent="handleLogin" class="space-y-5">
            <!-- Email Field -->
            <div>
              <label for="email" class="block text-sm font-medium text-gray-600 mb-1.5">Email</label>
              <div class="relative group">
                <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors duration-200">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  id="email"
                  v-model="email"
                  type="email"
                  required
                  autocomplete="email"
                  placeholder="email@sekolah.sch.id"
                  class="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 outline-none"
                />
              </div>
            </div>

            <!-- Password Field -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label for="password" class="block text-sm font-medium text-gray-600">Password</label>
                <button type="button" @click="showPassword = !showPassword" class="text-xs text-primary-500 hover:text-primary-600 font-medium transition-colors">
                  {{ showPassword ? 'Sembunyikan' : 'Lihat' }}
                </button>
              </div>
              <div class="relative group">
                <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors duration-200 pointer-events-none">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  placeholder="Masukkan password"
                  class="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 outline-none"
                />
              </div>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              :disabled="loading"
              class="w-full py-2.5 px-4 bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-primary-900 text-sm font-bold rounded-lg transition-all duration-200 inline-flex items-center justify-center gap-2 shadow-md shadow-accent-500/25 hover:shadow-lg hover:shadow-accent-500/30 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            >
              <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              {{ loading ? 'Memproses...' : 'Masuk' }}
            </button>
          </form>

          <!-- Role Info -->
          <div class="mt-6 p-3 bg-primary-50/60 border border-primary-100 rounded-lg">
            <p class="text-xs text-primary-700/70 text-center leading-relaxed">
              Gunakan akun yang telah diberikan oleh administrator sekolah.
              <br class="hidden sm:inline" />
              Hubungi bagian tata usaha jika mengalami kesulitan.
            </p>
          </div>

          <!-- Footer -->
          <p class="text-center text-xs text-gray-400 mt-8">
            &copy; {{ new Date().getFullYear() }} SMKN 4 Bandung
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
