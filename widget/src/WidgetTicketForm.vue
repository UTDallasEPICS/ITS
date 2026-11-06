<script setup lang="ts">
  import { reactive, ref } from 'vue'

  // Plain-Vue version of the partner ticket form (Nuxt UI can't run in the widget).
  // Same fields and messages as Aryan's form, minus the project picker:
  // the widget's site tag already decides the project.
  const props = withDefaults(defineProps<{ submitting?: boolean }>(), { submitting: false })

  const emit = defineEmits<{
    submit: [ticket: { title: string; description: string }]
  }>()

  const state = reactive({ title: '', description: '' })
  const errors = ref<{ title?: string; description?: string }>({})

  // Quick checks for the user. The server validates again.
  function validate() {
    const next: { title?: string; description?: string } = {}
    const title = state.title.trim()
    const description = state.description.trim()

    if (!title) next.title = 'Enter a ticket title.'
    else if (title.length > 200) next.title = 'Keep the title under 200 characters.'

    if (!description) next.description = 'Describe the issue.'
    else if (description.length > 5000)
      next.description = 'Keep the description under 5000 characters.'

    errors.value = next
    return Object.keys(next).length === 0
  }

  // The parent sends the API request and sets `submitting` while it waits.
  function handleSubmit() {
    if (props.submitting || !validate()) return
    emit('submit', { title: state.title.trim(), description: state.description.trim() })
  }
</script>

<template>
  <form class="form" novalidate @submit.prevent="handleSubmit">
    <label class="field">
      <span class="label">Title</span>
      <input
        v-model="state.title"
        type="text"
        maxlength="200"
        placeholder="Briefly summarize the issue"
        :disabled="submitting"
      />
      <span v-if="errors.title" class="error">{{ errors.title }}</span>
    </label>

    <label class="field">
      <span class="label">Description</span>
      <textarea
        v-model="state.description"
        rows="4"
        maxlength="5000"
        placeholder="What happened, and what did you expect to happen?"
        :disabled="submitting"
      />
      <span v-if="errors.description" class="error">{{ errors.description }}</span>
    </label>

    <button type="submit" class="submit" :disabled="submitting">
      {{ submitting ? 'Submitting…' : 'Submit' }}
    </button>
  </form>
</template>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .label {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }
  input,
  textarea {
    font: inherit;
    font-size: 14px;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    resize: vertical;
  }
  .error {
    font-size: 12px;
    color: #b91c1c;
  }
  .submit {
    border: none;
    border-radius: 8px;
    padding: 10px;
    background: #2563eb;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
  .submit:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
