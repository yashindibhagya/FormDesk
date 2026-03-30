import type { SurveyFormData } from '../types/survey'
import { EMPTY_SURVEY } from '../types/survey'
import { STORAGE_KEYS } from './constants'

export type SurveyDraft = {
  step: number
  values: SurveyFormData
}

export function loadSurveyDraft(): SurveyDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.surveyDraft)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SurveyDraft
    if (typeof parsed.step !== 'number' || !parsed.values) return null
    return {
      step: 0,
      values: { ...EMPTY_SURVEY, ...parsed.values },
    }
  } catch {
    return null
  }
}

export function saveSurveyDraft(draft: SurveyDraft) {
  try {
    localStorage.setItem(STORAGE_KEYS.surveyDraft, JSON.stringify(draft))
    return
  } catch {
    // Fallback for browser quota: persist draft without heavy image blobs.
    const compactDraft: SurveyDraft = {
      ...draft,
      values: {
        ...draft.values,
        designImage: '',
        designThumb1: '',
        designThumb2: '',
        designThumb3: '',
      },
    }
    try {
      localStorage.setItem(STORAGE_KEYS.surveyDraft, JSON.stringify(compactDraft))
    } catch {
      // If storage is still full, keep the app running without autosave persistence.
    }
  }
}

export function clearSurveyDraft() {
  localStorage.removeItem(STORAGE_KEYS.surveyDraft)
}

