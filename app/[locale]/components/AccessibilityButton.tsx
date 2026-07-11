"use client";

import Image from "next/image";
import Script from "next/script";

const AccessibilityButton = () => {
  return (
    <>
      {/* Always-visible accessibility icon */}
      <div
        id="accessibility-button"
        className="fixed right-5 bottom-5 z-[998] hidden sm:block cursor-pointer"
        style={{ width: 56, height: 56 }}
      >
        <Image
          src="/accessibility_logo.png"
          alt="Accessibility"
          width={56}
          height={56}
          loading="lazy"
          className="rounded-full shadow-lg"
        />
      </div>

      {/* Isharat widget script – afterInteractive ensures it runs AFTER React
          hydration completes, preventing DOM conflicts on article pages */}
      <Script
        strategy="afterInteractive"
        id="IsharatJSWidget"
        data-icon="bottom-20,right-20"
        data-key="68f64ee820c34"
        src="https://jswidget.isharat.net/script-dga-kfu-v1.3.js"
      />
    </>
  );
};

export default AccessibilityButton;
