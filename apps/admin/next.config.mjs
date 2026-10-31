import { createNextConfig } from '@studio/ui/next';

// The check-in page scans e-ticket QR codes with the device camera.
export default createNextConfig({ allowCamera: true });
