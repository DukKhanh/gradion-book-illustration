import type { GenerateContentResponse } from '@google/genai'

export function parseJsonResponse(response: GenerateContentResponse, label: string): unknown {
  const text = response.text
  if (!text?.trim()) {
    throw new Error(`Gemini did not return ${label} output.`)
  }
  return JSON.parse(text)
}

export function readJpegResponse(response: GenerateContentResponse, label: string): { bytes: Uint8Array, mimeType: string } {
  const parts = response.candidates?.[0]?.content?.parts ?? []
  const image = parts.find((part) => part.inlineData?.data && part.inlineData.mimeType === 'image/jpeg')?.inlineData

  if (!image?.data || image.mimeType !== 'image/jpeg') {
    throw new Error(`Gemini did not return a JPEG ${label}.`)
  }

  const bytes = Buffer.from(image.data, 'base64')
  if (bytes.length === 0) {
    throw new Error(`Gemini returned an empty ${label}.`)
  }

  return { bytes, mimeType: image.mimeType }
}
