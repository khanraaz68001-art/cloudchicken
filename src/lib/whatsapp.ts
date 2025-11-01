// WhatsApp number utility functions for Indian numbers

/**
 * Standardizes a phone number for Indian WhatsApp usage
 * Ensures proper +91 country code and removes any formatting
 */
export function standardizeWhatsAppNumber(phoneNumber?: string | null): string {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // If number starts with 91 and has 12 digits total, it already has country code
  if (cleanNumber.startsWith('91') && cleanNumber.length === 12) {
    return cleanNumber;
  }
  
  // If number starts with 0, remove it (Indian mobile numbers sometimes have leading 0)
  const withoutLeadingZero = cleanNumber.replace(/^0+/, '');
  
  // If it's a 10-digit Indian mobile number, add 91 prefix
  if (withoutLeadingZero.length === 10 && /^[6-9]/.test(withoutLeadingZero)) {
    return `91${withoutLeadingZero}`;
  }
  
  // If it's already 11+ digits and starts with 91, use as is
  if (withoutLeadingZero.startsWith('91') && withoutLeadingZero.length >= 12) {
    return withoutLeadingZero;
  }
  
  // For any other case, if it looks like a valid Indian mobile number, add 91
  if (withoutLeadingZero.length === 10) {
    return `91${withoutLeadingZero}`;
  }
  
  // Return as-is if we can't determine the format
  return cleanNumber;
}

/**
 * Formats a number for WhatsApp web URL (wa.me links)
 * Ensures proper format without + sign as required by wa.me
 */
export function formatForWhatsAppURL(phoneNumber?: string | null): string {
  const standardized = standardizeWhatsAppNumber(phoneNumber);
  // wa.me links don't use + sign, just the number with country code
  return standardized;
}

/**
 * Formats a number for display purposes (with + sign and spacing)
 */
export function formatWhatsAppNumberForDisplay(phoneNumber?: string | null): string {
  const standardized = standardizeWhatsAppNumber(phoneNumber);
  if (standardized.startsWith('91') && standardized.length === 12) {
    // Format as +91 XXXXX XXXXX
    return `+91 ${standardized.slice(2, 7)} ${standardized.slice(7)}`;
  }
  return standardized ? `+${standardized}` : '';
}

/**
 * Validates if a phone number is a valid Indian mobile number
 */
export function isValidIndianMobile(phoneNumber?: string | null): boolean {
  if (!phoneNumber) return false;
  
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Remove leading 91 if present
  const withoutCountryCode = cleanNumber.startsWith('91') ? cleanNumber.slice(2) : cleanNumber;
  
  // Indian mobile numbers are 10 digits and start with 6, 7, 8, or 9
  return withoutCountryCode.length === 10 && /^[6-9]/.test(withoutCountryCode);
}