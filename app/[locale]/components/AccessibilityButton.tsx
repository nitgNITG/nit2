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
          className="rounded-full shadow-lg"
        />
      </div>

      {/* Isharat widget script – works on production domain */}
      <Script
        strategy="lazyOnload"
        id="IsharatJSWidget"
        data-icon="bottom-20,right-20"
        data-key="68f64ee820c34"
        src="https://jswidget.isharat.net/script-dga-kfu-v1.3.js"
      />
    </>
  );
};

export default AccessibilityButton;
