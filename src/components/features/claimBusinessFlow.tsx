'use client'

import {
  ArrowRight,
  Buildings,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  FileArrowUp,
  FilePdf,
  MapPin,
  Phone,
  ShieldCheck,
  Warning,
  X,
} from '@phosphor-icons/react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import type { Business } from '@/types/business'

type ClaimStep =
  | 'confirm'
  | 'auth'
  | 'verify'
  | 'email-code'
  | 'document'
  | 'success'
type AuthView = 'signUp' | 'signIn'
type VerifyMethod = 'email' | 'document'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_ATTEMPTS = 3
const RESEND_COOLDOWN_SECONDS = 60

interface ClaimBusinessFlowProps {
  business: Business
  onComplete?: () => void
}

interface FormErrors {
  email?: string
  password?: string
  confirmPassword?: string
  firstName?: string
}

export function ClaimBusinessFlow({
  business,
  onComplete,
}: ClaimBusinessFlowProps) {
  const router = useRouter()
  const {
    state,
    signUp,
    signIn,
    updateClaimStatus,
    linkBusiness,
    updateVerificationStatus,
  } = useBusinessAuth()

  // Flow state
  const [currentStep, setCurrentStep] = useState<ClaimStep>('confirm')
  const [authView, setAuthView] = useState<AuthView>('signUp')

  // Auth form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Verification state (email)
  const [claimId, setClaimId] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS)
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Verification state (document)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clean up cooldown interval and preview URL on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    }
  }, [filePreviewUrl])

  // Start resend cooldown timer
  const startResendCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  // Handle step 1: Confirm business
  const handleConfirmBusiness = () => {
    setCurrentStep('auth')
  }

  // Validate auth form
  const validateAuthForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        newErrors.email = 'Please enter a valid email address'
      }
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (authView === 'signUp' && password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (authView === 'signUp') {
      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password'
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle step 2: Auth
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateAuthForm()) return

    setIsSubmitting(true)

    try {
      if (authView === 'signUp') {
        await signUp(
          email,
          password,
          firstName || undefined,
          lastName || undefined,
        )
      } else {
        await signIn(email, password)
      }
      setCurrentStep('verify')
    } catch {
      // Error handled by context
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle choosing verification method and creating claim
  const handleChooseEmail = async () => {
    setIsSubmitting(true)
    try {
      const { createBusinessClaimAction } = await import(
        '@/lib/actions/business-verification'
      )
      const result = await createBusinessClaimAction(business.id, 'email')
      if (result.success && result.claimId) {
        setClaimId(result.claimId)

        // Send the verification code
        const { sendVerificationCodeAction } = await import(
          '@/lib/actions/business-verification'
        )
        await sendVerificationCodeAction(result.claimId)
        startResendCooldown()

        setCurrentStep('email-code')
      } else {
        setVerifyError('Failed to create claim. Please try again.')
      }
    } catch {
      setVerifyError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChooseDocument = async () => {
    setIsSubmitting(true)
    try {
      const { createBusinessClaimAction } = await import(
        '@/lib/actions/business-verification'
      )
      const result = await createBusinessClaimAction(business.id, 'document')
      if (result.success && result.claimId) {
        setClaimId(result.claimId)
        setCurrentStep('document')
      } else {
        setVerifyError('Failed to create claim. Please try again.')
      }
    } catch {
      setVerifyError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle email verification code submit
  const handleVerifyCodeSubmit = async () => {
    setVerifyError(null)

    if (!/^\d{6}$/.test(verificationCode)) {
      setVerifyError('Please enter a valid 6-digit code')
      return
    }

    if (!claimId) {
      setVerifyError('No active claim found. Please restart.')
      return
    }

    setIsVerifying(true)

    try {
      const { verifyCodeAction } = await import(
        '@/lib/actions/business-verification'
      )
      const result = await verifyCodeAction(claimId, verificationCode)

      if (result.success) {
        updateVerificationStatus('verified')
        updateClaimStatus('pending')
        linkBusiness(business.id)
        setCurrentStep('success')
      } else {
        const remaining = attemptsRemaining - 1
        setAttemptsRemaining(remaining)
        if (remaining <= 0) {
          setVerifyError('Maximum attempts reached. Please request a new code.')
        } else {
          setVerifyError(
            `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
          )
        }
      }
    } catch {
      setVerifyError('Verification failed. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  // Handle resend code
  const handleResendCode = async () => {
    if (resendCooldown > 0 || !claimId) return

    try {
      const { sendVerificationCodeAction } = await import(
        '@/lib/actions/business-verification'
      )
      await sendVerificationCodeAction(claimId)
      setAttemptsRemaining(MAX_ATTEMPTS)
      setVerificationCode('')
      setVerifyError(null)
      startResendCooldown()
    } catch {
      setVerifyError('Failed to resend code. Please try again.')
    }
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const file = e.target.files?.[0]

    if (!file) return

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setFileError('Please upload a PDF, JPG, or PNG file')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError('File size must be under 5MB')
      return
    }

    // Revoke previous preview URL
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)

    setSelectedFile(file)

    // Create preview for images
    if (file.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(file))
    } else {
      setFilePreviewUrl(null)
    }
  }

  // Handle file removal
  const handleRemoveFile = () => {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    setSelectedFile(null)
    setFilePreviewUrl(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Handle document upload
  const handleDocumentUpload = async () => {
    if (!selectedFile || !claimId) return

    setIsUploading(true)
    setFileError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const { uploadVerificationDocAction } = await import(
        '@/lib/actions/business-verification'
      )
      const result = await uploadVerificationDocAction(claimId, formData)

      if (result.success) {
        updateClaimStatus('pending')
        linkBusiness(business.id)
        setCurrentStep('success')
      } else {
        setFileError('Upload failed. Please try again.')
      }
    } catch {
      setFileError('Something went wrong. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle success completion
  const handleGoToDashboard = () => {
    onComplete?.()
    router.push('/business/dashboard')
  }

  // ---- Render Step 1: Business confirmation ----
  if (currentStep === 'confirm') {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-amber-800/15 flex items-center justify-center">
              <Buildings size={32} weight="light" className="text-amber-800" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-[#451a03]">
            Is this your business?
          </h2>
          <p className="text-[#78350f]">
            Confirm the details below to claim this profile
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-[#451a03]">
              {business.name}
            </h3>
            {business.description && (
              <p className="text-sm text-[#78350f] line-clamp-2">
                {business.description}
              </p>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <MapPin
                size={18}
                weight="light"
                className="text-[#92400e] mt-0.5"
              />
              <div className="text-[#78350f]">
                <p>{business.address}</p>
                <p>
                  {business.city}, {business.state} {business.zipCode}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone size={18} weight="light" className="text-[#92400e]" />
              <span className="text-[#78350f]">{business.phone}</span>
            </div>

            <div className="flex items-center gap-3">
              <EnvelopeSimple
                size={18}
                weight="light"
                className="text-[#92400e]"
              />
              <span className="text-[#78350f]">{business.email}</span>
            </div>
          </div>
        </Card>

        <Button onClick={handleConfirmBusiness} className="w-full" size="lg">
          Yes, this is my business
          <ArrowRight size={20} weight="light" className="ml-2" />
        </Button>

        <p className="text-center text-sm text-[#92400e]">
          Not your business?{' '}
          <button
            type="button"
            onClick={() => router.back()}
            className="text-amber-800 hover:text-[var(--color-accent-hover)] transition-colors"
          >
            Go back
          </button>
        </p>
      </div>
    )
  }

  // ---- Render Step 2: Authentication ----
  if (currentStep === 'auth') {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-[#451a03]">
            {authView === 'signUp'
              ? 'Create your account'
              : 'Sign in to continue'}
          </h2>
          <p className="text-[#78350f]">
            {authView === 'signUp'
              ? 'Create a business owner account to claim your profile'
              : 'Sign in to your business owner account'}
          </p>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authView === 'signUp' && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                error={errors.firstName}
                disabled={isSubmitting}
              />
              <Input
                label="Last name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                disabled={isSubmitting}
              />
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            error={errors.email}
            disabled={isSubmitting}
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              authView === 'signUp'
                ? 'Min. 8 characters'
                : 'Enter your password'
            }
            error={errors.password}
            disabled={isSubmitting}
            required
          />

          {authView === 'signUp' && (
            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              error={errors.confirmPassword}
              disabled={isSubmitting}
              required
            />
          )}

          {state.error && (
            <p className="text-sm text-red-600 bg-red-400/10 px-3 py-2 rounded-lg">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {authView === 'signUp' ? 'Create account' : 'Sign in'}
            <ArrowRight size={20} weight="light" className="ml-2" />
          </Button>
        </form>

        <p className="text-center text-sm text-[#78350f]">
          {authView === 'signUp' ? (
            <>
              Already have a business account?{' '}
              <button
                type="button"
                onClick={() => setAuthView('signIn')}
                className="text-amber-800 hover:text-[var(--color-accent-hover)] transition-colors font-medium"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setAuthView('signUp')}
                className="text-amber-800 hover:text-[var(--color-accent-hover)] transition-colors font-medium"
              >
                Create one
              </button>
            </>
          )}
        </p>
      </div>
    )
  }

  // ---- Render Step 3: Choose Verification Method ----
  if (currentStep === 'verify') {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-amber-800/15 flex items-center justify-center">
              <ShieldCheck
                size={32}
                weight="light"
                className="text-amber-800"
              />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-[#451a03]">
            Verify your ownership
          </h2>
          <p className="text-[#78350f]">
            We need to verify you own {business.name}
          </p>
        </div>

        {verifyError && (
          <p className="text-sm text-red-600 bg-red-400/10 px-3 py-2 rounded-lg text-center">
            {verifyError}
          </p>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleChooseEmail}
            disabled={isSubmitting}
            className="w-full p-4 rounded-xl bg-surface-secondary/50 border border-border-primary hover:border-amber-800 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-800/8 flex items-center justify-center group-hover:bg-amber-800/15 transition-colors">
                <EnvelopeSimple
                  size={24}
                  weight="light"
                  className="text-amber-800"
                />
              </div>
              <div className="flex-1">
                <p className="font-medium text-[#451a03]">Verify by Email</p>
                <p className="text-sm text-[#78350f]">
                  We&apos;ll send a 6-digit code to {business.email}
                </p>
              </div>
              <Badge variant="success" size="sm">
                Fastest
              </Badge>
            </div>
          </button>

          <button
            type="button"
            onClick={handleChooseDocument}
            disabled={isSubmitting}
            className="w-full p-4 rounded-xl bg-surface-secondary/50 border border-border-primary hover:border-amber-800 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-800/8 flex items-center justify-center group-hover:bg-amber-800/15 transition-colors">
                <FileArrowUp
                  size={24}
                  weight="light"
                  className="text-amber-800"
                />
              </div>
              <div className="flex-1">
                <p className="font-medium text-[#451a03]">Verify by Document</p>
                <p className="text-sm text-[#78350f]">
                  Upload proof of ownership (PDF, JPG, or PNG)
                </p>
              </div>
            </div>
          </button>
        </div>

        {isSubmitting && (
          <p className="text-center text-sm text-[#78350f] animate-pulse">
            Setting up verification...
          </p>
        )}
      </div>
    )
  }

  // ---- Render Step 3a: Email Code Entry ----
  if (currentStep === 'email-code') {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-amber-800/15 flex items-center justify-center">
              <EnvelopeSimple
                size={32}
                weight="light"
                className="text-amber-800"
              />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-[#451a03]">
            Enter verification code
          </h2>
          <p className="text-[#78350f]">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-[#451a03]">{business.email}</span>
          </p>
        </div>

        {/* Attempts indicator */}
        <div className="flex justify-center">
          <Badge
            variant={attemptsRemaining <= 1 ? 'error' : 'default'}
            size="sm"
          >
            {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'}{' '}
            remaining
          </Badge>
        </div>

        {/* Code input */}
        <div className="space-y-4">
          <Input
            type="text"
            value={verificationCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6)
              setVerificationCode(value)
              setVerifyError(null)
            }}
            placeholder="000000"
            maxLength={6}
            className="text-center text-lg tracking-widest"
            error={verifyError || undefined}
            disabled={isVerifying || attemptsRemaining <= 0}
          />

          <Button
            onClick={handleVerifyCodeSubmit}
            className="w-full"
            size="lg"
            isLoading={isVerifying}
            disabled={
              isVerifying ||
              verificationCode.length !== 6 ||
              attemptsRemaining <= 0
            }
          >
            Verify & Submit Claim
          </Button>
        </div>

        {/* Resend code */}
        <div className="text-center space-y-2">
          {resendCooldown > 0 ? (
            <p className="text-sm text-[#92400e]">
              Resend code in {resendCooldown}s
            </p>
          ) : (
            <p className="text-sm text-[#78350f]">
              Didn&apos;t receive the code?{' '}
              <button
                type="button"
                onClick={handleResendCode}
                className="text-amber-800 hover:text-[var(--color-accent-hover)] transition-colors font-medium"
              >
                Resend
              </button>
            </p>
          )}
        </div>

        {/* Back link */}
        <button
          type="button"
          onClick={() => {
            setVerificationCode('')
            setVerifyError(null)
            setAttemptsRemaining(MAX_ATTEMPTS)
            setCurrentStep('verify')
          }}
          className="w-full text-center text-sm text-[#92400e] hover:text-[#78350f] transition-colors"
        >
          Choose a different verification method
        </button>
      </div>
    )
  }

  // ---- Render Step 3b: Document Upload ----
  if (currentStep === 'document') {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-amber-800/15 flex items-center justify-center">
              <FileArrowUp
                size={32}
                weight="light"
                className="text-amber-800"
              />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-[#451a03]">
            Upload proof of ownership
          </h2>
          <p className="text-[#78350f]">
            Provide a document proving you own {business.name}
          </p>
        </div>

        {/* Accepted formats hint */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Warning
              size={20}
              weight="light"
              className="text-[#92400e] mt-0.5 flex-shrink-0"
            />
            <div className="text-sm text-[#78350f] space-y-1">
              <p className="font-medium text-[#451a03]">Accepted documents</p>
              <p>
                Business license, utility bill, tax document, or any official
                document showing the business name and your name.
              </p>
              <p className="text-xs text-[#92400e]">
                PDF, JPG, or PNG — Max 5MB
              </p>
            </div>
          </div>
        </Card>

        {/* File upload area */}
        {!selectedFile ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-8 border-2 border-dashed border-[#d4c4b0] rounded-xl hover:border-amber-800/40 hover:bg-amber-800/5 transition-colors text-center cursor-pointer"
          >
            <FileArrowUp
              size={40}
              weight="light"
              className="text-[#92400e] mx-auto mb-3"
            />
            <p className="text-sm font-medium text-[#451a03]">
              Click to select a file
            </p>
            <p className="text-xs text-[#92400e] mt-1">
              PDF, JPG, or PNG up to 5MB
            </p>
          </button>
        ) : (
          <Card className="p-4">
            <div className="flex items-start gap-4">
              {/* File preview */}
              {filePreviewUrl ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-[#d4c4b0]">
                  <Image
                    src={filePreviewUrl}
                    alt="Document preview"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-amber-800/8 flex items-center justify-center flex-shrink-0">
                  <FilePdf
                    size={28}
                    weight="light"
                    className="text-amber-800"
                  />
                </div>
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#451a03] truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-[#92400e]">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={handleRemoveFile}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center hover:bg-red-600/20 transition-colors"
              >
                <X size={16} className="text-red-600" />
              </button>
            </div>
          </Card>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          className="hidden"
        />

        {fileError && (
          <p className="text-sm text-red-600 bg-red-400/10 px-3 py-2 rounded-lg text-center">
            {fileError}
          </p>
        )}

        <Button
          onClick={handleDocumentUpload}
          className="w-full"
          size="lg"
          isLoading={isUploading}
          disabled={!selectedFile || isUploading}
        >
          Upload & Submit Claim
        </Button>

        {/* Back link */}
        <button
          type="button"
          onClick={() => {
            handleRemoveFile()
            setCurrentStep('verify')
          }}
          className="w-full text-center text-sm text-[#92400e] hover:text-[#78350f] transition-colors"
        >
          Choose a different verification method
        </button>
      </div>
    )
  }

  // ---- Render Step 4: Success / Pending ----
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-emerald-400/20 flex items-center justify-center">
          <CheckCircle size={48} weight="fill" className="text-emerald-600" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-[#451a03]">
          Claim submitted!
        </h2>
        <p className="text-[#78350f]">
          Your claim for{' '}
          <span className="font-medium text-[#451a03]">{business.name}</span>{' '}
          has been submitted and is pending admin review.
        </p>
      </div>

      <Card className="p-4 text-left">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-800/8 flex items-center justify-center flex-shrink-0">
            <Clock size={20} weight="light" className="text-amber-800" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#451a03]">
              What happens next?
            </p>
            <p className="text-sm text-[#78350f]">
              Our team will review your verification and notify you within 24-48
              hours. Once approved, you&apos;ll have full access to manage your
              business profile.
            </p>
          </div>
        </div>
      </Card>

      <Button onClick={handleGoToDashboard} className="w-full" size="lg">
        Go to Business Dashboard
        <ArrowRight size={20} weight="light" className="ml-2" />
      </Button>
    </div>
  )
}
