export default defineEventHandler(async event => ({ accountId: (await requireAdministrator(event)).accountId }))
