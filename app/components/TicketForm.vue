<script setup lang="ts">
  import type { FormSubmitEvent } from '@nuxt/ui'
  import { computed, reactive, watch } from 'vue'
  import UForm from '@nuxt/ui/components/Form.vue'
  import UFormField from '@nuxt/ui/components/FormField.vue'
  import UInput from '@nuxt/ui/components/Input.vue'
  import UTextarea from '@nuxt/ui/components/Textarea.vue'
  import USelect from '@nuxt/ui/components/Select.vue'
  import UButton from '@nuxt/ui/components/Button.vue'
  import { createTicketSchema } from '../../shared/tickets'
  import type { TicketFormValues, TicketProjectOption } from '../types/ticket'

  const props = withDefaults(
    defineProps<{
      projects?: TicketProjectOption[]
      projectId?: number
      submitting?: boolean
      disabled?: boolean
      error?: string | null
    }>(),
    { projects: () => [], projectId: undefined, submitting: false, disabled: false, error: null }
  )

  const emit = defineEmits<{
    submit: [ticket: TicketFormValues]
  }>()

  const state = reactive({
    projectId: props.projectId as number | undefined,
    title: '',
    description: '',
  })

  watch(
    () => props.projectId,
    (id) => {
      state.projectId = id
    }
  )
  const hasProject = computed(() => props.projectId !== undefined || props.projects.length > 0)
  const blocked = computed(() => props.submitting || props.disabled || !hasProject.value)
  const schema = computed(() =>
    createTicketSchema.extend({
      projectId: createTicketSchema.shape.projectId.refine(
        (id) =>
          id !== undefined &&
          (props.projectId !== undefined
            ? id === props.projectId
            : props.projects.some((project) => project.id === id)),
        'Choose a project.'
      ),
    })
  )

  // The parent handles the API request and sets submitting while it saves.
  // The API must independently check project access and validate the payload.
  function handleSubmit(event: FormSubmitEvent<TicketFormValues>) {
    if (blocked.value) return
    emit('submit', event.data)
  }
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    :disabled="blocked"
    class="space-y-5"
    @submit="handleSubmit"
  >
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <p v-if="!hasProject" role="status" class="text-muted">
      No projects are available. Contact your NPTS team to get access to a project.
    </p>

    <UFormField v-if="projectId === undefined" label="Project" name="projectId" required>
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

    <UButton type="submit" :disabled="blocked">
      {{ submitting ? 'Submitting…' : 'Submit ticket' }}
    </UButton>
  </UForm>
</template>
