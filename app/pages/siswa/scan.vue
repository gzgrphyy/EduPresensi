<script setup lang="ts">
import jsQR from 'jsqr'

const route = useRoute()

const hasCamera = ref(false)
const cameraError = ref('')
const scanning = ref(false)
const scanComplete = ref(false)
const manualCode = ref('')
const result = ref<{
  success: boolean
  blocked?: boolean
  alreadyScanned?: boolean
  message: string
  status?: string
  scannedAt?: string
  ruangan?: { id: number; nama: string }
  sesi?: { id: number; mapel: string; kelas: string; jamMulai?: string; jamSelesai?: string; guru?: string }
} | null>(null)
const errorMsg = ref('')
const submitting = ref(false)
const torchOn = ref(false)
const availableCameras = ref<MediaDeviceInfo[]>([])
const selectedCameraIndex = ref(0)
const cameraSwitching = ref(false)
const cameraReady = ref(false)

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const streamRef = ref<MediaStream | null>(null)
const animFrameId = ref(0)
const lastDetectTime = ref(0)

/**
 * Daftar kamera yang tersedia — dipanggil SETELAH stream jalan,
 * karena enumerateDevices() butuh izin yang sudah diberikan.
 */
async function refreshCameraList() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    availableCameras.value = devices.filter(d => d.kind === 'videoinput')
  } catch {
    // abaikan
  }
}

/**
 * Mulai kamera dengan index tertentu (default 0 = kamera pertama).
 * Tidak bikin temp stream — langsung getUserMedia.
 */
async function startCamera() {
  if (!import.meta.client) return

  cameraError.value = ''
  hasCamera.value = false
  scanning.value = false
  cameraReady.value = false

  // Hentikan stream lama
  stopCamera()

  // videoRef sudah pasti ada karena pakai v-show (element selalu di DOM)
  // Langsung coba akses kamera

  // Prioritas: user -> environment -> tanpa facingMode
  // Di laptop: user = webcam internal.
  const constraintsList: MediaTrackConstraints[] = [
    { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
    { width: { ideal: 640 }, height: { ideal: 480 } }
  ]

  let stream: MediaStream | null = null
  let lastError: any = null

  for (const video of constraintsList) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: false })
      if (stream) break
    } catch (err: any) {
      lastError = err
    }
  }

  if (!stream) {
    handleCameraError(lastError)
    return
  }

  // Simpan stream
  streamRef.value = stream

  // Pasang ke video element
  videoRef.value.srcObject = stream
  videoRef.value.setAttribute('playsinline', '')

  try {
    await videoRef.value.play()
  } catch (err: any) {
    // Kalau play gagal (misal user belum interaksi), coba lagi setelah interaksi
    if (err?.name === 'NotAllowedError') {
      cameraError.value = 'Browser membutuhkan interaksi. Klik tombol "Coba Lagi" di bawah.'
      stopCamera()
      return
    }
  }

  // Tandai camera siap dan mulai scan
  cameraReady.value = true
  hasCamera.value = true
  scanning.value = true
  scanComplete.value = false

  // Mulai loop scan
  scanLoop()

  // Setelah stream jalan, enumerate camera untuk tombol switch
  await refreshCameraList()
}

function stopCamera() {
  scanning.value = false
  cameraReady.value = false
  if (animFrameId.value) {
    cancelAnimationFrame(animFrameId.value)
    animFrameId.value = 0
  }
  if (streamRef.value) {
    streamRef.value.getTracks().forEach(t => {
      t.stop()
      t.enabled = false
    })
    streamRef.value = null
  }
}

async function switchCamera() {
  if (availableCameras.value.length < 2 || cameraSwitching.value) return
  cameraSwitching.value = true

  const nextIndex = (selectedCameraIndex.value + 1) % availableCameras.value.length
  const camera = availableCameras.value[nextIndex]

  stopCamera()
  await nextTick()

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: camera.deviceId },
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    })

    streamRef.value = stream
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      videoRef.value.setAttribute('playsinline', '')
      await videoRef.value.play()
    }

    // Update index hanya setelah stream benar-benar berhasil
    selectedCameraIndex.value = nextIndex
    cameraReady.value = true
    hasCamera.value = true
    scanning.value = true
    scanComplete.value = false
    scanLoop()
  } catch {
    // Fallback: start ulang dengan facingMode
    await startCamera()
  } finally {
    cameraSwitching.value = false
  }
}

function handleCameraError(err: any) {
  hasCamera.value = false
  scanning.value = false

  const name = err?.name || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    cameraError.value = 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu coba lagi.'
  } else if (name === 'NotFoundError') {
    cameraError.value = 'Kamera tidak ditemukan di perangkat ini.'
  } else if (name === 'NotReadableError') {
    cameraError.value = 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi kamera lain, lalu coba lagi.'
  } else if (name === 'SecurityError') {
    cameraError.value = 'Akses kamera butuh koneksi HTTPS. Akses via localhost atau gunakan ngrok, atau masukkan kode manual.'
  } else if (name === 'OverconstrainedError') {
    cameraError.value = 'Kamera tidak kompatibel. Silakan masukkan kode QR secara manual.'
  } else {
    cameraError.value = 'Kamera tidak tersedia. Silakan masukkan kode QR secara manual.'
  }
}

function scanLoop() {
  if (!scanning.value || !videoRef.value || !canvasRef.value) return

  const video = videoRef.value
  const canvas = canvasRef.value

  if (video.readyState >= video.HAVE_CURRENT_DATA) {
    const vw = video.videoWidth
    const vh = video.videoHeight

    if (vw > 0 && vh > 0) {
      const scale = Math.min(640 / vw, 480 / vh, 1)
      const sw = Math.round(vw * scale)
      const sh = Math.round(vh * scale)

      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(video, 0, 0, sw, sh)
        const imageData = ctx.getImageData(0, 0, sw, sh)

        const now = Date.now()
        if (now - lastDetectTime.value >= 300) {
          lastDetectTime.value = now
          try {
            const code = jsQR(imageData.data, imageData.width, imageData.height)
            if (code && code.data && !submitting.value && !scanComplete.value) {
              handleScan(code.data)
            }
          } catch { /* skip frame */ }
        }
      }
    }
  }

  animFrameId.value = requestAnimationFrame(scanLoop)
}

async function handleScan(code: string) {
  if (submitting.value || scanComplete.value) return
  submitting.value = true

  errorMsg.value = ''
  result.value = null

  let qrCode = code
  try {
    const url = new URL(code)
    const param = url.searchParams.get('code')
    if (param) qrCode = param
  } catch { /* plain text code */ }

  try {
    const res = await $fetch('/api/siswa/scan', {
      method: 'POST',
      body: { qrCode }
    })
    result.value = res as any
    scanComplete.value = true
    if (res.success) {
      stopCamera()
    }
  } catch (err: any) {
    errorMsg.value = err?.data?.statusMessage || 'Gagal melakukan absensi'
  } finally {
    submitting.value = false
  }
}

async function submitManual() {
  if (!manualCode.value.trim()) return
  await handleScan(manualCode.value.trim())
}

function resetScan() {
  result.value = null
  errorMsg.value = ''
  scanComplete.value = false
  submitting.value = false
  manualCode.value = ''
  startCamera()
}

function toggleTorch() {
  if (!streamRef.value) return
  const track = streamRef.value.getVideoTracks()[0]
  const caps = (track as any).getCapabilities?.()
  if (!caps?.torch) {
    torchOn.value = false
    return
  }
  torchOn.value = !torchOn.value
  ;(track as any).applyConstraints({
    advanced: [{ torch: torchOn.value }]
  }).catch(() => {
    torchOn.value = false
  })
}

onMounted(() => {
  const codeParam = route.query.code as string
  if (codeParam) {
    manualCode.value = codeParam
    handleScan(codeParam)
  } else {
    startCamera()
  }
})

onUnmounted(() => {
  stopCamera()
})

const statusLabels: Record<string, string> = {
  PENDING: 'Menunggu Konfirmasi',
  HADIR: 'Hadir',
  SAKIT: 'Sakit',
  IZIN: 'Izin',
  ALPHA: 'Alpha'
}
</script>

<template>
  <StudentLayout>
    <PageHeader
      title="Scan QR Absensi"
      description="Arahkan kamera ke QR Code ruangan untuk absen"
      back-to="/siswa"
    />

    <div v-if="errorMsg && !result" class="max-w-lg mx-auto mb-4">
      <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
        <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ errorMsg }}</span>
      </div>
    </div>

    <div class="max-w-lg mx-auto">
      <BaseCard>
        <template v-if="!result && !scanComplete">
          <div v-if="cameraError && !hasCamera" class="text-center py-8 px-4">
            <div class="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto mb-3">
              <svg class="w-7 h-7 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p class="text-sm text-gray-700 dark:text-gray-300 mb-1">{{ cameraError }}</p>
            <div class="mt-3 flex flex-col gap-2 items-center">
              <button @click="startCamera"
                class="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors inline-flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Coba Lagi
              </button>
              <p class="text-xs text-gray-400 dark:text-gray-500">Atau masukkan kode QR manual di bawah</p>
            </div>
          </div>

          <div v-if="!hasCamera && !cameraError" class="text-center py-12">
            <svg class="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p class="text-sm text-gray-500 dark:text-gray-400">Mengakses kamera...</p>
          </div>

          <div v-show="hasCamera" class="relative">
            <div class="relative bg-black rounded-lg overflow-hidden">
              <video
                ref="videoRef"
                class="w-full h-72 sm:h-80 object-cover bg-black"
                autoplay
                playsinline
                muted
              ></video>
              <canvas ref="canvasRef" class="hidden"></canvas>

              <!-- QR frame overlay -->
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="relative w-48 h-48">
                  <div class="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-white rounded-tl"></div>
                  <div class="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-white rounded-tr"></div>
                  <div class="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-white rounded-bl"></div>
                  <div class="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-white rounded-br"></div>
                  <div class="absolute left-2 right-2 h-0.5 bg-green-400 shadow-lg shadow-green-400/50 animate-scan-line"></div>
                </div>
              </div>

              <div class="absolute top-3 left-3 flex items-center gap-2">
                <span class="text-xs text-white/80 bg-black/50 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                  {{ !cameraReady ? 'Menyiapkan kamera...' : submitting ? 'Memproses...' : 'Scan QR...' }}
                </span>
              </div>

              <div class="absolute top-3 right-3 flex items-center gap-1.5">
                <!-- Tombol Ganti Kamera -->
                <button
                  v-if="availableCameras.length > 1"
                  @click="switchCamera"
                  :disabled="cameraSwitching"
                  class="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors"
                  title="Ganti kamera"
                >
                  <svg v-if="!cameraSwitching" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </button>

                <!-- Tombol Lampu (Torch) -->
                <button
                  v-if="hasCamera"
                  @click="toggleTorch"
                  class="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors"
                  title="Lampu kilat"
                >
                  <svg v-if="!torchOn" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <svg v-else class="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-100 dark:border-slate-700 pt-4 mt-4">
            <p class="text-xs text-gray-400 dark:text-gray-500 mb-2 inline-flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Kamera bermasalah? Masukkan kode QR secara manual:
            </p>
            <form @submit.prevent="submitManual" class="flex gap-2">
              <input
                v-model="manualCode"
                type="text"
                placeholder="Contoh: R-001"
                class="flex-1 px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-shadow"
              />
              <button
                type="submit"
                :disabled="submitting || !manualCode.trim()"
                class="px-4 py-2.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
              >
                <svg v-if="submitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Absen
              </button>
            </form>
          </div>
        </template>

        <template v-if="result">
          <div class="text-center py-4">
            <div :class="result.success ? 'bg-green-100 dark:bg-green-900/40' : result.blocked ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-red-100 dark:bg-red-900/40'"
              class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <svg v-if="result.success" class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <svg v-else-if="result.blocked" class="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <svg v-else class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>

            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {{ result.success ? 'Absensi Berhasil!' : result.blocked ? 'Sudah Absen' : 'Absensi Gagal' }}
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-5">{{ result.message }}</p>

            <div v-if="result.ruangan || result.sesi" class="bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-700 p-4 mb-5 text-left space-y-2.5 text-sm">
              <div v-if="result.ruangan" class="flex justify-between items-center">
                <span class="text-gray-500 dark:text-gray-400">Ruangan</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ result.ruangan.nama }}</span>
              </div>
              <div v-if="result.sesi" class="flex justify-between items-center">
                <span class="text-gray-500 dark:text-gray-400">Mata Pelajaran</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ result.sesi.mapel }}</span>
              </div>
              <div v-if="result.sesi?.kelas" class="flex justify-between items-center">
                <span class="text-gray-500 dark:text-gray-400">Kelas</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ result.sesi.kelas }}</span>
              </div>
              <div v-if="result.sesi?.jamMulai" class="flex justify-between items-center">
                <span class="text-gray-500 dark:text-gray-400">Jam</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ result.sesi.jamMulai }} - {{ result.sesi.jamSelesai }}</span>
              </div>
              <div v-if="result.sesi?.guru" class="flex justify-between items-center">
                <span class="text-gray-500 dark:text-gray-400">PTK</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ result.sesi.guru }}</span>
              </div>
              <div v-if="result.status" class="flex justify-between items-center">
                <span class="text-gray-500 dark:text-gray-400">Status</span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full flex-shrink-0" :class="statusDotColor[result.status] || 'bg-gray-400'"></span>
                  <span class="text-xs text-gray-600 dark:text-gray-400">{{ statusLabels[result.status] || result.status }}</span>
                </span>
              </div>
              <div v-if="result.scannedAt" class="flex justify-between items-center">
                <span class="text-gray-500 dark:text-gray-400">Waktu</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ new Date(result.scannedAt).toLocaleTimeString('id-ID') }}</span>
              </div>
            </div>

            <div class="flex gap-2 justify-center">
              <NuxtLink to="/siswa"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 active:bg-gray-300 transition-colors"
              >
                Kembali ke Beranda
              </NuxtLink>
              <button @click="resetScan"
                :disabled="submitting"
                class="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 active:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {{ result.success || result.blocked ? 'Scan Lagi' : 'Coba Lagi' }}
              </button>
            </div>
          </div>
        </template>
      </BaseCard>

      <div class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg">
        <div class="flex gap-2.5">
          <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Tips Scan QR</p>
<ul class="mt-1.5 space-y-1.5 text-xs text-blue-700 dark:text-blue-300">
              <li class="flex items-start gap-2">
                <span class="mt-1.5 w-1 h-1 rounded-full bg-blue-400 dark:bg-blue-500 flex-shrink-0"></span>
                <span>Pastikan pencahayaan ruangan cukup.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-1.5 w-1 h-1 rounded-full bg-blue-400 dark:bg-blue-500 flex-shrink-0"></span>
                <span>Izinkan akses kamera pada browser.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-1.5 w-1 h-1 rounded-full bg-blue-400 dark:bg-blue-500 flex-shrink-0"></span>
                <span>Arahkan kamera ke bagian tengah QR Code.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-1.5 w-1 h-1 rounded-full bg-blue-400 dark:bg-blue-500 flex-shrink-0"></span>
                <span>Tunggu beberapa saat hingga QR Code terbaca otomatis.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </StudentLayout>
</template>

<style scoped>
@keyframes scan-line {
  0%, 100% { top: 4px; }
  50% { top: calc(100% - 12px); }
}

.animate-scan-line {
  animation: scan-line 2s ease-in-out infinite;
}
</style>
