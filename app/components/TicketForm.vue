<script setup lang="ts">
  import type { FormSubmitEvent } from '@nuxt/ui'
  import { z } from 'zod'
  import type { TicketFormValues, TicketProjectOption } from '../types/ticket'

  const props = withDefaults(
    defineProps<{
      projects: TicketProjectOption[]
      submitting?: boolean
    }>(),
    { submitting: false }
  )

  const emit = defineEmits<{
    submit: [ticket: TicketFormValues]
  }>()

  const state = reactive({
    projectId: undefined as number | undefined,
    title: '',
    description: '',
  })

  const schema = computed(() =>
    z.object({
      projectId: z
        .number({ error: 'Choose a project.' })
        .int()
        .refine((id) => props.projects.some((project) => project.id === id), 'Choose a project.'),
      title: z.string().trim().min(1, 'Enter a ticket title.'),
      description: z.string().trim().min(1, 'Describe the issue.'),
    })
  )

  // The parent handles the API request and sets submitting while it saves.
  // The API must independently check project access and validate the payload.
  function handleSubmit(event: FormSubmitEvent<TicketFormValues>) {
    if (props.submitting || props.projects.length === 0) return
    emit('submit', event.data)
  }
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    :disabled="submitting || projects.length === 0"
    class="space-y-5"
    @submit="handleSubmit"
  >
    <p v-if="projects.length === 0" role="status" class="text-muted">
      No projects are available. Contact your NPTS team to get access to a project.
    </p>

    <UFormField label="Project" name="projectId" required>
      <USelect
        v-model="state.projectId"
        :items="projects"
        value-key="id"
        label-key="name"
        placeholder="Choose a project"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Title" name="title" required>
      <UInput v-model="state.title" placeholder="Briefly summarize the issue" class="w-full" />
    </UFormField>

    <UFormField label="Description" name="description" required>
      <UTextarea
        v-model="state.description"
        :rows="5"
        placeholder="What happened, and what did you expect to happen?"
        class="w-full"
      />
    </UFormField>

    <UButton type="submit" :disabled="submitting || projects.length === 0">
      {{ submitting ? 'Submitting…' : 'Submit ticket' }}
    </UButton>
  </UForm>
</template>
