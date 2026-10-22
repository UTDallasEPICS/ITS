<script setup lang="ts">
  import { updateTicketSchema } from '../../../shared/tickets'
  import type { TicketDetail } from '../../types/ticket'

  const route = useRoute()
  const {
    data: ticket,
    status,
    error,
    refresh,
  } = await useFetch<TicketDetail>(() => `/api/tickets/${route.params.id}`)
  const editing = ref(false)
  const saving = ref(false)
  const saveError = ref('')
  const saved = ref(false)
  const draft = reactive({ title: '', description: '' })

  function startEditing() {
    if (!ticket.value?.canEdit) return
    draft.title = ticket.value.title
    draft.description = ticket.value.description
    saveError.value = ''
    saved.value = false
    editing.value = true
  }

  async function save() {
    if (saving.value || !ticket.value?.canEdit) return
    const result = updateTicketSchema.safeParse(draft)
    if (!result.success) return
    saving.value = true
    saveError.value = ''
    try {
      ticket.value = await $fetch<TicketDetail>(`/api/tickets/${route.params.id}`, {
        method: 'PATCH',
        body: result.data,
      })
      editing.value = false
      saved.value = true
    } catch {
      saveError.value =
        'We could not save your changes. Your draft is still here. Only your own open tickets can be edited.'
    } finally {
      saving.value = false
    }
  }

  watch(
    () => route.params.id,
    () => {
      editing.value = false
      saved.value = false
      saveError.value = ''
    }
  )
</script>

<template>
  <UContainer class="max-w-3xl py-10">
    <div class="mb-6 flex items-center justify-between">
      <UButton to="/tickets" variant="link">Back to tickets</UButton>
      <UButton variant="outline" :disabled="status === 'pending' || editing" @click="refresh()"
        >Refresh</UButton
      >
    </div>
    <p v-if="status === 'pending' || status === 'idle'" role="status">Loading ticket…</p>
    <TicketLoadError v-else-if="error" :status-code="error.statusCode" @retry="refresh()" />
    <UCard v-else-if="ticket">
      <template #header>
        <div class="space-y-3">
          <p class="text-muted">Ticket #{{ ticket.id }} · {{ ticket.projectName }}</p>
          <h1 class="text-2xl font-bold break-words">{{ ticket.title }}</h1>
          <div class="flex items-center justify-between gap-4">
            <TicketStatusBadge :status="ticket.status" />
            <!-- #48: mount the NPTS status control here and refresh after it saves. -->
            <UButton v-if="ticket.canEdit && !editing" variant="outline" @click="startEditing"
              >Edit ticket</UButton
            >
          </div>
        </div>
      </template>
      <div class="space-y-6">
        <p v-if="saved" role="status">Changes saved.</p>
        <UForm
          v-if="editing"
          :schema="updateTicketSchema"
          :state="draft"
          :disabled="saving"
          class="space-y-4"
          @submit="save"
        >
          <UAlert
            v-if="saveError"
            role="alert"
            color="error"
            title="Unable to save ticket"
            :description="saveError"
          />
          <UFormField name="title" label="Title" required
            ><UInput v-model="draft.title" class="w-full"
          /></UFormField>
          <UFormField name="description" label="Description" required
            ><UTextarea v-model="draft.description" :rows="6" class="w-full"
          /></UFormField>
          <div class="flex gap-3">
            <UButton type="submit" :disabled="saving">{{
              saving ? 'Saving…' : 'Save changes'
            }}</UButton>
            <UButton variant="ghost" :disabled="saving" @click="editing = false">Cancel</UButton>
          </div>
        </UForm>
        <p v-else class="break-words whitespace-pre-wrap">{{ ticket.description }}</p>
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="font-semibold">Submitted by</dt>
            <dd>{{ ticket.submitterName ?? 'Unavailable' }}</dd>
          </div>
          <div>
            <dt class="font-semibold">Created (UTC)</dt>
            <dd>
              <time :datetime="ticket.timestamp">{{
                ticket.timestamp.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
              }}</time>
            </dd>
          </div>
          <div>
            <dt class="font-semibold">GitHub issue</dt>
            <dd>
              <a
                v-if="ticket.githubIssueUrl"
                :href="ticket.githubIssueUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary underline"
                >Issue #{{ ticket.githubIssueId }}</a
              >
              <span v-else>{{ ticket.githubIssueId ?? 'Not linked yet' }}</span>
            </dd>
          </div>
        </dl>
      </div>
    </UCard>
  </UContainer>
</template>
