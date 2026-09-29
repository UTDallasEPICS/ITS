import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db'
import { env } from './env'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { organization } from 'better-auth/plugins/organization'
import { admin } from 'better-auth/plugins/admin'
import { ac, roles } from '#shared/access-control'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: 587,
  secure: false,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
})

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        await transporter.sendMail({
          from: env.EMAIL_FROM,
          to: email,
          subject: 'OTP for nuxt-template',
          html: `Your OTP is: ${otp}`,
        })
      },
    }),
    organization({
      ac,
      roles,
      // Lets an organization define extra roles at runtime, stored in the
      // `organizationRole` table and merged over `roles` on permission checks.
      dynamicAccessControl: { enabled: true },
    }),
    admin(),
  ],
})
