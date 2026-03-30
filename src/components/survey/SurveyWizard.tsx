import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { ChangeEvent, MouseEvent, ReactNode } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { clearSurveyDraft, loadSurveyDraft, saveSurveyDraft } from '../../lib/draftStorage'
import { surveySchema } from '../../lib/validation'
import { useSubmissionsStore } from '../../store/useSubmissionsStore'
import type { SurveyFormData } from '../../types/survey'
import { EMPTY_SURVEY } from '../../types/survey'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'

type Props = {
  mode?: 'create' | 'edit'
  initialValues?: SurveyFormData
  submissionId?: string
}

const FABRIC_CUSTOM_VALUE = '__custom__'
const FABRIC_OPTIONS = [
  'Satin',
  'Butter Silk',
  'Suchin',
  'Micro Setting',
  'Valantina',
] as const

function getFirstNumericValue(raw: string): number | null {
  const match = raw.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const parsed = Number.parseFloat(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function getSewingLayout(widthRaw: string, heightRaw: string): {
  aspectRatio: number
  maxWidthPx?: number
} {
  const width = getFirstNumericValue(widthRaw)
  const height = getFirstNumericValue(heightRaw)
  if (!width || !height) return { aspectRatio: 16 / 9 }
  if (height > width) {
    return {
      // Keep portrait layouts compact to avoid oversized preview blocks.
      aspectRatio: 3 / 5,
      maxWidthPx: 360,
    }
  }

  const landscapeRatio = width / height
  return { aspectRatio: Math.min(Math.max(landscapeRatio, 1), 12 / 5) }
}

function buildInitialValues(values?: SurveyFormData): SurveyFormData {
  const base = { ...EMPTY_SURVEY, ...(values ?? {}) }
  const isPreset = FABRIC_OPTIONS.some(
    (option) => option.toLowerCase() === base.fabric.toLowerCase(),
  )

  if (!base.fabric || isPreset || base.fabric === FABRIC_CUSTOM_VALUE) {
    return base
  }

  return {
    ...base,
    fabric: FABRIC_CUSTOM_VALUE,
    fabricCustom: base.fabric,
  }
}

function formatQuantity(values: SurveyFormData): string {
  if (values.printType !== 'Banner') return values.quantity.trim()
  const normal = values.quantityNormal.trim()
  const left = values.quantityLeft.trim()
  const right = values.quantityRight.trim()
  return `Normal: ${normal || '-'} | Left: ${left || '-'} | Right: ${right || '-'}`
}

export function SurveyWizard({
  mode = 'create',
  initialValues,
  submissionId,
}: Props) {
  const navigate = useNavigate()
  const addSubmission = useSubmissionsStore((s) => s.addSubmission)
  const updateSubmission = useSubmissionsStore((s) => s.updateSubmission)
  const initialDraft = useMemo(
    () => (mode === 'create' ? loadSurveyDraft() : null),
    [mode],
  )
  const cancelTo = mode === 'edit' && submissionId ? `/submission/${submissionId}` : '/'
  const [isEditingTopSize, setIsEditingTopSize] = useState(false)
  const [isEditingLeftSize, setIsEditingLeftSize] = useState(false)
  const [isEditingRightSize, setIsEditingRightSize] = useState(false)
  const [isEditingBottomSize, setIsEditingBottomSize] = useState(false)
  const fabricBodyRowRef = useRef<HTMLDivElement>(null)
  const [fabricBodyHeightPx, setFabricBodyHeightPx] = useState(0)
  const defaultValues = useMemo(
    () => buildInitialValues(initialValues ?? initialDraft?.values),
    [initialValues, initialDraft?.values],
  )

  const form = useForm<SurveyFormData>({
    resolver: zodResolver(surveySchema),
    defaultValues,
    mode: 'onTouched',
  })

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = form

  const values = useWatch({ control, defaultValue: defaultValues })
  const sewingLayout = useMemo(
    () => getSewingLayout(values.sizeWidth ?? '', values.sizeHeight ?? ''),
    [values.sizeWidth, values.sizeHeight],
  )

  useLayoutEffect(() => {
    if (!values.sewYes) {
      setFabricBodyHeightPx(0)
      return
    }
    const el = fabricBodyRowRef.current
    if (!el) return
    const update = () => {
      setFabricBodyHeightPx(Math.max(32, Math.round(el.getBoundingClientRect().height)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [values.sewYes, sewingLayout.aspectRatio, sewingLayout.maxWidthPx, values.sizeWidth, values.sizeHeight])

  useEffect(() => {
    if (mode !== 'create') return
    const id = window.setTimeout(() => {
      saveSurveyDraft({
        step: 0,
        values: { ...EMPTY_SURVEY, ...(values ?? {}) },
      })
    }, 300)
    return () => window.clearTimeout(id)
  }, [values, mode])

  const onValid = useCallback(
    async (data: SurveyFormData) => {
      const compactImages = await shrinkSurveyImagesForSave(data)
      if (mode === 'edit' && submissionId) {
        const payload = {
          ...compactImages,
          fabric:
            compactImages.fabric === FABRIC_CUSTOM_VALUE
              ? compactImages.fabricCustom.trim()
              : compactImages.fabric,
          quantity: formatQuantity(compactImages),
        }
        try {
          await updateSubmission(submissionId, payload)
          navigate(`/submission/${submissionId}`, { replace: true })
        } catch {
          window.alert(
            'Could not save changes. Check your connection and Firestore rules (deploy rules; database must exist).',
          )
        }
        return
      }
      const payload = {
        ...compactImages,
        fabric:
          compactImages.fabric === FABRIC_CUSTOM_VALUE
            ? compactImages.fabricCustom.trim()
            : compactImages.fabric,
        quantity: formatQuantity(compactImages),
      }
      try {
        const id = await addSubmission(payload)
        clearSurveyDraft()
        navigate(`/submission/${id}`, { replace: true })
      } catch {
        window.alert(
          'Could not save the order. Check your connection and Firestore rules (deploy rules; database must exist).',
        )
      }
    },
    [addSubmission, navigate, mode, submissionId, updateSubmission],
  )

  const onDesignImageChange = useCallback(
    async (field: 'designImage' | 'designThumb1' | 'designThumb2' | 'designThumb3', event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      const isMain = field === 'designImage'
      const dataUrl = await fileToDataUrl(file, {
        maxDimension: isMain ? 900 : 360,
        quality: isMain ? 0.55 : 0.48,
      })
      setValue(field, dataUrl, { shouldDirty: true, shouldTouch: true })
    },
    [setValue],
  )

  const clearDesignImage = useCallback(
    (field: 'designImage' | 'designThumb1' | 'designThumb2' | 'designThumb3') => {
      setValue(field, '', { shouldDirty: true, shouldTouch: true })
    },
    [setValue],
  )

  return (
    <form onSubmit={handleSubmit(onValid)} className="no-print space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {mode === 'edit' ? 'Edit order details' : 'Order details survey'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === 'edit'
            ? 'Update and save changes to this order.'
            : 'Fill all production details. Progress autosaves on this device.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Basic info
            </p>
            <div className="mt-3 space-y-3">
              <FormField label="Order date" htmlFor="orderDate" error={errors.orderDate?.message} required>
                <Input id="orderDate" type="date" error={!!errors.orderDate} {...register('orderDate')} />
              </FormField>
              <FormField label="Delivered by" htmlFor="deliveredBy" error={errors.deliveredBy?.message}>
                <Input id="deliveredBy" type="date" error={!!errors.deliveredBy} {...register('deliveredBy')} />
              </FormField>
            </div>
          </div>

          <UploadSlot
            label="Insert design"
            image={values.designImage ?? ''}
            onChange={(event) => onDesignImageChange('designImage', event)}
            onRemove={() => clearDesignImage('designImage')}
            className="h-40 rounded-2xl"
          />
          <input type="hidden" {...register('designImage')} />
          <input type="hidden" {...register('designThumb1')} />
          <input type="hidden" {...register('designThumb2')} />
          <input type="hidden" {...register('designThumb3')} />

          <div className="grid grid-cols-3 gap-3">
            <UploadSlot
              label="Image 1"
              image={values.designThumb1 ?? ''}
              onChange={(event) => onDesignImageChange('designThumb1', event)}
              onRemove={() => clearDesignImage('designThumb1')}
              className="h-24 rounded-xl"
              compact
            />
            <UploadSlot
              label="Image 2"
              image={values.designThumb2 ?? ''}
              onChange={(event) => onDesignImageChange('designThumb2', event)}
              onRemove={() => clearDesignImage('designThumb2')}
              className="h-24 rounded-xl"
              compact
            />
            <UploadSlot
              label="Image 3"
              image={values.designThumb3 ?? ''}
              onChange={(event) => onDesignImageChange('designThumb3', event)}
              onRemove={() => clearDesignImage('designThumb3')}
              className="h-24 rounded-xl"
              compact
            />
          </div>

          <div className="space-y-3">
            <FormField label="Job No" htmlFor="jobNo" error={errors.jobNo?.message}>
              <Input id="jobNo" error={!!errors.jobNo} {...register('jobNo')} />
            </FormField>
            <FormField label="Order Name" htmlFor="orderName" error={errors.orderName?.message}>
              <Input id="orderName" error={!!errors.orderName} {...register('orderName')} />
            </FormField>
            <FormField label="Owner Name" htmlFor="ownerName" error={errors.ownerName?.message}>
              <Input id="ownerName" error={!!errors.ownerName} {...register('ownerName')} />
            </FormField>
            <FormField label="NIC" htmlFor="nic" error={errors.nic?.message}>
              <Input id="nic" error={!!errors.nic} {...register('nic')} />
            </FormField>
            <FormField label="Address" htmlFor="address" error={errors.address?.message}>
              <Textarea id="address" rows={3} error={!!errors.address} {...register('address')} />
            </FormField>
          </div>
        </Card>

        <div className="space-y-4">
          <SectionCard title="Print">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Fabric" htmlFor="fabric" error={errors.fabric?.message} required>
                <Select id="fabric" error={!!errors.fabric} {...register('fabric')}>
                  <option value="">Select fabric</option>
                  {FABRIC_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value={FABRIC_CUSTOM_VALUE}>Custom</option>
                </Select>
              </FormField>
              {values.fabric === FABRIC_CUSTOM_VALUE ? (
                <div className="md:col-span-2">
                  <FormField
                    label="Custom fabric name"
                    htmlFor="fabricCustom"
                    error={errors.fabricCustom?.message}
                    required
                  >
                    <Input
                      id="fabricCustom"
                      error={!!errors.fabricCustom}
                      placeholder="Enter custom fabric"
                      {...register('fabricCustom')}
                    />
                  </FormField>
                </div>
              ) : null}
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                <p className="text-sm font-semibold text-slate-700">Size</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Height" htmlFor="sizeHeight" error={errors.sizeHeight?.message}>
                    <Input
                      id="sizeHeight"
                      error={!!errors.sizeHeight}
                      placeholder="e.g. 6ft"
                      {...register('sizeHeight')}
                    />
                  </FormField>
                  <FormField label="Width" htmlFor="sizeWidth" error={errors.sizeWidth?.message}>
                    <Input
                      id="sizeWidth"
                      error={!!errors.sizeWidth}
                      placeholder="e.g. 3ft"
                      {...register('sizeWidth')}
                    />
                  </FormField>
                </div>
              </div>
              <FormField label="Type" htmlFor="printType" error={errors.printType?.message} required>
                <Select id="printType" error={!!errors.printType} {...register('printType')}>
                  <option value="">Select type</option>
                  <option value="Flag">Flag</option>
                  <option value="Banner">Banner</option>
                </Select>
              </FormField>
              <FormField label="Method" htmlFor="method" error={errors.method?.message}>
                <Select id="method" error={!!errors.method} {...register('method')}>
                  <option value="">Select method</option>
                  <option value="Single Side">Single Side</option>
                  <option value="Double Side">Double Side</option>
                </Select>
              </FormField>
              {values.printType === 'Banner' ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                  <p className="text-sm font-semibold text-slate-700">Quantity (Banner)</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      label="Normal"
                      htmlFor="quantityNormal"
                      error={errors.quantityNormal?.message}
                      required
                    >
                      <Input
                        id="quantityNormal"
                        error={!!errors.quantityNormal}
                        {...register('quantityNormal')}
                      />
                    </FormField>
                    <FormField
                      label="Left"
                      htmlFor="quantityLeft"
                      error={errors.quantityLeft?.message}
                      required
                    >
                      <Input
                        id="quantityLeft"
                        error={!!errors.quantityLeft}
                        {...register('quantityLeft')}
                      />
                    </FormField>
                    <FormField
                      label="Right"
                      htmlFor="quantityRight"
                      error={errors.quantityRight?.message}
                      required
                    >
                      <Input
                        id="quantityRight"
                        error={!!errors.quantityRight}
                        {...register('quantityRight')}
                      />
                    </FormField>
                  </div>
                </div>
              ) : (
                <FormField label="Quantity" htmlFor="quantity" error={errors.quantity?.message} required>
                  <Input id="quantity" error={!!errors.quantity} {...register('quantity')} />
                </FormField>
              )}
            </div>
            <FormField label="Description" htmlFor="printDescription" error={errors.printDescription?.message}>
              <Textarea id="printDescription" rows={3} error={!!errors.printDescription} {...register('printDescription')} />
            </FormField>
          </SectionCard>

          <SectionCard title="Sewing">
            <div className="grid gap-2 sm:grid-cols-2">
              <Check label="Yes" registration={register('sewYes')} />
              <Check label="No" registration={register('sewNo')} />
            </div>
            {values.sewYes ? (
              <div className="rounded-lg bg-slate-100 p-4">
                <div
                  className="relative mx-auto w-full max-w-4xl"
                  style={{
                    aspectRatio: sewingLayout.aspectRatio,
                    maxWidth: sewingLayout.maxWidthPx ? `${sewingLayout.maxWidthPx}px` : undefined,
                  }}
                >
                  <div className="absolute left-14 right-14 top-10 bottom-10 flex min-h-0 flex-col overflow-hidden border border-slate-500 bg-slate-300">
                    <div className="flex w-full min-w-0 shrink-0 items-center gap-2 px-2 py-1.5">
                      <div className="flex min-h-px min-w-12 flex-1 basis-0 items-center sm:min-w-20">
                        <span className="h-px w-full bg-slate-700" />
                      </div>
                      {values.sizeWidth?.trim() ? (
                        <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-slate-800">
                          W: {values.sizeWidth.trim()}
                        </span>
                      ) : (
                        <span className="shrink-0 whitespace-nowrap text-[10px] font-medium text-slate-600">
                          Width
                        </span>
                      )}
                      <div className="flex min-h-px min-w-12 flex-1 basis-0 items-center sm:min-w-20">
                        <span className="h-px w-full bg-slate-700" />
                      </div>
                    </div>
                    <div ref={fabricBodyRowRef} className="flex min-h-0 min-w-0 flex-1 flex-row">
                      <div className="flex h-full w-11 shrink-0 items-center justify-center overflow-visible bg-slate-300">
                        <div
                          className="flex origin-center -rotate-90 flex-row items-center gap-1.5 whitespace-nowrap"
                          style={{
                            width: fabricBodyHeightPx > 0 ? `${fabricBodyHeightPx}px` : '7rem',
                          }}
                        >
                          <div className="flex min-h-px min-w-12 flex-1 basis-0 items-center sm:min-w-20">
                            <span className="h-px w-full bg-slate-700" />
                          </div>
                          {values.sizeHeight?.trim() ? (
                            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-slate-800">
                              H: {values.sizeHeight.trim()}
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-medium text-slate-600">Height</span>
                          )}
                          <div className="flex min-h-px min-w-12 flex-1 basis-0 items-center sm:min-w-20">
                            <span className="h-px w-full bg-slate-700" />
                          </div>
                        </div>
                      </div>
                      <div className="min-h-0 min-w-0 flex-1 bg-slate-300" aria-hidden />
                    </div>
                  </div>

                  {isEditingTopSize || !values.sewCornerTopText ? (
                    <input
                      type="text"
                      className="absolute left-1/2 top-1 h-8 w-16 -translate-x-1/2 rounded-sm border border-slate-400 bg-white px-2 py-1 text-center text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      placeholder="1.2'"
                      value={values.sewCornerTopText ?? ''}
                      onChange={(event) =>
                        setValue('sewCornerTopText', event.target.value, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                      }
                      onBlur={(event) => {
                        const nextValue = event.currentTarget.value.trim()
                        setValue('sewCornerTopText', nextValue, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                        if (nextValue) setIsEditingTopSize(false)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                            ; (event.currentTarget as HTMLInputElement).blur()
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="absolute left-14 right-14 top-0 flex h-10 items-stretch justify-center gap-3 border border-slate-600 bg-white px-6 py-2 text-slate-700"
                      onClick={() => setIsEditingTopSize(true)}
                    >
                      <span className="w-px shrink-0 self-stretch bg-slate-600" />
                      <span className="flex items-center font-semibold leading-none">
                        {values.sewCornerTopText}
                      </span>
                      <span className="w-px shrink-0 self-stretch bg-slate-600" />
                    </button>
                  )}

                  {isEditingLeftSize || !values.sewCornerLeftText ? (
                    <input
                      type="text"
                      className="absolute left-1 top-1/2 h-8 w-16 -translate-y-1/2 rounded-sm border border-slate-400 bg-white px-2 py-1 text-center text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      placeholder="1.2'"
                      value={values.sewCornerLeftText ?? ''}
                      onChange={(event) =>
                        setValue('sewCornerLeftText', event.target.value, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                      }
                      onBlur={(event) => {
                        const nextValue = event.currentTarget.value.trim()
                        setValue('sewCornerLeftText', nextValue, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                        if (nextValue) setIsEditingLeftSize(false)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                            ; (event.currentTarget as HTMLInputElement).blur()
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="absolute left-0 top-10 bottom-10 flex w-14 flex-col items-center justify-center gap-2 border border-slate-600 bg-white px-1 py-5 text-slate-700"
                      onClick={() => setIsEditingLeftSize(true)}
                    >
                      <span className="h-px w-full bg-slate-600" />
                      <span className="font-semibold leading-none">
                        {values.sewCornerLeftText}
                      </span>
                      <span className="h-px w-full bg-slate-600" />
                    </button>
                  )}

                  {isEditingRightSize || !values.sewCornerRightText ? (
                    <input
                      type="text"
                      className="absolute right-1 top-1/2 h-8 w-16 -translate-y-1/2 rounded-sm border border-slate-400 bg-white px-2 py-1 text-center text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      placeholder="1.2'"
                      value={values.sewCornerRightText ?? ''}
                      onChange={(event) =>
                        setValue('sewCornerRightText', event.target.value, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                      }
                      onBlur={(event) => {
                        const nextValue = event.currentTarget.value.trim()
                        setValue('sewCornerRightText', nextValue, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                        if (nextValue) setIsEditingRightSize(false)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                            ; (event.currentTarget as HTMLInputElement).blur()
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="absolute right-0 top-10 bottom-10 flex w-14 flex-col items-center justify-center gap-2 border border-slate-600 bg-white px-1 py-5 text-slate-700"
                      onClick={() => setIsEditingRightSize(true)}
                    >
                      <span className="h-px w-full bg-slate-600" />
                      <span className="font-semibold leading-none">
                        {values.sewCornerRightText}
                      </span>
                      <span className="h-px w-full bg-slate-600" />
                    </button>
                  )}

                  {isEditingBottomSize || !values.sewCornerBottomText ? (
                    <input
                      type="text"
                      className="absolute left-1/2 bottom-1 h-8 w-16 -translate-x-1/2 rounded-sm border border-slate-400 bg-white px-2 py-1 text-center text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                      placeholder="1.2'"
                      value={values.sewCornerBottomText ?? ''}
                      onChange={(event) =>
                        setValue('sewCornerBottomText', event.target.value, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                      }
                      onBlur={(event) => {
                        const nextValue = event.currentTarget.value.trim()
                        setValue('sewCornerBottomText', nextValue, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                        if (nextValue) setIsEditingBottomSize(false)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                            ; (event.currentTarget as HTMLInputElement).blur()
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="absolute left-14 right-14 bottom-0 flex h-10 items-stretch justify-center gap-3 border border-slate-600 bg-white px-6 py-2 text-slate-700"
                      onClick={() => setIsEditingBottomSize(true)}
                    >
                      <span className="w-px shrink-0 self-stretch bg-slate-600" />
                      <span className="flex items-center font-semibold leading-none">
                        {values.sewCornerBottomText}
                      </span>
                      <span className="w-px shrink-0 self-stretch bg-slate-600" />
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Delivery">
            <FormField label="Notes" htmlFor="deliveryNotes" error={errors.deliveryNotes?.message}>
              <Textarea id="deliveryNotes" rows={3} error={!!errors.deliveryNotes} {...register('deliveryNotes')} />
            </FormField>
            {/* <FormField label="Additional notes" htmlFor="notes" error={errors.notes?.message}>
              <Textarea id="notes" rows={3} error={!!errors.notes} {...register('notes')} />
            </FormField> */}
          </SectionCard>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-4 sm:flex-row sm:items-end sm:justify-end">
        <div className="flex flex-wrap justify-end gap-2">
          <Button to={cancelTo} variant="secondary">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  )
}

type CheckProps = {
  label: string
  registration: UseFormRegisterReturn
}

function Check({ label, registration }: CheckProps) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 accent-blue-600" {...registration} />
      {label}
    </label>
  )
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="space-y-4 border-blue-100">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
      </div>
      {children}
    </Card>
  )
}

/** Smaller JPEG for Firestore: main + 3 thumbs stay under quota and upload quickly. */
async function shrinkSurveyImagesForSave(data: SurveyFormData): Promise<SurveyFormData> {
  const next = { ...data }
  const compressOne = async (
    key: 'designImage' | 'designThumb1' | 'designThumb2' | 'designThumb3',
    maxDimension: number,
    quality: number,
  ) => {
    const v = data[key]
    if (typeof v !== 'string' || !v.trim().startsWith('data:image')) return
    next[key] = await compressDataUrlToJpeg(v, maxDimension, quality)
  }
  await Promise.all([
    compressOne('designImage', 720, 0.46),
    compressOne('designThumb1', 280, 0.4),
    compressOne('designThumb2', 280, 0.4),
    compressOne('designThumb3', 280, 0.4),
  ])
  return next
}

function compressDataUrlToJpeg(dataUrl: string, maxDimension: number, quality: number): Promise<string> {
  if (!dataUrl.trim().startsWith('data:image')) {
    return Promise.resolve(dataUrl)
  }
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth || img.width
      const height = img.naturalHeight || img.height
      if (!width || !height) {
        resolve(dataUrl)
        return
      }

      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const targetW = Math.max(1, Math.round(width * scale))
      const targetH = Math.max(1, Math.round(height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, targetW, targetH)
      const compressed = canvas.toDataURL('image/jpeg', quality)
      resolve(compressed || dataUrl)
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

async function fileToDataUrl(
  file: File,
  options?: { maxDimension?: number; quality?: number },
): Promise<string> {
  const baseDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })

  if (!file.type.startsWith('image/')) return baseDataUrl

  const maxDimension = options?.maxDimension ?? 900
  const quality = options?.quality ?? 0.55
  return compressDataUrlToJpeg(baseDataUrl, maxDimension, quality)
}

function UploadSlot({
  label,
  image,
  onChange,
  onRemove,
  className,
  compact = false,
}: {
  label: string
  image: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemove?: () => void
  className: string
  compact?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleRemoveClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onRemove?.()
  }

  return (
    <div
      className={`relative overflow-hidden border border-dashed border-slate-300 bg-slate-50 ${className}`}
    >
      {image ? (
        <img
          src={image}
          alt=""
          className="pointer-events-none h-full w-full object-contain object-center"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center text-slate-500 ${compact ? 'text-xs' : 'text-sm font-medium'}`}
        >
          {label}
        </div>
      )}
      <label className="absolute inset-0 cursor-pointer">
        <span className="sr-only">{image ? `Replace ${label}` : `Upload ${label}`}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onChange}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      {image && onRemove ? (
        <button
          type="button"
          onClick={handleRemoveClick}
          className={`absolute z-10 flex items-center justify-center rounded-full bg-slate-900/80 text-white shadow-sm hover:bg-slate-900 ${compact ? 'right-1 top-1 h-6 w-6' : 'right-1.5 top-1.5 h-8 w-8'
            }`}
          aria-label={`Remove ${label}`}
        >
          <svg
            className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

