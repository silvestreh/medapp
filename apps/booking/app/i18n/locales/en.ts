import { es } from './es';

export const en: typeof es = {
  auth: {
    title: 'Patient Login',
    document_label: 'Document Number',
    document_placeholder: 'Enter your document number',
    continue: 'Continue',
    verify: 'Verify',
    otp_sent: 'We sent a verification code to {{phone}}.',
    use_different_document: 'Use a different document',
    error: 'Error',
    document_required: 'Document number is required',
    enter_code: 'Please enter the 6-digit code.',
    not_found: 'No patient found with that document number.',
    no_phone: 'No phone number on record. Please contact the clinic to add one.',
    rate_limited: 'Too many attempts. Please try again later.',
    server_error: 'Could not connect to the server. Please try again.',
    invalid_code: 'Invalid or expired code.',
    something_went_wrong: 'Something went wrong.',
  },
  booking: {
    title: 'Booking',
    coming_soon: 'Your booking page is coming soon.',
  },
  common: {
    logout: 'Logout',
    error: 'Error',
    something_went_wrong: 'Something went wrong',
    try_again: 'Please try again later.',
    navigate_to_org: 'Please navigate to a valid organization URL to continue.',
    org_not_found: 'The organization does not exist or the URL is incorrect.',
  },
};
