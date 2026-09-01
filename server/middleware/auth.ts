export default defineEventHandler(async (event) => {
  const path = event.path

  if (path === '/api/auth/login' || path === '/api/auth/logout' || path.startsWith('/api/_auth/')) {
    return
  }

  if (!path.startsWith('/api/')) {
    return
  }

  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Sliding idle timeout: sesi berakhir jika tidak ada aktivitas melebihi batas
  const keamanan = await getKeamananSettings()
  const now = Date.now()
  const lastActivity = typeof session.lastActivity === 'number' ? session.lastActivity : now

  if (now - lastActivity > keamanan.sesiTimeout * 60_000) {
    await clearUserSession(event)
    throw createError({
      statusCode: 401,
      statusMessage: 'Sesi telah berakhir karena tidak ada aktivitas. Silakan login kembali.'
    })
  }

  if (session.lastActivity !== now) {
    try {
      await setUserSession(event, { lastActivity: now })
    } catch {
      // gagal refresh sesi tidak boleh memblokir request
    }
  }

  // /api/user/ accessible by any authenticated user (for profile)
  if (path.startsWith('/api/user/')) {
    return
  }

  if (path.startsWith('/api/admin/') && session.user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (path.startsWith('/api/piket/') && session.user.role !== 'ADMIN' && session.user.role !== 'GURU' && session.user.role !== 'PETUGAS_PIKET') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (path.startsWith('/api/absensi/') && session.user.role !== 'GURU') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (path.startsWith('/api/siswa/') && session.user.role !== 'SISWA') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
})
