<script setup lang="ts">
const { t } = useI18n()
const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')
const animating = ref(false)

function toggleTheme(event: MouseEvent) {
  if (animating.value) return

  let x = event.clientX
  let y = event.clientY
  const btn = event.currentTarget as HTMLElement | null
  const rect = btn?.getBoundingClientRect()
  if (rect && x === 0 && y === 0) {
    x = rect.left + rect.width / 2
    y = rect.top + rect.height / 2
  }

  const applyMode = () => {
    colorMode.preference = isDark.value ? 'light' : 'dark'
  }

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> }
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!doc.startViewTransition || reducedMotion) {
    applyMode()
    return
  }

  animating.value = true
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )

  const transition = doc.startViewTransition(applyMode)

  transition.ready.then(() => {
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`
        ]
      },
      {
        duration: 600,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)'
      }
    )
  }).finally(() => {
    animating.value = false
  })
}
</script>

<template>
  <button
    @click="toggleTheme"
    class="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
    :title="isDark ? t('header.modeTerang') : t('header.modeGelap')"
  >
    <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
    <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  </button>
</template>
