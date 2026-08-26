<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  disabled?: boolean
  label?: string
}>(), {
  disabled: false,
  label: 'toggle',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function toggle() {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}
</script>

<template>
  <button type="button" role="switch" :aria-checked="modelValue" :aria-label="label" :disabled="disabled"
    :class="[
      modelValue
        ? 'bg-blue-600 ring-1 ring-blue-300'
        : 'bg-gray-200 dark:bg-slate-600 ring-1 ring-gray-300 dark:ring-slate-500',
      'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    ]"
    @click="toggle">
    <span
      :class="modelValue ? 'translate-x-[18px]' : 'translate-x-[2px]'"
      class="inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-slate-300 shadow-sm transition-all duration-200" />
  </button>
</template>
