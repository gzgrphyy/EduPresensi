export default defineNuxtRouteMiddleware(async (to, _from) => {
  const { user, loggedIn, fetch } = useUserSession()

  // Selalu re-fetch session dari server di client-side biar state-nya fresh
  if (import.meta.client) {
    await fetch()
  }

  if (to.path === '/login') {
    if (loggedIn.value) {
      const role = user.value?.role
      if (role === 'ADMIN') return navigateTo('/admin')
      if (role === 'GURU') return navigateTo('/absensi')
      if (role === 'SISWA') return navigateTo('/siswa')
      if (role === 'PETUGAS_PIKET') return navigateTo('/piket')
    }
    return
  }

  if (to.path.startsWith('/admin') || to.path.startsWith('/absensi') || to.path.startsWith('/siswa') || to.path.startsWith('/piket')) {
    if (!loggedIn.value) {
      return navigateTo('/login')
    }

    if (to.path.startsWith('/admin') && user.value?.role !== 'ADMIN') {
      if (user.value?.role === 'GURU') return navigateTo('/absensi')
      if (user.value?.role === 'SISWA') return navigateTo('/siswa')
      return navigateTo('/login')
    }
    if (to.path.startsWith('/absensi') && user.value?.role !== 'GURU') {
      if (user.value?.role === 'ADMIN') return navigateTo('/admin')
      if (user.value?.role === 'SISWA') return navigateTo('/siswa')
      return navigateTo('/login')
    }
    if (to.path.startsWith('/siswa') && user.value?.role !== 'SISWA') {
      if (user.value?.role === 'ADMIN') return navigateTo('/admin')
      if (user.value?.role === 'GURU') return navigateTo('/absensi')
      return navigateTo('/login')
    }
    if (to.path.startsWith('/piket') && user.value?.role !== 'ADMIN' && user.value?.role !== 'GURU' && user.value?.role !== 'PETUGAS_PIKET') {
      if (user.value?.role === 'SISWA') return navigateTo('/siswa')
      return navigateTo('/login')
    }
  }
})
