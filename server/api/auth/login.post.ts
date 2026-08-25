import { z } from 'zod'

const LOCK_DURATION_MINUTES = 15

const bodySchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi')
})

export default defineEventHandler(async (event) => {
  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: result.error.issues[0].message
    })
  }

  const { email, password } = result.data

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Email atau password salah' })
  }

  if (!user.isActive) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Akun ini telah dinonaktifkan. Hubungi admin.'
    })
  }

  const now = new Date()
  if (user.lockedUntil && user.lockedUntil > now) {
    const sisaMenit = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000)
    throw createError({
      statusCode: 429,
      statusMessage: `Terlalu banyak percobaan login gagal. Coba lagi dalam ${sisaMenit} menit.`
    })
  }

  const keamanan = await getKeamananSettings()

  if (!verifyPassword(password, user.passwordHash)) {
    const failedAttempts = user.failedAttempts + 1

    if (failedAttempts >= keamanan.maxLogin) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: 0,
          lockedUntil: new Date(now.getTime() + LOCK_DURATION_MINUTES * 60_000)
        }
      })
      throw createError({
        statusCode: 429,
        statusMessage: `Terlalu banyak percobaan login gagal. Akun terkunci selama ${LOCK_DURATION_MINUTES} menit.`
      })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts }
    })

    throw createError({ statusCode: 401, statusMessage: 'Email atau password salah' })
  }

  if (user.failedAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null }
    })
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      nama: user.nama,
      role: user.role,
      foto: user.foto
    },
    lastActivity: Date.now()
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      nama: user.nama,
      role: user.role,
      foto: user.foto
    }
  }
})
