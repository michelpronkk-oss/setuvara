import { QRCodeSVG } from "qrcode.react";

import { ShareDemoClient } from "./share-demo-client";

export function ShareDemo() {
  return <ShareDemoClient qr={<QRCodeSVG aria-label="QR code that opens setuvara.com" bgColor="#ffffff" className="block h-auto w-full" fgColor="#0d0d0d" level="M" marginSize={0} role="img" size={200} value="https://setuvara.com/" />} />;
}
