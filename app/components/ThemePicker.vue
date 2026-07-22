<script setup lang="ts">
// Full class strings are spelled out literally so Tailwind's JIT scanner keeps them.
const colors = [
  { name: 'red', class: 'bg-red-500' },
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'amber', class: 'bg-amber-500' },
  { name: 'yellow', class: 'bg-yellow-500' },
  { name: 'lime', class: 'bg-lime-500' },
  { name: 'green', class: 'bg-green-500' },
  { name: 'emerald', class: 'bg-emerald-500' },
  { name: 'teal', class: 'bg-teal-500' },
  { name: 'cyan', class: 'bg-cyan-500' },
  { name: 'sky', class: 'bg-sky-500' },
  { name: 'blue', class: 'bg-blue-500' },
  { name: 'indigo', class: 'bg-indigo-500' },
  { name: 'violet', class: 'bg-violet-500' },
  { name: 'purple', class: 'bg-purple-500' },
  { name: 'fuchsia', class: 'bg-fuchsia-500' },
  { name: 'pink', class: 'bg-pink-500' },
  { name: 'rose', class: 'bg-rose-500' }
]

const appConfig = useAppConfig()

// Persist the chosen primary color across reloads.
const primary = useCookie<string>('theme-primary', {
  default: () => appConfig.ui.colors.primary,
  maxAge: 60 * 60 * 24 * 365
})

// Apply the persisted colour on load (SSR + client).
appConfig.ui.colors.primary = primary.value

function select(name: string) {
  primary.value = name
  appConfig.ui.colors.primary = name
}
</script>

<template>
  <UPopover :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-palette"
      color="neutral"
      variant="ghost"
      aria-label="Change theme color"
    />

    <template #content>
      <div class="grid grid-cols-6 gap-1 p-2">
        <UButton
          v-for="color in colors"
          :key="color.name"
          size="sm"
          square
          variant="ghost"
          :aria-label="color.name"
          :aria-pressed="primary === color.name"
          @click="select(color.name)"
        >
          <span
            class="size-4 rounded-full ring-1 ring-inset ring-black/10"
            :class="[
              color.class,
              primary === color.name ? 'ring-2 ring-offset-2 ring-offset-default ring-inverted' : ''
            ]"
          />
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
