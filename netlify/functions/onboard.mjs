/**
 * Netlify Function — היכרות הועברה ללקוח (localOnboardParse).
 * נשארת כ־410 Gone כדי לחסום שימוש ישן / פרוקסי.
 */

import { json, optionsResponse } from './_shared.mjs';

export const config = {
  path: ['/api/onboard', '/.netlify/functions/onboard'],
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(event);
  }
  return json(event, 410, {
    error: 'ההיכרות מקומית באפליקציה — הפונקציה הוסרה',
  });
}
