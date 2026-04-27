import { z } from 'zod'

const CUSTOM_FABRIC_VALUE = '__custom__'

export const surveySchema = z
  .object({
    orderDate: z.string().trim().min(1, 'Order date is required'),
    deliveredBy: z.string().trim(),
    designImage: z.string().trim(),
    designImageQty: z.string().trim(),
    designThumb1: z.string().trim(),
    designThumb1Qty: z.string().trim(),
    designThumb2: z.string().trim(),
    designThumb2Qty: z.string().trim(),
    designThumb3: z.string().trim(),
    designThumb3Qty: z.string().trim(),
    jobNo: z.string().trim(),
    orderName: z.string().trim(),
    ownerName: z.string().trim(),
    nic: z.string().trim(),
    address: z.string().trim(),
    fabric: z.string().trim().min(1, 'Fabric is required'),
    fabricCustom: z.string().trim(),
    quantity: z.string().trim(),
    quantityNormal: z.string().trim(),
    quantityLeft: z.string().trim(),
    quantityRight: z.string().trim(),
    sizeHeight: z.string().trim(),
    sizeWidth: z.string().trim(),
    method: z.string().trim(),
    colors: z.string().trim(),
    xs: z.string().trim(),
    s: z.string().trim(),
    m: z.string().trim(),
    l: z.string().trim(),
    xl: z.string().trim(),
    xxl: z.string().trim(),
    male: z.boolean(),
    female: z.boolean(),
    adult: z.boolean(),
    children: z.boolean(),
    printDescription: z.string().trim(),
    printType: z.string().trim().min(1, 'Print type is required'),
    embroiderNotes: z.string().trim(),
    sublimationNotes: z.string().trim(),
    screenPrintNotes: z.string().trim(),
    stickerNotes: z.string().trim(),
    designDetail: z.string().trim(),
    ddMaharagama: z.boolean(),
    ddSublimation: z.boolean(),
    ddScreenPrint: z.boolean(),
    ddSticker: z.boolean(),
    ddSubOption: z.boolean(),
    ddScreenOption: z.boolean(),
    ddStickerOption: z.boolean(),
    sewYes: z.boolean(),
    sewNo: z.boolean(),
    sewCornerTop: z.boolean(),
    sewCornerLeft: z.boolean(),
    sewCornerRight: z.boolean(),
    sewCornerBottom: z.boolean(),
    sewCornerTopText: z.string().trim(),
    sewCornerTopLeftText: z.string().trim(),
    sewCornerTopRightText: z.string().trim(),
    sewCornerLeftText: z.string().trim(),
    sewCornerRightText: z.string().trim(),
    sewCornerBottomText: z.string().trim(),
    paymentStage: z.string().trim(),
    paymentNotPaid: z.boolean(),
    paymentFull: z.boolean(),
    paymentAdvance: z.boolean(),
    paymentDeliver: z.boolean(),
    deliveryNotes: z.string().trim(),
    notes: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    if (values.fabric === CUSTOM_FABRIC_VALUE && !values.fabricCustom.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fabricCustom'],
        message: 'Enter a custom fabric name',
      })
    }
    const designQtySlots = [
      { src: values.designImage, qty: values.designImageQty, path: 'designImageQty' as const },
      { src: values.designThumb1, qty: values.designThumb1Qty, path: 'designThumb1Qty' as const },
      { src: values.designThumb2, qty: values.designThumb2Qty, path: 'designThumb2Qty' as const },
      { src: values.designThumb3, qty: values.designThumb3Qty, path: 'designThumb3Qty' as const },
    ]
    const filledDesigns = designQtySlots.filter((s) => s.src.trim())
    if (filledDesigns.length > 1) {
      for (const slot of filledDesigns) {
        if (!slot.qty.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [slot.path],
            message: 'Enter quantity for each design',
          })
        }
      }
    }
    // Banner uses Normal / Left / Right only — all optional; do not require the single `quantity` field (hidden in UI).
    if (values.printType === 'Banner') {
      return
    }
    if (!values.quantity.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity'],
        message: 'Quantity is required',
      })
    }
  })

