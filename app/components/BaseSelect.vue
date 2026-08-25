<script setup lang="ts">
interface SelectOption {
  label: string
  value: string | number
}

const props = withDefaults(defineProps<{
  modelValue: string | number | null
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
}>(), {
  placeholder: 'Pilih...',
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const open = ref(false)
const highlighted = ref(-1)
const rootEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

const selectedOption = computed(() =>
  props.options.find(o => o.value === props.modelValue) || null
)

function openList() {
  open.value = true
  const idx = props.options.findIndex(o => o.value === props.modelValue)
  highlighted.value = idx >= 0 ? idx : 0
}

function toggle() {
  if (props.disabled) return
  if (open.value) {
    open.value = false
  } else {
    openList()
  }
}

function choose(option: SelectOption) {
  emit('update:modelValue', option.value)
  open.value = false
}

function onDocumentClick(e: MouseEvent) {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target as Node)) {
    open.value = false
  }
}

function moveHighlight(delta: number) {
  if (!props.options.length) return
  highlighted.value = Math.min(props.options.length - 1, Math.max(0, highlighted.value + delta))
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return

  if (!open.value) {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault()
      openList()
    }
    return
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      moveHighlight(1)
      break
    case 'ArrowUp':
      e.preventDefault()
      moveHighlight(-1)
      break
    case 'Home':
      e.preventDefault()
      highlighted.value = 0
      break
    case 'End':
      e.preventDefault()
      highlighted.value = props.options.length - 1
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (highlighted.value >= 0 && props.options[highlighted.value]) {
        choose(props.options[highlighted.value])
      }
      break
    case 'Escape':
    case 'Tab':
      open.value = false
      break
  }
}

watch(open, async (val) => {
  if (!val) return
  await nextTick()
  const target = listEl.value?.querySelector(`[data-index="${highlighted.value}"]`)
  target?.scrollIntoView({ block: 'nearest' })
})

watch(highlighted, async (val) => {
  await nextTick()
  const target = listEl.value?.querySelector(`[data-index="${val}"]`)
  target?.scrollIntoView({ block: 'nearest' })
})

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div ref="rootEl" class="relative">
    <button
      type="button"
      role="combobox"
      :aria-expanded="open"
      :disabled="disabled"
      @click="toggle"
      @keydown="onKeydown"
      class="flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        class="truncate"
        :class="selectedOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'"
      >{{ selectedOption?.label || placeholder }}</span>
      <svg
        class="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-200"
        :class="{ 'rotate-180': open }"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="open"
        ref="listEl"
        class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-md"
        role="listbox"
      >
        <button
          v-for="(option, i) in options"
          :key="String(option.value)"
          type="button"
          role="option"
          :aria-selected="option.value === modelValue"
          :data-index="i"
          @click="choose(option)"
          @mousemove="highlighted = i"
          class="relative flex w-full cursor-pointer select-none items-center py-1.5 pl-8 pr-3 text-sm outline-none"
          :class="i === highlighted ? 'bg-gray-100 dark:bg-slate-700' : ''"
        >
          <svg
            v-if="option.value === modelValue"
            class="absolute left-2 w-4 h-4 text-primary-600 dark:text-primary-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="truncate text-gray-900 dark:text-gray-100">{{ option.label }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>
