// Test phone number standardization

function standardizeWhatsAppNumber(phoneNumber) {
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

console.log('Testing phone number standardization:');
console.log('Input: 9339935948 → Output:', standardizeWhatsAppNumber('9339935948'));
console.log('Input: 919339935948 → Output:', standardizeWhatsAppNumber('919339935948'));
console.log('Input: +919339935948 → Output:', standardizeWhatsAppNumber('+919339935948'));
console.log('Input: 9876543211 → Output:', standardizeWhatsAppNumber('9876543211'));
console.log('Input: 919876543211 → Output:', standardizeWhatsAppNumber('919876543211'));